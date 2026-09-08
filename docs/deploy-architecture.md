# Panoramica del deploy su GKE (dev)

Documento di accompagnamento per il team DevOps. Spiega **come è pensato tutto
il giro**, dal `git push` fino al pod che serve traffico, e in fondo c'è una
spiegazione a parole del perché il frontend in produzione gira dietro nginx e
non con `npm run dev` come in locale.

I dettagli operativi (variabili CI, checklist di setup una-tantum, verifica di
un deploy) stanno in [`docs/deploy.md`](deploy.md). Qui si spiega il *disegno*.

---

## 1. Il quadro generale

```
  sviluppatore                    GitLab CI                      Artifact Registry
  ────────────                    ─────────                      ─────────────────
  git push su master  ─────────►  lint + trivy                          ▲
                                  build immagine backend  ──────────────┤
                                  build immagine frontend ──────────────┘
                                        │
                                        ▼
                                  bump_manifest:
                                  scrive i nuovi tag immagine in
                                  deploy/overlays/dev/kustomization.yaml
                                  e fa commit su master  [skip ci]
                                        │
                                        ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  Argo CD  (guarda deploy/overlays/dev su master)                        │
  │    vede il commit → parte il sync                                       │
  │      1. PreSync hook: Job "migrate" → alembic upgrade head              │
  │      2. applica/aggiorna i Deployment backend e frontend               │
  └───────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  GKE namespace automation-hub-dev                                       │
  │                                                                        │
  │   Ingress (automation-hub-dev.menarini.net)                            │
  │     /api /health /admin /docs /openapi.json ─►  Service backend :8000  │
  │     /                                        ─►  Service frontend :8080 │
  │                                                                        │
  │   Deployment backend  (2 pod, FastAPI/uvicorn)                          │
  │        └── connessione diretta ─►  PostgreSQL 15  172.23.201.26:5432    │
  │   Deployment frontend (2 pod, nginx che serve file statici)            │
  └───────────────────────────────────────────────────────────────────────┘
```

Il principio è **GitOps**: nessuno fa `kubectl apply` a mano. Lo stato
desiderato del cluster è *sempre* quello che si vede in `deploy/overlays/dev`
sul branch `master`. La CI non parla con il cluster; si limita a costruire le
immagini e a scrivere i tag nel repo. È Argo CD che riconcilia il cluster con
il repo.

---

## 2. La pipeline GitLab CI (`.gitlab-ci.yml`)

Gira **solo su `master`** (`rules: if $CI_COMMIT_BRANCH == "master"`). Tre
stage.

### Stage `quality`

| Job | Cosa fa |
|-----|---------|
| `ruff` | lint + formattazione del codice Python (`backend/`) |
| `eslint` | lint del frontend (`allow_failure: true` per ora, così non blocca il deploy mentre si sistemano i warning storici) |
| `trivy_scan` | scansione vulnerabilità (template condiviso) |

### Stage `release`

Due job di build separati, uno per immagine:

- **`build_backend`** — `buildah bud -f backend/Dockerfile backend/`, poi push
  su Artifact Registry con **due tag**: `dev-<sha8>` (immutabile, identifica il
  commit) e `dev` (mobile, comodo come riferimento "ultimo dev").
- **`build_frontend`** — stessa cosa con `frontend/Dockerfile`, ma passa anche
  tre `--build-arg` con la configurazione OIDC (vedi sezione 6). I valori
  arrivano da **variabili CI/CD di GitLab** (`VITE_OIDC_AUTHORITY`, ecc.), non
  sono committati.

Entrambi estendono `.build_buildah_image_template` dei template condivisi.
**Da verificare lato DevOps:** i nomi esatti dei job template
(`.build_buildah_image_template`, `.trivy_scan_template`) — l'account bot che
ha generato il file non aveva accesso a `ci_cd_ict_sdlc/pipelines_sot`. C'è un
commento in testa al file che lo ricorda.

### Stage `integration`

- **`bump_manifest`** — è il ponte fra CI e GitOps. Fa:
  1. `kustomize edit set image .../backend:dev-<sha8> .../frontend:dev-<sha8>`
     dentro `deploy/overlays/dev/` — aggiorna i tag nel `kustomization.yaml`.
  2. commit di quella modifica su `master` con messaggio che finisce con
     `[skip ci]` (così il commit della CI **non** ritriggera la pipeline →
     niente loop).
  3. push su `master` usando un **project access token** (`MANIFEST_PUSH_TOKEN`,
     scope `write_repository`).

Da qui in poi la CI ha finito. Il resto lo fa Argo CD.

> **Perché il commit di ritorno su master e non un branch/MR?** Scelta
> esplicita: per `dev` si vuole il ciclo più corto possibile (push → online).
> Per staging/prod si può cambiare in un MR o un branch ops dedicato.

---

## 3. Argo CD e cosa succede al sync

`deploy/argocd/automation-hub-dev.yaml` definisce una `Application` che:

- guarda **questo repo**, path `deploy/overlays/dev`, branch `master`;
- deploya nel namespace `automation-hub-dev` (con `CreateNamespace=true`);
- ha `syncPolicy.automated` con `prune: true` e `selfHeal: true` — cioè applica
  da solo ogni cambiamento, rimuove le risorse tolte dal repo, e ripristina
  eventuali modifiche fatte a mano nel cluster.

Quando `bump_manifest` committa i nuovi tag, Argo vede la differenza e lancia un
**sync**. L'ordine è importante:

1. **PreSync hook** — Argo crea prima il **Job `migrate`** (è marcato
   `argocd.argoproj.io/hook: PreSync`). Il Job gira la **stessa immagine del
   backend** ma con comando `alembic upgrade head`. Applica le migrazioni al
   database **prima** che i nuovi pod backend partano.
   - `hook-delete-policy: BeforeHookCreation` → il Job vecchio viene cancellato
     e ricreato a ogni sync, così nei log si vede sempre l'ultima esecuzione.
   - Se le migrazioni falliscono, il sync si ferma qui: i pod vecchi restano su,
     i nuovi non partono.
2. **Sync vero e proprio** — Argo applica/aggiorna `Deployment backend` e
   `Deployment frontend` con i nuovi tag immagine. Rolling update standard di
   Kubernetes (i pod nuovi devono passare la readiness probe prima che i vecchi
   vengano tolti).

> **Perché le migrazioni sono un Job separato e non nel comando del container**
> (come invece fa il `docker-compose` locale)? Con 2+ repliche del backend, se
> ogni pod facesse `alembic upgrade head` all'avvio avresti più processi che
> tentano lo stesso lock di migrazione in parallelo. Il Job gira **una volta
> sola**, in un pod dedicato, prima del rollout.

---

## 4. Il runtime nel cluster

Tutto nel namespace `automation-hub-dev`. Le manifest sono in `deploy/base/`
(comune) + `deploy/overlays/dev/` (specifico per dev: namespace, tag immagine,
patch della ConfigMap, patch dell'Ingress, Secret).

### Backend

- `Deployment` con **2 repliche**, immagine FastAPI, `uvicorn --workers 2
  --proxy-headers`.
- `--proxy-headers` è necessario perché dietro l'Ingress il traffico interno è
  HTTP; senza, l'app costruirebbe URL `http://` (redirect OIDC e cookie di
  sessione dell'admin si romperebbero). Con quella flag l'app si fida
  dell'header `X-Forwarded-Proto: https` messo dal load balancer.
- **Probe**: `readiness` su `/health/ready` (fa `SELECT 1` sul DB → il pod esce
  dal Service se il database non risponde), `liveness` su `/health` (solo
  "il processo è vivo").
- `Service` di tipo `ClusterIP` sulla porta `8000`.
- `BackendConfig` (CRD GKE) dice al load balancer di fare l'health check su
  `/health`.
- Configurazione via `envFrom`: una **ConfigMap** (`ENVIRONMENT`, `LOG_LEVEL`,
  `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `BOOTSTRAP_ADMIN_EMAILS`) e un **Secret**
  (`DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SECRET_KEY`).

### Database

Connessione **diretta all'IP privato** `172.23.201.26:5432` (Postgres 15
gestito). Niente Cloud SQL Auth Proxy, niente Workload Identity: il
`DATABASE_URL` nel Secret punta dritto all'IP. L'unico prerequisito di rete è
che i pod del namespace riescano a raggiungere quell'IP:porta (routing VPC /
firewall).

SQLAlchemy è già configurato con `pool_pre_ping=True`, quindi le connessioni
cadute vengono rilevate e riaperte da sole.

### Frontend

- `Deployment` con 2 repliche, immagine **nginx** che serve file statici sulla
  porta `8080` (immagine `nginx-unprivileged`, gira come utente non-root
  uid 101).
- `Service` `ClusterIP` sulla porta `8080`, con il suo `BackendConfig`
  (health check su `/`).
- **Nessuna** connessione al backend: il frontend è solo file statici. Vedi
  sezione 6.

### Ingress — un solo host, split per path

Un unico `Ingress` (`gce`) sull'host `automation-hub-dev.menarini.net`, con un
certificato gestito da Google (`ManagedCertificate`).

Le regole `pathType: Prefix` indirizzano:

| Path | Destinazione |
|------|--------------|
| `/api`, `/health`, `/admin`, `/docs`, `/openapi.json` | Service `backend:8000` |
| `/` (tutto il resto) | Service `frontend:8080` |

GKE risolve per prefisso più lungo, quindi i path del backend "vincono" su `/`.
Frontend e backend stanno sullo **stesso dominio** → nessun problema di CORS,
niente configurazione cross-origin.

### Sicurezza dei pod

Sia backend che frontend: `runAsNonRoot`, `readOnlyRootFilesystem: true` (con
`emptyDir` montati dove serve scrivere: `/tmp`, e per nginx anche
`/var/cache/nginx`), `capabilities: drop [ALL]`, `seccompProfile:
RuntimeDefault`.

### Il Secret in chiaro

`deploy/overlays/dev/secret.yaml` è committato **in chiaro** nel repo. Scelta
esplicita e limitata a dev: il repo è privato. Due conseguenze da tenere
presenti:

- la password del DB va **ruotata dopo il go-live** (resta nella storia git);
- **in produzione non si fa così**: si usa un `ExternalSecret` (External Secrets
  Operator) o Sealed Secrets legato a un secret store, tenendo nel repo solo un
  riferimento.

---

## 5. Perché due immagini e non una

Backend e frontend hanno cicli di vita, runtime e dipendenze completamente
diversi (Python/uvicorn vs. file statici/nginx). Immagini separate significano:
build indipendenti, deploy indipendenti, scaling indipendente, e superfici di
attacco minime (l'immagine frontend non contiene Python, quella backend non
contiene Node).

---

## 6. Il frontend e nginx — spiegazione a parole

Questa è la parte che in locale funziona "per magia" e che cambia in
produzione. Vale la pena capirla bene.

### Com'è in locale (docker-compose)

In locale il container `frontend` esegue `npm run dev`, cioè il **dev server di
Vite**. Il dev server fa **due** lavori insieme:

1. **serve l'app**: prende i sorgenti `.tsx`, li compila *al volo* a ogni
   richiesta, li manda al browser, e quando salvi un file ricarica la pagina
   (hot reload). Comodo per sviluppare, ma lento e non ottimizzato.
2. **fa da proxy**: le chiamate che il browser manda a `/api/...` e `/health`
   vengono inoltrate dal dev server al container backend
   (`http://backend:8000`). Questo è configurato in `vite.config.ts`, sezione
   `server.proxy`.

Quindi in locale il browser parla **solo** con il dev server di Vite, e Vite
smista.

### Perché in produzione non si usa `npm run dev`

Il dev server di Vite **non è un web server di produzione**: ricompila a ogni
richiesta, tiene aperto un websocket per l'hot reload, non gestisce cache,
compressione, header di sicurezza, e non è pensato per stare esposto a
internet. Serve per sviluppare, punto.

### Cosa si fa invece: build + nginx

**Passo 1 — build.** `vite build` (che nel nostro `package.json` è
`npm run build`, preceduto da `tsc -b` per il type-check) prende tutti i
sorgenti e produce una cartella `dist/` con:

- un `index.html`,
- uno o più file `.js` e `.css` **già compilati, minificati, con hash nel nome**
  (es. `assets/index-BCWaLYDF.js`).

Questi sono **file statici**: HTML, JavaScript e CSS puri. Nessun Node, nessuna
compilazione a runtime. Sono "morti" — vanno solo consegnati al browser così
come sono.

**Passo 2 — servirli.** Qualcuno deve rispondere alle richieste HTTP del
browser mandando quei file. Quel "qualcuno" è **nginx**: un web server leggero,
veloce, fatto apposta per servire file statici.

Il `Dockerfile` del frontend è **multi-stage** proprio per questo:

```
Stage 1  (node:20)        →  npm ci + npm run build  →  produce /app/dist
Stage 2  (nginx)          →  COPY --from=stage1 /app/dist  →  /usr/share/nginx/html
```

L'immagine finale che va in produzione contiene **solo nginx + la cartella
`dist/`**. Niente Node, niente `node_modules`, niente sorgenti. Pesa pochi MB.

### Cosa fa esattamente nginx (`frontend/nginx.conf`)

nginx qui fa **una cosa sola e mezza**:

1. **serve i file statici** dalla cartella `/usr/share/nginx/html`. Richiesta
   per `/assets/index-BCWaLYDF.js` → restituisce quel file, con header di cache
   lunga (tanto il nome ha l'hash: se cambia il contenuto cambia il nome).

2. **SPA fallback** — questa è la "mezza". Automation Hub è una *single-page
   application*: il routing (`/tickets`, `/ideas`, `/executive`, ...) è gestito
   da React **nel browser**, non dal server. Ma se l'utente è su `/tickets` e
   preme F5, il browser chiede al server `GET /tickets` — e sul disco non
   esiste nessun file `/tickets`. Senza accorgimenti, nginx risponderebbe 404.

   La regola:

   ```nginx
   location / {
       try_files $uri /index.html;
   }
   ```

   dice: "prova a servire il file richiesto; se non esiste, servi `index.html`".
   Così `/tickets` restituisce comunque `index.html`, l'app React parte, legge
   l'URL corrente e mostra la pagina Tickets. Vale anche per `/auth/callback`
   (la rotta dove Keycloak rimanda dopo il login).

### Cosa nginx **non** fa: il proxy verso `/api`

In locale Vite inoltrava `/api` al backend. **Qui no.** Nel cluster c'è
l'**Ingress** che fa lo split: `/api` (e `/health`, `/admin`, `/docs`) vanno
direttamente al Service del backend, `/` va a nginx. nginx del frontend non
vede mai una richiesta `/api` — non deve inoltrare niente, non ha bisogno di
sapere dove sta il backend.

Il codice del frontend chiama gli endpoint con path **relativi**
(`fetch('/api/v1/tickets')`), quindi funziona identico in locale e in cluster:
è sempre "stessa origine, path `/api`", cambia solo *chi* c'è dietro a smistare
(Vite in locale, Ingress nel cluster).

### La configurazione OIDC "cotta" nell'immagine

Ultimo punto. La config OIDC del frontend (`VITE_OIDC_AUTHORITY`,
`VITE_OIDC_CLIENT_ID`, `VITE_OIDC_REDIRECT_URI`) viene letta da
`import.meta.env.VITE_*` nel codice. Vite **incorpora questi valori nel bundle
JavaScript al momento della build** — non sono variabili d'ambiente che il
container legge all'avvio, sono stringhe scritte dentro il `.js`.

Conseguenza: **l'immagine frontend è specifica per ambiente**. Quella buildata
per `dev` ha dentro l'URL di Keycloak dev e il redirect
`https://automation-hub-dev.menarini.net/auth/callback`. Per questo la CI passa
quei valori come `--build-arg` al `buildah bud`, prendendoli dalle variabili
CI/CD di GitLab.

Per staging/prod servirà una build separata con i suoi valori (oppure, se si
vuole una sola immagine per tutti gli ambienti, si passa a un meccanismo di
"runtime config": un `env-config.js` generato all'avvio del container — non
fatto ora, era la seconda opzione valutata nello spec).

---

## 7. Riferimenti rapidi

| Cosa | Dove |
|------|------|
| Disegno completo e alternative valutate | `docs/superpowers/specs/2026-09-07-gke-dev-deploy-design.md` |
| Checklist di setup DevOps, variabili CI, verifica deploy | `docs/deploy.md` |
| Manifest kustomize | `deploy/base/`, `deploy/overlays/dev/` |
| Application Argo CD | `deploy/argocd/automation-hub-dev.yaml` |
| Pipeline | `.gitlab-ci.yml` |
