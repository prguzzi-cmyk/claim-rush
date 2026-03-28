#!/usr/bin/env python

"""Announcements related utility functions"""

from sqlalchemy.orm import Session

from app import crud, models
from app.schemas import (
    AnnouncementActivityCreateDB,
    AnnouncementActivityUpdate,
    AnnouncementCreate,
    AnnouncementUpdate,
)
from app.utils.exceptions import exc_forbidden


def validate_dates(
    obj_in: AnnouncementCreate | AnnouncementUpdate, db_obj: models.Announcement = None
) -> None:
    """
    Check if provided announcement and expiration dates are valid.

    Parameters
    ----------
    obj_in: AnnouncementCreate | AnnouncementUpdate
        Announcement inward data
    db_obj: models.Announcement
        Announcement model object

    Raises
    ------
    HTTPException:
       If dates are not valid.
    """
    announcement_date = None
    expiration_date = None

    if obj_in.announcement_date:
        announcement_date = obj_in.announcement_date

    if obj_in.expiration_date:
        expiration_date = obj_in.expiration_date

    if announcement_date is None and isinstance(obj_in, AnnouncementUpdate):
        announcement_date = db_obj.announcement_date

    if expiration_date is None and isinstance(obj_in, AnnouncementUpdate):
        expiration_date = db_obj.expiration_date

    if expiration_date is not None and announcement_date >= expiration_date:
        exc_forbidden(
            f"The announcement date `{announcement_date}` "
            f"can't be after the expiration date `{expiration_date}.`"
        )


def validate_activity_duplicity(
    db_session: Session,
    activity_obj: (
        models.AnnouncementActivity
        | AnnouncementActivityCreateDB
        | AnnouncementActivityUpdate
    ),
) -> None:
    """
    Validates if the announcement user activity already exist.

    Parameters
    ----------
    db_session : Session
        The database object.
    activity_obj : models.AnnouncementActivity |
    AnnouncementActivityCreateDB | AnnouncementActivityUpdate
        Announcement User Activity model or schema object

    Raises
    ------
    HTTPException:
       If the record already exists.
    """
    if crud.announcement_activity.is_exist(db_session, activity_obj):
        exc_forbidden("This activity already exists in the database.")
