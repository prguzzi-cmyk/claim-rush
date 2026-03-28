#!/usr/bin/env python

from sqlalchemy.orm import Session

from app.models import Claim
from app.repositories import BaseRepository
from app.schemas import ClaimCreate, ClaimUpdate


class ClaimRepository(BaseRepository[Claim, ClaimCreate, ClaimUpdate]):
    """
    Repository for managing Claim entities in the database.

    Attributes
    ----------
    db_session : Session
        The database session used for accessing claim data.
    """

    def __init__(self, db_session: Session):
        """
        Initializes the ClaimRepository with the given database session.

        Parameters
        ----------
        db_session : Session
            The database session used for accessing claim data.
        """
        super().__init__(db_session, Claim)
