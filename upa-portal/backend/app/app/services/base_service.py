#!/usr/bin/env python

from typing import TypeVar, Generic

from app.db.base_class import Base
from app.repositories import BaseRepository

ModelType = TypeVar("ModelType", bound=Base)
RepositoryType = TypeVar("RepositoryType", bound=BaseRepository)


class BaseService(Generic[ModelType, RepositoryType]):
    """
    A base service class that can be extended by other service classes.
    Provides common functionality like repository interactions.

    Attributes
    ----------
    repository : BaseRepository
        The repository instance to use for data operations.

    """

    def __init__(self, repository: RepositoryType):
        """
        Initializes the base service with a repository.

        Parameters
        ----------
        repository : BaseRepository
            The repository instance to use for data operations.
        """
        self.repository = repository

    @staticmethod
    def is_removable_entity(entity: ModelType) -> bool:
        """
        Determines if an entity can be safely removed based on its attributes.

        Parameters
        ----------
        entity : ModelType
            The entity object to check for removability.

        Returns
        -------
        bool
            `True` if the entity can be removed, `False` if the entity has an attribute
            `can_be_removed` set to `False`.
        """
        return (
            False
            if hasattr(entity, "can_be_removed") and not entity.can_be_removed
            else True
        )

    @staticmethod
    def is_removed_entity(entity: ModelType) -> bool:
        """
        Determine if it's a removed entity based on its attributes.

        Parameters
        ----------
        entity : ModelType
            The entity object to check for removability.

        Returns
        -------
        bool
            `True` if it's a removed entity, `False` if the entity has an attribute
            `is_removed` set to `False`.
        """
        return True if hasattr(entity, "is_removed") and entity.is_removed else False
