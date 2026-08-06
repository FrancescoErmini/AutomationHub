# Codex Working Agreement

## Purpose and architecture

This repository is a monorepo with a React/TypeScript frontend, a FastAPI/Python backend, and PostgreSQL 17. HTTP routes are thin adapters. Business rules belong in `backend/app/services`, persistence belongs in `backend/app/repositories`, and shared concerns belong in `backend/app/core`. The frontend accesses server state through TanStack Query. Alembic exclusively owns database schema evolution.

## Directory conventions

- `backend/app/api`: versioned routers and HTTP translation only.
- `backend/app/models`: SQLAlchemy persistence models.
- `backend/app/schemas`: Pydantic request/response contracts.
- `backend/app/services`: business behavior independent of HTTP.
- `backend/app/repositories`: database queries and transactions.
- `backend/app/ingestion`: source readers, validation, reporting, ingestion orchestration.
- `frontend/src/api`: typed API clients.
- `frontend/src/components`: reusable presentation components.
- `frontend/src/pages`: route-level UI.
- `data/raw`: immutable source data; never overwrite an input.
- `data/processed`: reproducible derived outputs.
- `data/fixtures`: small, safe, committed fixtures only.
- `artifacts/data-quality`: generated reports; report contents are ignored.

## Coding conventions

- Use Python 3.12 typing and keep mypy strict. Prefer small explicit functions and dependency injection.
- Keep API routes free of business and persistence logic.
- Use Pydantic at boundaries and SQLAlchemy 2 typed mappings for persistence.
- Use structured logging; do not use `print` in server code. CLI output may use `print`.
- Keep TypeScript strict. Use accessible semantic HTML and expose asynchronous loading, error, and empty states.
- Add dependencies only when used. Pin direct dependencies and update lockfiles in the same change.
- Do not add placeholders, commented-out code, dead code, or TODO markers.

## Database migration policy

All schema changes require an Alembic migration. Start PostgreSQL with `make db-up`, change the model, run `make migration NAME="clear description"`, inspect the generated file, then run `make migrate`. Never use `create_all`, manual DDL, or mutate an existing migration that may have been applied elsewhere.

Integration tests must target only `automation_hub_test`. Never point tests at `automation_hub` or an externally managed database.

## Allowed project commands

Prefer the Makefile interface: `make setup`, `make up`, `make down`, `make dev`, `make logs`, `make db-up`, `make migrate`, `make migration NAME=...`, `make seed`, `make ingest`, `make lint`, `make format`, `make typecheck`, `make test-unit`, `make test-integration`, `make test-e2e`, `make test-all`, and `make health`.

`make db-reset` and `docker compose down -v` destroy local PostgreSQL data. Use them only when the task clearly permits discarding local data. Preserve unfamiliar and user-owned files, especially source data.

## Testing workflow

Match tests to the changed layer:

- Service, validation, or pure backend behavior: backend unit tests.
- Repository, migration, or API persistence behavior: integration tests.
- React component behavior: Vitest and Testing Library.
- User-visible cross-component workflows: Playwright.
- Ingestion contracts: data-quality tests plus integration tests when persistence changes.

Before considering any task completed, execute the relevant automated tests.

If the change affects multiple components, execute:

```bash
make test-all
```

## Definition of done

A change is complete only when implementation, tests, migrations where needed, and user-facing documentation agree; lint and strict type checking pass; relevant automated tests pass; containers remain healthy; no secret or generated artifact is committed; and the working tree contains no accidental changes.

