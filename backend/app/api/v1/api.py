from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, categories, reports, admin, public, comments, reactions, flags, notifications, safety, missing_person, safety_map, analytics, blood

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(comments.router, tags=["comments"])
api_router.include_router(reactions.router, tags=["reactions"])
api_router.include_router(flags.router, tags=["flags"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(safety.router, prefix="/safety", tags=["safety"])
api_router.include_router(safety_map.router, prefix="/safety", tags=["safety-map"])
api_router.include_router(safety_map.router, prefix="/safety-map", tags=["safety-map"])
api_router.include_router(missing_person.router, prefix="/missing-person", tags=["missing-person"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(blood.router, prefix="/blood", tags=["blood"])







