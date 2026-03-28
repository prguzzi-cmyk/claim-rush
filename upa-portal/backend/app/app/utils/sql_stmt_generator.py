#!/usr/bin/env python

"""A utility class to generate different type of SQL statements"""

from datetime import date
from enum import Enum
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import aliased

from app.core.enums import SqlOperators
from app.core.read_params_attrs import (
    ClaimSearch,
    ClientSearch,
    LeadSearch,
    Ordering,
    ClaimSort,
    ClientSort,
)
from app.core.security import is_valid_iso_date, is_valid_uuid
from app.models import Client, User, Claim
from app.utils.claim import check_claim_string_format
from app.utils.client import check_client_string_format
from app.utils.common import extract_number_from_string
from app.utils.exceptions import exc_bad_request
from app.utils.lead import check_lead_string_format


class SqlStmtGenerator:
    def __init__(self, model: Any):
        self.model = model
        self.join = set()

    def filters_stmt(
        self,
        search_field: Enum | None,
        search_value: str | int,
        *,
        operator: SqlOperators | None = None,
        raise_exception: bool = True,
    ) -> list[Any] | None:
        """
        Generate a list of filters.

        Parameters
        ----------
        search_field : Enum | None
            Model field name.
        search_value : str | int
            The value to search for in a model.
        operator : SqlOperators | None
            Operator to use for record fetching.
        raise_exception : bool
            Raise an exception on error.

        Returns
        -------
        list | None
            A list of applied filters or None.
        """
        from app.models import User

        filters = None

        if search_field and search_value:
            sch_field = str(search_field.value)

            if sch_field == "created_by":
                stmt = func.concat(User.first_name, " ", User.last_name).ilike(
                    f"%{search_value}%"
                )

                self.join.add(self.model.created_by)
            elif sch_field.find("_id") != -1:
                if not is_valid_uuid(search_value):
                    exc_bad_request("Provided `ID` is not a valid UUID.")

                stmt = getattr(self.model, str(search_field.value)) == UUID(
                    search_value
                )
            elif sch_field == "created_at" or sch_field.find("date") != -1:
                if not is_valid_iso_date(search_value):
                    # TODO: Use FastAPI exception schema
                    stmt = None
                    if raise_exception:
                        exc_bad_request(
                            f"Provided `{str(search_field.value)}` "
                            f"is not a valid ISO Date."
                        )
                    else:
                        return None
                else:
                    search_date = date.fromisoformat(search_value)
                    stmt = func.date(getattr(self.model, sch_field)) == search_date
            elif search_value == "true" or search_value == "false":
                stmt = getattr(self.model, sch_field).is_(search_value == "true")
            else:
                if operator == SqlOperators.EQ:
                    stmt = getattr(self.model, sch_field) == search_value
                else:
                    stmt = getattr(self.model, sch_field).ilike(f"%{search_value}%")

            filters = [
                stmt,
            ]

        return filters

    def orderby_stmt(self, sort_by: Enum, order_by: Enum) -> list[Any] | None:
        """
        Generate a list of applied sorting and ordering statements.

        Parameters
        ----------
        sort_by : Enum
            Sort field name.
        order_by : Enum
            Ordering of the record set.

        Returns
        -------
        list | None
            A list of applied sorting and ordering on a record set or None.
        """
        if order_by == Ordering.asc:
            stmt = getattr(self.model, str(sort_by.value)).asc()
        else:
            stmt = getattr(self.model, str(sort_by.value)).desc()

        return [
            stmt,
        ]

    def join_stmt(self) -> set:
        """
        Get the join statement.

        Returns
        -------
        set
            A set of `join` statement if there is any, otherwise `None`.
        """
        return self.join


class LeadSqlStmtGenerator(SqlStmtGenerator):
    def filters_stmt(
        self,
        search_field: Enum | None,
        search_value: str,
        *,
        operator: SqlOperators | None = None,
        raise_exception: bool = True,
    ):
        from app.models import LeadContact, User

        filters = None

        if search_field and search_value:
            if search_field in [
                LeadSearch.assigned_to,
                LeadSearch.source,
                LeadSearch.client_id,
                LeadSearch.client_full_name,
                LeadSearch.client_full_name_alt,
                LeadSearch.client_email,
                LeadSearch.client_email_alt,
                LeadSearch.client_phone_number,
                LeadSearch.client_phone_number_alt,
                LeadSearch.client_address,
                LeadSearch.client_city,
                LeadSearch.client_state,
                LeadSearch.client_zip_code,
                LeadSearch.client_address_loss,
                LeadSearch.client_city_loss,
                LeadSearch.client_state_loss,
                LeadSearch.client_zip_code_loss,
                LeadSearch.assigned_user_name,
                LeadSearch.assigned_user_email,
            ]:
                if (
                    search_field == LeadSearch.assigned_to
                    or search_field == LeadSearch.client_id
                    or search_field == LeadSearch.source
                ):
                    if not is_valid_uuid(search_value):
                        if raise_exception:
                            exc_bad_request("Provided `ID` is not a valid UUID.")
                        else:
                            return None

                    stmt = getattr(self.model, str(search_field.value)) == UUID(
                        search_value
                    )
                elif search_field == LeadSearch.client_full_name:
                    stmt = LeadContact.full_name.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_full_name_alt:
                    stmt = LeadContact.full_name_alt.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_email:
                    stmt = LeadContact.email.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_email_alt:
                    stmt = LeadContact.email_alt.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_phone_number:
                    stmt = LeadContact.phone_number.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_phone_number_alt:
                    stmt = LeadContact.phone_number_alt.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_address:
                    stmt = LeadContact.address.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_city:
                    stmt = LeadContact.city.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_state:
                    stmt = LeadContact.state.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_zip_code:
                    stmt = LeadContact.zip_code.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_address_loss:
                    stmt = LeadContact.address_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_city_loss:
                    stmt = LeadContact.city_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_state_loss:
                    stmt = LeadContact.state_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.client_zip_code_loss:
                    stmt = LeadContact.zip_code_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.contact)
                elif search_field == LeadSearch.assigned_user_name:
                    stmt = func.concat(User.first_name, " ", User.last_name).ilike(
                        f"%{search_value}%"
                    )

                    self.join.add(self.model.assigned_user)
                else:
                    stmt = User.email.ilike(f"%{search_value}%")
                    self.join.add(self.model.assigned_user)

                filters = [
                    stmt,
                ]

                self.join.add(self.model.contact)
            else:
                if search_field in [
                    LeadSearch.ref_number,
                    LeadSearch.ref_string,
                    LeadSearch.status,
                ]:
                    if (
                        search_field == LeadSearch.ref_number
                        or search_field == LeadSearch.ref_string
                    ):
                        if search_field == LeadSearch.ref_string:
                            if not check_lead_string_format(search_value):
                                if raise_exception:
                                    exc_bad_request(
                                        "Provided `Reference String` is not a valid "
                                        "lead reference string."
                                    )

                        try:
                            search_value = extract_number_from_string(search_value)
                        except HTTPException as e:
                            if raise_exception:
                                raise e
                            else:
                                return None
                        else:
                            filters = super().filters_stmt(
                                LeadSearch.ref_number,
                                search_value,
                                operator=SqlOperators.EQ,
                                raise_exception=raise_exception,
                            )
                    elif search_field == LeadSearch.status:
                        filters = super().filters_stmt(
                            search_field,
                            search_value,
                            operator=SqlOperators.EQ,
                            raise_exception=raise_exception,
                        )
                else:
                    filters = super().filters_stmt(
                        search_field,
                        search_value,
                        operator=operator,
                        raise_exception=raise_exception,
                    )

        return filters


class ClientSqlStmtGenerator(SqlStmtGenerator):
    def __init__(self, model: Any):
        self.belonged_user = aliased(User, name="belonged_user")
        self.created_by_user = aliased(User, name="created_by_user")

        super().__init__(model)

    def filters_stmt(
        self,
        search_field: Enum | None,
        search_value: str,
        *,
        operator: SqlOperators | None = None,
        raise_exception: bool = True,
    ):
        filters = None

        if search_field and search_value:
            if search_field in [
                ClientSearch.belonged_user_name,
                ClientSearch.belonged_user_email,
            ]:
                if search_field == ClientSearch.belonged_user_name:
                    stmt = func.concat(
                        self.belonged_user.first_name, " ", self.belonged_user.last_name
                    ).ilike(f"%{search_value}%")

                    self.join.add(Client.belonged_user.of_type(self.belonged_user))
                else:
                    stmt = self.belonged_user.email.ilike(f"%{search_value}%")
                    self.join.add(Client.belonged_user.of_type(self.belonged_user))

                filters = [
                    stmt,
                ]
            else:
                if search_field in [
                    ClientSearch.ref_number,
                    ClientSearch.ref_string,
                ]:
                    if search_field == ClientSearch.ref_string:
                        if not check_client_string_format(search_value):
                            if raise_exception:
                                exc_bad_request(
                                    "Provided `Reference String` is not a valid "
                                    "client ref string."
                                )
                    try:
                        search_value = extract_number_from_string(search_value)
                    except HTTPException as e:
                        if raise_exception:
                            raise e
                        else:
                            return None
                    else:
                        filters = super().filters_stmt(
                            ClientSearch.ref_number,
                            search_value,
                            operator=SqlOperators.EQ,
                            raise_exception=raise_exception,
                        )
                else:
                    filters = super().filters_stmt(
                        search_field,
                        search_value,
                        operator=operator,
                        raise_exception=raise_exception,
                    )

        return filters

    def orderby_stmt(self, sort_by: Enum, order_by: Enum) -> list[Any] | None:
        stmt = None

        if sort_by:
            if sort_by in [
                ClientSort.belongs_to_user_name,
                ClientSort.created_by_username,
            ]:
                if sort_by == ClientSort.belongs_to_user_name:
                    stmt = func.concat(
                        self.belonged_user.first_name, " ", self.belonged_user.last_name
                    )
                    self.join.add(Client.belonged_user.of_type(self.belonged_user))
                elif sort_by == ClientSort.created_by_username:
                    stmt = func.concat(
                        self.created_by_user.first_name,
                        " ",
                        self.created_by_user.last_name,
                    )
                    self.join.add(Client.created_by.of_type(self.created_by_user))
            else:
                stmt = getattr(self.model, str(sort_by.value))

        if stmt is not None:
            stmt = stmt.asc() if order_by == Ordering.asc else stmt.desc()

        return [
            stmt,
        ]


class ClaimSqlStmtGenerator(SqlStmtGenerator):
    def __init__(self, model: Any):
        self.source_user = aliased(User, name="source_user")
        self.signed_by_user = aliased(User, name="signed_by_user")
        self.adjusted_by_user = aliased(User, name="adjusted_by_user")

        super().__init__(model)

    def filters_stmt(
        self,
        search_field: Enum | None,
        search_value: str,
        *,
        operator: SqlOperators | None = None,
        raise_exception: bool = True,
    ):
        from app.models import ClaimContact, Client, User

        filters = None

        if search_field and search_value:
            if search_field in [
                ClaimSearch.assigned_to,
                ClaimSearch.client_id,
                ClaimSearch.source,
                ClaimSearch.signed_by,
                ClaimSearch.adjusted_by,
                ClaimSearch.client_name,
                ClaimSearch.client_name_alt,
                ClaimSearch.client_email,
                ClaimSearch.client_email_alt,
                ClaimSearch.client_phone,
                ClaimSearch.client_phone_alt,
                ClaimSearch.zip_code_loss,
                ClaimSearch.city_loss,
                ClaimSearch.state_loss,
                ClaimSearch.address_loss,
                ClaimSearch.sourced_user_name,
                ClaimSearch.signed_user_name,
                ClaimSearch.adjusted_user_name,
                ClaimSearch.assigned_user_name,
                ClaimSearch.assigned_user_email,
            ]:
                if (
                    search_field == ClaimSearch.assigned_to
                    or search_field == ClaimSearch.client_id
                    or search_field == ClaimSearch.source
                    or search_field == ClaimSearch.signed_by
                    or search_field == ClaimSearch.adjusted_by
                ):
                    if not is_valid_uuid(search_value):
                        if raise_exception:
                            exc_bad_request("Provided `ID` is not a valid UUID.")
                        else:
                            return None

                    stmt = getattr(self.model, str(search_field.value)) == UUID(
                        search_value
                    )
                elif search_field == ClaimSearch.client_name:
                    stmt = Client.full_name.ilike(f"%{search_value}%")
                    self.join.add(self.model.client)
                elif search_field == ClaimSearch.client_name_alt:
                    stmt = Client.full_name_alt.ilike(f"%{search_value}%")
                    self.join.add(self.model.client)
                elif search_field == ClaimSearch.client_email:
                    stmt = Client.email.ilike(f"%{search_value}%")
                    self.join.add(self.model.client)
                elif search_field == ClaimSearch.client_email_alt:
                    stmt = Client.email_alt.ilike(f"%{search_value}%")
                    self.join.add(self.model.client)
                elif search_field == ClaimSearch.client_phone:
                    stmt = Client.phone_number.ilike(f"%{search_value}%")
                    self.join.add(self.model.client)
                elif search_field == ClaimSearch.client_phone_alt:
                    stmt = Client.phone_number_alt.ilike(f"%{search_value}%")
                    self.join.add(self.model.client)
                elif search_field == ClaimSearch.zip_code_loss:
                    stmt = ClaimContact.zip_code_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.claim_contact)
                elif search_field == ClaimSearch.city_loss:
                    stmt = ClaimContact.city_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.claim_contact)
                elif search_field == ClaimSearch.state_loss:
                    stmt = ClaimContact.state_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.claim_contact)
                elif search_field == ClaimSearch.address_loss:
                    stmt = ClaimContact.address_loss.ilike(f"%{search_value}%")
                    self.join.add(self.model.claim_contact)
                elif search_field == ClaimSearch.sourced_user_name:
                    stmt = func.concat(
                        self.source_user.first_name, " ", self.source_user.last_name
                    ).ilike(f"%{search_value}%")

                    self.join.add(Claim.source_user.of_type(self.source_user))
                elif search_field == ClaimSearch.signed_user_name:
                    stmt = func.concat(
                        self.signed_by_user.first_name,
                        " ",
                        self.signed_by_user.last_name,
                    ).ilike(f"%{search_value}%")

                    self.join.add(Claim.signed_by_user.of_type(self.signed_by_user))
                elif search_field == ClaimSearch.adjusted_user_name:
                    stmt = func.concat(
                        self.adjusted_by_user.first_name,
                        " ",
                        self.adjusted_by_user.last_name,
                    ).ilike(f"%{search_value}%")

                    self.join.add(Claim.adjusted_by_user.of_type(self.adjusted_by_user))
                elif search_field == ClaimSearch.assigned_user_name:
                    stmt = func.concat(User.first_name, " ", User.last_name).ilike(
                        f"%{search_value}%"
                    )

                    self.join.add(self.model.assigned_user)
                else:
                    stmt = User.email.ilike(f"%{search_value}%")
                    self.join.add(self.model.assigned_user)

                filters = [
                    stmt,
                ]
            else:
                if search_field in [
                    ClaimSearch.anticipated_amount,
                    ClaimSearch.fee,
                    ClaimSearch.current_phase,
                    ClaimSearch.ref_number,
                    ClaimSearch.ref_string,
                ]:
                    if (
                        search_field == ClaimSearch.anticipated_amount
                        or search_field == ClaimSearch.fee
                    ):
                        try:
                            search_value = extract_number_from_string(search_value)
                        except HTTPException as e:
                            if raise_exception:
                                raise e
                            else:
                                return None
                        else:
                            filters = super().filters_stmt(
                                search_field,
                                search_value,
                                operator=SqlOperators.EQ,
                            )
                    elif search_field == ClaimSearch.current_phase:
                        filters = super().filters_stmt(
                            search_field,
                            search_value,
                            operator=SqlOperators.EQ,
                            raise_exception=raise_exception,
                        )
                    elif (
                        search_field == ClaimSearch.ref_number
                        or search_field == ClaimSearch.ref_string
                    ):
                        if search_field == ClaimSearch.ref_string:
                            if not check_claim_string_format(search_value):
                                if raise_exception:
                                    exc_bad_request(
                                        "Provided `Reference String` is not a valid "
                                        "claim ref string."
                                    )
                        try:
                            search_value = extract_number_from_string(search_value)
                        except HTTPException as e:
                            if raise_exception:
                                raise e
                            else:
                                return None
                        else:
                            filters = super().filters_stmt(
                                ClaimSearch.ref_number,
                                search_value,
                                operator=SqlOperators.EQ,
                                raise_exception=raise_exception,
                            )
                else:
                    filters = super().filters_stmt(
                        search_field,
                        search_value,
                        operator=operator,
                        raise_exception=raise_exception,
                    )

        return filters

    def orderby_stmt(self, sort_by: Enum, order_by: Enum) -> list[Any] | None:
        from app.models import ClaimContact, Client, User

        stmt = None

        if sort_by:
            if sort_by in [
                ClaimSort.full_name,
                ClaimSort.phone_number,
                ClaimSort.email,
                ClaimSort.loss_address,
                ClaimSort.sourced_user_full_name,
                ClaimSort.signed_user_full_name,
                ClaimSort.adjusted_user_full_name,
                ClaimSort.assigned_user_full_name,
            ]:
                if sort_by == ClaimSort.full_name:
                    stmt = Client.full_name
                    self.join.add(self.model.client)
                elif sort_by == ClaimSort.phone_number:
                    stmt = Client.phone_number
                    self.join.add(self.model.client)
                elif sort_by == ClaimSort.email:
                    stmt = Client.email
                    self.join.add(self.model.client)
                elif sort_by == ClaimSort.loss_address:
                    stmt = ClaimContact.address_loss
                    self.join.add(self.model.claim_contact)
                elif sort_by == ClaimSort.sourced_user_full_name:
                    stmt = func.concat(
                        self.source_user.first_name,
                        " ",
                        self.source_user.last_name,
                    )
                    self.join.add(Claim.source_user.of_type(self.source_user))
                elif sort_by == ClaimSort.signed_user_full_name:
                    stmt = func.concat(
                        self.signed_by_user.first_name,
                        " ",
                        self.signed_by_user.last_name,
                    )
                    self.join.add(Claim.signed_by_user.of_type(self.signed_by_user))
                elif sort_by == ClaimSort.adjusted_user_full_name:
                    stmt = func.concat(
                        self.adjusted_by_user.first_name,
                        " ",
                        self.adjusted_by_user.last_name,
                    )
                    self.join.add(Claim.adjusted_by_user.of_type(self.adjusted_by_user))
                elif sort_by == ClaimSort.assigned_user_full_name:
                    stmt = func.concat(User.first_name, " ", User.last_name)
                    self.join.add(self.model.assigned_user)
            else:
                stmt = getattr(self.model, str(sort_by.value))

        if stmt is not None:
            stmt = stmt.asc() if order_by == Ordering.asc else stmt.desc()

        return [
            stmt,
        ]
