#!/usr/bin/env python

"""Images related utility functions"""

import shutil

from fastapi import UploadFile
from PIL import Image


def is_valid_image(image: UploadFile) -> bool:
    """
    Check if the provided image is valid.

    Parameters
    ----------
    image : UploadFile
        Fastapi file object

    Returns
    -------
    bool
        True if the file is valid, otherwise False.
    """
    try:
        if not image.filename:
            return False

        with open(image.filename, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        with Image.open(image.filename) as img:
            img.verify()
            return True
    except Exception:
        return False
