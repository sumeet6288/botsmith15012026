"""
BotSmith internal lead service for agentic/conversational chat.

Conversational leads are stored in the same `chatbot_leads` collection
used by the existing Lead Captured dashboard and widget lead form.

The dashboard expects:
- chatbot_id
- name
- phone
- created_at

This service keeps the existing plan-limit check for AgentService captures.
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient
from models import ChatbotLead
from services.plan_service import plan_service

logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "chatbase_db")

_client = AsyncIOMotorClient(MONGO_URL)
_db = _client[DB_NAME]

# IMPORTANT:
# The Lead Captured dashboard reads from chatbot_leads via
# GET /chatbot-leads/{chatbot_id}. Conversational captures therefore
# use the same collection.
_leads_collection = _db.chatbot_leads


class LeadService:
    async def capture_lead(
        self,
        *,
        owner_user_id: str,
        chatbot_id: str,
        conversation_id: Optional[str],
        name: str,
        contact: str,
        inquiry: str,
        intent: str,
    ):
        """
        Capture a conversational lead into the existing chatbot_leads
        collection used by the Lead Captured dashboard.

        Returns:
            {
                "captured": True/False,
                "duplicate": True/False,
                "lead_id": ...
            }

        Returns None when the account has reached its lead limit.
        """

        # Keep the existing account-level lead limit behavior.
        #
        # chatbot_leads does not currently store user_id, so count the
        # owner's chatbots and their captured leads to enforce the same
        # account-level limit.
        chatbot_ids = await _db.chatbots.find(
            {"user_id": owner_user_id},
            {"id": 1},
        ).to_list(length=None)

        owner_chatbot_ids = [
            chatbot.get("id")
            for chatbot in chatbot_ids
            if chatbot.get("id")
        ]

        current_count = 0

        if owner_chatbot_ids:
            current_count = await _leads_collection.count_documents(
                {"chatbot_id": {"$in": owner_chatbot_ids}}
            )

        subscription = await plan_service.get_user_subscription(owner_user_id)
        plan = await plan_service.get_plan_by_id(subscription["plan_id"])

        max_leads = plan["limits"].get("max_leads", 50)

        # Keep compatibility with existing custom-limit behavior where possible.
        user_doc = await _db.users.find_one({"id": owner_user_id})

        if user_doc:
            custom_limits = user_doc.get("custom_limits") or {}

            if "max_leads" in custom_limits:
                max_leads = custom_limits["max_leads"]

        if current_count >= max_leads:
            logger.info(
                "Agent lead capture skipped: limit reached for user %s",
                owner_user_id,
            )
            return None

        # Prevent duplicate conversational captures.
        #
        # If conversation_id is available, the same phone number should not
        # be captured twice in that conversation.
        duplicate_filter = {
            "chatbot_id": chatbot_id,
            "phone": contact,
        }

        if conversation_id:
            duplicate_filter["conversation_id"] = conversation_id
        else:
            # Without a conversation ID, use chatbot + name + phone as the
            # safe duplicate key.
            duplicate_filter["name"] = name

        existing = await _leads_collection.find_one(duplicate_filter)

        if existing:
            return {
                "captured": False,
                "duplicate": True,
                "lead_id": existing.get("id"),
            }

        now = datetime.now(timezone.utc)

        lead = ChatbotLead(
            chatbot_id=chatbot_id,
            name=name,
            phone=contact,
        )

        lead_dict = lead.model_dump()

        # Keep the dashboard's expected schema intact.
        # Add conversation/source metadata because MongoDB is schema-flexible.
        if conversation_id:
            lead_dict["conversation_id"] = conversation_id

        lead_dict["source"] = "agent"

        # Preserve the conversational context for internal use without
        # changing the dashboard fields.
        if inquiry:
            lead_dict["inquiry"] = inquiry[:1000]

        if intent:
            lead_dict["intent"] = intent

        await _leads_collection.insert_one(lead_dict)

        # Send the same email alert used by the existing widget lead form.
        # Import locally to avoid introducing a module-level dependency cycle.
        try:
            from services.resend_service import send_lead_alert

            chatbot = await _db.chatbots.find_one({"id": chatbot_id})

            if chatbot and chatbot.get("email_alerts_enabled") and chatbot.get(
                "email_alert_address"
            ):
                await send_lead_alert(
                    recipient=str(chatbot["email_alert_address"]),
                    chatbot_name=chatbot.get("name", "Chatbot"),
                    lead_name=name,
                    lead_phone=contact,
                    created_at=now,
                )

        except Exception:
            # Email notification failure must never prevent the lead itself
            # from being stored.
            logger.exception(
                "Failed to send conversational lead alert for chatbot %s",
                chatbot_id,
            )

        return {
            "captured": True,
            "duplicate": False,
            "lead_id": lead_dict["id"],
        }
