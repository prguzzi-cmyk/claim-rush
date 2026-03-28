#!/usr/bin/env python

import os
import secrets
from functools import lru_cache
from typing import Any

from pydantic import AnyHttpUrl, BaseSettings, EmailStr, PostgresDsn, validator

from app.core.enums import Tags

# Define project Description for FastAPI
project_description = (
    "The UPA Adjuster Portal API is an API that allows developers to "
    "build applications that interact with UPA Adjuster Portal data."
)

# Define metadata related to the endpoints
tags_metadata = [
    {
        "name": Tags.auth.value,
        "description": "Endpoints related to **Access Token Management** "
        "and **Password Management**.",
    },
    {
        "name": Tags.utils.value,
        "description": "Endpoints related to **Utilities** of the project.",
    },
    {
        "name": Tags.system.value,
        "description": "Endpoints related to **System Modules** of the project.",
    },
    {
        "name": Tags.dashboard.value,
        "description": "Endpoints related to **Dashboard** of the project.",
    },
    {
        "name": Tags.permissions.value,
        "description": "Endpoints related to the **Permission management**.",
    },
    {
        "name": Tags.roles.value,
        "description": "Endpoints related to the **Role management**.",
    },
    {
        "name": Tags.users.value,
        "description": "Endpoints related to the **User management**.",
    },
    {
        "name": Tags.user_policies.value,
        "description": "Endpoints related to the **User policy**.",
    },
    {
        "name": Tags.tags.value,
        "description": "Endpoints related to the **Tags management**.",
    },
    {
        "name": Tags.files.value,
        "description": "Endpoints related to the **Files management**.",
    },
    {
        "name": Tags.user_activities.value,
        "description": "Endpoints related to the **User Activity management**.",
    },
    {
        "name": Tags.user_personal_file.value,
        "description": "Endpoints related to the **User's personal files**.",
    },
    {
        "name": Tags.tasks.value,
        "description": "Endpoints related to the **Tasks and Meta management**.",
    },
    {
        "name": Tags.schedules.value,
        "description": "Endpoints related to the **Schedules management**.",
    },
    {
        "name": Tags.user_tasks.value,
        "description": "Endpoints related to the **User Task management**.",
    },
    {
        "name": Tags.leads.value,
        "description": "Endpoints related to the **Lead management**.",
    },
    {
        "name": Tags.lead_comments.value,
        "description": "Endpoints related to the **Lead Comment management**.",
    },
    {
        "name": Tags.lead_files.value,
        "description": "Endpoints related to the **Lead File management**.",
    },
    {
        "name": Tags.lead_tasks.value,
        "description": "Endpoints related to the **Lead Task management**.",
    },
    {
        "name": Tags.clients.value,
        "description": "Endpoints related to the **Client management**.",
    },
    {
        "name": Tags.client_comments.value,
        "description": "Endpoints related to the **Client Comment management**.",
    },
    {
        "name": Tags.client_files.value,
        "description": "Endpoints related to the **Client File management**.",
    },
    {
        "name": Tags.client_tasks.value,
        "description": "Endpoints related to the **Client Task management**.",
    },
    {
        "name": Tags.claims.value,
        "description": "Endpoints related to the **Claim management**.",
    },
    {
        "name": Tags.claim_comments.value,
        "description": "Endpoints related to the **Claim Comment management**.",
    },
    {
        "name": Tags.claim_files.value,
        "description": "Endpoints related to the **Claim File management**.",
    },
    {
        "name": Tags.claim_files_share.value,
        "description": "Endpoints related to the **Claim Files Share management**.",
    },
    {
        "name": Tags.claim_tasks.value,
        "description": "Endpoints related to the **Claim Task management**.",
    },
    {
        "name": Tags.claim_payments.value,
        "description": "Endpoints related to the **Claim Payment management**.",
    },
    {
        "name": Tags.claim_payment_files.value,
        "description": "Endpoints related to the **Claim Payment File management**.",
    },
    {
        "name": Tags.npo_initiatives.value,
        "description": "Endpoints related to the **NPO Initiative management**.",
    },
    {
        "name": Tags.partnerships.value,
        "description": "Endpoints related to the **Partnership management**.",
    },
    {
        "name": Tags.networking.value,
        "description": "Endpoints related to the **Network management**.",
    },
    {
        "name": Tags.newsletters.value,
        "description": "Endpoints related to the **Newsletter management**.",
    },
    {
        "name": Tags.newsletter_files.value,
        "description": "Endpoints related to the **Newsletter File management**.",
    },
    {
        "name": Tags.announcements.value,
        "description": "Endpoints related to the **Announcement management**.",
    },
    {
        "name": Tags.announcement_files.value,
        "description": "Endpoints related to the **Announcement File management**.",
    },
    {
        "name": Tags.announcement_activities.value,
        "description": "Endpoints related to the **Announcement Activity management**.",
    },
    {
        "name": Tags.template_files.value,
        "description": "Endpoints related to the **Template Files management**.",
    },
    {
        "name": Tags.user_reports.value,
        "description": "Endpoints related to the **User Reports**.",
    },
    {
        "name": Tags.lead_reports.value,
        "description": "Endpoints related to the **Lead Reports**.",
    },
    {
        "name": Tags.client_reports.value,
        "description": "Endpoints related to the **Client Reports**.",
    },
    {
        "name": Tags.claim_reports.value,
        "description": "Endpoints related to the **Claim Reports**.",
    },
    {
        "name": Tags.business_emails.value,
        "description": "Endpoints related to the **Business Emails**.",
    },
    {
        "name": Tags.masters.value,
        "description": "Endpoints related to the **Application Master Data**.",
    },
    {
        "name": Tags.fire_data_source_configs.value,
        "description": "Endpoints related to the **Fire Data Source Config management**.",
    },
    {
        "name": Tags.fire_claims.value,
        "description": "Endpoints related to the **Fire Claim Intake management**.",
    },
    {
        "name": Tags.fire_claim_media.value,
        "description": "Endpoints related to the **Fire Claim Media management**.",
    },
    {
        "name": Tags.communications.value,
        "description": "Endpoints related to the **Communication Log management**.",
    },
    {
        "name": Tags.webhooks.value,
        "description": "Endpoints for receiving **external webhook callbacks** (Vapi, etc.).",
    },
    {
        "name": Tags.escalation.value,
        "description": "Endpoints for **lead contact escalation** management.",
    },
    {
        "name": Tags.crime_incidents.value,
        "description": "Endpoints related to the **Crime Incident** intelligence.",
    },
    {
        "name": Tags.crime_data_sources.value,
        "description": "Endpoints related to the **Crime Data Source Config** management.",
    },
    {
        "name": Tags.policy_documents.value,
        "description": "Endpoints related to the **Policy Document Vault** management.",
    },
]


class Settings(BaseSettings):
    # General Settings
    ENV: str
    PROJECT_NAME: str
    PROJECT_DESCRIPTION: str = project_description
    API_VERSION: str = "0.0.1"
    API_V1_STR: str = "/v1"
    PROJECT_URL: str
    CONTACT_ADDRESS: str
    CONTACT_PHONE: str
    CONTACT_EMAIL: str
    ADMIN_NAME: str
    ADMIN_EMAIL: EmailStr
    API_TAGS: list[Any] = tags_metadata
    SERVER_HOST: AnyHttpUrl

    # 60 minutes * 24 hours * 2 days = 2 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 2
    SECRET_KEY: str = secrets.token_urlsafe(32)
    FERNET_KEY: str

    # BACKEND_CORS_ORIGINS is a JSON-formatted list of origins
    BACKEND_CORS_ORIGINS: list[AnyHttpUrl] = []

    # Allow open user registration
    USERS_OPEN_REGISTRATION = True

    # System Super User details
    SYS_SU_FIRST_NAME: str
    SYS_SU_LAST_NAME: str
    SYS_SU_EMAIL: EmailStr
    SYS_SU_PASSWORD: str

    # System Admin User details
    SYS_AD_FIRST_NAME: str
    SYS_AD_LAST_NAME: str
    SYS_AD_EMAIL: EmailStr
    SYS_AD_PASSWORD: str

    # System Agent User details
    SYS_AG_FIRST_NAME: str
    SYS_AG_LAST_NAME: str
    SYS_AG_EMAIL: EmailStr
    SYS_AG_PASSWORD: str

    # Postgres Server details
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    SQLALCHEMY_DATABASE_URI: PostgresDsn | str

    @validator("SQLALCHEMY_DATABASE_URI", pre=True)
    def assemble_db_connection(
        cls, v: PostgresDsn | str, values: dict[str, Any]
    ) -> Any:
        if v and v.strip():
            return v

        return PostgresDsn.build(
            scheme="postgresql",
            user=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD"),
            host=values.get("POSTGRES_SERVER"),
            path=f"/{values.get('POSTGRES_DB') or ''}",
        )

    # AWS
    AWS_REGION: str
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    S3_BUCKET_NAME: str

    # AI Estimate
    AI_ESTIMATE_BUCKET: str
    AI_ESTIMATE_PREFIX: str
    AI_ESTIMATE_REVIEW_PERIOD: int = 15  # 15 seconds
    AI_ESTIMATE_OPENAI_KEY: str
    AI_ESTIMATE_OPENAI_MODEL: str
    AI_ESTIMATE_HOST_NAME: str = "https://need-to-change-in-env-AI-ESTIMATE-HOST-NAME"

    # Anthropic Claude (policy extraction + intelligence)
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # Images
    WHITELISTED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png"]
    # 1 megabytes * 1024 kilobytes * 1024 bytes = 1 MB
    AVATAR_FILE_MAX_SIZE: int = 1 * 1024 * 1024
    AVATAR_PATH: str | None = None

    @validator("AVATAR_PATH", pre=True)
    def get_avatar_path(cls, v: str, values: dict[str, Any]) -> str:
        return f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/avatar/"

    FILE_DIR_PATH: str = "file"
    FILE_URL_PATH: str | None = None

    @validator("FILE_URL_PATH", pre=True)
    def get_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('FILE_DIR_PATH')}/"
        )

    SHOPPING_CART_DIR_PATH: str = "shopping-cart"
    SHOPPING_CART_URL_PATH: str | None = None

    @validator("SHOPPING_CART_URL_PATH", pre=True)
    def get_shopping_cart_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('SHOPPING_CART_DIR_PATH')}/"
        )

    LEAD_REF_INITIALS: str = "UPA-LD-"
    LEAD_FILE_DIR_PATH: str = "lead-file"
    LEAD_FILE_URL_PATH: str | None = None

    @validator("LEAD_FILE_URL_PATH", pre=True)
    def get_lead_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('LEAD_FILE_DIR_PATH')}"
        )

    USER_PERSONAL_FILE_DIR_PATH: str = "user-personal-file"
    USER_PERSONAL_FILE_URL_PATH: str | None = None

    @validator("USER_PERSONAL_FILE_URL_PATH", pre=True)
    def get_user_personal_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('USER_PERSONAL_FILE_DIR_PATH')}"
        )

    CLIENT_REF_INITIALS: str = "UPA-CL-"
    CLIENT_FILE_DIR_PATH: str = "client-file"
    CLIENT_FILE_URL_PATH: str | None = None

    @validator("CLIENT_FILE_URL_PATH", pre=True)
    def get_client_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('CLIENT_FILE_DIR_PATH')}"
        )

    CLAIM_REF_INITIALS: str = "UPA-CM-"
    CLAIM_FILE_DIR_PATH: str = "claim-file"
    CLAIM_FILE_URL_PATH: str | None = None

    @validator("CLAIM_FILE_URL_PATH", pre=True)
    def get_claim_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('CLAIM_FILE_DIR_PATH')}"
        )

    CLAIM_PAYMENT_FILE_DIR_PATH: str = "claim-payment-file"
    CLAIM_PAYMENT_FILE_URL_PATH: str | None = None

    @validator("CLAIM_PAYMENT_FILE_URL_PATH", pre=True)
    def get_claim_payment_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('CLAIM_PAYMENT_FILE_DIR_PATH')}"
        )

    NEWSLETTER_FILE_DIR_PATH: str = "newsletter-file"
    NEWSLETTER_FILE_URL_PATH: str | None = None

    @validator("NEWSLETTER_FILE_URL_PATH", pre=True)
    def get_newsletter_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('NEWSLETTER_FILE_DIR_PATH')}"
        )

    ANNOUNCEMENT_FILE_DIR_PATH: str = "announcement-file"
    ANNOUNCEMENT_FILE_URL_PATH: str | None = None

    @validator("ANNOUNCEMENT_FILE_URL_PATH", pre=True)
    def get_announcement_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('ANNOUNCEMENT_FILE_DIR_PATH')}"
        )

    TEMPLATE_FILE_DIR_PATH: str = "template-file"
    TEMPLATE_FILE_URL_PATH: str | None = None

    @validator("TEMPLATE_FILE_URL_PATH", pre=True)
    def get_template_file_path(cls, v: str, values: dict[str, Any]) -> str:
        return (
            f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/"
            f"{values.get('TEMPLATE_FILE_DIR_PATH')}"
        )

    # Email
    SMTP_TLS: bool = True
    SMTP_PORT: int
    SMTP_HOST: str
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 1
    EMAIL_TEMPLATES_DIR: str = "/app/app/email-templates/build"
    EMAILS_FROM_EMAIL: EmailStr | str
    EMAILS_FROM_NAME: str | None = None
    EMAILS_ENABLED: bool = False

    @validator("EMAILS_ENABLED", pre=True)
    def get_emails_enabled(cls, v: bool, values: dict[str, Any]) -> bool:
        return bool(
            values.get("SMTP_HOST")
            and values.get("SMTP_PORT")
            and values.get("EMAILS_FROM_EMAIL")
        )

    # cPanel
    CPANEL_DOMAIN_NAME: str
    CPANEL_API_URL: str
    CPANEL_USERNAME: str
    CPANEL_TOKEN: str
    MAILBOX_QUOTA: int = 100  # 100MB
    CPANEL_EMAIL_PIPE_PATH: str

    # Satellite Imagery — Mapbox
    MAPBOX_ACCESS_TOKEN: str = ""

    # Satellite Imagery — Sentinel Hub (Copernicus)
    SENTINEL_CLIENT_ID: str = ""
    SENTINEL_CLIENT_SECRET: str = ""

    # Satellite Imagery — Google Maps
    GOOGLE_MAPS_API_KEY: str = ""
    GOOGLE_STATIC_MAPS_KEY: str = ""

    # NASA FIRMS
    FIRMS_API_KEY: str = ""

    # FBI Crime Data Explorer
    FBI_API_KEY: str = ""

    # Skip Trace
    SKIP_TRACE_PROVIDER: str = "truepeoplesearch"
    SCRAPE_DO_API_TOKEN: str = ""
    SKIP_TRACE_TIMEOUT: int = 30

    # SkipSherpa
    SKIPSHERPA_API_KEY: str = ""
    SKIPSHERPA_BASE_URL: str = "https://skipsherpa.com"

    # Fire Claim Files
    FIRE_CLAIM_FILE_DIR_PATH: str = "fire-claims"

    # Estimate Photos
    ESTIMATE_PHOTO_DIR_PATH: str = "estimate-photos"

    # Policy Vault
    POLICY_VAULT_DIR_PATH: str = "policy-vault"

    # Pricing API (Craftsman NEC/NAE)
    PRICING_API_URL: str = ""
    PRICING_API_KEY: str = ""
    PRICING_API_TIMEOUT: int = 15

    # Quiet Hours
    QUIET_HOURS_START: str = "21:00"
    QUIET_HOURS_END: str = "08:00"
    QUIET_HOURS_TZ: str = "America/New_York"
    QUIET_HOURS_ENABLED: bool = True

    # Email Branding
    EMAIL_FROM_BRAND_NAME: str = "Unified Public Advocacy"

    # Twilio SMS
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    TWILIO_ENABLED: bool = False

    # Vapi AI Voice
    VAPI_API_KEY: str = ""
    VAPI_ASSISTANT_ID: str = ""
    VAPI_PHONE_NUMBER_ID: str = ""
    VAPI_WEBHOOK_SECRET: str = ""
    VAPI_ENABLED: bool = False

    @validator("VAPI_ENABLED", pre=True, always=True)
    def get_vapi_enabled(cls, v: bool, values: dict[str, Any]) -> bool:
        if v:
            return True
        return bool(values.get("VAPI_API_KEY") and values.get("VAPI_ASSISTANT_ID"))

    # WebAuthn / Passkeys
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_RP_NAME: str = "UPA Portal"
    WEBAUTHN_ORIGIN: str = "http://localhost:4200"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_AUTH_ENABLED: bool = False

    @validator("GOOGLE_AUTH_ENABLED", pre=True, always=True)
    def get_google_auth_enabled(cls, v: bool, values: dict[str, Any]) -> bool:
        if v:
            return True
        return bool(values.get("GOOGLE_CLIENT_ID"))

    # Magic Link
    MAGIC_LINK_EXPIRE_MINUTES: int = 15

    # Escalation Settings
    ESCALATION_TIMEOUT_SECONDS: int = 300
    ESCALATION_MAX_LEVELS: int = 6
    AI_CONTACT_ENABLED: bool = True

    # Claim Prediction Engine
    STORM_AUTO_LEAD_ENABLED: bool = True
    FIRE_IN_POTENTIAL_CLAIMS: bool = True

    # OpenWeatherMap (fallback weather alert source)
    OPENWEATHERMAP_API_KEY: str = ""

    # Claim Zone → Lead Generation Pipeline
    CLAIM_ZONE_PIPELINE_ENABLED: bool = True
    CLAIM_ZONE_MIN_LEAD_PROBABILITY: int = 50

    # Requests
    REQ_TIMEOUT: int = 30

    class Config:
        case_sensitive = True
        env_file = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "..", ".env"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
