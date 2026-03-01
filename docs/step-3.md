# Step 3 — Rate Limiting, Error Tracking, and E2E Test Scaffolding

Step 2 added security headers, structured logging, and a seed script. Step 3 closes the three remaining gaps that block a production launch: abuse prevention on auth endpoints, visibility into uncaught exceptions, and a real browser test suite.

---

## Decisions

| Concern              | Decision                    | Rationale                                                                            |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| Rate limiter library | `@upstash/ratelimit`        | Clean sliding-window API; works with any Redis instance (not Upstash-hosted only)    |
| Rate limiter scope   | `/api/auth/**` routes only  | Auth endpoints are the primary brute-force target; other routes can be added per-app |
| Rate limit defaults  | 10 requests / 60 s per IP   | Conservative default; tunable via env vars                                           |
| Error tracking       | Sentry via `@sentry/nextjs` | De-facto standard; opt-in: no-op when `SENTRY_DSN` is absent                         |
| E2E CI target        | Built production server     | Tests exactly what ships; avoids dev-only code paths masking production bugs         |
| E2E framework        | Playwright                  | First-class Next.js support; maintained by Microsoft                                 |

---

## Outcomes

- Auth endpoints are rate-limited; repeated requests from a single IP receive `429 Too Many Requests`
- Uncaught server exceptions are captured and shipped to Sentry when `SENTRY_DSN` is set
- A Playwright smoke test runs in CI: load `/`, assert nav renders — proves the app boots and serves HTML
- All quality gates (lint, typecheck, test, build, CI) remain green

---

## 3.1 Rate limiting

### Env vars

Add to `packages/config/src/index.ts`:

```ts
RATE_LIMIT_REQUESTS: z.coerce.number().int().positive().default(10),
RATE_LIMIT_WINDOW:   z.string().default('60 s'),
```

Add to `.env.example`:

```
# Rate limiting (applies to /api/auth/**)
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60 s
```

### Packages

```
@upstash/ratelimit  →  apps/web  (production dep)
@upstash/redis      →  apps/web  (production dep)
```

> `@upstash/redis` is used here as the Redis adapter for `@upstash/ratelimit`. It is configured via `REDIS_URL` from the existing config — no Upstash account required.

### Implementation — `apps/web/middleware.ts`

The middleware currently runs only the Auth.js auth check. Extend it to:

1. Check if the incoming path matches `/api/auth/**`
2. Extract the client IP from `x-forwarded-for` (fallback: `127.0.0.1`)
3. Run a sliding-window rate limit check via `@upstash/ratelimit`
4. Return `429 Too Many Requests` with a `Retry-After` header if the limit is exceeded
5. Otherwise continue to the existing auth middleware

Rate limiter singleton (module-level, not per-request):

```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from '@repo/config';

const ratelimit = new Ratelimit({
  redis: new Redis({ url: config.REDIS_URL }),
  limiter: Ratelimit.slidingWindow(config.RATE_LIMIT_REQUESTS, config.RATE_LIMIT_WINDOW),
  prefix: 'rl:auth',
});
```

> Keep the `export const config` matcher unchanged — it already covers `/app/**` and `/admin/**`. Add `/api/auth/:path*` to the matcher for rate limiting only.

Checklist:

- [ ] Add `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW` to config schema and `.env.example`
- [ ] Install `@upstash/ratelimit`, `@upstash/redis` in `apps/web`
- [ ] Add rate limit logic to `middleware.ts` before the auth check
- [ ] Return `429` with `Retry-After` header when limit exceeded
- [ ] Logger call on rate-limit hit: `logger.warn({ ip }, 'rate limit exceeded')`

Acceptance:

- [ ] 11 rapid requests to `/api/auth/signin` from the same IP → 11th returns `429`
- [ ] Requests to non-auth routes are not rate-limited
- [ ] `pnpm typecheck` passes

---

## 3.2 Sentry error tracking

### Env var

Add to `packages/config/src/index.ts`:

```ts
SENTRY_DSN: z.string().url().optional(),
```

Add to `.env.example`:

```
# Error tracking (optional — skip to disable Sentry)
SENTRY_DSN=
```

### Packages

```
@sentry/nextjs  →  apps/web  (production dep)
```

### Implementation

Next.js expects Sentry config in three files at `apps/web/`:

| File                      | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `sentry.client.config.ts` | Browser instrumentation                         |
| `sentry.server.config.ts` | Server/Node.js instrumentation                  |
| `sentry.edge.config.ts`   | Edge runtime instrumentation                    |
| `instrumentation.ts`      | Next.js entrypoint that loads the configs above |

All Sentry init calls are guarded:

```ts
import * as Sentry from '@sentry/nextjs';
import { config } from '@repo/config';

if (config.SENTRY_DSN) {
  Sentry.init({ dsn: config.SENTRY_DSN, tracesSampleRate: 1.0 });
}
```

`apps/web/app/error.tsx` — call `Sentry.captureException(error)` inside the component
(already receives `error` as a prop from Next.js error boundary).

Checklist:

- [ ] Add `SENTRY_DSN` to config schema and `.env.example`
- [ ] Install `@sentry/nextjs` in `apps/web`
- [ ] Create `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- [ ] Create `apps/web/instrumentation.ts` (Next.js convention, auto-loaded)
- [ ] Update `apps/web/app/error.tsx` to call `Sentry.captureException(error)` when DSN is set
- [ ] `SENTRY_DSN` absent → zero Sentry calls, no errors thrown

Acceptance:

- [ ] `SENTRY_DSN` unset → app starts, no Sentry-related errors in console
- [ ] `SENTRY_DSN` set → errors surface in Sentry dashboard
- [ ] `pnpm build` passes (Sentry Next.js plugin integrates at build time)
- [ ] `pnpm typecheck` passes

---

## 3.3 Playwright E2E scaffolding

### Packages

```
@playwright/test  →  apps/web  (devDependency)
```

Install browser binaries via `pnpm exec playwright install --with-deps chromium` (add to CI step, not required locally for all devs).

### Files to create

| File                            | Purpose                  |
| ------------------------------- | ------------------------ |
| `apps/web/playwright.config.ts` | Playwright configuration |
| `apps/web/e2e/smoke.spec.ts`    | First smoke test         |

### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
      },
});
```

In CI, the server is started externally (see CI step below); locally, `webServer` starts dev.

### `e2e/smoke.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('home page renders nav', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav')).toBeVisible();
});
```

### CI step

Add to `.github/workflows/ci.yml` after the build step:

```yaml
- name: Run E2E tests
  run: |
    pnpm --filter @repo/web exec playwright install --with-deps chromium
    pnpm --filter @repo/web start &
    pnpm --filter @repo/web exec playwright test
  env:
    PLAYWRIGHT_BASE_URL: http://localhost:3000
```

The production server (`next start`) is backgrounded; Playwright connects to it. The
existing health-check curl step can be removed or kept alongside the E2E step.

Checklist:

- [ ] Install `@playwright/test` as devDep in `apps/web`
- [ ] Create `playwright.config.ts`
- [ ] Create `e2e/smoke.spec.ts`
- [ ] Add E2E step to CI workflow
- [ ] Add `apps/web/e2e/` and `apps/web/playwright-report/` to `.gitignore`

Acceptance:

- [ ] `pnpm exec playwright test` from `apps/web/` passes locally (against dev server)
- [ ] CI E2E step passes against the built production server
- [ ] Smoke test fails if `<nav>` is missing — change `nav.tsx` temporarily to verify

---

## Definition of Done

- [ ] 11th auth request from same IP within 60 s → `429`
- [ ] `SENTRY_DSN` absent → app starts cleanly; no Sentry errors
- [ ] `pnpm exec playwright test` → smoke test passes locally
- [ ] CI passes: lint → typecheck → test → build → E2E
- [ ] `just test` (lint + typecheck + unit tests + build) remains green

---

## Non-goals for Step 3

- No rate limiting on non-auth API routes (add per-app as needed)
- No Sentry performance monitoring / tracing (tracesSampleRate can be tuned per-app)
- No authenticated E2E tests — smoke test covers public routes only
- No Playwright visual regression testing
- No other error tracking providers (Highlight, OpenTelemetry) — swap Sentry per-app
