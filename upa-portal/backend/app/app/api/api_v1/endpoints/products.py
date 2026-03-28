# !/usr/bin/env python

"""Routes for the Product module"""
import decimal
from decimal import Decimal
from typing import Annotated, Any, Optional
from uuid import UUID

import starlette.datastructures
from fastapi import APIRouter, Depends, File, Form, Path, status, HTTPException, UploadFile, Query
from pydantic import UUID4, validator
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.enums import FileModules
from app.core.log import logger
from app.core.rbac import Modules
from app.models.product import Product
from app.schemas import ClientFileProcess
from app.schemas.product import ProductCreatedRequest, ProductCreatedResponse, ProductUpdatedResponse, \
    ProductUpdatedRequest
from app.utils.client import process_client_file, validate_client_ownership
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.file import FileUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3
from app.utils.sql_stmt_generator import ClientSqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.SHOP_MANAGEMENT.value)
stmt_gen = ClientSqlStmtGenerator(Product)


@router.post(
    "",
    summary="Create A New Product",
    response_description="Product Created",
    response_model=schemas.ProductCreatedResponse,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_product(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
        name: Annotated[str, Form(description="Product name")],
        original_price: Annotated[Decimal, Form(description="The Original Price.")],
        price: Annotated[Decimal, Form(description="The Price.")],
        description: Annotated[str | None, Form(description="File description.")],
        file: Annotated[UploadFile, File(description="Uploaded file.")],
        file_name: Annotated[
            str, Form(max_length=255, description="File name.")
        ] = None,
        category_id: Annotated[
            UUID4 | str, Form(description="The UUID of the category. Can be null.")] = None,
) -> Any:
    """create a new product"""
    UserContext.set(current_user.id)
    # initial file object which will send to s3
    ext = get_file_extension(file.filename)
    object_name = f"{settings.SHOPPING_CART_DIR_PATH}/{slugify(file_name)}{ext}"
    file_path = f"{settings.SHOPPING_CART_URL_PATH}{slugify(file_name)}{ext}"

    try:
        file.file.seek(0)
        S3.upload_file_obj(file=file, object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)
        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    # save result to db
    request = ProductCreatedRequest()
    request.name = name
    request.category_id = category_id
    request.original_price = original_price
    request.price = price
    request.description = description
    request.product_image = file_path
    request.object_name = object_name
    product = crud.product.create(db_session, obj_in=request)

    return ProductCreatedResponse.from_orm(product)


@router.put(
    "/{product_id}",
    summary="Update Product",
    response_description="Product Updated",
    response_model=ProductUpdatedResponse,
    dependencies=[
        Depends(permissions.update()),
    ],
    status_code=status.HTTP_200_OK,
)
def update_product(
        product_id: Annotated[UUID, Path(description="The product id")],
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
        name: Annotated[str, Form(description="Product name")],
        original_price: Annotated[Decimal, Form(description="The Original Price.")],
        price: Annotated[Decimal, Form(description="The Price.")],
        description: Annotated[str | None, Form(description="File description.")],
        file: Annotated[UploadFile | None | str, File(description="Uploaded file.")] = None,
        file_name: Annotated[
            str | None, Form(max_length=255, description="File name.")
        ] = None,
        category_id: Annotated[
            UUID4 | str, Form(description="The UUID of the category. Can be null.")] = None,
) -> Any:
    """create a new product"""
    UserContext.set(current_user.id)
    # initial file object which will send to s3
    object_name = None
    file_path = None
    if isinstance(file, starlette.datastructures.UploadFile):
        ext = get_file_extension(file.filename)
        object_name = f"{settings.FILE_DIR_PATH}/{slugify(file_name)}{ext}"
        file_path = f"{settings.FILE_URL_PATH}{slugify(file_name)}{ext}"

        try:
            file.file.seek(0)
            S3.upload_file_obj(file=file, object_name=object_name)
        except Exception as e:
            # Log Exception
            logger.error(e)
            # Raise exception
            exc_internal_server("An error occurred while processing the file.")

    # save result to db
    product = crud.product.get(db_session, obj_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The product with id does not exist in the system",
        )
    obj_in = ProductUpdatedRequest()
    obj_in.id = product_id
    obj_in.name = name
    obj_in.category_id = category_id
    obj_in.price = price
    obj_in.original_price = original_price
    obj_in.description = description
    if object_name is not None:
        obj_in.object_name = object_name
    if file_path is not None:
        obj_in.product_image = file_path
    product = crud.product.update(db_session, db_obj=product, obj_in=obj_in)

    return ProductUpdatedResponse.from_orm(product)


@router.delete(
    "/{product_id}",
    summary="Delete Product",
    response_description="Product deleted",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove())
    ]
)
def delete_product(
        product_id: Annotated[UUID, Path(description="The product id")],
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a product by providing an ID"""

    product = crud.product.get(db_session, obj_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The product with this id does not exist in the system",
        )
    try:
        S3.delete_file_obj(product.object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)
        # Raise exception
        exc_internal_server("An error occurred while processing the file.")
    msg = crud.product.hard_remove(db_session, obj_id=product_id)
    return msg


@router.get(
    "",
    summary="Read Product List",
    response_description="A list of product",
    response_model=CustomPage[schemas.product.ProductListResponse],
    status_code=status.HTTP_200_OK,
)
def get_product_list(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
        category_id: Annotated[UUID | None, Query(title="the category id of product")] = None
) -> Any:
    """get product list"""

    UserContext.set(current_user.id)

    if category_id is None:
        products = crud.product.get_multi(db_session, join_target=stmt_gen.join_stmt())
        return products
    else:
        cates = crud.category.get_all(db_session)
        sub_cates = find_subcategories(category_id, cates)
        products = crud.product.get_multi_by_cate_id(db_session, sub_cates)
        return products


def find_subcategories(cate_id, categories):
    # Store found subcategories
    subcategories = [cate_id]

    # Iterate through all categories
    for category in categories:
        # If a parent_id equal to cate_id is found
        if category.parent_id == cate_id:
            # Add it to the subcategories list
            subcategories.append(category.id)
            # Recursively find subcategories of the current category
            subcategories.extend(find_subcategories(category.id, categories))

    return subcategories
