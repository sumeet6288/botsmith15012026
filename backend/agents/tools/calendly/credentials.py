"""Tenant-scoped Calendly credential resolution without a second app database."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CalendlyCredentialResolver:
    """Resolve and refresh Calendly credentials for one chatbot/user."""

    TOKEN_URL = "https://auth.calendly.com/oauth/token"
    EXPIRY_BUFFER_SECONDS = 60

    def __init__(self, database: Any = None):
        self._database = database
        self._client = None
        self._db_name = os.environ.get("DB_NAME", "chatbase_db")

    async def _get_database(self):
        if self._database is not None:
            return self._database

        # Standalone use remains possible, but the normal application path
        # passes the existing LeadService database handle above.
        from motor.motor_asyncio import AsyncIOMotorClient

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        self._client = self._client or AsyncIOMotorClient(mongo_url)
        self._database = self._client[self._db_name]
        return self._database

    async def get_access_token(
        self,
        *,
        chatbot_id: str,
        user_id: str,
    ) -> Optional[str]:
        """Return a valid access token, refreshing it when necessary."""

        database = await self._get_database()
        connection = await database.calendly_connections.find_one(
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
        if not access_token:
            return None
        if not expires_at:
            return access_token
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at > datetime.now(timezone.utc) + timedelta(
            seconds=self.EXPIRY_BUFFER_SECONDS
        ):
            return access_token
        if not refresh_token:
            return access_token

        return await self._refresh_access_token(
            database=database,
            chatbot_id=chatbot_id,
            user_id=user_id,
            refresh_token=refresh_token,
        )

    async def _refresh_access_token(
        self,
        *,
        database: Any,
        chatbot_id: str,
        user_id: str,
        refresh_token: str,
    ) -> Optional[str]:
        """Exchange a refresh token and update the existing connection."""

        client_id = os.environ.get("CALENDLY_CLIENT_ID")
        client_secret = os.environ.get("CALENDLY_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise RuntimeError("Calendly OAuth credentials are not configured")

        import httpx

        async with httpx.AsyncClient(timeout=15.0) as http:
            response = await http.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={"Accept": "application/json"},
            )

        if response.status_code >= 400:
            logger.warning(
                "Calendly token refresh failed with status=%s",
                response.status_code,
            )
            raise RuntimeError("Calendly token refresh failed")

        token_data = response.json()
        new_access_token = token_data.get("access_token")
        if not new_access_token:
            raise RuntimeError(
                "Calendly token refresh did not return an access token"
            )

        new_refresh_token = token_data.get("refresh_token", refresh_token)
        expires_in = token_data.get("expires_in")
        update_fields = {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "updated_at": datetime.now(timezone.utc),
        }
        if isinstance(expires_in, (int, float)):
            update_fields["expires_at"] = datetime.now(timezone.utc) + timedelta(
                seconds=int(expires_in)
            )

        await database.calendly_connections.update_one(
            {
                "chatbot_id": chatbot_id,
                "user_id": user_id,
                "provider": "calendly",
            },
            {"$set": update_fields},
        )
        return new_access_token

    async def close(self) -> None:
        """Close only a fallback client created by this resolver."""

        if self._client is not None:
            self._client.close()
            self._client = None