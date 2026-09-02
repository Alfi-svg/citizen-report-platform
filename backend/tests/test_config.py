import pytest
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
    assert settings.is_docs_enabled is True


def test_settings_override_via_env():
    custom_settings = Settings(
        PROJECT_NAME="Custom Platform",
        ENVIRONMENT="production",
        SECRET_KEY="a" * 32,
        DATABASE_URL="postgresql+asyncpg://user:pass@dbhost:5432/test_db",
        CORS_ORIGINS=["https://citizenreport.gov.bd"],
    )
    assert custom_settings.PROJECT_NAME == "Custom Platform"
    assert custom_settings.ENVIRONMENT == "production"
    assert custom_settings.DATABASE_URL == "postgresql+asyncpg://user:pass@dbhost:5432/test_db"
    assert custom_settings.is_docs_enabled is False


def test_cors_origins_parsing_comma_and_json():
    # Comma-separated string
    s1 = Settings(CORS_ORIGINS="https://foo.com, https://bar.com/")
    assert s1.CORS_ORIGINS == ["https://foo.com", "https://bar.com"]

    # JSON array string
    s2 = Settings(CORS_ORIGINS='["https://app.gov.bd/", "https://admin.gov.bd"]')
    assert s2.CORS_ORIGINS == ["https://app.gov.bd", "https://admin.gov.bd"]


def test_production_settings_validation():
    # Default secret in production must fail
    with pytest.raises(ValueError, match="Insecure default SECRET_KEY detected"):
        Settings(ENVIRONMENT="production")

    # Short secret in production must fail
    with pytest.raises(ValueError, match="must be at least 32 characters"):
        Settings(ENVIRONMENT="production", SECRET_KEY="too-short")

    # Wildcard CORS in production must fail
    with pytest.raises(ValueError, match="cannot contain wildcard"):
        Settings(ENVIRONMENT="production", SECRET_KEY="a" * 32, CORS_ORIGINS="*")

