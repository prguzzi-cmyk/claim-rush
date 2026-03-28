#!/usr/bin/env python

"""A utility class for email retrieval from the email server."""

import email
import imaplib
import mimetypes
from email.message import Message


class EmailRetrieval:
    """The base class to retrieve emails from the email server."""

    _mail = None
    _mailbox = None

    def __init__(self, server, username, password):
        self._username = username
        self._password = password
        self._server = server

    def _connect_to_imap(self):
        """
        Connects to IMAP server of the email server.
        """
        try:
            # Connect to the IMAP Server
            self._mail = imaplib.IMAP4_SSL(self._server)

            # Login to the mailbox
            self._mail.login(self._username, self._password)
        except imaplib.IMAP4.error as e:
            print("IMAP error: ", e)
        except Exception as e:
            print("An error occurred: ", e)

    def select_mailbox(self, mailbox: str = "INBOX") -> bool:
        """
        Allow to select the mailbox.

        Parameters
        ----------
        mailbox : str
            The mailbox name

        Returns
        -------
        bool
            `True` on success, else `False`.
        """
        self._mailbox = mailbox

        if not self._mail:
            self._connect_to_imap()

        try:
            self._mail.select(self._mailbox)
        except imaplib.IMAP4.error as e:
            print("IMAP error: ", e)
            return False
        except Exception as e:
            print("An error occurred: ", e)
            return False

        return True

    def fetch_unseen_emails(self) -> list[Message]:
        """
        Fetch Unseen emails from the email server.

        Returns
        -------
        list[Message]
            A list of messages or empty list.
        """
        # Select the mailbox
        self.select_mailbox()

        result, data = self._mail.search(None, "UNSEEN")
        messages = []

        if result == "OK":
            # Process each unseen email
            for num in data[0].split():
                result, data = self._mail.fetch(num, "(RFC822)")
                raw_email = data[0][1]  # The raw email data
                messages.append(email.message_from_bytes(raw_email))

        return messages

    @staticmethod
    def extract_attachments(msg: Message) -> list:
        """
        Extract attachments from a message.

        Parameters
        ----------
        msg : Message
            The Message object

        Returns
        -------
        list
            A list of attachments.
        """
        attachments = []

        if not msg:
            return attachments

        # Extract Attachments
        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if part.get("Content-Disposition") is None:
                continue
            filename = part.get_filename()
            if filename:
                obj = dict()
                obj["filename"] = filename
                obj["file"] = part.get_payload(decode=True)
                obj["content_type"] = part.get_content_type()
                obj["size"] = len(obj["file"])
                obj["extension"] = mimetypes.guess_extension(obj["content_type"])

                attachments.append(obj)

        return attachments
