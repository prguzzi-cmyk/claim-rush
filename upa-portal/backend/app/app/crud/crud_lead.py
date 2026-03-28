#!/usr/bin/env python

"""CRUD operations for the lead and contact model"""

from enum import Enum
from typing import Annotated, Any, Sequence
from uuid import UUID

from fastapi import Query
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app import crud
from app.core.enums import LeadStatus
from app.crud.base import CRUDBase
from app.models import Client, Lead, LeadContact, User
from app.schemas import ClientCreate, LeadCreate, LeadUpdate
from app.utils.common import custom_jsonable_encoder
from app.utils.exceptions import exc_conflict


class CRUDLead(CRUDBase[Lead, LeadCreate, LeadUpdate]):
    @staticmethod
    def get_assigned(
        db_session: Session,
        current_user: User,
        join_target: Any = None,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[Lead]:
        """
        Get a list of leads assigned to a user.

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
        Sequence[Lead]
            Returns a list of found leads otherwise an empty list.
        """
        with db_session as session:
            stmt = select(Lead)

            # Apply Join
            if join_target:
                for target in join_target:
                    stmt = stmt.join(target)

            # Removed records query
            stmt = stmt.where(
                and_(Lead.is_removed.is_(removed), Lead.assigned_to == current_user.id)
            )

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(Lead.created_at)

            return paginate(session, stmt)

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
    ) -> Sequence[Lead]:
        """
        Get a list of leads.

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
        Sequence[Lead]
            Returns a list of found leads otherwise an empty list.
        """
        with db_session as session:
            stmt = select(Lead)

            # Apply Join
            for target in join_target:
                stmt = stmt.join(target, isouter=is_outer)

            # Removed records query
            where_stmt = [Lead.is_removed.is_(removed)]

            # If the user is not an administrator
            if current_user:
                where_stmt.append(Lead.assigned_to == current_user.id)

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
                stmt = stmt.order_by(Lead.created_at)

            return paginate(session, stmt)

    @staticmethod
    def group_by_status(
        db_session: Session,
        filters: list = None,
    ) -> Sequence[Any]:
        """
        Get a list of leads count group by status.

        Parameters
        ----------
        db_session : Session
            Database session
        filters : list
            A list consists of filters

        Returns
        -------
        Sequence[Any]
            Returns a list of leads count group by status.
        """
        with db_session as session:
            stmt = select(Lead.status, func.count(Lead.id).label("leads_count"))

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply grouping
            stmt = stmt.group_by(Lead.status)

            # Apply ordering
            stmt = stmt.order_by(Lead.status)

            return session.execute(stmt).all()

    @staticmethod
    def group_by_source(
        db_session: Session,
        filters: list = None,
    ) -> Sequence[Any]:
        """
        Get a list of leads count group by source.

        Parameters
        ----------
        db_session : Session
            Database session
        filters : list
            A list consists of filters

        Returns
        -------
        Sequence[Any]
            Returns a list of leads count group by source.
        """
        with db_session as session:
            stmt = select(
                Lead.source,
                func.concat(User.first_name, " ", User.last_name).label("user_name"),
                User.email,
                func.count(Lead.id).label("leads_count"),
            )

            stmt = stmt.join(User, Lead.source == User.id, isouter=True)

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply grouping
            stmt = stmt.group_by(
                Lead.source, User.first_name, User.last_name, User.email
            )

            # Apply ordering
            stmt = stmt.order_by(Lead.source)

            return session.execute(stmt).all()

    @staticmethod
    def group_by_assigned_user(
        db_session: Session,
        filters: list = None,
    ) -> Sequence[Any]:
        """
        Get a list of leads count group by assigned user.

        Parameters
        ----------
        db_session : Session
            Database session
        filters : list
            A list consists of filters

        Returns
        -------
        Sequence[Any]
            Returns a list of leads count group by assigned user.
        """
        with db_session as session:
            stmt = select(
                func.concat(User.first_name, " ", User.last_name).label("display_name"),
                func.count(Lead.id).label("leads_count"),
            ).join(User, Lead.assigned_to == User.id)

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply grouping
            stmt = stmt.group_by("display_name")

            # Apply ordering
            stmt = stmt.order_by("display_name")

            return session.execute(stmt).all()

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
            Returns the maximum reference number for a lead.
        """
        with db_session as session:
            max_ref = session.query(func.max(Lead.ref_number)).scalar()
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

    def create(self, db_session: Session, *, obj_in: LeadCreate) -> Lead:
        user_obj = crud.user.get(db_session, obj_id=obj_in.assigned_to)

        with db_session as session:
            lead_obj = Lead(
                loss_date=obj_in.loss_date,
                peril=obj_in.peril,
                insurance_company=obj_in.insurance_company,
                policy_number=obj_in.policy_number,
                claim_number=obj_in.claim_number,
                status=obj_in.status.value,
                source=obj_in.source,
                source_info=obj_in.source_info,
                instructions_or_notes=obj_in.instructions_or_notes,
                can_be_removed=obj_in.can_be_removed,
            )

            if user_obj:
                lead_obj.assigned_to = user_obj.id

            contact_obj = LeadContact(
                full_name=obj_in.contact.full_name,
                full_name_alt=obj_in.contact.full_name_alt,
                email=obj_in.contact.email,
                email_alt=obj_in.contact.email_alt,
                phone_number=obj_in.contact.phone_number,
                phone_number_alt=obj_in.contact.phone_number_alt,
                address=obj_in.contact.address,
                city=obj_in.contact.city,
                state=obj_in.contact.state,
                zip_code=obj_in.contact.zip_code,
                address_loss=obj_in.contact.address_loss,
                city_loss=obj_in.contact.city_loss,
                state_loss=obj_in.contact.state_loss,
                zip_code_loss=obj_in.contact.zip_code_loss,
            )

            lead_obj.contact = contact_obj
            contact_obj.lead = lead_obj

            new_ref = self.generate_new_ref_number(db_session)
            lead_obj.ref_number = new_ref

            session.add(lead_obj)
            session.add(contact_obj)
            session.commit()
            session.refresh(lead_obj)

            return lead_obj

    @staticmethod
    def is_exist(
        db_session: Session,
        lead_obj: Lead | LeadCreate | LeadUpdate,
    ) -> bool:
        """
        Check for existing lead record.

        Parameters
        ----------
        db_session : Session
            Database session
        lead_obj : Lead | LeadCreate | LeadUpdate
            Incoming data object

        Returns
        -------
        bool
            `True` if record found, otherwise `False`.
        """
        with db_session as session:
            res = session.scalar(
                select(Lead.ref_number)
                .join(LeadContact)
                .where(
                    and_(
                        Lead.status == LeadStatus.SIGNED_APPROVED.value,
                        LeadContact.full_name == lead_obj.contact.full_name,
                        LeadContact.phone_number == lead_obj.contact.phone_number,
                    )
                )
            )

            return True if res else False

    def update(
        self, db_session: Session, *, db_obj: Lead, obj_in: LeadUpdate | dict[str, Any]
    ) -> Lead:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            obj_data = custom_jsonable_encoder(db_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and isinstance(update_data[field], Enum):
                    setattr(db_obj, field, update_data[field].value)
                elif field in update_data and field != "contact":
                    setattr(db_obj, field, update_data[field])

            # Set attributes for contact
            if update_data.get("contact"):
                for field in obj_data["contact"]:
                    if field in update_data["contact"]:
                        setattr(db_obj.contact, field, update_data["contact"][field])

            # Check duplicity of a lead
            if db_obj.status == LeadStatus.SIGNED_APPROVED.value:
                existence = crud.lead.is_exist(db_session, db_obj)
                if existence:
                    exc_conflict("The identical lead record has been approved before.")

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        # Create client
        client: Client = self.create_client(db_session, db_obj)

        # Update existing lead client ID. In case, there is a client.
        if client:
            with db_session as session:
                lead_obj: Lead = session.scalar(
                    select(Lead).where(Lead.id == db_obj.id)
                )
                lead_obj.client_id = client.id

                session.commit()

            db_obj.client_id = client.id

        return db_obj

    def create_client(self, db_session: Session, db_obj: Lead) -> Client | None:
        """
        Check if the lead is not editable then create a client if not exists.

        Parameters
        ----------
        db_session : Session
            Database session
        db_obj : Lead
            Instance of Lead model

        Returns
        -------
        Client | None
            Client object if not editable otherwise None.
        """
        editable = self.is_editable(db_obj)
        if not editable:
            contact_detail: LeadContact = db_obj.contact
            client_obj_in = ClientCreate(
                full_name=contact_detail.full_name,
                full_name_alt=contact_detail.full_name_alt,
                email=contact_detail.email,
                email_alt=contact_detail.email_alt,
                phone_number=contact_detail.phone_number,
                phone_number_alt=contact_detail.phone_number_alt,
                address=contact_detail.address,
                city=contact_detail.city,
                state=contact_detail.state,
                zip_code=contact_detail.zip_code,
                belongs_to=UUID(str(db_obj.assigned_to)),
            )
            return crud.client.create_if_not_exist(db_session, obj_in=client_obj_in)

        return None

    @staticmethod
    def is_editable(db_obj: Lead) -> bool:
        """
        Check if lead is editable.

        Parameters
        ----------
        db_obj : Lead
            The Lead model instance.

        Returns
        -------
        bool
            `True` if it is editable, otherwise `False`.
        """
        return False if db_obj.status == LeadStatus.SIGNED_APPROVED.value else True

    @staticmethod
    def is_owner(user: User, lead_obj: Lead | LeadCreate | LeadUpdate) -> bool:
        """
        Check if the user is an owner of the lead.

        Parameters
        ----------
        user : User
            The user model object
        lead_obj : Lead or LeadCreate or LeadUpdate
            Lead object

        Returns
        -------
        bool
            True if the user is an owner, otherwise False.
        """
        if hasattr(lead_obj, "assigned_to") and lead_obj.assigned_to == user.id:
            return True

        return False


lead = CRUDLead(Lead)
