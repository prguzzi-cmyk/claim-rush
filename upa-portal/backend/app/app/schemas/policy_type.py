#!/usr/bin/env python

"""Schema for Policy and Sub Policy type."""

from pydantic.dataclasses import dataclass

from app.db.data_classes.policy_type import SubPolicyType, PolicyType


@dataclass
class SubPolicyTypeSchema(SubPolicyType):
    pass


@dataclass
class PolicyTypeSchema(PolicyType):
    pass
