
Backend (backend/app/)
- models/core.py: ApqcCategory, ApqcProcessGroup, ApqcProcess (L1→L2→L3 taxonomy), and Idea (all wizard inputs + computed outputs), all with explicit relationship()s for sqladmin FK selects
- Two Alembic migrations (taxonomy tables, idea table + seeded idea_roi_threshold_eur=50000 reference variable) — applied cleanly
- ingestion/apqc_loader.py: idempotent upsert-by-PCF-ID loader, wired to make ingest-apqc / python -m app.cli ingest-apqc — verified: categories=13, process_groups=76, processes=353, identical on rerun
- services/idea_scoring.py: pure ROI/Feasibility/Technolper the spec's formulas
- Repository, service, and /apqc/* + /ideas API routes, all wired into dependencies.py/router.py
- Tests: 7 new unit tests + 8 new integration tests, 103lint/typecheck clean

Frontend (frontend/src/)
- 8-step wizard (IdeaWizardPage + components/wizard/*) with cascading L1→L2→L3 dropdowns, per-step required-field gating, back-navigation
  without data loss, and a live score preview (lib/ideaS backend formulas, unit-tested against the same numbers)
- /ideas pipeline page (cards) and /ideas/:id read-only detail view
- Tests: 5 new scoring unit tests + 3 new wizard compones pass; new Playwright e2e test walks all 8 steps in areal browser and passes alongside the 3 pre-existing e2e specs (4/4)
- ESLint/Prettier/tsc all clean
