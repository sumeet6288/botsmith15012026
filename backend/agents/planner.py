"""Bounded planner for safe tool selection and legacy delegation."""

from __future__ import annotations

import json
import logging
import re
import asyncio
from typing import Any, Dict, Iterable, Optional

from .context import AgentContext
from .models import PlanDecision
from .state import AgentState

logger = logging.getLogger(__name__)


class Planner:
    """Produce structured decisions without executing any action."""

    _SCHEDULING_PATTERNS = (
        r"\bbook\b",
        r"\bschedule\b",
        r"\bscheduling\b",
        r"\bappointment\b",
        r"\bmeeting\b",
        r"\bcall\b.*\b(schedule|book|set up)\b",
        r"\bset up\b.*\b(meeting|call|appointment)\b",
    )

    def __init__(self, chat_service: Any = None):
        self._chat_service = chat_service

    @classmethod
    def _is_scheduling_request(cls, task: str) -> bool:
        normalized = " ".join((task or "").lower().split())
        return any(re.search(pattern, normalized) for pattern in cls._SCHEDULING_PATTERNS)

    @staticmethod
    def _tool_names(tools: Iterable[Dict[str, Any]]) -> set[str]:
        return {
            str(item.get("name"))
            for item in tools
            if isinstance(item, dict) and item.get("name")
        }

    @classmethod
    def decide(
        cls,
        context: AgentContext,
        available_tools: Optional[Iterable[Dict[str, Any]]] = None,
    ) -> PlanDecision:
        """Deterministic fallback used when the model is unavailable."""

        tools = list(available_tools or context.tool_descriptions)
        names = cls._tool_names(tools)
        if not context.user_task:
            return PlanDecision(
                action="stop",
                reason="empty user task",
                final_response="Please send a message so I can help.",
            )

        if (
            cls._is_scheduling_request(context.user_task)
            and "calendly_get_event_types" in names
        ):
            return PlanDecision(
                action="tool",
                tool_name="calendly_get_event_types",
                arguments={"count": 20},
                tool_calls=1,
                next_action="continue",
                intent="scheduling",
                confidence=0.9,
                reason="explicit scheduling request",
            )

        return PlanDecision(
            action="delegate",
            next_action="delegate",
            intent="general",
            reason="use existing BotSmith agent service",
        )

    async def decide_async(
        self,
        context: AgentContext,
        state: AgentState,
        available_tools: Optional[Iterable[Dict[str, Any]]] = None,
    ) -> PlanDecision:
        """Ask the existing ChatService for a decision, with safe fallback."""

        tools = list(available_tools or context.tool_descriptions)
        fallback = self.decide(context, tools)
        if self._chat_service is None:
            if state.tool_results:
                return PlanDecision(
                    action="stop",
                    intent="tool_result",
                    reason="tool result is ready for the user",
                )
            return fallback

        tool_text = json.dumps(tools, ensure_ascii=False, default=str)[:20_000]
        observations = json.dumps(
            state.observation_payload(),
            ensure_ascii=False,
            default=str,
        )[: context.max_result_chars]
        prompt = f"""
You are BotSmith's internal action planner. Return ONLY one JSON object.
You may select only a tool from the registered tool list below.
Never output Python, code, shell commands, imports, credentials, or hidden reasoning.
The action must be one of: delegate, tool, stop.

Required JSON shape:
{{
  "action": "delegate",
  "tool_name": null,
  "arguments": {{}},
  "reason": "short reason",
  "next_action": "continue",
  "final_response": null,
  "intent": "short intent",
  "confidence": 0.0
}}

Use "delegate" for ordinary BotSmith conversation, RAG, lead handling, and
questions that do not require one of the registered tools.
Use "tool" only when a registered tool is needed and all currently known
arguments are valid. Use "stop" when the task is complete or a safe final
answer can be returned. Never invent missing arguments.

REGISTERED TOOLS:
{tool_text or "(none)"}

OBSERVED TOOL RESULTS:
{observations or "(none)"}

USER TASK:
{context.user_task}
"""
        try:
            raw, _ = await asyncio.wait_for(
                self._chat_service.generate_response(
                    message=context.user_task,
                    session_id=f"{context.session_id}:agent-planner",
                    system_message=prompt,
                    model=context.model,
                    provider=context.provider,
                ),
                timeout=min(context.max_runtime_seconds, 20.0),
            )
            parsed = self._parse_json(raw)
            if parsed is None:
                return fallback
            decision = self._normalize(parsed)
            if decision.action == "tool" and decision.tool_name not in self._tool_names(tools):
                return fallback
            if decision.action == "tool" and not decision.tool_name:
                return fallback
            return decision
        except Exception:
            logger.warning("Agent planner model call failed; using fallback", exc_info=True)
            return fallback

    @staticmethod
    def _parse_json(raw: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(raw, str):
            return None
        text = raw.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
            text = re.sub(r"\s*```$", "", text)
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            start, end = text.find("{"), text.rfind("}")
            if start < 0 or end <= start:
                return None
            try:
                parsed = json.loads(text[start : end + 1])
                return parsed if isinstance(parsed, dict) else None
            except json.JSONDecodeError:
                return None

    @staticmethod
    def _normalize(parsed: Dict[str, Any]) -> PlanDecision:
        action = str(parsed.get("action", "delegate")).lower()
        if action not in {"delegate", "tool", "stop"}:
            action = "delegate"
        next_action = str(parsed.get("next_action", "finish")).lower()
        if next_action not in {"continue", "finish", "delegate"}:
            next_action = "finish"
        arguments = parsed.get("arguments")
        if not isinstance(arguments, dict):
            arguments = {}
        try:
            confidence = float(parsed.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5
        return PlanDecision(
            action=action,
            tool_calls=max(0, int(parsed.get("tool_calls", 1 if action == "tool" else 0))),
            tool_name=parsed.get("tool_name"),
            arguments=arguments,
            reason=str(parsed.get("reason", ""))[:1_000],
            next_action=next_action,
            final_response=parsed.get("final_response"),
            intent=str(parsed.get("intent", "unknown"))[:128],
            confidence=max(0.0, min(1.0, confidence)),
        )