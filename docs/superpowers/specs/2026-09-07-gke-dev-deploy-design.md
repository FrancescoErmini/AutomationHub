# GKE dev deployment — design

**Date:** 2026-09-07
**Status:** Approved, pending implementation plan
**Goal:** Produce everything the DevOps team needs to run Automation Hub in the
`dev` environment on GKE — production container images, Kubernetes manifests
(kustomize), a GitLab CI pipeline, and an Argo CD Application — moving off the
local `docker-compose` setup with the minimum necessary change.

## Context

Target platform (owned by DevOps, fixed):

- GitLab (`mcdgit.menarini.net`), GitLab CI with shared templates from
  `ci_cd_ict_sdlc/pipelines_sot` (`GENERIC/cicd-generic-templates.yaml`).
- Google Artifact Registry: `europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/...`.
- Argo CD with kustomize; GKE cluster; managed PostgreSQL **15**, reached
  **directly over its private IP** `172.23.201.26:5432`. Database
  `automation-hub`, user `automationhub` — already provisioned.
- Keycloak stays as-is: realm `menarini`, client `mg-app_AutomationHub`,
  issuer `https://keycloak-dev.menarini.net/auth/realms/menarini`.

Current local setup:

- `docker-compose.yml`: `postgres:16-alpine`, `backend` (uvicorn `--reload`,
  source bind-mounted, container command runs `alembic upgrade head` then
  uvicorn), `frontend` (Vite dev server, source bind-mounted, dev-proxies
  `/api` and `/health` to the backend).
- Backend: FastAPI, pydantic-settings `Settings` (all config from env vars),
  SQLAlchemy + psycopg, Alembic. SQLAdmin panel at `/admin` (own
  username/password + `ADMIN_SECRET_KEY`, session cookie). OIDC access-token
  verification against the realm JWKS. `GET /health` returns `{"status":"ok"}`.
- Frontend: React + Vite. Talks to the API over **relative** paths
  (`/api/v1/...`, `/health`). OIDC config read from `import.meta.env.VITE_*`
  (**baked at build time**). `/auth/callback` is a client-side route.
- Database schema is fully owned by Alembic — a clean linear chain
  `20241229_0001 → 20260904_0022`. A fresh `alembic upgrade head` builds the
  entire current schema. Reference and business data are **not** in the repo;
  they are entered through SQLAdmin.
- No automated tests. No CI. No Kubernetes manifests.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Manifest location | In this repo, `deploy/` (kustomize base + `overlays/dev`) |
| 2 | Cloud SQL connectivity | **Direct private-IP connection** to `172.23.201.26:5432` (no proxy, no Workload Identity). Reachability pods → that IP is a DevOps VPC/firewall task. |
| 3 | Frontend env config | **Build-time** `--build-arg`, values from GitLab CI/CD variables; one `dev` image |
| 8 | Secret delivery | Real `Secret` manifest **committed in plaintext** to the repo (private GitLab, dev only). User-directed; `ExternalSecret` recommended for prod. Rotate the DB password after go-live. |
| 4 | Ingress | **Single host, path split**: `/` → frontend, `/api` `/health` `/admin` `/docs` `/openapi.json` → backend. No CORS. |
| 5 | Environments | `dev` only for now; base is written so more overlays can be added later |
| 6 | Deploy trigger | Pipeline runs on `master` |
| 7 | Dev host | `automation-hub-dev.menarini.net` (`https://automation-hub-dev.menarini.net/`) |

## Scope

### In scope

1. `backend/Dockerfile` — production rewrite.
2. `frontend/Dockerfile` + `frontend/nginx.conf` — production rewrite.
3. `.dockerignore` updates for both.
4. `deploy/` kustomize tree (base + `overlays/dev`).
5. `deploy/argocd/automation-hub-dev.yaml` — Argo CD Application.
6. `.gitlab-ci.yml`.
7. `docs/deploy.md` — DevOps handover checklist.
8. `GET /health/ready` doing `SELECT 1` for the readiness probe; liveness
   stays on `/health`. (~6 lines in `main.py`.)

### Out of scope

- Secret management tooling (External Secrets / Sealed Secrets / GSM wiring) —
  the dev `Secret` is committed in plaintext per user direction; the
  `ExternalSecret` path is documented as the prod recommendation only.
- staging / prod overlays.
- Autoscaling (HPA), PodDisruptionBudget, NetworkPolicy — noted as follow-ups,
  not built.
- The one-time production data load into the dev database (DevOps task,
  documented).
- Any change to Keycloak (client redirect URIs etc. are a DevOps/IAM task,
  documented).
- Automated tests / test stage beyond lint + image scan.

## Design

### 1. `backend/Dockerfile`

Single stage on `python:3.12-slim`. `pip install .` (no compilation —
`psycopg[binary]`). Create and switch to a non-root `appuser`. Copy only
`pyproject.toml`, `app/`, `alembic.ini`, `alembic/`. No source mount, no
`--reload`.

```
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000",
     "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
```

`--proxy-headers` / `--forwarded-allow-ips=*` make `request.url.scheme` honour
the Ingress `X-Forwarded-Proto`, so SQLAdmin session cookies and OIDC redirect
URIs are built as `https`. No application code change.

The image is reused verbatim by the migration Job.

`.dockerignore` adds: `.git`, `.venv`, `.env`, `.env.*`, `*.md`, `alembic/versions/__pycache__`.

### 2. `frontend/Dockerfile` + `nginx.conf`

**Stage 1 — build** (`node:20-bookworm-slim`):

- Copy `package.json`, `package-lock.json`, `.npmrc` (keeps the Umbrella
  `strict-ssl=false` workaround), `npm ci`.
- Copy the rest of the source.
- `ARG VITE_OIDC_AUTHORITY`, `ARG VITE_OIDC_CLIENT_ID`,
  `ARG VITE_OIDC_REDIRECT_URI`. Write them into `.env.production` before the
  build so Vite picks them up deterministically regardless of how Vite reads
  shell env.
- `npm run build` → `/app/dist`.

**Stage 2 — serve** (`nginxinc/nginx-unprivileged:1.27-alpine`):

- Copy `dist/` to `/usr/share/nginx/html`.
- Copy `nginx.conf` to `/etc/nginx/conf.d/default.conf`.
- Listens on `:8080` (unprivileged).

`nginx.conf`:

- `location / { try_files $uri /index.html; }` — SPA fallback, covers
  `/auth/callback`.
- `location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }`
- `index.html` served with `Cache-Control: no-cache`.
- gzip on for text types.
- **No `/api` proxy** — the Ingress routes `/api` straight to the backend
  Service.

`.dockerignore` adds: `.git`, `.env`, `.env.*`, `*.md`.

No frontend application code change: the build args map onto the existing
`import.meta.env.VITE_*` reads in `src/auth/oidcConfig.ts`.

### 3. `deploy/` kustomize tree

```
deploy/
  base/
    kustomization.yaml
    namespace.yaml
    serviceaccount.yaml
    configmap.yaml
    backend-deployment.yaml
    backend-service.yaml
    backend-backendconfig.yaml
    frontend-deployment.yaml
    frontend-service.yaml
    frontend-backendconfig.yaml
    migrate-job.yaml
    ingress.yaml
    managed-certificate.yaml
  overlays/
    dev/
      kustomization.yaml
      config-patch.yaml
      ingress-patch.yaml
      secret.yaml            # real values, committed in plaintext (dev only)
  argocd/
    automation-hub-dev.yaml
```

#### `namespace.yaml`

Base defines a `Namespace` named `automation-hub`. The overlay's
`namespace: automation-hub-dev` transformer retargets every resource —
including this `Namespace` object — so the dev namespace is
`automation-hub-dev`. Adding a `staging` overlay later needs no base change.

#### `serviceaccount.yaml`

Plain ServiceAccount `automation-hub` (no cloud annotations — the DB is a
direct private-IP connection, and no other GCP API is used). Kept so a future
need for Workload Identity has an anchor and so Deployments name a dedicated
SA rather than `default`.

#### `configmap.yaml` — `automation-hub-config`

Non-secret config, consumed by the backend via `envFrom`:

| Key | base value | dev overlay |
|-----|-----------|-------------|
| `ENVIRONMENT` | `production` | `dev` |
| `LOG_LEVEL` | `INFO` | `INFO` |
| `OIDC_ISSUER` | — | `https://keycloak-dev.menarini.net/auth/realms/menarini` |
| `OIDC_CLIENT_ID` | — | `mg-app_AutomationHub` |
| `BOOTSTRAP_ADMIN_EMAILS` | `""` | `<comma-separated>` |

Frontend OIDC values (baked at image build time, from GitLab CI/CD variables):

| Build arg | dev value |
|-----------|-----------|
| `VITE_OIDC_AUTHORITY` | `https://keycloak-dev.menarini.net/auth/realms/menarini` |
| `VITE_OIDC_CLIENT_ID` | `mg-app_AutomationHub` |
| `VITE_OIDC_REDIRECT_URI` | `https://automation-hub-dev.menarini.net/auth/callback` |

`Settings` currently has no `environment` env binding beyond its default; it
already accepts `ENVIRONMENT` via pydantic-settings' case-insensitive match on
the `environment` field. `LOG_LEVEL`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`,
`BOOTSTRAP_ADMIN_EMAILS` all map to existing fields.

#### Secret — `automation-hub-secrets`

Keys, consumed by the backend via `envFrom` (`secretRef`):

- `DATABASE_URL` =
  `postgresql+psycopg://automationhub:<password>@172.23.201.26:5432/automation-hub`
  — direct private-IP connection. If the password ever contains URL-reserved
  characters (`@ : / ? # [ ]`) they must be percent-encoded in this string;
  the current password does not.
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SECRET_KEY`

**Per user direction**, `overlays/dev/secret.yaml` is committed in plaintext
with the real values (`DATABASE_URL` with the supplied DB password; admin
username/password; a generated `ADMIN_SECRET_KEY`). This is acceptable only
because the GitLab repo is private and this is the dev environment. `docs/deploy.md`
records that:

- the DB password must be **rotated** after go-live (it will remain in git
  history);
- production must use an `ExternalSecret` / secret store, not a committed
  manifest.

No `secret.example.yaml`, no `.gitignore` entry for it.

#### `backend-deployment.yaml`

- `replicas: 2` (overlay may drop to 1 for dev).
- ServiceAccount `automation-hub`.
- **Container `app`**: backend image (tag set by overlay / CI), `envFrom` the
  ConfigMap and the Secret, port `8000`.
  - `readinessProbe`: `GET /health/ready`, `initialDelaySeconds: 5`,
    `periodSeconds: 10`.
  - `livenessProbe`: `GET /health`.
  - `resources`: requests `250m` / `256Mi`, limits `500m` / `512Mi`.
  - `securityContext`: `runAsNonRoot: true`, `runAsUser: 1000`,
    `allowPrivilegeEscalation: false`, `capabilities: { drop: [ALL] }`,
    `readOnlyRootFilesystem: true` + an `emptyDir` at `/tmp`.
- No database sidecar — the pod connects straight to `172.23.201.26:5432`.
  SQLAlchemy is already configured with `pool_pre_ping=True`
  (`app/db/session.py`), which covers dropped connections.

#### `backend-service.yaml`

`ClusterIP`, port `8000` → `8000`, `type: NodePort` is implied by the GKE
Ingress controller (GKE upgrades referenced Services to NodePort
automatically); keep `ClusterIP` in the manifest.
Annotation `cloud.google.com/backend-config: '{"default":"backend-backendconfig"}'`.

#### `backend-backendconfig.yaml`

`BackendConfig` `backend-backendconfig`: health check `requestPath: /health`,
`port: 8000`, `type: HTTP`. Timeouts left at defaults.

#### `frontend-deployment.yaml`

- `replicas: 2`.
- Single container `web`: frontend image, port `8080`.
  - `readinessProbe` / `livenessProbe`: `GET /` on `8080`.
  - `resources`: requests `50m` / `64Mi`, limits `200m` / `128Mi`.
  - `securityContext`: non-root (the `nginx-unprivileged` image runs as UID
    101), drop ALL caps, `readOnlyRootFilesystem: true` with `emptyDir`
    mounts for `/tmp` and `/var/cache/nginx`.

#### `frontend-service.yaml`

`ClusterIP`, port `8080` → `8080`. Annotation
`cloud.google.com/backend-config: '{"default":"frontend-backendconfig"}'`.

#### `frontend-backendconfig.yaml`

Health check `requestPath: /`, `port: 8080`.

#### `migrate-job.yaml`

- Annotations:
  `argocd.argoproj.io/hook: PreSync`,
  `argocd.argoproj.io/hook-delete-policy: BeforeHookCreation`.
- `backoffLimit: 3`, `activeDeadlineSeconds: 600`.
- ServiceAccount `automation-hub`.
- Container `migrate`: backend image, `command: ["alembic","upgrade","head"]`,
  `workingDir: /app`, `envFrom` the ConfigMap and Secret. No sidecar — direct
  DB connection, so the pod completes when `alembic` exits.
- Runs before every backend rollout; safe with multiple backend replicas
  because the running pods never migrate themselves.

#### `ingress.yaml` + `managed-certificate.yaml`

`Ingress`, class `gce` (annotation
`kubernetes.io/ingress.class: "gce"`; overlay may switch to `gce-internal`).

- `kubernetes.io/ingress.global-static-ip-name: <name>` — overlay value.
- `networking.gke.io/managed-certificates: automation-hub-cert` — overlay
  value.
- Host: `automation-hub-dev.menarini.net`.
- Rules, `pathType: Prefix`, single host (overlay sets the host):
  - `/api` → `backend:8000`
  - `/health` → `backend:8000`
  - `/admin` → `backend:8000`
  - `/docs` → `backend:8000`
  - `/openapi.json` → `backend:8000`
  - `/` → `frontend:8080`
- GCE picks the longest-prefix match, so the backend paths win over `/`.

`ManagedCertificate` `automation-hub-cert` with `domains: [automation-hub-dev.menarini.net]`.

#### `overlays/dev/kustomization.yaml`

- `namespace: automation-hub-dev`
- `namePrefix` / `commonLabels`: `app.kubernetes.io/part-of: automation-hub`,
  `environment: dev`.
- `images:` — `backend` and `frontend` set to the Artifact Registry paths with
  tag `dev` (CI rewrites to `dev-<sha8>` via `kustomize edit set image`).
- `resources: [../../base, secret.yaml]`.
- `patches: [config-patch.yaml, ingress-patch.yaml]`.
- `ingress-patch.yaml` supplies the static-IP name and `ManagedCertificate`
  name annotations; `config-patch.yaml` supplies the dev OIDC issuer / client
  id / bootstrap admin emails.

#### `deploy/argocd/automation-hub-dev.yaml`

Argo CD `Application`:

- `source.repoURL` = this repo, `source.path: deploy/overlays/dev`,
  `targetRevision: master`.
- `destination`: in-cluster, namespace `automation-hub-dev`.
- `syncPolicy.automated`: `prune: true`, `selfHeal: true`;
  `syncOptions: [CreateNamespace=true]`.

Provided as a file for DevOps to register (it typically lives in Argo's own
config repo).

### 4. `.gitlab-ci.yml`

```yaml
include:
  - project: 'ci_cd_ict_sdlc/pipelines_sot'
    file: 'GENERIC/cicd-generic-templates.yaml'
```

Variables: `APP_PROJECT: ict`, `APP_NAME: automation-hub`,
`MENARINI_ARTIFACT_REGISTRY_*` as in the reference pipeline,
`BACKEND_IMAGE: ${REPOSITORY_URI}/backend`,
`FRONTEND_IMAGE: ${REPOSITORY_URI}/frontend`.

Stages: `quality`, `release`, `integration`. All jobs
`rules: - if: '$CI_COMMIT_BRANCH == "master"'`.

| Job | Stage | Action |
|-----|-------|--------|
| `ruff` | quality | `pip install ruff==0.8.6 && ruff check backend && ruff format --check backend` |
| `eslint` | quality | `npm --prefix frontend ci && npm --prefix frontend run lint` (`allow_failure: true` initially) |
| `trivy_scan` | quality | org `.trivy_scan_template` |
| `build_backend` | release | `buildah bud -f backend/Dockerfile -t $BACKEND_IMAGE:dev-${CI_COMMIT_SHA:0:8} -t $BACKEND_IMAGE:dev backend/ && buildah push` (both tags) |
| `build_frontend` | release | `buildah bud -f frontend/Dockerfile --build-arg VITE_OIDC_AUTHORITY="$VITE_OIDC_AUTHORITY" --build-arg VITE_OIDC_CLIENT_ID="$VITE_OIDC_CLIENT_ID" --build-arg VITE_OIDC_REDIRECT_URI="$VITE_OIDC_REDIRECT_URI" -t $FRONTEND_IMAGE:dev-${CI_COMMIT_SHA:0:8} -t $FRONTEND_IMAGE:dev frontend/ && buildah push` |
| `bump_manifest` | integration | `needs: [build_backend, build_frontend]`; install kustomize; `cd deploy/overlays/dev && kustomize edit set image backend=$BACKEND_IMAGE:dev-${CI_COMMIT_SHA:0:8} frontend=$FRONTEND_IMAGE:dev-${CI_COMMIT_SHA:0:8}`; `git commit -am "ci: deploy dev ${CI_COMMIT_SHA:0:8} [skip ci]" && git push` back to `master` via a CI push token. Argo CD then syncs. |

GitLab CI/CD variables to create (DevOps): `VITE_OIDC_AUTHORITY`,
`VITE_OIDC_CLIENT_ID`, `VITE_OIDC_REDIRECT_URI`, Artifact Registry
`_json_key`, and a push token for `bump_manifest`.

If the shared templates already provide buildah / manifest-bump jobs
(`.build_buildah_image_template`, `.generic_manifest_integration_template`),
those are `extend`ed instead of hand-rolled — confirmed against the templates
during implementation.

### 5. `docs/deploy.md` — handover checklist

- **Database** (already provisioned): PG15, private IP `172.23.201.26:5432`,
  database `automation-hub`, user `automationhub`. Confirm the user owns the
  database / can create the `automation_hub` schema (Alembic creates schemas in
  migration `0002`). `automation_hub_test` is not needed in the cluster.
- **Network path**: pods in the dev GKE cluster must be able to reach
  `172.23.201.26:5432` — verify VPC routing / firewall / any egress policy.
- **Networking (Ingress)**: reserve a global static IP, name it in the overlay;
  DNS A record `automation-hub-dev.menarini.net` → that IP; `ManagedCertificate`
  domain already set to that host.
- **Keycloak** (existing client `mg-app_AutomationHub`): add redirect URI
  `https://automation-hub-dev.menarini.net/auth/callback` and web origin
  `https://automation-hub-dev.menarini.net`; confirm cluster egress to
  `keycloak-dev.menarini.net` (JWKS).
- **Secret**: `overlays/dev/secret.yaml` is committed with real values, so
  Argo applies it automatically. **Rotate the DB password after go-live** — it
  is in git history. Production must switch to an `ExternalSecret` / secret
  store.
- **Data**: load a sanitized `pg_dump` of the current dataset into
  `automation-hub`, otherwise the app comes up with empty reference/business
  tables and blank dashboards.
- **First deploy**: register the Argo CD Application; verify the PreSync
  migration Job succeeds; verify `/admin` login over HTTPS; verify an OIDC
  login round-trip.

### 6. `GET /health/ready`

Add to `backend/app/main.py`:

```python
from sqlalchemy import text
from app.db.session import engine

@app.get("/health/ready")
def health_ready() -> dict[str, str]:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ready"}
```

Readiness probe → `/health/ready` (fails when the DB is unreachable, so the
pod leaves the Service endpoints); liveness probe stays on `/health` (process
liveness only).

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Pods cannot route to `172.23.201.26:5432` (VPC peering / firewall / egress policy) | Explicit item in `docs/deploy.md`; the PreSync migration Job fails fast and visibly if the path is missing |
| PG15 vs local PG16 behavioural difference | Migration chain reviewed — no version-specific DDL; verify `alembic upgrade head` against a throwaway PG15 during implementation |
| DB user lacks privilege to create schemas (`automation_hub`, migration `0002`) | `docs/deploy.md` calls it out; grant before first sync |
| Empty dev database → unusable UI | `docs/deploy.md` calls out the one-time data load explicitly |
| Plaintext `secret.yaml` in git history (user-directed) | Private repo + dev-only scope; `docs/deploy.md` mandates rotation after go-live and `ExternalSecret` for prod |
| Shared CI templates diverge from the reference example | Implementation confirms actual template job names before finalising `.gitlab-ci.yml` |
| SQLAdmin cookie / OIDC redirect built as `http` behind the LB | `--proxy-headers --forwarded-allow-ips=*` on uvicorn; verified in the first-deploy checklist |

## Verification (manual — no automated tests in this project)

1. `docker build` both images locally; run the backend image against a local
   Postgres with `DATABASE_URL` set; hit `/health`, `/docs`, `/admin`.
2. `docker run` the frontend image; confirm `/` and a deep link
   (`/tickets`) both serve `index.html`; confirm the built JS contains the
   injected OIDC authority.
3. `kustomize build deploy/overlays/dev` renders without error; spot-check the
   Ingress paths, the ConfigMap/Secret refs, the PreSync annotation on the Job.
4. `kubectl apply --dry-run=server -k deploy/overlays/dev` in the dev cluster
   (DevOps).
5. First Argo sync: migration Job `Completed`; both Deployments `Available`;
   Ingress gets an IP and the cert goes `Active`; OIDC login round-trip; a
   write through `/admin` persists.
