"""Execution adapter for the existing BotSmith agent service."""

from typing import Any, Awaitable, Callable, Dict

from .context import AgentContext
from .models import PlanDecision
from .state import AgentState


LegacyRunner = Callable[..., Awaitable[Dict[str, Any]]]


class Executor:
    """Execute only validated runtime decisions."""

    def __init__(self, legacy_runner: LegacyRunner):
        self._legacy_runner = legacy_runner

    async def execute(
        self,
        *,
        decision: PlanDecision,
        context: AgentContext,
        state: AgentState,
        request: Dict[str, Any],
    ) -> Dict[str, Any]:
        if decision.action != "delegate":
            return {
                "response": "Please send a message so I can help.",
                "status": "completed",
            }

        # The runner is an internal callable, never model-generated text.
        result = await self._legacy_runner(**request)
        if not isinstance(result, dict):
            raise TypeError("Existing agent service returned an invalid result")
        return result