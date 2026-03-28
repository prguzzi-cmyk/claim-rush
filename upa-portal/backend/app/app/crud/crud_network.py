#!/usr/bin/env python

"""CRUD operations for the Network model"""

from app.crud.base import CRUDBase
from app.models import Network
from app.schemas import NetworkCreate, NetworkUpdate


class CRUDNetwork(CRUDBase[Network, NetworkCreate, NetworkUpdate]):
    ...


network = CRUDNetwork(Network)
