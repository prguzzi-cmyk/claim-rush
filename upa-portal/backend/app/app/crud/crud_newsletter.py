#!/usr/bin/env python

"""CRUD operations for the newsletter model"""

from typing import Any, Sequence
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud
from app.core.security import is_removed
from app.crud.base import CRUDBase
from app.models import Newsletter
from app.schemas import NewsletterCreate, NewsletterUpdate, TagsAppend, TagsRemove


class CRUDNewsletter(CRUDBase[Newsletter, NewsletterCreate, NewsletterUpdate]):
    @staticmethod
    def get_multi_by_tag_slug(
        db_session: Session,
        tag_slug: str,
    ) -> Sequence[Newsletter] | None:
        """
        Get a list of newsletters of a specific tag.

        Parameters
        ----------
        db_session : Session
            Database session
        tag_slug: str
            Slug of a tag

        Returns
        -------
        Sequence[Newsletter] | None
            On success, return a list of Newsletter objects. None if nothing is found.
        """
        with db_session as session:
            stmt = select(Newsletter).filter(Newsletter.tags.any(slug=tag_slug))
            return paginate(session, stmt)

    def create(self, db_session: Session, *, obj_in: NewsletterCreate) -> Newsletter:
        tags_obj = []

        if obj_in.tags is not None:
            tags_obj = crud.tag.get_tags_list_by_id(db_session, obj_in.tags)

        with db_session as session:
            newsletter_obj = Newsletter(
                title=obj_in.title,
                content=obj_in.content,
                publication_date=obj_in.publication_date,
                is_featured=obj_in.is_featured,
                can_be_removed=obj_in.can_be_removed,
            )

            newsletter_obj.tags.extend(tags_obj)

            session.add(newsletter_obj)
            session.commit()
            session.refresh(newsletter_obj)

            return newsletter_obj

    def update(
        self,
        db_session: Session,
        *,
        newsletter_id: UUID,
        obj_in: NewsletterUpdate | dict[str, Any],
    ) -> Newsletter:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        tags_obj = []
        if hasattr(obj_in, "tags") and obj_in.tags is not None:
            tags_obj = crud.tag.get_tags_list_by_id(db_session, obj_in.tags)

        with db_session as session:
            newsletter_obj: Newsletter = session.query(Newsletter).get(newsletter_id)
            obj_data = jsonable_encoder(newsletter_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and field != "tags":
                    setattr(newsletter_obj, field, update_data[field])

            if len(tags_obj) > 0:
                # Delete existing association records
                newsletter_obj.tags = []
                session.commit()
                session.refresh(newsletter_obj)

                newsletter_obj.tags.extend(tags_obj)

            session.commit()
            session.refresh(newsletter_obj)

            return newsletter_obj

    @staticmethod
    def append_tags(
        db_session: Session, *, newsletter_obj: Newsletter, tags: TagsAppend
    ) -> Newsletter:
        """
        Append tags to a newsletter.

        Parameters
        ----------
        db_session : Session
            Database session.
        newsletter_obj : Newsletter
            The newsletter model object.
        tags : TagsAppend
            A list consist of Tags UUID.

        Returns
        -------
        Newsletter
            Updated newsletter model object.
        """
        tags_obj = []
        if tags is not None:
            tags_obj = crud.tag.get_tags_list_by_id(db_session, tags.tags)

        with db_session as session:
            for tag in tags_obj:
                if tag not in newsletter_obj.tags:
                    newsletter_obj.tags.append(tag)

                session.add(newsletter_obj)
                session.commit()
                session.refresh(newsletter_obj)

            return newsletter_obj

    @staticmethod
    def remove_tags(
        db_session: Session, *, newsletter_obj: Newsletter, tags: TagsRemove
    ) -> Newsletter:
        """
        Remove tags from a newsletter.

        Parameters
        ----------
        db_session : Session
            Database session.
        newsletter_obj : Newsletter
            The newsletter model object.
        tags : TagsRemove
            A list consist of Tags UUID.

        Returns
        -------
        Newsletter
            Updated newsletter model object.
        """
        tags_obj = []
        if tags is not None:
            tags_obj = crud.tag.get_tags_list_by_id(db_session, tags.tags)

        with db_session as session:
            for tag in tags_obj:
                if tag in newsletter_obj.tags:
                    newsletter_obj.tags.remove(tag)

            session.add(newsletter_obj)
            session.commit()
            session.refresh(newsletter_obj)

            return newsletter_obj

    def restore(
        self,
        db_session: Session,
        *,
        db_obj: Newsletter,
    ) -> Newsletter:
        """
        Restore a record in the database.

        Parameters
        ----------
        db_session : Session
            Database session
        db_obj : Newsletter
            Database model object

        Returns
        -------
        Newsletter
            Returns updated record.
        """
        is_removed(db_obj)

        obj_in = dict(is_removed=False)

        db_obj = self.update(
            db_session=db_session, newsletter_id=db_obj.id, obj_in=obj_in
        )

        return db_obj


newsletter = CRUDNewsletter(Newsletter)
