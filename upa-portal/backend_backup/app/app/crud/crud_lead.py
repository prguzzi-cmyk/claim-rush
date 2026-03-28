#!/usr/bin/env python

"""CRUD operations for the lead, and contact model"""

from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app import crud
from app.crud.base import CRUDBase
from app.models import Contact, FollowUp, Lead
from app.schemas import LeadCreate, LeadUpdate


class CRUDLead(CRUDBase[Lead, LeadCreate, LeadUpdate]):
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
                source=obj_in.source.value,
                source_info=obj_in.source_info,
                instructions_or_notes=obj_in.instructions_or_notes,
                assigned_to=user_obj.id,
                can_be_removed=obj_in.can_be_removed,
            )

            contact_obj = Contact(
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

            follow_ups_obj = []
            if obj_in.follow_ups:
                for follow_up in obj_in.follow_ups:
                    follow_up_obj = FollowUp(note=follow_up.note)
                    follow_up_obj.lead = lead_obj
                    follow_ups_obj.append(follow_up_obj)

            lead_obj.contact = contact_obj
            lead_obj.follow_ups = follow_ups_obj
            contact_obj.lead = lead_obj

            session.add(lead_obj)
            session.add(contact_obj)
            session.add_all(follow_ups_obj)
            session.commit()
            session.refresh(lead_obj)

            return lead_obj

    def update(
        self, db_session: Session, *, db_obj: Lead, obj_in: LeadUpdate | dict[str, Any]
    ) -> Lead:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            obj_data = jsonable_encoder(db_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and field != "contact":
                    setattr(db_obj, field, update_data[field])

            # Set attributes for contact
            if update_data.get("contact"):
                for field in obj_data["contact"]:
                    if field in update_data["contact"]:
                        setattr(db_obj.contact, field, update_data["contact"][field])

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj


lead = CRUDLead(Lead)
