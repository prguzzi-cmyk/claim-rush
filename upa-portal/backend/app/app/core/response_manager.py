#!/usr/bin/env python

from starlette import status

from app.schemas.responses import (
    NotFoundResponse,
    SuccessResponse,
    ForbiddenResponse,
    ConflictResponse,
    InternalServerErrorResponse,
    NoContentResponse,
    BadRequestResponse,
)


class ResponseManager:
    """
    A centralized response manager that maps responses to specific endpoints
    for easier response documentation.
    """

    @staticmethod
    def get_base_responses() -> dict:
        """
        Returns a dictionary of base HTTP response models and their descriptions.

        Returns
        -------
        dict
            A dictionary mapping HTTP status codes to response models and descriptions.
        """
        return {
            status.HTTP_200_OK: {
                "model": SuccessResponse,
                "description": "Success",
            },
            status.HTTP_204_NO_CONTENT: {
                "model": NoContentResponse,
                "description": "No Content",
            },
            status.HTTP_400_BAD_REQUEST: {
                "model": BadRequestResponse,
                "description": "Bad Request",
            },
            status.HTTP_403_FORBIDDEN: {
                "model": ForbiddenResponse,
                "description": "Forbidden",
            },
            status.HTTP_404_NOT_FOUND: {
                "model": NotFoundResponse,
                "description": "Entity not found",
            },
            status.HTTP_409_CONFLICT: {
                "model": ConflictResponse,
                "description": "Conflict",
            },
            status.HTTP_500_INTERNAL_SERVER_ERROR: {
                "model": InternalServerErrorResponse,
                "description": "Internal server error",
            },
        }

    def not_found_response(self) -> dict:
        """Helper method to retrieve the default 404 Not Found response."""
        return {
            status.HTTP_404_NOT_FOUND: self.get_base_responses().get(
                status.HTTP_404_NOT_FOUND
            )
        }

    def _generate_responses(
        self, entity_name: str, additional_codes: dict | None = None
    ) -> dict:
        """
        Generate common responses for a given entity name.

        Parameters
        ----------
        entity_name : str
            Name of the entity to include in the description.
        additional_codes : dict | None
            Any additional HTTP status codes to include in the response.

        Returns
        -------
        dict
            A dictionary containing HTTP status codes and corresponding response models and descriptions.
        """
        # Get system default base responses
        base_responses = self.get_base_responses()

        # Update base responses specific to entity
        base_responses.update(
            {
                status.HTTP_404_NOT_FOUND: {
                    "model": NotFoundResponse,
                    "description": f"{entity_name} not found",
                },
                status.HTTP_409_CONFLICT: {
                    "model": ConflictResponse,
                    "description": f"{entity_name} conflict",
                },
            }
        )

        # Add any additional codes to the base_responses
        if additional_codes:
            base_responses.update(additional_codes)

        return base_responses

    @staticmethod
    def _filter_responses_by_status_codes(
        responses: dict, include_status_codes: list[int] | None = None
    ) -> dict:
        """
        Filters the provided responses dictionary based on the provided status codes.

        Parameters
        ----------
        responses : dict
            A dictionary where the keys are HTTP status codes and the values are the response details.
        include_status_codes : list[int] | None
            A list of HTTP status codes to include in the filtered responses. If None, all responses are returned.

        Returns
        -------
        dict
            A dictionary containing only the filtered responses based on the provided status codes.
        """
        if include_status_codes:
            # Filter responses by the provided status codes
            return {
                code: responses[code]
                for code in include_status_codes
                if code in responses
            }

        # Return all responses if no status codes are provided
        return responses

    def get_role_responses(
        self,
        additional_codes: dict | None = None,
        include_status_codes: list[int] | None = None,
    ) -> dict:
        """
        Get responses specific to Role operations.

        Parameters
        ----------
        additional_codes : dict | None
            Any additional HTTP status codes to include in the response.
        include_status_codes : list[int] | None
            A list of status codes to include in the response, by default None.

        Returns
        -------
        dict
            A dictionary of Role-specific HTTP status codes and response descriptions.
        """
        responses = self._generate_responses(
            entity_name="Role", additional_codes=additional_codes
        )

        return ResponseManager._filter_responses_by_status_codes(
            responses=responses, include_status_codes=include_status_codes
        )

    def get_user_responses(
        self,
        additional_codes: dict | None = None,
        include_status_codes: list[int] | None = None,
    ) -> dict:
        """
        Get responses specific to User operations.

        Parameters
        ----------
        additional_codes : dict | None
            Any additional HTTP status codes to include in the response.
        include_status_codes : list[int] | None
            A list of status codes to include in the response, by default None.

        Returns
        -------
        dict
            A dictionary of User-specific HTTP status codes and response descriptions.
        """
        responses = self._generate_responses(
            entity_name="User", additional_codes=additional_codes
        )

        return ResponseManager._filter_responses_by_status_codes(
            responses=responses, include_status_codes=include_status_codes
        )

    def get_lead_responses(
        self,
        additional_codes: dict | None = None,
        include_status_codes: list[int] | None = None,
    ) -> dict:
        """
        Get responses specific to Lead operations.

        Parameters
        ----------
        additional_codes : dict | None
            Any additional HTTP status codes to include in the response.
        include_status_codes : list[int] | None
            A list of status codes to include in the response, by default None.

        Returns
        -------
        dict
            A dictionary of Lead-specific HTTP status codes and response descriptions.
        """
        responses = self._generate_responses(
            entity_name="Lead", additional_codes=additional_codes
        )

        return ResponseManager._filter_responses_by_status_codes(
            responses=responses, include_status_codes=include_status_codes
        )
