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
        url = settings.oidc_jwks_url or f"{settings.oidc_issuer}/protocol/openid-connect/certs"
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
