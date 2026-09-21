"""Deterministic policy gate between the planner and tools."""
from __future__ import annotations

from dataclasses import dataclass

from .models import AgentDefinition, ToolCall
from .tool_registry import ToolRegistry


@dataclass
class PolicyDecision:
    allowed: bool
    reason: str = ""


class PolicyEngine:
    """Only registered, explicitly enabled tools may execute."""

    def __init__(self, registry: ToolRegistry) -> None:
        self.registry = registry

    def authorize(self, *, agent: AgentDefinition, call: ToolCall) -> PolicyDecision:
        if not self.registry.has(call.tool_name):
            return PolicyDecision(False, "Tool is not registered")
        if call.tool_name not in agent.tool_names:
            return PolicyDecision(False, "Tool is not enabled for this agent")
        tool = self.registry.get(call.tool_name)
        # The model can never lower the registered risk level.
        call.risk_level = tool.risk_level
        if tool.risk_level.value == "critical":
            return PolicyDecision(False, "Critical tools are disabled")
        return PolicyDecision(True)
