#!/usr/bin/env python

"""CRUD for IntakeSession"""

from app.crud.base import CRUDBase
from app.models.intake_session import IntakeSession
from app.schemas.intake_session import IntakeSessionCreate, IntakeSessionUpdate


class CRUDIntakeSession(CRUDBase[IntakeSession, IntakeSessionCreate, IntakeSessionUpdate]):
    pass


intake_session = CRUDIntakeSession(IntakeSession)
