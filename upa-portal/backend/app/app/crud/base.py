#!/usr/bin/env python

"""Base class for CRUD operations"""

from enum import Enum
from typing import Annotated, Any, Generic, Type, TypeVar
from uuid import UUID

from fastapi import Query
from fastapi.encoders import jsonable_encoder
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from pydantic import BaseModel
from sqlalchemy import and_, select, Sequence
from sqlalchemy.orm import Session

from app.core.log import logger
from app.core.security import is_removed, validate_lock
from app.db.base_class import Base
from app.utils.common import custom_jsonable_encoder
from app.utils.exceptions import exc_conflict

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).

        Parameters
        ----------
        model : Type[ModelType]
            A SQLAlchemy model class
        """
        self.model = model

    def get(
        self, db_session: Session, *, obj_id: UUID, even_removed: bool = False
    ) -> ModelType | None:
        """
        Retrieve a single record by ID

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object
        even_removed : bool
            Fetch even if removed

        Returns
        -------
        ModelType
            On success, returns the found record, or None if nothing is found.
        """
        with db_session as session:
            stmt = select(self.model)
            if even_removed:
                stmt = stmt.where(self.model.id == obj_id)
            else:
                if hasattr(self.model, "is_removed"):
                    stmt = stmt.where(
                        and_(
                            self.model.id == obj_id,
                            getattr(self.model, "is_removed").is_(False),
                        )
                    )
                else:
                    stmt = stmt.where(self.model.id == obj_id)

            return session.scalar(stmt)

    def get_multi(
        self,
        db_session: Annotated[Session, Query()],
        join_target: set = None,
        is_outer: bool = False,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
        paginated: bool = True,
    ) -> Page | Sequence[ModelType] | None:
        """
        Get a list of records of a specific model

        Parameters
        ----------
        db_session : Session
            Database session
        join_target : set
            A set of Join target model/s
        is_outer : bool
            Implement Full Outer Join
        removed : bool
            Fetch only removed records
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns
        paginated : bool
            Add pagination to the response

        Returns
        -------
        Page | Sequence[ModelType] | None
            On success, return the found records. None if nothing is found.
        """
        with db_session as session:
            try:
                stmt = select(self.model)

                # Apply Join
                if join_target:
                    for target in join_target:
                        if is_outer:
                            stmt = stmt.outerjoin(target)
                        else:
                            stmt = stmt.join(target)

                # Removed records query
                if hasattr(self.model, "is_removed"):
                    stmt = stmt.where(getattr(self.model, "is_removed").is_(removed))

                # Apply filters
                if filters:
                    stmt = stmt.filter(and_(*filters))

                # Apply ordering
                if order_by:
                    stmt = stmt.order_by(*order_by)
                else:
                    stmt = stmt.order_by(self.model.created_at)

                if paginated:
                    return paginate(session, stmt)
                else:
                    if join_target:
                        return session.scalars(stmt).unique().all()
                    else:
                        return session.scalars(stmt).all()
            except Exception as e:
                logger.error(str(e))
                exc_conflict(
                    "There is some issue with the provided values. "
                    "Please check and try again."
                )

    def create(self, db_session: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """
        Creates a new record in the database.

        Parameters
        ----------
        db_session : Session
             Database session
        obj_in : CreateSchemaType
            Schema object to create a record

        Returns
        -------
        ModelType
            Return a newly created record.
        """
        with db_session as session:
            obj_in_data = jsonable_encoder(obj_in)

            db_obj = self.model(**obj_in_data)  # type: ignore

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj

    def update(
        self,
        db_session: Session,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        """
        Update a record in the database.

        Parameters
        ----------
        db_session : Session
            Database session
        db_obj : ModelType
            Database model object
        obj_in : UpdateSchemaType
            Data to update in the database

        Returns
        -------
        ModelType
            Returns updated record.
        """
        with db_session as session:
            obj_data = custom_jsonable_encoder(db_obj)

            if isinstance(obj_in, dict):
                update_data = obj_in
            else:
                update_data = obj_in.dict(exclude_unset=True)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and isinstance(update_data[field], Enum):
                    setattr(db_obj, field, update_data[field].value)
                elif field in update_data:
                    setattr(db_obj, field, update_data[field])

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj

    def restore(
        self,
        db_session: Session,
        *,
        db_obj: ModelType,
    ) -> ModelType:
        """
        Restore a record in the database.

        Parameters
        ----------
        db_session : Session
            Database session
        db_obj : ModelType
            Database model object

        Returns
        -------
        ModelType
            Returns updated record.
        """
        is_removed(db_obj)

        obj_in = dict(is_removed=False)

        db_obj = self.update(db_session=db_session, db_obj=db_obj, obj_in=obj_in)

        return db_obj

    def remove(self, db_session: Session, *, obj_id: UUID) -> ModelType | None:
        """
        Soft Delete a record in the database.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of the object to delete

        Returns
        -------
        ModelType
            Returns the soft deleted object, or None if not found.
        """
        with db_session as session:
            obj = self.get(db_session, obj_id=obj_id)
            if obj:
                validate_lock(obj)

                obj.is_removed = True

                session.add(obj)
                session.commit()
                session.refresh(obj)

        return obj

    def hard_remove(self, db_session: Session, *, obj_id: UUID) -> dict | None:
        """
        Delete a record permanently in the database.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of the object to delete

        Returns
        -------
        ModelType
            Returns the message on success, or None if not found.
        """
        with db_session as session:
            obj = self.get(db_session, obj_id=obj_id)
            if obj:
                validate_lock(obj)

                session.delete(obj)
                session.commit()

        return {"msg": "Record deleted successfully."}
