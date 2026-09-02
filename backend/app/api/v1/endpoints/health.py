from typing import Dict, Any
from fastapi import APIRouter, Response, status
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db.session import check_database_connection

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def health_check() -> Response:
    """
    Health check endpoint to verify backend service and database connectivity status.
    Returns HTTP 200 OK with connectivity diagnostic payload.
    Never exposes internal credentials, host IPs, or database secrets.
    """
    db_connected = await check_database_connection(timeout_seconds=5.0)

    payload = {
        "status": "ok" if db_connected else "degraded",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_connected else "unavailable",
    }

    return JSONResponse(status_code=status.HTTP_200_OK, content=payload)


