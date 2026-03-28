#!/usr/bin/env python

"""CRUD operations for the product model"""

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
from app.models.product import Product
from app.models.user import User
from app.schemas.category import CategoryUpdateRequest, CategoryCreateRequest
from app.schemas.product import ProductCreatedRequest, ProductUpdatedRequest
from app.schemas.user import UserCreate, UserUpdate, UserUpdateMe
from app.utils.common import slugify, custom_jsonable_encoder


class CRUDProduct(CRUDBase[Product, ProductCreatedRequest, ProductUpdatedRequest]):

    @staticmethod
    def get_multi_by_cate_id(
            db_session: Session,  cate_ids: Sequence[UUID]
    ) -> Sequence[Product] | None:
        """
        Retrieve a list of products of a specific category id list.
        """
        with db_session as session:
            stmt = select(Product).where(
                and_(Product.category_id.in_(cate_ids))
            )
            return paginate(session, stmt)


product = CRUDProduct(Product)
