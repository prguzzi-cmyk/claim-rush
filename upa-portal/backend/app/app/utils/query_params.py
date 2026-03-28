#!/usr/bin/env python

from datetime import date
from enum import Enum
from typing import Callable, Type
from uuid import UUID

from fastapi import Query
from pydantic import parse_obj_as, ValidationError

from app.db.enums import SortOrder


class QueryParams:
    """
    A utility class providing reusable query parameters for FastAPI endpoints. This class offers
    standardized methods for common query parameters.

    The methods are designed to be reused across different modules in a FastAPI application,
    allowing for flexible and dynamic query parameter management.
    """

    @staticmethod
    def search_field(enum_class: Type[Enum]) -> Callable[..., Enum | None]:
        """
        Creates a dependency for the `search_field` query parameter, allowing the
        user to specify an Enum-based search field.

        Parameters
        ----------
        enum_class : Type[Enum]
            The Enum class that defines the valid search fields.

        Returns
        -------
        Callable[..., Enum | None]
            A callable dependency that can be used in FastAPI routes to include the
            `search_field` query parameter with the specified Enum class.
        """

        def dependency(
            search_field: enum_class | None = Query(
                None,
                title="Search Field",
                description=f"Search field for {enum_class.__name__}",
            ),
        ) -> enum_class | None:
            """
            Returns the value of the `search_field` query parameter.

            Parameters
            ----------
            search_field : enum_class | None
                The Enum value that represents the search field.

            Returns
            -------
            enum_class | None
                The value of the `search_field` query parameter or None if not provided.
            """
            return search_field

        return dependency

    @staticmethod
    def search_value() -> Callable[..., str | UUID | bool | date | None]:
        """
        Creates a dependency for the `search_value` query parameter, allowing for the value
        to be searched, which could be a string, UUID, boolean, or date.

        Returns
        -------
        Callable[..., str | UUID | bool | date | None]
            A callable dependency that validates the search value and converts it into
            the appropriate type (str, UUID, bool, or date).

        Raises
        ------
        HTTPException
            If the value cannot be converted into the expected types.
        """

        def dependency(
            search_value: str | None = Query(
                None,
                description=f"The value to search for, corresponding to the selected search field.\n\n"
                "**Note:**\n"
                "- For UUID fields, provide the exact UUID string (e.g., 3fa85f64-5717-4562-b3fc-2c963f66afa6).\n"
                "- For boolean fields, True/true/1/False/false/0 are allowed.\n"
                "- For date fields, provide the exact ISO Date format (yyyy-mm-dd).",
            )
        ) -> str | UUID | bool | date | None:
            if search_value is None:
                return None

            # Attempt to parse as UUID
            if len(search_value) == 36:
                try:
                    return parse_obj_as(UUID, search_value)
                except ValidationError:
                    pass

            # Attempt to parse as bool
            try:
                return parse_obj_as(bool, search_value)
            except ValidationError:
                pass

            # Attempt to parse as date
            if len(search_value) in [10]:
                try:
                    return parse_obj_as(date, search_value)
                except ValidationError:
                    pass

            # If not UUID, bool, or date, return as string
            return search_value

        return dependency

    @staticmethod
    def sort_by(field_enum: Type[Enum]) -> Callable[..., dict]:
        """
        Dependency for sorting by a field and order.

        Parameters
        ----------
        field_enum : Type[Enum]
            Enum class representing the fields to sort by.

        Returns
        -------
        Callable[..., dict]
            Dependency function returning the sort field and order as a dictionary.
        """

        def dependency(
            sort_field: field_enum | None = Query(
                None,
                title="Sort Field",
                description="Field to sort the results by.",
            ),
            sort_order: SortOrder | None = Query(
                SortOrder.DESC,
                title="Sort Order",
                description="Order to sort the results by. Use 'asc' for ascending and 'desc' for descending.",
            ),
        ) -> dict:
            """
            Dependency function to provide sorting parameters.

            Parameters
            ----------
            sort_field : field_enum | None
                The field by which the results should be sorted. The field should be one of the values defined in the
                provided enum class.
                If not provided, the default is `None`, which means no sorting by field will be applied.

            sort_order : SortOrder | None
                The order in which to sort the results. This should be either 'asc' for ascending or
                'desc' for descending.
                If not provided, the default is `SortOrder.DESC` (descending order).

            Returns
            -------
            dict
                A dictionary with two keys:
                - `sort_field`: The value of the selected sort field if provided, otherwise `None`.
                - `sort_order`: The value of the sorting order if provided, otherwise `None`.

            Notes
            -----
            The `sort_field` is validated against the enum class provided when creating the dependency function.
            Ensure that the `field_enum` contains all possible sort fields for this query.
            """
            return {
                "sort_field": sort_field.value if sort_field else None,
                "sort_order": sort_order.value,
            }

        return dependency

    @staticmethod
    def only_removed(default_value: bool = False) -> Callable[..., bool]:
        """
        Provides a query parameter for filtering entities based on their removal status.

        This method creates a dependency for a query parameter that indicates whether to include
        only removed (soft-deleted) entities in the response. The default value for this parameter
        can be set as needed.

        Parameters
        ----------
        default_value : bool, optional
            The default value for the `only_removed` query parameter. Defaults to `False`, meaning
            only non-removed entities are included.

        Returns
        -------
        Callable[..., bool]
            A dependency function that extracts and returns the `only_removed` query parameter value.
        """

        def dependency(
            only_removed: bool = Query(
                default_value,
                title="Include Removed Entities",
                description="If True, includes only entities that have been soft-deleted (removed)."
                " If False, includes only non-removed entities.",
            )
        ) -> bool:
            """
            Extracts the `only_removed` query parameter value.

            Parameters
            ----------
            only_removed : bool
                A boolean flag indicating whether to include only removed entities.

            Returns
            -------
            bool
                The value of the `only_removed` query parameter.
            """
            return only_removed

        return dependency

    @staticmethod
    def even_removed(default_value: bool = False) -> Callable[..., bool]:
        """
        Creates a dependency for the `even_removed` query parameter.

        Parameters
        ----------
        default_value : bool, optional
            The default value for the `even_removed` query parameter. Defaults to False.

        Returns
        -------
        Callable[..., bool]
            A callable dependency that can be used in FastAPI routes to include the
            `even_removed` query parameter with the specified default value.
        """

        def dependency(
            even_removed: bool = Query(
                default_value,
                description="If True, includes removed (soft-deleted) entities.",
            )
        ) -> bool:
            """
            Returns the value of the `even_removed` query parameter.

            Parameters
            ----------
            even_removed : bool
                Whether to include removed (soft-deleted) entities.

            Returns
            -------
            bool
                The value of the `even_removed` query parameter.
            """
            return even_removed

        return dependency
