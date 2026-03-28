#!/usr/bin/env python

"""Initialize database with default data

Make sure all SQL Alchemy models are imported (app.db.base) before
initializing DB

Otherwise, SQL Alchemy might fail to initialize relationships properly
"""

from sqlalchemy.orm import Session

from app.core.rbac import Modules, Roles
from app.db.helpers import Permission, Role, User
from app.utils.user import get_sys_users


def init_db(db_session: Session) -> None:
    # Create required permissions
    permissions = Permission(Modules.get_with_operations()).create(db_session)

    # Create required roles
    roles_permissions = Roles.get_with_permissions(permissions=permissions)
    roles = Role(roles_permissions).create(db_session)

    # Create required users
    users = get_sys_users()
    for user in users:
        if user in roles.keys():
            users[user]["role_id"] = roles[user].id

    User(users=users).create(db_session)
