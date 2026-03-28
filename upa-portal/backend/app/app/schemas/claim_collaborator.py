#!/usr/bin/env python

"""Schema for Claim Collaborator"""

from pydantic import Field

from app.core.enums import ClaimCollaboratorRestrictedAttributes
from app.schemas import Collaborator, ClaimInDB, ClaimPaymentSum


# Limited properties to return via API to Collaborators
class ClaimCollaborator(ClaimInDB, Collaborator):
    # Set confidential data to None
    def dict(self, *args, **kwargs):
        data = super().dict(*args, **kwargs)

        for field in ClaimCollaboratorRestrictedAttributes:
            data[field.value] = None

        return data


class ClaimDetailedCollaborator(ClaimInDB, Collaborator):
    payments_sum: list[ClaimPaymentSum] | None = Field(
        description="A sum of claim payments by their type."
    )

    # Set confidential data to None
    def dict(self, *args, **kwargs):
        data = super().dict(*args, **kwargs)

        for field in ClaimCollaboratorRestrictedAttributes:
            data[field.value] = None

        return data
