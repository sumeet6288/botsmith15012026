"""Safe execution boundary for agent actions."""
from __future__ import annotations

from .models import AgentDefinition, ToolCall, ToolResult
from .policy_engine import PolicyEngine
from .tool_registry import ToolRegistry


class ToolExecutor:
    def __init__(self, registry: ToolRegistry, policy_engine: PolicyEngine) -> None:
        self.registry = registry
        self.policy_engine = policy_engine

    async def execute(self, *, tenant_id: str, agent: AgentDefinition, call: ToolCall) -> ToolResult:
        policy = self.policy_engine.authorize(agent=agent, call=call)
        if not policy.allowed:
            return ToolResult(
                tool_call_id=call.id,
                tool_name=call.tool_name,
                success=False,
                error=policy.reason,
            )

        tool = self.registry.get(call.tool_name)
        try:
            result = await tool.execute(tenant_id=tenant_id, arguments=call.arguments)
            if not result.tool_call_id:
                result.tool_call_id = call.id
            return result
        except Exception as exc:
            return ToolResult(
                tool_call_id=call.id,
                tool_name=call.tool_name,
                success=False,
                error=f"Tool execution failed: {exc}",
            )
