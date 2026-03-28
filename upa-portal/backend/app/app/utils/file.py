#!/usr/bin/env python

"""Files related utility functions."""

import os
import re
from uuid import UUID

from sqlalchemy.orm import Session

from app import crud
from app.core.enums import FileModules
from app.db.session import SessionLocal
from app.models import ClaimFile, ClientFile, File, LeadFile, TemplateFile, ClaimPaymentFile
from app.schemas import ClaimFileUpdate, ClientFileUpdate, FileUpdate, LeadFileUpdate
from app.utils.common import extract_filename_from_url, is_slug, slugify


class FileUtil:
    @staticmethod
    def _gen_file_version(existing_filenames: list[str]) -> int:
        """
        Generate a file version.

        Parameters
        ----------
        existing_filenames : list[str]
            A list of existing files.
        Returns
        -------
        int
            A version number of the file.
        """
        if existing_filenames:
            last_version = max(
                [
                    (
                        int(filename.split("-v")[-1].split(".")[0])
                        if re.search(r"-v\d+\.\w+$", filename)
                        else 0
                    )
                    for filename in existing_filenames
                ]
            )
            next_version = last_version + 1
        else:
            next_version = 1

        return next_version

    @staticmethod
    def _append_version(filename: str, version: int) -> str:
        """
        Append a file version to the filename.

        Parameters
        ----------
        filename : str
            A file name
        version : int
            A file version number.

        Returns
        -------
        str
            A file name with a version number.
        """
        name, ext = os.path.splitext(filename)
        if is_slug(name):
            return f"{name}-v{version}{ext}"
        else:
            return f"{name} v{version}{ext}"

    def get_formatted_filenames(
        self,
        related_type: FileModules,
        filename: str,
        *,
        obj_id: UUID | None = None,
        proposed_filename: str | None = None,
    ) -> dict[str, str]:
        """
        Get a formatted filename.

        Parameters
        ----------
        related_type : FileModules
            Type of file module.
        filename : str
            The file name.
        obj_id : UUID | None
            The model object id.
        proposed_filename : str | None
            Proposed file name

        Returns
        -------
        dict[str, str]
            Formatted file names including version number.
            In case, file name exists with the same name.
        """
        name, ext = os.path.splitext(filename)
        if proposed_filename:
            name = proposed_filename.rsplit(".", 1)[0].replace(".", " ")
            slugged_name = slugify(name)
        else:
            slugged_name = slugify(name)
        slugged_filename = slugged_name + ext
        db_session: Session = SessionLocal()
        files = []
        regex_ver_pattern = r"-v\d+\.\w+$"

        match related_type:
            case FileModules.LEAD:
                if obj_id:
                    filters = [
                        LeadFile.slugged_name == slugged_filename,
                        LeadFile.slugged_name.regexp_match(
                            slugged_name + regex_ver_pattern
                        ),
                    ]
                    files = crud.lead_file.get_records(
                        db_session,
                        obj_id=obj_id,
                        filters=filters,
                        paginated=False,
                    )
            case FileModules.PERSONAL_FILE:
                    if obj_id:
                        filters = [
                            LeadFile.slugged_name == slugged_filename,
                            LeadFile.slugged_name.regexp_match(
                                slugged_name + regex_ver_pattern
                            ),
                        ]
                        files = crud.user_personal_file.get_records(
                            db_session,
                            owner_id=obj_id,
                            filters=filters,
                            paginated=False,
                        )
            case FileModules.CLIENT:
                if obj_id:
                    filters = [
                        ClientFile.slugged_name == slugged_filename,
                        ClientFile.slugged_name.regexp_match(
                            slugged_name + regex_ver_pattern
                        ),
                    ]
                    files = crud.client_file.get_records(
                        db_session,
                        obj_id=obj_id,
                        filters=filters,
                        paginated=False,
                    )
            case FileModules.CLAIM:
                if obj_id:
                    filters = [
                        ClaimFile.slugged_name == slugged_filename,
                        ClaimFile.slugged_name.regexp_match(
                            slugged_name + regex_ver_pattern
                        ),
                    ]
                    files = crud.claim_file.get_records(
                        db_session,
                        obj_id=obj_id,
                        filters=filters,
                        paginated=False,
                    )
            case FileModules.CLAIM_PAYMENT:
                if obj_id:
                    filters = [
                        ClaimPaymentFile.slugged_name == slugged_filename,
                        ClaimPaymentFile.slugged_name.regexp_match(
                            slugged_name + regex_ver_pattern
                        ),
                    ]
                    files = crud.claim_payment_file.get_records(
                        db_session,
                        obj_id=obj_id,
                        filters=filters,
                        paginated=False,
                    )
            case FileModules.NEWSLETTER:
                pass
            case FileModules.TEMPLATE:
                filters = [
                    TemplateFile.slugged_name == slugged_filename,
                    TemplateFile.slugged_name.regexp_match(
                        slugged_name + regex_ver_pattern
                    ),
                ]
                files = crud.template_file.get_records(
                    db_session,
                    filters=filters,
                    paginated=False,
                )
            case _:
                pass

        if len(files) > 0:
            files_list = [file.slugged_name for file in files]
            file_version = self._gen_file_version(files_list)

            return {
                "filename": self._append_version(name + ext, file_version),
                "slugged_filename": self._append_version(
                    slugged_filename, file_version
                ),
            }
        else:
            return {"filename": name + ext, "slugged_filename": slugged_filename}

    @staticmethod
    def fix_file_slug_name(
        obj: LeadFile | ClientFile | ClaimFile,
    ) -> bool:
        """
        Fix file slug name via object ID.

        Parameters
        ----------
        obj : LeadFile | ClientFile | ClaimFile
            The model object instance.

        Returns
        -------
        bool
            `True` if fixed, otherwise `False`.
        """
        db_session: Session = SessionLocal()

        slugged_name = None
        if obj.slugged_name is None:
            slugged_name = extract_filename_from_url(url=obj.path)

        match obj:
            case LeadFile():
                if slugged_name:
                    obj_in = LeadFileUpdate(slugged_name=slugged_name)
                    crud.lead_file.update(db_session, db_obj=obj, obj_in=obj_in)
                    return True

            case ClientFile():
                if slugged_name:
                    obj_in = ClientFileUpdate(slugged_name=slugged_name)
                    crud.client_file.update(db_session, db_obj=obj, obj_in=obj_in)
                    return True

            case ClaimFile():
                if slugged_name:
                    obj_in = ClaimFileUpdate(slugged_name=slugged_name)
                    crud.claim_file.update(db_session, db_obj=obj, obj_in=obj_in)
                    return True

            case File():
                if slugged_name:
                    obj_in = FileUpdate(slugged_name=slugged_name)
                    crud.file.update(db_session, db_obj=obj, obj_in=obj_in)
                    return True

            case _:
                pass

        return False
