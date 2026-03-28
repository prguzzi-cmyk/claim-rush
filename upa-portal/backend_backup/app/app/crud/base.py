#!/usr/bin/env python

"""Base class for CRUD operations"""

from typing import Annotated, Any, Generic, Sequence, Type, TypeVar
from uuid import UUID

from fastapi import Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import validate_lock
from app.db.base_class import Base

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

    def get(self, db_session: Session, *, obj_id: UUID) -> ModelType | None:
        """
        Retrieve a single record by ID

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object

        Returns
        -------
        ModelType
            On success, returns the found record, or None if nothing is found.
        """
        with db_session as session:
            stmt = select(self.model).where(self.model.id == obj_id)
            return session.scalars(stmt).first()

    def get_multi(
        self, db_session: Annotated[Session, Query()], skip: int = 0, limit: int = 100
    ) -> Sequence[ModelType] | None:
        """
        Get multiple records of a specific model

        Parameters
        ----------
        db_session : Session
            Database session
        skip : int
            Set offset in the query
        limit :
            Limit number of records in the query

        Returns
        -------
        Sequence[ModelType] or None
            On success, return the found records. None if nothing is found.
        """
        with db_session as session:
            stmt = select(self.model).offset(skip).limit(limit)
            return session.scalars(stmt).all()

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
            obj_data = jsonable_encoder(db_obj)

            if isinstance(obj_in, dict):
                update_data = obj_in
            else:
                update_data = obj_in.dict(exclude_unset=True)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data:
                    setattr(db_obj, field, update_data[field])

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj

    def remove(self, db_session: Session, *, obj_id: UUID) -> ModelType | None:
        """
        Delete a record in the database.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of the object to delete

        Returns
        -------
        ModelType
            Returns the deleted object, or None if not found.
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
