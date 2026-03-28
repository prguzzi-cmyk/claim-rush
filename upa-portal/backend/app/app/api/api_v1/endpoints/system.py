#!/usr/bin/env python

"""Routes for the System module"""

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import at_least_admin_user
from app.core.rbac import MiscOperations, Modules, Operations

router = APIRouter()


@router.get(
    "/modules",
    summary="Read System Modules",
    response_description="Modules data",
    response_model=list[str],
    dependencies=[Depends(at_least_admin_user())],
)
def read_system_modules() -> Any:
    """Retrieve a list of system modules."""

    return [module.value for module in Modules]


@router.get(
    "/operations",
    summary="Read System Operations",
    response_description="Operations data",
    response_model=dict[str, list],
    dependencies=[Depends(at_least_admin_user())],
)
def read_system_operations() -> Any:
    """Retrieve a list of system operations."""

    return {
        "basic": [ope for ope in Operations],
        "additional": [ope for ope in MiscOperations],
    }


@router.get(
    "/modules-with-operations",
    summary="Read System Modules & Operations",
    response_description="Modules data",
    response_model=dict[str, list],
    dependencies=[Depends(at_least_admin_user())],
)
def read_system_modules_operations() -> Any:
    """Retrieve a list of system modules with their operations."""

    return Modules.get_with_operations()
