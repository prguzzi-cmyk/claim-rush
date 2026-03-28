#!/usr/bin/env python

"""CRUD operations for the RinSource model"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.rin_source import RinSource
from app.schemas.rin_source import RinSourceCreate, RinSourceUpdate


class CRUDRinSource(CRUDBase[RinSource, RinSourceCreate, RinSourceUpdate]):
    def get_by_code(self, db_session: Session, *, code: str) -> RinSource | None:
        with db_session as session:
            stmt = select(RinSource).where(RinSource.code == code)
            return session.scalar(stmt)


rin_source = CRUDRinSource(RinSource)
