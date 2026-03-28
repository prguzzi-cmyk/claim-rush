#!/usr/bin/env python


class ApplicationError(Exception):
    """
    Base class for all application-related errors.

    Attributes
    ----------
    message : str
        The error message.
    """

    def __init__(self, message: str = "Application error"):
        self.message = message
        super().__init__(self.message)


class ForbiddenError(ApplicationError):
    """
    Raised when th

    Attributes
    ----------
    message : str
        The error message.
    """

    pass
