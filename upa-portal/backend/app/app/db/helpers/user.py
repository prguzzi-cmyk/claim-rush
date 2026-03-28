#!/usr/bin/env python

from sqlalchemy.orm import Session

from app import crud, schemas
from app.models import User as UserModel


class User:
    """Helper to create required users"""

    def __init__(self, users: dict[str, dict]):
        """
        Initialize User helper class.

        Parameters
        ----------
        users : list
            The list consists of users.
        """
        self.users = users

    def create(self, db_session: Session) -> dict[str, UserModel]:
        """
        Add users to the database.

        Parameters
        ----------
        db_session : Session
            Database session

        Returns
        -------
        dict
            The dictionary consists of users objects.
        """
        users = {}

        for role, user in self.users.items():
            user_obj = crud.user.get_by_email(db_session, email=user["email"])
            if not user_obj:
                user_in = schemas.UserCreate(
                    first_name=user["first_name"],
                    last_name=user["last_name"],
                    email=user["email"],
                    password=user["password"],
                    role_id=user["role_id"],
                    can_be_removed=False,
                )
                result = crud.user.create(db_session, obj_in=user_in)

                users[user["email"]] = result

        return users
