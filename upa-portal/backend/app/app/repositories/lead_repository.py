#!/usr/bin/env python

from enum import Enum

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.log import logger
from app.exceptions import DatabaseOperationError
from app.models import Lead, LeadContact
from app.repositories import BaseRepository
from app.schemas import LeadCreate, LeadUpdate
from app.utils.common import custom_jsonable_encoder


class LeadRepository(BaseRepository[Lead, LeadCreate, LeadUpdate]):
    """
    Repository for managing Lead entities in the database.

    Attributes
    ----------
    db_session : Session
        The database session used for accessing lead data.
    """

    def __init__(self, db_session: Session):
        """
        Initializes the LeadRepository with the given database session.

        Parameters
        ----------
        db_session : Session
            The database session used for accessing lead data.
        """
        super().__init__(db_session, Lead)

    def create(self, entity: LeadCreate) -> Lead:
        with self.db_session as session:
            try:
                # Generate the new reference number
                ref_number = self.generate_new_ref_number(session, Lead)

                # Create Lead entity from LeadCreate schema
                lead_entity = Lead(
                    loss_date=entity.loss_date,
                    peril=entity.peril,
                    insurance_company=entity.insurance_company,
                    policy_number=entity.policy_number,
                    claim_number=entity.claim_number,
                    status=entity.status.value,
                    source=entity.source,
                    source_info=entity.source_info,
                    instructions_or_notes=entity.instructions_or_notes,
                    assigned_to=entity.assigned_to,
                    ref_number=ref_number,
                    can_be_removed=entity.can_be_removed,
                )

                # Create the Lead Contact entity
                lead_contact_entity = LeadContact(
                    full_name=entity.contact.full_name,
                    full_name_alt=entity.contact.full_name_alt,
                    email=entity.contact.email,
                    email_alt=entity.contact.email_alt,
                    phone_number=entity.contact.phone_number,
                    phone_number_alt=entity.contact.phone_number_alt,
                    address=entity.contact.address,
                    city=entity.contact.city,
                    state=entity.contact.state,
                    zip_code=entity.contact.zip_code,
                    address_loss=entity.contact.address_loss,
                    city_loss=entity.contact.city_loss,
                    state_loss=entity.contact.state_loss,
                    zip_code_loss=entity.contact.zip_code_loss,
                )

                # Establish the relationship between lead and lead contact
                lead_entity.user_meta = lead_contact_entity
                lead_contact_entity.lead = lead_entity

                # Add both lead and lead contact to the session
                session.add(lead_entity)
                session.add(lead_contact_entity)
                session.commit()

                # Fetch and return the newly created lead entity
                session.refresh(lead_entity)
                return lead_entity
            except SQLAlchemyError as e:
                # Rollback the session in case of any database error
                session.rollback()
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to create {self.model.__name__}: {str(e)}"
                )

    def update(self, db_entity: Lead, entity: LeadUpdate) -> Lead:
        with self.db_session as session:
            try:
                # Convert the existing entity to JSON-compatible format
                entity_json = custom_jsonable_encoder(db_entity)

                # Convert the incoming schema to a dictionary, excluding unset values
                update_data = entity.dict(exclude_unset=True)

                # Update the Lead entity attributes
                for field, value in update_data.items():
                    # Skip nested dictionaries
                    if isinstance(value, dict):
                        continue

                    if field in entity_json:
                        # Handle Enum fields specifically
                        if isinstance(value, Enum):
                            setattr(db_entity, field, value.value)
                        else:
                            setattr(db_entity, field, value)

                # Update the contact attributes if present
                contact_data = update_data.get("contact")
                if contact_data:
                    for field, value in contact_data.items():
                        if hasattr(db_entity.contact, field):
                            setattr(db_entity.contact, field, value)

                # Persist the changes in the session
                session.add(db_entity)
                session.commit()
                session.refresh(db_entity)

                return db_entity
            except SQLAlchemyError as e:
                session.rollback()
                logger.exception(e)
                raise DatabaseOperationError(
                    f"Failed to update {self.model.__name__}: {str(e)}"
                )
