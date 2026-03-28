#!/usr/bin/env python

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.api_v1.api import api_router
from app.core.config import settings
from app.schemas import Msg

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
    docs_url="/dev-docs",
    redoc_url="/documentation",
    openapi_tags=settings.API_TAGS,
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/", response_model=Msg)
async def root() -> dict[str, str]:
    return {"msg": "Welcome to UPA Adjuster Portal."}


app.include_router(api_router, prefix=settings.API_V1_STR)
