"""Focused public Calendly booking endpoint tests."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from agents.tools.calendly.service import CalendlyService
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
    arguments = []

    def __init__(self, service):
        self.service = service

    def validate_input(self, arguments):
        return bool(arguments.get("event_type") and arguments.get("start_time"))

    async def execute(self, arguments):
        type(self).calls += 1
        type(self).arguments.append(arguments)
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
    FakeBookingTool.arguments = []
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


def test_event_types_endpoint_returns_connected_types(monkeypatch):
    service = FakeService()
    _patch_connected(monkeypatch, service)

    result = asyncio.run(public_chat.get_calendly_event_types("chatbot-a"))

    assert result == [{
        "uri": EVENT["uri"],
        "name": EVENT["name"],
        "duration": EVENT["duration"],
        "active": True,
        "invitee_location_required": False,
        "invitee_location_kind": None,
        "required_questions": [],
    }]


def test_event_types_endpoint_exposes_required_booking_fields(monkeypatch):
    service = FakeService()
    _patch_connected(monkeypatch, service)
    event = {
        **EVENT,
        "locations": [{"kind": "ask_invitee"}],
        "custom_questions": [
            {
                "name": "Meeting location details",
                "type": "text",
                "position": 1,
                "enabled": True,
                "required": True,
                "answer_choices": [],
            },
            {
                "name": "Optional prompt",
                "type": "string",
                "position": 2,
                "enabled": True,
                "required": False,
            },
        ],
    }

    async def get_service(chatbot):
        return service, [event]

    monkeypatch.setattr(public_chat, "_get_calendly_service_and_events", get_service)

    result = asyncio.run(public_chat.get_calendly_event_types("chatbot-a"))

    assert result[0]["invitee_location_required"] is True
    assert result[0]["invitee_location_kind"] == "ask_invitee"
    assert result[0]["required_questions"] == [{
        "name": "Meeting location details",
        "type": "text",
        "position": 1,
        "answer_choices": [],
    }]


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
    assert service.availability_calls[0]["timezone"] == "Asia/Kolkata"

    invalid = request.model_copy(update={"event_type": "https://api.calendly.com/event_types/other"})
    with pytest.raises(HTTPException) as error:
        asyncio.run(public_chat.calendly_availability("chatbot-a", invalid))
    assert error.value.status_code == 404


def test_availability_rejects_ranges_longer_than_calendly_limit(monkeypatch):
    service = FakeService()
    _patch_connected(monkeypatch, service)
    request = CalendlyAvailabilityRequest(
        event_type=EVENT["uri"],
        start_time="2026-10-08T00:00:00Z",
        end_time="2026-10-16T00:00:00Z",
        timezone="Asia/Kolkata",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(public_chat.calendly_availability("chatbot-a", request))

    assert error.value.status_code == 422
    assert "no more than 7 days" in error.value.detail
    assert service.availability_calls == []


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


def test_booking_uses_configured_location_and_required_questions(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    event = {
        **EVENT,
        "locations": [{"kind": "google_conference"}],
        "custom_questions": [
            {
                "name": "What would you like to discuss?",
                "type": "string",
                "position": 1,
                "enabled": True,
                "required": True,
            },
            {
                "name": "Optional question",
                "type": "string",
                "position": 2,
                "enabled": True,
                "required": False,
            },
        ],
    }

    async def get_service(chatbot):
        return service, [event]

    monkeypatch.setattr(public_chat, "_get_calendly_service_and_events", get_service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }
    request = _booking_request().model_copy(update={
        "questions_and_answers": [{
            "question": "What would you like to discuss?",
            "answer": "Product demo",
            "position": 1,
        }]
    })

    result = asyncio.run(public_chat.book_calendly_meeting("chatbot-a", request))

    assert result.status == "confirmed"
    assert FakeBookingTool.arguments[0]["location"] == {
        "kind": "google_conference"
    }
    assert FakeBookingTool.arguments[0]["questions_and_answers"] == [{
        "question": "What would you like to discuss?",
        "answer": "Product demo",
        "position": 1,
    }]


def test_outbound_call_accepts_valid_phone_number(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    event = {
        **EVENT,
        "locations": [{"kind": "outbound_call"}],
    }

    async def get_service(chatbot):
        return service, [event]

    monkeypatch.setattr(public_chat, "_get_calendly_service_and_events", get_service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }
    request = _booking_request().model_copy(update={
        "invitee_location": "+1 (415) 555-2671",
    })

    result = asyncio.run(public_chat.book_calendly_meeting("chatbot-a", request))

    assert result.status == "confirmed"
    assert FakeBookingTool.arguments[0]["location"] == {
        "kind": "outbound_call",
        "location": "+14155552671",
    }


def test_outbound_call_rejects_invalid_phone_number_before_provider_call(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    event = {
        **EVENT,
        "locations": [{"kind": "outbound_call"}],
    }

    with pytest.raises(HTTPException) as error:
        public_chat._booking_location(event, "not a valid number")
    assert error.value.status_code == 422
    assert "valid phone number" in error.value.detail.lower()

    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }

    async def get_service(chatbot):
        return service, [event]

    monkeypatch.setattr(public_chat, "_get_calendly_service_and_events", get_service)
    request = _booking_request().model_copy(update={
        "attempt_id": "attempt-invalid-outbound",
        "invitee_location": "not a valid number",
    })
    with pytest.raises(HTTPException) as booking_error:
        asyncio.run(public_chat.book_calendly_meeting("chatbot-a", request))
    assert booking_error.value.status_code == 422
    assert FakeBookingTool.calls == 0


def test_outbound_call_requires_phone_number(monkeypatch):
    service = FakeService()
    _patch_connected(monkeypatch, service)
    event = {
        **EVENT,
        "locations": [{"kind": "outbound_call"}],
    }

    with pytest.raises(HTTPException) as error:
        public_chat._booking_location(event, "")
    assert error.value.status_code == 422
    assert "valid phone number" in error.value.detail.lower()


def test_custom_and_physical_locations_still_work(monkeypatch):
    _reset_attempts()
    service = FakeService()
    _patch_connected(monkeypatch, service)
    FakeAvailabilityTool.result = {
        "collection": [{"status": "available", "start_time": SLOT}]
    }

    for index, (location_kind, location_value) in enumerate([
        ("custom", "https://meet.example.com/room"),
        ("physical", "123 Main Street"),
    ]):
        event = {
            **EVENT,
            "locations": [{"kind": location_kind, "location": location_value}],
        }

        async def get_service(chatbot, event_map=event):
            return service, [event_map]

        monkeypatch.setattr(public_chat, "_get_calendly_service_and_events", get_service)
        request = _booking_request().model_copy(update={
            "attempt_id": f"attempt-custom-physical-{index}",
            "name": f"Guest {index}",
            "email": f"guest-{index}@example.com",
            "invitee_location": location_value,
        })
        result = asyncio.run(public_chat.book_calendly_meeting("chatbot-a", request))
        assert result.status == "confirmed"
        assert FakeBookingTool.arguments[-1]["location"] == {
            "kind": location_kind,
            "location": location_value,
        }


def test_booking_requires_actual_location_and_required_question_answers(monkeypatch):
    service = FakeService()
    _patch_connected(monkeypatch, service)
    event = {
        **EVENT,
        "locations": [{"kind": "ask_invitee"}],
        "custom_questions": [{
            "name": "Company",
            "type": "string",
            "position": 1,
            "enabled": True,
            "required": True,
        }],
    }

    with pytest.raises(HTTPException) as location_error:
        public_chat._booking_location(event, None)
    assert location_error.value.status_code == 422

    with pytest.raises(HTTPException) as question_error:
        public_chat._booking_questions(event, [])
    assert question_error.value.status_code == 422
    assert "Company" in question_error.value.detail


def test_calendly_service_sends_location_and_questions_at_booking_level(monkeypatch):
    service = CalendlyService("test-token")
    captured = {}

    async def fake_request(method, path, *, params=None, json=None):
        captured.update({"method": method, "path": path, "payload": json})
        return {"resource": {"uri": "https://api.calendly.com/invitees/invitee-a"}}

    monkeypatch.setattr(service, "_request", fake_request)

    asyncio.run(service.book_meeting(
        event_type=EVENT["uri"],
        start_time=SLOT,
        invitee={
            "name": "Invitee Name",
            "email": "invitee@example.com",
            "timezone": "Asia/Kolkata",
        },
        location={"kind": "google_conference"},
        questions_and_answers=[{
            "question": "Company",
            "answer": "Example",
            "position": 1,
        }],
    ))

    assert captured["method"] == "POST"
    assert captured["path"] == "/invitees"
    assert captured["payload"]["start_time"] == "2026-10-08T05:00:00Z"
    assert captured["payload"]["location"] == {"kind": "google_conference"}
    assert captured["payload"]["questions_and_answers"] == [{
        "question": "Company",
        "answer": "Example",
        "position": 1,
    }]
    assert "questions_and_answers" not in captured["payload"]["invitee"]


def test_calendly_request_logs_safe_provider_validation_details(monkeypatch, caplog):
    class FakeResponse:
        status_code = 400

        @staticmethod
        def json():
            return {
                "title": "Invalid Argument",
                "message": "Location is required",
                "details": [{
                    "message": "Provide location.kind",
                    "parameter": "location",
                    "code": "required",
                    "access_token": "must-not-be-logged",
                }],
            }

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def request(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr("agents.tools.calendly.service.httpx.AsyncClient", FakeAsyncClient)
    caplog.set_level("WARNING", logger="agents.tools.calendly.service")

    with pytest.raises(RuntimeError, match="Calendly API request failed"):
        asyncio.run(CalendlyService("secret-token")._request("POST", "/invitees"))

    assert "Location is required" in caplog.text
    assert "must-not-be-logged" not in caplog.text
    assert "secret-token" not in caplog.text


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