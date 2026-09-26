"""Common interface for safe, explicitly registered tools."""

from abc import ABC, abstractmethod
from typing import Any, Dict

from pydantic import BaseModel, Field


class Tool(BaseModel, ABC):
    """Tool contract; arbitrary model text is never executable."""

    name: str = Field(min_length=1)
    description: str = ""
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    risk_level: str = "low"
    timeout: float = Field(default=10.0, gt=0, le=120)

    def validate_input(self, arguments: Dict[str, Any]) -> bool:
        """Validate the basic shape before a concrete tool executes."""
        return isinstance(arguments, dict)

    @abstractmethod
    async def execute(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Perform an explicitly implemented operation."""
        raise NotImplementedError