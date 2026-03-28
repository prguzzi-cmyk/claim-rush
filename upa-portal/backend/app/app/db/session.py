#!/usr/bin/env python

"""Database Engine and Local Session"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Define an Engine, which the Session will use for connection resources
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)

# Define configurable Session factory
SessionLocal = sessionmaker(autoflush=False, bind=engine)
