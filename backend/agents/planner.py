"""LLM planner using BotSmith's existing ChatService."""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

from .context_builder import ContextBuilder
from .models import AgentContext, AgentDecision, RiskLevel, ToolCall

logger = logging.getLogger(__name__)


class ChatServiceDecisionProvider:
    def __init__(self, chat_service) -> None:
        self.chat_service = chat_service

    async def decide(self, *, context: Dict[str, Any], model: str, provider: str, session_id: str) -> AgentDecision:
        tools = context.get("available_tools", [])
        tool_names = [tool.get("name") for tool in tools]
        prompt = f"""
You are the decision-making brain of a bounded customer-support agent.
You are NOT the final answer writer. Decide the next action only.

AVAILABLE ACTIONS:
- search_knowledge: retrieve organization-specific information from the private knowledge base.
- capture_lead: save a lead only when the user has supplied enough concrete contact information.
- answer: finish and provide the user-facing answer.

AVAILABLE TOOLS:
{json.dumps(tools, ensure_ascii=False)}

IMPORTANT:
- Organization-specific facts must come from search_knowledge.
- Never invent organization-specific facts.
- If knowledge evidence is missing or weak, search_knowledge again with a better query.
- You may use at most one tool in this step.
- Never request a tool that is not in AVAILABLE TOOLS.
- Never reveal internal reasoning.
- The final answer must be written later by a separate answer stage.

CURRENT AGENT CONTEXT:
{json.dumps(context, ensure_ascii=False, default=str)}

Return ONLY valid JSON:
{{
  "action": "search_knowledge|capture_lead|answer",
  "final_answer": null,
  "tool_call": null,
  "next_goal": "short statement of what must happen next",
  "confidence": 0.0
}}

If using a tool, tool_call must be:
{{
  "tool_name": "search_knowledge",
  "arguments": {{}},
  "risk_level": "low"
}}
"""
        raw, _ = await self.chat_service.generate_response(
            message="Decide the next agent action.",
            session_id=session_id,
            system_message=prompt,
            model=model,
            provider=provider,
        )
        return self._parse(raw, tool_names)

    @staticmethod
    def _parse(raw: str, allowed_tools: list[str]) -> AgentDecision:
        data = None
        try:
            data = json.loads((raw or "").strip())
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw or "", re.S)
            if match:
                try:
                    data = json.loads(match.group(0))
                except json.JSONDecodeError:
                    data = None

        if not isinstance(data, dict):
            return AgentDecision(action="answer", confidence=0.0)

        action = str(data.get("action", "answer")).lower()
        if action not in {"search_knowledge", "capture_lead", "answer"}:
            action = "answer"

        tool_call = None
        raw_call = data.get("tool_call")
        if action != "answer" and isinstance(raw_call, dict):
            name = str(raw_call.get("tool_name", ""))
            if name in allowed_tools:
                risk = str(raw_call.get("risk_level", "low")).lower()
                if risk not in {level.value for level in RiskLevel}:
                    risk = RiskLevel.LOW.value
                arguments = raw_call.get("arguments")
                if not isinstance(arguments, dict):
                    arguments = {}
                tool_call = ToolCall(
                    tool_name=name,
                    arguments=arguments,
                    risk_level=risk,
                )
            else:
                action = "answer"

        try:
            confidence = max(0.0, min(1.0, float(data.get("confidence", 0.5))))
        except (TypeError, ValueError):
            confidence = 0.5

        return AgentDecision(
            action=action,
            final_answer=data.get("final_answer"),
            tool_call=tool_call,
            next_goal=str(data.get("next_goal", "")),
            confidence=confidence,
        )


class AgentPlanner:
    def __init__(self, provider: ChatServiceDecisionProvider, context_builder: Optional[ContextBuilder] = None) -> None:
        self.provider = provider
        self.context_builder = context_builder or ContextBuilder()

    async def plan(self, *, context: AgentContext, model: str, provider: str, session_id: str) -> AgentDecision:
        payload = self.context_builder.build(context)
        return await self.provider.decide(
            context=payload,
            model=model,
            provider=provider,
            session_id=session_id,
        )
