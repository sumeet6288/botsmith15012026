"""Construction of model-facing context with clear trust boundaries."""

from typing import Optional

from pydantic import BaseModel, Field

from .models import AgentConfig


class AgentContext(BaseModel):
    """Separated system instructions and untrusted request content."""

    system_instructions: str
    user_task: str
    chatbot_id: str
    conversation_id: Optional[str] = None
    model: str
    provider: str
    max_steps: int = Field(ge=1)
    max_tool_calls: int = Field(ge=0)


class ContextBuilder:
    """Build runtime context from already-resolved chatbot configuration."""

    @staticmethod
    def build(config: AgentConfig, task: str) -> AgentContext:
        return AgentContext(
            system_instructions=config.system_message,
            user_task=(task or "").strip(),
            chatbot_id=config.chatbot_id,
            conversation_id=config.conversation_id,
            model=config.model,
            provider=config.provider,
            max_steps=config.limits.max_steps,
            max_tool_calls=config.limits.max_tool_calls,
        )