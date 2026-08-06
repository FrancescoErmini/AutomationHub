# Architecture decisions

The initial system is a modular monolith. This minimizes operational overhead while preserving boundaries that can be extracted only when scale or ownership makes that worthwhile.

## Request path

FastAPI validates the transport contract, injects a SQLAlchemy session-backed service, and serializes typed schemas. Services enforce application rules. Repositories own SQL queries and transaction boundaries. Central exception handlers keep errors stable across routers.

## Data path

Ingestion is validation-first: read a source, apply composable quality rules, write a machine-readable report, and only then persist valid rows through the same service used by HTTP. New Excel support can implement a reader returning the same `(columns, rows)` shape without changing validation.

## Runtime path

Compose health dependencies order PostgreSQL, migration/API startup, then the Vite UI. Development and test databases share a PostgreSQL container but not a database. Browser tests execute in the pinned upstream Playwright image, eliminating host-browser drift.

