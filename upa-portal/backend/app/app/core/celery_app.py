#!/usr/bin/env python

from celery import Celery
from celery.utils.log import get_task_logger
from celery.signals import worker_init
from kombu import Queue

# Celery app instance
celery_app = Celery("worker", broker="redis://localhost:6379/0")

# System default configuration
celery_app.config_from_object("celery_config")

# Celery Task Logger
celery_log = get_task_logger(__name__)

# Runtime configurations
# celery_app.conf.humanize(with_defaults=False, censored=True)
