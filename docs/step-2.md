# Step 2 — Security Headers, Structured Logging, and DB Seed Script

Step 1 delivered authentication, a user model, a UI shell, and a production Docker image. Step 2 adds three capabilities that are invisible to end users but essential for operating the application safely and diagnosing problems when they occur: HTTP security headers that harden the browser's handling of the app, structured logging so server events are observable, and a seed script so development environments have consistent, role-differentiated test data from the start.

---

## Decisions

| Concern          | Decision                           | Rationale                                                               |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Security headers | Configured in `next.config.ts`     | Applied to every route at the framework level; no per-route boilerplate |
| CSP in dev       | Allow `unsafe-eval` in development | Next.js dev mode requires eval for HMR; production CSP is strict        |
| Logger library   | `pino` + `pino-pretty`             | Fastest structured logger for Node.js; near-zero request overhead       |
| Log format       | JSON in production, pretty in dev  | Machine-readable for log aggregators in prod; human-readable locally    |
| Log level source | Existing `LOG_LEVEL` env var       | No new config variable needed; already validated by `packages/config`   |
| Seed script      | Idempotent; lives in `packages/db` | Safe to re-run; co-located with schema and migrations                   |

---

## Outcomes

- Every HTTP response carries the full set of security headers; CSP is strict in production, relaxed only for `unsafe-eval` in development
- Server-side errors and warnings are emitted as structured JSON (production) or color-formatted text (development) via `logger`
- `just seed` populates the database with one admin user and one regular user, idempotently
- All quality gates (lint, typecheck, test, build, CI) remain green

---

## 2.1 HTTP security headers

Add security headers to `apps/web/next.config.ts` using Next.js's `headers()` config hook. Headers apply to all routes via `source: '/(.*)'`.

### Headers to configure

| Header                      | Value (production)                             | Purpose                                                     |
| --------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `X-Frame-Options`           | `SAMEORIGIN`                                   | Block clickjacking; allow same-origin framing only          |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevent MIME-type sniffing                                  |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Send full referrer on same-origin; origin only cross-origin |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Disable all sensitive browser APIs by default               |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforce HTTPS for 2 years; eligible for HSTS preload list   |
| `Content-Security-Policy`   | See directive list below                       | Restrict executable content sources                         |

### CSP directives

```ts
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
```

- `unsafe-eval` is included only when `NODE_ENV !== 'production'` (required by Next.js HMR)
- `frame-ancestors 'none'` supersedes `X-Frame-Options` in CSP-aware browsers; both are set for full coverage

### `next.config.ts` structure

```ts
const nextConfig: NextConfig = {
  // ...existing options (output, transpilePackages)...
  serverExternalPackages: ['pino', 'pino-pretty'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

> **Note:** `serverExternalPackages: ['pino', 'pino-pretty']` must be added in this step alongside the logger. Pino's worker-thread transport breaks the Next.js bundle if pino is bundled; marking it external tells Next.js to load it from `node_modules` at runtime.

Checklist:

- [ ] Define `isDev` from `process.env.NODE_ENV !== 'production'`
- [ ] Build `cspDirectives` string from the directive list above
- [ ] Define `securityHeaders` array with all six headers
- [ ] Add `headers()` hook to `nextConfig` returning `[{ source: '/(.*)', headers: securityHeaders }]`
- [ ] Add `serverExternalPackages: ['pino', 'pino-pretty']` to `nextConfig`

Acceptance:

- [ ] `curl -I http://localhost:3000` (dev) → response includes `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`
- [ ] Dev CSP contains `unsafe-eval`; production CSP does not
- [ ] `pnpm build` passes

---

## 2.2 Structured logging

### Packages

```
pino        →  apps/web  (production dep)
pino-pretty →  apps/web  (production dep — used by the transport, must be resolvable at runtime)
```

> Both are production deps (not devDeps) because pino-pretty is loaded at runtime in the development process via pino's `transport` option, and it must be resolvable in the worker thread that pino spawns.

### Logger module

Create `apps/web/lib/logger.ts`:

```ts
import pino from 'pino';
import { config } from '@repo/config';

export const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});
```

- `level` comes from the existing `LOG_LEVEL` config field — no new env var
- pino-pretty transport is only activated in development; production emits plain JSON
- The module exports a singleton `logger` instance; import it wherever logging is needed

### Wire logger into the health route

Update `apps/web/app/api/health/route.ts`:

- [ ] Import `logger` from `@/lib/logger`
- [ ] Replace any `console.error` calls with `logger.error({ err }, 'health: db check failed')` and `logger.error({ err }, 'health: redis check failed')`
- [ ] After status is determined, add: `if (status === 'degraded') logger.warn({ dbOk, redisOk }, 'health: degraded')`

Checklist:

- [ ] Install `pino` and `pino-pretty` in `apps/web`
- [ ] Create `apps/web/lib/logger.ts` as above
- [ ] Update health route to import and use `logger` for error and warn paths
- [ ] Confirm `pnpm typecheck` passes

Acceptance:

- [ ] `LOG_LEVEL=debug just dev` → structured output (colorized in terminal) for each health check call
- [ ] Production build (`NODE_ENV=production`) → logger emits JSON, not pretty-printed text
- [ ] No `console.error` or `console.warn` remaining in `health/route.ts`
- [ ] `pnpm typecheck` passes

---

## 2.3 Database seed script

### Purpose

Provide a repeatable way to populate the `users` table with two test accounts — one `admin` and one `user` — for local development and review environments. The script is idempotent: running it against a database that already has these rows is a no-op.

### Implementation

Create `packages/db/src/seed.ts`:

```ts
// Uses onConflictDoNothing() — safe to run multiple times
const seeds = [
  { email: 'admin@example.com', name: 'Admin User', role: 'admin' as const },
  { email: 'user@example.com', name: 'Regular User', role: 'user' as const },
];

const result = await db
  .insert(users)
  .values(seeds)
  .onConflictDoNothing()
  .returning({ email: users.email, role: users.role });
```

- `onConflictDoNothing()` — conflict target is the `email` unique constraint; existing rows are left unchanged
- Logs how many rows were inserted (zero means already seeded)
- Exits with code 1 on error so CI-like contexts can detect failure

### Package script

Add to `packages/db/package.json`:

```json
"scripts": {
  "seed": "tsx src/seed.ts"
}
```

### Justfile recipe

Add to `Justfile`:

```just
# Seed the database with development test users
seed:
  pnpm --filter @repo/db run seed
```

Checklist:

- [ ] Create `packages/db/src/seed.ts` with the two seed rows and `onConflictDoNothing()`
- [ ] Add `"seed": "tsx src/seed.ts"` to `packages/db/package.json` scripts
- [ ] Add `seed` recipe to `Justfile`

Acceptance:

- [ ] `just seed` → inserts two rows on a fresh DB; prints inserted emails and roles
- [ ] `just seed` run a second time → prints "Seed users already exist — nothing inserted."
- [ ] `just reset && just dev && just seed` → rows present; sign-in as `admin@example.com` via the matching OAuth identity works
- [ ] `pnpm typecheck` passes in `packages/db`

---

## Definition of Done

- [ ] `curl -I http://localhost:3000` returns all six security headers
- [ ] Production CSP has no `unsafe-eval`; development CSP does
- [ ] `apps/web/lib/logger.ts` exists; health route uses `logger` for all error/warn paths
- [ ] `just seed` populates admin and user rows idempotently
- [ ] `just test` green (lint + typecheck + unit tests + build)
- [ ] CI passes

---

## Non-goals for Step 2

- No request-level access logging (log every inbound HTTP request) — add per-app with pino-http if needed
- No log shipping or aggregation (Datadog, Logtail, etc.) — infrastructure concern; configure per deployment
- No Sentry or other error tracking — added in Step 3
- No rate limiting — added in Step 3
- No email functionality — added in Step 4
- No CSP reporting endpoint (`report-uri` / `report-to`) — add per-app if compliance requires it
- No nonce-based CSP — `unsafe-inline` is used for compatibility with Next.js; nonce-based CSP requires additional Next.js middleware configuration
