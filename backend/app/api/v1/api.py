from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, categories, reports

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])


