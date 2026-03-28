#!/usr/bin/env python

from fastapi import FastAPI, Request
from starlette import status
from starlette.responses import JSONResponse

from app.exceptions import (
    EntityNotFoundError,
    InvalidRestoreOperationError,
    ForbiddenError,
    ConflictError,
    RepositoryError,
    EntityAlreadyExistsError, ProtectedEntityError,
)
from app.schemas.responses import (
    NotFoundResponse,
    BadRequestResponse,
    ForbiddenResponse,
    ConflictResponse,
    InternalServerErrorResponse,
)


def setup_exception_handlers(app: FastAPI):
    """
    Setup custom exception handlers for the FastAPI application.

    Parameters
    ----------
    app : FastAPI
        The FastAPI application instance.
    """

    @app.exception_handler(InvalidRestoreOperationError)
    async def invalid_restore_operation_exception_handler(
        request: Request, exc: InvalidRestoreOperationError
    ):
        """
        Handle InvalidRestoreOperationError and return a 400 response with a structured error message.

        Parameters
        ----------
        request : Request
            The incoming request object.
        exc : InvalidRestoreOperationError
            The exception instance.

        Returns
        -------
        JSONResponse
            The 400 Bad Request response with the error message.
        """
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=BadRequestResponse(detail=str(exc)).dict(),
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_exception_handler(request: Request, exc: ForbiddenError):
        """
        Handle ForbiddenError and return a 403 response with a structured error message.

        Parameters
        ----------
        request : Request
            The incoming request object.
        exc : ForbiddenError
            The exception instance.

        Returns
        -------
        JSONResponse
            The 403 Forbidden response with the error message.
        """
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=ForbiddenResponse(detail=str(exc)).dict(),
        )

    @app.exception_handler(ProtectedEntityError)
    async def protect_entity_exception_handler(request: Request, exc: ProtectedEntityError):
        """
        Handle ProtectedEntityError and return a 403 response with a structured error message.

        Parameters
        ----------
        request : Request
            The incoming request object.
        exc : ProtectedEntityError
            The exception instance.

        Returns
        -------
        JSONResponse
            The 403 Forbidden response with the error message.
        """
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=ForbiddenResponse(detail=str(exc)).dict(),
        )

    @app.exception_handler(EntityNotFoundError)
    async def not_found_exception_handler(request: Request, exc: EntityNotFoundError):
        """
        Handle EntityNotFoundError and return a 404 response with a structured error message.

        Parameters
        ----------
        request : Request
            The incoming request object.
        exc : EntityNotFoundError
            The exception instance.

        Returns
        -------
        JSONResponse
            The 404 Not Found response with the error message.
        """
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=NotFoundResponse(detail=str(exc)).dict(),
        )

    @app.exception_handler(ConflictError)
    async def conflict_exception_handler(request: Request, exc: ConflictError):
        """
        Handle ConflictError and return a 409 response with a structured error message.

        Parameters
        ----------
        request : Request
            The incoming request object.
        exc : ConflictError
            The exception instance.

        Returns
        -------
        JSONResponse
            The 409 Conflict response with the error message.
        """
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=ConflictResponse(detail=str(exc)).dict(),
        )

    @app.exception_handler(EntityAlreadyExistsError)
    async def entity_already_exists_exception_handler(
        request: Request, exc: EntityAlreadyExistsError
    ):
        """
        Handle EntityAlreadyExistsError and return a 409 response with a structured error message.

        Parameters
        ----------
        request : Request
            The incoming request object.
        exc : EntityAlreadyExistsError
            The exception instance.

        Returns
        -------
        JSONResponse
            The 409 Conflict response with the error message.
        """
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=ConflictResponse(detail=str(exc)).dict(),
        )

    @app.exception_handler(RepositoryError)
    async def repository_exception_handler(request: Request, exc: RepositoryError):
        """
        Handle RepositoryError and return a 500 response with a structured error message.

        Parameters
        ----------
        request : Request
            The incoming request object.
        exc : RepositoryError
            The exception instance.

        Returns
        -------
        JSONResponse
            The 500 Internal Server Error response with the error message.
        """
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=InternalServerErrorResponse(detail=str(exc)).dict(),
        )
