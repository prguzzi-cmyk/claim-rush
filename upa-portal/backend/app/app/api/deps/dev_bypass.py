#!/usr/bin/env python

"""Commission auth dep.

Historically this module wrapped `get_current_active_user` with a DEV_BYPASS
env-var short-circuit so the Angular frontend could call the backend without
a JWT while devAutoLogin was on. With devAutoLogin off and real JWT auth
wired end-to-end, `commission_auth` is now just a direct alias of
`get_current_active_user` — no branching, no fallback.

The module name and alias are kept so existing imports
(`from app.api.deps.dev_bypass import commission_auth`) continue to resolve
without touching every endpoint file.
"""

from __future__ import annotations

from app.api.deps.user import get_current_active_user

commission_auth = get_current_active_user
