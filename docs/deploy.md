# Dev deployment (GKE)

Automation Hub `dev` runs on GKE, GitOps-managed by Argo CD from
`deploy/overlays/dev` on `master`.

- Host: <https://automation-hub-dev.menarini.net/>
- Namespace: `automation-hub-dev`
- Images: `europe-docker.pkg.dev/mgcp-sdlc-230917012/ict/automation-hub/{backend,frontend}`
- Database: managed PostgreSQL 15, private IP `172.23.201.26:5432`,
  database `automation-hub`, user `automationhub` (direct connection, no proxy).

## Layout

```
deploy/
  base/                 kustomize base (Deployments, Services, BackendConfigs,
                        migrate Job, Ingress, ManagedCertificate)
  overlays/dev/         namespace, image tags, ConfigMap patch, Ingress patch,
                        committed Secret
  argocd/               Argo CD Application manifest
```

Render locally with `kubectl kustomize deploy/overlays/dev`.

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
| `MANIFEST_PUSH_TOKEN` | Project access token (`write_repository`) for the `bump_manifest` commit |

## One-time setup (DevOps)

1. **Network**: confirm pods in `automation-hub-dev` can reach
   `172.23.201.26:5432` (VPC routing / firewall / egress policy).
2. **DB privileges**: `automationhub` must be able to `CREATE SCHEMA`
   (Alembic migration `0002` creates the `automation_hub` schema inside the
   `automation-hub` database).
3. **Ingress IP + DNS**: reserve a GLOBAL static IP, set its name in
   `deploy/overlays/dev/ingress-patch.yaml`
   (`kubernetes.io/ingress.global-static-ip-name`, currently
   `automation-hub-dev-ip`); create the A record
   `automation-hub-dev.menarini.net` -> that IP. The `ManagedCertificate`
   provisions once DNS resolves and HTTP is reachable.
4. **Keycloak** (existing client `mg-app_AutomationHub`): add redirect URI
   `https://automation-hub-dev.menarini.net/auth/callback` and web origin
   `https://automation-hub-dev.menarini.net`.
5. **Bootstrap admin**: set `BOOTSTRAP_ADMIN_EMAILS` in
   `deploy/overlays/dev/config-patch.yaml` to the comma-separated Keycloak
   account email(s) that should be auto-promoted to app admin on first login.
   Left empty, no one can administer through the OIDC UI.
6. **Argo CD**: apply `deploy/argocd/automation-hub-dev.yaml`.
7. **Data**: load a sanitized `pg_dump` of the current dataset into the
   `automation-hub` database, or dashboards render empty (reference and
   business data are not in the repo).

## Secrets

`deploy/overlays/dev/secret.yaml` is committed in plaintext — acceptable only
because the repo is private and this is dev.

- **Rotate `DATABASE_URL`'s password after go-live** — it is in git history.
- **Production must not do this.** Use an `ExternalSecret` (External Secrets
  Operator) or Sealed Secrets bound to a secret store; keep only a non-secret
  reference in git.

`ADMIN_USERNAME` / `ADMIN_PASSWORD` guard the SQLAdmin panel at `/admin`
(separate from OIDC). `ADMIN_SECRET_KEY` signs its session cookie.

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
- GKE native sidecar / Cloud SQL Auth Proxy if the direct private-IP path is
  ever withdrawn.
