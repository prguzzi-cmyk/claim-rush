#!/usr/bin/env python


class RepositoryError(Exception):
    """
    Base class for all repository-related errors.

    Attributes
    ----------
    message : str
        The error message.
    """

    def __init__(self, message: str = "Repository error"):
        self.message = message
        super().__init__(self.message)


class DatabaseOperationError(RepositoryError):
    """
    Raised when a general database operation fails.

    Attributes
    ----------
    message : str
        The error message.
    """

    pass
