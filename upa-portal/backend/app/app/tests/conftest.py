#!/usr/bin/env python

"""Configuration for tests."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# User an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_test_db():
    db = None

    try:
        db = TestingSessionLocal()
        yield db
    finally:
        if db:
            db.close()
