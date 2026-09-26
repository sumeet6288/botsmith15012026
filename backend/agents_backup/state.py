"""Mutable state for a single agent execution."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .models import AgentStep, ExecutionLimits


class AgentState(BaseModel):
    """Execution state that can be extended with memory and tools later."""

    chatbot_id: str
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    task: str
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    retrieved_context: Optional[str] = None
    tool_results: List[Dict[str, Any]] = Field(default_factory=list)
    steps: List[AgentStep] = Field(default_factory=list)
    status: str = "running"
    limits: ExecutionLimits = Field(default_factory=ExecutionLimits)

    def record_step(
        self,
        name: str,
        status: str = "completed",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record non-sensitive lifecycle metadata without storing reasoning."""
        self.steps.append(
            AgentStep(
                name=name,
                status=status,
                metadata=metadata or {},
            )
        )