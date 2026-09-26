"""Deterministic registry for explicitly registered agent tools."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from .tools.base import Tool


class ToolRegistryError(ValueError):
    """Base error for safe tool registry failures."""


class UnknownToolError(ToolRegistryError):
    """Raised when a planner selects a tool that is not registered."""


class InvalidToolArgumentsError(ToolRegistryError):
    """Raised when tool arguments do not match the registered schema."""


class ToolRegistry:
    """Register, inspect, validate, and execute only known tools."""

    def __init__(self):
        self._tools: Dict[str, Tool] = {}

    def register(self, tool: Tool, *, replace: bool = False) -> None:
        if not isinstance(tool, Tool):
            raise TypeError("Only Tool instances can be registered")
        if tool.name in self._tools and not replace:
            raise ToolRegistryError(f"Tool already registered: {tool.name}")
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool:
        if not isinstance(name, str) or not name:
            raise UnknownToolError("Tool name is required")
        try:
            return self._tools[name]
        except KeyError as exc:
            raise UnknownToolError(f"Unknown tool: {name}") from exc

    def exists(self, name: str) -> bool:
        return isinstance(name, str) and name in self._tools

    def list(self) -> List[Tool]:
        return list(self._tools.values())

    def describe(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
                "risk_level": tool.risk_level,
            }
            for tool in self._tools.values()
        ]

    def validate(self, name: str, arguments: dict) -> bool:
        try:
            return self.get(name).validate_input(arguments)
        except UnknownToolError:
            return False

    async def execute(self, name: str, arguments: dict) -> Dict[str, Any]:
        tool = self.get(name)
        if not self.validate(name, arguments):
            raise InvalidToolArgumentsError(
                f"Invalid arguments for tool: {name}"
            )
        result = await asyncio.wait_for(
            tool.execute(arguments),
            timeout=tool.timeout,
        )
        if not isinstance(result, dict):
            raise ToolRegistryError(
                f"Tool {name} returned an invalid result"
            )
        return result