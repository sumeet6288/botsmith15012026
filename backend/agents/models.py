"""Domain models for BotSmith's bounded agent runtime."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_HUMAN = "needs_human"


class RunStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_HUMAN = "needs_human"


class ToolCall(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.LOW


class ToolResult(BaseModel):
    tool_call_id: str
    tool_name: str
    success: bool
    output: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    tenant_id: str
    chatbot_id: str
    name: str
    description: str = ""
    system_prompt: str = ""
    goal: str = ""
    tool_names: List[str] = Field(default_factory=list)
    max_steps: int = Field(default=4, ge=1, le=8)


class AgentTask(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    agent_id: str
    chatbot_id: str
    conversation_id: Optional[str] = None
    session_id: str
    goal: str
    input_context: Dict[str, Any] = Field(default_factory=dict)
    status: TaskStatus = TaskStatus.RUNNING
    current_step: int = 0
    max_steps: int = Field(default=4, ge=1, le=8)
    result: Any = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class AgentRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    agent_id: str
    task_id: str
    status: RunStatus = RunStatus.RUNNING
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: Optional[datetime] = None
    step_count: int = 0
    tool_call_count: int = 0
    final_output: Any = None
    error: Optional[str] = None


class AgentStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    run_id: str
    step_number: int
    action: str
    tool_call: Optional[ToolCall] = None
    tool_result: Optional[ToolResult] = None
    observation: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=utcnow)


class AgentDecision(BaseModel):
    """Strict normalized decision produced by the planner model."""

    action: str = "answer"
    final_answer: Optional[str] = None
    tool_call: Optional[ToolCall] = None
    next_goal: Optional[str] = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class AgentContext(BaseModel):
    tenant_id: str
    agent: AgentDefinition
    task: AgentTask
    run: AgentRun
    conversation: List[Dict[str, Any]] = Field(default_factory=list)
    observations: List[Dict[str, Any]] = Field(default_factory=list)
    memories: List[Dict[str, Any]] = Field(default_factory=list)
    available_tools: List[Dict[str, Any]] = Field(default_factory=list)
