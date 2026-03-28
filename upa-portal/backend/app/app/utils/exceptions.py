#!/usr/bin/env python

"""Custom responses for the application"""

from typing import Type, TypeVar
from uuid import UUID

from fastapi import HTTPException, status
from psycopg2 import errors
from psycopg2.errorcodes import UNIQUE_VIOLATION
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base_class import Base

ModelType = TypeVar("ModelType", bound=Base)


class RepositoryError(Exception):
    """Base class for all repository-related errors."""

    pass


class DatabaseOperationError(RepositoryError):
    """Raised when a general database operation fails."""

    pass


class ServiceError(Exception):
    """Base class for all service-related errors."""

    pass


class EntityNotFoundError(ServiceError):
    """Raised when an entity is not found in the database."""

    pass


class EntityAlreadyExistsError(ServiceError):
    """Raised when attempting to create an entity that already exists."""

    pass


class ProtectedEntityError(ServiceError):
    """Raised when attempting to edit or delete an entity that is system-defined."""

    pass


class BadRequestException(HTTPException):
    """
    Custom exception for HTTP 400 Bad Request.

    Parameters
    ----------
    message : str
        The detail message for the exception
    """

    def __init__(self, message: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


class UnauthorizedException(HTTPException):
    """
    Custom exception for HTTP 401 Unauthorized.

    Parameters
    ----------
    message : str
        The detail message for the exception
    """

    def __init__(self, message: str):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


class ForbiddenException(HTTPException):
    """
    Custom exception for HTTP 403 Forbidden.

    Parameters
    ----------
    message : str
        The detail message for the exception
    """

    def __init__(self, message: str):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=message)


class NotFoundException(HTTPException):
    """
    Custom exception for HTTP 404 Not Found.

    Parameters
    ----------
    message : str
        The detail message for the exception
    """

    def __init__(self, message: str):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=message)


class ConflictException(HTTPException):
    """
    Custom exception for HTTP 409 Conflict.

    Parameters
    ----------
    message : str
        The detail message for the exception
    """

    def __init__(self, message: str):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=message)


class UnprocessableEntityException(HTTPException):
    """
    Custom exception for HTTP 422 Unprocessable Entity.

    Parameters
    ----------
    message : str
        The detail message for the exception
    """

    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message
        )


class InternalServerErrorException(HTTPException):
    """
    Custom exception for HTTP 500 Internal Server Error.

    Parameters
    ----------
    message : str
        The detail message for the exception
    """

    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message
        )


def raise_if_unique_violation(exc: IntegrityError, msg: str):
    """
    Raise an exception if there is unique violation integrity error.

    Parameters
    ----------
    exc : IntegrityError
        Object of SqlAlchemy Integrity error.
    msg : str
        Message for HTTP Exception
    """
    if isinstance(exc.orig, errors.lookup(UNIQUE_VIOLATION)):
        exc_conflict(msg)


def exc_bad_request(msg: str):
    """
    Raise Bad Request error.

    Parameters
    ----------
    msg : str
        Message for HTTP Exception
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=msg,
    )


def exc_forbidden(msg: str):
    """
    Raise Forbidden error.

    Parameters
    ----------
    msg : str
        Message for HTTP Exception
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=msg,
    )


def exc_not_found(msg: str):
    """
    Raise Not Found error.

    Parameters
    ----------
    msg : str
        Message for HTTP Exception
    """
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=msg,
    )


def exc_conflict(msg: str):
    """
    Raise Conflict error.

    Parameters
    ----------
    msg : str
        Message for HTTP Exception
    """
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=msg,
    )


def exc_unprocessable(msg: str):
    """
    Raise unprocessable error.

    Parameters
    ----------
    msg : str
        Message for HTTP Exception
    """
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=msg,
    )


def exc_internal_server(msg: str):
    """
    Raise Internal Server error.

    Parameters
    ----------
    msg : str
        Message for HTTP Exception
    """
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=msg,
    )


class CrudUtil:
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get_object_or_raise_exception(
        self,
        db_session: Session,
        object_id: UUID,
        *,
        err_msg: str = None,
    ) -> ModelType:
        """
        Get an object or raise an exception.

        Parameters
        ----------
        db_session : Session
            Database session
        object_id : UUID
            Object id
        err_msg : str
            Optional error message

        Returns
        -------
        ModelType
            If record found then it will return an object.
        """
        model_obj = self.model.get(db_session, obj_id=object_id)
        if not model_obj:
            exc_not_found(
                err_msg
                if err_msg
                else "The record with this id does not exist in the system."
            )

        return model_obj

    def get_removed_object_or_raise_exception(
        self, db_session: Session, object_id: UUID
    ) -> ModelType:
        """
        Get a removed object or raise an exception.

        Parameters
        ----------
        db_session : Session
            Database session
        object_id : UUID
            Object id

        Returns
        -------
        ModelType
            If record found then it will return an object.
        """
        model_obj = self.model.get(db_session, obj_id=object_id, even_removed=True)
        if not model_obj:
            exc_not_found("The record with this id does not exist in the system.")

        return model_obj
