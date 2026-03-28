#!/usr/bin/env python

"""CRUD operations for the file model"""

from typing import Any, Sequence
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud
from app.core.security import validate_lock
from app.crud.base import CRUDBase
from app.models import File
from app.schemas import FileCreate, FileTagsAppend, FileTagsRemove, FileUpdate
from app.utils.exceptions import raise_if_unique_violation


class CRUDFile(CRUDBase[File, FileCreate, FileUpdate]):
    def get_multi(
        self,
        db_session: Session,
        join_target: Any = None,
        is_outer: bool = False,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[File] | None:
        """
        Get a list of files.

        Parameters
        ----------
        db_session : Session
            Database session
        join_target : Any
            Join target model
        is_outer : bool
            Implement Full Outer Join
        removed : bool
            Fetch only removed records
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[File] | None
            On success, return a list of File objects. None if nothing is found.
        """
        with db_session as session:
            stmt = select(File)

            # Apply where condition
            stmt = stmt.where(File.related_type == "file")

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(File.created_at)

            return paginate(session, stmt)

    def get_multi_by_tag_slug(
        self,
        db_session: Session,
        tag_slug: str,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[File] | None:
        """
        Get a list of files of a specific tag.

        Parameters
        ----------
        db_session : Session
            Database session
        tag_slug: str
            Slug of a tag
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[File] | None
            On success, return a list of File objects. None if nothing is found.
        """
        if filters is None:
            filters = [File.tags.any(slug=tag_slug)]
        else:
            filters.append(File.tags.any(slug=tag_slug))

        return self.get_multi(
            db_session=db_session,
            filters=filters,
            order_by=order_by,
        )

    def create(self, db_session: Session, *, obj_in: FileCreate) -> File:
        try:
            tags_obj = []

            if obj_in.tags is not None:
                tags_obj = crud.tag.get_tags_list_by_id(db_session, obj_in.tags)

            with db_session as session:
                file_obj = File(
                    name=obj_in.name,
                    type=obj_in.type,
                    size=obj_in.size,
                    path=obj_in.path,
                    description=obj_in.description,
                    can_be_removed=obj_in.can_be_removed,
                )

                file_obj.tags.extend(tags_obj)

                session.add(file_obj)
                session.commit()
                session.refresh(file_obj)

                return file_obj
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A file with this name already exists."
            )

            raise exc

    def update(
        self, db_session: Session, *, file_id: UUID, obj_in: FileUpdate | dict[str, Any]
    ) -> File:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        tags_obj = []
        if hasattr(obj_in, "tags") and obj_in.tags is not None:
            tags_obj = crud.tag.get_tags_list_by_id(db_session, obj_in.tags)

        with db_session as session:
            file_obj: File = session.query(File).get(file_id)
            obj_data = jsonable_encoder(file_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and field != "tags":
                    setattr(file_obj, field, update_data[field])

            if len(tags_obj) > 0:
                # Delete existing association records
                file_obj.tags = []
                session.commit()
                session.refresh(file_obj)

                file_obj.tags.extend(tags_obj)

            session.commit()
            session.refresh(file_obj)

            return file_obj

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
            obj = session.query(File).get(obj_id)
            if obj:
                validate_lock(obj)

                session.delete(obj)
                session.commit()

    @staticmethod
    def append_tags(
        db_session: Session, *, file_obj: File, tags: FileTagsAppend
    ) -> File:
        """
        Append tags to a file.

        Parameters
        ----------
        db_session : Session
            Database session.
        file_obj : File
            The file model object.
        tags : FileTagsAppend
            A list consist of Tags UUID.

        Returns
        -------
        File
            Updated file model object.
        """
        tags_obj = []
        if tags is not None:
            tags_obj = crud.tag.get_tags_list_by_id(db_session, tags.tags)

        with db_session as session:
            for tag in tags_obj:
                if tag not in file_obj.tags:
                    file_obj.tags.append(tag)

                session.add(file_obj)
                session.commit()
                session.refresh(file_obj)

            return file_obj

    @staticmethod
    def remove_tags(
        db_session: Session, *, file_obj: File, tags: FileTagsRemove
    ) -> File:
        """
        Remove tags from a file.

        Parameters
        ----------
        db_session : Session
            Database session.
        file_obj : File
            The file model object.
        tags : FileTagsRemove
            A list consist of Tags UUID.

        Returns
        -------
        File
            Updated file model object.
        """
        tags_obj = []
        if tags is not None:
            tags_obj = crud.tag.get_tags_list_by_id(db_session, tags.tags)

        with db_session as session:
            for tag in tags_obj:
                if tag in file_obj.tags:
                    file_obj.tags.remove(tag)

            session.add(file_obj)
            session.commit()
            session.refresh(file_obj)

            return file_obj


file = CRUDFile(File)
