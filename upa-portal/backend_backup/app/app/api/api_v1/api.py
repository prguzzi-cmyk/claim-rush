#!/usr/bin/env python

"""API Routers"""

from fastapi import APIRouter

from app.api.api_v1.endpoints import auth, leads, permissions, roles, users, utils
from app.core.tags import Tags

api_router = APIRouter()

api_router.include_router(
    auth.router, prefix=f"/{Tags.auth.value.lower()}", tags=[Tags.auth]
)
api_router.include_router(
    utils.router, prefix=f"/{Tags.utils.value.lower()}", tags=[Tags.utils]
)
api_router.include_router(
    permissions.router,
    prefix=f"/{Tags.permissions.value.lower()}",
    tags=[Tags.permissions],
)
api_router.include_router(
    roles.router, prefix=f"/{Tags.roles.value.lower()}", tags=[Tags.roles]
)
api_router.include_router(
    users.router, prefix=f"/{Tags.users.value.lower()}", tags=[Tags.users]
)
api_router.include_router(
    leads.router, prefix=f"/{Tags.leads.value.lower()}", tags=[Tags.leads]
)
