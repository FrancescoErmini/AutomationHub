# GKE dev deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship production container images, kustomize manifests, an Argo CD Application, and a GitLab CI pipeline so Automation Hub runs in the `dev` environment on GKE, replacing local docker-compose.

**Architecture:** Two images (FastAPI backend, static frontend on nginx). One GKE Ingress on `automation-hub-dev.menarini.net` splits traffic by path: `/api /health /admin /docs /openapi.json` → backend, `/` → frontend. The backend connects directly to managed PostgreSQL 15 over its private IP `172.23.201.26:5432` (no proxy). Alembic migrations run as an Argo PreSync Job off the backend image. CI builds/pushes images to Artifact Registry and bumps the image tags in `deploy/overlays/dev`, which Argo CD auto-syncs.

**Tech Stack:** Docker, kustomize, Argo CD, GKE Ingress (`gce`) + ManagedCertificate, GitLab CI with shared templates (`ci_cd_ict_sdlc/pipelines_sot`), buildah, Google Artifact Registry, Python 3.12 / FastAPI / Alembic, Node 20 / Vite / nginx.

**Spec:** `docs/superpowers/specs/2026-09-07-gke-dev-deploy-design.md`

## Global Constraints

- This project has **no automated test suite** and no test framework — do not add one. "Test" steps below mean build / render / dry-run / curl verification.
- Dev host: `automation-hub-dev.menarini.net` (`https://automation-hub-dev.menarini.net/`).
- Database: PG15, private IP `172.23.201.26:5432`, database `automation-hub`, user `automationhub`. Already provisioned.
- `DATABASE_URL` form: `postgresql+psycopg://automationhub:<password>@172.23.201.26:5432/automation-hub`.
- Image registry base: `europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub` → `/backend` and `/frontend`.
- Deploy trigger: pipeline runs on `CI_COMMIT_BRANCH == "master"`.
- OIDC (unchanged): issuer `https://keycloak-dev.menarini.net/auth/realms/menarini`, client `mg-app_AutomationHub`.
- Frontend OIDC config is baked at image build time from `--build-arg`; there is one `dev` image.
- Secret: `deploy/overlays/dev/secret.yaml` committed in plaintext (private repo, dev only). No `.gitignore` entry for it.
- Backend container command must include `--proxy-headers --forwarded-allow-ips=*`.
- Match existing code style: Ruff-formatted Python, 100-col; existing manifest/YAML conventions are being established here.

---

### Task 1: Backend production image + readiness endpoint

**Files:**
- Modify: `backend/app/main.py` (add `/health/ready`)
- Modify: `backend/Dockerfile` (full rewrite)
- Modify: `backend/.dockerignore`

**Interfaces:**
- Consumes: nothing.
- Produces: an image whose default command serves uvicorn on `:8000`; the same image run with `["alembic","upgrade","head"]` applies migrations. Endpoints: `GET /health` (liveness, always 200), `GET /health/ready` (readiness, 200 only when `SELECT 1` succeeds).

- [ ] **Step 1: Add the readiness endpoint**

In `backend/app/main.py`, add the import near the other imports:

```python
from sqlalchemy import text
```

and add this endpoint just after the existing `health()` function:

```python
@app.get("/health/ready")
def health_ready() -> dict[str, str]:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ready"}
```

(`engine` is already imported at the top of the file: `from app.db.session import engine`.)

- [ ] **Step 2: Verify it locally**

Run:

```bash
make db-up
cd backend && DATABASE_URL=postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub \
  ../.venv/bin/uvicorn app.main:app --port 8010 &
sleep 2
curl -fsS localhost:8010/health && echo
curl -fsS localhost:8010/health/ready && echo
kill %1
```

Expected: `{"status":"ok"}` then `{"status":"ready"}`.

- [ ] **Step 3: Rewrite `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin appuser

WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
RUN pip install --upgrade pip && pip install .

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
```

- [ ] **Step 4: Update `backend/.dockerignore`**

Append:

```
.git
.venv
.env
.env.*
*.md
alembic/versions/__pycache__
automation_hub_backend.egg-info
scripts
```

- [ ] **Step 5: Build and smoke-test the image**

```bash
docker build -t automation-hub-backend:test ./backend
docker run --rm --network host \
  -e DATABASE_URL=postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub \
  automation-hub-backend:test &
sleep 4
curl -fsS localhost:8000/health && echo
curl -fsS localhost:8000/health/ready && echo
curl -fsS localhost:8000/docs -o /dev/null && echo "docs ok"
docker stop $(docker ps -q --filter ancestor=automation-hub-backend:test)
```

Expected: `{"status":"ok"}`, `{"status":"ready"}`, `docs ok`. Also confirm the process runs as `appuser`:

```bash
docker run --rm automation-hub-backend:test whoami
```

Expected: `appuser`.

- [ ] **Step 6: Verify the image can run migrations**

```bash
docker run --rm --network host \
  -e DATABASE_URL=postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub \
  automation-hub-backend:test alembic upgrade head
```

Expected: alembic runs to `20260904_0022` (or "already at head").

- [ ] **Step 7: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore backend/app/main.py
git commit -m "feat(deploy): production backend image and /health/ready endpoint"
```

---

### Task 2: Frontend production image (nginx static)

**Files:**
- Create: `frontend/nginx.conf`
- Modify: `frontend/Dockerfile` (full rewrite)
- Modify: `frontend/.dockerignore`

**Interfaces:**
- Consumes: nothing.
- Produces: an image serving the built SPA on `:8080`, with SPA fallback to `/index.html`. OIDC config is compiled in from build args `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_REDIRECT_URI`. No `/api` proxy (Ingress handles it).

- [ ] **Step 1: Create `frontend/nginx.conf`**

```nginx
server {
    listen       8080;
    server_name  _;
    root   /usr/share/nginx/html;
    index  index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Hashed build assets: cache hard.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA entry and client-side routes (including /auth/callback).
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri /index.html;
    }
}
```

- [ ] **Step 2: Rewrite `frontend/Dockerfile`**

```dockerfile
# --- build ---
FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_REDIRECT_URI
RUN printf 'VITE_OIDC_AUTHORITY=%s\nVITE_OIDC_CLIENT_ID=%s\nVITE_OIDC_REDIRECT_URI=%s\n' \
      "$VITE_OIDC_AUTHORITY" "$VITE_OIDC_CLIENT_ID" "$VITE_OIDC_REDIRECT_URI" > .env.production
RUN npm run build

# --- serve ---
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
```

- [ ] **Step 3: Update `frontend/.dockerignore`**

Append:

```
.git
.env
.env.*
*.md
playwright.config.ts
```

(Existing entries already exclude `node_modules`, `dist`, `test-results`, `playwright-report`.)

- [ ] **Step 4: Build with dev build args**

```bash
docker build -t automation-hub-frontend:test ./frontend \
  --build-arg VITE_OIDC_AUTHORITY=https://keycloak-dev.menarini.net/auth/realms/menarini \
  --build-arg VITE_OIDC_CLIENT_ID=mg-app_AutomationHub \
  --build-arg VITE_OIDC_REDIRECT_URI=https://automation-hub-dev.menarini.net/auth/callback
```

Expected: build succeeds, `tsc -b && vite build` produces `dist/`.

- [ ] **Step 5: Smoke-test the container**

```bash
docker run --rm -d -p 8080:8080 --name ah-fe-test automation-hub-frontend:test
sleep 2
curl -fsS localhost:8080/ -o /dev/null && echo "root ok"
curl -fsS localhost:8080/tickets -o /tmp/deep.html && grep -q '<div id="root">' /tmp/deep.html && echo "deep link -> index.html ok"
# confirm the OIDC authority was compiled in
docker exec ah-fe-test sh -c "grep -rl 'keycloak-dev.menarini.net' /usr/share/nginx/html/assets/ | head -1" && echo "oidc authority baked ok"
docker rm -f ah-fe-test
```

Expected: `root ok`, `deep link -> index.html ok`, `oidc authority baked ok`.

- [ ] **Step 6: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore
git commit -m "feat(deploy): production frontend image on nginx"
```

---

### Task 3: kustomize base

**Files:**
- Create: `deploy/base/kustomization.yaml`
- Create: `deploy/base/namespace.yaml`
- Create: `deploy/base/serviceaccount.yaml`
- Create: `deploy/base/configmap.yaml`
- Create: `deploy/base/backend-deployment.yaml`
- Create: `deploy/base/backend-service.yaml`
- Create: `deploy/base/backend-backendconfig.yaml`
- Create: `deploy/base/frontend-deployment.yaml`
- Create: `deploy/base/frontend-service.yaml`
- Create: `deploy/base/frontend-backendconfig.yaml`
- Create: `deploy/base/migrate-job.yaml`
- Create: `deploy/base/ingress.yaml`
- Create: `deploy/base/managed-certificate.yaml`

**Interfaces:**
- Consumes: images named `automation-hub-backend` and `automation-hub-frontend` (overlay rewrites these).
- Produces: base resources in namespace `automation-hub`; env is fed from ConfigMap `automation-hub-config` and Secret `automation-hub-secrets` (Secret supplied by the overlay). Backend Service `backend:8000`, frontend Service `frontend:8080`.

- [ ] **Step 1: `deploy/base/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: automation-hub
```

- [ ] **Step 2: `deploy/base/serviceaccount.yaml`**

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: automation-hub
```

- [ ] **Step 3: `deploy/base/configmap.yaml`**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: automation-hub-config
data:
  ENVIRONMENT: "production"
  LOG_LEVEL: "INFO"
  OIDC_ISSUER: "https://keycloak-dev.menarini.net/auth/realms/menarini"
  OIDC_CLIENT_ID: "mg-app_AutomationHub"
  BOOTSTRAP_ADMIN_EMAILS: ""
```

- [ ] **Step 4: `deploy/base/backend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  labels:
    app.kubernetes.io/name: automation-hub
    app.kubernetes.io/component: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: automation-hub
      app.kubernetes.io/component: backend
  template:
    metadata:
      labels:
        app.kubernetes.io/name: automation-hub
        app.kubernetes.io/component: backend
    spec:
      serviceAccountName: automation-hub
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: app
          image: automation-hub-backend
          ports:
            - containerPort: 8000
          envFrom:
            - configMapRef:
                name: automation-hub-config
            - secretRef:
                name: automation-hub-secrets
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 20
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
```

- [ ] **Step 5: `deploy/base/backend-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  annotations:
    cloud.google.com/backend-config: '{"default":"backend-backendconfig"}'
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: automation-hub
    app.kubernetes.io/component: backend
  ports:
    - name: http
      port: 8000
      targetPort: 8000
```

- [ ] **Step 6: `deploy/base/backend-backendconfig.yaml`**

```yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: backend-backendconfig
spec:
  healthCheck:
    type: HTTP
    requestPath: /health
    port: 8000
  timeoutSec: 30
```

- [ ] **Step 7: `deploy/base/frontend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  labels:
    app.kubernetes.io/name: automation-hub
    app.kubernetes.io/component: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: automation-hub
      app.kubernetes.io/component: frontend
  template:
    metadata:
      labels:
        app.kubernetes.io/name: automation-hub
        app.kubernetes.io/component: frontend
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: web
          image: automation-hub-frontend
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 20
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: nginx-cache
              mountPath: /var/cache/nginx
      volumes:
        - name: tmp
          emptyDir: {}
        - name: nginx-cache
          emptyDir: {}
```

- [ ] **Step 8: `deploy/base/frontend-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  annotations:
    cloud.google.com/backend-config: '{"default":"frontend-backendconfig"}'
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: automation-hub
    app.kubernetes.io/component: frontend
  ports:
    - name: http
      port: 8080
      targetPort: 8080
```

- [ ] **Step 9: `deploy/base/frontend-backendconfig.yaml`**

```yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: frontend-backendconfig
spec:
  healthCheck:
    type: HTTP
    requestPath: /
    port: 8080
```

- [ ] **Step 10: `deploy/base/migrate-job.yaml`**

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migrate
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 600
  template:
    metadata:
      labels:
        app.kubernetes.io/name: automation-hub
        app.kubernetes.io/component: migrate
    spec:
      restartPolicy: Never
      serviceAccountName: automation-hub
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: migrate
          image: automation-hub-backend
          command: ["alembic", "upgrade", "head"]
          workingDir: /app
          envFrom:
            - configMapRef:
                name: automation-hub-config
            - secretRef:
                name: automation-hub-secrets
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
```

- [ ] **Step 11: `deploy/base/managed-certificate.yaml`**

```yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: automation-hub-cert
spec:
  domains:
    - automation-hub-dev.menarini.net
```

- [ ] **Step 12: `deploy/base/ingress.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: automation-hub
  annotations:
    kubernetes.io/ingress.class: "gce"
    networking.gke.io/managed-certificates: "automation-hub-cert"
spec:
  rules:
    - host: automation-hub-dev.menarini.net
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000
          - path: /health
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000
          - path: /admin
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000
          - path: /docs
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000
          - path: /openapi.json
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 8080
```

- [ ] **Step 13: `deploy/base/kustomization.yaml`**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: automation-hub

commonLabels:
  app.kubernetes.io/part-of: automation-hub

resources:
  - namespace.yaml
  - serviceaccount.yaml
  - configmap.yaml
  - backend-deployment.yaml
  - backend-service.yaml
  - backend-backendconfig.yaml
  - frontend-deployment.yaml
  - frontend-service.yaml
  - frontend-backendconfig.yaml
  - migrate-job.yaml
  - managed-certificate.yaml
  - ingress.yaml

images:
  - name: automation-hub-backend
    newName: europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/backend
    newTag: dev
  - name: automation-hub-frontend
    newName: europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/frontend
    newTag: dev
```

- [ ] **Step 14: Render the base**

Run:

```bash
kustomize build deploy/base > /tmp/base.yaml && echo "render ok"
grep -c "kind: " /tmp/base.yaml
grep -E "image: europe-docker" /tmp/base.yaml
```

Expected: `render ok`; 12 documents; both images rewritten to the Artifact Registry paths with `:dev`.

- [ ] **Step 15: Commit**

```bash
git add deploy/base
git commit -m "feat(deploy): kustomize base manifests"
```

---

### Task 4: kustomize dev overlay (with committed Secret)

**Files:**
- Create: `deploy/overlays/dev/kustomization.yaml`
- Create: `deploy/overlays/dev/config-patch.yaml`
- Create: `deploy/overlays/dev/ingress-patch.yaml`
- Create: `deploy/overlays/dev/secret.yaml`

**Interfaces:**
- Consumes: `deploy/base`.
- Produces: fully-rendered dev manifests in namespace `automation-hub-dev`, images tagged `dev` (CI rewrites to `dev-<sha8>`), Secret `automation-hub-secrets` present, Ingress annotated with the static IP name.

- [ ] **Step 1: `deploy/overlays/dev/config-patch.yaml`**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: automation-hub-config
data:
  ENVIRONMENT: "dev"
  BOOTSTRAP_ADMIN_EMAILS: "francesco.ermini@example.menarini.net"
```

Note: replace `BOOTSTRAP_ADMIN_EMAILS` with the real comma-separated bootstrap
admin address(es) for dev before first deploy. If unknown at implementation
time, leave it as `""` and record it as an open item in `docs/deploy.md`.

- [ ] **Step 2: `deploy/overlays/dev/ingress-patch.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: automation-hub
  annotations:
    # DevOps: reserve a GLOBAL static IP and put its name here.
    kubernetes.io/ingress.global-static-ip-name: "automation-hub-dev-ip"
```

- [ ] **Step 3: `deploy/overlays/dev/secret.yaml`**

Create the Secret with **real values**:

- `DATABASE_URL`: `postgresql+psycopg://automationhub:<DB_PASSWORD>@172.23.201.26:5432/automation-hub` — use the DB password provided in the deploy conversation (do not invent one).
- `ADMIN_USERNAME`: `admin`
- `ADMIN_PASSWORD`: generate with `openssl rand -base64 18`
- `ADMIN_SECRET_KEY`: generate with `openssl rand -hex 32`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: automation-hub-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql+psycopg://automationhub:REPLACE_DB_PASSWORD@172.23.201.26:5432/automation-hub"
  ADMIN_USERNAME: "admin"
  ADMIN_PASSWORD: "REPLACE_GENERATED"
  ADMIN_SECRET_KEY: "REPLACE_GENERATED"
```

After filling values, sanity-check there are no unescaped URL-reserved
characters (`@ : / ? # [ ]`) in the password portion; percent-encode if needed.

- [ ] **Step 4: `deploy/overlays/dev/kustomization.yaml`**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: automation-hub-dev

commonLabels:
  environment: dev

resources:
  - ../../base
  - secret.yaml

patches:
  - path: config-patch.yaml
  - path: ingress-patch.yaml

images:
  - name: europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/backend
    newTag: dev
  - name: europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/frontend
    newTag: dev
```

- [ ] **Step 5: Render the overlay**

```bash
kustomize build deploy/overlays/dev > /tmp/dev.yaml && echo "render ok"
grep -E "namespace: automation-hub-dev" /tmp/dev.yaml | head -1
grep -E "kind: Secret" /tmp/dev.yaml
grep -E "ENVIRONMENT: dev|ENVIRONMENT: \"dev\"" /tmp/dev.yaml
grep -E "global-static-ip-name" /tmp/dev.yaml
grep -E "host: automation-hub-dev.menarini.net" /tmp/dev.yaml
```

Expected: `render ok`; namespace applied to all resources; Secret present; `ENVIRONMENT` is `dev`; static IP annotation present; Ingress host correct.

- [ ] **Step 6: Client-side validate (if `kubeconform` available; skip if not)**

```bash
command -v kubeconform >/dev/null && \
  kustomize build deploy/overlays/dev | kubeconform -strict -ignore-missing-schemas -verbose || \
  echo "kubeconform not installed - skipping"
```

Expected: no errors (CRDs like `BackendConfig`/`ManagedCertificate` are skipped as missing schemas).

- [ ] **Step 7: Commit**

```bash
git add deploy/overlays/dev
git commit -m "feat(deploy): dev overlay with committed secret"
```

---

### Task 5: Argo CD Application + DevOps handover doc

**Files:**
- Create: `deploy/argocd/automation-hub-dev.yaml`
- Create: `docs/deploy.md`
- Modify: `README.md` (add a pointer to `docs/deploy.md`)

**Interfaces:**
- Consumes: `deploy/overlays/dev` on branch `master`.
- Produces: an Argo CD `Application` DevOps registers; a checklist doc.

- [ ] **Step 1: `deploy/argocd/automation-hub-dev.yaml`**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: automation-hub-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: git@mcdgit.menarini.net:ict/software-architecture/automation-hub.git
    targetRevision: master
    path: deploy/overlays/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: automation-hub-dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

- [ ] **Step 2: `docs/deploy.md`**

```markdown
# Dev deployment (GKE)

Automation Hub `dev` runs on GKE, GitOps-managed by Argo CD from
`deploy/overlays/dev` on `master`.

- Host: https://automation-hub-dev.menarini.net/
- Namespace: `automation-hub-dev`
- Images: `europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/{backend,frontend}`
- Database: managed PostgreSQL 15, private IP `172.23.201.26:5432`,
  database `automation-hub`, user `automationhub` (direct connection, no proxy).

## Pipeline

`.gitlab-ci.yml` on `master`: lint + Trivy -> buildah build/push both images
tagged `dev-<sha8>` and `dev` -> `bump_manifest` rewrites the image tags in
`deploy/overlays/dev/kustomization.yaml` and pushes a `[skip ci]` commit to
`master`. Argo CD then syncs; its PreSync hook runs the `migrate` Job
(`alembic upgrade head`) before the backend rollout.

### GitLab CI/CD variables required

| Variable | Purpose |
|----------|---------|
| `VITE_OIDC_AUTHORITY` | `https://keycloak-dev.menarini.net/auth/realms/menarini` |
| `VITE_OIDC_CLIENT_ID` | `mg-app_AutomationHub` |
| `VITE_OIDC_REDIRECT_URI` | `https://automation-hub-dev.menarini.net/auth/callback` |
| `MENARINI_ARTIFACT_REGISTRY_KEY` | Artifact Registry `_json_key` push credential |
| `MANIFEST_PUSH_TOKEN` | Project access token (write_repository) for the `bump_manifest` commit |

## One-time setup (DevOps)

1. **Network**: confirm pods in `automation-hub-dev` can reach
   `172.23.201.26:5432` (VPC routing / firewall / egress policy).
2. **DB privileges**: `automationhub` must be able to `CREATE SCHEMA`
   (Alembic migration `0002` creates the `automation_hub` schema inside the
   `automation-hub` database).
3. **Ingress IP + DNS**: reserve a GLOBAL static IP, set its name in
   `deploy/overlays/dev/ingress-patch.yaml`
   (`kubernetes.io/ingress.global-static-ip-name`); create the A record
   `automation-hub-dev.menarini.net` -> that IP. The `ManagedCertificate`
   provisions once DNS resolves and HTTP is reachable.
4. **Keycloak** (existing client `mg-app_AutomationHub`): add redirect URI
   `https://automation-hub-dev.menarini.net/auth/callback` and web origin
   `https://automation-hub-dev.menarini.net`.
5. **Argo CD**: apply `deploy/argocd/automation-hub-dev.yaml`.
6. **Data**: load a sanitized `pg_dump` of the current dataset into the
   `automation-hub` database, or dashboards render empty (reference and
   business data are not in the repo).

## Secrets

`deploy/overlays/dev/secret.yaml` is committed in plaintext — acceptable only
because the repo is private and this is dev.

- **Rotate `DATABASE_URL`'s password after go-live** — it is in git history.
- **Production must not do this.** Use an `ExternalSecret` (External Secrets
  Operator) or Sealed Secrets bound to a secret store; keep only a non-secret
  reference in git.

## Verifying a deploy

```
kubectl -n automation-hub-dev get pods
kubectl -n automation-hub-dev logs job/migrate
kubectl -n automation-hub-dev get ingress automation-hub
kubectl -n automation-hub-dev get managedcertificate
curl -fsS https://automation-hub-dev.menarini.net/health
```

Then in a browser: log in via Keycloak, and confirm `/admin` loads over HTTPS.

## Follow-ups (not built)

- HPA, PodDisruptionBudget, NetworkPolicy.
- HTTP->HTTPS redirect (`FrontendConfig` with `redirectToHttps`).
- staging / prod overlays + `ExternalSecret`.
```

If `BOOTSTRAP_ADMIN_EMAILS` was left empty in Task 4, add a line under
"One-time setup" telling DevOps to set it in `config-patch.yaml`.

- [ ] **Step 3: Add a pointer in `README.md`**

Under the `## Security and configuration` section, replace the last sentence
("...production deployment configuration is intentionally outside this local
foundation.") with:

```markdown
`.env.example` contains development-only credentials. `.env` is ignored. Do not
reuse these credentials outside local development. Deployment to the `dev`
environment on GKE is documented in [`docs/deploy.md`](docs/deploy.md); the
manifests live in `deploy/`.
```

- [ ] **Step 4: Verify**

```bash
python -c "import yaml,sys; list(yaml.safe_load_all(open('deploy/argocd/automation-hub-dev.yaml'))); print('argocd yaml ok')"
grep -q "docs/deploy.md" README.md && echo "readme pointer ok"
```

Expected: both lines print ok.

- [ ] **Step 5: Commit**

```bash
git add deploy/argocd docs/deploy.md README.md
git commit -m "docs(deploy): argo cd application and dev deploy runbook"
```

---

### Task 6: GitLab CI pipeline

**Files:**
- Create: `.gitlab-ci.yml`

**Interfaces:**
- Consumes: `backend/Dockerfile`, `frontend/Dockerfile`, `deploy/overlays/dev/kustomization.yaml`.
- Produces: images `…/automation-hub/backend:dev-<sha8>` and `…/frontend:dev-<sha8>` (+ `:dev`), and a `[skip ci]` commit to `master` bumping the overlay image tags.

- [ ] **Step 1: Create `.gitlab-ci.yml`**

```yaml
include:
  - project: 'ci_cd_ict_sdlc/pipelines_sot'
    file: 'GENERIC/cicd-generic-templates.yaml'

variables:
  DOCKER_HOST: tcp://localhost:2375
  DOCKER_TLS_CERTDIR: ""
  MENARINI_ARTIFACT_REGISTRY_SERVER: europe-docker.pkg.dev
  MENARINI_ARTIFACT_REGISTRY_URL: ${MENARINI_ARTIFACT_REGISTRY_SERVER}/mgcp-sdlc-230917012
  MENARINI_ARTIFACT_REGISTRY_USER: _json_key
  APP_PROJECT: ict
  APP_NAME: automation-hub
  REPOSITORY_URI: "${MENARINI_ARTIFACT_REGISTRY_URL}/${APP_PROJECT}/${APP_NAME}"
  BACKEND_IMAGE: "${REPOSITORY_URI}/backend"
  FRONTEND_IMAGE: "${REPOSITORY_URI}/frontend"

stages:
  - quality
  - release
  - integration

.dev_only: &dev_only
  rules:
    - if: '$CI_COMMIT_BRANCH == "master"'

ruff:
  stage: quality
  image: python:3.12-slim
  <<: *dev_only
  script:
    - pip install ruff==0.8.6
    - ruff check backend
    - ruff format --check backend

eslint:
  stage: quality
  image: node:20-bookworm-slim
  allow_failure: true
  <<: *dev_only
  script:
    - npm --prefix frontend ci
    - npm --prefix frontend run lint

trivy_scan:
  extends: .trivy_scan_template
  <<: *dev_only

build_backend:
  extends: .build_buildah_image_template
  stage: release
  <<: *dev_only
  script:
    - export IMAGE_TAG="dev-${CI_COMMIT_SHA:0:8}"
    - buildah bud -f backend/Dockerfile -t "${BACKEND_IMAGE}:${IMAGE_TAG}" -t "${BACKEND_IMAGE}:dev" backend/
    - buildah push "${BACKEND_IMAGE}:${IMAGE_TAG}"
    - buildah push "${BACKEND_IMAGE}:dev"

build_frontend:
  extends: .build_buildah_image_template
  stage: release
  <<: *dev_only
  script:
    - export IMAGE_TAG="dev-${CI_COMMIT_SHA:0:8}"
    - >
      buildah bud -f frontend/Dockerfile
      --build-arg VITE_OIDC_AUTHORITY="${VITE_OIDC_AUTHORITY}"
      --build-arg VITE_OIDC_CLIENT_ID="${VITE_OIDC_CLIENT_ID}"
      --build-arg VITE_OIDC_REDIRECT_URI="${VITE_OIDC_REDIRECT_URI}"
      -t "${FRONTEND_IMAGE}:${IMAGE_TAG}" -t "${FRONTEND_IMAGE}:dev" frontend/
    - buildah push "${FRONTEND_IMAGE}:${IMAGE_TAG}"
    - buildah push "${FRONTEND_IMAGE}:dev"

bump_manifest:
  stage: integration
  image: alpine:3.20
  needs: ["build_backend", "build_frontend"]
  <<: *dev_only
  variables:
    GIT_STRATEGY: clone
  script:
    - apk add --no-cache git curl
    - curl -sSL "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv5.4.3/kustomize_v5.4.3_linux_amd64.tar.gz" | tar xz -C /usr/local/bin
    - export IMAGE_TAG="dev-${CI_COMMIT_SHA:0:8}"
    - (cd deploy/overlays/dev && kustomize edit set image "${BACKEND_IMAGE}:${IMAGE_TAG}" "${FRONTEND_IMAGE}:${IMAGE_TAG}")
    - git config user.email "ci@menarini.net"
    - git config user.name "GitLab CI"
    - git add deploy/overlays/dev/kustomization.yaml
    - git commit -m "ci(deploy): dev ${IMAGE_TAG} [skip ci]" || { echo "no manifest change"; exit 0; }
    - git push "https://oauth2:${MANIFEST_PUSH_TOKEN}@mcdgit.menarini.net/ict/software-architecture/automation-hub.git" HEAD:master
```

**Implementer note:** before finalising, open
`ci_cd_ict_sdlc/pipelines_sot` → `GENERIC/cicd-generic-templates.yaml` and
confirm the real template job names. If it provides a manifest-bump template
(e.g. `.generic_manifest_integration_template`) that fits an in-repo overlay,
prefer extending it over the hand-rolled `bump_manifest`. If `.build_buildah_image_template`
already sets `stage`/`rules`, drop the duplicates. Keep the two-image structure
regardless.

- [ ] **Step 2: Validate YAML**

```bash
python -c "import yaml; yaml.safe_load(open('.gitlab-ci.yml')); print('gitlab-ci yaml ok')"
```

Expected: `gitlab-ci yaml ok`.

- [ ] **Step 3: Lint via GitLab API (if `glab` is available; skip otherwise)**

```bash
command -v glab >/dev/null && glab ci lint || echo "glab not installed - skipping (CI lint runs on push)"
```

- [ ] **Step 4: Commit**

```bash
git add .gitlab-ci.yml
git commit -m "ci(deploy): build backend and frontend images, bump dev overlay"
```

---

### Task 7: Full-stack local verification + finalize

**Files:**
- Modify: `docker-compose.yml` (optional — only if Step 2 shows the prod images are wanted for a compose smoke path; otherwise no change)

**Interfaces:**
- Consumes: everything above.
- Produces: a verified, rendered manifest set and a clean tree ready to push.

- [ ] **Step 1: Re-render both kustomize targets from a clean state**

```bash
kustomize build deploy/base > /tmp/base.yaml && echo "base ok"
kustomize build deploy/overlays/dev > /tmp/dev.yaml && echo "dev ok"
```

Expected: both `ok`.

- [ ] **Step 2: Assert the rendered dev manifest invariants**

```bash
grep -q 'name: automation-hub-secrets' /tmp/dev.yaml && echo "secret present"
grep -q 'argocd.argoproj.io/hook: PreSync' /tmp/dev.yaml && echo "presync hook present"
grep -q 'path: /api' /tmp/dev.yaml && grep -q 'path: /' /tmp/dev.yaml && echo "ingress paths present"
grep -Eq 'image: europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/backend:dev' /tmp/dev.yaml && echo "backend image pinned"
grep -Eq 'image: europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/frontend:dev' /tmp/dev.yaml && echo "frontend image pinned"
grep -q 'ENVIRONMENT: dev' /tmp/dev.yaml && echo "env dev"
! grep -q 'automation-hub$' <(grep 'namespace:' /tmp/dev.yaml | sort -u) && echo "namespace overridden to dev"
```

Expected: every line prints its confirmation.

- [ ] **Step 3: Build both images one more time (clean)**

```bash
docker build -t ah-backend:verify ./backend
docker build -t ah-frontend:verify ./frontend \
  --build-arg VITE_OIDC_AUTHORITY=https://keycloak-dev.menarini.net/auth/realms/menarini \
  --build-arg VITE_OIDC_CLIENT_ID=mg-app_AutomationHub \
  --build-arg VITE_OIDC_REDIRECT_URI=https://automation-hub-dev.menarini.net/auth/callback
```

Expected: both succeed.

- [ ] **Step 4: End-to-end local run against the prod images**

```bash
make db-up
docker run --rm -d --name ah-be --network host \
  -e DATABASE_URL=postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub \
  ah-backend:verify alembic upgrade head
sleep 5; docker logs ah-be; docker rm -f ah-be 2>/dev/null || true
docker run --rm -d --name ah-be --network host \
  -e DATABASE_URL=postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub \
  ah-backend:verify
docker run --rm -d --name ah-fe -p 8080:8080 ah-frontend:verify
sleep 4
curl -fsS localhost:8000/health/ready && echo
curl -fsS localhost:8080/ -o /dev/null && echo "fe ok"
docker rm -f ah-be ah-fe
```

Expected: migrations run clean, `{"status":"ready"}`, `fe ok`.

- [ ] **Step 5: Confirm no secret material leaked outside `secret.yaml`**

```bash
git grep -nI "REPLACE_DB_PASSWORD\|REPLACE_GENERATED" -- . && echo "FIX: placeholders still present in secret.yaml" || echo "no placeholders left"
git grep -nI "172.23.201.26" -- . ':!docs/' ':!deploy/overlays/dev/secret.yaml'
```

Expected: no leftover `REPLACE_*` placeholders; the private IP appears only in `docs/` and `secret.yaml`.

- [ ] **Step 6: Final review of the diff**

```bash
git log --oneline master..HEAD
git diff --stat master..HEAD
```

Confirm the changed files match this plan's file list and nothing stray is staged.

- [ ] **Step 7: Push the branch**

```bash
git push -u origin HEAD
```

(Open an MR to `master` per team convention. `bump_manifest` will only fire once this is on `master`.)

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Backend production Dockerfile | Task 1 |
| `GET /health/ready` | Task 1 |
| Frontend Dockerfile + nginx.conf | Task 2 |
| `.dockerignore` updates | Tasks 1, 2 |
| kustomize base (all 13 files) | Task 3 |
| Cloud SQL: direct private IP, no sidecar | Tasks 3 (deployment/job have no sidecar), 4 (secret DATABASE_URL) |
| ConfigMap keys | Task 3 (base) + Task 4 (dev patch) |
| Secret committed plaintext | Task 4 |
| Migration PreSync Job | Task 3 (step 10) |
| Ingress single-host path split + ManagedCertificate | Task 3 (steps 11–12) |
| dev overlay (kustomization, config-patch, ingress-patch) | Task 4 |
| Argo CD Application | Task 5 |
| `.gitlab-ci.yml` (2 image builds + bump_manifest) | Task 6 |
| `docs/deploy.md` handover checklist | Task 5 |
| `--proxy-headers` on uvicorn | Task 1 (step 3) |
| Verification (manual) | Task 7 |

No gaps.

**Placeholder scan:** `secret.yaml` intentionally ships with `REPLACE_*`
markers that the implementer fills from the deploy conversation / `openssl`;
Task 7 Step 5 asserts they are gone. `config-patch.yaml`
`BOOTSTRAP_ADMIN_EMAILS` and `ingress-patch.yaml` static-IP name are flagged
as fill-ins with a documented fallback. No code steps lack code.

**Type consistency:** Service names (`backend:8000`, `frontend:8080`),
ConfigMap name (`automation-hub-config`), Secret name (`automation-hub-secrets`),
image kustomize names (`automation-hub-backend` / `automation-hub-frontend` in
base, full registry path in the dev overlay `images:` override), label
selectors (`app.kubernetes.io/name` + `app.kubernetes.io/component`) are
consistent across Tasks 3–6. The `/health` (liveness) vs `/health/ready`
(readiness) split matches Task 1.
