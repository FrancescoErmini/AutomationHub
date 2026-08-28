# Authentication & Role-Based Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Keycloak/OIDC sign-in to the Automation Hub, require authentication to submit ideas, and add application-owned roles (`user` / `editor` / `admin`) enforced in the API and the SPA.

**Architecture:** Keycloak authenticates only; the app database (`app_user` table) owns roles. The SPA uses the Authorization Code + PKCE flow via `react-oidc-context`, stores tokens in `sessionStorage`, and sends the access token as a bearer to the API. FastAPI verifies the JWT signature against the realm JWKS, provisions an `AppUser` row just-in-time on first authenticated request (role `user`), and exposes a `require_role(...)` dependency. An administrator promotes users via a restricted SQLAdmin view.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, SQLAdmin, PyJWT; React 18, Vite, react-router 7, TanStack Query, `oidc-client-ts` + `react-oidc-context`.

**Spec:** `.claude/specs/feature-03-authentication-rbac.md`

## Global Constraints

- **No automated tests.** Per explicit instruction, do not add unit/integration/component/e2e tests or test infrastructure. Existing tests must still compile and pass — make the minimum edit needed to keep them green, adding no new coverage.
- **Backend Python:** `>=3.12`. Follow existing patterns: `Annotated[... , Depends(...)]` dependency aliases in `app/dependencies.py`; exceptions subclass `AppError` in `app/core/exceptions.py`; models under `app/models/`, registered in `app/models/__init__.py`; one Alembic revision per schema change in `backend/alembic/versions/`.
- **Backend lint/type:** `ruff check .`, `ruff format --check .`, `mypy app` must pass (run from `backend/`). Line length 100.
- **Frontend:** `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test` must pass (run from `frontend/`). Prettier-formatted, single quotes, no semicolons.
- **OIDC values (verbatim):** issuer `https://keycloak-dev.menarini.net/auth/realms/menarini`; realm `menarini`; client id `mg-app_AutomationHub`; public client, Authorization Code + PKCE.
- **Audience:** validate the `azp` claim equals `mg-app_AutomationHub` (accept also client id present in `aud`). Do not require an `aud` protocol mapper.
- **Role vocabulary:** `user`, `editor`, `admin`. `admin` implicitly satisfies any lower requirement.
- **Commits:** frequent, one per task minimum, on branch `feature/03-authentication-rbac`. End commit messages with the repo's `Co-Authored-By` / `Claude-Session` trailers.
- **Out of scope:** auth on `/api/v1/admin/*`; the real process-economics UI/CRUD; making Process/ProcessEconomics SQLAdmin views read-only; a local Keycloak container.

---

## File Structure

**Backend — created**
- `backend/app/core/security.py` — JWT verification, `TokenClaims`, role constant.
- `backend/app/models/auth.py` — `AppUser` model.
- `backend/app/api/v1/me.py` — `GET /api/v1/me`.
- `backend/alembic/versions/20260828_0017_create_app_user_table.py` — table migration.

**Backend — modified**
- `backend/app/core/config.py` — OIDC settings.
- `backend/app/core/exceptions.py` — `AuthError` (401), `ForbiddenError` (403).
- `backend/app/models/__init__.py` — register `AppUser`.
- `backend/app/dependencies.py` — `get_current_user`, `require_role`, `CurrentUser`, `RequireEditor`.
- `backend/app/api/v1/router.py` — mount `me` router.
- `backend/app/api/v1/ideas.py` — require auth on POST, derive submitter name.
- `backend/app/schemas/idea.py` — drop `submitter_name`.
- `backend/app/services/ideas.py` — `create_idea` takes `submitter_name`.
- `backend/app/admin.py` — restricted `AppUser` view.
- `backend/pyproject.toml` — add `pyjwt[crypto]`.
- `.env.example`, `docker-compose.yml` — OIDC env vars.

**Frontend — created**
- `frontend/src/auth/oidcConfig.ts` — `AuthProvider` configuration.
- `frontend/src/auth/AuthBridge.tsx` — wires token + 401 handler into the API client.
- `frontend/src/components/auth/RequireAuth.tsx` — auth route guard.
- `frontend/src/components/auth/RequireRole.tsx` — role route guard.
- `frontend/src/pages/AuthCallbackPage.tsx` — OIDC redirect landing.
- `frontend/src/pages/ProcessEconomicsPage.tsx` — stub page behind the editor guard.
- `frontend/src/api/me.ts` — `fetchMe`.
- `frontend/src/hooks/useMe.ts` — `useMe` query hook.
- `frontend/.env.example` — `VITE_OIDC_*`.

**Frontend — modified**
- `frontend/package.json` — add `oidc-client-ts`, `react-oidc-context`.
- `frontend/src/main.tsx` — wrap in `AuthProvider` + `AuthBridge`.
- `frontend/src/api/client.ts` — `apiFetch`, `configureApiAuth`.
- `frontend/src/api/ideas.ts` — use `apiFetch`, drop `submitter_name` from `IdeaCreate`.
- `frontend/src/App.tsx` — callback route + guarded routes.
- `frontend/src/components/Layout.tsx` — sign in / sign out control.
- `frontend/src/components/wizard/types.ts` — drop `submitterName`.
- `frontend/src/components/wizard/Step1BasicInfo.tsx` — drop submitter field.
- `frontend/src/components/wizard/Step8Review.tsx` — drop submitter summary row.
- `frontend/src/pages/IdeaWizardPage.test.tsx` — drop submitter interactions (keep green).

---

## Task 1: Backend OIDC settings and auth exceptions

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/core/exceptions.py`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `Settings.oidc_issuer: str`, `Settings.oidc_client_id: str`, `Settings.oidc_jwks_url: str | None`, `Settings.bootstrap_admin_emails: str`; exceptions `AuthError` (status 401, code `unauthorized`), `ForbiddenError` (status 403, code `forbidden`).

- [ ] **Step 1: Add settings fields**

In `backend/app/core/config.py`, inside `class Settings`, after the `admin_secret_key` line:

```python
    oidc_issuer: str = "https://keycloak-dev.menarini.net/auth/realms/menarini"
    oidc_client_id: str = "mg-app_AutomationHub"
    oidc_jwks_url: str | None = None
    bootstrap_admin_emails: str = ""
```

- [ ] **Step 2: Add exception classes**

Append to `backend/app/core/exceptions.py`:

```python
class AuthError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
```

- [ ] **Step 3: Document env vars**

Append to `.env.example`:

```bash
OIDC_ISSUER=https://keycloak-dev.menarini.net/auth/realms/menarini
OIDC_CLIENT_ID=mg-app_AutomationHub
BOOTSTRAP_ADMIN_EMAILS=
```

In `docker-compose.yml`, under `services.backend.environment`, add:

```yaml
      OIDC_ISSUER: ${OIDC_ISSUER:-https://keycloak-dev.menarini.net/auth/realms/menarini}
      OIDC_CLIENT_ID: ${OIDC_CLIENT_ID:-mg-app_AutomationHub}
      BOOTSTRAP_ADMIN_EMAILS: ${BOOTSTRAP_ADMIN_EMAILS:-}
```

- [ ] **Step 4: Verify**

Run from `backend/`:

```bash
python -c "from app.core.config import get_settings; s=get_settings(); print(s.oidc_issuer, s.oidc_client_id, s.bootstrap_admin_emails!r)"
python -c "from app.core.exceptions import AuthError, ForbiddenError; print(AuthError().status_code, ForbiddenError().status_code)"
ruff check . && ruff format --check .
```

Expected: prints the issuer/client id and `''`, then `401 403`; lint clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/app/core/exceptions.py .env.example docker-compose.yml
git commit -m "feat(auth): add OIDC settings and auth exceptions"
```

---

## Task 2: JWT verification module

**Files:**
- Create: `backend/app/core/security.py`
- Modify: `backend/pyproject.toml`

**Interfaces:**
- Consumes: `Settings.oidc_issuer`, `Settings.oidc_client_id`, `Settings.oidc_jwks_url`; `AuthError`.
- Produces:
  - `ROLES: tuple[str, str, str]` = `("user", "editor", "admin")`
  - `class TokenClaims(BaseModel)` with `sub: str`, and `email/preferred_username/name/given_name/family_name: str | None`
  - `decode_token(token: str) -> TokenClaims` — raises `AuthError` on any invalid/expired/foreign token.

- [ ] **Step 1: Add the dependency**

In `backend/pyproject.toml`, add to `[project].dependencies` (keep alphabetical-ish, after `psycopg`):

```toml
  "pyjwt[crypto]==2.10.1",
```

Install into the environment:

```bash
cd backend && pip install -e ".[dev]"
```

- [ ] **Step 2: Create the module**

Create `backend/app/core/security.py`:

```python
"""OIDC access-token verification against the Keycloak realm JWKS.

Keycloak authenticates; the application database owns roles. This module only
answers "is this a valid, unexpired token issued by our realm for our client,
and who does it identify?".
"""

from __future__ import annotations

import jwt
from jwt import PyJWKClient, PyJWTError
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.exceptions import AuthError

ROLES: tuple[str, str, str] = ("user", "editor", "admin")


class TokenClaims(BaseModel):
    sub: str
    email: str | None = None
    preferred_username: str | None = None
    name: str | None = None
    given_name: str | None = None
    family_name: str | None = None


_jwks_client: PyJWKClient | None = None


def _client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        url = (
            settings.oidc_jwks_url
            or f"{settings.oidc_issuer}/protocol/openid-connect/certs"
        )
        _jwks_client = PyJWKClient(url, cache_jwk_set=True, lifespan=300)
    return _jwks_client


def decode_token(token: str) -> TokenClaims:
    settings = get_settings()
    try:
        signing_key = _client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.oidc_issuer,
            options={"verify_aud": False, "require": ["exp", "iss", "sub"]},
        )
    except PyJWTError as exc:
        raise AuthError(f"Invalid token: {exc}") from exc

    audience = payload.get("aud")
    aud_list = [audience] if isinstance(audience, str) else list(audience or [])
    if payload.get("azp") != settings.oidc_client_id and settings.oidc_client_id not in aud_list:
        raise AuthError("Token was not issued for this application")

    return TokenClaims(
        sub=payload["sub"],
        email=payload.get("email"),
        preferred_username=payload.get("preferred_username"),
        name=payload.get("name"),
        given_name=payload.get("given_name"),
        family_name=payload.get("family_name"),
    )
```

- [ ] **Step 3: Verify**

Run from `backend/`:

```bash
python -c "import app.core.security as s; print(s.ROLES); print(s.TokenClaims(sub='x'))"
python -c "from app.core.security import decode_token; \
try:\n  decode_token('not-a-jwt')\nexcept Exception as e:\n  print(type(e).__name__, e)"
ruff check . && ruff format --check . && mypy app
```

Expected: prints `('user', 'editor', 'admin')` and a `TokenClaims`; the bad token prints `AuthError ...`; lint and types clean.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/app/core/security.py
git commit -m "feat(auth): add JWT verification against realm JWKS"
```

---

## Task 3: AppUser model and migration

**Files:**
- Create: `backend/app/models/auth.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/20260828_0017_create_app_user_table.py`

**Interfaces:**
- Produces: `AppUser` mapped class (table `app_user`, public schema) with columns `id, sub, email, preferred_username, name, given_name, family_name, role, created_at, updated_at`.

- [ ] **Step 1: Create the model**

Create `backend/app/models/auth.py`:

```python
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppUser(Base):
    """A person who has signed in via Keycloak. Provisioned just-in-time on the
    first authenticated request with role ``user``; an administrator promotes to
    ``editor`` / ``admin`` via SQLAdmin. Keycloak owns identity, this table owns
    the application role."""

    __tablename__ = "app_user"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'editor', 'admin')", name="ck_app_user_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(320), index=True, nullable=True)
    preferred_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    given_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    family_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user", server_default="user")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 2: Register the model**

In `backend/app/models/__init__.py`:
- Add `from app.models.auth import AppUser` (near the `from app.models.item import Item` line).
- Add `"AppUser",` to `__all__` (keep sorted).

- [ ] **Step 3: Confirm the current migration head**

```bash
cd backend && alembic heads
```

Note the printed revision. It should be `20260825_0016`. Use it as `down_revision` below; if it differs, use the actual value.

- [ ] **Step 4: Create the migration**

Create `backend/alembic/versions/20260828_0017_create_app_user_table.py`:

```python
"""create app_user table

Revision ID: 20260828_0017
Revises: 20260825_0016
Create Date: 2026-08-28 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260828_0017"
down_revision: str | None = "20260825_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sub", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("preferred_username", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("given_name", sa.String(length=255), nullable=True),
        sa.Column("family_name", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("role IN ('user', 'editor', 'admin')", name="ck_app_user_role"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_app_user_sub"), "app_user", ["sub"], unique=True)
    op.create_index(op.f("ix_app_user_email"), "app_user", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_app_user_email"), table_name="app_user")
    op.drop_index(op.f("ix_app_user_sub"), table_name="app_user")
    op.drop_table("app_user")
```

- [ ] **Step 5: Verify**

```bash
cd backend
docker compose -f ../docker-compose.yml up -d postgres
alembic upgrade head
alembic check
python -c "from app.models import AppUser; print(AppUser.__tablename__, [c.name for c in AppUser.__table__.columns])"
ruff check . && ruff format --check . && mypy app
```

Expected: `alembic upgrade head` runs `20260828_0017`; `alembic check` reports no new autogenerated changes; the column list prints; lint/types clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/auth.py backend/app/models/__init__.py backend/alembic/versions/20260828_0017_create_app_user_table.py
git commit -m "feat(auth): add app_user table and model"
```

---

## Task 4: Auth dependencies (current user + role guard)

**Files:**
- Modify: `backend/app/dependencies.py`

**Interfaces:**
- Consumes: `decode_token`, `TokenClaims` from `app.core.security`; `AppUser`; `AuthError`, `ForbiddenError`; `Settings.bootstrap_admin_emails`; `DbSession`.
- Produces:
  - `get_current_user(credentials, session) -> AppUser`
  - `require_role(*allowed: str) -> Callable[..., AppUser]`
  - `CurrentUser = Annotated[AppUser, Depends(get_current_user)]`
  - `RequireEditor = Annotated[AppUser, Depends(require_role("editor"))]`

- [ ] **Step 1: Add imports**

At the top of `backend/app/dependencies.py` add:

```python
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import AuthError, ForbiddenError
from app.core.security import TokenClaims, decode_token
from app.models.auth import AppUser
```

- [ ] **Step 2: Add the provisioning + guard code**

Append to `backend/app/dependencies.py`:

```python
bearer_scheme = HTTPBearer(auto_error=False)

_PROFILE_FIELDS = ("email", "preferred_username", "name", "given_name", "family_name")


def _bootstrap_admin_emails() -> set[str]:
    raw = get_settings().bootstrap_admin_emails
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def _sync_profile(user: AppUser, claims: TokenClaims) -> bool:
    changed = False
    for field in _PROFILE_FIELDS:
        new_value = getattr(claims, field)
        if new_value is not None and getattr(user, field) != new_value:
            setattr(user, field, new_value)
            changed = True
    return changed


def _maybe_promote(user: AppUser, email: str | None) -> bool:
    if email and email.lower() in _bootstrap_admin_emails() and user.role != "admin":
        user.role = "admin"
        return True
    return False


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: DbSession,
) -> AppUser:
    if credentials is None:
        raise AuthError("Missing bearer token")
    claims = decode_token(credentials.credentials)

    user = session.scalar(select(AppUser).where(AppUser.sub == claims.sub))
    if user is None:
        user = AppUser(
            sub=claims.sub,
            email=claims.email,
            preferred_username=claims.preferred_username,
            name=claims.name,
            given_name=claims.given_name,
            family_name=claims.family_name,
            role="user",
        )
        _maybe_promote(user, claims.email)
        session.add(user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            user = session.scalar(select(AppUser).where(AppUser.sub == claims.sub))
            if user is None:
                raise
        else:
            session.refresh(user)
            return user

    changed = _sync_profile(user, claims)
    changed = _maybe_promote(user, claims.email) or changed
    if changed:
        session.commit()
        session.refresh(user)
    return user


CurrentUser = Annotated[AppUser, Depends(get_current_user)]


def require_role(*allowed: str) -> Callable[..., AppUser]:
    def dependency(user: CurrentUser) -> AppUser:
        if user.role == "admin" or user.role in allowed:
            return user
        raise ForbiddenError(f"Requires role: {' or '.join(allowed)}")

    return dependency


RequireEditor = Annotated[AppUser, Depends(require_role("editor"))]
```

Add `from collections.abc import Callable` to the imports if not already present (the file currently imports from `pathlib` and `typing`; add the `collections.abc` import line).

- [ ] **Step 3: Verify**

```bash
cd backend
python -c "from app.dependencies import get_current_user, require_role, CurrentUser, RequireEditor; print('ok')"
python -c "from app.dependencies import _bootstrap_admin_emails; print(_bootstrap_admin_emails())"
ruff check . && ruff format --check . && mypy app
```

Expected: prints `ok` then `set()`; lint/types clean.

- [ ] **Step 4: Commit**

```bash
git add backend/app/dependencies.py
git commit -m "feat(auth): current-user provisioning and require_role dependency"
```

---

## Task 5: GET /api/v1/me endpoint

**Files:**
- Create: `backend/app/api/v1/me.py`
- Modify: `backend/app/api/v1/router.py`

**Interfaces:**
- Consumes: `CurrentUser` from `app.dependencies`.
- Produces: `GET /api/v1/me` → `{"email": str|null, "preferred_username": str|null, "name": str|null, "role": str}`; 401 when unauthenticated.

- [ ] **Step 1: Create the router**

Create `backend/app/api/v1/me.py`:

```python
from fastapi import APIRouter
from pydantic import BaseModel

from app.dependencies import CurrentUser

router = APIRouter(tags=["me"])


class MeRead(BaseModel):
    email: str | None
    preferred_username: str | None
    name: str | None
    role: str


@router.get("/me", response_model=MeRead)
def read_me(user: CurrentUser) -> MeRead:
    return MeRead(
        email=user.email,
        preferred_username=user.preferred_username,
        name=user.name,
        role=user.role,
    )
```

- [ ] **Step 2: Mount it**

In `backend/app/api/v1/router.py`:
- Add `me` to the `from app.api.v1 import (...)` tuple (keep sorted).
- Add `router.include_router(me.router)` next to the other `include_router` calls.

- [ ] **Step 3: Verify**

```bash
cd backend
uvicorn app.main:app --port 8000 &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/v1/me          # expect 401
curl -s -H "Authorization: Bearer bogus" -w "\n%{http_code}\n" http://localhost:8000/api/v1/me  # expect 401 + error json
kill %1
ruff check . && ruff format --check . && mypy app
```

Expected: `401` for both; JSON body `{"error":{"code":"unauthorized",...}}`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/me.py backend/app/api/v1/router.py
git commit -m "feat(auth): add GET /api/v1/me"
```

---

## Task 6: Require auth on idea submission; drop client submitter_name

**Files:**
- Modify: `backend/app/schemas/idea.py`
- Modify: `backend/app/services/ideas.py:82` (the `create_idea` method)
- Modify: `backend/app/api/v1/ideas.py`

**Interfaces:**
- Consumes: `CurrentUser`.
- Produces: `IdeaService.create_idea(payload: IdeaCreate, submitter_name: str) -> dict[str, Any]`; `POST /api/v1/ideas` now requires a valid token and 401s without one. `IdeaCreate` no longer has `submitter_name`. `Idea.submitter_name` column, `IdeaRead`, and `IdeaDetail` are unchanged.

- [ ] **Step 1: Update the schema**

In `backend/app/schemas/idea.py`:
- Delete the line `    submitter_name: str = Field(min_length=1, max_length=200)`.
- Change `@field_validator("title", "submitter_name")` to `@field_validator("title")`.

Leave `IdeaRead.submitter_name` and everything else as-is.

- [ ] **Step 2: Update the service**

In `backend/app/services/ideas.py`, change the method signature:

```python
    def create_idea(self, payload: IdeaCreate, submitter_name: str) -> dict[str, Any]:
```

and change the `Idea(...)` construction line `submitter_name=payload.submitter_name,` to:

```python
            submitter_name=submitter_name,
```

- [ ] **Step 3: Update the endpoint**

In `backend/app/api/v1/ideas.py`:
- Change the import to `from app.dependencies import CurrentUser, IdeaServiceDependency`.
- Replace `create_idea` with:

```python
@router.post("", response_model=IdeaDetail, status_code=status.HTTP_201_CREATED)
def create_idea(
    payload: IdeaCreate, service: IdeaServiceDependency, user: CurrentUser
) -> IdeaDetail:
    submitter_name = user.name or user.preferred_username or user.email or "Unknown"
    return IdeaDetail(**service.create_idea(payload, submitter_name))
```

- [ ] **Step 4: Verify**

```bash
cd backend
uvicorn app.main:app --port 8000 &
sleep 2
curl -s -X POST http://localhost:8000/api/v1/ideas -H 'Content-Type: application/json' -d '{}' -w "\n%{http_code}\n"  # expect 401
curl -s http://localhost:8000/api/v1/ideas -w "\n%{http_code}\n"  # GET still 200
kill %1
ruff check . && ruff format --check . && mypy app
```

Expected: POST → `401`; GET → `200`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/idea.py backend/app/services/ideas.py backend/app/api/v1/ideas.py
git commit -m "feat(auth): require sign-in to submit an idea; derive submitter from token"
```

---

## Task 7: Restricted AppUser view in SQLAdmin

**Files:**
- Modify: `backend/app/admin.py:56` (`_FORM_COLUMNS_OVERRIDE`) and `_view_overrides()` (around `:281`-`:370`)

**Interfaces:**
- Produces: an `App User` admin view under category `Access`; only `role` is editable (dropdown `user`/`editor`/`admin`); no create/delete.

- [ ] **Step 1: Restrict the edit form**

In `backend/app/admin.py`, change `_FORM_COLUMNS_OVERRIDE` to:

```python
_FORM_COLUMNS_OVERRIDE: dict[str, tuple[str, ...]] = {
    "Idea": ("status",),
    "AppUser": ("role",),
}
```

- [ ] **Step 2: Add the view overrides**

In `_view_overrides()`, add a key to the returned dict (alongside `"Ticket"`, `"Process"`, ...):

```python
        "AppUser": {
            "column_list": [
                "sub",
                "email",
                "preferred_username",
                "name",
                "role",
                "created_at",
            ],
            "column_default_sort": ("created_at", True),
            "can_create": False,
            "can_delete": False,
            "form_choices": {
                "role": [("user", "user"), ("editor", "editor"), ("admin", "admin")]
            },
            "category": "Access",
        },
```

- [ ] **Step 3: Verify**

```bash
cd backend
alembic upgrade head
uvicorn app.main:app --port 8000 &
sleep 2
# log in at http://localhost:8000/admin with admin / admin
kill %1
ruff check . && ruff format --check . && mypy app
```

Then manually in a browser: open `http://localhost:8000/admin`, log in `admin` / `admin`, confirm an **App User** entry under the **Access** group, open it — the list shows sub/email/username/name/role/created; the edit form shows only a **role** dropdown; there is no "New App User" button and no row delete.

- [ ] **Step 4: Commit**

```bash
git add backend/app/admin.py
git commit -m "feat(auth): restricted AppUser role-assignment view in SQLAdmin"
```

---

## Task 8: Frontend OIDC provider, callback route, env

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/.env.example`
- Create: `frontend/src/auth/oidcConfig.ts`
- Create: `frontend/src/pages/AuthCallbackPage.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `oidcConfig` (an `AuthProviderProps`); `<AuthCallbackPage />`; a top-level `/auth/callback` route; the app tree wrapped in `<AuthProvider>`.

- [ ] **Step 1: Add dependencies**

```bash
cd frontend && npm install oidc-client-ts react-oidc-context
```

(Let npm resolve current 3.x versions and write the lockfile.)

- [ ] **Step 2: Env example**

Create `frontend/.env.example`:

```bash
VITE_OIDC_AUTHORITY=https://keycloak-dev.menarini.net/auth/realms/menarini
VITE_OIDC_CLIENT_ID=mg-app_AutomationHub
# Optional; defaults to <origin>/auth/callback
VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
```

Add the same three keys to your local `frontend/.env`.

- [ ] **Step 3: OIDC config**

Create `frontend/src/auth/oidcConfig.ts`:

```ts
import { WebStorageStateStore } from 'oidc-client-ts'
import type { AuthProviderProps } from 'react-oidc-context'

const redirectUri =
  (import.meta.env.VITE_OIDC_REDIRECT_URI as string | undefined) ??
  `${window.location.origin}/auth/callback`

export const oidcConfig: AuthProviderProps = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY as string,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID as string,
  redirect_uri: redirectUri,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: true,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}
```

- [ ] **Step 4: Callback page**

Create `frontend/src/pages/AuthCallbackPage.tsx`:

```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export function AuthCallbackPage() {
  const auth = useAuth()

  if (auth.isLoading) {
    return <div className="p-12 text-center text-slate-600">Signing in…</div>
  }
  if (auth.error) {
    return (
      <div className="p-12 text-center text-red-700">
        Sign-in failed: {auth.error.message}
      </div>
    )
  }
  const returnTo =
    (auth.user?.state as { returnTo?: string } | undefined)?.returnTo ?? '/'
  return <Navigate to={returnTo} replace />
}
```

- [ ] **Step 5: Wrap the app**

Rewrite `frontend/src/main.tsx` to:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from 'react-oidc-context'

import { App } from './App'
import { AuthBridge } from './auth/AuthBridge'
import { oidcConfig } from './auth/oidcConfig'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthBridge>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthBridge>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
)
```

(`AuthBridge` is created in Task 9. Until then this import fails — build/typecheck for Task 8 is deferred to the end of Task 9. Commit at the end of this task anyway so the tasks stay reviewable, or squash Tasks 8–9 if executing inline.)

- [ ] **Step 6: Callback route**

In `frontend/src/App.tsx`:
- Import `AuthCallbackPage`.
- Add as the first child inside `<Routes>`, before the `<Route element={<Layout />}>`:

```tsx
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
```

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.env.example frontend/src/auth/oidcConfig.ts frontend/src/pages/AuthCallbackPage.tsx frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat(auth): add OIDC provider and /auth/callback route"
```

---

## Task 9: API client bearer injection + auth bridge

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/auth/AuthBridge.tsx`
- Modify: `frontend/src/api/ideas.ts`

**Interfaces:**
- Consumes: `useAuth()` from `react-oidc-context`.
- Produces:
  - `apiFetch(path: string, init?: RequestInit) => Promise<Response>` — adds `Authorization: Bearer` when a token is set, calls the 401 handler on 401.
  - `configureApiAuth(opts: { getToken: () => string | undefined; onUnauthorized: () => void }) => void`
  - `<AuthBridge>` — registers the token getter + 401 handler; renders children.

- [ ] **Step 1: Extend the API client**

Rewrite `frontend/src/api/client.ts` to:

```ts
let getToken: () => string | undefined = () => undefined
let onUnauthorized: () => void = () => {}

export function configureApiAuth(opts: {
  getToken: () => string | undefined
  onUnauthorized: () => void
}): void {
  getToken = opts.getToken
  onUnauthorized = opts.onUnauthorized
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, { ...init, headers })
  if (response.status === 401) onUnauthorized()
  return response
}

export async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string }
      detail?: string
    } | null
    throw new Error(
      body?.error?.message ??
        body?.detail ??
        `Request failed (${response.status})`,
    )
  }
  return (await response.json()) as T
}

export async function getJson<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return parseResponse<T>(await apiFetch(query ? `${path}?${query}` : path))
}
```

- [ ] **Step 2: Auth bridge**

Create `frontend/src/auth/AuthBridge.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'

import { configureApiAuth } from '../api/client'

export function AuthBridge({ children }: { children: ReactNode }) {
  const auth = useAuth()

  useEffect(() => {
    configureApiAuth({
      getToken: () => auth.user?.access_token,
      onUnauthorized: () => {
        if (!auth.isLoading && !auth.activeNavigator) {
          void auth.signinRedirect({
            state: { returnTo: window.location.pathname },
          })
        }
      },
    })
  }, [auth])

  return <>{children}</>
}
```

- [ ] **Step 3: Point idea calls at apiFetch**

In `frontend/src/api/ideas.ts`:
- Change the import to `import { apiFetch, getJson, parseResponse } from './client'`.
- In `createIdea`, replace `await fetch('/api/v1/ideas', {` with `await apiFetch('/api/v1/ideas', {`.
- In `interface IdeaCreate`, delete the line `  submitter_name: string`.

- [ ] **Step 4: Verify**

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

Expected: all pass. (`IdeaCreate` losing `submitter_name` will surface type errors in `wizard/types.ts` — those are fixed in Task 11. If executing strictly task-by-task, expect `typecheck` to fail here on `toIdeaCreate`; proceed and it goes green after Task 11. If executing inline, do Task 11 before verifying.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/auth/AuthBridge.tsx frontend/src/api/ideas.ts
git commit -m "feat(auth): inject bearer token into API calls"
```

---

## Task 10: me API module and useMe hook

**Files:**
- Create: `frontend/src/api/me.ts`
- Create: `frontend/src/hooks/useMe.ts`

**Interfaces:**
- Produces:
  - `interface Me { email: string | null; preferred_username: string | null; name: string | null; role: 'user' | 'editor' | 'admin' }`
  - `fetchMe(): Promise<Me>`
  - `useMe(): UseQueryResult<Me>` — enabled only when authenticated.

- [ ] **Step 1: API module**

Create `frontend/src/api/me.ts`:

```ts
import { apiFetch, parseResponse } from './client'

export type Role = 'user' | 'editor' | 'admin'

export interface Me {
  email: string | null
  preferred_username: string | null
  name: string | null
  role: Role
}

export async function fetchMe(): Promise<Me> {
  return parseResponse<Me>(await apiFetch('/api/v1/me'))
}
```

- [ ] **Step 2: Hook**

Create `frontend/src/hooks/useMe.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'

import { fetchMe } from '../api/me'

export function useMe() {
  const auth = useAuth()
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: auth.isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/me.ts frontend/src/hooks/useMe.ts
git commit -m "feat(auth): add /api/v1/me client and useMe hook"
```

---

## Task 11: Route guards, wizard cleanup, header control, stub page

**Files:**
- Create: `frontend/src/components/auth/RequireAuth.tsx`
- Create: `frontend/src/components/auth/RequireRole.tsx`
- Create: `frontend/src/pages/ProcessEconomicsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/components/wizard/types.ts`
- Modify: `frontend/src/components/wizard/Step1BasicInfo.tsx`
- Modify: `frontend/src/components/wizard/Step8Review.tsx`
- Modify: `frontend/src/pages/IdeaWizardPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useMe()`.
- Produces: `<RequireAuth />` and `<RequireRole role="editor" | "admin" />` (both render `<Outlet />`); `/ideas/new` behind `RequireAuth`; `/process-economics` behind `RequireRole role="editor"`.

- [ ] **Step 1: RequireAuth**

Create `frontend/src/components/auth/RequireAuth.tsx`:

```tsx
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator) {
      void auth.signinRedirect({ state: { returnTo: location.pathname } })
    }
  }, [auth, location.pathname])

  if (auth.isAuthenticated) return <Outlet />
  return <div className="p-12 text-center text-slate-600">Signing in…</div>
}
```

- [ ] **Step 2: RequireRole**

Create `frontend/src/components/auth/RequireRole.tsx`:

```tsx
import { Outlet } from 'react-router-dom'

import { useMe } from '../../hooks/useMe'
import type { Role } from '../../api/me'
import { RequireAuth } from './RequireAuth'

function Denied({ role }: { role: Role }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-ink">Access restricted</h1>
      <p className="mt-2 text-slate-600">
        This page needs the <strong>{role}</strong> role. Ask an administrator to
        grant it to your account.
      </p>
    </div>
  )
}

function RoleGate({ role }: { role: Role }) {
  const { data: me, isLoading } = useMe()
  if (isLoading) {
    return <div className="p-12 text-center text-slate-600">Checking access…</div>
  }
  if (me?.role === role || me?.role === 'admin') return <Outlet />
  return <Denied role={role} />
}

export function RequireRole({ role }: { role: Role }) {
  return (
    <RequireAuth>
      <RoleGate role={role} />
    </RequireAuth>
  )
}
```

Note: `RequireAuth` above renders `<Outlet />`, but here it is used with children. Update `RequireAuth` to render `children ?? <Outlet />`:

```tsx
export function RequireAuth({ children }: { children?: React.ReactNode }) {
  // ...unchanged hook logic...
  if (auth.isAuthenticated) return <>{children ?? <Outlet />}</>
  return <div className="p-12 text-center text-slate-600">Signing in…</div>
}
```

- [ ] **Step 3: Stub page**

Create `frontend/src/pages/ProcessEconomicsPage.tsx`:

```tsx
export function ProcessEconomicsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-3xl font-bold tracking-tight">Process Economics</h1>
      <p className="text-slate-600">Editing for this section is coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 4: Wire routes**

In `frontend/src/App.tsx`, import `RequireAuth`, `RequireRole`, `ProcessEconomicsPage`, and change the ideas/new route plus add the economics route:

```tsx
        <Route element={<RequireAuth />}>
          <Route path="ideas/new" element={<IdeaWizardPage />} />
        </Route>
        <Route element={<RequireRole role="editor" />}>
          <Route path="process-economics" element={<ProcessEconomicsPage />} />
        </Route>
```

(Place these inside the existing `<Route element={<Layout />}>` block; remove the old standalone `<Route path="ideas/new" ... />`.)

- [ ] **Step 5: Header control**

In `frontend/src/components/Layout.tsx`, import `useAuth` from `react-oidc-context`, and add to the right of `<nav>` a small control:

```tsx
      {auth.isAuthenticated ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {auth.user?.profile.name ?? auth.user?.profile.preferred_username}
          </span>
          <button
            type="button"
            onClick={() => {
              void auth.removeUser()
              void auth.signoutRedirect()
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void auth.signinRedirect()}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </button>
      )}
```

Add `const auth = useAuth()` at the top of `Layout`.

- [ ] **Step 6: Drop submitterName from the wizard**

In `frontend/src/components/wizard/types.ts`:
- Remove `submitterName: string` from `WizardState`.
- Remove `submitterName: '',` from `INITIAL_WIZARD_STATE`.
- Change step 1 validation to `return isNonEmpty(state.title)`.
- In `toIdeaCreate`, remove the line `submitter_name: state.submitterName.trim(),`.

In `frontend/src/components/wizard/Step1BasicInfo.tsx`: remove the entire "Submitter name" `<TextField ... />` block (keep the title field).

In `frontend/src/components/wizard/Step8Review.tsx`: remove the line
`<SummaryRow label="Submitter" answer={value.submitterName} />`.

- [ ] **Step 7: Keep the wizard test green**

In `frontend/src/pages/IdeaWizardPage.test.tsx`:
- Remove the four `fireEvent.change(screen.getByLabelText('Submitter name'), { ... })` blocks (lines ~114, ~127, ~148) and the assertion `expect(screen.getByLabelText('Submitter name')).toHaveValue('Ann')` (~137). If removing the latter empties its `it(...)` test, keep a minimal assertion on the title field instead: `expect(screen.getByLabelText('Idea title')).toHaveValue('...')` matching whatever value that test set.
- Remove the line `submitter_name: 'Test User',` from the `toMatchObject({...})` payload (~270).

Do not add new assertions beyond keeping the file compiling and the existing intent intact.

- [ ] **Step 8: Verify**

```bash
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/auth frontend/src/pages/ProcessEconomicsPage.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx frontend/src/components/wizard/types.ts frontend/src/components/wizard/Step1BasicInfo.tsx frontend/src/components/wizard/Step8Review.tsx frontend/src/pages/IdeaWizardPage.test.tsx
git commit -m "feat(auth): route guards, header sign-in/out, wizard submitter cleanup"
```

---

## Task 12: End-to-end manual verification against dev Keycloak

**Files:** none (verification only).

**Prerequisite:** the realm administrator has registered, on client `mg-app_AutomationHub`: redirect URI `http://localhost:5173/auth/callback`, post-logout redirect `http://localhost:5173/*`, web origin `http://localhost:5173`.

- [ ] **Step 1: Start the stack**

```bash
docker compose up -d postgres
cd backend && alembic upgrade head && uvicorn app.main:app --port 8000 &
cd frontend && npm run dev &
```

Ensure `frontend/.env` has the `VITE_OIDC_*` values and `backend` picks up `OIDC_ISSUER` / `OIDC_CLIENT_ID` (defaults already point at dev).

- [ ] **Step 2: Anonymous idea submission is blocked**

Visit `http://localhost:5173/ideas/new` while signed out → you are redirected to Keycloak.

- [ ] **Step 3: Sign in and submit**

Complete Keycloak login → you land back on `/ideas/new`. Fill the wizard and submit → success, redirect to `/ideas`, and the new card's "Submitted by" shows your Keycloak display name (not a typed value).

- [ ] **Step 4: Provisioning + role**

```bash
docker compose exec postgres psql -U automation_hub -d automation_hub -c "select sub, email, name, role from app_user;"
```

Expect one row for your login with `role = user`.

- [ ] **Step 5: Editor gate**

Visit `http://localhost:5173/process-economics` → "Access restricted" panel.
In SQLAdmin (`http://localhost:8000/admin`, `admin`/`admin`) set your `app_user.role` to `editor`. Back in the SPA, reload `/process-economics` (the `me` query has a 5-min staleTime — hard-reload or wait) → the stub page renders.

- [ ] **Step 6: /api/v1/me**

With the browser dev-tools Network tab, confirm `GET /api/v1/me` returns 200 with your email/name/role and carries an `Authorization: Bearer` header.

- [ ] **Step 7: Bootstrap admin (optional)**

Set `BOOTSTRAP_ADMIN_EMAILS=<your-email>` in the backend env, restart it, hit any authenticated endpoint, and confirm `app_user.role` flips to `admin`.

- [ ] **Step 8: Final commit / branch push**

```bash
git status   # clean
git log --oneline master..HEAD
```

Confirm the branch is ready for review. Do not push or open a PR unless asked.

---

## Self-Review

**Spec coverage:**
- IdP config / `azp` validation → Task 2, Global Constraints, Task 12 prerequisite.
- OIDC settings + bootstrap emails → Task 1.
- `pyjwt` + `decode_token` + `TokenClaims` → Task 2.
- `AppUser` model + migration + `__init__` registration → Task 3.
- Role vocabulary constant → Task 2 (`ROLES`).
- `get_current_user` (JIT provision, claim refresh, race handling, bootstrap promotion) → Task 4.
- `require_role` / `CurrentUser` / `RequireEditor` → Task 4.
- `GET /api/v1/me` → Task 5.
- Idea POST auth + drop `submitter_name` + service signature → Task 6.
- SQLAdmin restricted `AppUser` view → Task 7.
- Frontend deps, provider, sessionStorage store, silent renew, callback → Task 8.
- `apiFetch` bearer injection + 401 redirect + `AuthBridge` → Task 9.
- `me.ts` + `useMe` → Task 10.
- `RequireAuth`, `RequireRole`, stub `process-economics` route, wizard field removal, header control → Task 11.
- Manual verification (no automated tests) → Task 12.
- Out-of-scope items are restated in Global Constraints and not implemented.

**Deviations from spec:**
- The spec mentions a `WWW-Authenticate: Bearer` header on 401s. The existing `AppError` handler in `app/main.py` emits a JSON body only; this plan does **not** add the header (a bearer SPA does not consume it). If wanted later, add a dedicated `AuthError` handler.
- `given_name` / `family_name` are stored only when present in the token; no splitting of `name` is done (matches spec's fallback note by simply leaving them null).

**Placeholder scan:** none — every code step contains complete content.

**Type consistency:** `TokenClaims`, `AppUser`, `Me`/`Role`, `apiFetch`/`configureApiAuth`, `RequireAuth`/`RequireRole` signatures are defined once and referenced consistently. `create_idea(payload, submitter_name)` is updated in the service (Task 6 Step 2) and caller (Task 6 Step 3) together.

---

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.
2. **Inline Execution** — tasks executed in this session with checkpoints (note Tasks 8–9 and 11 are interdependent for a green frontend typecheck; verify at the end of Task 11).

Which approach?
