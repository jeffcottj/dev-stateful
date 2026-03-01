# dev-stateful

A generic, clone-and-run template for stateful web applications. Proves DB and Redis connectivity out of the box with real migrations and enforced quality gates. Zero domain logic — extend it into whatever you're building.

## Quickstart

```bash
git clone <repo-url>
cd dev-stateful
cp .env.example .env
just dev
```

That single command:

1. Starts Docker services (Postgres, Redis, Mailpit)
2. Runs database migrations
3. Starts the Next.js dev server at `http://localhost:3000`

The health endpoint at `/api/health` confirms live DB and Redis connectivity.

## Quality gates

```bash
just test
```

Runs: lint → typecheck → unit tests → build. All must pass.

## Reset to clean state

```bash
just reset
```

Stops services and removes volumes. Re-run `just dev` for a fresh start.

## Project decisions

| Concern            | Choice                        |
| ------------------ | ----------------------------- |
| Language           | TypeScript                    |
| Framework          | Next.js 15 (App Router)       |
| Runtime            | Node.js v24 LTS               |
| Package manager    | pnpm (monorepo workspace)     |
| Dev command runner | just                          |
| Database           | PostgreSQL 16                 |
| DB driver          | postgres.js                   |
| Migrations         | Drizzle ORM + drizzle-kit     |
| Cache              | Redis 7                       |
| Redis client       | @redis/client (node-redis v4) |
| Mail sink          | Mailpit                       |
| Test runner        | Vitest                        |
| Linter             | ESLint v9 (flat config)       |
| Formatter          | Prettier                      |
| Pre-commit hooks   | Lefthook                      |
| Dep automation     | Dependabot                    |

## Structure

```
apps/web/          — Next.js app (App Router)
packages/config/   — Env parsing + Zod validation (single source of truth)
packages/db/       — Drizzle client, schema, and migrations
infra/docker/      — Docker Compose for local dev dependencies
.github/workflows/ — CI pipeline
docs/              — Step docs and ops notes
```

## Environment variables

Copy `.env.example` to `.env` and edit as needed. All variables are validated at startup by `packages/config` — missing or invalid vars produce a clear error listing what's wrong.

## CI

Every pull request runs lint, typecheck, unit tests, build, and a smoke test that starts the app against a live Postgres + Redis and verifies `/api/health` returns `{ status: "ok" }`.
