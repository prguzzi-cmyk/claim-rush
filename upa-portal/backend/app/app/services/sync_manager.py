#!/usr/bin/env python

from app.services import BaseSyncService


class SyncManager:
    """
    Manager class for coordinating multiple synchronization services.

    This class manages a list of synchronization services
    and provides a method to run all sync operations in coordinated manner.

    Attributes
    ----------
    sync_services : list[BaseSyncService]
        The list of all synchronization services that needs to sync.

    Methods
    -------
    sync_all()
        Run synchronization for all registered services.
    """

    def __init__(self, sync_services: list[BaseSyncService]):
        """
        Initializes the Sync Manger class.

        Parameters
        ----------
        sync_services : list[BaseSyncService]
            The list of all synchronization services that needs to sync.
        """
        self.sync_services = sync_services

    def sync_all(self):
        """
        Run synchronization for all registered services.

        This method iterates through all the synchronization services and executes their respective sync operations.
        """
        for service in self.sync_services:
            service.sync()
