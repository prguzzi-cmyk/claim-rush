#!/usr/bin/env python

"""CRUD operations for the Tag model"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import AppTags
from app.core.security import validate_lock
from app.crud.base import CRUDBase
from app.models import Tag
from app.schemas import TagCreate, TagUpdate
from app.utils.common import slugify
from app.utils.exceptions import exc_forbidden, exc_not_found, raise_if_unique_violation


class CRUDTag(CRUDBase[Tag, TagCreate, TagUpdate]):
    def get_tags_list_by_id(self, db_session: Session, tags: list) -> list[Tag]:
        """
        Get a list of tags objects.

        Parameters
        ----------
        db_session : Session
            Database session.
        tags : list
            A list consist of tags ids.

        Returns
        -------
        list
            A list of tags objects.
        """
        tags_obj = []

        with db_session as session:
            for tag_ob in tags:
                if isinstance(tag_ob, UUID | str):
                    tag_id = tag_ob
                else:
                    tag_id = tag_ob.id

                tag_obj = self.get(session, obj_id=tag_id)
                if tag_obj is None:
                    exc_not_found(f"Tag with this id ({tag_id}) not found.")

                tags_obj.append(tag_obj)

        return tags_obj

    @staticmethod
    def get_by_slug(db_session: Session, *, slug: str) -> Tag | None:
        """
        Retrieve a tag via slug.

        Parameters
        ----------
        db_session : Session
            Database session
        slug : str
            Slug of a tag

        Returns
        -------
        Tag
            Return a Tag object or None.
        """
        with db_session as session:
            stmt = select(Tag).where(Tag.slug == slug)
            return session.scalars(stmt).first()

    def create(self, db_session: Session, *, obj_in: TagCreate) -> Tag:
        with db_session as session:
            try:
                db_obj = Tag(
                    slug=slugify(string=obj_in.name),
                    name=obj_in.name,
                    description=obj_in.description,
                    can_be_removed=obj_in.can_be_removed,
                )

                session.add(db_obj)
                session.commit()
                session.refresh(db_obj)

                return db_obj
            except IntegrityError as exc:
                raise_if_unique_violation(
                    exc=exc, msg="A tag with this name already exists."
                )

                raise exc

    def update(
        self,
        db_session: Session,
        *,
        db_obj: Tag,
        obj_in: TagUpdate | dict[str, Any],
    ) -> Tag:
        try:
            if self.is_system_tag(db_obj.name):
                exc_forbidden("You can't update the default application tag.")

            if isinstance(obj_in, dict):
                update_data = obj_in
            else:
                update_data = obj_in.dict(exclude_unset=True)

            if update_data.get("name"):
                update_data["slug"] = slugify(string=update_data["name"])

            return super().update(db_session, db_obj=db_obj, obj_in=update_data)
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A tag with this name already exists."
            )

            raise exc

    def remove(self, db_session: Session, *, obj_id: UUID) -> Tag | None:
        with db_session as session:
            obj = self.get(db_session, obj_id=obj_id)
            if obj:
                if self.is_system_tag(obj.name):
                    exc_forbidden("You can't delete the default application tag.")

                validate_lock(obj)

                obj.is_removed = True

                session.add(obj)
                session.commit()
                session.refresh(obj)

        return obj

    @staticmethod
    def is_system_tag(name: str) -> bool:
        """
        Check if it is an application default tag.

        Parameters
        ----------
        name : str
            Tag name.

        Returns
        -------
        bool
            `True` if found, otherwise `False`
        """
        if name in [t.value for t in AppTags]:
            return True

        return False


tag = CRUDTag(Tag)
