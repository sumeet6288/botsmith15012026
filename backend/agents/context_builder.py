"""Builds the bounded context sent to the planner."""
from __future__ import annotations

from typing import Any, Dict

from .models import AgentContext


class ContextBuilder:
    def build(self, context: AgentContext) -> Dict[str, Any]:
        return {
            "agent": {
                "name": context.agent.name,
                "goal": context.agent.goal,
                "system_prompt": context.agent.system_prompt,
            },
            "task": {
                "goal": context.task.goal,
                "input_context": context.task.input_context,
                "current_step": context.task.current_step,
            },
            "conversation": context.conversation[-12:],
            "observations": context.observations[-8:],
            "memories": context.memories[-10:],
            "available_tools": context.available_tools,
        }
