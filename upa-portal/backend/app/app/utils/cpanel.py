#!/usr/bin/env python

"""Utility class for cpanel server."""

import json

import requests

from app.core.config import settings


class Cpanel:
    """The base REST API class for cpanel admin panel."""

    _CPANEL_API_URL = settings.CPANEL_API_URL
    _CPANEL_DOMAIN = settings.CPANEL_DOMAIN_NAME
    _CPANEL_USERNAME = settings.CPANEL_USERNAME
    _CPANEL_TOKEN = settings.CPANEL_TOKEN
    _MAILBOX_QUOTA = settings.MAILBOX_QUOTA

    def _get_request_headers(self) -> dict:
        """
        Get request headers for the api call.

        Returns
        -------
        dict
            A dictionary consist of header attributes.
        """
        return {
            "Content-Type": "application/json",
            "Authorization": f"cpanel {self._CPANEL_USERNAME}:{self._CPANEL_TOKEN}",
        }

    def create_email_account(
        self,
        username: str,
        password: str,
        domain: str = _CPANEL_DOMAIN,
        quota: int = _MAILBOX_QUOTA,
    ):
        """
        Create a new email account on the email server.

        Parameters
        ----------
        username : str
            The username for the email address.
        password : str
            The password for the email address.
        domain : str
            Domain name.
        quota : int
            Mailbox storage quota.
        """
        request_body = {
            "email": username,
            "password": password,
            "domain": domain,
            "quota": quota,
        }

        headers = self._get_request_headers()

        try:
            response = requests.post(
                f"{self._CPANEL_API_URL}/execute/Email/add_pop",
                headers=headers,
                data=json.dumps(request_body),
                timeout=settings.REQ_TIMEOUT,
            )

            if response.status_code == 200:
                result = response.json()

                if result["data"]:
                    print("Email account created successfully!")
                else:
                    if result["errors"]:
                        raise Exception(f"cPanel Error: {result['errors']}")
                    if result["warnings"]:
                        raise Exception(f"cPanel Error: {result['warnings']}")
            else:
                raise Exception(f"cPanel Error: {response.text}")
        except Exception as e:
            print("Error creating email account!")

            raise e

    def create_email_pipe(
        self,
        email: str,
        script_path: str,
        domain: str = _CPANEL_DOMAIN,
    ):
        """
        Create a new email pipe forwarder on the email server.

        Parameters
        ----------
        email : str
            The email address.
        script_path : str
            Path to the script file.
        domain : str
            Domain name.
        """
        request_body = {
            "email": email,
            "domain": domain,
            "fwdopt": "pipe",
            "pipefwd": script_path,
        }

        headers = self._get_request_headers()

        try:
            response = requests.post(
                f"{self._CPANEL_API_URL}/execute/Email/add_forwarder",
                headers=headers,
                data=json.dumps(request_body),
                timeout=settings.REQ_TIMEOUT,
            )

            if response.status_code == 200:
                result = response.json()

                if result["data"]:
                    print("Email forwarder created successfully!")
                else:
                    if result["errors"]:
                        raise Exception(f"cPanel Error: {result['errors']}")
                    if result["warnings"]:
                        raise Exception(f"cPanel Error: {result['warnings']}")
            else:
                raise Exception(f"cPanel Error: {response.text}")
        except Exception as e:
            print("Error creating email forwarder!")

            raise e

    def update_email_password(
        self,
        username: str,
        password: str,
        domain: str = _CPANEL_DOMAIN,
    ):
        """
        Update email account password on the email server.

        Parameters
        ----------
        username : str
            The username for the email address.
        password : str
            The password for the email address.
        domain : str
            Domain name.
        """
        request_body = {
            "email": username,
            "password": password,
            "domain": domain,
        }

        headers = self._get_request_headers()

        try:
            response = requests.post(
                f"{self._CPANEL_API_URL}/execute/Email/passwd_pop",
                headers=headers,
                data=json.dumps(request_body),
                timeout=settings.REQ_TIMEOUT,
            )

            if response.status_code == 200:
                result = response.json()

                if result["data"]:
                    print("Email account password updated successfully!")
                else:
                    if result["errors"]:
                        raise Exception(f"cPanel Error: {result['errors']}")
                    if result["warnings"]:
                        raise Exception(f"cPanel Error: {result['warnings']}")
            else:
                raise Exception(f"cPanel Error: {response.text}")
        except Exception as e:
            print("Error updating email account password!")

            raise e
