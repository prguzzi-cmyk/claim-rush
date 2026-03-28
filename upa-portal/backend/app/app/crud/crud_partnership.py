#!/usr/bin/env python

"""CRUD operations for the Partnership model"""

from app.crud.base import CRUDBase
from app.models import Partnership
from app.schemas import PartnershipCreate, PartnershipUpdate


class CRUDPartnership(CRUDBase[Partnership, PartnershipCreate, PartnershipUpdate]):
    ...


partnership = CRUDPartnership(Partnership)
