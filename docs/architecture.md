# Architecture decisions

The initial system is a modular monolith. This minimizes operational overhead while preserving boundaries that can be extracted only when scale or ownership makes that worthwhile.

## Request path

FastAPI validates the transport contract, injects a SQLAlchemy session-backed service, and serializes typed schemas. Services enforce application rules. Repositories own SQL queries and transaction boundaries. Central exception handlers keep errors stable across routers.

## Data path

`core` tables are the single source of truth. They were originally bootstrapped
from source workbooks by a one-time Excel/CSV ingestion pipeline; that pipeline
was removed in the 2026-08-31 cleanup, and its leftover `staging` / `audit`
schemas (plus `core.value_normalization` and the unused `analytics.ticket_enriched`
view) were dropped by migration `20260901_0018`. Reference data is now maintained
through the sqladmin panel, and application data flows in through the ideas API.

## Runtime path

Compose health dependencies order PostgreSQL, migration/API startup, then the Vite UI. Development and test databases share a PostgreSQL container but not a database. Browser tests execute in the pinned upstream Playwright image, eliminating host-browser drift.

