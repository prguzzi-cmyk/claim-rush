#!/usr/bin/env python

"""CRUD operations for the category and category_meta model"""

from typing import Any, Sequence, Annotated, List, Type
from uuid import UUID

from fastapi import Query
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app import crud
from app.core.rbac import Roles
from app.core.security import get_password_hash, verify_password
from app.crud.base import CRUDBase
from app.db.mixins import TimestampMixin
from app.models import Role, UserMeta
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryUpdateRequest, CategoryCreateRequest
from app.schemas.user import UserCreate, UserUpdate, UserUpdateMe
from app.utils.common import slugify, custom_jsonable_encoder


class CRUDCategory(CRUDBase[Category, CategoryCreateRequest, CategoryUpdateRequest]):

    @staticmethod
    def get_all(db_session: Session) -> list[Type[Category]]:
        with db_session as session:
            return session.query(Category).all()

    @staticmethod
    def get_all_by_category_id(db_session: Session, category_id: UUID) -> list[Type[Category]]:
        with db_session as session:
            return session.query(Category).filter(Category.parent_id == category_id).all()


category = CRUDCategory(Category)
