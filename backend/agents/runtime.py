"""Bounded runtime that sits underneath the existing BotSmith chatbot."""

import asyncio
import logging
import os
from time import monotonic
from typing import Any, Dict, Optional

from .context import ContextBuilder
from .executor import Executor, LegacyRunner
from .models import AgentConfig, AgentResult, ExecutionLimits
from .planner import Planner
from .state import AgentState

logger = logging.getLogger(__name__)


def agents_enabled() -> bool:
    """Read the compatibility flag without making an irreversible switch."""
    return os.getenv("BOTSMITH_AGENTS_ENABLED", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


class AgentRuntime:
    """Run one bounded request through the existing agent implementation."""

    def __init__(
        self,
        legacy_runner: LegacyRunner,
        limits: Optional[ExecutionLimits] = None,
    ):
        self._executor = Executor(legacy_runner)
        self._limits = limits or ExecutionLimits()

    async def run(self, **request: Any) -> Dict[str, Any]:
        """Build context, make one decision, execute, and return a stable result."""
        started = monotonic()
        task = str(request.get("message") or "").strip()
        config = AgentConfig(
            chatbot_id=request["chatbot_id"],
            owner_user_id=request.get("owner_user_id"),
            conversation_id=request.get("conversation_id"),
            session_id=request["session_id"],
            system_message=request.get("system_message", ""),
            model=request.get("model", "gpt-4o-mini"),
            provider=request.get("provider", "openai"),
            limits=self._limits,
        )
        state = AgentState(
            chatbot_id=config.chatbot_id,
            conversation_id=config.conversation_id,
            user_id=config.owner_user_id,
            task=task,
            limits=config.limits,
        )

        try:
            state.record_step("run_started")
            context = ContextBuilder.build(config, task)
            state.record_step("context_built")
            decision = Planner.decide(context)

            if decision.action == "stop":
                state.status = "completed"
                return AgentResult(
                    response="Please send a message so I can help.",
                    status="completed",
                    steps=state.steps,
                ).model_dump()

            if len(state.steps) >= config.limits.max_steps + 2:
                raise RuntimeError("agent step limit reached")

            state.record_step("model_called")
            result = await asyncio.wait_for(
                self._executor.execute(
                    decision=decision,
                    context=context,
                    state=state,
                    request=request,
                ),
                timeout=config.limits.max_runtime_seconds,
            )
            state.record_step("run_completed")
            state.status = "completed"

            # Preserve the existing response contract and add only safe metadata.
            result.setdefault("runtime", {})
            result["runtime"].update(
                {
                    "status": "completed",
                    "steps": [step.name for step in state.steps],
                    "elapsed_ms": round((monotonic() - started) * 1000, 2),
                }
            )
            return result
        except Exception:
            state.status = "failed"
            state.record_step("run_failed", status="failed")
            logger.exception(
                "Agent runtime failed for chatbot=%s",
                config.chatbot_id,
            )
            return AgentResult(
                response=(
                    "I'm sorry, I'm having trouble processing your request right "
                    "now. Please try again later."
                ),
                status="failed",
                steps=state.steps,
            ).model_dump()