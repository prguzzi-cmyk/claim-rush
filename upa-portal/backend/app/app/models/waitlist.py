# backend/app/app/models/waitlist.py

from typing import List
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Date, Text, JSON, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.sql import func

from app.db.base_class import Base

# trigger merge request


class AIEstimateWaitlist(Base):
    __tablename__ = "ai_estimate_waitlist"
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Customer Information
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    address = Column(Text, nullable=False)
    customer_city = Column(String(100))
    customer_state = Column(String(2))
    customer_zip_code = Column(String(10))

    # Loss Information
    loss_address = Column(Text)
    loss_city = Column(String(100))
    loss_state = Column(String(2))
    loss_zip_code = Column(String(10))
    cause_of_loss = Column(String(255), nullable=False)
    date_of_loss = Column(Date, nullable=False)
    damage_description = Column(Text, nullable=False)

    # Insurance Information
    insurance_company = Column(String(255), nullable=False)
    policy_number = Column(String(100), nullable=False)
    claim_number = Column(String(100))
    mortgage_company = Column(String(255))

    # Files
    policy_file_path = Column(String(500), nullable=False)
    damage_photos_paths = Column(JSON, nullable=False)

    # Additional Information
    initials = Column(String(3))
    passcode = Column(String(5), nullable=False, unique=True)
    status = Column(String(50), nullable=False, server_default="pending")
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, server_default="true")

    # Timestamps and User References
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_by_id = Column(PGUUID(as_uuid=True), ForeignKey("user.id"))
    updated_by_id = Column(PGUUID(as_uuid=True), ForeignKey("user.id"))
