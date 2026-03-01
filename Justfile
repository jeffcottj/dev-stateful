set dotenv-load

# Start dependencies, run migrations, start dev server
dev:
  docker compose -f infra/docker/compose.yml up -d
  pnpm --filter @repo/db run db:migrate
  pnpm --filter @repo/web dev

# Stop services and remove volumes (clean slate)
reset:
  docker compose -f infra/docker/compose.yml down -v

# Run all quality gates
test:
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
