"""Common interface and validation for explicitly registered tools."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from typing import Any, Dict

from pydantic import BaseModel, Field


def _schema_matches(value: Any, schema: Dict[str, Any]) -> bool:
    """Validate the JSON-schema subset used by BotSmith tools."""

    expected = schema.get("type")
    if expected == "object":
        if not isinstance(value, dict):
            return False
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        if any(key not in value for key in required):
            return False
        if schema.get("additionalProperties") is False:
            if any(key not in properties for key in value):
                return False
        return all(
            key in properties and _schema_matches(item, properties[key])
            for key, item in value.items()
        )

    if expected == "array":
        if not isinstance(value, list):
            return False
        item_schema = schema.get("items")
        return item_schema is None or all(
            _schema_matches(item, item_schema) for item in value
        )

    if expected == "string":
        if not isinstance(value, str):
            return False
        if len(value) < schema.get("minLength", 0):
            return False
        if len(value) > schema.get("maxLength", 1_000_000):
            return False
        if schema.get("format") == "email" and not re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+", value
        ):
            return False
        return True

    if expected == "integer":
        if isinstance(value, bool) or not isinstance(value, int):
            return False
        return (
            value >= schema.get("minimum", value)
            and value <= schema.get("maximum", value)
        )

    if expected == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return False
        return (
            value >= schema.get("minimum", value)
            and value <= schema.get("maximum", value)
        )

    if expected == "boolean":
        return isinstance(value, bool)

    return True


class Tool(BaseModel, ABC):
    """Tool contract; arbitrary model text is never executable."""

    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=2_000)
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    risk_level: str = Field(default="low", max_length=32)
    timeout: float = Field(default=10.0, gt=0, le=120)

    def validate_input(self, arguments: Dict[str, Any]) -> bool:
        if not isinstance(arguments, dict):
            return False
        return _schema_matches(
            arguments,
            self.input_schema or {"type": "object"},
        )

    @abstractmethod
    async def execute(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Perform one explicitly implemented operation."""
        raise NotImplementedError