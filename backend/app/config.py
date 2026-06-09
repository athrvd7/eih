from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Gemini
    gemini_api_key: str = ""

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000

    # File limits
    max_upload_mb: int = 100
    max_repo_mb: int = 500
    max_files: int = 500

    # Storage
    repos_dir: str = "/tmp/eih_repos"
    db_path: str = "./eih.db"

    # App
    app_env: str = "development"
    log_level: str = "INFO"
    frontend_url: str = "http://localhost:5173"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
