"""Initial bounded planning interface.

The existing AgentService remains the owner of provider-backed intent planning.
This planner validates the runtime hand-off and detects explicit scheduling
requests that can be handled by Calendly tools.
"""

import re

from .context import AgentContext
from .models import PlanDecision


class Planner:
    """Produce a single safe planning decision for the runtime."""

    _SCHEDULING_PATTERNS = (
        r"\bbook\b",
        r"\bschedule\b",
        r"\bscheduling\b",
        r"\bappointment\b",
        r"\bmeeting\b",
        r"\bcall\b.*\b(schedule|book|set up)\b",
        r"\bset up\b.*\b(meeting|call|appointment)\b",
    )

    @classmethod
    def _is_scheduling_request(cls, task: str) -> bool:
        """Return True only for reasonably explicit scheduling requests."""
        normalized = " ".join(task.lower().split())

        return any(
            re.search(pattern, normalized)
            for pattern in cls._SCHEDULING_PATTERNS
        )

    @classmethod
    def decide(cls, context: AgentContext) -> PlanDecision:
        if not context.user_task:
            return PlanDecision(
                action="stop",
                reason="empty user task",
            )

        if cls._is_scheduling_request(context.user_task):
            return PlanDecision(
                action="tool",
                tool_name="calendly_get_event_types",
                arguments={"count": 20},
                tool_calls=1,
                reason="explicit scheduling request",
            )

        return PlanDecision(
            action="delegate",
            tool_calls=0,
            reason="use existing BotSmith agent service",
        )