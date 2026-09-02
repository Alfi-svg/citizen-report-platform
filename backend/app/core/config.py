import json
import os
import logging
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("citizen_report")


class Settings(BaseSettings):
    PROJECT_NAME: str = "Bangladesh Citizen Report Platform"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # "development", "staging", "production"
    LOG_LEVEL: str = "INFO"

    # API Documentation toggle (defaults to True in dev/staging, False in production unless explicitly set)
    ENABLE_DOCS: Optional[bool] = None

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
    CORS_ORIGINS: Union[List[str], str] = [
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

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            v_stripped = v.strip().strip("'\"")
            if v_stripped.startswith("postgres://"):
                return "postgresql+asyncpg://" + v_stripped[len("postgres://"):]
            elif v_stripped.startswith("postgresql://") and not v_stripped.startswith("postgresql+asyncpg://"):
                return "postgresql+asyncpg://" + v_stripped[len("postgresql://"):]
            return v_stripped
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):

            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(item).strip().rstrip("/") for item in parsed if item]
                except Exception:
                    pass
            # Split comma-separated string
            return [origin.strip().rstrip("/") for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return [str(origin).strip().rstrip("/") for origin in v if str(origin).strip()]
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            if "*" in self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS cannot contain wildcard '*' in production with credentials enabled.")
            if self.SECRET_KEY == "development_secret_key_change_in_production":
                raise ValueError("Insecure default SECRET_KEY detected in production environment! Set a strong secret.")
            if len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production.")
        return self

    @property
    def is_docs_enabled(self) -> bool:
        if self.ENABLE_DOCS is not None:
            return self.ENABLE_DOCS
        return self.ENVIRONMENT.lower() != "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()

