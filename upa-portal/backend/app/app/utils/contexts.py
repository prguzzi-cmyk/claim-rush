#!/usr/bin/env python

"""Application related Context Vars"""

from contextvars import ContextVar
from uuid import UUID


class UserContext:
    """Global User context"""

    user: ContextVar = ContextVar("user", default={"id": None})

    @classmethod
    def set(cls, user_id: UUID) -> None:
        """
        Set value for the user context.

        Parameters
        ----------
        user_id : UUID
            The user ID.
        """
        user = dict(id=user_id)

        cls.user.set(user)

    @classmethod
    def get(cls) -> dict:
        """
        Get the user context.

        Returns
        -------
        dict
            A dictionary consist of user data.
        """
        return cls.user.get()
