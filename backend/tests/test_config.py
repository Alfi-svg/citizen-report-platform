import os
from app.core.config import Settings


def test_settings_default_values():
    settings = Settings()
    assert settings.PROJECT_NAME == "Bangladesh Citizen Report Platform"
    assert settings.VERSION == "0.1.0"
    assert settings.API_V1_STR == "/api/v1"
    assert settings.ENVIRONMENT == "development"
    assert "postgresql" in settings.DATABASE_URL
    assert settings.SECRET_KEY != ""
    assert isinstance(settings.CORS_ORIGINS, list)


def test_settings_override_via_env():
    custom_settings = Settings(
        PROJECT_NAME="Custom Platform",
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+asyncpg://user:pass@dbhost:5432/test_db",
    )
    assert custom_settings.PROJECT_NAME == "Custom Platform"
    assert custom_settings.ENVIRONMENT == "production"
    assert custom_settings.DATABASE_URL == "postgresql+asyncpg://user:pass@dbhost:5432/test_db"
