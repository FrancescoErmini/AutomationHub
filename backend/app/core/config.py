from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    oidc_issuer: str = "https://keycloak-dev.menarini.net/auth/realms/menarini"
    oidc_client_id: str = "mg-app_AutomationHub"
    oidc_jwks_url: str | None = None
    bootstrap_admin_emails: str = ""

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
