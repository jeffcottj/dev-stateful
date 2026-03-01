# Contributing

## Prerequisites

- [just](https://just.systems) — command runner
- [Docker](https://www.docker.com) — for Postgres, Redis, and Mailpit
- [Node.js v24 LTS](https://nodejs.org) — use `.nvmrc` with nvm: `nvm use`
- [pnpm](https://pnpm.io) — install via `corepack enable && corepack prepare`

## Quickstart

```bash
git clone <repo-url>
cd dev-stateful

# Copy env file and fill in any values you need
cp .env.example .env

# Start everything (Docker deps → migrations → dev server)
just dev
```

The app will be at `http://localhost:3000`. The health endpoint is at `/api/health`.

## Running quality gates

```bash
just test
```

This runs, in order: lint → typecheck → unit tests → build.

You can also run individual gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Reset to a clean state

```bash
just reset
```

Stops all Docker services and removes volumes. Re-running `just dev` will re-apply migrations from scratch.

## Project structure

```
apps/web/        — Next.js app (App Router)
packages/config/ — Env var parsing and Zod validation
packages/db/     — Drizzle ORM client, schema, and migrations
infra/docker/    — Docker Compose for local dependencies
docs/            — Step docs and architecture notes
```

## Making changes

1. Fork the repo and create a feature branch.
2. Make your changes, keeping the zero-domain-logic constraint in mind (no business entities in the template layer).
3. Run `just test` and ensure all gates pass.
4. Open a pull request. CI will enforce lint, typecheck, tests, build, and a DB smoke test.

## Adding migrations

Put new SQL files in `packages/db/migrations/` and update `packages/db/migrations/meta/_journal.json`.
Run `just dev` (or `pnpm --filter @repo/db run db:migrate`) to apply.
