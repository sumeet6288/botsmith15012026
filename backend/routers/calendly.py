"""
Calendly OAuth router for BotSmith.

Phase 1 scope:
- Start Calendly OAuth
- Handle OAuth callback
- Check connection status
- Disconnect Calendly

This router does NOT implement booking or agent/tool execution yet.
"""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from auth import get_current_user


router = APIRouter(prefix="/integrations/calendly", tags=["Calendly"])

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "chatbase_db")

CALENDLY_CLIENT_ID = os.environ.get("CALENDLY_CLIENT_ID")
CALENDLY_CLIENT_SECRET = os.environ.get("CALENDLY_CLIENT_SECRET")
CALENDLY_REDIRECT_URI = os.environ.get("CALENDLY_REDIRECT_URI")

CALENDLY_AUTHORIZE_URL = "https://auth.calendly.com/oauth/authorize"
CALENDLY_TOKEN_URL = "https://auth.calendly.com/oauth/token"
CALENDLY_API_URL = "https://api.calendly.com"

# Keep OAuth state records short-lived.
OAUTH_STATE_TTL_MINUTES = 10


def _require_oauth_config() -> None:
    missing = []

    if not CALENDLY_CLIENT_ID:
        missing.append("CALENDLY_CLIENT_ID")
    if not CALENDLY_CLIENT_SECRET:
        missing.append("CALENDLY_CLIENT_SECRET")
    if not CALENDLY_REDIRECT_URI:
        missing.append("CALENDLY_REDIRECT_URI")

    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Calendly OAuth is not configured. Missing: {', '.join(missing)}",
        )


def _get_db():
    """
    Phase-1 router uses the same MongoDB environment variables as BotSmith's
    existing integrations router.

    A local Motor client is intentionally kept here for now so this router
    does not require changes to the existing database architecture.
    """
    from motor.motor_asyncio import AsyncIOMotorClient

    if not MONGO_URL:
        raise HTTPException(
            status_code=500,
            detail="MONGO_URL is not configured",
        )

    client = AsyncIOMotorClient(MONGO_URL)
    return client, client[DB_NAME]


def _create_pkce_pair() -> tuple[str, str]:
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = (
        base64.urlsafe_b64encode(digest)
        .decode("ascii")
        .rstrip("=")
    )
    return code_verifier, code_challenge


@router.get("/connect")
async def connect_calendly(
    chatbot_id: str = Query(..., min_length=1),
    user=Depends(get_current_user),
):
    """
    Start Calendly OAuth for one BotSmith chatbot.

    The chatbot must belong to the currently authenticated BotSmith user.
    """
    _require_oauth_config()

    client, db = _get_db()

    try:
        chatbot = await db.chatbots.find_one(
            {
                "id": chatbot_id,
                "user_id": user.id,
            },
            {
                "_id": 1,
                "id": 1,
                "user_id": 1,
            },
        )

        if not chatbot:
            raise HTTPException(
                status_code=404,
                detail="Chatbot not found",
            )

        state = secrets.token_urlsafe(32)
        code_verifier, code_challenge = _create_pkce_pair()

        await db.calendly_oauth_states.insert_one(
            {
                "state": state,
                "code_verifier": code_verifier,
                "chatbot_id": chatbot_id,
                "user_id": user.id,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc)
                + timedelta(minutes=OAUTH_STATE_TTL_MINUTES),
            }
        )

        params = {
            "client_id": CALENDLY_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": CALENDLY_REDIRECT_URI,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        authorization_url = f"{CALENDLY_AUTHORIZE_URL}?{urlencode(params)}"

        return {
            "authorization_url": authorization_url
        }
    finally:
        client.close()


@router.get("/callback")
async def calendly_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    """
    Calendly redirects here after the user approves or rejects access.
    """
    _require_oauth_config()

    if error:
        message = error_description or error
        raise HTTPException(
            status_code=400,
            detail=f"Calendly authorization failed: {message}",
        )

    if not code or not state:
        raise HTTPException(
            status_code=400,
            detail="Missing Calendly authorization code or state",
        )

    client, db = _get_db()

    try:
        oauth_state = await db.calendly_oauth_states.find_one(
            {
                "state": state,
                "expires_at": {
                    "$gt": datetime.now(timezone.utc),
                },
            }
        )

        if not oauth_state:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired Calendly OAuth state",
            )

        # Delete state before exchanging the code so the callback cannot
        # accidentally be replayed.
        await db.calendly_oauth_states.delete_one(
            {"_id": oauth_state["_id"]}
        )

        token_payload = {
            "grant_type": "authorization_code",
            "client_id": CALENDLY_CLIENT_ID,
            "client_secret": CALENDLY_CLIENT_SECRET,
            "code": code,
            "redirect_uri": CALENDLY_REDIRECT_URI,
            "code_verifier": oauth_state["code_verifier"],
        }

        async with httpx.AsyncClient(timeout=15.0) as http:
            token_response = await http.post(
                CALENDLY_TOKEN_URL,
                data=token_payload,
                headers={
                    "Accept": "application/json",
                },
            )

        if token_response.status_code >= 400:
            try:
                detail = token_response.json()
            except Exception:
                detail = token_response.text

            raise HTTPException(
                status_code=502,
                detail=f"Calendly token exchange failed: {detail}",
            )

        token_data = token_response.json()

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")

        if not access_token:
            raise HTTPException(
                status_code=502,
                detail="Calendly did not return an access token",
            )

        expires_in = token_data.get("expires_in")

        expires_at = None
        if isinstance(expires_in, (int, float)):
            expires_at = datetime.now(timezone.utc) + timedelta(
                seconds=int(expires_in)
            )

        # Phase 1 stores the connection in a dedicated collection.
        # IMPORTANT: encryption should be added before production use.
        connection = {
            "chatbot_id": oauth_state["chatbot_id"],
            "user_id": oauth_state["user_id"],
            "provider": "calendly",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "token_type": token_data.get("token_type"),
            "scope": token_data.get("scope"),
            "updated_at": datetime.now(timezone.utc),
        }

        await db.calendly_connections.update_one(
            {
                "chatbot_id": oauth_state["chatbot_id"],
                "user_id": oauth_state["user_id"],
                "provider": "calendly",
            },
            {
                "$set": connection,
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )

        # Return to the BotSmith Integration tab.
        # The frontend can later change this to a more specific route.
        frontend_url = os.environ.get(
            "FRONTEND_URL",
            "https://botsmith.pro",
        )

        redirect_url = (
            f"{frontend_url.rstrip('/')}"
            f"/chatbots/{oauth_state['chatbot_id']}"
            f"?tab=integration&calendly=connected"
        )

        return RedirectResponse(
            url=redirect_url,
            status_code=302,
        )
    finally:
        client.close()


@router.get("/status")
async def calendly_status(
    chatbot_id: str = Query(..., min_length=1),
    user=Depends(get_current_user),
):
    """
    Return whether Calendly is connected for the selected chatbot.

    Tokens are never returned to the frontend.
    """
    client, db = _get_db()

    try:
        chatbot = await db.chatbots.find_one(
            {
                "id": chatbot_id,
                "user_id": user.id,
            },
            {"_id": 1},
        )

        if not chatbot:
            raise HTTPException(
                status_code=404,
                detail="Chatbot not found",
            )

        connection = await db.calendly_connections.find_one(
            {
                "chatbot_id": chatbot_id,
                "user_id": user.id,
                "provider": "calendly",
            },
            {
                "_id": 0,
                "access_token": 0,
                "refresh_token": 0,
            },
        )

        if not connection:
            return {
                "connected": False,
                "provider": "calendly",
            }

        return {
            "connected": True,
            "provider": "calendly",
            "scope": connection.get("scope"),
            "expires_at": connection.get("expires_at"),
            "updated_at": connection.get("updated_at"),
        }
    finally:
        client.close()


@router.delete("/disconnect")
async def disconnect_calendly(
    chatbot_id: str = Query(..., min_length=1),
    user=Depends(get_current_user),
):
    """
    Disconnect Calendly from a BotSmith chatbot.
    """
    client, db = _get_db()

    try:
        chatbot = await db.chatbots.find_one(
            {
                "id": chatbot_id,
                "user_id": user.id,
            },
            {"_id": 1},
        )

        if not chatbot:
            raise HTTPException(
                status_code=404,
                detail="Chatbot not found",
            )

        result = await db.calendly_connections.delete_one(
            {
                "chatbot_id": chatbot_id,
                "user_id": user.id,
                "provider": "calendly",
            }
        )

        return {
            "success": True,
            "disconnected": result.deleted_count > 0,
        }
    finally:
        client.close()
