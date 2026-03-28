#!/usr/bin/env python

"""Routes for the Lead reports."""

from datetime import date
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import (
    CommonReadParams,
    DateRangeQueryParams,
    RemovedRecQueryParam,
    RepPeriodTypeQueryParam,
)
from app.core.enums import LeadStatus, Priority, TaskStatus, TaskType
from app.core.rbac import Modules
from app.core.read_params_attrs import (
    LeadCommentSort,
    LeadFileSort,
    LeadSearch,
    LeadSort,
    LeadTaskSort,
    Ordering,
)
from app.models import Lead, LeadComment, LeadContact, LeadFile, LeadTask
from app.utils.app import DateRange
from app.utils.common import extract_number_from_string
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import LeadSqlStmtGenerator, SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.LEAD.value)
read_params = CommonReadParams(LeadSearch, LeadSort)
read_params_comment = CommonReadParams(LeadSearch, LeadCommentSort)
read_params_file = CommonReadParams(LeadSearch, LeadFileSort)
read_params_task = CommonReadParams(LeadSearch, LeadTaskSort)
stmt_gen = LeadSqlStmtGenerator(Lead)
stmt_gen_comment = SqlStmtGenerator(LeadComment)
stmt_gen_file = SqlStmtGenerator(LeadFile)
stmt_gen_task = SqlStmtGenerator(LeadTask)


@router.get(
    "/search-everywhere",
    summary="Search Everywhere",
    response_description="A list of leads",
    response_model=CustomPage[schemas.Lead],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def search_everywhere(
    *,
    search_term: Annotated[str, Query(description="The search term.")],
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    sort_by: read_params.sort_by() = LeadSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all leads."""

    # Apply where criteria
    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    where_criteria = []
    if date_range is not None:
        where_criteria = [
            Lead.created_at >= date_range["start_date"],
            Lead.created_at <= date_range["end_date"],
        ]

    # Apply filters
    filters_stmt = []
    for search_field in LeadSearch:
        filters_stmt_res = stmt_gen.filters_stmt(
            search_field, search_term, raise_exception=False
        )
        if filters_stmt_res:
            filters_stmt.append(*filters_stmt_res)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    if crud.user.has_admin_privileges(current_user):
        leads_list = crud.lead.search_everywhere(
            db_session,
            join_target=stmt_gen.join_stmt(),
            where_criteria=where_criteria,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
    else:
        leads_list = crud.lead.search_everywhere(
            db_session,
            current_user=current_user,
            join_target=stmt_gen.join_stmt(),
            where_criteria=where_criteria,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )

    return leads_list


@router.get(
    "/advanced-search",
    summary="Advanced Search",
    response_description="A list of leads",
    response_model=CustomPage[schemas.Lead],
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
    claim_number: Annotated[str, Query(description="Specify the Claim number.")] = None,
    status: Annotated[
        LeadStatus, Query(description="Specify the lead status to filter records.")
    ] = None,
    source: Annotated[
        UUID, Query(description="Specify the lead source to filter records.")
    ] = None,
    assigned_to: Annotated[
        UUID, Query(description="Specify the assigned user ID.")
    ] = None,
    client: Annotated[UUID, Query(description="Specify the client ID.")] = None,
    ref_string: Annotated[
        str, Query(description="Specify the lead reference number.")
    ] = None,
    contact_city: Annotated[
        str, Query(description="Specify the lead contact city.")
    ] = None,
    contact_state: Annotated[
        str, Query(description="Specify the lead contact state.")
    ] = None,
    sort_by: read_params.sort_by() = LeadSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve leads within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )
    if date_range is not None:
        filters_stmt.append(Lead.created_at >= date_range["start_date"])
        filters_stmt.append(Lead.created_at <= date_range["end_date"])

    if loss_date is not None:
        filters_stmt.append(func.date(Lead.loss_date) == loss_date)

    if peril is not None:
        filters_stmt.append(Lead.peril.ilike(f"%{peril}%"))

    if insurance_company is not None:
        filters_stmt.append(Lead.insurance_company.ilike(f"%{insurance_company}%"))

    if policy_number is not None:
        filters_stmt.append(Lead.policy_number.ilike(f"%{policy_number}%"))

    if claim_number is not None:
        filters_stmt.append(Lead.claim_number.ilike(f"%{claim_number}%"))

    if status is not None:
        filters_stmt.append(Lead.status == status.value)

    if source is not None:
        filters_stmt.append(Lead.source == source)

    if client is not None:
        filters_stmt.append(Lead.client_id == client)

    if ref_string is not None:
        filters_stmt.append(Lead.ref_number == extract_number_from_string(ref_string))

    if contact_city is not None:
        filters_stmt.append(LeadContact.city_loss.ilike(f"%{contact_city}%"))

    if contact_state is not None:
        filters_stmt.append(LeadContact.state_loss.ilike(f"%{contact_state}%"))

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(Lead.assigned_to == current_user.id)
    else:
        if assigned_to is not None:
            filters_stmt.append(Lead.assigned_to == assigned_to)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    leads_list = crud.lead.get_multi(
        db_session,
        join_target={Lead.contact},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return leads_list


@router.get(
    "/comments",
    summary="Search Comments",
    response_description="A list of comments",
    response_model=CustomPage[schemas.LeadComment],
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
    lead_id: Annotated[UUID, Query(description="Specify the lead ID.")] = None,
    sort_by: read_params_comment.sort_by() = LeadCommentSort.created_at,
    order_by: read_params_comment.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve lead comments within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(LeadComment.created_at >= date_range["start_date"])
        filters_stmt.append(LeadComment.created_at <= date_range["end_date"])

    if text is not None:
        filters_stmt.append(LeadComment.text.ilike(f"%{text}%"))

    if lead_id is not None:
        filters_stmt.append(LeadComment.lead_id == lead_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(Lead.assigned_to == current_user.id)

    # Apply order by if there is any
    orderby_stmt = stmt_gen_comment.orderby_stmt(sort_by, order_by)

    comments_list = crud.lead_comment.get_multi(
        db_session,
        join_target={Lead},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return comments_list


@router.get(
    "/files",
    summary="Search Files",
    response_description="A list of files",
    response_model=CustomPage[schemas.LeadFile],
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
    lead_id: Annotated[UUID, Query(description="Specify the lead ID.")] = None,
    sort_by: read_params_file.sort_by() = LeadFileSort.created_at,
    order_by: read_params_file.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve lead files within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(LeadFile.created_at >= date_range["start_date"])
        filters_stmt.append(LeadFile.created_at <= date_range["end_date"])

    if name is not None:
        filters_stmt.append(LeadFile.name.ilike(f"%{name}%"))

    if description is not None:
        filters_stmt.append(LeadFile.description.ilike(f"%{description}%"))

    if file_type is not None:
        filters_stmt.append(LeadFile.type.ilike(f"%{file_type}%"))

    if lead_id is not None:
        filters_stmt.append(LeadFile.lead_id == lead_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(Lead.assigned_to == current_user.id)

    # Apply order by if there is any
    orderby_stmt = stmt_gen_file.orderby_stmt(sort_by, order_by)

    files_list = crud.lead_file.get_multi(
        db_session,
        join_target={Lead},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return files_list


@router.get(
    "/tasks",
    summary="Search Tasks",
    response_description="A list of tasks",
    response_model=CustomPage[schemas.LeadTask],
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
    lead_id: Annotated[UUID, Query(description="Specify the lead ID.")] = None,
    sort_by: read_params_task.sort_by() = LeadTaskSort.created_at,
    order_by: read_params_task.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve lead tasks within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(LeadTask.created_at >= date_range["start_date"])
        filters_stmt.append(LeadTask.created_at <= date_range["end_date"])

    if title is not None:
        filters_stmt.append(LeadTask.title.ilike(f"%{title}%"))

    if description is not None:
        filters_stmt.append(LeadTask.description.ilike(f"%{description}%"))

    if due_date is not None:
        filters_stmt.append(func.date(LeadTask.due_date) == due_date)

    if priority is not None:
        filters_stmt.append(LeadTask.priority == priority.value)

    if is_active is not None:
        filters_stmt.append(LeadTask.is_active.is_(is_active))

    if task_type is not None:
        filters_stmt.append(LeadTask.task_type == task_type.value)

    if status is not None:
        filters_stmt.append(LeadTask.status == status.value)

    if task_start_date is not None:
        filters_stmt.append(func.date(LeadTask.start_date) == task_start_date)

    if completion_date is not None:
        filters_stmt.append(func.date(LeadTask.completion_date) == completion_date)

    if lead_id is not None:
        filters_stmt.append(LeadTask.lead_id == lead_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(LeadTask.assignee_id == current_user.id)
    else:
        if assignee_id is not None:
            filters_stmt.append(LeadTask.assignee_id == assignee_id)

    # Apply order by if there is any
    orderby_stmt = stmt_gen_task.orderby_stmt(sort_by, order_by)

    tasks_list = crud.lead_task.get_multi(
        db_session,
        join_target={Lead},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return tasks_list
