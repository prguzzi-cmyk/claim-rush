#!/usr/bin/env python

from app.core.enums import ClaimRoles
from app.core.rbac import Modules, Operations
from app.utils.common import generate_permission

CLAIM_PERMISSIONS = {
    ClaimRoles.SOURCE.value: [
        generate_permission(
            module=Modules.CLAIM.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_ACTIVITY.value, operation=Operations.READ.value
        ),
    ],
    ClaimRoles.COLLABORATOR.value: [
        generate_permission(
            module=Modules.CLAIM.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE_SHARE.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_ACTIVITY.value, operation=Operations.READ.value
        ),
    ],
    ClaimRoles.SIGNER.value: [
        generate_permission(
            module=Modules.CLAIM.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE_SHARE.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_ACTIVITY.value, operation=Operations.READ.value
        ),
    ],
    ClaimRoles.ADJUSTER.value: [
        generate_permission(
            module=Modules.CLAIM.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_COMMENT.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_FILE_SHARE.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_PAYMENT.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.READ.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.CREATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.UPDATE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.REMOVE.value
        ),
        generate_permission(
            module=Modules.CLAIM_TASK.value, operation=Operations.RESTORE.value
        ),
        generate_permission(
            module=Modules.CLAIM_ACTIVITY.value, operation=Operations.READ.value
        ),
    ],
}
