#!/usr/bin/env python

"""CRUD operations for the client model"""

from typing import Annotated, Any, Sequence
from uuid import UUID

from fastapi import Query
from fastapi.encoders import jsonable_encoder
from fastapi_pagination import paginate
from fastapi_pagination.ext.sqlalchemy import paginate as sql_paginate
from fastapi_pagination.utils import disable_installed_extensions_check
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from tenacity import retry, retry_if_exception_type, stop_after_attempt

from app import crud
from app.crud.base import CRUDBase
from app.models import Claim, Client, Lead, User
from app.schemas import ClientCreate, ClientUpdate


class CRUDClient(CRUDBase[Client, ClientCreate, ClientUpdate]):
    @staticmethod
    def get_belonged(
        db_session: Annotated[Session, Query()],
        current_user: User,
        join_target: Any = None,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[Client]:
        """
        Get a list of clients belonged to a user.

        Parameters
        ----------
        db_session : Session
            Database session
        current_user : User
            Current user model object
        join_target : Any
            Join target model
        removed : bool
            Fetch only removed records
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[Client]
            Returns a list of found clients otherwise an empty list.
        """
        with db_session as session:
            stmt = select(Client)

            # Apply Join
            if join_target:
                stmt = stmt.join(join_target)

            # Removed records query
            stmt = stmt.where(
                and_(
                    Client.is_removed.is_(removed), Client.belongs_to == current_user.id
                )
            )

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(Client.created_at)

            return sql_paginate(session, stmt)

    @staticmethod
    def search_everywhere(
        db_session: Annotated[Session, Query()],
        current_user: User = None,
        join_target: Any = None,
        is_outer: bool = False,
        removed: bool = False,
        where_criteria: list = None,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[Client]:
        """
        Get a list of clients.

        Parameters
        ----------
        db_session : Session
            Database session
        current_user : User
            Current user model object
        join_target : Any
            Join target model
        is_outer : bool
            Implement Full Outer Join
        removed : bool
            Fetch only removed records
        where_criteria : list
            A list consists of where statements
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[Client]
            Returns a list of found clients otherwise an empty list.
        """
        with db_session as session:
            stmt = select(Client)

            # Apply Join
            for target in join_target:
                stmt = stmt.join(target, isouter=is_outer)

            # Removed records query
            where_stmt = [Client.is_removed.is_(removed)]

            # If the user is not an administrator
            if current_user:
                where_stmt.append(Client.belongs_to == current_user.id)

            # If where criteria is provided
            if where_criteria:
                where_stmt.extend(where_criteria)

            stmt = stmt.where(and_(*where_stmt))

            # Apply filters
            stmt = stmt.filter(or_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(Client.created_at)

            return sql_paginate(session, stmt)

    def get_leads(self, db_session: Session, *, obj_id: UUID) -> list[Lead] | None:
        """
        Retrieve a list of client leads.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object

        Returns
        -------
        list[Leads] | None
            On success, returns a list of found records, or None if nothing is found.
        """
        disable_installed_extensions_check()

        with db_session as session:
            stmt = select(self.model)
            stmt = stmt.where(
                and_(Client.id == obj_id, self.model.is_removed.is_(False))
            )

            client_obj: Client = session.scalar(stmt)

            return paginate(client_obj.client_leads)

    def get_claims(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        paginated: bool = True,
    ) -> list[Claim] | None:
        """
        Retrieve a list of client claims.

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object
        paginated : bool
            Whether paginate the results or not

        Returns
        -------
        list[Claims] | None
            On success, returns a list of found records, or None if nothing is found.
        """
        disable_installed_extensions_check()

        with db_session as session:
            stmt = select(Client).options(selectinload(Client.client_claims))
            stmt = stmt.where(
                and_(Client.id == obj_id, self.model.is_removed.is_(False))
            )

            client_obj: Client = session.scalar(stmt)

            if paginated:
                return paginate(client_obj.client_claims)
            else:
                return client_obj.client_claims

    @staticmethod
    def get_max_ref_number(db_session: Session) -> int:
        """
        Get the maximum reference number from the database.

        Parameters
        ----------
        db_session : Session
            Database session

        Returns
        -------
        int
            Returns the maximum reference number for a client.
        """
        with db_session as session:
            max_ref = session.scalar(select(func.max(Client.ref_number)))
            return max_ref if max_ref else 0

    def generate_new_ref_number(self, db_session: Session) -> int:
        """
        Generate the new reference number.

        Parameters
        ----------
        db_session : Session
            Database session

        Returns
        -------
        int
            Generated new reference number (incremented by one)
        """
        max_ref = self.get_max_ref_number(db_session)
        return max_ref + 1

    def create_if_not_exist(
        self, db_session: Session, *, obj_in: ClientCreate
    ) -> Client:
        """
        Create a new client if not exist.

        Parameters
        ----------
        db_session : Session
            Database session
        obj_in : ClientCreate
            Client create schema instance

        Returns
        -------
        Client
            The Client model instance.
        """
        with db_session as session:
            if obj_in.email is None:
                stmt = select(Client).where(
                    Client.phone_number == obj_in.phone_number,
                )
            else:
                stmt = select(Client).where(
                    or_(
                        Client.email == obj_in.email,
                        Client.phone_number == obj_in.phone_number,
                    )
                )
            result = session.scalar(stmt)
            if result:
                return result
            else:
                return self.create(db_session, obj_in=obj_in)

    @retry(stop=stop_after_attempt(5), wait=retry_if_exception_type(IntegrityError))
    def create(self, db_session: Session, *, obj_in: ClientCreate) -> Client:
        with db_session as session:
            try:
                client_obj = Client(**jsonable_encoder(obj_in))

                new_ref = self.generate_new_ref_number(db_session)
                client_obj.ref_number = new_ref

                session.add(client_obj)
                session.commit()
                session.refresh(client_obj)

                return client_obj
            except IntegrityError as e:
                session.rollback()
                raise e

    @staticmethod
    def is_owner(user: User, client_obj: Client | ClientCreate | ClientUpdate) -> bool:
        """
        Check if the user is an owner of the client.

        Parameters
        ----------
        user : User
            The user model object
        client_obj : Client or ClientCreate or ClientUpdate
            Client object

        Returns
        -------
        bool
            True if the user is an owner, otherwise False.
        """
        if hasattr(client_obj, "belongs_to") and client_obj.belongs_to == user.id:
            return True

        return False

    def check_claim_collaboration(
        self,
        db_session: Session,
        user: User,
        client_obj: Client | ClientCreate | ClientUpdate,
    ) -> bool:
        """
        Check if the user is a collaborator of any Claims of the Client.

        Parameters
        ----------
        user : User
            The user model object
        client_obj : Client | ClientCreate | ClientUpdate
            Client object
        db_session : Session | None
            The database session

        Returns
        -------
        bool
            True if the user is a collaborator in any claims, otherwise False.
        """
        client_claims = self.get_claims(
            db_session=db_session, obj_id=client_obj.id, paginated=False
        )

        return any(
            crud.claim.is_collaborator(user=user, claim_obj=claim)
            for claim in client_claims
        )


client = CRUDClient(Client)
