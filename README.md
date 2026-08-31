# Automation Hub

Automation Hub is a production-oriented monorepo foundation for a React application, a FastAPI service, and PostgreSQL persistence. Local infrastructure is containerized; only Python, Node.js, npm, Make, and Docker are required on the host.

## Quick start

```bash
cp .env.example .env
make setup
make up
make health
```

Open <http://localhost:5173>. The API documentation is at <http://localhost:8000/docs>.

`make setup` installs pinned host-side development dependencies, starts PostgreSQL, and applies Alembic migrations. `make up` builds and starts the API and UI containers.

## Architecture

The browser sends `/api` requests through the Vite development proxy. FastAPI routes validate HTTP input and delegate to services; services hold application rules and use repositories for SQLAlchemy persistence. PostgreSQL is the only stateful service. Alembic owns all schema changes.

```text
React + TanStack Query -> FastAPI router -> service -> repository -> SQLAlchemy -> PostgreSQL
```

## Repository layout

```text
.
├── backend/                  FastAPI app and Alembic
│   ├── alembic/versions/     Immutable schema migrations
│   └── app/                  API, core, db, models, schemas, services, repositories
├── frontend/                 React/Vite app
├── docker/                   Container initialization assets
├── docs/                     Architecture notes
├── docker-compose.yml
└── Makefile
```

## Development workflow

Run `make help` for the complete command list. Common commands are:

```bash
make dev                 # build and run all services in the foreground
make logs                # follow service logs
make lint                # Ruff, ESLint, and Prettier checks
make typecheck           # strict mypy and TypeScript checks
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

Review every generated migration before committing it. Never call `Base.metadata.create_all`, issue ad hoc DDL, or edit an already-shared migration. `make db-reset` destroys the local Docker volume, recreates both databases, and migrates; use it only when local data can be discarded.

Reference and business data in the `core` schema is maintained through the sqladmin panel at <http://localhost:8000/admin> and the ideas API — there is no bulk import step.

## API

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/status
```

Structured errors use a stable JSON shape. Validation failures use FastAPI's HTTP 422 response.

## Testing

This project has no automated test suite. Testing is performed manually.

After a change, run `make lint` and `make typecheck`, bring up the stack with `make dev`, and exercise the affected flows by hand (API endpoints and the relevant frontend pages).

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

