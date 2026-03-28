# backend/app/app/crud/crud_waitlist.py

from typing import Any, Dict, Optional, Union
from uuid import UUID
import random
import string

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.waitlist import AIEstimateWaitlist
from app.schemas.waitlist import WaitlistCreate, WaitlistUpdate
from app.core.config import settings


class CRUDWaitlist(CRUDBase[AIEstimateWaitlist, WaitlistCreate, WaitlistUpdate]):
    def generate_unique_passcode(self, db: Session) -> str:
        """Generate a unique 5-character passcode."""
        while True:
            # Generate a random 5-character string (letters and numbers)
            passcode = "".join(
                random.choices(string.ascii_uppercase + string.digits, k=5)
            )

            # Check if passcode exists
            exists = (
                db.query(AIEstimateWaitlist)
                .filter(AIEstimateWaitlist.passcode == passcode)
                .first()
            )

            if not exists:
                return passcode

    def create(self, db: Session, *, obj_in: Dict[str, Any]) -> AIEstimateWaitlist:
        # Generate passcode first
        passcode = self.generate_unique_passcode(db)

        # Create object with generated passcode
        db_obj = AIEstimateWaitlist(
            first_name=obj_in["first_name"],
            last_name=obj_in["last_name"],
            email=obj_in["email"],
            phone=obj_in["phone"],
            address=obj_in["address"],
            customer_city=obj_in["customer_city"],
            customer_state=obj_in["customer_state"],
            customer_zip_code=obj_in["customer_zip_code"],
            loss_address=obj_in.get("loss_address"),
            loss_city=obj_in.get("loss_city"),
            loss_state=obj_in.get("loss_state"),
            loss_zip_code=obj_in.get("loss_zip_code"),
            cause_of_loss=obj_in["cause_of_loss"],
            date_of_loss=obj_in["date_of_loss"],
            damage_description=obj_in.get("damage_description", ""),
            insurance_company=obj_in["insurance_company"],
            policy_number=obj_in["policy_number"],
            claim_number=obj_in.get("claim_number"),
            mortgage_company=obj_in.get("mortgage_company"),
            policy_file_path=obj_in.get("policy_file_path", "dummy"),
            damage_photos_paths=obj_in.get("damage_photos_paths", []),
            initials=obj_in.get("initials"),
            passcode=passcode,
        )

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


waitlist = CRUDWaitlist(AIEstimateWaitlist)
