#!/usr/bin/env python

import logging
import os
import traceback
from pathlib import Path

from fastapi import FastAPI

# Minimal healthcheck app — always boots, even if config/DB fails
_boot_error: str | None = None

try:
    from fastapi.exception_handlers import (
        http_exception_handler,
        request_validation_exception_handler,
    )
    from fastapi.exceptions import RequestValidationError
    from fastapi.staticfiles import StaticFiles
    from fastapi_pagination import add_pagination
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from starlette.exceptions import HTTPException as StarletteHTTPException
    from starlette.middleware.cors import CORSMiddleware

    from app.api.api_v1.api import api_router
    from app.core.config import settings
    from app.core.exception_handlers import setup_exception_handlers
    from app.core.log import logger
    from app.core.rate_limit import limiter
    from app.schemas import Msg

except Exception as e:
    _boot_error = f"{type(e).__name__}: {e}"
    logging.error(f"BOOT ERROR — app will serve healthcheck only: {_boot_error}")
    logging.error(traceback.format_exc())
    settings = None  # type: ignore

if _boot_error or settings is None:
    # Degraded mode — serve health check only so Railway doesn't kill the container
    app = FastAPI(title="UPA Portal", docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/")
    @app.get("/healthz")
    async def healthz():
        return {"status": "ok"}

    @app.get("/test")
    async def test():
        return {"msg": "backend working"}

else:
    # Normal mode — full application
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.PROJECT_DESCRIPTION,
        version=settings.API_VERSION,
        contact={
            "name": settings.PROJECT_NAME,
            "url": settings.PROJECT_URL,
            "email": settings.CONTACT_EMAIL,
        },
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/documentation",
        openapi_tags=settings.API_TAGS,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.exception_handler(StarletteHTTPException)
    async def custom_http_exception_handler(request, exc):
        logger.error(f"An HTTP error!: {repr(exc)}")
        return await http_exception_handler(request, exc)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        logger.error(f"The client sent invalid data!: {exc}")
        return await request_validation_exception_handler(request, exc)

    # Set all CORS enabled origins
    if settings.BACKEND_CORS_ORIGINS:
        logger.info(f"CORS enabled origins: {settings.BACKEND_CORS_ORIGINS}")
        logger.info(f"CORS origin regex: {settings.BACKEND_CORS_ORIGIN_REGEX}")
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/", response_model=Msg)
    async def root() -> dict[str, str]:
        return {"msg": "Welcome to UPA Adjuster Portal."}

    @app.get("/healthz")
    async def healthz():
        return {"status": "ok"}

    @app.get("/test")
    async def test():
        return {"msg": "backend working"}

    @app.get("/debug/db")
    async def debug_db():
        from app.db.session import SessionLocal
        try:
            from sqlalchemy import text
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            return {"status": "ok"}
        except Exception:
            return {"status": "failed"}


    app.include_router(api_router, prefix=settings.API_V1_STR)

    # Serve roof analysis imagery
    _media_docker = Path("/app/media")
    _media_local = Path("media")
    _media_dir = _media_docker if _media_docker.exists() else _media_local
    _media_dir.mkdir(parents=True, exist_ok=True)
    app.mount(f"{settings.API_V1_STR}/media", StaticFiles(directory=str(_media_dir)), name="media")

    # Setup custom exception handlers
    setup_exception_handlers(app)

    # Add pagination to the application
    add_pagination(app)
