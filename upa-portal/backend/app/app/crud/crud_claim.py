#!/usr/bin/env python

"""CRUD operations for the claim and contact model"""

from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Sequence
from uuid import UUID

from fastapi import Query
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, func, or_, select, distinct
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased
from tenacity import retry, retry_if_exception_type, stop_after_attempt

from app import crud
from app.core.celery_app import celery_app
from app.core.enums import ClaimActivityType, ClaimPhases, Priority, TaskStatus, TaskType
from app.crud import claim_activity
from app.crud.base import CRUDBase
from app.models import Claim, ClaimContact, ClaimTask, User, ClaimCoverage, Client
from app.schemas import (
    ClaimActivityCreateDB,
    ClaimCreate,
    ClaimTaskCreateDB,
    ClaimUpdate,
    ClaimCoverageCreate,
    ClaimCoverageUpdate,
    CollaboratorAppend,
)
from app.utils.app import get_user_id, is_production_environment
from app.utils.common import slug_to_capital_case, custom_jsonable_encoder


# Maps phase slugs to lists of (title, task_type, priority) for auto-creation
PHASE_TASK_RULES: dict[str, list[tuple[str, TaskType, Priority]]] = {
    ClaimPhases.CLAIM_REPORTED.value: [
        ("Call insured", TaskType.PHONE_CALL, Priority.HIGH),
        ("Send contract", TaskType.OTHER, Priority.HIGH),
        ("Request policy", TaskType.OTHER, Priority.MEDIUM),
        ("Schedule inspection", TaskType.MEETING, Priority.MEDIUM),
    ],
    ClaimPhases.SCOPE_COMPLETE.value: [
        ("Inspect property", TaskType.OTHER, Priority.HIGH),
        ("Upload inspection photos", TaskType.OTHER, Priority.MEDIUM),
        ("Create scope", TaskType.OTHER, Priority.HIGH),
    ],
    ClaimPhases.ESTIMATE_COMPLETE.value: [
        ("Upload PA estimate", TaskType.OTHER, Priority.HIGH),
        ("Send estimate to carrier", TaskType.EMAIL, Priority.HIGH),
        ("Await carrier estimate", TaskType.FOLLOW_UP, Priority.MEDIUM),
    ],
    ClaimPhases.WAITING_FOR_INITIAL_PAYMENT.value: [
        ("Generate supplement", TaskType.OTHER, Priority.HIGH),
        ("Send supplement to carrier", TaskType.EMAIL, Priority.HIGH),
        ("Follow up with adjuster", TaskType.FOLLOW_UP, Priority.MEDIUM),
    ],
}


# Maps activity types to lists of (title, task_type, priority) for event-triggered auto-creation
EVENT_TASK_RULES: dict[str, list[tuple[str, TaskType, Priority]]] = {
    ClaimActivityType.INSPECTION_COMPLETED.value: [
        ("Review inspection report", TaskType.OTHER, Priority.HIGH),
        ("Prepare scope of loss", TaskType.OTHER, Priority.HIGH),
        ("Upload inspection documentation", TaskType.OTHER, Priority.MEDIUM),
    ],
    ClaimActivityType.ESTIMATE_GENERATED.value: [
        ("Review estimate for accuracy", TaskType.OTHER, Priority.HIGH),
        ("Send estimate to carrier", TaskType.EMAIL, Priority.HIGH),
        ("Notify insured of estimate", TaskType.PHONE_CALL, Priority.MEDIUM),
    ],
    ClaimActivityType.CARRIER_ESTIMATE_RECEIVED.value: [
        ("Compare carrier vs PA estimate", TaskType.OTHER, Priority.HIGH),
        ("Identify line-item discrepancies", TaskType.OTHER, Priority.HIGH),
        ("Prepare supplement if needed", TaskType.OTHER, Priority.MEDIUM),
    ],
    ClaimActivityType.SUPPLEMENT_EMAIL_SENT.value: [
        ("Follow up on supplement with carrier", TaskType.FOLLOW_UP, Priority.HIGH),
        ("Schedule re-inspection if needed", TaskType.MEETING, Priority.MEDIUM),
    ],
    ClaimActivityType.PAYMENT_ISSUED.value: [
        ("Verify payment amount against estimate", TaskType.OTHER, Priority.HIGH),
        ("Update client on payment received", TaskType.PHONE_CALL, Priority.MEDIUM),
        ("Deposit check and track status", TaskType.OTHER, Priority.MEDIUM),
    ],
}


class CRUDClaim(CRUDBase[Claim, ClaimCreate, ClaimUpdate]):
    @staticmethod
    def get_assigned(
        db_session: Annotated[Session, Query()],
        users: list[User],
        join_target: set = None,
        is_outer: bool = False,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[Claim]:
        """
        Get a list of claims assigned to a user.

        Parameters
        ----------
        db_session : Session
            Database session
        users: list[User]
            A list of Users object
        join_target : set
            A set of Join target model/s
        is_outer : bool
            Implement Full Outer Join
        removed : bool
            Fetch only removed records
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[Claim]
            Returns a list of found claims otherwise an empty list.
        """
        with db_session as session:
            # Alias for the User table for the collaborator join
            collaborated_user = aliased(User, name="collaborated_user")

            stmt = select(distinct(Claim.id), Claim.created_at)

            stmt = stmt.outerjoin(Claim.collaborators.of_type(collaborated_user))

            # Apply Join
            if join_target:
                for target in join_target:
                    if is_outer:
                        stmt = stmt.outerjoin(target)
                    else:
                        stmt = stmt.join(target)

            # Removed records query
            stmt = stmt.where(
                or_(
                    Claim.assigned_to.in_(users),
                    collaborated_user.id.in_(users),
                    Claim.source.in_(users),
                ),
                and_(
                    Claim.is_removed.is_(removed),
                ),
            )

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(Claim.created_at)

            # Execute the query and return the result with pagination
            claim_ids = db_session.execute(stmt).scalars().all()

            if not claim_ids:
                return paginate(session, stmt)

            # Query the full claims using the claim_ids obtained from the distinct query
            stmt_full_claims = select(Claim).filter(Claim.id.in_(claim_ids))

            return paginate(session, stmt_full_claims)

    @staticmethod
    def get_by_client_owner(
        db_session: Annotated[Session, Query()],
        user_id: UUID,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[Claim]:
        """
        Get claims where the claim's client belongs_to the given user.

        Used for client-role users who access claims through their client record.
        """
        with db_session as session:
            stmt = (
                select(Claim)
                .join(Client, Claim.client_id == Client.id)
                .where(
                    Client.belongs_to == user_id,
                    Claim.is_removed.is_(removed),
                )
            )

            if filters:
                stmt = stmt.filter(and_(*filters))

            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(Claim.created_at.desc())

            return paginate(session, stmt)

    @staticmethod
    def get_assigned_search_everywhere(
        db_session: Annotated[Session, Query()],
        users: list[User],
        join_target: set = None,
        is_outer: bool = False,
        removed: bool = False,
        where_criteria: list = None,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[Claim]:
        """
        Get a list of claims assigned to a user.

        Parameters
        ----------
        db_session : Session
            Database session
        users: list[User]
            A list of Users object
        join_target : set
            A set of Join target model/s
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
        Sequence[Claim]
            Returns a list of found claims otherwise an empty list.
        """
        with db_session as session:
            # Alias for the User table for the collaborator join
            collaborated_user = aliased(User, name="collaborated_user")

            stmt = select(distinct(Claim.id), Claim.created_at)

            stmt = stmt.outerjoin(Claim.collaborators.of_type(collaborated_user))

            # Apply Join
            if join_target:
                for target in join_target:
                    if is_outer:
                        stmt = stmt.outerjoin(target)
                    else:
                        stmt = stmt.join(target)

            # Removed records query
            where_stmt = [
                or_(
                    Claim.assigned_to.in_(users),
                    collaborated_user.id.in_(users),
                ),
                and_(
                    Claim.is_removed.is_(removed),
                ),
            ]

            # If where criteria is provided
            if where_criteria:
                where_stmt.extend(where_criteria)

            stmt = stmt.where(and_(*where_stmt))

            # Apply filters
            if filters:
                stmt = stmt.filter(or_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(Claim.created_at)

            # Execute the query and return the result with pagination
            claim_ids = db_session.execute(stmt).scalars().all()

            if not claim_ids:
                return paginate(session, stmt)

            # Query the full claims using the claim_ids obtained from the distinct query
            stmt_full_claims = select(Claim).filter(Claim.id.in_(claim_ids))

            return paginate(session, stmt_full_claims)

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
    ) -> Sequence[Claim]:
        """
        Get a list of claims.

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
        Sequence[Claim]
            Returns a list of found claims otherwise an empty list.
        """
        with db_session as session:
            stmt = select(Claim)

            # Apply Join
            for target in join_target:
                stmt = stmt.join(target, isouter=is_outer)

            # Removed records query
            where_stmt = [Claim.is_removed.is_(removed)]

            # If the user is not an administrator
            if current_user:
                where_stmt.append(
                    or_(
                        Claim.assigned_to == current_user.id,
                        Claim.collaborators.any(User.id == current_user.id),
                    )
                )

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
                stmt = stmt.order_by(Claim.created_at)

            return paginate(session, stmt)

    @staticmethod
    def group_by_phase(
        db_session: Session,
        filters: list = None,
    ) -> Sequence[Any]:
        """
        Get a list of claims count group by phase.

        Parameters
        ----------
        db_session : Session
            Database session
        filters : list
            A list consists of filters

        Returns
        -------
        Sequence[Any]
            Returns a list of claims count group by phase.
        """
        with db_session as session:
            stmt = select(
                Claim.current_phase, func.count(Claim.id).label("claims_count")
            )

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply grouping
            stmt = stmt.group_by(Claim.current_phase)

            # Apply ordering
            stmt = stmt.order_by(Claim.current_phase)

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
            Returns the maximum reference number for a claim.
        """
        with db_session as session:
            max_ref = session.query(func.max(Claim.ref_number)).scalar()
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

    @retry(stop=stop_after_attempt(5), wait=retry_if_exception_type(IntegrityError))
    def create(self, db_session: Session, *, obj_in: ClaimCreate) -> Claim:
        with db_session as session:
            try:
                claim_obj = Claim(
                    loss_date=obj_in.loss_date,
                    peril=obj_in.peril,
                    insurance_company=obj_in.insurance_company,
                    policy_number=obj_in.policy_number,
                    policy_type=obj_in.policy_type,
                    sub_policy_type=obj_in.sub_policy_type,
                    date_logged=obj_in.date_logged,
                    lawsuit_deadline=obj_in.lawsuit_deadline,
                    mortgage_company=obj_in.mortgage_company,
                    fema_claim=obj_in.fema_claim,
                    state_of_emergency=obj_in.state_of_emergency,
                    inhabitable=obj_in.inhabitable,
                    contract_sign_date=obj_in.contract_sign_date,
                    anticipated_amount=obj_in.anticipated_amount,
                    fee_type=obj_in.fee_type.value,
                    fee=obj_in.fee,
                    claim_number=obj_in.claim_number,
                    current_phase=obj_in.current_phase.value,
                    source=obj_in.source,
                    source_info=obj_in.source_info,
                    signed_by=obj_in.signed_by,
                    adjusted_by=obj_in.adjusted_by,
                    instructions_or_notes=obj_in.instructions_or_notes,
                    can_be_removed=obj_in.can_be_removed,
                    escalation_path=obj_in.escalation_path.value,
                    sub_status=obj_in.sub_status.value,
                    assigned_to=obj_in.assigned_to,
                    client_id=obj_in.client_id,
                )

                if obj_in.claim_contact is not None:
                    contact_obj = ClaimContact(
                        address_loss=obj_in.claim_contact.address_loss,
                        city_loss=obj_in.claim_contact.city_loss,
                        state_loss=obj_in.claim_contact.state_loss,
                        zip_code_loss=obj_in.claim_contact.zip_code_loss,
                    )
                else:
                    contact_obj = ClaimContact()

                claim_obj.claim_contact = contact_obj
                contact_obj.claim = claim_obj

                new_ref = self.generate_new_ref_number(db_session)
                claim_obj.ref_number = new_ref

                session.add(claim_obj)
                session.add(contact_obj)
                session.commit()
                session.refresh(claim_obj)

                # Add coverages if present in the request payload
                if obj_in.coverages:
                    claim_obj = self.add_coverages(
                        session,
                        claim_id=claim_obj.id,
                        coverages=obj_in.coverages,
                    )

                # Append Collaborators
                claim_obj = self.append_claim_users_as_collaborators(
                    db_session=db_session, claim_obj=claim_obj, obj_in=obj_in
                )
            except IntegrityError as e:
                session.rollback()
                raise e

        # Create Claim Activity
        self.create_activity(db_session, claim_obj, ClaimActivityType.CLAIM_CREATED)

        # Auto-create tasks for the initial phase
        self.create_phase_tasks(db_session, claim_obj)

        if is_production_environment():
            # Call Celery worker to create Business Email
            celery_app.send_task(
                "app.worker.execute_business_email_creation_task", args=[claim_obj]
            )

        return claim_obj

    def update(
        self,
        db_session: Session,
        *,
        db_obj: Claim,
        obj_in: ClaimUpdate | dict[str, Any],
    ) -> Claim:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            obj_data = custom_jsonable_encoder(db_obj)
            previous_phase = db_obj.current_phase
            previous_escalation = db_obj.escalation_path
            previous_sub_status = db_obj.sub_status
            previous_assigned_to = db_obj.assigned_to

            remove_collaborators_list = self.get_replaced_collaborators_list(
                db_session=db_session, claim_obj=db_obj, obj_in=obj_in
            )

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and isinstance(update_data[field], Enum):
                    setattr(db_obj, field, update_data[field].value)
                elif (
                    field in update_data
                    and field != "claim_contact"
                    and field != "coverages"
                ):
                    setattr(db_obj, field, update_data[field])

            # Set attributes for contact
            if update_data.get("claim_contact"):
                for field in obj_data["claim_contact"]:
                    if field in update_data["claim_contact"]:
                        setattr(
                            db_obj.claim_contact,
                            field,
                            update_data["claim_contact"][field],
                        )

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

            # Add coverages if present in the request payload
            if hasattr(obj_in, "coverages") and obj_in.coverages:
                db_obj = self.add_coverages(
                    db_session,
                    claim_id=db_obj.id,
                    coverages=obj_in.coverages,
                )

            # Remove replaced collaborators
            if remove_collaborators_list:
                db_obj = self.remove_collaborators(
                    db_session=db_session,
                    claim_id=db_obj.id,
                    collaborators=remove_collaborators_list,
                )

            # Append Collaborators
            db_obj = self.append_claim_users_as_collaborators(
                db_session=db_session, claim_obj=db_obj, obj_in=obj_in
            )
        if previous_phase != db_obj.current_phase:
            self.create_activity(db_session, db_obj, ClaimActivityType.PHASE_CHANGED)
            self.create_phase_tasks(db_session, db_obj)
        if previous_escalation != db_obj.escalation_path:
            self.create_activity(db_session, db_obj, ClaimActivityType.ESCALATION_CHANGED)
        if previous_sub_status != db_obj.sub_status:
            self.create_activity(db_session, db_obj, ClaimActivityType.SUB_STATUS_CHANGED)
        if previous_assigned_to != db_obj.assigned_to:
            assignee_name = ""
            if db_obj.assigned_user:
                assignee_name = f"{db_obj.assigned_user.first_name} {db_obj.assigned_user.last_name}"
            self.create_activity(
                db_session, db_obj, ClaimActivityType.CLAIM_ASSIGNED,
                extra_details=f"Claim assigned to {assignee_name}".strip() if assignee_name else "Claim assignment changed",
            )

        return db_obj

    @staticmethod
    def is_owner(user: User, claim_obj: Claim | ClaimCreate | ClaimUpdate) -> bool:
        """
        Check if the user is an owner of the claim.

        Parameters
        ----------
        user : User
            The user model object
        claim_obj : Claim or ClaimCreate or ClaimUpdate
            Claim object

        Returns
        -------
        bool
            True if the user is an owner, otherwise False.
        """
        if hasattr(claim_obj, "assigned_to") and claim_obj.assigned_to == user.id:
            return True

        return False

    @staticmethod
    def is_collaborator(
        user: User, claim_obj: Claim | ClaimCreate | ClaimUpdate
    ) -> bool:
        """
        Check if the user is a collaborator of the claim.

        Parameters
        ----------
        user : User
            The user model object
        claim_obj : Claim or ClaimCreate or ClaimUpdate
            Claim object

        Returns
        -------
        bool
            True if the user is a collaborator, otherwise False.
        """
        # Return False if the user is an admin or claim is assigned to the user
        if crud.user.has_admin_privileges(user_obj=user) or (
            hasattr(claim_obj, "assigned_to") and claim_obj.assigned_to == user.id
        ):
            return False

        if hasattr(claim_obj, "collaborators"):
            if user.id in [collaborator.id for collaborator in claim_obj.collaborators]:
                return True

        return False

    @staticmethod
    def is_source(user: User, claim_obj: Claim | ClaimCreate | ClaimUpdate) -> bool:
        """
        Check if the user is a source collaborator of the claim.

        Parameters
        ----------
        user : User
            The user model object
        claim_obj : Claim or ClaimCreate or ClaimUpdate
            Claim object

        Returns
        -------
        bool
            True if the user is a source collaborator, otherwise False.
        """
        if hasattr(claim_obj, "source") and claim_obj.source == user.id:
            return True

        return False

    @staticmethod
    def add_coverages(
        db_session: Session,
        *,
        claim_id: UUID,
        coverages: list[ClaimCoverageCreate | ClaimCoverageUpdate],
    ) -> Claim:
        """
        Add coverages to a specific claim.

        Parameters
        ----------
        db_session : Session
            Database session
        claim_id : UUID
            Claim ID.
        coverages : list[ClaimCoverageCreate | ClaimCoverageUpdate]
            A list of claim coverages.

        Returns
        -------
        Claim
            Database model object of Claim.
        """
        with db_session as session:
            stmt = select(Claim).where(Claim.id == claim_id)
            claim_obj = session.scalar(stmt)
            if claim_obj:
                if len(claim_obj.coverages) > 0:
                    # Clear existing claim coverages
                    for coverage in claim_obj.coverages:
                        session.delete(coverage)

                    # Detach the claim object from the session to avoid conflicts
                    session.expunge(claim_obj)

                    # Re-fetch the claim object to ensure it's properly attached
                    claim_obj = session.scalar(stmt)

                for coverage in coverages:
                    claim_obj.coverages.append(
                        ClaimCoverage(
                            claim_id=claim_id,
                            coverage_type=coverage.coverage_type,
                            policy_limit=coverage.policy_limit,
                        )
                    )

                session.commit()
                session.refresh(claim_obj)

        return claim_obj

    @staticmethod
    def append_collaborators(
        db_session: Session,
        *,
        claim_id: UUID,
        collaborators: CollaboratorAppend,
    ) -> Claim:
        """
        Append collaborators to a claim.

        Parameters
        ----------
        db_session : Session
            Database session
        claim_id : UUID
            Claim ID.
        collaborators : CollaboratorAppend
            A list of claim collaborators.

        Returns
        -------
        Claim
            Returns Claim model object.
        """
        with db_session as session:
            stmt = select(Claim).where(Claim.id == claim_id)
            claim_obj = session.scalar(stmt)
            if claim_obj:
                for collaborator in collaborators:
                    # Ensure collaborator is not detached
                    if collaborator not in session:
                        collaborator = session.merge(collaborator)

                    if collaborator not in claim_obj.collaborators:
                        claim_obj.collaborators.append(collaborator)

                session.commit()
                session.refresh(claim_obj)

        return claim_obj

    @staticmethod
    def remove_collaborators(
        db_session: Session,
        *,
        claim_id: UUID,
        collaborators: CollaboratorAppend | list[User],
    ) -> Claim:
        """
        Remove collaborators from a claim.

        Parameters
        ----------
        db_session : Session
            Database session
        claim_id : UUID
            Claim ID.
        collaborators : CollaboratorAppend
            A list of claim collaborators.

        Returns
        -------
        Claim
            Returns Claim model object.
        """
        with db_session as session:
            stmt = select(Claim).where(Claim.id == claim_id)
            claim_obj = session.scalar(stmt)
            if claim_obj:
                for collaborator in collaborators:
                    # Ensure collaborator is not detached
                    if collaborator not in session:
                        collaborator = session.merge(collaborator)

                    if collaborator in claim_obj.collaborators:
                        claim_obj.collaborators.remove(collaborator)

                session.commit()
                session.refresh(claim_obj)

        return claim_obj

    def append_claim_users_as_collaborators(
        self,
        db_session: Session,
        claim_obj: Claim,
        obj_in: ClaimCreate | ClaimUpdate | Claim,
    ) -> Claim:
        """
        Append the claim users such as source, signer, and adjuster as a collaborator to the claim.

        Parameters
        ----------
        db_session : Session
            Database session.
        claim_obj : Claim
            The Claim database model object.
        obj_in : ClaimCreate | ClaimUpdate | Claim
            The schema object fo Claim create or Claim update

        Returns
        -------
        Claim
            The updated claim database model object.
        """
        collaborators_list = []

        if obj_in.source:
            collaborators_list.append(obj_in.source)
        if obj_in.signed_by:
            collaborators_list.append(obj_in.signed_by)
        if obj_in.adjusted_by:
            collaborators_list.append(obj_in.adjusted_by)
        if collaborators_list:
            collaborators = crud.user.get_objects_by_ids(
                db_session, user_ids=collaborators_list
            )

            claim_obj = self.append_collaborators(
                db_session=db_session,
                claim_id=claim_obj.id,
                collaborators=collaborators,
            )

        return claim_obj

    @staticmethod
    def get_replaced_collaborators_list(
        db_session: Session,
        claim_obj: Claim,
        obj_in: ClaimUpdate,
    ) -> list[User] | None:
        """
        Create a list of collaborators replaced with new collaborators.

        Parameters
        ----------
        db_session : Session
            Database session
        claim_obj : Claim
            Database model object of the Claim
        obj_in : ClaimUpdate
            Claim Update schema

        Returns
        -------
        list[User] | None
            A list of user objects in case collaborator/s replaced, otherwise `None`.
        """
        remove_collaborators_list = None
        collaborators_list = []

        if claim_obj.source != obj_in.source:
            collaborators_list.append(claim_obj.source)
        if claim_obj.signed_by != obj_in.signed_by:
            collaborators_list.append(claim_obj.signed_by)
        if claim_obj.adjusted_by != obj_in.adjusted_by:
            collaborators_list.append(claim_obj.adjusted_by)

        if collaborators_list:
            remove_collaborators_list = crud.user.get_objects_by_ids(
                db_session, user_ids=collaborators_list
            )

        return remove_collaborators_list

    def sync_claim_collaborators(
        self,
        db_session: Session,
        ref_number_start: int,
        ref_number_end: int,
    ) -> dict[str, str]:
        """
        Synchronize Source, Signer, and other users of claim with collaborators.

        Parameters
        ----------
        db_session : Session
            Database session
        ref_number_start : int
            Starting point for claim reference number range.
        ref_number_end : int
            Ending point for claim reference number range.
        Returns
        -------
        dict[str, str]
            A `success` or `error` message.
        """

        filters = [
            Claim.ref_number >= ref_number_start,
            Claim.ref_number <= ref_number_end,
        ]

        claims: Sequence[Claim] = self.get_multi(
            db_session,
            join_target={
                Claim.client,
                Claim.claim_contact,
                Claim.assigned_user,
            },
            filters=filters,
            paginated=False,
        )

        for claim_obj in claims:
            self.append_claim_users_as_collaborators(db_session, claim_obj, claim_obj)

        return {"msg": "Collaborators added successfully."}

    @staticmethod
    def create_activity(
        db_session: Session,
        claim_obj: Claim,
        activity_type: ClaimActivityType = ClaimActivityType.PHASE_CHANGED,
        extra_details: str = "",
    ):
        """
        Create an activity for a claim.

        Parameters
        ----------
        db_session : Session
            The database session object
        claim_obj : Claim
            The model object of a claim
        activity_type : ClaimActivityType
            The type of activity to record
        extra_details : str
            Optional contextual info (file name, comment preview, payment amount, etc.)
        """
        user_id = get_user_id()

        if activity_type == ClaimActivityType.ESCALATION_CHANGED:
            title = slug_to_capital_case(claim_obj.escalation_path or "none")
            details = f"Escalation changed to {title}"
        elif activity_type == ClaimActivityType.SUB_STATUS_CHANGED:
            title = slug_to_capital_case(claim_obj.sub_status or "none")
            details = f"Sub-status changed to {title}"
        elif activity_type == ClaimActivityType.CLAIM_CREATED:
            title = "Claim Created"
            details = f"Claim {claim_obj.ref_number} created"
        elif activity_type == ClaimActivityType.DOCUMENT_UPLOADED:
            title = "Document Uploaded"
            details = extra_details or "A document was uploaded"
        elif activity_type == ClaimActivityType.COMMENT_ADDED:
            title = "Message Added"
            details = extra_details or "A comment was added"
        elif activity_type == ClaimActivityType.PAYMENT_ISSUED:
            title = "Payment Issued"
            details = extra_details or "A payment was issued"
        elif activity_type == ClaimActivityType.PAYMENT_UPDATED:
            title = "Payment Updated"
            details = extra_details or "A payment was updated"
        elif activity_type == ClaimActivityType.INSPECTION_COMPLETED:
            title = "Inspection Completed"
            details = extra_details or "An inspection was completed"
        elif activity_type == ClaimActivityType.ESTIMATE_GENERATED:
            title = "Estimate Generated"
            details = extra_details or "An estimate was generated"
        elif activity_type == ClaimActivityType.CLAIM_ASSIGNED:
            title = "Claim Assigned"
            details = extra_details or "Claim was assigned"
        elif activity_type == ClaimActivityType.SUPPLEMENT_EMAIL_SENT:
            title = "Supplement Email Sent"
            details = extra_details or "A supplement email was sent"
        elif activity_type == ClaimActivityType.CARRIER_MESSAGE_SENT:
            title = "Carrier Message"
            details = extra_details or "A carrier message was sent"
        elif activity_type == ClaimActivityType.CLIENT_MESSAGE_SENT:
            title = "Client Message"
            details = extra_details or "A client message was sent"
        elif activity_type == ClaimActivityType.INTERNAL_NOTE_ADDED:
            title = "Internal Note"
            details = extra_details or "An internal note was added"
        elif activity_type == ClaimActivityType.TASK_CREATED:
            title = "Task Created"
            details = extra_details or "A task was created"
        elif activity_type == ClaimActivityType.TASK_STATUS_CHANGED:
            title = "Task Status Changed"
            details = extra_details or "A task status was changed"
        elif activity_type == ClaimActivityType.TASK_ASSIGNED:
            title = "Task Assigned"
            details = extra_details or "A task was assigned"
        elif activity_type == ClaimActivityType.TASK_COMPLETED:
            title = "Task Completed"
            details = extra_details or "A task was completed"
        elif activity_type == ClaimActivityType.CARRIER_ESTIMATE_RECEIVED:
            title = "Carrier Estimate Received"
            details = extra_details or "A carrier estimate was received"
        else:
            title = slug_to_capital_case(claim_obj.current_phase)
            details = f"Phase changed to {title}"

        activity_in = ClaimActivityCreateDB(
            claim_id=claim_obj.id,
            user_id=user_id,
            timestamp=datetime.now(),
            activity_type=activity_type.value,
            title=title,
            details=details,
        )

        claim_activity.create(db_session=db_session, obj_in=activity_in)

        # Auto-create event-triggered tasks if rules exist for this activity type
        if activity_type.value in EVENT_TASK_RULES:
            CRUDClaim.create_event_tasks(db_session, claim_obj, activity_type.value)

    @staticmethod
    def create_event_tasks(
        db_session: Session, claim_obj: Claim, activity_type_value: str
    ) -> None:
        """
        Auto-create tasks for the claim based on an activity event.

        Parameters
        ----------
        db_session : Session
            The database session object
        claim_obj : Claim
            The model object of a claim
        activity_type_value : str
            The activity type value that triggered the event
        """
        rules = EVENT_TASK_RULES.get(activity_type_value)
        if not rules:
            return

        # Query existing non-removed task titles to prevent duplicates
        with db_session as session:
            existing_titles = set(
                session.execute(
                    select(ClaimTask.title).where(
                        ClaimTask.claim_id == claim_obj.id,
                        ClaimTask.is_removed.is_(False),
                    )
                )
                .scalars()
                .all()
            )

        for title, task_type, priority in rules:
            if title in existing_titles:
                continue
            task_in = ClaimTaskCreateDB(
                claim_id=claim_obj.id,
                title=title,
                task_type=task_type,
                priority=priority,
                status=TaskStatus.PENDING,
                assignee_id=claim_obj.assigned_to,
                related_claim_phase=claim_obj.current_phase,
            )
            crud.claim_task.create(db_session=db_session, obj_in=task_in)

    @staticmethod
    def create_phase_tasks(db_session: Session, claim_obj: Claim) -> None:
        """
        Auto-create tasks for the claim based on its current phase.

        Parameters
        ----------
        db_session : Session
            The database session object
        claim_obj : Claim
            The model object of a claim
        """
        rules = PHASE_TASK_RULES.get(claim_obj.current_phase)
        if not rules:
            return

        # Query existing non-removed task titles to prevent duplicates
        with db_session as session:
            existing_titles = set(
                session.execute(
                    select(ClaimTask.title).where(
                        ClaimTask.claim_id == claim_obj.id,
                        ClaimTask.is_removed.is_(False),
                    )
                )
                .scalars()
                .all()
            )

        for title, task_type, priority in rules:
            if title in existing_titles:
                continue
            task_in = ClaimTaskCreateDB(
                claim_id=claim_obj.id,
                title=title,
                task_type=task_type,
                priority=priority,
                status=TaskStatus.PENDING,
                assignee_id=claim_obj.assigned_to,
                related_claim_phase=claim_obj.current_phase,
            )
            crud.claim_task.create(db_session=db_session, obj_in=task_in)


claim = CRUDClaim(Claim)
