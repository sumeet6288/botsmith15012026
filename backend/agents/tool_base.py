"""Base interface for safe BotSmith agent tools."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

from .models import RiskLevel, ToolResult


class AgentTool(ABC):
    name: str = ""
    description: str = ""
    input_schema: Dict[str, Any] = {"type": "object", "properties": {}, "additionalProperties": False}
    risk_level: RiskLevel = RiskLevel.LOW

    def definition(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
            "risk_level": self.risk_level.value,
        }

    @abstractmethod
    async def execute(self, *, tenant_id: str, arguments: Dict[str, Any]) -> ToolResult:
        raise NotImplementedError
