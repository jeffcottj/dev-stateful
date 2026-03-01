# Step 0 — Clone-and-run Baseline (Checklist + Acceptance Criteria)

Purpose: establish a generic, repeatable foundation for **any** stateful web application template. No domain logic. No app-specific models. Just “it runs,” “it connects,” and “it’s enforceable in CI.”

---

## Outcomes

- A new contributor can go from `git clone` → running app + dependencies with **one command**.
- The app proves connectivity to Postgres (and Redis if included) via a health endpoint.
- Migrations are real and run automatically in dev and CI.
- Lint/typecheck/tests/build are enforced locally and in CI.

---

## 0.1 Lock-in decisions (record these)

**Decisions to make once and standardize:**

- [ ] Language: TypeScript (app + tooling)
- [ ] Framework: Next.js (App Router)
- [ ] Runtime: Node.js (pin v24 LTS)
- [ ] Package manager: pnpm
- [ ] Database: PostgreSQL
- [ ] Redis included as a compose service (recommended even if unused)
- [ ] Docker is the default dev path (dependencies at minimum)

**Record the decisions:**
- [ ] Document in README (“Project defaults” section)
- [ ] Add `.nvmrc` and/or `.tool-versions` (asdf) for Node version pinning
- [ ] Enforce package manager (e.g., `packageManager` in root `package.json`)

---

## 0.2 Repo layout (generic)

Target structure:

- [ ] `apps/web/` — Next.js app
- [ ] `packages/config/` — env parsing + validation
- [ ] `packages/db/` — migrations + DB client/adapter
- [ ] `infra/docker/` — compose + docker files
- [ ] `.github/workflows/` — CI
- [ ] `docs/` — step docs and ops notes

Acceptance:
- [ ] Nothing in the structure implies a specific domain (no “users”, “orders”, etc.)

---

## 0.3 One-command dev experience

Choose a single golden path command, e.g.:

- [ ] `make dev` **or** `just dev` **or** `pnpm dev:docker`

It must perform this order:

- [ ] Bring up dependencies (compose)
- [ ] Apply migrations
- [ ] Start Next.js dev server

Also provide:

- [ ] `make reset` (or equivalent) to stop services, remove volumes, and return to a clean slate
- [ ] `make test` (or equivalent) to run quality gates

Acceptance:
- [ ] The documented golden-path command is the top of README “Quickstart”
- [ ] A new machine needs **no manual ordering decisions**

---

## 0.4 Docker Compose baseline (dev)

Compose must include:

**postgres**
- [ ] named volume for data
- [ ] healthcheck

**redis** (recommended)
- [ ] healthcheck

Optional:
- [ ] mail sink (Mailpit) only if you plan email in Step 1; otherwise omit

Acceptance:
- [ ] `docker compose up -d` reaches healthy state for postgres (and redis if present)

---

## 0.5 Env vars + validation (fail fast)

Files:

- [ ] `.env.example` present and complete
- [ ] `.env` is gitignored
- [ ] `packages/config` validates env vars (e.g., Zod) and produces typed config

Minimum env vars (even if some unused in Step 0):

App:
- [ ] `NODE_ENV`
- [ ] `APP_URL`
- [ ] `LOG_LEVEL`

DB:
- [ ] `DATABASE_URL`

Redis (if present):
- [ ] `REDIS_URL`

Auth placeholders:
- [ ] `AUTH_ENABLED=false`
- [ ] `OIDC_ISSUER=`
- [ ] `OIDC_CLIENT_ID=`
- [ ] `OIDC_CLIENT_SECRET=`
- [ ] `OIDC_CALLBACK_URL=`

Acceptance:
- [ ] Missing/invalid env vars produce a clear startup error with the variable name(s)
- [ ] Config is imported from `packages/config` (no scattered `process.env.*` use)

---

## 0.6 Minimal app behavior (prove plumbing, nothing else)

Implement:

- [ ] `GET /api/health` returns JSON with:
  - [ ] `status: "ok" | "degraded"`
  - [ ] `version` (from package.json and/or git SHA if available)
  - [ ] `db: { ok: boolean, latencyMs?: number }`
  - [ ] `redis: { ok: boolean, latencyMs?: number }` (if included)
  - [ ] `time` (server time, ISO)

- [ ] Home page `/` shows:
  - [ ] “Template running”
  - [ ] environment (dev/prod)
  - [ ] DB status
  - [ ] Redis status (if included)

Acceptance:
- [ ] Health route does at least one real DB query
- [ ] No domain entities exist beyond a generic meta table (below)

---

## 0.7 Migrations exist in Step 0 (even if trivial)

Pick a migration tool and wire it now.

Minimum:

- [ ] Migration `0001_init` creates a generic table:
  - [ ] `app_meta (key text primary key, value text, updated_at timestamptz default now())`
- [ ] Seed a row (either in migration or a seed script):
  - [ ] `('template_status', 'ok')`

Acceptance:
- [ ] The health endpoint reads `template_status` from DB
- [ ] Migrations run as part of the golden-path bootstrap command
- [ ] A contributor can reset and re-run without manual cleanup steps

---

## 0.8 Local quality gates

Implement scripts:

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test` (even if only one placeholder unit test exists)
- [ ] `pnpm build` (Next.js build)

Acceptance:
- [ ] All scripts run successfully on a clean clone after quickstart
- [ ] Formatting is deterministic (Prettier configured)

Optional but recommended:
- [ ] pre-commit hook for formatting/lint (only if it doesn’t block contributors excessively)

---

## 0.9 CI quality gates (PR enforcement)

GitHub Actions workflow:

- [ ] Uses pinned Node version
- [ ] Installs dependencies with caching
- [ ] Runs: lint → typecheck → test → build

Recommended smoke test with DB:

- [ ] CI starts Postgres (service container)
- [ ] Runs migrations
- [ ] Hits `GET /api/health` (or runs an equivalent node smoke script)

Acceptance:
- [ ] PR cannot merge unless CI passes
- [ ] CI is deterministic (no hidden manual steps)

---

## 0.10 Minimal OSS hygiene

- [ ] LICENSE (choose one)
- [ ] CONTRIBUTING.md (how to run, how to propose changes)
- [ ] CODEOWNERS (optional, if you want review routing)
- [ ] SECURITY.md (how to report security issues)
- [ ] Dependabot or Renovate config

Acceptance:
- [ ] Repo communicates “how to work with me” without needing to ask the maintainer

---

## Step 0 Definition of Done (DoD)

Step 0 is complete when:

- [ ] `git clone …` then the single documented command starts dependencies, runs migrations, and starts the app
- [ ] App loads at `http://localhost:3000`
- [ ] `GET /api/health` reports real DB connectivity (and Redis if present)
- [ ] Reset command returns the environment to clean state
- [ ] CI runs lint/typecheck/test/build (and ideally a DB smoke test) on every PR

---

## Non-goals for Step 0

Explicitly excluded:

- No real auth (only placeholders and the future shape)
- No user model
- No business entities
- No admin UI
- No background workers beyond optional Redis being present
- No deployment tooling beyond a stub doc and Docker baseline
