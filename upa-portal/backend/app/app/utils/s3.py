#!/usr/bin/env python

"""AWS S3 bucket utility functions"""

import logging
import shutil
import zipfile
from datetime import date
from io import BytesIO
from pathlib import Path as FsPath

import boto3
from botocore.exceptions import ClientError
from starlette.datastructures import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


def _local_media_root() -> FsPath:
    """Resolve local media directory — Docker (/app/media/) or local fallback."""
    docker_path = FsPath("/app/media")
    if docker_path.exists():
        return docker_path
    local_path = FsPath("media")
    local_path.mkdir(parents=True, exist_ok=True)
    return local_path


class S3:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )

    @staticmethod
    def _save_locally(data: bytes, object_name: str) -> None:
        """Save file to local filesystem as fallback when S3 is unavailable."""
        dest = _local_media_root() / object_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        logger.info("Saved file locally: %s (%d bytes)", dest, len(data))

    @staticmethod
    def upload_file_obj(
        file: UploadFile | BytesIO, object_name: str, content_type: str | None = None
    ) -> None:
        """
        Upload file object to AWS S3 bucket.
        Falls back to local filesystem if S3 credentials are invalid.

        Parameters
        ----------
        file : UploadFile
            File object
        object_name : str
            Path to file object
        content_type : str
            Mime type of the file.
        """
        # Capture raw bytes upfront for local fallback if S3 fails
        raw_bytes: bytes | None = None
        match file:
            case UploadFile():
                file.file.seek(0)
                raw_bytes = file.file.read()
                file.file.seek(0)
            case BytesIO():
                if content_type is None:
                    raise Exception("The mime type of the file is required.")
                file.seek(0)
                raw_bytes = file.read()
                file.seek(0)

        try:
            match file:
                case UploadFile():
                    S3.s3_client.upload_fileobj(
                        file.file,
                        settings.S3_BUCKET_NAME,
                        object_name,
                        ExtraArgs={
                            "ACL": "public-read",
                            "ContentType": file.content_type,
                        },
                    )
                case BytesIO():
                    S3.s3_client.upload_fileobj(
                        file,
                        settings.S3_BUCKET_NAME,
                        object_name,
                        ExtraArgs={
                            "ACL": "public-read",
                            "ContentType": content_type,
                        },
                    )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in (
                "InvalidAccessKeyId",
                "SignatureDoesNotMatch",
                "AccessDenied",
                "NoSuchBucket",
            ):
                logger.warning(
                    "S3 unavailable (%s), falling back to local storage for: %s",
                    error_code,
                    object_name,
                )
                S3._save_locally(raw_bytes, object_name)
            else:
                raise

    @staticmethod
    def copy_file_obj(
        source_object_key: str,
        destination_object_key: str,
        *,
        metadata: dict | None = None,
    ) -> None:
        """
        Copy file object in AWS S3 bucket.
        Falls back to local filesystem copy if S3 credentials are invalid.

        Parameters
        ----------
        source_object_key : str
            Path to the source file object
        destination_object_key : str
            Path to the destination file object
        metadata : dict | None
            Metadata of the file.
        """
        try:
            match metadata:
                case None:
                    S3.s3_client.copy_object(
                        Bucket=settings.S3_BUCKET_NAME,
                        Key=destination_object_key,
                        CopySource={
                            "Bucket": settings.S3_BUCKET_NAME,
                            "Key": source_object_key,
                        },
                        ACL="public-read",
                    )
                case _:
                    if "content-type" in metadata:
                        metadata.pop("content-type")

                    S3.s3_client.copy_object(
                        Bucket=settings.S3_BUCKET_NAME,
                        Key=destination_object_key,
                        CopySource={
                            "Bucket": settings.S3_BUCKET_NAME,
                            "Key": source_object_key,
                        },
                        Metadata=metadata,
                        MetadataDirective="REPLACE",
                        ContentType=metadata["Content-Type"],
                        ACL="public-read",
                    )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in (
                "InvalidAccessKeyId",
                "SignatureDoesNotMatch",
                "AccessDenied",
                "NoSuchBucket",
            ):
                logger.warning(
                    "S3 unavailable (%s), falling back to local copy: %s -> %s",
                    error_code,
                    source_object_key,
                    destination_object_key,
                )
                src = _local_media_root() / source_object_key
                dst = _local_media_root() / destination_object_key
                dst.parent.mkdir(parents=True, exist_ok=True)
                if src.exists():
                    shutil.copy2(str(src), str(dst))
                    logger.info("Local copy completed: %s -> %s", src, dst)
                else:
                    raise FileNotFoundError(
                        f"Local source file not found for copy: {src}"
                    )
            else:
                raise

    @staticmethod
    def get_metadata(object_key: str) -> dict:
        """
        Gets metadata of the existing file object.

        Parameters
        ----------
        object_key : str
            Path to the file object.

        Returns
        -------
        dict
            A dictionary consist of file metadata.
        """
        response = S3.s3_client.head_object(
            Bucket=settings.S3_BUCKET_NAME, Key=object_key
        )

        return response["Metadata"]

    @staticmethod
    def delete_file_obj(object_name: str) -> None:
        """
        Delete file object from AWS S3 bucket.

        Parameters
        ----------
        object_name : str
            Path to file object
        """
        S3.s3_client.delete_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=object_name,
        )

    @staticmethod
    def download_files_from_s3(file_list: list[str]) -> list[tuple[bytes, str]]:
        """
        Download multiple file objects from AWS S3 bucket.

        Parameters
        ----------
        file_list : list[str]
            A list of file paths.

        Returns
        -------
        list[tuple[bytes, str]]
            A list of tuples, each containing the file content as bytes and the filename.
        """
        files = []
        for file in file_list:
            try:
                response = S3.s3_client.get_object(
                    Bucket=settings.S3_BUCKET_NAME, Key=file
                )
                file_content = response["Body"].read()
                filename = file.split("/")[-1]
                files.append((file_content, filename))
            except ClientError as err:
                if err.response["Error"]["Code"] == "NoSuchKey":
                    print(f"{file} not known")
                else:
                    raise
        return files

    @staticmethod
    def get_presigned_urls(file_list: list[dict], expiry_date: str) -> list[dict]:
        """
        Generate presigned URLs for multiple S3 objects.

        Parameters
        ----------
        file_list : list[dict]
            A list of file objects with claim_id, s3_key, name and size
        expiry_date : date string in YYYY-MM-DD
            The date after which the presigned URL should expire.

        Returns
        -------
        list[dict]
            A list of objects, each containing the name, its presigned URL and file size.
        """
        presigned_urls = []

        # Convert string to datetime object
        expiration_date = date.fromisoformat(expiry_date)

        # Get today's date
        today_date = date.today()

        # Calculate the difference in days
        delta = expiration_date - today_date
        expiry_days = delta.days + 1

        # Check if the expiration date is in the past
        if expiry_days < 0:
            raise ValueError("The expiration date is in the past.")

        expiration_seconds = expiry_days * 24 * 60 * 60  # Convert days to seconds

        for file in file_list:
            try:
                # Check if the object exists in S3
                S3.s3_client.head_object(
                    Bucket=settings.S3_BUCKET_NAME, Key=file["s3_key"]
                )

                # Generate the presigned URL if the object exists
                presigned_url = S3.s3_client.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": settings.S3_BUCKET_NAME,
                        "Key": file["s3_key"],
                    },
                    ExpiresIn=expiration_seconds,
                )

                # Append the presigned URL along with other details
                presigned_urls.append(
                    {
                        "name": file["name"],
                        "url": presigned_url,
                        "size": file["size"],
                    }
                )
            except Exception as e:
                print(f"Failed to generate presigned URL for {file['name']}: {e}")

        return presigned_urls

    @staticmethod
    def download_and_zip_files(file_list):
        """Zips files directly from S3 into an in-memory file."""
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for file in file_list:
                try:
                    response = S3.s3_client.get_object(
                        Bucket=settings.S3_BUCKET_NAME, Key=file["s3_key"]
                    )
                    zf.writestr(file["name"], response["Body"].read())
                except ClientError as err:
                    if err.response["Error"]["Code"] == "NoSuchKey":
                        print(f"{file['s3_key']} not known")
                    else:
                        raise

        zip_buffer.seek(0)
        return zip_buffer
