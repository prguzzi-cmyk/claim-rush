#!/usr/bin/env python

"""
E-Sign Agreement Service
=========================
Core business logic for agreement generation, signing, delivery, and audit.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.agreement import Agreement, AgreementAuditEntry
from app.schemas.agreement import (
    AgreementCreate, AgreementMetrics, AgreementUpdate, SignRequest,
)

logger = logging.getLogger(__name__)


class AgreementService:
    def __init__(self, db: Session):
        self.db = db

    # ══════════════════════════════════════════════════════════════
    # 1. Agreement CRUD
    # ══════════════════════════════════════════════════════════════

    def generate_agreement(self, data: AgreementCreate) -> Agreement:
        """Create a new agreement from lead/claim data or as a blank for PDF upload."""
        agreement = Agreement(
            lead_id=data.lead_id,
            agent_id=data.agent_id,
            signer_name=data.signer_name,
            signer_email=data.signer_email,
            signer_phone=data.signer_phone,
            title=data.title,
            source=data.source,
            signing_mode=data.signing_mode,
            field_config=data.field_config,
            status="draft",
        )
        self.db.add(agreement)
        self.db.commit()
        self.db.refresh(agreement)
        self._audit(agreement.id, "created", f"Agreement created: {data.title}")
        return agreement

    def update_agreement(self, agreement_id: UUID, updates: AgreementUpdate) -> Optional[Agreement]:
        agr = self.db.get(Agreement, agreement_id)
        if not agr:
            return None
        for field, value in updates.model_dump(exclude_unset=True).items():
            setattr(agr, field, value)
        self.db.commit()
        self.db.refresh(agr)
        return agr

    def get_agreement(self, agreement_id: UUID) -> Optional[Agreement]:
        return self.db.get(Agreement, agreement_id)

    def list_agreements(self, agent_id: Optional[UUID] = None, status: Optional[str] = None,
                        limit: int = 50) -> list[Agreement]:
        stmt = select(Agreement).where(Agreement.is_removed == False)
        if agent_id:
            stmt = stmt.where(Agreement.agent_id == agent_id)
        if status:
            stmt = stmt.where(Agreement.status == status)
        stmt = stmt.order_by(Agreement.created_at.desc()).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    # ══════════════════════════════════════════════════════════════
    # 2. PDF Upload
    # ══════════════════════════════════════════════════════════════

    def upload_pdf(self, agreement_id: UUID, pdf_url: str) -> Optional[Agreement]:
        agr = self.db.get(Agreement, agreement_id)
        if not agr:
            return None
        agr.original_pdf_url = pdf_url
        agr.source = "uploaded"
        self.db.commit()
        self._audit(agreement_id, "pdf_uploaded", f"PDF uploaded: {pdf_url}")
        return agr

    # ══════════════════════════════════════════════════════════════
    # 3. Send Agreement
    # ══════════════════════════════════════════════════════════════

    def send_agreement(self, agreement_id: UUID) -> Optional[Agreement]:
        agr = self.db.get(Agreement, agreement_id)
        if not agr:
            return None
        agr.status = "sent"
        agr.sent_at = datetime.now(timezone.utc)
        agr.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        self.db.commit()
        self._audit(agreement_id, "sent", f"Agreement sent to {agr.signer_email}")
        # Future: trigger email/SMS delivery
        logger.info(f"Agreement {agreement_id} sent to {agr.signer_email}")
        return agr

    # ══════════════════════════════════════════════════════════════
    # 4. Track Status
    # ══════════════════════════════════════════════════════════════

    def mark_viewed(self, agreement_id: UUID, env: dict) -> None:
        agr = self.db.get(Agreement, agreement_id)
        if not agr:
            return
        if not agr.viewed_at:
            agr.viewed_at = datetime.now(timezone.utc)
            agr.status = "viewed"
        self.db.commit()
        self._audit(agreement_id, "viewed", "Agreement opened by signer", env=env)

    def mark_started(self, agreement_id: UUID, env: dict) -> None:
        agr = self.db.get(Agreement, agreement_id)
        if not agr:
            return
        if not agr.started_at:
            agr.started_at = datetime.now(timezone.utc)
            agr.status = "started"
        self.db.commit()
        self._audit(agreement_id, "started", "Signer began completing fields", env=env)

    # ══════════════════════════════════════════════════════════════
    # 5. Complete Agreement (Sign)
    # ══════════════════════════════════════════════════════════════

    def complete_agreement(self, agreement_id: UUID, sign_req: SignRequest) -> Optional[Agreement]:
        agr = self.db.get(Agreement, agreement_id)
        if not agr:
            return None

        agr.status = "signed"
        agr.signed_at = datetime.now(timezone.utc)
        agr.signature_method = sign_req.signature_method

        env = {
            "ip_address": sign_req.ip_address,
            "device_type": sign_req.device_type,
            "browser": sign_req.browser,
            "platform": sign_req.platform,
        }

        # Log each completed field
        for field in sign_req.completed_fields:
            self._audit(agreement_id, "field_completed",
                        f"Field {field.get('field_id')} completed: {field.get('field_type')}",
                        env=env, field_id=field.get("field_id"), field_type=field.get("field_type"),
                        sig_method=sign_req.signature_method if field.get("field_type") == "signature" else None)

        self._audit(agreement_id, "signed",
                    f"Agreement signed via {sign_req.signature_method} by {agr.signer_name}",
                    env=env, sig_method=sign_req.signature_method)

        self.db.commit()
        self.db.refresh(agr)

        # Update lead status
        self._update_lead_status(agr)

        return agr

    # ══════════════════════════════════════════════════════════════
    # 6. Send Completed Copies
    # ══════════════════════════════════════════════════════════════

    def send_completed_copies(self, agreement_id: UUID) -> dict:
        agr = self.db.get(Agreement, agreement_id)
        if not agr or agr.status != "signed":
            return {"insured": False, "agent": False}

        result = {"insured": False, "agent": False}

        if agr.signer_email:
            # Future: send email with signed PDF attachment
            logger.info(f"[EMAIL] Signed copy sent to insured: {agr.signer_email}")
            agr.insured_copy_sent = True
            result["insured"] = True
            self._audit(agreement_id, "delivered_insured", f"Signed copy sent to {agr.signer_email}")

        if agr.agent_id:
            # Future: send email to agent
            logger.info(f"[EMAIL] Signed copy sent to agent: {agr.agent_id}")
            agr.agent_copy_sent = True
            result["agent"] = True
            self._audit(agreement_id, "delivered_agent", "Signed copy sent to assigned agent")

        self.db.commit()
        return result

    # ══════════════════════════════════════════════════════════════
    # 7. Reminders
    # ══════════════════════════════════════════════════════════════

    def send_reminder(self, agreement_id: UUID) -> bool:
        agr = self.db.get(Agreement, agreement_id)
        if not agr or agr.status in ("signed", "cancelled", "expired"):
            return False
        agr.reminder_count = (agr.reminder_count or 0) + 1
        agr.last_reminder_at = datetime.now(timezone.utc)
        self.db.commit()
        self._audit(agreement_id, "reminder_sent", f"Reminder #{agr.reminder_count} sent")
        logger.info(f"Agreement {agreement_id} reminder #{agr.reminder_count}")
        return True

    # ══════════════════════════════════════════════════════════════
    # 8. Audit Trail
    # ══════════════════════════════════════════════════════════════

    def get_audit_trail(self, agreement_id: UUID) -> list[AgreementAuditEntry]:
        stmt = (select(AgreementAuditEntry)
                .where(AgreementAuditEntry.agreement_id == agreement_id)
                .order_by(AgreementAuditEntry.created_at.asc()))
        return list(self.db.execute(stmt).scalars().all())

    # ══════════════════════════════════════════════════════════════
    # 9. Metrics
    # ══════════════════════════════════════════════════════════════

    def get_metrics(self, agent_id: Optional[UUID] = None) -> AgreementMetrics:
        base = select(Agreement).where(Agreement.is_removed == False)
        if agent_id:
            base = base.where(Agreement.agent_id == agent_id)

        def count_status(s: str) -> int:
            return self.db.execute(
                select(func.count()).select_from(base.where(Agreement.status == s).subquery())
            ).scalar() or 0

        sent = count_status("sent") + count_status("viewed") + count_status("started") + count_status("signed")
        viewed = count_status("viewed") + count_status("started") + count_status("signed")
        signed = count_status("signed")
        certified = self.db.execute(
            select(func.count()).select_from(
                base.where(and_(Agreement.signing_mode == "certified", Agreement.status == "signed")).subquery()
            )
        ).scalar() or 0
        pending = count_status("sent") + count_status("viewed") + count_status("started")
        conversion = (signed / sent * 100) if sent > 0 else 0.0

        return AgreementMetrics(
            agreements_sent=sent,
            agreements_viewed=viewed,
            agreements_signed=signed,
            conversion_rate=round(conversion, 1),
            certified_usage=certified,
            pending_signatures=pending,
            avg_time_to_sign_hours=None,
        )

    # ── Internal ──────────────────────────────────────────────────

    def _audit(self, agreement_id: UUID, action: str, details: str,
               env: Optional[dict] = None, field_id: Optional[str] = None,
               field_type: Optional[str] = None, sig_method: Optional[str] = None) -> None:
        entry = AgreementAuditEntry(
            agreement_id=agreement_id,
            action=action,
            details=details,
            ip_address=env.get("ip_address") if env else None,
            device_type=env.get("device_type") if env else None,
            browser=env.get("browser") if env else None,
            platform=env.get("platform") if env else None,
            field_id=field_id,
            field_type=field_type,
            signature_method=sig_method,
        )
        self.db.add(entry)

    def _update_lead_status(self, agr: Agreement) -> None:
        if not agr.lead_id:
            return
        from app.models.client_portal_lead import ClientPortalLead
        lead = self.db.get(ClientPortalLead, agr.lead_id)
        if lead:
            lead.status = "signed"
            self.db.commit()
