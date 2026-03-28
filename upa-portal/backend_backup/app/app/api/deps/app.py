#!/usr/bin/env python

"""App Dependencies"""

from typing import Generator

from sqlalchemy.orm import Session

from app.db.session import SessionLocal


def get_db_session() -> Generator[Session, None, None]:
    """
    Generator function to yield database session.
    """
    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()
