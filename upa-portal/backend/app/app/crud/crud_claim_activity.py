#!/usr/bin/env python

"""CRUD operations for the Claim Activity model"""

from app.crud.base import CRUDBase
from app.models import ClaimActivity
from app.schemas import ClaimActivityCreateDB, ClaimActivityUpdate


class CRUDClaimActivity(
    CRUDBase[ClaimActivity, ClaimActivityCreateDB, ClaimActivityUpdate]
):
    ...


claim_activity = CRUDClaimActivity(ClaimActivity)
