#!/usr/bin/env python

import datetime
from enum import Enum
from typing import Any, TypeVar, Tuple
from uuid import UUID

from sqlalchemy import select, Select, Column, and_
from sqlalchemy.orm import aliased
from sqlalchemy.orm.util import AliasedClass

from app.db.base_class import Base
from app.db.enums import SortOrder
from app.db.relationships_mapping import RELATIONSHIPS_MAPPING

ModelType = TypeVar("ModelType", bound=Base)


class QueryBuilder:
    """
    Utility class for constructing complex SQLAlchemy queries based on filters and sorting.

    Attributes
    ----------
    model : ModelType
        The SQLAlchemy model on which queries will be built.
    relationships_mapping : dict
        A dictionary mapping fields to their related models.
    query : Select
        The SQLAlchemy select statement.
    """

    def __init__(self, model: ModelType):
        """
        Parameters
        ----------
        model : ModelType
            The SQLAlchemy model on which the queries will be based.
        """
        self.model = model
        self.joined = False

        # Automatically load relationships mapping from the global RELATIONSHIPS_MAPPING based on model name
        self.relationships_mapping = RELATIONSHIPS_MAPPING.get(self.model.__name__, {})

        # The select statement
        self.query: Select = select(self.model)

    def apply_filters(
        self,
        filters: dict[str, Any],
    ) -> "QueryBuilder":
        """
        Apply filters to the query based on the provided dictionary.

        Parameters
        ----------
        filters : dict[Enum, Any]
            A dictionary where the key is the field to filter on and the value is the filter condition.

        Returns
        -------
        QueryBuilder
            The QueryBuilder object with the applied filters.
        """
        if filters is None:
            return self

        for field_name, field_value in filters.items():
            if field_name is None or field_value is None:
                continue

            # Check for relationship field
            if field_name in self.relationships_mapping:
                field_name, model = self.apply_relationship(field_name)
            else:
                model = self.model

            # Get column attribute from a model
            column: Column = getattr(model, field_name, None)
            if column is None:
                continue

            # Handle special types like UUID, date, etc.
            if isinstance(field_value, UUID):
                self.query = self.query.filter(column == field_value)
            elif isinstance(field_value, bool):
                self.query = self.query.filter(column.is_(field_value))
            elif isinstance(field_value, datetime.date):
                self.query = self.query.filter(column == field_value)
            elif isinstance(field_value, str):
                self.query = self.query.filter(column.ilike(f"%{field_value}%"))

        return self

    def apply_sorting(self, sort_field: str, sort_order: str) -> "QueryBuilder":
        """
        Apply sorting to the query.

        Parameters
        ----------
        sort_field : str
            The field to sort the results by.
        sort_order : str
            The order in which to sort(either 'asc' or 'desc').

        Returns
        -------
        QueryBuilder
            The QueryBuilder object with the applied sorting.
        """
        if sort_field is None:
            return self
        else:
            field_name = sort_field

        # Check for relationship field
        if sort_field in self.relationships_mapping:
            field_name, model = self.apply_relationship(sort_field)
        else:
            model = self.model

        # Get column attribute from a model
        column: Column = getattr(model, field_name, None)
        if column is None:
            return self

        if sort_order == SortOrder.ASC:
            self.query = self.query.order_by(column.asc())
        else:
            self.query = self.query.order_by(column.desc())

        return self

    def apply_soft_removed_filter(self, only_removed: bool) -> "QueryBuilder":
        """
        Apply a filter to include or exclude soft-deleted records based on the `is_removed` field.

        Parameters
        ----------
        only_removed : bool
            A boolean indicating whether to filter for soft-deleted records (True) or non-deleted records (False).

        Returns
        -------
        QueryBuilder
            The updated QueryBuilder object with the applied filter for removed records.
        """
        if hasattr(self.model, "is_removed"):
            self.query = self.query.filter(
                getattr(self.model, "is_removed").is_(only_removed)
            )

        return self

    def apply_relationship(self, field_name: str) -> Tuple[str, AliasedClass]:
        """
        Applies a relationship join to the query.

        Parameters
        ----------
        field_name : str
            The field name representing the relationship.

        Returns
        -------
        Tuple[str, AliasedClass]
            Returns the related column name and the aliased model for the relationship.
        """
        relationship_info = self.relationships_mapping[field_name]

        # Extract the related model class, on_clause field, and related column from the mapping
        related_model_name = relationship_info["related_model"]
        on_clause_field = relationship_info["on_clause"]
        related_column = relationship_info["related_column"]

        # Create an alias for the related model
        model = aliased(related_model_name)

        # Build the on_clause condition using the foreign key field and the related model's primary key
        on_clause = and_(getattr(self.model, on_clause_field) == getattr(model, "id"))

        self.query = self.query.outerjoin(model, on_clause)
        self.joined = True

        return related_column, model

    def get_query(self) -> Select:
        """
        Retrieve the current query object.

        This method returns the query object that has been built using the
        various filtering, sorting, and joining methods in the QueryBuilder.

        Returns
        -------
        Select
            The current SQLAlchemy Select query object that can be executed
            to retrieve results from the database.
        """
        return self.query
