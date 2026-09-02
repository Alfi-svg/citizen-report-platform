import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router

# Configure structured application logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("citizen_report")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        f"Starting {settings.PROJECT_NAME} v{settings.VERSION} "
        f"[env={settings.ENVIRONMENT}, docs={'enabled' if settings.is_docs_enabled else 'disabled'}, "
        f"cors_origins={len(settings.CORS_ORIGINS)} configured]"
    )
    # Ensure database schema and columns are synced
    try:
        from sqlalchemy import text
        from app.db.session import engine
        from app.models.base import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            try:
                await conn.execute(text("ALTER TABLE missing_person_sightings ADD COLUMN IF NOT EXISTS clothing TEXT;"))
                await conn.execute(text("ALTER TABLE missing_person_sightings ADD COLUMN IF NOT EXISTS direction VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE missing_person_sightings ADD COLUMN IF NOT EXISTS additional_information TEXT;"))
            except Exception:
                pass
        logger.info("Database schema synchronized on startup.")
    except Exception as e:
        logger.warning(f"Startup schema sync notice: {e}")

    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.is_docs_enabled else None,
    docs_url=f"{settings.API_V1_STR}/docs" if settings.is_docs_enabled else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.is_docs_enabled else None,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Adds essential HTTP security headers to all API responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.ENVIRONMENT.lower() == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Safely captures unhandled exceptions without leaking stack traces or internal details.
    """
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# Register API routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """Root entrypoint."""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_STR}/docs" if settings.is_docs_enabled else None,
        "health": f"{settings.API_V1_STR}/health",
    }

