#!/usr/bin/env python

from typing import Any, TypeVar, Type

from sqlalchemy.orm import Session


ServiceType = TypeVar("ServiceType")


class ServiceLocator:
    """
    Service locator for managing service instances.

    Attributes
    ----------
    _services : dict[str, Any]
        Stores all registered services of the application.
    """

    _services: dict[str, Any] = {}

    def __init__(self, db_session: Session):
        """
        Initializes the service locator with a database session.

        Parameters
        ----------
        db_session : Session
            The database session to use for initializing repositories and services.
        """
        self.db_session = db_session

    def get_service(self, service_class: Type[ServiceType]) -> ServiceType | None:
        """
        Retrieves a service instance by class type.

        Parameters
        ----------
        service_class : Type[ServiceType]
            The class of the service to retrieve.

        Returns
        -------
        ServiceType | None
            The service instance if found, otherwise None.
        """
        service_name = service_class.__name__
        return self._services[service_name]

    def register_service(
        self,
        service_locator: Any,
        service_class: Type[ServiceType],
        repository_class: Type[Any],
    ) -> ServiceType:
        """
        Creates and registers a service if not already registered.

        Parameters
        ----------
        service_locator : Any
            The service locator for accessing other services.
        service_class : Type[ServiceType]
            The class of the service to create.
        repository_class : Type[Any]
            The repository class needed to initialize the service.

        Returns
        -------
        ServiceType
            The created service instance.
        """
        service_name = service_class.__name__
        if service_name not in self._services:
            repository_instance = repository_class(self.db_session)
            service_instance = service_class(repository_instance, service_locator)
            self._services[service_name] = service_instance

        return self._services[service_name]
