# Automation Hub

Automation Hub is a production-oriented monorepo foundation for a React application, a FastAPI service, PostgreSQL persistence, and reusable CSV ingestion. Local infrastructure is containerized; only Python, Node.js, npm, Make, and Docker are required on the host.

## Quick start

```bash
cp .env.example .env
make setup
make up
make health
```

Open <http://localhost:5173>. The API documentation is at <http://localhost:8000/docs>.

`make setup` installs pinned host-side development dependencies, starts PostgreSQL, applies Alembic migrations, and loads an idempotent seed record. `make up` builds and starts the API and UI containers.

## Architecture

The browser sends `/api` requests through the Vite development proxy. FastAPI routes validate HTTP input and delegate to services; services hold application rules and use repositories for SQLAlchemy persistence. PostgreSQL is the only stateful service. Alembic owns all schema changes.

```text
React + TanStack Query -> FastAPI router -> service -> repository -> SQLAlchemy -> PostgreSQL
CSV CLI -> validation + quality report -> service -> repository -> PostgreSQL
```

The ingestion path is deliberately generic. `DatasetValidator` composes required-column, uniqueness, null, allowed-value, type, and row-count rules. JSON reports are generated under `artifacts/data-quality/` before any row is persisted.

## Repository layout

```text
.
├── backend/                  FastAPI app, Alembic, ingestion, Python tests
│   ├── alembic/versions/     Immutable schema migrations
│   └── app/                  API, core, db, models, schemas, services, repositories
├── frontend/                 React/Vite app, Vitest, Playwright
├── data/
│   ├── raw/                  Original source inputs (never mutate in place)
│   ├── processed/            Generated normalized datasets
│   └── fixtures/             Small committed test/demo inputs
├── tests/                    Cross-component and data-quality tests
├── artifacts/data-quality/   Generated validation reports
├── docker/                   Container initialization assets
├── docs/                     Architecture notes
├── scripts/                  Project automation helpers
├── docker-compose.yml
└── Makefile
```

Existing business files in `data/` are intentionally untouched. Future source files should move into `data/raw/` when their consumers are defined.

## Development workflow

Run `make help` for the complete command list. Common commands are:

```bash
make dev                 # build and run all services in the foreground
make logs                # follow service logs
make lint                # Ruff, ESLint, and Prettier checks
make typecheck           # strict mypy and TypeScript checks
make test-unit           # backend, data-quality, and frontend unit tests
make test-integration    # isolated automation_hub_test database
make test-e2e            # Playwright in a pinned browser container
make test-all            # complete definition-of-done quality gate
make down
```

The host commands use `.venv` and `frontend/node_modules`; runtime services use Docker images. This keeps feedback fast without requiring a host PostgreSQL installation.

## Database and migrations

PostgreSQL 17 runs in Docker and exposes port `5432` by default. Change mapped ports in `.env` if they conflict locally. Development uses `automation_hub`; integration tests exclusively use `automation_hub_test`. The PostgreSQL initialization script creates both databases when the volume is first created.

Create and apply a migration after changing SQLAlchemy models:

```bash
make db-up
make migration NAME="add item category"
make migrate
```

Review every generated migration before committing it. Never call `Base.metadata.create_all`, issue ad hoc DDL, or edit an already-shared migration. `make db-reset` destroys the local Docker volume, recreates both databases, migrates, and seeds; use it only when local data can be discarded.

## API

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/status
curl http://localhost:8000/api/v1/items
curl -X POST http://localhost:8000/api/v1/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"My item","description":"Created through the API"}'
```

Duplicate names return HTTP 409 with a stable structured error. Validation failures use FastAPI's HTTP 422 response.

## Data ingestion and quality

The included CSV demonstrates the expected extension point:

```bash
make ingest
cat artifacts/data-quality/items-report.json
```

Validation completes and writes a summary before persistence. Duplicate database records are skipped to make repeated ingestion safe. Add business-specific schemas as separate ingestion modules; keep the shared rule engine generic and cover new rules under `tests/data_quality/`.

## Testing

- Backend unit tests mock repositories and exercise service/validation behavior.
- Integration tests run against the migrated `automation_hub_test` database and refuse to use any other database name.
- Frontend tests use Vitest, Testing Library, and mocked network responses.
- End-to-end tests use the official pinned Playwright image against the live Compose stack.

Run `make test-all` whenever a change crosses component boundaries. The target runs static checks, unit tests, isolated database integration tests, starts the application, and executes the browser workflow.

## Docker operations

`make up` builds local images and waits through Compose health checks. Backend startup applies Alembic before serving traffic. The backend only starts after PostgreSQL is healthy; the frontend only starts after the API is healthy. Volumes preserve database and frontend dependency state between runs.

To inspect state:

```bash
docker compose ps
make health
make logs
```

## Troubleshooting

- **Port already allocated:** change `POSTGRES_PORT`, `BACKEND_PORT`, or `FRONTEND_PORT` in `.env`, then run `make down && make up`.
- **Stale local database:** if the data is disposable, run `make db-reset`. This removes the Compose volume.
- **Test database missing:** an old volume may predate the initialization SQL. Run `make db-reset`, or create the dedicated database manually inside the development container.
- **Dependency mismatch:** run `make install`; `npm ci` restores the exact lockfile and pip installs exact direct dependency versions.
- **Container health failure:** run `docker compose ps` and `docker compose logs postgres backend frontend`.
- **WSL filesystem performance:** clone under the Linux filesystem for faster bind mounts when possible; the project remains compatible with `/mnt/c` workspaces.

## Security and configuration

`.env.example` contains development-only credentials. `.env` is ignored. Do not reuse these credentials outside local development. No application secrets are committed, and production deployment configuration is intentionally outside this local foundation.

