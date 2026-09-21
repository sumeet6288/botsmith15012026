"""Initial BotSmith tools. More tools can be registered later without changing the runtime."""
from __future__ import annotations

from typing import Any, Dict, Optional

from .models import RiskLevel, ToolResult
from .tool_base import AgentTool


class SearchKnowledgeTool(AgentTool):
    name = "search_knowledge"
    description = "Search the chatbot's private organization knowledge base for factual information."
    risk_level = RiskLevel.LOW
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "minLength": 1, "maxLength": 2000},
            "top_k": {"type": "integer", "minimum": 1, "maximum": 5},
        },
        "required": ["query"],
        "additionalProperties": False,
    }

    def __init__(self, rag_service, chatbot_id: str) -> None:
        self.rag_service = rag_service
        self.chatbot_id = chatbot_id

    async def execute(self, *, tenant_id: str, arguments: Dict[str, Any]) -> ToolResult:
        query = str(arguments.get("query", "")).strip()
        if not query:
            return ToolResult(tool_call_id="", tool_name=self.name, success=False, error="Query is required")
        try:
            top_k = int(arguments.get("top_k", 3))
        except (TypeError, ValueError):
            top_k = 3
        top_k = max(1, min(top_k, 5))
        result = await self.rag_service.retrieve_relevant_context(
            query=query,
            chatbot_id=self.chatbot_id,
            top_k=top_k,
            min_similarity=0.4,
        )
        return ToolResult(tool_call_id="", tool_name=self.name, success=True, output=result)


class CaptureLeadTool(AgentTool):
    name = "capture_lead"
    description = "Store a lead when concrete name and phone contact details are available."
    risk_level = RiskLevel.MEDIUM
    input_schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "minLength": 2, "maxLength": 80},
            "phone": {"type": "string", "minLength": 10, "maxLength": 20},
            "inquiry": {"type": "string", "maxLength": 1000},
            "intent": {"type": "string", "maxLength": 100},
        },
        "required": ["name", "phone"],
        "additionalProperties": False,
    }

    def __init__(self, lead_service, chatbot_id: str, conversation_id: Optional[str]) -> None:
        self.lead_service = lead_service
        self.chatbot_id = chatbot_id
        self.conversation_id = conversation_id

    async def execute(self, *, tenant_id: str, arguments: Dict[str, Any]) -> ToolResult:
        name = str(arguments.get("name", "")).strip()
        phone = str(arguments.get("phone", "")).strip()
        if not name or not phone:
            return ToolResult(tool_call_id="", tool_name=self.name, success=False, error="Name and phone are required")
        result = await self.lead_service.capture_lead(
            owner_user_id=tenant_id,
            chatbot_id=self.chatbot_id,
            conversation_id=self.conversation_id,
            name=name,
            contact=phone,
            inquiry=str(arguments.get("inquiry", ""))[:1000],
            intent=str(arguments.get("intent", "agent"))[:100],
        )
        if result is None:
            return ToolResult(tool_call_id="", tool_name=self.name, success=False, error="Lead limit reached")
        return ToolResult(tool_call_id="", tool_name=self.name, success=True, output=result)
