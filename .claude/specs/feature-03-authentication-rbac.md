# Feature 03 — Authentication & Role-Based Access (Keycloak / OIDC)

## Overview

Add Keycloak-backed sign-in to the Automation Hub and introduce application-level
roles.

- **Frontend**: submitting a new idea requires the user to be signed in. A
  reusable role guard is added for pages that need a specific role; a stub
  `process-economics` route is created behind it (the real editing page is built
  later, outside this feature).
- **Backend**: the `POST /api/v1/ideas` endpoint requires a valid token. A
  `GET /api/v1/me` endpoint reports the caller's identity and role. A reusable
  `require_role(...)` dependency is added and exported for future write
  endpoints.
- **Roles**: users are provisioned just-in-time on first authenticated request
  with the `user` role. An administrator promotes a user to `editor` (or
  `admin`) by editing the `role` field in SQLAdmin.
- SQLAdmin keeps its current standalone `admin` / `admin` session login,
  unchanged.

Keycloak authenticates only. The application database owns authorization
(roles). Keycloak roles/groups are **not** consulted.

## Identity provider

| Item | Value |
| --- | --- |
| Discovery | `https://keycloak.example.com/auth/realms/your-realm/.well-known/openid-configuration` |
| Issuer | `https://keycloak.example.com/auth/realms/your-realm` |
| Realm | `your-realm` |
| Client ID | `automation-hub` |
| Client type | Public, Authorization Code + PKCE (S256) |

The dev Keycloak is a shared remote instance. No Keycloak container is added to
`docker-compose.yml`. Local frontend development authenticates against the remote
dev realm.

### Keycloak client configuration (done by whoever administers the realm)

Only redirect/origin settings are needed — no protocol mappers.

- **Valid redirect URIs**: `http://localhost:5173/auth/callback` plus the
  deployed origin's `/auth/callback`.
- **Valid post-logout redirect URIs**: `http://localhost:5173/*` plus the
  deployed origin.
- **Web origins**: `http://localhost:5173` plus the deployed origin. Required for
  token-endpoint CORS and the silent-renew iframe.

Because an audience protocol mapper cannot be added, the backend validates the
`azp` (authorized party) claim rather than `aud`. For a public SPA client
Keycloak sets `azp` to the requesting client, so this reliably identifies tokens
issued to `automation-hub`. Upgrade path: if an audience mapper is added
later, also assert the client id appears in `aud`.

---

## Backend

### Dependencies

Add to `backend/pyproject.toml`:

- `pyjwt[crypto]` (pinned) — JWT verification and `PyJWKClient` (JWKS fetch +
  in-process key cache).

### Settings (`app/core/config.py`)

New fields, with development defaults, mirrored into `.env.example` and the
`backend` service environment in `docker-compose.yml`:

| Setting | Default | Purpose |
| --- | --- | --- |
| `oidc_issuer` | `https://keycloak.example.com/auth/realms/your-realm` | Expected `iss`; base for JWKS URL |
| `oidc_client_id` | `automation-hub` | Expected `azp` |
| `oidc_jwks_url` | `None` | Optional override; defaults to `{oidc_issuer}/protocol/openid-connect/certs` |
| `bootstrap_admin_emails` | `""` | Comma-separated emails auto-promoted to `admin` on provisioning |

### Token verification (`app/core/security.py`, new)

- Module-level `PyJWKClient` built from the resolved JWKS URL, with key caching.
- `TokenClaims` (pydantic model): `sub`, `email`, `preferred_username`, `name`,
  `given_name`, `family_name`. Only `sub` is required; the rest are optional.
- `decode_token(token: str) -> TokenClaims`:
  - Resolve the signing key from the token's `kid` via `PyJWKClient`.
  - `jwt.decode(..., algorithms=["RS256"], issuer=oidc_issuer,
    options={"verify_aud": False})` — verifies signature, `iss`, `exp`, `nbf`.
  - Assert `payload["azp"] == oidc_client_id` (fall back to "client id in `aud`"
    to stay forward-compatible with a future audience mapper).
  - On any failure raise `AuthError` (401) — a new subclass of the existing
    `AppError` in `app/core/exceptions.py`, so it flows through the existing
    exception handler. `WWW-Authenticate: Bearer` header included.

### User model (`app/models/auth.py`, new)

`AppUser`, table `app_user`, default (public) schema — consistent with
`app/models/item.py`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | int PK | |
| `sub` | `String(255)` | unique, indexed |
| `email` | `String(320)` | nullable, indexed |
| `preferred_username` | `String(255)` | nullable |
| `name` | `String(255)` | nullable |
| `given_name` | `String(255)` | nullable |
| `family_name` | `String(255)` | nullable |
| `role` | `String(20)` | not null, default `"user"`, server default `"user"`, `CHECK (role IN ('user','editor','admin'))` |
| `created_at` | `DateTime(timezone=True)` | `server_default=func.now()` |
| `updated_at` | `DateTime(timezone=True)` | `server_default=func.now()`, `onupdate=func.now()` |

`given_name` / `family_name` are populated from those claims; if either is absent
they are left as-is (no splitting of `name`). `name` stores the `name` claim
verbatim.

Register the class in `app/models/__init__.py` (import + `__all__`).

Alembic migration: `backend/alembic/versions/20260828_0017_create_app_user_table.py`
— create the table, the unique index on `sub`, the index on `email`, and the
check constraint.

### Role vocabulary

`user` < `editor` < `admin`. `admin` implicitly satisfies any lower requirement.
The set is a module-level constant in `app/core/security.py` (or a small
`app/core/roles.py`), reused by the dependency and the SQLAdmin form choices.

### Dependencies (`app/dependencies.py`)

- `bearer_scheme = HTTPBearer(auto_error=False)`.
- `get_current_user(credentials, session) -> AppUser`:
  1. No credentials → `AuthError` (401).
  2. `claims = decode_token(credentials.credentials)`.
  3. `SELECT ... WHERE sub = claims.sub`.
  4. Not found → insert a new `AppUser` with `role="user"` and the claim fields.
     On `IntegrityError` (concurrent first login) roll back and re-select.
  5. Found → compare the five profile fields; issue an `UPDATE` **only if at
     least one changed**.
  6. If `claims.email` is in `bootstrap_admin_emails` and `role != "admin"`, set
     `role = "admin"` (counts as a change).
  7. `commit()` only when something was written.
  8. Return the `AppUser`.
  - `CurrentUser = Annotated[AppUser, Depends(get_current_user)]`.
- `require_role(*allowed: str)` — factory returning a dependency that resolves
  `CurrentUser`, allows the request if `user.role in allowed or user.role ==
  "admin"`, else raises `AuthError` subclass `ForbiddenError` (403). Returns the
  `AppUser`.
  - `RequireEditor = Annotated[AppUser, Depends(require_role("editor"))]`,
    exported for future process-economics write endpoints.

### Endpoints

**`GET /api/v1/me`** — new module `app/api/v1/me.py`, mounted in
`app/api/v1/router.py`.

- Depends on `CurrentUser`.
- Response `MeRead`: `email`, `preferred_username`, `name`, `role`.
- 401 when unauthenticated.

**`POST /api/v1/ideas`** (`app/api/v1/ideas.py`)

- Add `user: CurrentUser` to `create_idea`.
- `IdeaCreate` (`app/schemas/idea.py`): **remove `submitter_name`**; remove it
  from the `strip_and_require` validator (now `title`-only).
- `IdeaService.create_idea(payload, submitter_name: str)` — new parameter. The
  route passes `user.name or user.preferred_username or user.email or "Unknown"`.
  The `Idea.submitter_name` column and all read schemas are unchanged.
- `GET /api/v1/ideas` and `GET /api/v1/ideas/{id}` stay public.

No stub process-economics endpoint is added on the backend. `RequireEditor` is
delivered as an exported dependency; the frontend stub route exercises the guard
end to end.

### SQLAdmin (`app/admin.py`)

`AppUser` is picked up automatically by `_model_views()`. Add overrides so the
view only exposes role assignment:

- `_FORM_COLUMNS_OVERRIDE["AppUser"] = ("role",)`.
- A `_view_overrides()` entry for `"AppUser"`:
  - `form_choices = {"role": [("user", "user"), ("editor", "editor"),
    ("admin", "admin")]}`
  - `can_create = False`, `can_delete = False`
  - `column_list = ["sub", "email", "preferred_username", "name", "role",
    "created_at"]`
  - `column_default_sort = ("created_at", True)`
  - `category = "Access"`

The existing `AdminAuth` username/password session backend is untouched.

---

## Frontend

### Dependencies

Add to `frontend/package.json`:

- `oidc-client-ts`
- `react-oidc-context`

### Environment

New `frontend/.env.example` (and documented for local `.env`):

| Var | Example | Notes |
| --- | --- | --- |
| `VITE_OIDC_AUTHORITY` | `https://keycloak.example.com/auth/realms/your-realm` | |
| `VITE_OIDC_CLIENT_ID` | `automation-hub` | |
| `VITE_OIDC_REDIRECT_URI` | `http://localhost:5173/auth/callback` | Optional; defaults to `${window.location.origin}/auth/callback` |

### Provider wiring (`src/main.tsx`)

Wrap `<App>` in `<AuthProvider>` from `react-oidc-context`:

- `authority`, `client_id` from the env vars.
- `redirect_uri` = configured value or `${origin}/auth/callback`.
- `response_type: "code"`, `scope: "openid profile email"` (PKCE is automatic).
- `userStore: new WebStorageStateStore({ store: window.sessionStorage })`.
- `automaticSilentRenew: true`.
- `onSigninCallback`: replace the URL with the stored `returnTo` (or `/`) and
  strip the `code`/`state` query params.

Provider order: `AuthProvider` outside `QueryClientProvider` and `BrowserRouter`
stay as they are.

### Auth bridge + API client

`src/api/client.ts`:

- Add `apiFetch(path, init?)` — wraps `fetch`, injects
  `Authorization: Bearer <token>` when a token is available, and on a `401`
  response triggers a re-login (`signinRedirect`) once.
- Token access is via a module-level getter set by an `<AuthBridge>` component
  (rendered inside `AuthProvider`) that reads `useAuth()` and registers both the
  token getter and the redirect callback. This keeps `client.ts` framework-free.
- `getJson` routes through `apiFetch`.

`src/api/ideas.ts`:

- `createIdea` uses `apiFetch`.
- `IdeaCreate` type: remove `submitter_name`.

`src/api/me.ts` (new): `fetchMe(): Promise<Me>` where
`Me = { email: string | null; preferred_username: string | null; name: string | null; role: 'user' | 'editor' | 'admin' }`.

`src/hooks/useMe.ts` (new): react-query wrapper around `fetchMe`, enabled only
when authenticated.

### Routes and guards

- `/auth/callback` route, rendered outside `<Layout>`: shows a spinner while
  `react-oidc-context` processes the code, then navigates to `returnTo`.
- `<RequireAuth>` (`src/components/auth/RequireAuth.tsx`): if `isLoading` →
  spinner; if not authenticated → `signinRedirect({ state: { returnTo:
  location.pathname } })` and render nothing; else render `children` /
  `<Outlet/>`.
- `<RequireRole role="editor">` (`src/components/auth/RequireRole.tsx`): renders
  inside `RequireAuth`; uses `useMe()`; while loading → spinner; if
  `me.role` is not the required role or `admin` → an "You don't have access —
  ask an administrator to grant you the <role> role" panel; else render
  children.
- `src/App.tsx` route changes:
  - `ideas/new` wrapped in `<RequireAuth>`.
  - New `process-economics` route wrapped in
    `<RequireRole role="editor">`, rendering a stub page
    (`src/pages/ProcessEconomicsPage.tsx`) — heading + "Coming soon" placeholder.
  - `/auth/callback` added as a sibling of the `<Layout>` route.

### Idea wizard

- `src/components/wizard/Step1BasicInfo.tsx`: remove the "Submitter name"
  `TextField`. Optionally render a static "Submitting as {name}" line from
  `useAuth().user?.profile`.
- `src/components/wizard/types.ts`: remove `submitterName` from `WizardState`
  and `INITIAL_WIZARD_STATE`; `isStepValid` step 1 becomes
  `isNonEmpty(state.title)`; `toIdeaCreate` drops `submitter_name`.
- No change to `IdeaWizardPage.tsx` beyond what the type changes force.

### Header (`src/components/Layout.tsx`)

Add an auth control on the right of the nav: when authenticated, show the user's
name (or `preferred_username`) and a "Sign out" button (`removeUser()` +
`signoutRedirect()`); when not, a "Sign in" button (`signinRedirect()`).

---

## Explicitly out of scope

- Authentication on the existing `/api/v1/admin/*` ingestion endpoints — left
  unauthenticated, unchanged.
- The real process-economics editing UI and its CRUD endpoints.
- Making the Process / ProcessEconomics SQLAdmin views read-only (happens when
  the frontend editor is built).
- A local Keycloak container — the remote dev realm is used.
- End-to-end (Playwright) coverage of authenticated flows. Existing e2e for
  public pages is expected to keep working; if any e2e touches `ideas/new` it is
  adjusted to skip or is marked pending.
- Automated tests of any kind (unit / integration / component) — per explicit
  instruction. Auth paths are verified manually against the dev realm.

## Risks and notes

- **`azp` instead of `aud`** — acceptable for a single public client; documented
  upgrade path via an audience mapper.
- **Remote dev Keycloak** — required for local frontend development; if
  unavailable, sign-in cannot be exercised locally.
- **Provisioning writes on GET** — mitigated by writing only when a profile
  field or role actually changed.
- **Silent renew** — depends on the Keycloak "Web origins" entry; without it the
  library falls back to redirect-based renewal.
- **sessionStorage tokens** — readable by JavaScript (XSS exposure), accepted for
  this internal tool per the design decision.
- **No tests** — regressions in token verification, provisioning, role checks,
  and the route guards will not be caught automatically.
