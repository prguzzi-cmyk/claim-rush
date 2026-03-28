#!/usr/bin/env python

"""Routes for the Policy Types."""

from typing import Any, Annotated

from fastapi import APIRouter, Path

from app import schemas
from app.utils.exceptions import exc_not_found
from app.utils.masters import PolicyTypes

router = APIRouter()


@router.get(
    "/policy-types",
    summary="Get Policy Types",
    response_description="A list of Policy types",
    response_model=list[schemas.PolicyTypeSchema],
)
def get_policy_types() -> Any:
    """Retrieve a list of Policy and Sub Policy types."""

    return PolicyTypes().policy_types


@router.get(
    "/policy-types/{policy_type_slug}",
    summary="Get Policy Type",
    response_description="A Policy Type",
    response_model=schemas.PolicyTypeSchema,
)
def get_policy_type(
    policy_type_slug: Annotated[str, Path(description="The Policy Type slug")]
) -> Any:
    """Retrieve a Policy and Sub Policy type via Policy type slug."""

    policy_type = PolicyTypes().get_policy_type(policy_slug=policy_type_slug)
    return policy_type if policy_type else exc_not_found(msg="Policy type not found")


@router.get(
    "/policy-types/{policy_type_slug}/sub-policy-types",
    summary="Get Sub Policy Types",
    response_description="A list of Sub Policy types",
    response_model=list[schemas.SubPolicyTypeSchema],
)
def get_sub_policy_types(
    policy_type_slug: Annotated[str, Path(description="The Policy Type slug")]
) -> Any:
    """Retrieve a list of Sub Policy types."""

    sub_policy_type = PolicyTypes().get_sub_policy_types(policy_slug=policy_type_slug)
    return (
        sub_policy_type
        if sub_policy_type
        else exc_not_found(msg="Policy type not found")
    )


@router.get(
    "/policy-types/{policy_type_slug}/sub-policy-types/{sub_policy_type_slug}",
    summary="Get Sub Policy Type",
    response_description="Sub Policy type",
    response_model=schemas.SubPolicyTypeSchema,
)
def get_sub_policy_type(
    policy_type_slug: Annotated[str, Path(description="The Policy Type slug")],
    sub_policy_type_slug: Annotated[str, Path(description="The Sub Policy Type slug")],
) -> Any:
    """Retrieve a Sub Policy type."""

    sub_policy_type = PolicyTypes().get_sub_policy_type(
        policy_slug=policy_type_slug, sub_policy_slug=sub_policy_type_slug
    )
    return (
        sub_policy_type
        if sub_policy_type
        else exc_not_found(msg="Sub Policy type not found")
    )
