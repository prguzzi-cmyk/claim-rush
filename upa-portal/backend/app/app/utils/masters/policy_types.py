#!/usr/bin/env python

"""Policy and Sub-Policy Type master data."""

import json
from pathlib import Path

from app import schemas
from app.db.data_classes import PolicyType, SubPolicyType
from app.utils.singleton_class import Singleton


class PolicyTypes(Singleton):
    def __init__(self):
        # Load JSON data file and read data from it
        file_path = str(
            Path(__file__).parent.parent.parent / "db" / "data" / "policy_types.json"
        )

        with open(file_path, "r") as file:
            data = json.load(file)
            self._policy_types = [
                schemas.PolicyTypeSchema(**policy_type)
                for policy_type in data["policy_types"]
            ]

    @property
    def policy_types(self):
        self._policy_types.sort(key=lambda pt: pt.name)
        return self._policy_types

    @property
    def policy_types_slug(self):
        return {pt.slug for pt in self._policy_types}

    def get_policy_type(self, policy_slug: str) -> PolicyType | None:
        """
        Get a policy type via policy type slug.

        Parameters
        ----------
        policy_slug : str
            A slug string of policy type.

        Returns
        -------
        PolicyType | None
            If record found then `PolicyType` data object otherwise `None`
        """
        for policy_type in self._policy_types:
            if policy_type.slug == policy_slug:
                if policy_type.sub_policy_types:
                    policy_type.sub_policy_types.sort(key=lambda spt: spt.name)

                return policy_type

        return None

    def get_sub_policy_types(self, policy_slug: str) -> list[SubPolicyType] | None:
        """
        Get a list of sub policy types via policy type slug.

        Parameters
        ----------
        policy_slug : str
            A slug string of policy type.

        Returns
        -------
        list[SubPolicyType] | None
            If records found then a list of `SubPolicyType` data object otherwise `None`
        """
        policy_type = self.get_policy_type(policy_slug=policy_slug)
        if policy_type and policy_type.sub_policy_types:
            policy_type.sub_policy_types.sort(key=lambda spt: spt.name)
            return policy_type.sub_policy_types
        else:
            return None

    def get_sub_policy_type(
        self, policy_slug: str, sub_policy_slug: str
    ) -> SubPolicyType | None:
        """
        Get a sub policy type via policy and sub policy type slug.

        Parameters
        ----------
        policy_slug : str
            A slug string of policy type.
        sub_policy_slug : str
            A slug string of sub policy type.

        Returns
        -------
        SubPolicyType | None
            If record found then a `SubPolicyType` data object otherwise `None`
        """
        sub_policy_types = self.get_sub_policy_types(policy_slug=policy_slug)
        if sub_policy_types:
            for sub_policy_type in sub_policy_types:
                if sub_policy_type.slug == sub_policy_slug:
                    return sub_policy_type
        else:
            return None
