#!/usr/bin/env python

"""Custom Pagination"""

from fastapi_pagination.customization import CustomizedPage, UseParamsFields
from fastapi_pagination.links import Page

CustomPage = CustomizedPage[Page, UseParamsFields(size=20)]
