#!/usr/bin/env python

"""Utility functions for the required application data."""

from datetime import date, datetime, timedelta

from app.core.config import settings, Settings
from app.core.enums import AppTags, ReportPeriodType
from app.core.log import logger
from app.core.rbac import Roles
from app.utils.exceptions import exc_bad_request


def get_app_users() -> dict[str, dict]:
    """
    Generate system default users with the help of environment variables.

    Returns
    -------
    dict
        A dictionary consists of system default users by their roles.
    """
    return {
        Roles.SUPER_ADMIN.value: {
            "first_name": settings.SYS_SU_FIRST_NAME,
            "last_name": settings.SYS_SU_LAST_NAME,
            "email": settings.SYS_SU_EMAIL,
            "password": settings.SYS_SU_PASSWORD,
            "role_id": "",
        },
        Roles.ADMIN.value: {
            "first_name": settings.SYS_AD_FIRST_NAME,
            "last_name": settings.SYS_AD_LAST_NAME,
            "email": settings.SYS_AD_EMAIL,
            "password": settings.SYS_AD_PASSWORD,
            "role_id": "",
        },
        Roles.AGENT.value: {
            "first_name": settings.SYS_AG_FIRST_NAME,
            "last_name": settings.SYS_AG_LAST_NAME,
            "email": settings.SYS_AG_EMAIL,
            "password": settings.SYS_AG_PASSWORD,
            "role_id": "",
        },
    }


def get_app_tags() -> list[str]:
    return [tag.value for tag in AppTags]


def get_user_id():
    from app.utils.contexts import UserContext

    try:
        user = UserContext.get()
        return user["id"]
    except Exception as e:
        logger.error(e)
        return None


def get_environment() -> str:
    """
    Get current application environment.

    Returns
    -------
    str
        Environment name of the application.
    """
    return settings.ENV


def is_production_environment() -> bool:
    """
    Check if current application environment is production.

    Returns
    -------
    bool
        Returns `True` if the environment is `production` else `False`.
    """
    return True if settings.ENV == "production" else False


class DateRange:
    """Date range operations."""

    @staticmethod
    def get_formatted_response(start_date: datetime, end_date: datetime) -> dict:
        """
        Get formatted response for a date range.

        Parameters
        ----------
        start_date : datetime
            Start datetime object.
        end_date : datetime
            End datetime object.

        Returns
        -------
        dict
            Formatted response for a date range.
        """
        return {"start_date": start_date, "end_date": end_date}

    @staticmethod
    def transform_to_midnight(date_obj: datetime | date) -> datetime:
        """
        Transform a time of date or datetime object to midnight time.

        Parameters
        ----------
        date_obj : datetime | date
            A date object.

        Returns
        -------
        datetime
            Transformed midnight date or datetime object.
        """
        return datetime(date_obj.year, date_obj.month, date_obj.day, 23, 59, 59, 99999)

    @staticmethod
    def last_day_of_month(year: int, month: int) -> int:
        """
        Get the last day of the month with the help of year and month.

        Parameters
        ----------
        year : int
            Year number.
        month : int
            Month number.

        Returns
        -------
        int
            The last day of the month.
        """
        # Calculate the first day of the next month
        next_month = month % 12 + 1
        next_year = year + (month // 12)

        # Calculate the last day of the current month
        last_day = date(next_year, next_month, 1) - timedelta(days=1)

        return last_day.day

    def get_by_current_year(self, year: int) -> dict:
        """
        Get date ranges for a particular year.

        Parameters
        ----------
        year : int
            Year number.

        Returns
        -------
        dict
            Combined start date and end date of a year.
        """
        start_date = datetime(year, 1, 1)
        end_date = self.transform_to_midnight(datetime(year, 12, 31))

        return self.get_formatted_response(start_date, end_date)

    def get_by_current_month(self, year: int, month: int) -> dict:
        """
        Get date ranges for a particular month.

        Parameters
        ----------
        year : int
            Year number.
        month : int
            Month number.

        Returns
        -------
        dict
            Combined start date and end date of a month.
        """
        start_date = datetime(year, month, 1)
        end_date = self.transform_to_midnight(
            datetime(year, month, self.last_day_of_month(year, month))
        )

        return self.get_formatted_response(start_date, end_date)

    def get_by_current_week(self, date_obj: datetime) -> dict:
        """
        Get date ranges for a particular week.

        Parameters
        ----------
        date_obj : datetime
            A datetime object.

        Returns
        -------
        dict
            Combined start date and end date of a week.
        """
        start_date = datetime(date_obj.year, date_obj.month, date_obj.day) - timedelta(
            days=date_obj.weekday()
        )
        end_date = self.transform_to_midnight(start_date) + timedelta(days=6)

        return self.get_formatted_response(start_date, end_date)

    def get_by_last_month(self, date_obj: datetime) -> dict:
        """
        Get date ranges for a last month.

        Parameters
        ----------
        date_obj : datetime
            A datetime object.

        Returns
        -------
        dict
            Combined start date and end date of a last month.
        """
        start_date = (
            date_obj.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            - timedelta(days=1)
        ).replace(day=1)

        year = start_date.year
        month = start_date.month

        end_date = self.transform_to_midnight(
            datetime(year, month, self.last_day_of_month(year, month))
        )

        return self.get_formatted_response(start_date, end_date)

    def get_by_last_week(self, date_obj: datetime) -> dict:
        """
        Get date ranges for a last week.

        Parameters
        ----------
        date_obj : datetime
            A datetime object.

        Returns
        -------
        dict
            Combined start date and end date of a last week.
        """
        start_of_last_week = (
            date_obj - timedelta(days=date_obj.weekday() + 7)
        ).replace(hour=0, minute=0, second=0, microsecond=0)

        end_of_last_week = self.transform_to_midnight(start_of_last_week) + timedelta(
            days=6
        )

        return self.get_formatted_response(start_of_last_week, end_of_last_week)

    def get_by_last_180_days(self, date_obj: datetime) -> dict:
        """
        Get date ranges for last 180 days.

        Parameters
        ----------
        date_obj : datetime
            A datetime object.

        Returns
        -------
        dict
            Combined start date and end date of last 180 days.
        """
        start_date = (date_obj - timedelta(days=179)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_date = date_obj

        return self.get_formatted_response(start_date, end_date)

    def get_by_last_90_days(self, date_obj: datetime) -> dict:
        """
        Get date ranges for last 90 days.

        Parameters
        ----------
        date_obj : datetime
            A datetime object.

        Returns
        -------
        dict
            Combined start date and end date of last 90 days.
        """
        start_date = (date_obj - timedelta(days=89)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_date = date_obj

        return self.get_formatted_response(start_date, end_date)

    def get_by_last_30_days(self, date_obj: datetime) -> dict:
        """
        Get date ranges for last 30 days.

        Parameters
        ----------
        date_obj : datetime
            A datetime object.

        Returns
        -------
        dict
            Combined start date and end date of last 30 days.
        """
        start_date = (date_obj - timedelta(days=29)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_date = date_obj

        return self.get_formatted_response(start_date, end_date)

    def get_by_last_7_days(self, date_obj: datetime) -> dict:
        """
        Get date ranges for last 7 days.

        Parameters
        ----------
        date_obj : datetime
            A datetime object.

        Returns
        -------
        dict
            Combined start date and end date of last 7 days.
        """
        start_date = (date_obj - timedelta(days=6)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_date = date_obj

        return self.get_formatted_response(start_date, end_date)

    def get_by_custom_range(self, start_date: date, end_date: date) -> dict:
        """
        Get date ranges for a custom date ranges.

        Parameters
        ----------
        start_date : date
            Start date.
        end_date : date
            End date.

        Returns
        -------
        dict
            Combined start date and end date of a custom range.
        """
        if start_date is None or end_date is None:
            exc_bad_request("Provide a valid ISO Date for `start_date` and `end_date.`")

        if start_date > end_date:
            exc_bad_request("The `end_date` can't be less than the `start_date.`")

        return self.get_formatted_response(
            datetime(start_date.year, start_date.month, start_date.day),
            self.transform_to_midnight(end_date),
        )

    def get_by_period_type(
        self,
        period_type: ReportPeriodType,
        start_date: date = None,
        end_date: date = None,
    ) -> dict | None:
        """
        Get date ranges for a specific period.

        Parameters
        ----------
        period_type : ReportPeriodType
            Type of period.
        start_date : date
            Start date in case of custom date range.
        end_date : date
            End date in case of custom date range.

        Returns
        -------
        dict
            Combined start date and end date of a period.
        """
        current_date = datetime.now()

        match period_type:
            case period_type.CURRENT_YEAR:
                return self.get_by_current_year(year=current_date.year)
            case period_type.CURRENT_WEEK:
                return self.get_by_current_week(date_obj=current_date)
            case period_type.LAST_MONTH:
                return self.get_by_last_month(date_obj=current_date)
            case period_type.LAST_WEEK:
                return self.get_by_last_week(date_obj=current_date)
            case period_type.LAST_180_DAYS:
                return self.get_by_last_180_days(date_obj=current_date)
            case period_type.LAST_90_DAYS:
                return self.get_by_last_90_days(date_obj=current_date)
            case period_type.LAST_30_DAYS:
                return self.get_by_last_30_days(date_obj=current_date)
            case period_type.LAST_7_DAYS:
                return self.get_by_last_7_days(date_obj=current_date)
            case period_type.CUSTOM_RANGE:
                return self.get_by_custom_range(start_date, end_date)
            case period_type.ALL_TIME:
                return None
            case _:
                return self.get_by_current_month(
                    year=current_date.year, month=current_date.month
                )
