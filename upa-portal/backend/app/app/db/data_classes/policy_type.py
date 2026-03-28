#!/usr/bin/env python

"""Policy type and sub policy type data class."""

from dataclasses import dataclass, field


@dataclass
class SubPolicyType:
    name: str
    slug: str
    description: str | None = field(default=None)


@dataclass
class PolicyType:
    name: str
    slug: str
    description: str | None = field(default=None)
    sub_policy_types: list[SubPolicyType] | None = field(default_factory=list)
