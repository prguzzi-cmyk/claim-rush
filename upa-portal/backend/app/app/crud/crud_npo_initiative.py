#!/usr/bin/env python

"""CRUD operations for the NPO Initiative model"""

from app.crud.base import CRUDBase
from app.models import NpoInitiative
from app.schemas import NPOInitiativeCreate, NPOInitiativeUpdate


class CRUDNPOInitiative(
    CRUDBase[NpoInitiative, NPOInitiativeCreate, NPOInitiativeUpdate]
):
    ...


npo_initiative = CRUDNPOInitiative(NpoInitiative)
