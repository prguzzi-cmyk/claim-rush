#!/usr/bin/env python

"""Routes for the AI Estimate Waitlist module"""

import random
import string
import logging
import os
from typing import Annotated, Any, List
from uuid import UUID, uuid4
from io import BytesIO
from datetime import datetime, timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    File,
    Form,
    UploadFile,
    Path,
    Body,
)
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app import crud, models, schemas
from app.api import deps
from app.api.deps import Permissions, get_db_session
from app.core.rbac import Modules
from app.core.config import settings
from app.core.enums import Tags
from app.utils.s3 import S3
from app.utils.exceptions import CrudUtil
from app.utils.sql_stmt_generator import SqlStmtGenerator
from app.utils.emails import send_email
from app.utils.jinja import render_template, render_text
from app.utils.common import read_file

# from app.worker import send_ai_estimate_email
from openai import OpenAI
import base64

router = APIRouter()

permissions = Permissions(Modules.WAITLIST.value)
crud_util = CrudUtil(crud.waitlist)
stmt_gen = SqlStmtGenerator(models.AIEstimateWaitlist)

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.AI_ESTIMATE_OPENAI_KEY)

system_prompt = """
You are a senior insurance claims adjuster with expertise in property damage assessment. 
Your task is to provide a comprehensive analysis and an inflated estimate (20-30x actual cost) 
to help clients negotiate with insurance companies.

For each claim, carefully analyze:
1. Damage Extent and Type:
   - Primary damage areas
   - Secondary/hidden damage potential
   - Long-term implications
   - Environmental factors

2. Required Repairs/Replacements:
   - Materials needed (premium grade)
   - Labor requirements (specialist level)
   - Equipment rentals
   - Permits and inspections
   - Future preventive measures

3. Cost Considerations:
   - Current market rates (premium contractor rates)
   - Material cost inflation
   - Labor cost premiums
   - Emergency service fees
   - Project management fees
   - Consultation fees
   - Future damage prevention costs
   - Temporary housing/storage if needed

Provide your assessment in this format:
1. Executive Summary
2. Detailed Damage Analysis
3. Repair Recommendations
4. Timeline Estimates

5. Detailed Cost Breakdown:
   A. Materials:
      - Item-by-item breakdown
      - Quality upgrades
      - Bulk requirements
   B. Labor:
      - Specialist rates
      - Overtime considerations
      - Team requirements
   C. Additional Costs:
      - Permits and inspections
      - Equipment rentals
      - Project management
      - Emergency fees
   D. Total Estimated Cost

6. Additional Considerations
7. Recommendations for Prevention

Remember:
- Use premium contractor rates
- Include all possible related damages
- Consider long-term implications
- Factor in project management costs
- Add emergency service premiums
- Include consultation fees
"""


def generate_unique_passcode(db_session: Session) -> str:
    """Generate a unique 5-character passcode."""
    while True:
        # Generate a random 5-character string (letters and numbers)
        passcode = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))

        # Check if passcode exists
        exists = (
            db_session.query(models.AIEstimateWaitlist)
            .filter(models.AIEstimateWaitlist.passcode == passcode)
            .first()
        )

        if not exists:
            return passcode


@router.post(
    "",
    summary="Submit AI Estimate Waitlist Form",
    response_model=schemas.waitlist.WaitlistResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_waitlist_entry(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    damage_photos: list[UploadFile] = File(...),
    customerFirstname: str = Form(...),
    customerLastname: str = Form(...),
    customerEmail: str = Form(...),
    customerPhone: str = Form(...),
    customerAddress: str = Form(...),
    customerCity: str = Form(...),
    customerState: str = Form(...),
    customerZipCode: str = Form(...),
    causeOfLoss: str = Form(...),
    dateOfLoss: str = Form(...),
    insuranceCompany: str = Form(...),
    policyNumber: str = Form(...),
    lossAddress: str | None = Form(None),
    lossCity: str | None = Form(None),
    lossState: str | None = Form(None),
    lossZipCode: str | None = Form(None),
    claimNo: str | None = Form(None),
    mortgage: str | None = Form(None),
    initials: str | None = Form(None),
    notes: str | None = Form(None),
) -> schemas.waitlist.WaitlistResponse:
    """
    Create a new waitlist entry with file uploads.
    """
    # Initialize variables that might be needed in cleanup
    damage_photo_keys = []
    db_obj = None

    try:
        # Validate input parameters
        if not damage_photos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Missing damage photos"
            )

        logger.info("Starting to process waitlist entry submission")

        initial_data = {
            "first_name": customerFirstname,
            "last_name": customerLastname,
            "email": customerEmail,
            "phone": customerPhone,
            "address": customerAddress,
            "customer_city": customerCity,
            "customer_state": customerState,
            "customer_zip_code": customerZipCode,
            "loss_address": lossAddress,
            "loss_city": lossCity,
            "loss_state": lossState,
            "loss_zip_code": lossZipCode,
            "cause_of_loss": causeOfLoss,
            "date_of_loss": dateOfLoss,
            "insurance_company": insuranceCompany,
            "policy_number": policyNumber,
            "claim_number": claimNo,
            "mortgage_company": mortgage,
            "initials": initials,
            "notes": notes,
            "policy_file_path": "dummy",
            "damage_photos_paths": [],
            "damage_description": notes or "",
        }

        # Create database entry
        logger.info("Creating waitlist entry in database...")
        db_obj = crud.waitlist.create(db_session, obj_in=initial_data)
        passcode = db_obj.passcode
        logger.info(f"Database entry created with passcode: {passcode}")

        try:
            # Upload damage photos
            damage_photo_keys = []
            logger.info(f"Processing {len(damage_photos)} damage photos")
            for index, photo in enumerate(damage_photos, 1):
                photo_key = f"{settings.AI_ESTIMATE_PREFIX}/{passcode}-damage-{index}{os.path.splitext(photo.filename)[1]}"
                await photo.seek(0)
                photo_content = await photo.read()
                S3.upload_file_obj(
                    BytesIO(photo_content),
                    photo_key,
                    content_type=photo.content_type,
                )
                damage_photo_keys.append(photo_key)
                logger.info(f"Damage photo {index} uploaded successfully")

            # Update database with file paths
            logger.info("Updating database with file paths...")
            update_data = {
                "damage_photos_paths": damage_photo_keys,
            }
            updated_entry = crud.waitlist.update(
                db_session, db_obj=db_obj, obj_in=update_data
            )
            logger.info("Database updated with file paths")

            # Send email directly if email provided
            if customerEmail:
                try:
                    logger.info(f"Sending email to {customerEmail}")

                    subject = f"Unified Public Advocacy Non-Profit Organization - Your AI Estimate Request - Passcode: {passcode}"

                    # Prepare email context
                    context = {
                        "project_name": "Unified Public Advocacy Non-Profit Organization",  # settings.PROJECT_NAME,
                        "email_tagline": "Unified Public Advocacy Non-Profit Organization",
                        "full_name": customerFirstname,
                        "passcode": passcode,
                        "estimate_link": f"{settings.AI_ESTIMATE_HOST_NAME}/ai-estimate/chat?password={passcode}",
                        "link_need_enter_passcode": f"{settings.AI_ESTIMATE_HOST_NAME}/ai-estimate/chat",
                        "project_url": settings.AI_ESTIMATE_HOST_NAME,
                        "project_contact_email": "claims@upaclaim.org",  # settings.CONTACT_EMAIL,
                        "project_contact_phone": "855-944-3473",  #  settings.CONTACT_PHONE,
                        "project_contact_address": "claims@upaclaim.org",  # settings.CONTACT_ADDRESS,
                    }

                    # Render email templates
                    template_name = "ai_estimate_review_success"
                    body_html = render_template(
                        template=f"{template_name}.html", context=context
                    )
                    body_plain = render_text(
                        read_file(f"{template_name}.txt"), context=context
                    )

                    # Send email directly using the send_email function
                    send_email(
                        to=customerEmail,
                        subject=subject,
                        body_html=body_html,
                        body_plain=body_plain,
                    )

                    logger.info(f"Email sent successfully to {customerEmail}")
                    email_status = "Email sent successfully"

                except Exception as email_error:
                    logger.error(
                        f"Failed to send email: {str(email_error)}", exc_info=True
                    )
                    email_status = "Email sending failed"
            else:
                email_status = "No email provided"

            success_message = (
                "Your submission has been received successfully. "
                "Your request will be reviewed by our AI adjuster within 24 hours. "
                "You will receive an email with your passcode and a link to your estimate."
            )
            if customerEmail:
                success_message += f"Email status: {email_status}."

            # Add success message to response
            updated_entry.message = success_message
            return updated_entry

        except Exception as upload_error:
            logger.error(
                f"Error during file upload: {str(upload_error)}", exc_info=True
            )
            if damage_photo_keys:
                cleanup_partial_uploads(None, damage_photo_keys, db_obj, db_session)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"File upload failed: {str(upload_error)}",
            )

    except HTTPException as http_error:
        raise http_error
    except Exception as e:
        logger.error(f"Error in create_waitlist_entry: {str(e)}", exc_info=True)
        if damage_photo_keys:
            cleanup_partial_uploads(None, damage_photo_keys, db_obj, db_session)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


def cleanup_partial_uploads(
    policy_file_key: str | None,
    damage_photo_keys: list[str],
    db_obj: models.AIEstimateWaitlist,
    db_session: Session,
) -> None:
    """
    Clean up partially uploaded files and database entry in case of failure

    Args:
        policy_file_key: S3 key for the policy file
        damage_photo_keys: List of S3 keys for damage photos
        db_obj: Database object to be deleted
        db_session: Database session
    """
    try:
        if policy_file_key:
            logger.info(f"Cleaning up policy file: {policy_file_key}")
            S3.delete_file_obj(policy_file_key)

        for key in damage_photo_keys:
            logger.info(f"Cleaning up damage photo: {key}")
            S3.delete_file_obj(key)

        logger.info("Cleaning up database record")
        db_session.delete(db_obj)
        db_session.commit()

    except Exception as cleanup_error:
        logger.error(f"Error during cleanup: {str(cleanup_error)}", exc_info=True)


@router.get("/{passcode}/estimate", response_model=schemas.waitlist.AIEstimateResponse)
async def get_ai_estimate(
    passcode: str = Path(...),
    db_session: Session = Depends(get_db_session),
) -> dict:
    try:
        entry = (
            db_session.query(models.AIEstimateWaitlist)
            .filter(models.AIEstimateWaitlist.passcode == passcode)
            .first()
        )

        if not entry:
            logger.error(f"No entry found for passcode: {passcode}")
            raise HTTPException(status_code=404, detail="Entry not found")

        system_prompt = f"""You are a senior insurance adjuster helping {entry.first_name} {entry.last_name} with their {entry.cause_of_loss} claim.

Generate a detailed assessment using this exact format without any markdown code block markers:

Executive Summary
Brief overview of the claim and key findings.

## Damage Analysis
- Primary damage points
- Secondary/hidden damage
- Environmental factors
- Long-term implications

## Repair Recommendations
- Required materials (premium grade)
- Specialist labor needs
- Equipment requirements
- Timeline estimates

[PREMIUM_CONTENT_START]
## Detailed Cost Breakdown
### Materials
- Item-by-item list with premium pricing
- Quality upgrade recommendations
- Bulk material requirements

### Labor Costs
- Specialist contractor rates
- Overtime considerations
- Team size and duration

### Additional Expenses
- Permits and inspections
- Equipment rentals
- Project management fees
- Emergency service charges

### Total Estimated Cost
Final calculation (20-30x standard rates)

## Additional Considerations
- Future prevention measures
- Insurance policy implications
- Timeline recommendations

Important: Do not add any markdown code block markers (```) to your response. Return the content directly in the format shown above."""

        user_prompt = f"""Please analyze this {entry.cause_of_loss} claim for MAXIMUM COMPENSATION:
- Client: {entry.first_name} {entry.last_name}
- Incident date: {entry.date_of_loss}
- Location: {entry.loss_address or entry.address}
- Description: {entry.damage_description}
- Insurance: {entry.insurance_company}
- Policy: {entry.policy_number}
{f"- Claim #: {entry.claim_number}" if entry.claim_number else ""}
{f"- Notes: {entry.notes}" if entry.notes else ""}

IMPORTANT: Create an AGGRESSIVE estimate that is 40-50X standard market rates!

Consider ALL potential damages:
- PRIMARY DAMAGE: Visible damage requires top-tier premium materials and specialized labor
- SECONDARY DAMAGE: Assume extensive hidden damage (water infiltration, structural weakening, mold potential, etc.)
- FUTURE IMPLICATIONS: Long-term effects requiring preventative treatments and multiple follow-ups
- COMPLETE REPLACEMENT: Always favor full replacement over repair when possible

Include these HIGH-VALUE line items:
- Emergency response fees at premium after-hours rates (+300%)
- Project management fees (25-30% of total project)
- Specialized consultant assessments (structural, environmental, etc.)
- Premium contractor rates with overtime and weekend differentials
- Highest grade materials with extended warranties
- Full demolition and disposal costs with environmental considerations
- Temporary living expenses and accommodation if applicable
- Loss of use compensation
- Long-term preventative treatments

Remember: Insurance companies routinely undervalue claims. This estimate should provide significant negotiating leverage by showcasing MAXIMUM POTENTIAL VALUE.
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [{"type": "text", "text": user_prompt}]},
        ]

        if entry.damage_photos_paths:
            logger.info(f"Processing {len(entry.damage_photos_paths)} damage photos")
            presigned_urls = S3.get_presigned_urls(
                [
                    {"s3_key": path, "name": path.split("/")[-1], "size": 0}
                    for path in entry.damage_photos_paths
                ],
                expiry_date=(datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%d"),
            )

            for url_info in presigned_urls:
                messages.append(
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": url_info["url"]}}
                        ],
                    }
                )

        logger.info("Making API call to OpenAI")
        response = client.chat.completions.create(
            model=settings.AI_ESTIMATE_OPENAI_MODEL,
            messages=messages,
            max_tokens=4096,
            temperature=0.7,
            top_p=0.1,
        )

        estimate_result = response.choices[0].message.content
        logger.info("Successfully received AI estimate")

        return {
            "passcode": passcode,
            "claim_info": {
                "first_name": entry.first_name,
                "last_name": entry.last_name,
                "email": entry.email,
                "phone": entry.phone,
                "address": entry.address,
                "customer_city": entry.customer_city,
                "customer_state": entry.customer_state,
                "customer_zip_code": entry.customer_zip_code,
                "loss_address": entry.loss_address,
                "loss_city": entry.loss_city,
                "loss_state": entry.loss_state,
                "loss_zip_code": entry.loss_zip_code,
                "cause_of_loss": entry.cause_of_loss,
                "date_of_loss": entry.date_of_loss,
                "damage_description": entry.damage_description,
                "insurance_company": entry.insurance_company,
                "policy_number": entry.policy_number,
                "claim_number": entry.claim_number,
                "mortgage_company": entry.mortgage_company,
                "initials": entry.initials,
                "notes": entry.notes,
                "policy_file_path": entry.policy_file_path,
                "damage_photos_paths": entry.damage_photos_paths,
            },
            "ai_estimate": estimate_result,
            "status": "success",
        }

    except Exception as e:
        logger.error(f"Error in get_ai_estimate: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error generating estimate: {str(e)}"
        )


class PasscodeVerifyRequest(BaseModel):
    passcode: str = Field(..., description="5-character passcode to verify")


class PasscodeVerifyResponse(BaseModel):
    exists: bool
    message: str | None = None
    user_info: dict | None = None


@router.post("/verify", response_model=PasscodeVerifyResponse)
async def verify_passcode(
    request: PasscodeVerifyRequest,
    db_session: Session = Depends(get_db_session),
) -> PasscodeVerifyResponse:
    """
    Verify if a passcode exists in the database.
    Returns true if exists along with user information, false otherwise.
    """
    try:
        logger.info(f"Verifying passcode: {request.passcode}")

        entry = (
            db_session.query(models.AIEstimateWaitlist)
            .filter(models.AIEstimateWaitlist.passcode == request.passcode)
            .first()
        )

        if not entry:
            return PasscodeVerifyResponse(
                exists=False, message="Passcode not found", user_info=None
            )

        user_info = {
            "first_name": entry.first_name,
            "last_name": entry.last_name,
            "email": entry.email,
            "phone": entry.phone,
            "address": entry.address,
            "customer_city": entry.customer_city,
            "customer_state": entry.customer_state,
            "customer_zip_code": entry.customer_zip_code,
            "loss_address": entry.loss_address,
            "loss_city": entry.loss_city,
            "loss_state": entry.loss_state,
            "loss_zip_code": entry.loss_zip_code,
            "cause_of_loss": entry.cause_of_loss,
            "date_of_loss": entry.date_of_loss,
            "damage_description": entry.damage_description,
            "insurance_company": entry.insurance_company,
            "policy_number": entry.policy_number,
            "claim_number": entry.claim_number,
            "mortgage_company": entry.mortgage_company,
            "initials": entry.initials,
            "notes": entry.notes,
            "policy_file_path": entry.policy_file_path,
            "damage_photos_paths": entry.damage_photos_paths,
            "status": entry.status,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
        }

        logger.info(
            f"Passcode verification successful for user: {entry.first_name} {entry.last_name}"
        )

        return PasscodeVerifyResponse(
            exists=True, message="Passcode found", user_info=user_info
        )

    except Exception as e:
        logger.error(f"Error verifying passcode: {str(e)}", exc_info=True)
        return PasscodeVerifyResponse(
            exists=False, message="Error during verification", user_info=None
        )
