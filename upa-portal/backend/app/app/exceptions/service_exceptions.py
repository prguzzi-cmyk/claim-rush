#!/usr/bin/env python


class ServiceError(Exception):
    """
    Base class for all service-related errors.

    Attributes
    ----------
    message : str
        The error message.
    """

    def __init__(self, message: str = "Service error"):
        self.message = message
        super().__init__(self.message)


class ForbiddenError(ServiceError):
    """
    Raised a user attempts an action they do not have permission for.

    Attributes
    ----------
    message : str
        The error message.
    """

    pass


class EntityNotFoundError(ServiceError):
    """
    Raised when an entity is not found in the database.

    Attributes
    ----------
    message : str
        The error message.
    """

    pass


class EntityAlreadyExistsError(ServiceError):
    """
    Raised when attempting to create an entity that already exists.

    Attributes
    ----------
    message : str
        The error message.
    """

    pass


class ConflictError(ServiceError):
    """
    Raised when there is a conflict in entity creation or update.

    Attributes
    ----------
    message : str
        The error message.
    """

    pass


class ProtectedEntityError(ServiceError):
    """
    Raised when attempting to edit or delete an entity that is system-defined.

    Attributes
    ----------
    message : str
        The error message.
    """

    pass


class InvalidRestoreOperationError(ServiceError):
    """
    Raised when attempting to restore an entity that has not been softly removed.

    Attributes
    ----------
    message : str
        The error message.
    """

    pass
