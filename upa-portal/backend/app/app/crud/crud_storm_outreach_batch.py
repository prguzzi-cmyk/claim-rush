#!/usr/bin/env python

"""CRUD operations for the StormOutreachBatch model"""

from app.crud.base import CRUDBase
from app.models.storm_outreach_batch import StormOutreachBatch
from app.schemas.storm_outreach_batch import StormOutreachBatchCreate, StormOutreachBatchUpdate


class CRUDStormOutreachBatch(CRUDBase[StormOutreachBatch, StormOutreachBatchCreate, StormOutreachBatchUpdate]):
    pass


storm_outreach_batch = CRUDStormOutreachBatch(StormOutreachBatch)
