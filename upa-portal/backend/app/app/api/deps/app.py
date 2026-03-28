#!/usr/bin/env python

"""App Dependencies"""

from datetime import date
from enum import Enum
from typing import Annotated, Any, Generator
from uuid import UUID

from fastapi import Query, Depends
from sqlalchemy.orm import Session

from app.core.enums import ReportPeriodType
from app.core.read_params_attrs import Ordering
from app.db.session import SessionLocal
from app.service_locator import AppServiceLocator


def get_db_session() -> Generator[Session, None, None]:
    """
    Generator function to yield database session.
    """
    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()


def get_service_locator(
    db_session: Session = Depends(get_db_session),
) -> AppServiceLocator:
    """
    Provides the AppServiceLocator with necessary dependencies.

    Parameters
    ----------
    db_session : Session
        The database session to use for initializing the service locator.

    Returns
    -------
    AppServiceLocator
        The application-specific service locator instance.
    """
    return AppServiceLocator(db_session)


class CommonReadParams:
    """Common query parameters related to the read endpoint."""

    def __init__(self, search_enum: Enum.__class__, sort_enum: Enum.__class__):
        self.search_enum = search_enum
        self.sort_enum = sort_enum

    def search_field(self) -> Any:
        """
        Get search field query parameter.

        Returns
        -------
        Any
            Search field query parameter.
        """
        return Annotated[
            self.search_enum,
            Query(title="Search Field", description="A search attribute name."),
        ]

    @staticmethod
    def search_value() -> Any:
        """
        Get search value query parameter.

        Returns
        -------
        Any
            Search value query parameter.
        """
        return Annotated[
            str | UUID | date,
            Query(
                description="Specify the value to search for string.\n\n "
                "_**Note:** "
                "For UUID fields provide the exact UUID string. "
                "For date fields provide the exact ISO Date format (yyyy-mm-dd). "
                "For boolean fields only true/false are allowed._",
            ),
        ]

    def sort_by(self) -> Any:
        """
        Get sort by query parameter.

        Returns
        -------
        Any
            Sort by query parameter.
        """
        return Annotated[
            self.sort_enum,
            Query(
                title="Sort By",
                description="Specify the attribute to sort by.",
            ),
        ]

    @staticmethod
    def order_by() -> Any:
        """
        Get order by query parameter.

        Returns
        -------
        Any
            Order by query parameter.
        """
        return Annotated[
            Ordering,
            Query(
                title="Order By",
                description="Specify the ordering for the sort field.",
            ),
        ]


class CommonLimitRowsParams:
    """Dependency for common skip and limit query parameters."""

    def __init__(
        self,
        skip: Annotated[
            int | None, Query(description="Number of records to skip.")
        ] = None,
        limit: Annotated[
            int | None, Query(description="Number of records to fetch.")
        ] = None,
    ):
        self.skip = skip
        self.limit = limit


class RemovedRecQueryParam:
    """Dependency for removed records query parameter."""

    def __init__(
        self,
        only_removed: Annotated[
            bool, Query(description="Fetch only removed records?")
        ] = False,
    ):
        self.only_removed = only_removed


class RepPeriodTypeQueryParam:
    """Dependency for report period type query parameter."""

    def __init__(
        self,
        period_type: Annotated[
            ReportPeriodType,
            Query(title="Period Type", description="Period type for a report."),
        ] = ReportPeriodType.CURRENT_MONTH,
    ):
        self.period_type = period_type


class DateRangeQueryParams:
    """Dependency for common start date and end date query parameters."""

    def __init__(
        self,
        start_date: Annotated[
            date,
            Query(
                description="Start date for records filtration. \n\n"
                "_**Note:** "
                "Only ISO Date format (yyyy-mm-dd) allowed._"
            ),
        ] = None,
        end_date: Annotated[
            date,
            Query(
                description="End date for records filtration. \n\n"
                "_**Note:** "
                "Only ISO Date format (yyyy-mm-dd) allowed._"
            ),
        ] = None,
    ):
        self.start_date = start_date
        self.end_date = end_date


class ReqDateRangeQueryParams:
    """Dependency for common start date and end date query parameters."""

    def __init__(
        self,
        start_date: Annotated[
            date,
            Query(
                description="Start date for records filtration. \n\n"
                "_**Note:** "
                "Only ISO Date format (yyyy-mm-dd) allowed._"
            ),
        ],
        end_date: Annotated[
            date,
            Query(
                description="End date for records filtration. \n\n"
                "_**Note:** "
                "Only ISO Date format (yyyy-mm-dd) allowed._"
            ),
        ],
    ):
        self.start_date = start_date
        self.end_date = end_date
