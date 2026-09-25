"""Server-side Calendly credential resolution.

The model never receives Calendly credentials. This resolver uses the
authenticated BotSmith chatbot/user boundary to load the stored connection.
"""

from __future__ import annotations

import os
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient


class CalendlyCredentialResolver:
    """Resolve Calendly credentials for a specific BotSmith chatbot/user."""

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
        """Return the connected Calendly access token server-side."""

        connection = await self.db.calendly_connections.find_one(
            {
                "chatbot_id": chatbot_id,
                "user_id": user_id,
                "provider": "calendly",
            },
            {
                "_id": 0,
                "access_token": 1,
            },
        )

        if not connection:
            return None

        return connection.get("access_token")

    async def close(self) -> None:
        """Close the MongoDB client."""
        self.client.close()