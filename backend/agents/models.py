"""Validated data models for one bounded agent execution."""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ExecutionLimits(BaseModel):
    """Hard limits that prevent an execution from becoming unbounded."""

    max_steps: int = Field(default=1, ge=1, le=20)
    max_tool_calls: int = Field(default=0, ge=0, le=20)
    max_runtime_seconds: float = Field(default=30.0, gt=0, le=300)
    max_retries: int = Field(default=0, ge=0, le=3)


class AgentConfig(BaseModel):
    """Runtime configuration derived from the existing chatbot request."""

    model_config = ConfigDict(extra="ignore")

    chatbot_id: str = Field(min_length=1)
    owner_user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    session_id: str = Field(min_length=1)
    system_message: str = ""
    model: str = Field(default="gpt-4o-mini", min_length=1)
    provider: str = Field(default="openai", min_length=1)
    limits: ExecutionLimits = Field(default_factory=ExecutionLimits)


class AgentStep(BaseModel):
    """Safe execution metadata; this intentionally excludes hidden reasoning."""

    name: str
    status: Literal["started", "completed", "failed"] = "started"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PlanDecision(BaseModel):
    """Validated decision produced by the initial planner."""

    action: Literal["delegate", "stop"] = "delegate"
    tool_calls: int = Field(default=0, ge=0)
    reason: str = ""


class AgentResult(BaseModel):
    """Stable result envelope used by the runtime internally."""

    response: str
    citation_footer: Optional[str] = None
    plan: Dict[str, Any] = Field(default_factory=dict)
    lead: Optional[Dict[str, Any]] = None
    lead_captured: bool = False
    used_knowledge: bool = False
    intent: str = "unknown"
    status: Literal["completed", "failed"] = "completed"
    steps: List[AgentStep] = Field(default_factory=list)