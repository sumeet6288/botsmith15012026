"""Persistent, tenant/chatbot/conversation-scoped agent memory."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class MongoMemoryManager:
    def __init__(self, db) -> None:
        self.collection = db.agent_memory

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([
            ("tenant_id", 1),
            ("chatbot_id", 1),
            ("conversation_id", 1),
            ("created_at", -1),
        ])

    async def remember(
        self,
        *,
        tenant_id: str,
        chatbot_id: str,
        conversation_id: Optional[str],
        memory: Dict[str, Any],
    ) -> None:
        await self.collection.insert_one({
            "tenant_id": tenant_id,
            "chatbot_id": chatbot_id,
            "conversation_id": conversation_id,
            "memory": memory,
            "created_at": datetime.now(timezone.utc),
        })

    async def recall(
        self,
        *,
        tenant_id: str,
        chatbot_id: str,
        conversation_id: Optional[str],
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        query = {
            "tenant_id": tenant_id,
            "chatbot_id": chatbot_id,
            "conversation_id": conversation_id,
        }
        docs = await self.collection.find(query).sort("created_at", -1).to_list(length=limit)
        docs.reverse()
        return [doc.get("memory", {}) for doc in docs]
