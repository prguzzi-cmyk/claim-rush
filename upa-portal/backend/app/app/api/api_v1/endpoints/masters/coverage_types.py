#!/usr/bin/env python

"""Routes for the Coverage Types."""

from typing import Any, Annotated

from fastapi import APIRouter, Path

from app import schemas
from app.utils.exceptions import exc_not_found
from app.utils.masters import CoverageTypes

router = APIRouter()


@router.get(
    "/coverage-types",
    summary="Get Coverage Types",
    response_description="A list of Coverage types",
    response_model=list[schemas.CoverageTypeSchema],
)
def get_coverage_types() -> Any:
    """Retrieve a list of Coverage types."""

    return CoverageTypes().coverage_types


@router.get(
    "/coverage-types/{coverage_type_slug}",
    summary="Get Coverage Type",
    response_description="A Coverage Type",
    response_model=schemas.CoverageTypeSchema,
)
def get_coverage_type(
    coverage_type_slug: Annotated[str, Path(description="The Coverage Type slug")]
) -> Any:
    """Retrieve a Coverage type via Coverage type slug."""

    coverage_type = CoverageTypes().get_coverage_type(coverage_slug=coverage_type_slug)
    return (
        coverage_type if coverage_type else exc_not_found(msg="Coverage type not found")
    )
