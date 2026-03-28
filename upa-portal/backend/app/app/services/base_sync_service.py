#!/usr/bin/env python

from abc import ABC, abstractmethod


class BaseSyncService(ABC):
    """
    Abstract base class for synchronization services.

    All synchronization services should inherit from this class.

    Methods
    -------
    sync()
        Abstract method to perform the sync operation. Must be implemented by subclasses.
    """

    @abstractmethod
    def sync(self):
        """
        Perform the synchronization operation.

        This method should be implemented by subclass to define the specific synchronization logic.
        """
        raise NotImplementedError("Subclasses should implement this method.")
