#!/usr/bin/env python

"""CRUD operations for the Claim Business email model"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import encrypt_string
from app.crud.base import CRUDBase
from app.models import ClaimBusinessEmail
from app.schemas import ClaimBusinessEmailCreate, ClaimBusinessEmailUpdate


class CRUDClaimBusinessEmail(
    CRUDBase[ClaimBusinessEmail, ClaimBusinessEmailCreate, ClaimBusinessEmailUpdate]
):
    def create(
        self, db_session: Session, *, obj_in: ClaimBusinessEmailCreate
    ) -> ClaimBusinessEmail:
        with db_session as session:
            try:
                bus_email_obj = ClaimBusinessEmail(
                    claim_id=obj_in.claim_id,
                    first_name=obj_in.first_name,
                    last_name=obj_in.last_name,
                    username=obj_in.username,
                    email=obj_in.email,
                    hashed_password=encrypt_string(obj_in.password),
                    is_active=obj_in.is_active,
                )

                session.add(bus_email_obj)
                session.commit()
                session.refresh(bus_email_obj)

                print("Business email has been stored in the database.")

                return bus_email_obj
            except IntegrityError:
                print(f"This email `{obj_in.email}` already exists in the database.")


claim_business_email = CRUDClaimBusinessEmail(ClaimBusinessEmail)
