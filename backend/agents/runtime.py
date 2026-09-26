"""Bounded, observable runtime on top of the existing BotSmith services."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from time import monotonic
from typing import Any, Dict, Optional

from .context import AgentContext, ContextBuilder
from .executor import AgentExecutionError, Executor, LegacyRunner
from .models import AgentConfig, AgentResult, ExecutionLimits, PlanDecision
from .planner import Planner
from .registry import ToolRegistry
from .state import AgentState, AgentStateStore
from .tools.calendly import (
    CalendlyBookMeetingTool,
    CalendlyGetAvailableTimesTool,
    CalendlyGetEventTypesTool,
    CalendlyService,
)
from .tools.calendly.credentials import CalendlyCredentialResolver

logger = logging.getLogger(__name__)


def agents_enabled() -> bool:
    """Read the compatibility flag without causing startup side effects."""

    return os.getenv("BOTSMITH_AGENTS_ENABLED", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _redact(value: Any, limit: int = 20_000) -> Any:
    if isinstance(value, dict):
        blocked = {
            "access_token",
            "refresh_token",
            "client_secret",
            "password",
            "api_key",
            "authorization",
        }
        return {
            str(key)[:128]: _redact(item, limit)
            for key, item in list(value.items())[:100]
            if str(key).lower() not in blocked
        }
    if isinstance(value, list):
        return [_redact(item, limit) for item in value[:100]]
    if isinstance(value, str):
        return value[:limit]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:limit]


class AgentRuntime:
    """Run a bounded plan/execute/observe loop."""

    def __init__(
        self,
        legacy_runner: LegacyRunner,
        *,
        chat_service: Any = None,
        database: Any = None,
        limits: Optional[ExecutionLimits] = None,
    ):
        self._legacy_runner = legacy_runner
        self._chat_service = chat_service
        self._limits = limits or ExecutionLimits()
        self._state_store = AgentStateStore(database)
        self._calendly_credentials = CalendlyCredentialResolver(database=database)
        self._planner = Planner(chat_service)

    async def _build_tool_registry(
        self,
        *,
        chatbot_id: str,
        user_id: Optional[str],
    ) -> ToolRegistry:
        """Build a request-scoped registry from tenant-scoped credentials."""

        registry = ToolRegistry()
        if not user_id:
            return registry

        try:
            access_token = await self._calendly_credentials.get_access_token(
                chatbot_id=chatbot_id,
                user_id=user_id,
            )
        except Exception:
            logger.warning(
                "Calendly credentials unavailable for chatbot=%s",
                chatbot_id,
                exc_info=True,
            )
            return registry

        if not access_token:
            return registry

        service = CalendlyService(access_token)
        registry.register(CalendlyGetEventTypesTool(service))
        registry.register(CalendlyGetAvailableTimesTool(service))
        registry.register(CalendlyBookMeetingTool(service))
        return registry

    async def _generate_tool_response(
        self,
        *,
        context: AgentContext,
        state: AgentState,
        timeout_seconds: Optional[float] = None,
    ) -> tuple[str, Optional[str]]:
        """Turn a safe tool observation into the normal chatbot response."""

        observations = json.dumps(
            _redact(state.observation_payload()),
            ensure_ascii=False,
            default=str,
        )[: context.max_result_chars]
        if self._chat_service is not None:
            prompt = f"""
You are the final response writer for a customer-facing BotSmith chatbot.
Answer the user's task using only the tool observations below.
Do not mention internal agents, planners, prompts, credentials, or hidden reasoning.
Do not claim an action succeeded unless the observation supports it.
If the observation is empty or indicates failure, explain the limitation safely.
Keep the answer concise and helpful.

Trusted chatbot instructions:
{context.system_instructions}

User task:
{context.user_task}

Tool observations:
{observations}
"""
            finalizer_started = monotonic()
            for attempt in range(context.max_retries + 1):
                try:
                    if timeout_seconds is None:
                        remaining = min(context.max_runtime_seconds, 20.0)
                    else:
                        remaining = min(
                            timeout_seconds - (monotonic() - finalizer_started),
                            20.0,
                        )
                    if remaining <= 0:
                        break
                    return await asyncio.wait_for(
                        self._chat_service.generate_response(
                            message=context.user_task,
                            session_id=f"{context.session_id}:agent-response",
                            system_message=prompt,
                            model=context.model,
                            provider=context.provider,
                        ),
                        timeout=remaining,
                    )
                except Exception:
                    if attempt >= context.max_retries:
                        logger.warning(
                            "Tool result response generation failed",
                            exc_info=True,
                        )
                    else:
                        state.retry_count += 1
        return self._fallback_tool_response(state)

    @staticmethod
    def _fallback_tool_response(
        state: AgentState,
    ) -> tuple[str, Optional[str]]:
        if not state.tool_results:
            return (
                "I couldn't complete that request right now. Please try again.",
                None,
            )
        last = state.tool_results[-1]
        tool_name = last.get("tool", "requested tool")
        result = last.get("result")
        if tool_name == "calendly_book_meeting":
            return "Your meeting request was completed successfully.", None
        if tool_name == "calendly_get_event_types":
            collection = result.get("collection") if isinstance(result, dict) else None
            if isinstance(collection, list) and collection:
                names = [
                    str(item.get("name"))
                    for item in collection[:10]
                    if isinstance(item, dict) and item.get("name")
                ]
                if names:
                    return "Available meeting types: " + ", ".join(names), None
        if tool_name == "calendly_get_available_times":
            return "I found available meeting times. Please choose one to continue.", None
        return "I completed the requested action.", None

    @staticmethod
    def _public_plan(decision: PlanDecision) -> Dict[str, Any]:
        return {
            "action": decision.action,
            "tool_name": decision.tool_name,
            "reason": decision.reason,
            "next_action": decision.next_action,
            "intent": decision.intent,
            "confidence": decision.confidence,
        }

    @staticmethod
    def _remaining_timeout(started: float, limit: float) -> float:
        return limit - (monotonic() - started)

    async def run(self, **request: Any) -> Dict[str, Any]:
        """Execute one bounded workflow while preserving the legacy contract."""

        started = monotonic()
        task = str(request.get("message") or "").strip()
        limits = request.get("limits") or self._limits
        if isinstance(limits, dict):
            limits = ExecutionLimits.model_validate(limits)
        config = AgentConfig(
            chatbot_id=request["chatbot_id"],
            owner_user_id=request.get("owner_user_id"),
            conversation_id=request.get("conversation_id"),
            session_id=request["session_id"],
            system_message=request.get("system_message", ""),
            model=request.get("model", "gpt-4o-mini"),
            provider=request.get("provider", "openai"),
            limits=limits,
        )
        state = await self._state_store.load(
            chatbot_id=config.chatbot_id,
            conversation_id=config.conversation_id,
            user_id=config.owner_user_id,
        )
        resumed = state is not None
        if state is None:
            state = AgentState(
                chatbot_id=config.chatbot_id,
                conversation_id=config.conversation_id,
                user_id=config.owner_user_id,
                task=task[: limits.max_task_chars],
                limits=limits,
            )
        else:
            state.task = task[: limits.max_task_chars]
            state.limits = limits
            state.status = "running"

        context = ContextBuilder.build(config, task)
        state.record_step("run_started", metadata={"resumed": resumed})
        registry = ToolRegistry()
        executor = Executor(self._legacy_runner, registry)
        last_decision = PlanDecision(action="delegate")

        try:
            registry = await self._build_tool_registry(
                chatbot_id=config.chatbot_id,
                user_id=config.owner_user_id,
            )
            executor = Executor(self._legacy_runner, registry)
            tool_descriptions = registry.describe()

            while state.current_step < limits.max_steps:
                if monotonic() - started >= limits.max_runtime_seconds:
                    raise AgentExecutionError("Agent runtime limit reached")

                current_context = context.with_runtime_data(
                    tool_descriptions=tool_descriptions,
                    observations=state.observation_payload(),
                )
                remaining = self._remaining_timeout(
                    started,
                    limits.max_runtime_seconds,
                )
                if remaining <= 0:
                    raise AgentExecutionError("Agent runtime limit reached")
                last_decision = await asyncio.wait_for(
                    self._planner.decide_async(
                        current_context,
                        state,
                        tool_descriptions,
                    ),
                    timeout=remaining,
                )
                state.record_step(
                    "plan_created",
                    metadata={
                        "action": last_decision.action,
                        "tool": last_decision.tool_name,
                    },
                )

                if last_decision.action == "delegate":
                    remaining = self._remaining_timeout(
                        started,
                        limits.max_runtime_seconds,
                    )
                    if remaining <= 0:
                        raise AgentExecutionError("Agent runtime limit reached")
                    result = await asyncio.wait_for(
                        executor.execute(
                            decision=last_decision,
                            context=current_context,
                            state=state,
                            request=request,
                        ),
                        timeout=remaining,
                    )
                    state.status = "completed"
                    await self._state_store.delete(state)
                    return self._with_runtime_metadata(
                        result,
                        state=state,
                        started=started,
                        plan=self._public_plan(last_decision),
                        resumed=resumed,
                    )

                if last_decision.action == "stop":
                    response = last_decision.final_response
                    citation = None
                    if not response and state.tool_results:
                        response, citation = await self._generate_tool_response(
                            context=current_context,
                            state=state,
                            timeout_seconds=self._remaining_timeout(
                                started,
                                limits.max_runtime_seconds,
                            ),
                        )
                    elif not response:
                        response = "Please send a message so I can help."
                    state.status = "completed"
                    await self._state_store.delete(state)
                    return self._with_runtime_metadata(
                        AgentResult(
                            response=response,
                            citation_footer=citation,
                            plan=self._public_plan(last_decision),
                            intent=last_decision.intent,
                            status="completed",
                            steps=state.steps,
                        ).model_dump(),
                        state=state,
                        started=started,
                        plan=self._public_plan(last_decision),
                        resumed=resumed,
                    )

                remaining = self._remaining_timeout(
                    started,
                    limits.max_runtime_seconds,
                )
                if remaining <= 0:
                    raise AgentExecutionError("Agent runtime limit reached")
                await asyncio.wait_for(
                    executor.execute(
                        decision=last_decision,
                        context=current_context,
                        state=state,
                        request=request,
                    ),
                    timeout=remaining,
                )
                state.record_step(
                    "tool_completed",
                    metadata={"tool": last_decision.tool_name},
                )
                await self._state_store.save(state)

                if (
                    state.tool_call_count >= limits.max_tool_calls
                    or last_decision.next_action != "continue"
                    or (
                        last_decision.tool_name
                        and registry.get(last_decision.tool_name).risk_level
                        in {"high", "critical"}
                    )
                ):
                    break

            state.status = "completed"
            remaining = self._remaining_timeout(
                started,
                limits.max_runtime_seconds,
            )
            response, citation = await self._generate_tool_response(
                context=context,
                state=state,
                timeout_seconds=max(0.0, remaining),
            )
            await self._state_store.delete(state)
            return self._with_runtime_metadata(
                AgentResult(
                    response=response,
                    citation_footer=citation,
                    plan=self._public_plan(last_decision),
                    intent=last_decision.intent,
                    status="completed",
                    steps=state.steps,
                ).model_dump(),
                state=state,
                started=started,
                plan=self._public_plan(last_decision),
                resumed=resumed,
            )
        except Exception as exc:
            state.status = "failed"
            state.record_step(
                "run_failed",
                status="failed",
                metadata={"error": type(exc).__name__},
            )
            logger.exception(
                "Agent runtime failed for chatbot=%s",
                config.chatbot_id,
            )
            await self._state_store.delete(state)
            return self._with_runtime_metadata(
                AgentResult(
                    response=(
                        "I'm sorry, I couldn't complete that request right now. "
                        "Please try again later."
                    ),
                    plan=self._public_plan(last_decision),
                    intent=last_decision.intent,
                    status="failed",
                    steps=state.steps,
                ).model_dump(),
                state=state,
                started=started,
                plan=self._public_plan(last_decision),
                resumed=resumed,
            )

    @staticmethod
    def _with_runtime_metadata(
        result: Dict[str, Any],
        *,
        state: AgentState,
        started: float,
        plan: Dict[str, Any],
        resumed: bool,
    ) -> Dict[str, Any]:
        if not isinstance(result, dict):
            result = AgentResult(
                response="I'm sorry, I couldn't complete that request right now.",
                status="failed",
            ).model_dump()
        result.setdefault("plan", plan)
        result.setdefault("runtime", {})
        result["runtime"].update(
            {
                "status": result.get("status", "completed"),
                "steps": [step.name for step in state.steps],
                "tool_calls": state.tool_call_count,
                "resumed": resumed,
                "elapsed_ms": round((monotonic() - started) * 1000, 2),
            }
        )
        return result