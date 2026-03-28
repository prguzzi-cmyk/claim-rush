#!/usr/bin/env python

"""Initialize database with default data

Make sure all SQL Alchemy models are imported (app.db.base) before
initializing DB

Otherwise, SQL Alchemy might fail to initialize relationships properly
"""

from sqlalchemy.orm import Session

from app.service_locator import AppServiceLocator
from app.services import RoleAndPermissionSyncService
from app.services.sync_manager import SyncManager


def init_db(db_session: Session) -> None:
    # Create the service locator with the db_session
    service_locator = AppServiceLocator(db_session)

    # Create required services
    role_service = service_locator.get_role_service()
    permission_service = service_locator.get_permission_service()

    # Initialize the synchronization process
    role_and_permission_sync_service = RoleAndPermissionSyncService(
        role_service, permission_service
    )

    # Add services to SyncManager
    sync_manager = SyncManager([role_and_permission_sync_service])

    # Run all sync services
    sync_manager.sync_all()

    # # # Create required permissions
    # permissions = Permission(Modules.get_with_operations()).create(db_session)
    #
    # # Create required roles
    # roles_permissions = Roles.get_with_permissions(permissions=permissions)
    # roles = Role(roles_permissions).create(db_session)
    #
    # # Create required users
    # users = get_app_users()
    # for user in users:
    #     if user in roles.keys():
    #         users[user]["role_id"] = roles[user].id
    #
    # User(users=users).create(db_session)
    #
    # # Create required tags
    # Tag().create(db_session)
