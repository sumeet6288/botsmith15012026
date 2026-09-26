"""Registry foundation for future structured tools."""

from typing import Dict, List

from .tools.base import Tool


class ToolRegistry:
    """Register and validate explicit tool implementations only."""

    def __init__(self):
        self._tools: Dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"Tool already registered: {tool.name}")
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool:
        try:
            return self._tools[name]
        except KeyError as exc:
            raise KeyError(f"Unknown tool: {name}") from exc

    def list(self) -> List[Tool]:
        return list(self._tools.values())

    def validate(self, name: str, arguments: dict) -> bool:
        tool = self.get(name)
        return tool.validate_input(arguments)