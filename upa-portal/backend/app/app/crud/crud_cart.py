#!/usr/bin/env python

"""CRUD operations for the cart model"""

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
from app.models.cart import Cart
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.cart import CartCreatedRequest, CartUpdatedRequest
from app.schemas.category import CategoryUpdateRequest, CategoryCreateRequest
from app.schemas.product import ProductCreatedRequest, ProductUpdatedRequest
from app.schemas.user import UserCreate, UserUpdate, UserUpdateMe
from app.utils.common import slugify, custom_jsonable_encoder


class CRUDCart(CRUDBase[Cart, CartCreatedRequest, CartUpdatedRequest]):

    @staticmethod
    def get_all(db_session: Session, user_id: UUID) -> list[Type[Cart]]:
        with db_session as session:
            return session.query(Cart).filter(Cart.user_id == user_id).all()


cart = CRUDCart(Cart)
