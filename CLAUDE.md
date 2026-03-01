# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A stateful web application template being built incrementally. Step 0 (baseline setup) is implemented. Implementation follows the step docs in `docs/`.

## Locked-In Decisions

- **Language:** TypeScript (app + tooling)
- **Framework:** Next.js (App Router)
- **Runtime:** Node.js v24 LTS (pin via `.nvmrc` and/or `.tool-versions`)
- **Package manager:** pnpm (enforce via `packageManager` field in `package.json`)
- **Database:** PostgreSQL
- **Cache/queue:** Redis (present even if unused)
- **Dev dependencies:** Docker Compose (Postgres + Redis at minimum)

## Target Monorepo Structure

```
apps/web/          # Next.js app
packages/config/   # Env parsing + Zod validation (single source of truth for env vars)
packages/db/       # DB client/adapter + migrations
infra/docker/      # Compose files and Dockerfiles
.github/workflows/ # CI
docs/              # Step docs and ops notes
```

No domain-specific models or business entities belong in the template layer.

## Commands

| Task                                | Command                                 |
| ----------------------------------- | --------------------------------------- |
| Start dev (deps + migrations + app) | `just dev`                              |
| Reset to clean state                | `just reset`                            |
| Run all quality gates               | `just test`                             |
| Lint                                | `pnpm lint`                             |
| Typecheck                           | `pnpm typecheck`                        |
| Unit tests                          | `pnpm test`                             |
| Build                               | `pnpm build`                            |
| Run migrations only                 | `pnpm --filter @repo/db run db:migrate` |

The golden-path order is non-negotiable: bring up compose → run migrations → start Next.js dev server. `just dev` handles this automatically. Requires a `.env` file at repo root (copy from `.env.example`).

## Architecture Constraints

**Env vars:** All `process.env.*` access must go through `packages/config`. Never scatter raw env reads across the app. Missing/invalid vars must produce a clear startup error.

**Migrations:** Managed in `packages/db`. Must run automatically as part of the dev bootstrap command. The initial migration creates `app_meta(key, value, updated_at)` and seeds `('template_status', 'ok')`.

**Health endpoint:** `GET /api/health` performs a real DB query (reads `template_status` from `app_meta`) and returns connectivity status for DB and Redis with latency.

**CI:** GitHub Actions runs lint → typecheck → test → build on every PR. CI also starts a Postgres service container, runs migrations, and hits `/api/health`.

## Step Docs

Implementation decisions, acceptance criteria, and checklists for each phase live in `docs/`. Read the relevant step doc before implementing a phase. Step 0 (`docs/step-0.md`) must be fully complete before moving on.
