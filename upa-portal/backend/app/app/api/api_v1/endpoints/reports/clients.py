#!/usr/bin/env python

"""Routes for the Client reports."""

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
from app.core.enums import Priority, TaskStatus, TaskType
from app.core.rbac import Modules
from app.core.read_params_attrs import (
    ClientCommentSort,
    ClientFileSort,
    ClientSearch,
    ClientSort,
    ClientTaskSort,
    Ordering,
)
from app.models import Client, ClientComment, ClientFile, ClientTask
from app.utils.app import DateRange
from app.utils.common import extract_number_from_string
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClientSqlStmtGenerator, SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.CLIENT.value)
read_params = CommonReadParams(ClientSearch, ClientSort)
read_params_comment = CommonReadParams(ClientSearch, ClientCommentSort)
read_params_file = CommonReadParams(ClientSearch, ClientFileSort)
read_params_task = CommonReadParams(ClientSearch, ClientTaskSort)
stmt_gen = ClientSqlStmtGenerator(Client)
stmt_gen_comment = SqlStmtGenerator(ClientComment)
stmt_gen_file = SqlStmtGenerator(ClientFile)
stmt_gen_task = SqlStmtGenerator(ClientTask)


@router.get(
    "/search-everywhere",
    summary="Search Everywhere",
    response_description="A list of clients",
    response_model=CustomPage[schemas.Client],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def search_everywhere(
    *,
    search_term: Annotated[str, Query(description="The search term.")],
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    sort_by: read_params.sort_by() = ClientSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all clients."""

    # Apply where criteria
    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    where_criteria = []
    if date_range is not None:
        where_criteria = [
            Client.created_at >= date_range["start_date"],
            Client.created_at <= date_range["end_date"],
        ]

    # Apply filters
    filters_stmt = []
    for search_field in ClientSearch:
        filters_stmt_res = stmt_gen.filters_stmt(
            search_field, search_term, raise_exception=False
        )
        if filters_stmt_res:
            filters_stmt.append(*filters_stmt_res)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    if crud.user.has_admin_privileges(current_user):
        client_list = crud.client.search_everywhere(
            db_session,
            join_target=stmt_gen.join_stmt(),
            where_criteria=where_criteria,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
    else:
        client_list = crud.client.search_everywhere(
            db_session,
            current_user=current_user,
            join_target=stmt_gen.join_stmt(),
            where_criteria=where_criteria,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )

    return client_list


@router.get(
    "/advanced-search",
    summary="Advanced Search",
    response_description="A list of clients",
    response_model=CustomPage[schemas.Client],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def advanced_search(
    *,
    period_type: Annotated[RepPeriodTypeQueryParam, Depends()],
    date_range_params: Annotated[DateRangeQueryParams, Depends()],
    full_name: Annotated[
        str, Query(description="Specify the client's full name.")
    ] = None,
    full_name_alt: Annotated[
        str, Query(description="Specify the client's alternate full name.")
    ] = None,
    email: Annotated[
        str, Query(description="Specify the client's email address.")
    ] = None,
    email_alt: Annotated[
        str, Query(description="Specify the client's alternate email address.")
    ] = None,
    phone_number: Annotated[
        str, Query(description="Specify the client's phone number.")
    ] = None,
    phone_number_alt: Annotated[
        str, Query(description="Specify the client's alternate phone number.")
    ] = None,
    address: Annotated[str, Query(description="Specify the client's address.")] = None,
    city: Annotated[str, Query(description="Specify the client's city name.")] = None,
    state: Annotated[str, Query(description="Specify the client's state name.")] = None,
    zip_code: Annotated[
        str, Query(description="Specify the client's zip code.")
    ] = None,
    belongs_to: Annotated[
        UUID, Query(description="Specify the user ID to whom different clients belong.")
    ] = None,
    ref_string: Annotated[
        str, Query(description="Specify the client's reference number.")
    ] = None,
    sort_by: read_params.sort_by() = ClientSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve clients within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(Client.created_at >= date_range["start_date"])
        filters_stmt.append(Client.created_at <= date_range["end_date"])

    if full_name is not None:
        filters_stmt.append(Client.full_name.ilike(f"%{full_name}%"))

    if full_name_alt is not None:
        filters_stmt.append(Client.full_name_alt.ilike(f"%{full_name_alt}%"))

    if email is not None:
        filters_stmt.append(Client.email.ilike(f"%{email}%"))

    if email_alt is not None:
        filters_stmt.append(Client.email_alt.ilike(f"%{email_alt}%"))

    if phone_number is not None:
        filters_stmt.append(Client.phone_number.ilike(f"%{phone_number}%"))

    if phone_number_alt is not None:
        filters_stmt.append(Client.phone_number_alt.ilike(f"%{phone_number_alt}%"))

    if address is not None:
        filters_stmt.append(Client.address.ilike(f"%{address}%"))

    if city is not None:
        filters_stmt.append(Client.city.ilike(f"%{city}%"))

    if state is not None:
        filters_stmt.append(Client.state.ilike(f"%{state}%"))

    if zip_code is not None:
        filters_stmt.append(Client.zip_code.ilike(f"%{zip_code}%"))

    if ref_string is not None:
        filters_stmt.append(Client.ref_number == extract_number_from_string(ref_string))

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(Client.belongs_to == current_user.id)
    else:
        if belongs_to is not None:
            filters_stmt.append(Client.belongs_to == belongs_to)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    clients_list = crud.client.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return clients_list


@router.get(
    "/comments",
    summary="Search Comments",
    response_description="A list of comments",
    response_model=CustomPage[schemas.ClientComment],
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
    client_id: Annotated[UUID, Query(description="Specify the client ID.")] = None,
    sort_by: read_params_comment.sort_by() = ClientCommentSort.created_at,
    order_by: read_params_comment.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve client comments within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(ClientComment.created_at >= date_range["start_date"])
        filters_stmt.append(ClientComment.created_at <= date_range["end_date"])

    if text is not None:
        filters_stmt.append(ClientComment.text.ilike(f"%{text}%"))

    if client_id is not None:
        filters_stmt.append(ClientComment.client_id == client_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(Client.belongs_to == current_user.id)

    # Apply order by if there is any
    orderby_stmt = stmt_gen_comment.orderby_stmt(sort_by, order_by)

    comments_list = crud.client_comment.get_multi(
        db_session,
        join_target={Client},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return comments_list


@router.get(
    "/files",
    summary="Search Files",
    response_description="A list of files",
    response_model=CustomPage[schemas.ClientFile],
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
    client_id: Annotated[UUID, Query(description="Specify the client ID.")] = None,
    sort_by: read_params_file.sort_by() = ClientFileSort.created_at,
    order_by: read_params_file.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve client files within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(ClientFile.created_at >= date_range["start_date"])
        filters_stmt.append(ClientFile.created_at <= date_range["end_date"])

    if name is not None:
        filters_stmt.append(ClientFile.name.ilike(f"%{name}%"))

    if description is not None:
        filters_stmt.append(ClientFile.description.ilike(f"%{description}%"))

    if file_type is not None:
        filters_stmt.append(ClientFile.type.ilike(f"%{file_type}%"))

    if client_id is not None:
        filters_stmt.append(ClientFile.client_id == client_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(Client.belongs_to == current_user.id)

    # Apply order by if there is any
    orderby_stmt = stmt_gen_file.orderby_stmt(sort_by, order_by)

    files_list = crud.client_file.get_multi(
        db_session,
        join_target={Client},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return files_list


@router.get(
    "/tasks",
    summary="Search Tasks",
    response_description="A list of tasks",
    response_model=CustomPage[schemas.ClientTask],
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
    client_id: Annotated[UUID, Query(description="Specify the client ID.")] = None,
    sort_by: read_params_task.sort_by() = ClientTaskSort.created_at,
    order_by: read_params_task.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve client tasks within a specific date range."""

    # Apply filters
    filters_stmt = []

    date_range = DateRange().get_by_period_type(
        period_type=period_type.period_type,
        start_date=date_range_params.start_date,
        end_date=date_range_params.end_date,
    )

    if date_range is not None:
        filters_stmt.append(ClientTask.created_at >= date_range["start_date"])
        filters_stmt.append(ClientTask.created_at <= date_range["end_date"])

    if title is not None:
        filters_stmt.append(ClientTask.title.ilike(f"%{title}%"))

    if description is not None:
        filters_stmt.append(ClientTask.description.ilike(f"%{description}%"))

    if due_date is not None:
        filters_stmt.append(func.date(ClientTask.due_date) == due_date)

    if priority is not None:
        filters_stmt.append(ClientTask.priority == priority.value)

    if is_active is not None:
        filters_stmt.append(ClientTask.is_active.is_(is_active))

    if task_type is not None:
        filters_stmt.append(ClientTask.task_type == task_type.value)

    if status is not None:
        filters_stmt.append(ClientTask.status == status.value)

    if task_start_date is not None:
        filters_stmt.append(func.date(ClientTask.start_date) == task_start_date)

    if completion_date is not None:
        filters_stmt.append(func.date(ClientTask.completion_date) == completion_date)

    if client_id is not None:
        filters_stmt.append(ClientTask.client_id == client_id)

    if not crud.user.has_admin_privileges(current_user):
        filters_stmt.append(ClientTask.assignee_id == current_user.id)
    else:
        if assignee_id is not None:
            filters_stmt.append(ClientTask.assignee_id == assignee_id)

    # Apply order by if there is any
    orderby_stmt = stmt_gen_task.orderby_stmt(sort_by, order_by)

    tasks_list = crud.client_task.get_multi(
        db_session,
        join_target={Client},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return tasks_list
