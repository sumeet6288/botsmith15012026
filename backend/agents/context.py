"""Construction of bounded, trust-separated model context."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .models import AgentConfig


class AgentContext(BaseModel):
    """Context passed to the planner and response model.

    User text and observations are data. They are never merged into the
    trusted system-instruction field.
    """

    system_instructions: str = Field(default="", max_length=30_000)
    user_task: str = Field(default="", max_length=8_000)
    chatbot_id: str = Field(min_length=1, max_length=256)
    owner_user_id: Optional[str] = Field(default=None, max_length=256)
    conversation_id: Optional[str] = Field(default=None, max_length=256)
    session_id: str = Field(min_length=1, max_length=256)
    model: str = Field(min_length=1, max_length=256)
    provider: str = Field(min_length=1, max_length=64)
    max_steps: int = Field(ge=1)
    max_tool_calls: int = Field(ge=0)
    max_runtime_seconds: float = Field(gt=0)
    max_retries: int = Field(ge=0)
    max_result_chars: int = Field(ge=1_000)
    tool_descriptions: List[Dict[str, Any]] = Field(default_factory=list)
    observations: List[Dict[str, Any]] = Field(default_factory=list)

    def with_runtime_data(
        self,
        *,
        tool_descriptions: Optional[List[Dict[str, Any]]] = None,
        observations: Optional[List[Dict[str, Any]]] = None,
    ) -> "AgentContext":
        """Return a bounded copy with current tool/observation data."""

        return self.model_copy(
            update={
                "tool_descriptions": (tool_descriptions or [])[:20],
                "observations": (observations or [])[-5:],
            }
        )


class ContextBuilder:
    """Build runtime context from already-resolved chatbot configuration."""

    @staticmethod
    def build(config: AgentConfig, task: str) -> AgentContext:
        return AgentContext(
            system_instructions=(config.system_message or "").strip(),
            user_task=(task or "").strip()[: config.limits.max_task_chars],
            chatbot_id=config.chatbot_id,
            owner_user_id=config.owner_user_id,
            conversation_id=config.conversation_id,
            session_id=config.session_id,
            model=config.model,
            provider=config.provider,
            max_steps=config.limits.max_steps,
            max_tool_calls=config.limits.max_tool_calls,
            max_runtime_seconds=config.limits.max_runtime_seconds,
            max_retries=config.limits.max_retries,
            max_result_chars=config.limits.max_result_chars,
        )