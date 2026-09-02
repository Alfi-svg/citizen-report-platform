import pytest
from unittest.mock import patch
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient):
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "health" in data


@pytest.mark.asyncio
async def test_health_check_endpoint_healthy(async_client: AsyncClient):
    with patch("app.api.v1.endpoints.health.check_database_connection", return_value=True):
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["project"] == "Bangladesh Citizen Report Platform"
        assert data["version"] == "0.1.0"
        assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_health_check_endpoint_degraded(async_client: AsyncClient):
    with patch("app.api.v1.endpoints.health.check_database_connection", return_value=False):
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "unavailable"


