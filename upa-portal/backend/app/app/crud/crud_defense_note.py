#!/usr/bin/env python

"""CRUD operations for the DefenseNote model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.defense_note import DefenseNote
from app.schemas.defense_note import DefenseNoteCreateDB, DefenseNoteUpdate


class CRUDDefenseNote(
    CRUDBase[DefenseNote, DefenseNoteCreateDB, DefenseNoteUpdate]
):
    def get_by_project(
        self, db_session: Session, *, project_id: UUID
    ) -> DefenseNote | None:
        """Get the defense notes for a project (one record per project)."""
        with db_session as session:
            stmt = select(DefenseNote).where(
                DefenseNote.project_id == project_id
            )
            return session.scalars(stmt).first()

    def upsert(
        self,
        db_session: Session,
        *,
        project_id: UUID,
        obj_in: DefenseNoteUpdate,
    ) -> DefenseNote:
        """Create or update defense notes for a project.

        If a record already exists for the project, update it.
        Otherwise, create a new one.
        """
        existing = self.get_by_project(db_session, project_id=project_id)
        if existing:
            return self.update(
                db_session=db_session,
                obj_current=existing,
                obj_in=obj_in,
            )
        create_in = DefenseNoteCreateDB(
            **obj_in.dict(exclude_unset=True),
            project_id=project_id,
        )
        return self.create(db_session=db_session, obj_in=create_in)


defense_note = CRUDDefenseNote(DefenseNote)
