# Automation Hub for Blue Prism Enterprise

A self-hosted portal to run an RPA program built on **Blue Prism Enterprise**: collect and score automation ideas, publish a catalog of automated processes, and track the cost, savings and service quality of what is running in production.

It is inspired by [UiPath Automation Hub](https://www.uipath.com/product/automation-hub) (idea pipeline, assessment, catalog, ROI tracking), adapted to the vocabulary and the cost model of a Blue Prism estate: Digital Workers, Runtime Resources, licences, AMS (application maintenance) support levels.

> **Scope note.** The Hub does not call Blue Prism APIs. Blue Prism remains the execution platform; the Hub is the governance and reporting layer next to it. Data enters through the UI, CSV imports, or the admin panel.

## Contents

- [What it does](#what-it-does)
- [How it maps to UiPath Automation Hub](#how-it-maps-to-uipath-automation-hub)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [Database and migrations](#database-and-migrations)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)

## What it does

| Area | Page | Purpose |
| --- | --- | --- |
| **Idea pipeline** | `/ideas`, `/ideas/new`, `/ideas/:id` | Seven-step assessment wizard. Maps the idea to the APQC process taxonomy (L1 → L2 → L3), collects volumetry, complexity, systems and AI-readiness, and computes ROI, feasibility, technology category and final classification on the server. Ideas are shown on a feasibility matrix and a classification chart. |
| **Catalog** | `/catalog` | Every automated process in production and every process still in the pipeline, grouped by department, with documentation links and stakeholders. |
| **Executive dashboard** | `/executive` | Program economics: KPIs, company summary, cost breakdown, TCO trend, savings vs. payback, TCO & ROI, per-process ROI table. |
| **Operations dashboard** | `/simple-ops` | Running cost and licence cost trends, infrastructure (virtual machines hosting Runtime Resources), occupancy heatmap, AMS trend, cost by process, quality breakdown. |
| **SLA / KPI** | `/sla-kpi` | SLA attainment and commitments, L1/L2 support trend, root-cause Pareto, backlog aging, resolution and data-quality indicators. |
| **Data management** (signed-in editors) | `/processes`, `/tickets`, `/years`, `/process-economics`, `/orders` | Maintain the process register, incident/request tickets (inline edit and CSV import), AMS contract years, per-process business case (CAPEX, ROI horizon, FTE hours saved) and TCO cost items (single entry or CSV import). |
| **Documentation** | `/documentation` | Data dictionary: where every dashboard figure comes from. |
| **Admin panel** | `/admin` (backend) | SQLAdmin back-office for reference data (companies, departments, priorities, root causes, …). |

### Roles

Access uses OpenID Connect (Keycloak). Dashboards and the catalog are readable anonymously; submitting ideas and the data-management pages require sign-in. Every user starts as `user`; `editor` and `admin` are assigned by an administrator. Addresses listed in `BOOTSTRAP_ADMIN_EMAILS` are promoted to `admin` on first login.

## How it maps to UiPath Automation Hub

| UiPath Automation Hub | This portal (Blue Prism context) |
| --- | --- |
| Idea submission and assessment | Assessment wizard with server-side ROI, feasibility and classification scoring |
| Automation pipeline / stages | Ideas list with classification lanes and feasibility matrix |
| Automation catalog | Process catalog by department, with type (process framework category), documentation URL and stakeholders |
| Realized value / ROI tracking | Process economics and TCO costs (CAPEX/OPEX), savings vs. payback, per-process ROI |
| Automation Ops / Orchestrator insights | Operations dashboard: Blue Prism licence cost, Runtime Resource VMs, occupancy heatmap |
| Collaboration and roles | Keycloak SSO with `user` / `editor` / `admin` roles and per-process stakeholder referents |
| (not in Hub) | AMS support model: tickets, SLA commitments, L1/L2 split, root-cause analysis |

## Architecture

```text
React + TanStack Query → FastAPI router → service → repository → SQLAlchemy → PostgreSQL
```

- **Frontend**: React 18, TypeScript (strict), Vite, Tailwind, Recharts, `react-oidc-context`.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2 (typed mappings), Pydantic, SQLAdmin, PyJWT for token verification. Routes are thin; business rules live in `app/services`, queries in `app/repositories`.
- **Database**: PostgreSQL 16. Alembic exclusively owns the schema.
- **Runtime**: Docker Compose for local development.

```text
.
├── backend/                  FastAPI app and Alembic migrations
│   ├── alembic/versions/     Immutable schema migrations
│   ├── app/                  api, core, db, models, schemas, services, repositories
│   └── scripts/              One-off CSV importers
├── frontend/                 React/Vite app
├── docs/                     Architecture notes
├── docker/                   PostgreSQL initialization
├── docker-compose.yml
└── Makefile
```

## Installation

### Prerequisites

Docker (with Compose v2), Make, Python 3.12, Node.js 20+ and npm. The Makefile uses POSIX paths (`.venv/bin/...`): on Windows run it from **WSL** or Git Bash.

### Quick start

```bash
git clone <this repository>
cd automation-hub
cp .env.example .env      # edit as needed, see Configuration
make setup                # installs host tooling, starts PostgreSQL, applies migrations
make up                   # builds and starts API and UI
make health
```

Then open:

- UI: <http://localhost:5173>
- API docs: <http://localhost:8000/docs>
- Admin panel: <http://localhost:8000/admin>

`make down` stops the stack. The database starts empty; see [Usage](#usage) for loading data.

## Configuration

All settings are environment variables, read from `.env` (copy of [`.env.example`](.env.example)).

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | `automation_hub` / `automation_hub` / `automation_hub_dev` / `5432` | Local PostgreSQL. Development defaults only. |
| `BACKEND_PORT`, `FRONTEND_PORT` | `8000`, `5173` | Published ports. |
| `ENVIRONMENT` | `development` | Any other value makes the backend reject the default admin password and secret key. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SECRET_KEY` | `admin`, `admin`, insecure placeholder | Protect `/admin`. **Always override outside your laptop.** |
| `NPM_STRICT_SSL` | `true` | Build arg for the frontend image; `false` only behind TLS-intercepting proxies. |
| `OIDC_ISSUER` | `https://keycloak.example.com/auth/realms/your-realm` | Keycloak realm URL (token issuer, JWKS source). |
| `OIDC_CLIENT_ID` | `automation-hub` | Public client registered in Keycloak. |
| `BOOTSTRAP_ADMIN_EMAILS` | empty | Comma-separated emails promoted to `admin` on first login. |
| `LOG_LEVEL` | `INFO` | Structured log level. |

Frontend variables ([`frontend/.env.example`](frontend/.env.example)): `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, optional `VITE_OIDC_REDIRECT_URI` (default `<origin>/auth/callback`).

### Keycloak client

Create a public client with the standard flow and PKCE, redirect URI `http://localhost:5173/auth/callback`, and web origin `http://localhost:5173`. Point `OIDC_ISSUER` and `VITE_OIDC_AUTHORITY` at your realm. Without a reachable Keycloak the read-only pages still work, but sign-in does not.

## Usage

1. **Sign in** with your Keycloak account. The first administrator comes from `BOOTSTRAP_ADMIN_EMAILS`; they can then promote others to `editor`.
2. **Load reference data** from the admin panel (`/admin`, credentials from `.env`): companies, departments, priorities, support levels, root causes. The APQC taxonomy tables are used by the idea wizard.
3. **Register your Blue Prism processes** in *Processes*: company, department, AMS year, process type, documentation URL. Add stakeholder referents (ICT, business owner, supplier) per process.
4. **Add costs and benefits**: *Process Economics* for the per-process business case, *Orders (TCO)* for CAPEX/OPEX items (single entry or CSV import).
5. **Track operations**: import or create tickets in *Tickets* (CSV import supported) so the SLA / KPI and Operations dashboards have data.
6. **Collect ideas**: business users open *Submit new idea*, walk through the wizard and get an automatic score and classification. Browse results in *Ideas*.
7. **Report**: the *Executive*, *Operations* and *SLA / KPI* dashboards update as data changes. Use the *Documentation* page to explain each figure to stakeholders.

### API

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/status
curl http://localhost:8000/api/v1/process-catalog
```

Interactive OpenAPI documentation is at `/docs`. Write endpoints require a bearer token issued by the configured Keycloak realm.

### Importing stakeholders

`backend/scripts/import_stakeholders.py` loads process stakeholders from a CSV placed at `data/rpa-pipeline-stakeholders.csv` (not shipped; the folder is git-ignored). See the script header for the expected columns and the `docker cp` invocation.

## Development

```bash
make dev          # run all services in the foreground
make logs         # follow logs
make lint         # Ruff, ESLint, Prettier
make format
make typecheck    # strict mypy and tsc
make help         # full list
```

The project has no automated test suite; verify changes by running `make lint`, `make typecheck`, `make dev` and exercising the affected flows by hand. Contributor conventions are in [`AGENTS.md`](AGENTS.md).

## Database and migrations

```bash
make db-up
# change a SQLAlchemy model, then:
make migration NAME="clear description"
make migrate
```

Review each generated migration. Never use `create_all`, manual DDL, or edit a migration that may already be applied elsewhere. `make db-reset` deletes the local PostgreSQL volume and all its data.

## Troubleshooting

- **Port already allocated**: change `POSTGRES_PORT`, `BACKEND_PORT` or `FRONTEND_PORT` in `.env`, then `make down && make up`.
- **`npm ci` fails with certificate errors behind a TLS-intercepting proxy**: set `NPM_STRICT_SSL=false` in `.env` and rebuild (`make up`).
- **Dependency mismatch**: `make install`.
- **Container unhealthy**: `docker compose ps` and `docker compose logs postgres backend frontend`.
- **Sign-in loop or 401**: check that `OIDC_ISSUER`, `OIDC_CLIENT_ID` and the Keycloak redirect URI agree between backend, frontend and realm.

## Security notes

- `.env` and `.env.*` are git-ignored; only `.env.example` is tracked. The credentials in it are local-development placeholders.
- Set strong `ADMIN_PASSWORD` and `ADMIN_SECRET_KEY` for any shared deployment.
- Outside `ENVIRONMENT=development` the backend refuses to start with the default admin password or secret key. For Kubernetes, use a secret manager (External Secrets, Sealed Secrets) rather than committing Secret manifests.
- Do not commit real tickets, employee names or emails; the `sql/` and `data/` folders are git-ignored for that reason.
