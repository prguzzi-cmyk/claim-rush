#!/usr/bin/env python

from pydantic import BaseModel
from starlette import status


class BaseResponse(BaseModel):
    """
    Pydantic schema for a generic response.

    Attributes
    ----------
    detail : str
        A message describing the response.
    code : int | None
        A custom response code (optional).
    """

    detail: str
    code: int | None = None


class SuccessResponse(BaseResponse):
    """
    Pydantic schema for a 200 OK response.

    Attributes
    ----------
    detail : str
        The success message.
    code : int | None
        A custom success code for the OK response.
    """

    detail: str = "Success"
    code: int = status.HTTP_200_OK


class NoContentResponse(BaseResponse):
    """
    Pydantic schema for a 204 No Content response.

    Attributes
    ----------
    detail : str
        The success message.
    code : int | None
        A custom success code for the No Content response.
    """

    detail: str = "No Content"
    code: int = status.HTTP_204_NO_CONTENT


class BadRequestResponse(BaseResponse):
    """
    Pydantic schema for a 400 Bad Request error response.

    Attributes
    ----------
    detail : str
        The error message.
    code : int | None
        A custom error code for the bad request error.
    """

    detail: str = "Invalid input data provided."
    code: int = status.HTTP_400_BAD_REQUEST


class ForbiddenResponse(BaseResponse):
    """
    Pydantic schema for a 403 Forbidden error response.

    Attributes
    ----------
    detail : str
        The error message.
    code : int | None
        A custom error code for the forbidden error.
    """

    detail: str = "You do not have permission to access this resource."
    code: int = status.HTTP_403_FORBIDDEN


class NotFoundResponse(BaseResponse):
    """
    Pydantic schema for a 404 Not Found error response.

    Attributes
    ----------
    detail : str
        The error message.
    code : int | None
        A custom error code for the not found error.
    """

    detail: str = "The requested resource was not found."
    code: int = status.HTTP_404_NOT_FOUND


class ConflictResponse(BaseResponse):
    """
    Pydantic schema for a 409 Conflict error response.

    Attributes
    ----------
    detail : str
        The error message.
    code : int | None
        A custom error code for the conflict error.
    """

    detail: str = "The resource cannot be created or updated."
    code: int = status.HTTP_409_CONFLICT


class InternalServerErrorResponse(BaseResponse):
    """
    Pydantic schema for a generic 500 Internal server error response.

    Attributes
    ----------
    detail : str
        The error message.
    code : int | None
        A custom error code for the internal server error.
    """

    detail: str = "Internal server error."
    code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
