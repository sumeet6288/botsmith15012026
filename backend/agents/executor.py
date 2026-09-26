"""Execution adapter for the existing BotSmith agent service."""

from typing import Any, Awaitable, Callable, Dict, Optional

from .context import AgentContext
from .models import PlanDecision
from .registry import ToolRegistry
from .state import AgentState


LegacyRunner = Callable[..., Awaitable[Dict[str, Any]]]


class Executor:
    """Execute only validated runtime decisions."""

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
                "response": "Please send a message so I can help.",
                "status": "completed",
            }

        if decision.action == "tool":
            if not decision.tool_name:
                raise ValueError("Tool name is required for a tool decision")

            # If the requested tool is not registered, fall back to the
            # existing BotSmith agent instead of crashing the runtime.
            if self._tool_registry is None:
                return await self._legacy_runner(**request)

            try:
                tool = self._tool_registry.get(decision.tool_name)
            except KeyError:
                return await self._legacy_runner(**request)

            arguments = decision.arguments or {}

            if not self._tool_registry.validate(
                decision.tool_name,
                arguments,
            ):
                raise ValueError(
                    f"Invalid arguments for tool: {decision.tool_name}"
                )

            # If tool execution fails, fall back to the existing BotSmith
            # agent instead of allowing the runtime to return a generic error.
            try:
                result = await tool.execute(arguments)
            except Exception:
                return await self._legacy_runner(**request)

            if not isinstance(result, dict):
                raise TypeError(
                    f"Tool {decision.tool_name} returned an invalid result"
                )

            state.tool_results.append(
                {
                    "tool": decision.tool_name,
                    "result": result,
                }
            )

            return {
                "response": "",
                "status": "completed",
                "tool_result": result,
                "tool_name": decision.tool_name,
            }

        # The runner is an internal callable, never model-generated text.
        result = await self._legacy_runner(**request)

        if not isinstance(result, dict):
            raise TypeError("Existing agent service returned an invalid result")

        return result
