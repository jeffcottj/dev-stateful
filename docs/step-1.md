# Step 1 — Auth, User Model, UI Foundation, and Deployment Baseline

Step 0 established plumbing: running app, DB/Redis connectivity, migrations, enforced quality gates — but zero domain logic. Step 1 adds the first layer of substance every real app in the org needs: authentication, a user record, a consistent UI shell, enforced behavioral patterns for APIs and UX, and a production-grade deployment artifact.

---

## Decisions

These are locked in for the template. Record them in code and docs; don't relitigate them per-app.

| Concern          | Decision                                         | Rationale                                                                |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Auth library     | Auth.js v5 (NextAuth)                            | First-class Next.js App Router support; active v5 development            |
| OAuth providers  | Google + Microsoft Entra ID                      | Covers consumer (Google) and org/enterprise (Entra) cases out of the box |
| Session strategy | Stateless JWT; no `sessions` table               | Simpler ops; revisit only if revocation becomes a requirement            |
| User table       | Custom `users` table; manual upsert in callbacks | Avoids coupling to Auth.js adapter schema; keeps DB schema explicit      |
| UI library       | shadcn/ui + Tailwind CSS                         | Accessible primitives, copy-owned components, no runtime library lock-in |
| Role model       | Binary enum: `user \| admin`                     | Enough for access control patterns; per-app extension is straightforward |

> **Auth.js v5 API note:** v5 differs meaningfully from v4. Config lives in `apps/web/auth.ts`, not inside `[...nextauth]/route.ts`. Use `auth()` everywhere — not `getServerSession()`. This doc assumes v5 throughout.

> **Entra setup note:** Microsoft Entra requires an App Registration in the Azure portal before any code works. Set redirect URIs to `http://localhost:3000/api/auth/callback/microsoft-entra-id` (dev) and your production URL. Decide at setup time whether the registration is single-tenant (one org) or multi-tenant (`common` endpoint).

---

## Outcomes

- Sign in via Google or Microsoft Entra → session established → user row created in DB with `role: 'user'`
- Routes under `/app/**` require a session; `/admin/**` additionally requires `role: 'admin'`
- Home page and all auth pages use a consistent shadcn/ui shell — no raw HTML
- All API routes return `{ ok: true, data } | { ok: false, error }` envelope
- `docker build` produces a working production image that passes the health check
- All quality gates (lint, typecheck, test, build, CI smoke test) remain green

---

## 1.1 Env vars + config

Add to `.env.example`:

```
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=          # generate: openssl rand -base64 32

# Google OAuth — https://console.cloud.google.com/
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft Entra ID — Azure App Registration
ENTRA_CLIENT_ID=
ENTRA_CLIENT_SECRET=
ENTRA_TENANT_ID=          # use 'common' for multi-tenant, or your tenant GUID for single-org
```

Checklist:

- [ ] Add all vars to `.env.example` with the inline comments above
- [ ] Extend `packages/config/src/index.ts` Zod schema:
  - [ ] `NEXTAUTH_URL` — required URL string
  - [ ] `NEXTAUTH_SECRET` — required string, min 32 chars
  - [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — optional when `AUTH_ENABLED=false`; required when `true`
  - [ ] `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID` — same conditional-required pattern
- [ ] Export the auth-related config fields from `packages/config` for use in `auth.ts`

Acceptance:

- [ ] `AUTH_ENABLED=true` with any provider var missing → startup error that names each missing variable
- [ ] `AUTH_ENABLED=false` → app starts cleanly with no provider vars set
- [ ] `pnpm typecheck` passes after schema changes

---

## 1.2 Auth.js v5 setup

Files to create:

| File                                           | Purpose                                             |
| ---------------------------------------------- | --------------------------------------------------- |
| `apps/web/auth.ts`                             | Auth.js config: providers, callbacks, session shape |
| `apps/web/app/api/auth/[...nextauth]/route.ts` | Re-exports handlers from `auth.ts`                  |
| `apps/web/middleware.ts`                       | Route protection via `auth()`                       |
| `apps/web/app/auth/signin/page.tsx`            | Custom sign-in page                                 |
| `apps/web/app/auth/error/page.tsx`             | Auth error display                                  |
| `apps/web/app/auth/signout/page.tsx`           | Sign-out confirmation (optional)                    |

Checklist:

- [ ] Install `next-auth@beta` in `apps/web`
- [ ] `auth.ts` — configure providers:
  - [ ] `Google({ clientId, clientSecret })` from validated config
  - [ ] `MicrosoftEntraId({ clientId, clientSecret, tenantId })` from validated config — import from `next-auth/providers/microsoft-entra-id`
- [ ] `auth.ts` — callbacks:
  - [ ] `signIn`: upsert the user into the `users` table; return `true` to allow sign-in
  - [ ] `jwt`: after upsert, persist `id` and `role` into the JWT token
  - [ ] `session`: expose `user.id` and `user.role` on the session object (extend the `Session` type via module augmentation)
- [ ] `middleware.ts`: require session for `/app/**`; allow public paths: `/`, `/auth/**`, `/api/health`, `/api/auth/**`
- [ ] Sign-in page: one shadcn `Button` per provider inside a `Card`; no inline styles or custom CSS
- [ ] Error page: display the Auth.js error code (passed as a search param) in a `Card` with a back-to-sign-in link

Acceptance:

- [ ] Unauthenticated `GET /app/anything` → redirect to `/auth/signin`
- [ ] Sign-in via Google → session established → user row in DB
- [ ] Sign-in via Microsoft Entra → session established → user row in DB
- [ ] `auth()` returns the session correctly in both a Server Component and an API route handler
- [ ] Sign-out → session cleared → redirect to `/`
- [ ] Auth error (e.g. misconfigured callback URL) → `/auth/error` renders the error code

---

## 1.3 User record in DB

### Schema

`packages/db/src/schema.ts` additions:

```
users
  id            uuid        PK, default gen_random_uuid()
  email         text        UNIQUE NOT NULL
  name          text        nullable
  image         text        nullable
  role          user_role   NOT NULL, default 'user'
  created_at    timestamptz NOT NULL, default now()
  last_seen_at  timestamptz NOT NULL, default now()

user_role enum: 'user' | 'admin'
```

### Migration

- [ ] Create `packages/db/migrations/0002_users.sql`:
  - [ ] `CREATE TYPE user_role AS ENUM ('user', 'admin')`
  - [ ] `CREATE TABLE users (...)` with all columns above
- [ ] Add entry to `packages/db/migrations/meta/_journal.json`
- [ ] Confirm `pnpm --filter @repo/db run db:migrate` applies cleanly on a fresh DB

### Drizzle

- [ ] Define `userRoleEnum = pgEnum('user_role', ['user', 'admin'])` in `schema.ts`
- [ ] Define `users` table with Drizzle column types matching the SQL above
- [ ] Export `users` and `userRoleEnum` from `packages/db/src/index.ts`

### Upsert in `signIn` callback

```sql
INSERT INTO users (email, name, image)
VALUES ($1, $2, $3)
ON CONFLICT (email)
DO UPDATE SET
  name = EXCLUDED.name,
  image = EXCLUDED.image,
  last_seen_at = NOW()
RETURNING id, role
```

- [ ] Use the returned `id` and `role` in `jwt` callback so they flow into the session
- [ ] No separate sign-up flow — upsert handles both first-time and returning users

Acceptance:

- [ ] First sign-in → row in `users` with correct email, name, image, `role = 'user'`
- [ ] Second sign-in → `last_seen_at` updated; no duplicate row
- [ ] `just reset && just dev` → sign in → row created (idempotent across resets)

---

## 1.4 Authorization middleware

Checklist:

- [ ] Extend `middleware.ts` to check `session.user.role` for `/admin/**` routes:
  - [ ] Unauthenticated → redirect to `/auth/signin`
  - [ ] Authenticated, non-admin → redirect to `/` (or render a 403; redirect is simpler)
  - [ ] Authenticated, admin → allow through
- [ ] Export `requireRole(session, role)` from `apps/web/lib/auth.ts` — throws a redirect if the role requirement isn't met; use this in Server Components that need role checks beyond middleware
- [ ] Add stub `apps/web/app/admin/page.tsx`: renders "Admin area" in a shadcn `Card`; protected by middleware (no role check needed inside the page itself)

Acceptance:

- [ ] Admin user → `/admin` → sees placeholder page
- [ ] Non-admin user → `/admin` → redirected to `/`
- [ ] Unauthenticated user → `/admin` → redirected to `/auth/signin`
- [ ] `requireRole` unit-tested: passes for matching role, throws/redirects for insufficient role (see 1.8)

---

## 1.5 UI foundation (shadcn/ui + Tailwind)

> shadcn/ui components are added via CLI, not installed as a package. The CLI copies component source into `apps/web/components/ui/`. Never `pnpm add` a shadcn component directly.

Checklist:

- [ ] Initialize Tailwind CSS in `apps/web`: `tailwind.config.ts`, `postcss.config.mjs`, `globals.css` import
- [ ] Initialize shadcn/ui: `pnpm dlx shadcn@latest init` — New York style, neutral base color, CSS variables on
- [ ] Add components via `pnpm dlx shadcn@latest add`:
  - [ ] `button`, `card`, `badge`, `avatar`, `dropdown-menu`, `sonner`
- [ ] Update `apps/web/app/layout.tsx`:
  - [ ] Render `<Toaster />` from sonner
  - [ ] Apply base font and background via Tailwind + shadcn CSS variables
- [ ] Create `apps/web/components/nav.tsx` (Server Component):
  - [ ] Calls `auth()` to get session
  - [ ] Authenticated: `Avatar` + display name + role `Badge` + sign-out `DropdownMenu`
  - [ ] Unauthenticated: "Sign in" link to `/auth/signin`
  - [ ] App name / logo as a text placeholder; no external image assets
- [ ] Update `apps/web/app/page.tsx`: use nav shell + shadcn `Card` components; remove current plain HTML
- [ ] Add `apps/web/app/error.tsx`: global error boundary using shadcn `Card`; includes "Try again" button
- [ ] Add `apps/web/app/not-found.tsx`: 404 page using shadcn `Card`; includes link home

Acceptance:

- [ ] `just dev` → home page has nav shell and Card layout; no unstyled HTML
- [ ] Nav is auth-aware (user info vs sign-in link)
- [ ] Navigating to a nonexistent route renders the 404 page
- [ ] `pnpm typecheck` passes

---

## 1.6 API response envelope

Define in `packages/config/src/types.ts`:

```ts
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: string; code?: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

This is a **breaking change** to `/api/health`. Update the CI smoke test in the same PR — do not defer.

Checklist:

- [ ] Add `types.ts` to `packages/config`; export the three types from the package index
- [ ] Update `apps/web/app/api/health/route.ts` to return `ApiResponse`:
  ```json
  {
    "ok": true,
    "data": {
      "status": "ok",
      "db": { "ok": true, "latencyMs": 4 },
      "redis": { "ok": true, "latencyMs": 1 },
      "time": "..."
    }
  }
  ```
- [ ] All existing and future API routes use `ApiResponse<T>` as their return type
- [ ] Update CI smoke test assertion to match the new shape
- [ ] Document the envelope and toast conventions in `CONTRIBUTING.md`:
  - API routes return `ApiResponse<T>`; clients check `ok` before accessing `data`
  - Client mutations show `toast()` from sonner on success and error — never silent `console.log`
- [ ] Add `apps/web/app/loading.tsx` — global loading UI (Tailwind spinner or skeleton; no third-party library)
- [ ] Demonstrate `toast()` in at least one client component (e.g., the sign-out button)

Acceptance:

- [ ] `GET /api/health` returns the envelope shape
- [ ] CI smoke test passes with the updated assertion
- [ ] `pnpm typecheck` passes with correct use of `ApiResponse<T>`

---

## 1.7 Production Dockerfile

Enable `output: 'standalone'` in `apps/web/next.config.ts` first — required for the runner stage.

Files to create:

| File                                | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `apps/web/Dockerfile`               | Multi-stage production build                               |
| `infra/docker/compose.prod.yml`     | Postgres + Redis + app; no dev tooling                     |
| `infra/docker/compose.override.yml` | Dev-only additions (keeps `compose.yml` clean)             |
| `.dockerignore`                     | Exclude `node_modules`, `.next`, `.env` from build context |

### Dockerfile stages

1. **`deps`** — `FROM node:24-alpine AS deps`; enable corepack; `pnpm install --frozen-lockfile`
2. **`builder`** — copy source + deps; accept `ARG` for any env vars needed at build time; `pnpm build`
3. **`runner`** — `FROM node:24-alpine AS runner`; copy `.next/standalone` + `.next/static` + `public`; `ENV NODE_ENV=production`; `EXPOSE 3000`; `CMD ["node", "server.js"]`

Additional:

- [ ] `HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1` in the runner stage
- [ ] `compose.prod.yml`: postgres (named volume) + redis + app service; only port 3000 exposed; all secrets via env — no hardcoded values
- [ ] `compose.override.yml` holds dev-only additions so `compose.yml` stays the clean dev baseline
- [ ] Optional `just build-image` recipe: `docker build -t app -f apps/web/Dockerfile .`

Acceptance:

- [ ] `docker build -t app -f apps/web/Dockerfile .` from repo root succeeds
- [ ] `docker run --env-file .env -p 3000:3000 app` → `GET /api/health` returns `{ ok: true, ... }`
- [ ] Final image contains no `node_modules` source or dev artifacts
- [ ] `just reset` still works (dev compose unchanged)

---

## 1.8 Quality gates

Checklist:

- [ ] Add to CI workflow env:
  - [ ] `NEXTAUTH_SECRET` — any 32-char string (dummy is fine; no real auth flow in CI)
  - [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — dummy values
  - [ ] `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID` — dummy values
  - [ ] `AUTH_ENABLED=true` (forces Zod to validate provider var presence)
- [ ] New unit tests:
  - [ ] `requireRole()` — passes for matching role, throws/redirects for insufficient role
  - [ ] `ApiResponse<T>` — type-level test: `ok: true` narrows to `ApiSuccess`, `ok: false` narrows to `ApiError`
- [ ] Update CI smoke test to assert the new `/api/health` envelope
- [ ] Confirm `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass locally before opening the PR

Acceptance:

- [ ] CI passes end-to-end: lint → typecheck → test → build → smoke test
- [ ] No new `@ts-ignore` or untyped `any` introduced

---

## Definition of Done

- [ ] `just dev` → sign in (Google or Entra) → user row in DB with `role: 'user'` → `/app/**` accessible
- [ ] Sign out → session cleared → redirect to `/`
- [ ] Non-admin → `/admin` → redirect; unauthenticated → `/admin` → redirect to sign-in
- [ ] Home page renders nav shell (auth-aware), shadcn Cards — no raw HTML
- [ ] `error.tsx` and `not-found.tsx` render correctly
- [ ] All API routes use the `{ ok, data | error }` envelope; `/api/health` updated
- [ ] `just test` green (lint + typecheck + unit tests + build)
- [ ] `docker build` succeeds; container passes health check
- [ ] CI passes on a PR

---

## Non-goals for Step 1

- No email / transactional messaging
- No profile management UI (name, avatar, email change)
- No admin dashboard with real data — placeholder page only
- No background workers or job queues
- No structured logging or observability (pino, OpenTelemetry, Sentry)
- No multi-tenancy
- No magic-link, passwordless, or password auth — OAuth only in Step 1
- No fine-grained RBAC — the `user | admin` enum is the full role model; extend per-app
- No deployment pipeline — `Dockerfile` is the artifact; registry and CI/CD wiring are per-app concerns
