"""Focused public Calendly booking endpoint tests."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

import routers.public_chat as public_chat
from models import CalendlyAvailabilityRequest, CalendlyBookingRequest


class FakeAvailabilityTool:
    result = {"collection": []}

    def __init__(self, service):
        self.service = service

    async def execute(self, arguments):
        self.service.availability_calls.append(arguments)
        return self.result


class FakeBookingTool:
    result = {"resource": {"uri": "https://api.calendly.com/invitees/invitee-a"}}
    error = None
    calls = 0

    def __init__(self, service):
        self.service = service

    def validate_input(self, arguments):
        return bool(arguments.get("event_type") and arguments.get("start_time"))

    async def execute(self, arguments):
        type(self).calls += 1
        if type(self).error:
            raise type(self).error
        return type(self).result


class FakeService:
    def __init__(self):
        self.availability_calls = []


EVENT = {
    "uri": "https://api.calendly.com/event_types/event-a",
    "name": "Live event name",
    "duration": 45,
}
SLOT = "2026-10-08T10:30:00+05:30"


def _booking_request(attempt_id="attempt-1234567890"):
    return CalendlyBookingRequest(
        attempt_id=attempt_id,
        event_type=EVENT["uri"],
        start_time=SLOT,
        name="Invitee Name",
        email="invitee@example.com",
        timezone="Asia/Kolkata",
    )


def _reset_attempts():
    public_chat._booking_attempts.clear()
    public_chat._booking_attempts_by_fingerprint.clear()
    FakeBookingTool.calls = 0
    FakeBookingTool.error = None
    FakeBookingTool.result = {
        "resource": {"uri": "https://api.calendly.com/invitees/invitee-a"}
    }


def _patch_connected(monkeypatch, service):
    async def get_chatbot(chatbot_id):
        return {"id": chatbot_id, "user_id": "owner-from-db"}

    async def get_service(chatbot):
        return service, [EVENT]

    monkeypatch.setattr(public_chat, "_get_public_booking_chatbot", get_chatbot)
    monkeypatch.setattr(public_chat, "_get_calendly_service_and_events", get_service)
    monkeypatch.setattr(public_chat, "CalendlyGetAvailableTimesTool", FakeAvailabilityTool)
    monkeypatch.setattr(public_chat, "CalendlyBookMeetingTool", FakeBookingTool)


def test_availability_returns_actual_slot_and_rejects_unknown_event(monkeypatch):
    service = FakeService()
    _patch_connected(monkeypatch, service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }
    request = CalendlyAvailabilityRequest(
        event_type=EVENT["uri"],
        start_time="2026-10-08T00:00:00Z",
        end_time="2026-10-09T00:00:00Z",
        timezone="Asia/Kolkata",
    )
    result = asyncio.run(public_chat.calendly_availability("chatbot-a", request))
    assert result.event_type.name == EVENT["name"]
    assert result.event_type.duration == 45
    assert result.slots == [SLOT]
    assert service.availability_calls[0]["event_type"] == EVENT["uri"]

    invalid = request.model_copy(update={"event_type": "https://api.calendly.com/event_types/other"})
    with pytest.raises(HTTPException) as error:
        asyncio.run(public_chat.calendly_availability("chatbot-a", invalid))
    assert error.value.status_code == 404


def test_stale_slot_is_not_booked_and_returns_fresh_availability(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": "2026-10-08T11:00:00+05:30"}]
    }

    result = asyncio.run(
        public_chat.book_calendly_meeting("chatbot-a", _booking_request())
    )

    assert result.status == "stale_slot"
    assert result.slots == ["2026-10-08T11:00:00+05:30"]
    assert FakeBookingTool.calls == 0


def test_success_is_returned_only_after_provider_resource_and_duplicate_is_suppressed(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }

    first = asyncio.run(
        public_chat.book_calendly_meeting("chatbot-a", _booking_request())
    )
    second = asyncio.run(
        public_chat.book_calendly_meeting("chatbot-a", _booking_request())
    )

    assert first.status == "confirmed"
    assert first.booking["event_name"] == EVENT["name"]
    assert second.status == "confirmed"
    assert FakeBookingTool.calls == 1


def test_ambiguous_booking_failure_is_not_retried(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }
    FakeBookingTool.error = TimeoutError("provider response timed out")

    first = asyncio.run(
        public_chat.book_calendly_meeting("chatbot-a", _booking_request())
    )
    second = asyncio.run(
        public_chat.book_calendly_meeting("chatbot-a", _booking_request())
    )

    assert first.status == "unknown"
    assert "couldn't confirm" in first.message
    assert second.status == "unknown"
    assert FakeBookingTool.calls == 1


def test_provider_error_never_returns_booking_confirmation(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }
    FakeBookingTool.error = RuntimeError("Calendly rejected the request")

    result = asyncio.run(
        public_chat.book_calendly_meeting("chatbot-a", _booking_request())
    )

    assert result.status == "failed"
    assert result.booking is None