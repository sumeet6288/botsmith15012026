"""Small, tenant-scoped Calendly API client."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class CalendlyService:
    BASE_URL = "https://api.calendly.com"

    def __init__(self, access_token: str, timeout: float = 15.0):
        if not access_token:
            raise ValueError("Calendly access token is required")
        self.access_token = access_token
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers=self._headers(),
            timeout=self.timeout,
        ) as client:
            response = await client.request(
                method, path, params=params, json=json
            )

        if response.status_code >= 400:
            error_details: Dict[str, Any] = {"status": response.status_code}
            try:
                provider_error = response.json()
            except (ValueError, httpx.DecodingError):
                provider_error = {}

            if isinstance(provider_error, dict):
                for field in ("title", "message"):
                    value = provider_error.get(field)
                    if isinstance(value, str):
                        error_details[field] = value[:500]

                details = provider_error.get("details")
                if isinstance(details, list):
                    error_details["details"] = [
                        {
                            key: value[:500] if isinstance(value, str) else value
                            for key, value in item.items()
                            if key in {"message", "parameter", "code"}
                        }
                        for item in details[:10]
                        if isinstance(item, dict)
                    ]

            logger.warning(
                "Calendly API request failed method=%s path=%s provider_error=%s",
                method,
                path,
                error_details,
            )
            raise RuntimeError("Calendly API request failed")

        if not response.content:
            return {}

        return response.json()

    async def get_current_user(self) -> Dict[str, Any]:
        """Return the Calendly user associated with the OAuth token."""
        return await self._request("GET", "/users/me")

    async def get_event_types(
        self,
        *,
        organization: Optional[str] = None,
        user: Optional[str] = None,
        active: Optional[bool] = True,
        count: int = 20,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "count": max(1, min(count, 100))
        }

        if organization:
            params["organization"] = organization
        elif user:
            params["user"] = user
        else:
            current_user = await self.get_current_user()
            current_user_uri = current_user.get("resource", {}).get("uri")

            if not current_user_uri:
                raise RuntimeError(
                    "Calendly current user URI was not returned"
                )

            params["user"] = current_user_uri

        if active is not None:
            params["active"] = active

        return await self._request(
            "GET",
            "/event_types",
            params=params,
        )

    async def get_available_times(
        self,
        *,
        event_type: str,
        start_time: str,
        end_time: str,
        timezone: Optional[str] = None,
    ) -> Dict[str, Any]:
        params = {
            "event_type": event_type,
            "start_time": start_time,
            "end_time": end_time,
        }
        if timezone:
            params["timezone"] = timezone
        return await self._request(
            "GET",
            "/event_type_available_times",
            params=params,
        )

    async def book_meeting(
        self,
        *,
        event_type: str,
        start_time: str,
        invitee: Dict[str, Any],
        location: Optional[Dict[str, Any]] = None,
        questions_and_answers: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        if start.tzinfo is None:
            raise ValueError("Calendly booking start_time must include a timezone")

        payload: Dict[str, Any] = {
            "event_type": event_type,
            "start_time": start.astimezone(timezone.utc).isoformat().replace(
                "+00:00", "Z"
            ),
            "invitee": invitee,
        }
        if location:
            payload["location"] = location
        if questions_and_answers:
            payload["questions_and_answers"] = questions_and_answers

        return await self._request(
            "POST",
            "/invitees",
            json=payload,
        )