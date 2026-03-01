set dotenv-load

# Start dependencies, run migrations, start dev server
dev:
  docker compose -f infra/docker/compose.yml -f infra/docker/compose.override.yml up -d
  pnpm --filter @repo/db run db:migrate
  pnpm --filter @repo/web dev

# Stop services and remove volumes (clean slate)
reset:
  docker compose -f infra/docker/compose.yml -f infra/docker/compose.override.yml down -v

# Run all quality gates
test:
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build

# Build the production Docker image
build-image:
  docker build -t app -f apps/web/Dockerfile .
