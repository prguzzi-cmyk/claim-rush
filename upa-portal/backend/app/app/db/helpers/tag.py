#!/usr/bin/env python

from sqlalchemy.orm import Session

from app import crud, schemas
from app.models import Tag as TagModel
from app.utils.app import get_app_tags
from app.utils.common import slugify


class Tag:
    """Helper to create required tags"""

    def __init__(self):
        """
        Initialize Tag helper class.
        """
        self.tags = get_app_tags()

    def create(self, db_session: Session) -> list[TagModel]:
        """
        Add tags to the database.

        Parameters
        ----------
        db_session : Session
            Database session

        Returns
        -------
        list
            A list consists of tags objects.
        """
        tags = []

        for tag in self.tags:
            slug = slugify(tag)

            tag_obj = crud.tag.get_by_slug(db_session, slug=slug)
            if not tag_obj:
                tag_in = schemas.TagCreate(
                    name=tag,
                    can_be_removed=False,
                )
                result = crud.tag.create(db_session, obj_in=tag_in)

                tags.append(result)

        return tags
