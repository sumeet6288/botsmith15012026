"""Small, tenant-scoped Calendly API client."""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx


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
            try:
                detail = response.json()
            except Exception:
                detail = response.text

            raise RuntimeError(
                f"Calendly API request failed ({response.status_code}): {detail}"
            )

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
    ) -> Dict[str, Any]:
        return await self._request(
            "GET",
            "/event_type_available_times",
            params={
                "event_type": event_type,
                "start_time": start_time,
                "end_time": end_time,
            },
        )

    async def book_meeting(
        self,
        *,
        event_type: str,
        start_time: str,
        invitee: Dict[str, Any],
    ) -> Dict[str, Any]:
        return await self._request(
            "POST",
            "/invitees",
            json={
                "event_type": event_type,
                "start_time": start_time,
                "invitee": invitee,
            },
        )