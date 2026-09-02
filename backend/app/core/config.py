import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Bangladesh Citizen Report Platform"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database Configuration (PostgreSQL async engine)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/citizen_report_db"
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_TIMEOUT: int = 10

    # Security & Tokens
    SECRET_KEY: str = "development_secret_key_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Cloud Object Storage & Media Configuration
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    STORAGE_LOCAL_ROOT: str = "data/storage"
    STORAGE_ENDPOINT: Optional[str] = None
    STORAGE_BUCKET: str = "citizen-report-evidence"
    STORAGE_REGION: str = "auto"
    STORAGE_ACCESS_KEY: Optional[str] = None
    STORAGE_SECRET_KEY: Optional[str] = None

    # Evidence File Size Limits (in bytes)
    MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_VIDEO_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    MAX_DOCUMENT_SIZE_BYTES: int = 20 * 1024 * 1024  # 20 MB
    MAX_MEDIA_PER_REPORT: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
