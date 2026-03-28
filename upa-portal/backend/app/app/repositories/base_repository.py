#!/usr/bin/env python

from enum import Enum
from typing import TypeVar, Generic, Type, Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate
from pydantic import BaseModel
from sqlalchemy import select, Sequence, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.log import logger
from app.db.base_class import Base
from app.exceptions import DatabaseOperationError
from app.utils.common import custom_jsonable_encoder
from app.utils.query_builder import QueryBuilder

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    A generic base repository providing common CRUD operations.

    Attributes
    ----------
    db_session : Session
        The database session used for database interactions.
    model : Type[ModelType]
        The model class representing the database table.
    """

    def __init__(self, db_session: Session, model: Type[ModelType]):
        """
        Initializes the base repository with a database session and a model.

        Parameters
        ----------
        db_session : Session
            The database session used for database interactions.
        model : Type[ModelType]
            The model class representing the database table.
        """
        self.db_session = db_session
        self.model = model

    def get(
        self,
        entity_id: UUID,
        even_removed: bool = False,
    ) -> ModelType | None:
        """
        Retrieves a single entity by its ID.

        Parameters
        ----------
        entity_id : UUID
            The ID of the entity to retrieve.
        even_removed : bool
            If True, then also looks into the removed entities. If False, then looks into non-removed entities only.
            Default is False.

        Returns
        -------
        ModelType | None
            The entity if found, otherwise None.

        Raises
        ------
        DatabaseOperationError
            If there is an issue retrieving entity.
        """
        with self.db_session as session:
            try:
                # The select statement
                stmt = select(self.model)

                # Apply where clause
                stmt = stmt.where(self.model.id == entity_id)

                # Apply filters
                if even_removed is False:
                    if hasattr(self.model, "is_removed"):
                        stmt = stmt.filter(getattr(self.model, "is_removed").is_(False))

                return session.scalar(stmt)
            except SQLAlchemyError as e:
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to retrieve {self.model.__name__} with ID {id}: {str(e)}"
                )

    def get_all(
        self,
        filters: dict[str, Any] | None = None,
        sort_field: str | None = None,
        sort_order: str | None = None,
        only_removed: bool = False,
        paginated: bool = True,
    ) -> Page | Sequence[ModelType] | None:
        """
        Retrieves all entities with optional filtering, ordering, and pagination.

        Parameters
        ----------
        filters : dict[str, Any] | None
            A dictionary of filters to apply to the query. If None, no filters are applied.
            Default is None.
        sort_field: str | None
            Sort the results by a specific field. If None, no specific ordering is applied.
            Default is None.
        sort_order: str | None
            Apply sort order to the results. If None, no specific ordering is applied.
            Default is None.
        only_removed : bool
            Filters entities based on their 'removed' status. If True, only removed entities are retrieved.
            If False, only non-removed entities are retrieved. Default is False.
        paginated : bool
            If True, returns a paginated result set. If False, returns all matching entities without pagination.
            Default is True.

        Returns
        -------
        Page | Sequence[ModelType] | None
            - If `paginated` is True, returns a `Page` object containing the paginated results.
            - If `paginated` is False, returns a sequence of `ModelType` objects matching the query.
            - Returns None if no entities match the query.

        Raises
        ------
        DatabaseOperationError
            If there is an issue retrieving entities.

        Notes
        -----
        The `get_all` method provides a flexible way to retrieve entities from the database, with optional
        support for joins, filtering, ordering, and pagination. The `filters` and `order_by` parameters
        provide control over the results' content and order.
        """
        with self.db_session as session:
            try:
                query_builder = QueryBuilder(self.model)
                query_builder.apply_filters(filters)
                query_builder.apply_soft_removed_filter(only_removed)
                query_builder.apply_sorting(sort_field, sort_order)
                stmt = query_builder.get_query()

                # Apply pagination
                if paginated:
                    return paginate(session, stmt)
                # Without pagination
                else:
                    if query_builder.joined:
                        return session.scalars(stmt).unique().all()
                    else:
                        return session.scalars(stmt).all()
            except SQLAlchemyError as e:
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to retrieve {self.model.__name__} entities: {str(e)}"
                )

    def create(self, entity: CreateSchemaType) -> ModelType:
        """
        Creates a new entity in the database.

        Parameters
        ----------
        entity : CreateSchemaType
            Schema object to create a database entity.

        Returns
        -------
        ModelType
            Return a newly created entity.

        Raises
        ------
        DatabaseOperationError
            If there is an issue creating the entity.
        """
        with self.db_session as session:
            try:
                entity_json = jsonable_encoder(entity)

                db_entity = self.model(**entity_json)  # type: ignore

                session.add(db_entity)
                session.commit()
                session.refresh(db_entity)

                return db_entity
            except SQLAlchemyError as e:
                session.rollback()
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to create {self.model.__name__}: {str(e)}"
                )

    def update(
        self,
        db_entity: ModelType,
        entity: UpdateSchemaType,
    ) -> ModelType:
        """
        Updates an existing entity in the database.

        Parameters
        ----------
        db_entity : ModelType
            The database entity.
        entity : UpdateSchemaType
            The schema entity to update the database entity.

        Returns
        -------
        ModelType
            The updated entity.

        Raises
        ------
        DatabaseOperationError
            If there is an issue updating the entity.
        """
        with self.db_session as session:
            try:
                entity_json = custom_jsonable_encoder(db_entity)

                if isinstance(entity, BaseModel):
                    entity = entity.dict(exclude_unset=True)

                # Set Model Schema attributes with the provided values
                for field in entity_json:
                    if field in entity:
                        value = (
                            entity[field].value
                            if isinstance(entity[field], Enum)
                            else entity[field]
                        )

                        setattr(db_entity, field, value)

                session.add(db_entity)
                session.commit()
                session.refresh(db_entity)

                return db_entity
            except SQLAlchemyError as e:
                session.rollback()
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to update {self.model.__name__}: {str(e)}"
                )

    def soft_remove(self, entity: ModelType) -> None:
        """
        Archive an entity by setting the `is_removed` attribute to True.

        Parameters
        ----------
        entity: ModelType
            The database entity to softly remove.

        Raises
        ------
        DatabaseOperationError
            If there is an issue archiving the entity.
        """
        with self.db_session as session:
            try:
                entity.is_removed = True

                session.add(entity)
                session.commit()
                session.refresh(entity)
            except SQLAlchemyError as e:
                session.rollback()
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to softly remove {self.model.__name__}: {str(e)}"
                )

    def hard_remove(self, entity: ModelType) -> None:
        """
        Permanently removes an entity from the database.

        Parameters
        ----------
        entity: ModelType
            The database entity to permanently remove.

        Raises
        ------
        DatabaseOperationError
            If there is an issue permanently removing the entity.
        """
        with self.db_session as session:
            try:
                session.delete(entity)
                session.commit()
            except SQLAlchemyError as e:
                session.rollback()
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to permanently remove {self.model.__name__}: {str(e)}"
                )

    def restore(self, entity: ModelType) -> ModelType:
        """
        Restores a soft-removed entity by setting the `is_removed` attribute to False.

        Parameters
        ----------
        entity: ModelType
            The database entity to restore.

        Returns
        -------
        ModelType
            The restored entity.

        Raises
        ------
        DatabaseOperationError
            If there is an issue restoring the entity.
        """
        with self.db_session as session:
            try:
                entity.is_removed = False

                session.add(entity)
                session.commit()
                session.refresh(entity)

                return entity
            except SQLAlchemyError as e:
                session.rollback()
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to restore {self.model.__name__}: {str(e)}"
                )

    @staticmethod
    def generate_new_ref_number(
        db_session: Session,
        entity_model: Type[Base],
        ref_field: str = "ref_number",
    ) -> int:
        """
        Generate the new reference number by incrementing the maximum reference number
        from the provided entity model.

        Parameters
        ----------
        db_session : Session
            Database session
        entity_model : Type[Base]
            The SQLAlchemy model class
        ref_field : str, optional
            The reference field in the entity model (default is "ref_number")

        Returns
        -------
        int
            Generated new reference number (incremented by one)
        """
        try:
            # Get the max reference number
            stmt = select(func.coalesce(func.max(getattr(entity_model, ref_field)), 0))
            result = db_session.execute(stmt).scalar()

            new_ref_number = result + 1

            # Ensure unique reference number
            while True:
                # Check if reference number is already present
                existing_ref = db_session.execute(
                    select(entity_model).where(
                        getattr(entity_model, ref_field) == new_ref_number
                    )
                ).scalar()

                if existing_ref is None:
                    break

                new_ref_number += 1

            return new_ref_number
        except SQLAlchemyError as e:
            logger.exception(e)
            raise DatabaseOperationError(
                f"Unable to generate new reference number for {entity_model.__name__}."
            )
