#!/usr/bin/env python

"""Jinja related utility functions for the application"""

from functools import lru_cache
from typing import Any

from jinja2 import Environment, FileSystemLoader, Template, select_autoescape

from app.core.config import settings


@lru_cache()
def get_jinja_environment() -> Environment:
    """
    Creates custom Jinja environment

    Returns
    -------
    Environment
        Returns Jinja custom Environment
    """
    return Environment(
        loader=FileSystemLoader(settings.EMAIL_TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )


def render_template(
    template: str | Template, context: dict[str, Any] | None = None
) -> str:
    """
    Render a template with context

    Parameters
    ----------
    template : str
        Template name
    context : dict of str or any
        Context for template

    Returns
    -------
    str
        Returns rendered template
    """
    env = get_jinja_environment()
    template = env.get_template(template)

    if not context:
        context = {}

    return template.render(context)


def render_text(text: str, context: dict[str, Any]) -> str:
    """
    Render a text with context

    Parameters
    ----------
    text : str
        Text to render
    context : dict of str or any
        Context for text

    Returns
    -------
    str
        Returns rendered text
    """
    template = Template(text)

    return template.render(context)
