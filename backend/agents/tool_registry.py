"""Tool registration and lookup."""
from __future__ import annotations

from typing import Dict, Iterable, List

from .tool_base import AgentTool


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, AgentTool] = {}

    def register(self, tool: AgentTool) -> None:
        if not tool.name:
            raise ValueError("Agent tool name cannot be empty")
        if tool.name in self._tools:
            raise ValueError(f"Agent tool already registered: {tool.name}")
        self._tools[tool.name] = tool

    def register_many(self, tools: Iterable[AgentTool]) -> None:
        for tool in tools:
            self.register(tool)

    def get(self, name: str) -> AgentTool:
        if name not in self._tools:
            raise KeyError(f"Unknown agent tool: {name}")
        return self._tools[name]

    def has(self, name: str) -> bool:
        return name in self._tools

    def definitions(self, allowed_names: List[str]) -> List[Dict]:
        return [self._tools[name].definition() for name in allowed_names if name in self._tools]
