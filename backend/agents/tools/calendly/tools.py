"""Structured Calendly tools for BotSmith."""

from __future__ import annotations

from typing import Any, Dict
from pydantic import PrivateAttr

from ..base import Tool
from .service import CalendlyService


class CalendlyGetEventTypesTool(Tool):
    name: str = "calendly_get_event_types"
    description: str = "List the connected Calendly account's active event types."
    input_schema: Dict[str, Any] = {
        "type": "object",
        "properties": {
            "count": {"type": "integer", "minimum": 1, "maximum": 100}
        },
        "additionalProperties": False,
    }
    risk_level: str = "low"
    timeout: float = 15.0
    _service: Any = PrivateAttr()

    def __init__(self, service: CalendlyService):
        super().__init__()
        self._service = service

    async def execute(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if not self.validate_input(arguments):
            raise ValueError("Tool arguments must be an object")
        return await self._service.get_event_types(
            count=int(arguments.get("count", 20))
        )


class CalendlyGetAvailableTimesTool(Tool):
    name: str = "calendly_get_available_times"
    description: str = "Get available Calendly slots for an event type."
    input_schema: Dict[str, Any] = {
        "type": "object",
        "required": ["event_type", "start_time", "end_time"],
        "properties": {
            "event_type": {"type": "string", "minLength": 1},
            "start_time": {"type": "string", "minLength": 1},
            "end_time": {"type": "string", "minLength": 1},
        },
        "additionalProperties": False,
    }
    risk_level: str = "low"
    timeout: float = 15.0
    _service: Any = PrivateAttr()

    def __init__(self, service: CalendlyService):
        super().__init__()
        self._service = service

    async def execute(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if not self.validate_input(arguments):
            raise ValueError("Tool arguments must be an object")
        missing = [
            k for k in ("event_type", "start_time", "end_time")
            if not arguments.get(k)
        ]
        if missing:
            raise ValueError(f"Missing required arguments: {', '.join(missing)}")
        return await self._service.get_available_times(
            event_type=str(arguments["event_type"]),
            start_time=str(arguments["start_time"]),
            end_time=str(arguments["end_time"]),
        )


class CalendlyBookMeetingTool(Tool):
    name: str = "calendly_book_meeting"
    description: str = "Book a Calendly meeting for a selected slot."
    input_schema: Dict[str, Any] = {
        "type": "object",
        "required": ["event_type", "start_time", "name", "email"],
        "properties": {
            "event_type": {"type": "string", "minLength": 1},
            "start_time": {"type": "string", "minLength": 1},
            "name": {"type": "string", "minLength": 1},
            "email": {"type": "string", "format": "email"},
            "timezone": {"type": "string"},
            "questions_and_answers": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["question", "answer"],
                    "properties": {
                        "question": {"type": "string"},
                        "answer": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
            },
        },
        "additionalProperties": False,
    }
    risk_level: str = "high"
    timeout: float = 15.0
    _service: Any = PrivateAttr()

    def __init__(self, service: CalendlyService):
        super().__init__()
        self._service = service

    async def execute(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if not self.validate_input(arguments):
            raise ValueError("Tool arguments must be an object")

        missing = [
            k for k in ("event_type", "start_time", "name", "email")
            if not arguments.get(k)
        ]
        if missing:
            raise ValueError(f"Missing required arguments: {', '.join(missing)}")

        invitee: Dict[str, Any] = {
            "name": str(arguments["name"]),
            "email": str(arguments["email"]),
        }
        if arguments.get("timezone"):
            invitee["timezone"] = str(arguments["timezone"])
        if arguments.get("questions_and_answers"):
            invitee["questions_and_answers"] = arguments["questions_and_answers"]

        return await self._service.book_meeting(
            event_type=str(arguments["event_type"]),
            start_time=str(arguments["start_time"]),
            invitee=invitee,
        )