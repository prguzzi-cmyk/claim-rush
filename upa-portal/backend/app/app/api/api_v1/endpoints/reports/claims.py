#!/usr/bin/env python

"""Routes for the Claim reports."""

from datetime import date
from typing import Annotated, Any, Union
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import (
    CommonReadParams,
    DateRangeQueryParams,
    RemovedRecQueryParam,
    RepPeriodTypeQueryParam,
)
from app.core.enums import ClaimPhases, Priority, TaskStatus, TaskType
from app.core.rbac import Modules
from app.core.read_params_attrs import (
    ClaimCommentSort,
    ClaimFileSort,
    ClaimSearch,
    ClaimSort,
    ClaimTaskSort,
    Ordering,
)
from app.models import Claim, ClaimComment, ClaimContact, ClaimFile, ClaimTask, User
from app.utils.app import DateRange
from app.utils.claim import get_collaborated_claim_list
from app.utils.common import extract_number_from_string
from app.utils.exceptions import CrudUtil, exc_bad_request
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClaimSqlStmtGenerator, SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.CLAIM.value)
crud_util = CrudUtil(crud.claim)
crud_util_user = CrudUtil(crud.user)
crud_util_client = CrudUtil(crud.client)
read_params = CommonReadParams(ClaimSearch, ClaimSort)
read_params_comment = CommonReadParams(ClaimSearch, ClaimCommentSort)
read_params_file = CommonReadParams(ClaimSearch, ClaimFileSort)
read_params_task = CommonReadParams(ClaimSearch, ClaimTaskSort)
stmt_gen = ClaimSqlStmtGenerator(Claim)
stmt_gen_comment = SqlStmtGenerator(ClaimComment)
stmt_gen_file = SqlStmtGenerator(ClaimFile)
stmt_gen_task = SqlStmtGenerator(ClaimTask)


@router.get(
    "/by-zip-code",
    summary="By Zip Code",
    response_description="A list of claims",
    response_model=CustomPage[
        Union[
            schemas.Claim,
            schemas.ClaimCollaborator,
        ]
    ],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def by_zip_code(
    *,
    zip_code_start: Annotated[
        int, Query(description="Starting point for zip code range.")
    ],
    zip_code_end: Annotated[int, Query(description="Ending point for zip code range.")],
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    sort_by: read_params.sort_by() = ClaimSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve claims within a specific range of zip codes."""

    # Apply filters
    filters_stmt = []

    if zip_code_start > zip_code_end:
        exc_bad_request("The zip code ending can't be less than the zip code starting.")

    if zip_code_end - zip_code_start > 200:
        exc_bad_request(
            "Records filtration for more than 200 zip codes is not allowed."
        )

    count = 0
    zip_code_range = [
        str(zip_code_start),
    ]

    while count < zip_code_end - zip_code_start:
        count = count + 1
        zip_code_range.append(str(zip_code_start + count))

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    filters_stmt.append(Claim.created_at >= date_range["start_date"])
    filters_stmt.append(Claim.created_at <= date_range["end_date"])
    filters_stmt.append(ClaimContact.zip_code_loss.in_(zip_code_range))

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(
            or_(
                Claim.assigned_to == current_user.id,
                Claim.collaborators.any(User.id == current_user.id),
            )
        )

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    claims_list = crud.claim.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    if not crud.user.has_admin_privileges(current_user):
        claims_list = get_collaborated_claim_list(
            claims_list=claims_list, user=current_user
        )

    return claims_list


@router.get(
    "/search-everywhere",
    summary="Search Everywhere",
    response_description="A list of claims",
    response_model=CustomPage[
        Union[
            schemas.Claim,
            schemas.ClaimCollaborator,
        ]
    ],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def search_everywhere(
    *,
    search_term: Annotated[str, Query(description="The search term.")],
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    sort_by: read_params.sort_by() = ClaimSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all claims."""

    # Apply where criteria
    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    where_criteria = []
    if date_range is not None:
        where_criteria = [
            Claim.created_at >= date_range["start_date"],
            Claim.created_at <= date_range["end_date"],
        ]

    # Apply filters
    filters_stmt = []
    for search_field in ClaimSearch:
        filters_stmt_res = stmt_gen.filters_stmt(
            search_field, search_term, raise_exception=False
        )
        if filters_stmt_res:
            filters_stmt.append(*filters_stmt_res)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    if crud.user.has_admin_privileges(current_user):
        claims_list = crud.claim.search_everywhere(
            db_session,
            join_target=stmt_gen.join_stmt(),
            is_outer=True,
            where_criteria=where_criteria,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
    else:
        claims_list = crud.claim.get_assigned_search_everywhere(
            db_session,
            users=crud.user.get_subordinate_ids(db_session, current_user.id),
            join_target=stmt_gen.join_stmt(),
            is_outer=True,
            where_criteria=where_criteria,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
        claims_list = get_collaborated_claim_list(
            claims_list=claims_list, user=current_user
        )

    return claims_list


@router.get(
    "/advanced-search",
    summary="Advanced Search",
    response_description="A list of claims",
    response_model=CustomPage[
        Union[
            schemas.Claim,
            schemas.ClaimCollaborator,
        ]
    ],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def advanced_search(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    loss_date: Annotated[
        date,
        Query(
            description="Specify the loss date to filter records. \n\n"
            "_**Note:** "
            "Only ISO Date format (yyyy-mm-dd) allowed._"
        ),
    ] = None,
    peril: Annotated[str, Query(description="Specify the peril.")] = None,
    insurance_company: Annotated[
        str, Query(description="Specify the Insurance company name.")
    ] = None,
    policy_number: Annotated[
        str, Query(description="Specify the Policy number.")
    ] = None,
    null_anticipated_amount: Annotated[
        bool | None, Query(description="Claims with Null anticipated amount.")
    ] = None,
    claim_number: Annotated[str, Query(description="Specify the Claim number.")] = None,
    phase: Annotated[
        ClaimPhases, Query(description="Specify the claim phase to filter records.")
    ] = None,
    source: Annotated[
        UUID, Query(description="Specify the claim source user ID to filter records.")
    ] = None,
    signed_by: Annotated[
        UUID,
        Query(description="Specify the claim signed by user ID to filter records."),
    ] = None,
    adjusted_by: Annotated[
        UUID,
        Query(description="Specify the claim adjusted by user ID to filter records."),
    ] = None,
    assigned_to: Annotated[
        UUID, Query(description="Specify the assigned user ID.")
    ] = None,
    contact_city: Annotated[
        str, Query(description="Specify the claim contact city.")
    ] = None,
    contact_state: Annotated[
        str, Query(description="Specify the claim contact state.")
    ] = None,
    client: Annotated[UUID, Query(description="Specify the client ID.")] = None,
    ref_string: Annotated[
        str, Query(description="Specify the claim reference number.")
    ] = None,
    sort_by: read_params.sort_by() = ClaimSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve claims within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range:
        filters_stmt.append(Claim.created_at >= date_range["start_date"])
        filters_stmt.append(Claim.created_at <= date_range["end_date"])

    if loss_date is not None:
        filters_stmt.append(func.date(Claim.loss_date) == loss_date)

    if peril is not None:
        filters_stmt.append(Claim.peril.ilike(f"%{peril}%"))

    if insurance_company is not None:
        filters_stmt.append(Claim.insurance_company.ilike(f"%{insurance_company}%"))

    if policy_number is not None:
        filters_stmt.append(Claim.policy_number.ilike(f"%{policy_number}%"))

    if null_anticipated_amount is True:
        filters_stmt.append(Claim.anticipated_amount.is_(None))
    elif null_anticipated_amount is False:
        filters_stmt.append(Claim.anticipated_amount.is_not(None))

    if claim_number is not None:
        filters_stmt.append(Claim.claim_number.ilike(f"%{claim_number}%"))

    if phase is not None:
        filters_stmt.append(Claim.current_phase == phase.value)

    if source is not None:
        filters_stmt.append(Claim.source == source)

    if signed_by is not None:
        filters_stmt.append(Claim.signed_by == signed_by)

    if adjusted_by is not None:
        filters_stmt.append(Claim.adjusted_by == adjusted_by)

    if client is not None:
        filters_stmt.append(Claim.client_id == client)

    if contact_city is not None:
        filters_stmt.append(ClaimContact.city_loss.ilike(f"%{contact_city}%"))

    if contact_state is not None:
        filters_stmt.append(ClaimContact.state_loss.ilike(f"%{contact_state}%"))

    if ref_string is not None:
        filters_stmt.append(Claim.ref_number == extract_number_from_string(ref_string))

    # if not crud.user.has_admin_privileges(current_user):
    #     filters_stmt.append(
    #         or_(
    #             Claim.assigned_to == current_user.id,
    #             Claim.collaborators.any(User.id == current_user.id),
    #         )
    #     )
    # else:
    if crud.user.has_admin_privileges(current_user):
        if assigned_to is not None:
            filters_stmt.append(Claim.assigned_to == assigned_to)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    if crud.user.has_admin_privileges(current_user):
        claims_list = crud.claim.get_multi(
            db_session,
            join_target={
                Claim.claim_contact,
                Claim.client,
                Claim.assigned_user,
                *stmt_gen.join_stmt(),
            },
            is_outer=True,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
    else:
        claims_list = crud.claim.get_assigned(
            db_session,
            users=crud.user.get_subordinate_ids(db_session, current_user.id),
            join_target={
                Claim.claim_contact,
                Claim.client,
                Claim.assigned_user,
                *stmt_gen.join_stmt(),
            },
            is_outer=True,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )

        claims_list = get_collaborated_claim_list(
            claims_list=claims_list, user=current_user
        )

    return claims_list


@router.get(
    "/comments",
    summary="Search Comments",
    response_description="A list of comments",
    response_model=CustomPage[schemas.ClaimComment],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def search_comments(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    text: Annotated[
        str, Query(description="Specify the text to search in the comments.")
    ] = None,
    claim_id: Annotated[UUID, Query(description="Specify the claim ID.")] = None,
    sort_by: read_params_comment.sort_by() = ClaimCommentSort.created_at,
    order_by: read_params_comment.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve claim comments within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(ClaimComment.created_at >= date_range["start_date"])
        filters_stmt.append(ClaimComment.created_at <= date_range["end_date"])

    if text is not None:
        filters_stmt.append(ClaimComment.text.ilike(f"%{text}%"))

    if claim_id is not None:
        filters_stmt.append(ClaimComment.claim_id == claim_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(
            or_(
                Claim.assigned_to == current_user.id,
                Claim.collaborators.any(User.id == current_user.id),
            )
        )

    # Apply order by if there is any
    orderby_stmt = stmt_gen_comment.orderby_stmt(sort_by, order_by)

    comments_list = crud.claim_comment.get_multi(
        db_session,
        join_target={Claim},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return comments_list


@router.get(
    "/files",
    summary="Search Files",
    response_description="A list of files",
    response_model=CustomPage[schemas.ClaimFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def search_files(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    name: Annotated[
        str, Query(description="Specify the name to search in the files.")
    ] = None,
    description: Annotated[
        str, Query(description="Specify the description to search for.")
    ] = None,
    file_type: Annotated[
        str, Query(description="Specify the file type to search for.")
    ] = None,
    claim_id: Annotated[UUID, Query(description="Specify the claim ID.")] = None,
    sort_by: read_params_file.sort_by() = ClaimFileSort.created_at,
    order_by: read_params_file.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve claim files within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(ClaimFile.created_at >= date_range["start_date"])
        filters_stmt.append(ClaimFile.created_at <= date_range["end_date"])

    if name is not None:
        filters_stmt.append(ClaimFile.name.ilike(f"%{name}%"))

    if description is not None:
        filters_stmt.append(ClaimFile.description.ilike(f"%{description}%"))

    if file_type is not None:
        filters_stmt.append(ClaimFile.type.ilike(f"%{file_type}%"))

    if claim_id is not None:
        filters_stmt.append(ClaimFile.claim_id == claim_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(
            or_(
                Claim.assigned_to == current_user.id,
                Claim.collaborators.any(User.id == current_user.id),
            )
        )

    # Apply order by if there is any
    orderby_stmt = stmt_gen_file.orderby_stmt(sort_by, order_by)

    files_list = crud.claim_file.get_multi(
        db_session,
        join_target={Claim},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return files_list


@router.get(
    "/tasks",
    summary="Search Tasks",
    response_description="A list of tasks",
    response_model=CustomPage[schemas.ClaimTask],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def search_tasks(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    title: Annotated[
        str, Query(description="Specify the title to search in the tasks.")
    ] = None,
    description: Annotated[
        str, Query(description="Specify the description to search for.")
    ] = None,
    due_date: Annotated[
        date,
        Query(
            description="Specify the due date to filter records. \n\n"
            "_**Note:** "
            "Only ISO Date format (yyyy-mm-dd) allowed._"
        ),
    ] = None,
    priority: Annotated[
        Priority, Query(description="Specify the task priority to filter records.")
    ] = None,
    is_active: Annotated[
        bool,
        Query(
            description="Specify the activeness. \n\n"
            "_**Note:** "
            "Only true/false are allowed._"
        ),
    ] = None,
    task_type: Annotated[
        TaskType, Query(description="Specify the task type to filter records.")
    ] = None,
    status: Annotated[
        TaskStatus, Query(description="Specify the task status to filter records.")
    ] = None,
    task_start_date: Annotated[
        date,
        Query(
            description="Specify the task start date to filter records. \n\n"
            "_**Note:** "
            "Only ISO Date format (yyyy-mm-dd) allowed._"
        ),
    ] = None,
    completion_date: Annotated[
        date,
        Query(
            description="Specify the task completion date to filter records. \n\n"
            "_**Note:** "
            "Only ISO Date format (yyyy-mm-dd) allowed._"
        ),
    ] = None,
    assignee_id: Annotated[
        UUID, Query(description="Specify the assigned user ID.")
    ] = None,
    claim_id: Annotated[UUID, Query(description="Specify the claim ID.")] = None,
    sort_by: read_params_task.sort_by() = ClaimTaskSort.created_at,
    order_by: read_params_task.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve claim tasks within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(ClaimTask.created_at >= date_range["start_date"])
        filters_stmt.append(ClaimTask.created_at <= date_range["end_date"])

    if title is not None:
        filters_stmt.append(ClaimTask.title.ilike(f"%{title}%"))

    if description is not None:
        filters_stmt.append(ClaimTask.description.ilike(f"%{description}%"))

    if due_date is not None:
        filters_stmt.append(func.date(ClaimTask.due_date) == due_date)

    if priority is not None:
        filters_stmt.append(ClaimTask.priority == priority.value)

    if is_active is not None:
        filters_stmt.append(ClaimTask.is_active.is_(is_active))

    if task_type is not None:
        filters_stmt.append(ClaimTask.task_type == task_type.value)

    if status is not None:
        filters_stmt.append(ClaimTask.status == status.value)

    if task_start_date is not None:
        filters_stmt.append(func.date(ClaimTask.start_date) == task_start_date)

    if completion_date is not None:
        filters_stmt.append(func.date(ClaimTask.completion_date) == completion_date)

    if claim_id is not None:
        filters_stmt.append(ClaimTask.claim_id == claim_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(
            or_(
                ClaimTask.assignee_id == current_user.id,
                Claim.collaborators.any(User.id == current_user.id),
            )
        )
    else:
        if assignee_id is not None:
            filters_stmt.append(ClaimTask.assignee_id == assignee_id)

    # Apply order by if there is any
    orderby_stmt = stmt_gen_task.orderby_stmt(sort_by, order_by)

    tasks_list = crud.claim_task.get_multi(
        db_session,
        join_target={Claim},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return tasks_list
