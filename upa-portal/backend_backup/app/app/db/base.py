#!/usr/bin/env python

"""
Import all the models, so that Base has them before being imported by Alembic
"""

from app.db.base_class import Base  # noqa
from app.models.contact import Contact  # noqa
from app.models.follow_up import FollowUp  # noqa
from app.models.lead import Lead  # noqa
from app.models.permission import Permission  # noqa
from app.models.role import Role  # noqa
from app.models.user import User  # noqa
from app.models.user_meta import UserMeta  # noqa
