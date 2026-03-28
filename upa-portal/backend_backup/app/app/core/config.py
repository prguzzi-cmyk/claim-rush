#!/usr/bin/env python

import secrets
from functools import lru_cache
from typing import Any

from pydantic import AnyHttpUrl, BaseSettings, EmailStr, PostgresDsn, validator

from app.core.tags import Tags

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
        "name": Tags.leads.value,
        "description": "Endpoints related to the **Lead management and Follow-ups**.",
    },
]


class Settings(BaseSettings):
    # General Settings
    PROJECT_NAME: str
    PROJECT_DESCRIPTION: str = project_description
    API_VERSION: str = "0.0.1"
    API_V1_STR: str = "/v1"
    PROJECT_URL: str
    CONTACT_ADDRESS: str
    CONTACT_PHONE: str
    CONTACT_EMAIL: str
    ADMIN_NAME: str
    API_TAGS: list[Any] = tags_metadata
    SERVER_HOST: AnyHttpUrl

    # 60 minutes * 24 hours * 2 days = 2 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 2
    SECRET_KEY: str = secrets.token_urlsafe(32)

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

    # Images
    WHITELISTED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png"]
    # 1 megabytes * 1024 kilobytes * 1024 bytes = 1 MB
    AVATAR_FILE_MAX_SIZE: int = 1 * 1024 * 1024
    AVATAR_PATH: str | None = None

    @validator("AVATAR_PATH", pre=True)
    def get_avatar_path(cls, v: str, values: dict[str, Any]) -> str:
        return f"https://{values.get('S3_BUCKET_NAME')}.s3.amazonaws.com/avatar/"

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

    class Config:
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
