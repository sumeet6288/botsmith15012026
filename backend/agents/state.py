"""Bounded execution state and optional workflow persistence."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import AgentStep, ExecutionLimits

logger = logging.getLogger(__name__)


def _bounded(value: Any, limit: int = 20_000) -> Any:
    """Make tool observations safe and bounded before storing them."""

    if isinstance(value, dict):
        return {
            str(key)[:128]: _bounded(item, limit)
            for key, item in list(value.items())[:100]
            if str(key).lower()
            not in {"access_token", "refresh_token", "client_secret", "password", "api_key"}
        }
    if isinstance(value, list):
        return [_bounded(item, limit) for item in value[:100]]
    if isinstance(value, str):
        return value[:limit]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:limit]


class AgentState(BaseModel):
    """Serializable state for one bounded workflow."""

    model_config = ConfigDict(extra="ignore")

    workflow_id: Optional[str] = None
    chatbot_id: str
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    task: str = Field(default="", max_length=8_000)
    current_step: int = Field(default=0, ge=0)
    tool_call_count: int = Field(default=0, ge=0)
    retry_count: int = Field(default=0, ge=0)
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    retrieved_context: Optional[str] = Field(default=None, max_length=20_000)
    tool_results: List[Dict[str, Any]] = Field(default_factory=list)
    steps: List[AgentStep] = Field(default_factory=list)
    pending_action: Optional[str] = None
    status: str = "running"
    version: int = Field(default=0, ge=0)
    created_at: str = ""
    updated_at: str = ""
    limits: ExecutionLimits = Field(default_factory=ExecutionLimits)

    def record_step(
        self,
        name: str,
        status: str = "completed",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record only bounded lifecycle metadata, never hidden reasoning."""

        if len(self.steps) >= self.limits.max_steps * 3 + 10:
            return
        self.steps.append(
            AgentStep(
                name=name,
                status=status,
                metadata=_bounded(metadata or {}, limit=2_000),
            )
        )
        self.current_step += 1
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def record_tool_result(self, tool_name: str, result: Any) -> None:
        self.tool_call_count += 1
        self.tool_results.append(
            {
                "tool": tool_name,
                "result": _bounded(result, self.limits.max_result_chars),
            }
        )
        self.tool_results = self.tool_results[-10:]
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def observation_payload(self) -> List[Dict[str, Any]]:
        return _bounded(self.tool_results, self.limits.max_result_chars)


class AgentStateStore:
    """Small Mongo-backed workflow store using an existing database handle."""

    def __init__(self, database: Any = None, collection_name: str = "agent_workflows"):
        self._database = database
        self._collection_name = collection_name

    @staticmethod
    def workflow_id(
        *,
        chatbot_id: str,
        conversation_id: Optional[str],
        user_id: Optional[str],
    ) -> str:
        raw = "|".join(
            [chatbot_id, conversation_id or "", user_id or ""]
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _collection(self):
        if self._database is None:
            return None
        return self._database[self._collection_name]

    async def load(
        self,
        *,
        chatbot_id: str,
        conversation_id: Optional[str],
        user_id: Optional[str],
    ) -> Optional[AgentState]:
        collection = self._collection()
        if collection is None or not conversation_id:
            return None

        workflow_id = self.workflow_id(
            chatbot_id=chatbot_id,
            conversation_id=conversation_id,
            user_id=user_id,
        )
        try:
            document = await collection.find_one(
                {
                    "workflow_id": workflow_id,
                    "chatbot_id": chatbot_id,
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                },
                {"_id": 0},
            )
            if not document:
                return None
            state = AgentState.model_validate(document)
            if state.status in {"completed", "failed"}:
                return None
            return state
        except Exception:
            logger.warning(
                "Ignoring malformed agent workflow state for chatbot=%s",
                chatbot_id,
                exc_info=True,
            )
            try:
                await collection.delete_one({"workflow_id": workflow_id})
            except Exception:
                logger.debug("Could not remove malformed agent workflow state", exc_info=True)
            return None

    async def save(self, state: AgentState) -> None:
        collection = self._collection()
        if collection is None or not state.conversation_id:
            return

        if not state.workflow_id:
            state.workflow_id = self.workflow_id(
                chatbot_id=state.chatbot_id,
                conversation_id=state.conversation_id,
                user_id=state.user_id,
            )
        if not state.created_at:
            state.created_at = datetime.now(timezone.utc).isoformat()
        state.updated_at = datetime.now(timezone.utc).isoformat()
        previous_version = state.version
        state.version += 1
        document = state.model_dump(mode="json")
        try:
            result = await collection.replace_one(
                {
                    "workflow_id": state.workflow_id,
                    "chatbot_id": state.chatbot_id,
                    "conversation_id": state.conversation_id,
                    "user_id": state.user_id,
                    "version": previous_version,
                },
                document,
                upsert=True,
            )
            if previous_version > 0 and not result.matched_count:
                logger.warning(
                    "Concurrent agent workflow update rejected for chatbot=%s",
                    state.chatbot_id,
                )
        except Exception:
            logger.warning(
                "Agent workflow state could not be persisted for chatbot=%s",
                state.chatbot_id,
                exc_info=True,
            )

    async def delete(self, state: AgentState) -> None:
        collection = self._collection()
        if collection is None or not state.workflow_id:
            return
        try:
            await collection.delete_one({"workflow_id": state.workflow_id})
        except Exception:
            logger.debug("Agent workflow cleanup failed", exc_info=True)