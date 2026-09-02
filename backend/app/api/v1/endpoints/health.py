from typing import Dict, Any
from fastapi import APIRouter, status
from app.core.config import settings
from app.db.session import check_database_connection

router = APIRouter()


@router.get("", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint to verify backend service and database connectivity status.
    """
    db_connected = await check_database_connection(timeout_seconds=1.5)

    return {
        "status": "ok" if db_connected else "degraded",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_connected else "unavailable",
    }
