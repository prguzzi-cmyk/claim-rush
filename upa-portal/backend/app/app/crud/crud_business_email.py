#!/usr/bin/env python

"""CRUD operations for the Business email model"""

from sqlalchemy import select
from sqlalchemy.orm import Session, with_polymorphic

from app.core.security import encrypt_string
from app.crud.base import CRUDBase
from app.models import BusinessEmail, ClaimBusinessEmail
from app.schemas import BusinessEmailCreate, BusinessEmailUpdate


class CRUDBusinessEmail(
    CRUDBase[BusinessEmail, BusinessEmailCreate, BusinessEmailUpdate]
):
    @staticmethod
    def get_by_email(
        db_session: Session, *, email: str
    ) -> BusinessEmail | ClaimBusinessEmail | None:
        """
        Retrieve a business email via email filtration.

        Parameters
        ----------
        db_session : Session
            Database session
        email : str
            Email address

        Returns
        -------
        BusinessEmail
            Returns the BusinessEmail | ClaimBusinessEmail object or None.
        """
        with db_session as session:
            business_emails = with_polymorphic(BusinessEmail, "*")
            stmt = select(business_emails).where(business_emails.email == email.lower())
            return session.scalar(stmt)

    def create(
        self, db_session: Session, *, obj_in: BusinessEmailCreate
    ) -> BusinessEmail:
        with db_session as session:
            bus_email_obj = BusinessEmail(
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

            return bus_email_obj


business_email = CRUDBusinessEmail(BusinessEmail)
