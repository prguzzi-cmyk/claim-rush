#!/usr/bin/env python

"""CRUD operations for the newsletter file model"""

from uuid import UUID

from fastapi_pagination import paginate
from fastapi_pagination.utils import disable_installed_extensions_check
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import validate_lock
from app.crud.base import CRUDBase
from app.models import Newsletter, NewsletterFile
from app.schemas import NewsletterFileCreate, NewsletterFileUpdate
from app.utils.exceptions import raise_if_unique_violation


class CRUDNewsletterFile(
    CRUDBase[NewsletterFile, NewsletterFileCreate, NewsletterFileUpdate]
):
    @staticmethod
    def get_all(db_session: Session, *, obj_id: UUID) -> list[NewsletterFile] | None:
        """
        Retrieve all newsletter files.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object

        Returns
        -------
        list[NewsletterFile]
            A list of Newsletter files.
        """
        disable_installed_extensions_check()

        with db_session as session:
            stmt = select(Newsletter).where(Newsletter.id == obj_id)
            newsletter_obj = session.scalar(stmt)

            return paginate(newsletter_obj.newsletter_files)

    def get(
        self, db_session: Session, *, obj_id: UUID, even_removed: bool = False
    ) -> NewsletterFile | None:
        """
        Retrieve a newsletter file.

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
        NewsletterFile | None
            A Newsletter file model object.
        """
        with db_session as session:
            stmt = select(NewsletterFile).where(NewsletterFile.id == obj_id)
            newsletter_file_obj = session.scalar(stmt)

            return newsletter_file_obj

    def create(
        self, db_session: Session, *, obj_in: NewsletterFileCreate
    ) -> NewsletterFile:
        try:
            with db_session as session:
                file_obj = NewsletterFile(
                    newsletter_id=obj_in.newsletter_id,
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
            obj = session.query(NewsletterFile).get(obj_id)
            if obj:
                validate_lock(obj)

                session.delete(obj)
                session.commit()


newsletter_file = CRUDNewsletterFile(NewsletterFile)
