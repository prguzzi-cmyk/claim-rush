#!/usr/bin/env python

"""AWS S3 bucket utility functions"""

import boto3
from fastapi import UploadFile

from app.core.config import settings


class S3:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )

    @staticmethod
    def upload_file_obj(file: UploadFile, object_name: str) -> None:
        """
        Upload file object to AWS S3 bucket.

        Parameters
        ----------
        file : UploadFile
            File object
        object_name : str
            Path to file object
        """
        S3.s3_client.upload_fileobj(
            file.file,
            settings.S3_BUCKET_NAME,
            object_name,
            ExtraArgs={"ACL": "public-read"},
        )
