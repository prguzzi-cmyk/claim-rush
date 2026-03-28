#!/usr/bin/env python
"""
Seed a local development admin user.

Usage:
    cd /Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/upa-portal/backend/app
    python seed_admin.py

Creates:
    Email:    admin@local.com
    Password: admin123
    Role:     super-admin
"""

import logging
import sys
from uuid import uuid4

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed() -> None:
    from app.db.session import SessionLocal
    from app.core.security import get_password_hash
    from app.models.user import User
    from app.models.role import Role
    from sqlalchemy import select

    db = SessionLocal()
    try:
        # 1. Find or create the super-admin role
        role = db.execute(
            select(Role).where(Role.name == "super-admin")
        ).scalar_one_or_none()

        if not role:
            logger.info("Creating 'super-admin' role...")
            role = Role(
                id=uuid4(),
                name="super-admin",
                display_name="Super Admin",
            )
            db.add(role)
            db.flush()
            logger.info("Role created: %s", role.id)
        else:
            logger.info("Role 'super-admin' already exists: %s", role.id)

        # 2. Check if admin user already exists
        existing = db.execute(
            select(User).where(User.email == "admin@local.com")
        ).scalar_one_or_none()

        if existing:
            logger.info("User admin@local.com already exists (id=%s). Updating password...", existing.id)
            existing.hashed_password = get_password_hash("admin123")
            existing.is_active = True
            existing.role_id = role.id
            db.commit()
            logger.info("Password updated successfully.")
        else:
            logger.info("Creating admin@local.com...")
            user = User(
                id=uuid4(),
                first_name="Admin",
                last_name="User",
                email="admin@local.com",
                hashed_password=get_password_hash("admin123"),
                is_active=True,
                role_id=role.id,
                national_access=True,
                is_accepting_leads=True,
                daily_lead_limit=100,
            )
            db.add(user)
            db.commit()
            logger.info("Admin user created: %s", user.id)

        logger.info("")
        logger.info("=" * 50)
        logger.info("  LOCAL DEV ADMIN READY")
        logger.info("  Email:    admin@local.com")
        logger.info("  Password: admin123")
        logger.info("  Role:     super-admin")
        logger.info("=" * 50)

    except Exception as e:
        db.rollback()
        logger.error("Failed to seed admin user: %s", e, exc_info=True)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
