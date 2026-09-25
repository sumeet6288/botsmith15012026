"""Initial bounded planning interface.

The existing AgentService remains the owner of provider-backed intent planning.
This planner only validates the runtime hand-off and deliberately does not
make another model call.
"""

from .context import AgentContext
from .models import PlanDecision


class Planner:
    """Produce a single safe delegation decision for phase one."""

    @staticmethod
    def decide(context: AgentContext) -> PlanDecision:
        if not context.user_task:
            return PlanDecision(
                action="stop",
                reason="empty user task",
            )

        return PlanDecision(
            action="delegate",
            tool_calls=0,
            reason="use existing BotSmith agent service",
        )