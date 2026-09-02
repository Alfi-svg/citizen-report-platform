from typing import Dict, Any
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def health_check() -> Dict[str, Any]:
    """Health check endpoint to verify backend service status."""
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
