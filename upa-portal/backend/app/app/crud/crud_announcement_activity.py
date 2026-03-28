#!/usr/bin/env python

"""CRUD operations for the Announcement Activity model"""

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import AnnouncementActivity
from app.schemas import AnnouncementActivityCreateDB, AnnouncementActivityUpdate


class CRUDAnnouncementActivity(
    CRUDBase[
        AnnouncementActivity, AnnouncementActivityCreateDB, AnnouncementActivityUpdate
    ]
):
    @staticmethod
    def is_exist(
        db_session: Session,
        activity_obj: (
            AnnouncementActivity
            | AnnouncementActivityCreateDB
            | AnnouncementActivityUpdate
        ),
    ) -> bool:
        """
        Check for existing announcement user activity record.

        Parameters
        ----------
        db_session : Session
            Database session
        activity_obj : AnnouncementActivity | AnnouncementActivityCreateDB | AnnouncementActivityUpdate # noqa: E501
            Incoming activity object

        Returns
        -------
        bool
            `True` if record found, otherwise `False`.
        """
        with db_session as session:
            res = session.scalar(
                select(AnnouncementActivity.timestamp).where(
                    and_(
                        AnnouncementActivity.user_id == activity_obj.user_id,
                        AnnouncementActivity.activity_type
                        == activity_obj.activity_type.value,
                        AnnouncementActivity.announcement_id
                        == activity_obj.announcement_id,
                    )
                )
            )

            return True if res else False


announcement_activity = CRUDAnnouncementActivity(AnnouncementActivity)
