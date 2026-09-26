"""Server-side Calendly credential resolution.

The model never receives Calendly credentials. This resolver uses the
authenticated BotSmith chatbot/user boundary to load and refresh the stored
Calendly connection.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorClient


class CalendlyCredentialResolver:
    """Resolve and refresh Calendly credentials for a specific chatbot/user."""

    TOKEN_URL = "https://auth.calendly.com/oauth/token"
    EXPIRY_BUFFER_SECONDS = 60

    def __init__(self):
        mongo_url = os.environ.get(
            "MONGO_URL",
            "mongodb://localhost:27017",
        )
        db_name = os.environ.get(
            "DB_NAME",
            "chatbase_db",
        )

        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]

    async def get_access_token(
        self,
        *,
        chatbot_id: str,
        user_id: str,
    ) -> Optional[str]:
        """Return a valid Calendly access token, refreshing it when necessary."""

        connection = await self.db.calendly_connections.find_one(
            {
                "chatbot_id": chatbot_id,
                "user_id": user_id,
                "provider": "calendly",
            },
            {
                "_id": 0,
                "access_token": 1,
                "refresh_token": 1,
                "expires_at": 1,
            },
        )

        if not connection:
            return None

        access_token = connection.get("access_token")
        refresh_token = connection.get("refresh_token")
        expires_at = connection.get("expires_at")

        # If there is no expiry information, preserve the existing behavior
        # and return the stored access token.
        if not expires_at:
            return access_token

        # MongoDB may return a naive datetime depending on the driver
        # configuration. Treat naive timestamps as UTC.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)

        # Token is still valid with a small safety buffer.
        if expires_at > now + timedelta(
            seconds=self.EXPIRY_BUFFER_SECONDS
        ):
            return access_token

        # We cannot refresh without a refresh token.
        if not refresh_token:
            return access_token

        return await self._refresh_access_token(
            chatbot_id=chatbot_id,
            user_id=user_id,
            refresh_token=refresh_token,
        )

    async def _refresh_access_token(
        self,
        *,
        chatbot_id: str,
        user_id: str,
        refresh_token: str,
    ) -> Optional[str]:
        """Exchange the Calendly refresh token for a new access token."""

        client_id = os.environ.get("CALENDLY_CLIENT_ID")
        client_secret = os.environ.get("CALENDLY_CLIENT_SECRET")

        if not client_id or not client_secret:
            raise RuntimeError(
                "Calendly OAuth credentials are not configured"
            )

        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        }

        async with httpx.AsyncClient(timeout=15.0) as http:
            response = await http.post(
                self.TOKEN_URL,
                data=payload,
                headers={
                    "Accept": "application/json",
                },
            )

        if response.status_code >= 400:
            try:
                detail = response.json()
            except Exception:
                detail = response.text

            raise RuntimeError(
                f"Calendly token refresh failed ({response.status_code}): "
                f"{detail}"
            )

        token_data = response.json()

        new_access_token = token_data.get("access_token")

        if not new_access_token:
            raise RuntimeError(
                "Calendly token refresh did not return an access token"
            )

        new_refresh_token = token_data.get(
            "refresh_token",
            refresh_token,
        )

        expires_in = token_data.get("expires_in")

        new_expires_at = None

        if isinstance(expires_in, (int, float)):
            new_expires_at = datetime.now(timezone.utc) + timedelta(
                seconds=int(expires_in)
            )

        update_fields = {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "updated_at": datetime.now(timezone.utc),
        }

        if new_expires_at is not None:
            update_fields["expires_at"] = new_expires_at

        await self.db.calendly_connections.update_one(
            {
                "chatbot_id": chatbot_id,
                "user_id": user_id,
                "provider": "calendly",
            },
            {
                "$set": update_fields,
            },
        )

        return new_access_token

    async def close(self) -> None:
        """Close the MongoDB client."""
        self.client.close()