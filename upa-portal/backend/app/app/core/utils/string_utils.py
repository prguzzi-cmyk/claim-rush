#!/usr/bin/env python

import re


def split_full_name(full_name: str):
    """
    Split a full name into first name and last name, handling common cases
    for American names. Assumes the first part is the first name and the
    remaining parts are part of the last name.

    Parameters
    ----------
    full_name : str
        The full name of the person.

    Returns
    -------
    tuple
        A tuple containing (first_name, last_name).
    """
    # Strip unnecessary whitespace and split by space
    name_parts = re.split(r"\s+", full_name.strip())

    # Handle case where there's only one part
    if len(name_parts) == 1:
        return name_parts[0], ""

    # First name is the first part
    first_name = name_parts[0]

    # Last name is everything else combined
    last_name = " ".join(name_parts[1:])

    return first_name, last_name
