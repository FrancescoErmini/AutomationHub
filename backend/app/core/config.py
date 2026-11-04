from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_ADMIN_DEFAULTS = {
    "admin_password": "admin",
    "admin_secret_key": "insecure-local-admin-secret-change-me",
}


class Settings(BaseSettings):
    app_name: str = "Automation Hub"
    environment: str = "development"
    log_level: str = "INFO"
    database_url: str = (
        "postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub"
    )

    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_secret_key: str = "insecure-local-admin-secret-change-me"

    oidc_issuer: str = "https://keycloak.example.com/auth/realms/your-realm"
    oidc_client_id: str = "automation-hub"
    oidc_jwks_url: str | None = None
    bootstrap_admin_emails: str = ""

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    @model_validator(mode="after")
    def _reject_insecure_admin_defaults(self) -> "Settings":
        if self.environment == "development":
            return self
        insecure = [
            name for name, value in _INSECURE_ADMIN_DEFAULTS.items() if getattr(self, name) == value
        ]
        if insecure:
            raise ValueError(
                f"Set {', '.join(n.upper() for n in insecure)} "
                "when ENVIRONMENT is not 'development'"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
