#!/usr/bin/env python

"""CRUD operations for the user policy model"""

from typing import Any, Sequence
from uuid import UUID

from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, joinedload

from app.core.log import logger
from app.crud.base import CRUDBase
from app.models import PolicyPermission, UserPolicy
from app.schemas import UserPolicyCreateInDB, UserPolicyUpdate
from app.utils.exceptions import exc_bad_request, exc_conflict


class CRUDUserPolicy(CRUDBase[UserPolicy, UserPolicyCreateInDB, UserPolicyUpdate]):
    def get_multi(
        self,
        db_session: Session,
        join_target: Any = None,
        is_outer: bool = False,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[UserPolicy] | None:
        """
        Get a list of records of a specific model

        Parameters
        ----------
        db_session : Session
            Database session
        join_target : Any
            Join target model
        is_outer : bool
            Implement Full Outer Join
        removed : bool
            Fetch only removed records
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[UserPolicy] | None
            On success, return the found records. None if nothing is found.
        """
        with db_session as session:
            try:
                stmt = select(self.model)

                # Apply Join
                if join_target:
                    stmt = stmt.options(joinedload(join_target))

                # Apply filters
                if filters:
                    stmt = stmt.filter(and_(*filters))

                # Apply ordering
                if order_by:
                    stmt = stmt.order_by(*order_by)
                else:
                    stmt = stmt.order_by(self.model.created_at)

                return paginate(session, stmt, unique=True)
            except Exception as e:
                logger.error(str(e))
                exc_conflict(
                    "There is some issue with the provided values. "
                    "Please check and try again."
                )

    @staticmethod
    def get_by_user(db_session: Session, *, user_id: UUID) -> UserPolicy | None:
        """
        Retrieve a user policy with a user id.

        Parameters
        ----------
        db_session : Session
            Database session
        user_id : UUID
            An ID of the user.

        Returns
        -------
        UserPolicy
            Returns the UserPolicy object.
        """
        with db_session as session:
            stmt = select(UserPolicy).where(UserPolicy.user_id == user_id)
            user_policy_obj = session.scalars(stmt).first()

            return user_policy_obj

    def create(
        self, db_session: Session, *, obj_in: UserPolicyCreateInDB
    ) -> UserPolicy:
        user_policy_obj = self.get_by_user(db_session, user_id=obj_in.user_id)
        if user_policy_obj:
            exc_bad_request(
                "There is a permission policy already associated with the user."
            )

        with db_session as session:
            user_policy_obj = UserPolicy(
                user_id=obj_in.user_id,
            )

            session.add(user_policy_obj)
            session.commit()
            session.refresh(user_policy_obj)

        with db_session as session:
            for permission in obj_in.permissions:
                policy_permission = PolicyPermission(
                    policy_id=user_policy_obj.id,
                    permission_id=permission.permission_id,
                    effect=permission.effect.value,
                )
                session.add(policy_permission)
                session.commit()

        user_policy_obj = self.get_by_user(db_session, user_id=obj_in.user_id)

        return user_policy_obj

    def update(
        self,
        db_session: Session,
        *,
        user_policy_id: UUID,
        obj_in: UserPolicyUpdate | dict[str, Any],
    ) -> UserPolicy:
        with db_session as session:
            user_policy_obj: UserPolicy = session.query(UserPolicy).get(user_policy_id)

            # Set Model Schema attributes with the provided values
            user_policy_obj.permissions.clear()
            session.commit()
            session.refresh(user_policy_obj)

        with db_session as session:
            for permission in obj_in.permissions:
                policy_permission = PolicyPermission(
                    policy_id=user_policy_obj.id,
                    permission_id=permission.permission_id,
                    effect=permission.effect.value,
                )
                session.add(policy_permission)
                session.commit()

        user_policy_obj = self.get(db_session, obj_id=user_policy_id)

        return user_policy_obj


user_policy = CRUDUserPolicy(UserPolicy)
