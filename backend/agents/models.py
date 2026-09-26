"""Validated models for the bounded BotSmith agent runtime."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ExecutionLimits(BaseModel):
    """Hard limits that prevent an execution from becoming unbounded."""

    max_steps: int = Field(default=6, ge=1, le=20)
    max_tool_calls: int = Field(default=3, ge=0, le=20)
    max_runtime_seconds: float = Field(default=45.0, gt=0, le=300)
    max_retries: int = Field(default=1, ge=0, le=3)
    max_task_chars: int = Field(default=8_000, ge=100, le=50_000)
    max_result_chars: int = Field(default=20_000, ge=1_000, le=100_000)


class AgentConfig(BaseModel):
    """Runtime configuration derived from an existing chatbot request."""

    model_config = ConfigDict(extra="ignore")

    chatbot_id: str = Field(min_length=1, max_length=256)
    owner_user_id: Optional[str] = Field(default=None, max_length=256)
    conversation_id: Optional[str] = Field(default=None, max_length=256)
    session_id: str = Field(min_length=1, max_length=256)
    system_message: str = Field(default="", max_length=30_000)
    model: str = Field(default="gpt-4o-mini", min_length=1, max_length=256)
    provider: str = Field(default="openai", min_length=1, max_length=64)
    limits: ExecutionLimits = Field(default_factory=ExecutionLimits)


class AgentStep(BaseModel):
    """Safe lifecycle metadata; hidden reasoning is intentionally excluded."""

    name: str = Field(min_length=1, max_length=80)
    status: Literal["started", "completed", "failed"] = "started"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PlanDecision(BaseModel):
    """A validated, non-executable planner decision."""

    action: Literal["delegate", "tool", "stop"] = "delegate"
    tool_calls: int = Field(default=0, ge=0)
    tool_name: Optional[str] = Field(default=None, max_length=128)
    arguments: Dict[str, Any] = Field(default_factory=dict)
    reason: str = Field(default="", max_length=1_000)
    next_action: Literal["continue", "finish", "delegate"] = "finish"
    final_response: Optional[str] = Field(default=None, max_length=20_000)
    intent: str = Field(default="unknown", max_length=128)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class AgentResult(BaseModel):
    """Stable response envelope used by the runtime internally."""

    response: str
    citation_footer: Optional[str] = None
    plan: Dict[str, Any] = Field(default_factory=dict)
    lead: Optional[Dict[str, Any]] = None
    lead_captured: bool = False
    used_knowledge: bool = False
    intent: str = "unknown"
    status: Literal["completed", "failed"] = "completed"
    steps: List[AgentStep] = Field(default_factory=list)
    runtime: Dict[str, Any] = Field(default_factory=dict)