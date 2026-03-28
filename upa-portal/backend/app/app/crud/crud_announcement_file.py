#!/usr/bin/env python

"""CRUD operations for the announcement file model"""

from uuid import UUID

from fastapi_pagination import paginate
from fastapi_pagination.utils import disable_installed_extensions_check
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import validate_lock
from app.crud.base import CRUDBase
from app.models import Announcement, AnnouncementFile
from app.schemas import AnnouncementFileCreate, AnnouncementFileUpdate
from app.utils.exceptions import raise_if_unique_violation


class CRUDAnnouncementFile(
    CRUDBase[AnnouncementFile, AnnouncementFileCreate, AnnouncementFileUpdate]
):
    @staticmethod
    def get_all(db_session: Session, *, obj_id: UUID) -> list[AnnouncementFile] | None:
        """
        Retrieve all announcement files.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object

        Returns
        -------
        list[AnnouncementFile]
            A list of Announcement files.
        """
        disable_installed_extensions_check()

        with db_session as session:
            stmt = select(Announcement).where(Announcement.id == obj_id)
            announcement_obj = session.scalar(stmt)

            return paginate(announcement_obj.announcement_files)

    def get(
        self, db_session: Session, *, obj_id: UUID, even_removed: bool = False
    ) -> AnnouncementFile | None:
        """
        Retrieve an announcement file.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object
        even_removed : bool
            Fetch even if removed

        Returns
        -------
        AnnouncementFile | None
            A Announcement file model object.
        """
        with db_session as session:
            stmt = select(AnnouncementFile).where(AnnouncementFile.id == obj_id)
            announcement_file_obj = session.scalar(stmt)

            return announcement_file_obj

    def create(
        self, db_session: Session, *, obj_in: AnnouncementFileCreate
    ) -> AnnouncementFile:
        try:
            with db_session as session:
                file_obj = AnnouncementFile(
                    announcement_id=obj_in.announcement_id,
                    name=obj_in.name,
                    type=obj_in.type,
                    size=obj_in.size,
                    path=obj_in.path,
                    description=obj_in.description,
                    can_be_removed=obj_in.can_be_removed,
                )

                session.add(file_obj)
                session.commit()
                session.refresh(file_obj)

                return file_obj
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A file with this name already exists."
            )

            raise exc

    def remove(self, db_session: Session, *, obj_id: UUID) -> None:
        """
        Delete a record in the database.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of the object to delete
        """
        with db_session as session:
            obj = session.query(AnnouncementFile).get(obj_id)
            if obj:
                validate_lock(obj)

                session.delete(obj)
                session.commit()


announcement_file = CRUDAnnouncementFile(AnnouncementFile)
