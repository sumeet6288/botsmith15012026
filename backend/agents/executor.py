"""Security boundary between planner decisions and real actions."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Optional

from .context import AgentContext
from .models import PlanDecision
from .registry import ToolRegistry, ToolRegistryError
from .state import AgentState

LegacyRunner = Callable[..., Awaitable[Dict[str, Any]]]


class AgentExecutionError(RuntimeError):
    """Safe normalized error from an agent action."""


class Executor:
    """Execute only validated decisions and explicitly registered tools."""

    def __init__(
        self,
        legacy_runner: LegacyRunner,
        tool_registry: Optional[ToolRegistry] = None,
    ):
        self._legacy_runner = legacy_runner
        self._tool_registry = tool_registry

    async def execute(
        self,
        *,
        decision: PlanDecision,
        context: AgentContext,
        state: AgentState,
        request: Dict[str, Any],
    ) -> Dict[str, Any]:
        if decision.action == "stop":
            return {
                "response": decision.final_response
                or "Please send a message so I can help.",
                "status": "completed",
            }

        if decision.action == "delegate":
            result = await self._legacy_runner(**request)
            if not isinstance(result, dict):
                raise AgentExecutionError(
                    "Existing BotSmith agent returned an invalid result"
                )
            return result

        if decision.action != "tool" or not decision.tool_name:
            raise AgentExecutionError("Invalid planner action")
        if self._tool_registry is None:
            raise AgentExecutionError("No tools are available for this request")
        if state.tool_call_count >= state.limits.max_tool_calls:
            raise AgentExecutionError("Agent tool-call limit reached")

        try:
            result = await self._tool_registry.execute(
                decision.tool_name,
                decision.arguments or {},
            )
        except ToolRegistryError as exc:
            raise AgentExecutionError(str(exc)) from exc
        except Exception as exc:
            raise AgentExecutionError(
                f"Tool {decision.tool_name} failed"
            ) from exc

        state.record_tool_result(decision.tool_name, result)
        state.pending_action = decision.next_action
        return {
            "response": "",
            "status": "completed",
            "tool_result": result,
            "tool_name": decision.tool_name,
        }