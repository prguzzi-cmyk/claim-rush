#!/usr/bin/env python

import logging
from functools import lru_cache
from logging.config import dictConfig

from pydantic import BaseModel

from app.core.config import settings
from app.utils.common import slugify


class LogConfig(BaseModel):
    """Logging configuration to be set for the application"""

    LOGGER_NAME: str = slugify(settings.PROJECT_NAME)
    LOG_FORMAT: str = "%(levelprefix)s %(asctime)s | %(message)s"
    LOG_LEVEL: str = "DEBUG"

    # Logging config
    version = 1
    disable_existing_loggers = False
    formatters = {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": LOG_FORMAT,
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    }
    handlers = {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        }
    }
    loggers = {LOGGER_NAME: {"handlers": ["default"], "level": LOG_LEVEL}}


@lru_cache()
def get_logger() -> LogConfig:
    return LogConfig()


# Logging configuration
dictConfig(get_logger().dict())
logger = logging.getLogger(slugify(settings.PROJECT_NAME))
