#!/usr/bin/env python

"""CRUD operations for the User Activity model"""

from app.crud.base import CRUDBase
from app.models import UserActivity
from app.schemas import UserActivityCreate, UserActivityUpdate


class CRUDUserActivity(CRUDBase[UserActivity, UserActivityCreate, UserActivityUpdate]):
    ...


user_activity = CRUDUserActivity(UserActivity)
