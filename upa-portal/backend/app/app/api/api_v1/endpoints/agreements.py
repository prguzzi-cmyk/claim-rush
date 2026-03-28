#!/usr/bin/env python

"""
E-Sign Agreement Endpoints
============================
Agreement generation, PDF upload, signing, delivery, reminders, and audit.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.agreement import (
    AgreementCreate, AgreementMetrics, AgreementRead,
    AgreementUpdate, AuditEntryRead, SignRequest,
)
from app.services.agreement_service import AgreementService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/agreements", response_model=AgreementRead)
def create_agreement(data: AgreementCreate, db: Session = Depends(get_db)):
    return AgreementService(db).generate_agreement(data)


@router.get("/agreements", response_model=list[AgreementRead])
def list_agreements(agent_id: Optional[UUID] = None, status: Optional[str] = None,
                    limit: int = 50, db: Session = Depends(get_db)):
    return AgreementService(db).list_agreements(agent_id=agent_id, status=status, limit=limit)


@router.get("/agreements/{agreement_id}", response_model=AgreementRead)
def get_agreement(agreement_id: UUID, db: Session = Depends(get_db)):
    agr = AgreementService(db).get_agreement(agreement_id)
    if not agr:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return agr


@router.patch("/agreements/{agreement_id}", response_model=AgreementRead)
def update_agreement(agreement_id: UUID, updates: AgreementUpdate, db: Session = Depends(get_db)):
    agr = AgreementService(db).update_agreement(agreement_id, updates)
    if not agr:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return agr


@router.post("/agreements/{agreement_id}/upload-pdf")
def upload_agreement_pdf(agreement_id: UUID, pdf_url: str, db: Session = Depends(get_db)):
    """Attach an uploaded PDF to an agreement."""
    agr = AgreementService(db).upload_pdf(agreement_id, pdf_url)
    if not agr:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return {"status": "uploaded", "pdf_url": pdf_url}


@router.post("/agreements/{agreement_id}/send", response_model=AgreementRead)
def send_agreement(agreement_id: UUID, db: Session = Depends(get_db)):
    agr = AgreementService(db).send_agreement(agreement_id)
    if not agr:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return agr


@router.post("/agreements/{agreement_id}/viewed")
def mark_viewed(agreement_id: UUID, ip_address: Optional[str] = None,
                device_type: Optional[str] = None, browser: Optional[str] = None,
                platform: Optional[str] = None, db: Session = Depends(get_db)):
    env = {"ip_address": ip_address, "device_type": device_type, "browser": browser, "platform": platform}
    AgreementService(db).mark_viewed(agreement_id, env)
    return {"status": "viewed"}


@router.post("/agreements/{agreement_id}/started")
def mark_started(agreement_id: UUID, ip_address: Optional[str] = None,
                 device_type: Optional[str] = None, browser: Optional[str] = None,
                 platform: Optional[str] = None, db: Session = Depends(get_db)):
    env = {"ip_address": ip_address, "device_type": device_type, "browser": browser, "platform": platform}
    AgreementService(db).mark_started(agreement_id, env)
    return {"status": "started"}


@router.post("/agreements/{agreement_id}/sign", response_model=AgreementRead)
def sign_agreement(agreement_id: UUID, sign_req: SignRequest, db: Session = Depends(get_db)):
    svc = AgreementService(db)
    agr = svc.complete_agreement(agreement_id, sign_req)
    if not agr:
        raise HTTPException(status_code=404, detail="Agreement not found")
    # Auto-send completed copies
    svc.send_completed_copies(agreement_id)
    return agr


@router.post("/agreements/{agreement_id}/deliver")
def deliver_copies(agreement_id: UUID, db: Session = Depends(get_db)):
    result = AgreementService(db).send_completed_copies(agreement_id)
    return result


@router.post("/agreements/{agreement_id}/remind")
def send_reminder(agreement_id: UUID, db: Session = Depends(get_db)):
    sent = AgreementService(db).send_reminder(agreement_id)
    if not sent:
        raise HTTPException(status_code=400, detail="Cannot send reminder for this agreement")
    return {"status": "reminder_sent"}


@router.get("/agreements/{agreement_id}/audit", response_model=list[AuditEntryRead])
def get_audit_trail(agreement_id: UUID, db: Session = Depends(get_db)):
    return AgreementService(db).get_audit_trail(agreement_id)


@router.get("/agreements/metrics/summary", response_model=AgreementMetrics)
def get_metrics(agent_id: Optional[UUID] = None, db: Session = Depends(get_db)):
    return AgreementService(db).get_metrics(agent_id=agent_id)
