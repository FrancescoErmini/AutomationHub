from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Automation Hub"
    environment: str = "development"
    log_level: str = "INFO"
    database_url: str = (
        "postgresql+psycopg://automation_hub:automation_hub_dev@localhost:5432/automation_hub"
    )
    rpa_workbook_path: Path = Path("../data/raw/RPA - o365.xlsx")

    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_secret_key: str = "insecure-local-admin-secret-change-me"

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
