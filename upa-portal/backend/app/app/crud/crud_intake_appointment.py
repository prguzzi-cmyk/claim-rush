#!/usr/bin/env python

"""CRUD for IntakeAppointment"""

from app.crud.base import CRUDBase
from app.models.intake_appointment import IntakeAppointment
from app.schemas.intake_appointment import IntakeAppointmentCreate, IntakeAppointmentUpdate


class CRUDIntakeAppointment(CRUDBase[IntakeAppointment, IntakeAppointmentCreate, IntakeAppointmentUpdate]):
    pass


intake_appointment = CRUDIntakeAppointment(IntakeAppointment)
