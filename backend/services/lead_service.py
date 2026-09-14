"""
BotSmith internal lead service for agentic chat.

The current production leads router stores Lead.contact as a single field.
This service intentionally uses that existing schema instead of creating
another leads collection or calling the authenticated HTTP endpoint internally.
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient
from models import Lead
from services.plan_service import plan_service

logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "chatbase_db")

_client = AsyncIOMotorClient(MONGO_URL)
_db = _client[DB_NAME]
_leads_collection = _db.leads


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
        Capture a lead while preserving the existing plan limit.

        Returns a small dict suitable for AgentService telemetry.
        Returns None when the account has reached its lead limit.
        """
        current_count = await _leads_collection.count_documents(
            {"user_id": owner_user_id}
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

        # Prevent obvious duplicate captures from the same conversation/contact.
        duplicate_filter = {
            "user_id": owner_user_id,
            "chatbot_id": chatbot_id,
            "contact": contact,
        }

        if conversation_id:
            duplicate_filter["conversation_id"] = conversation_id

        existing = await _leads_collection.find_one(duplicate_filter)

        if existing:
            return {
                "captured": False,
                "duplicate": True,
                "lead_id": existing.get("id"),
            }

        now = datetime.now(timezone.utc)

        notes = (
            "Captured by BotSmith Agentic AI. "
            f"Intent: {intent}. "
            f"Inquiry: {inquiry[:1000]}"
        )

        lead = Lead(
            id=str(uuid.uuid4()),
            user_id=owner_user_id,
            name=name,
            contact=contact,
            status="New",
            notes=notes,
            created_at=now,
            updated_at=now,
        )

        lead_dict = lead.model_dump()

        # MongoDB is schema-flexible, so retain these Agentic V1 metadata fields.
        lead_dict["chatbot_id"] = chatbot_id

        if conversation_id:
            lead_dict["conversation_id"] = conversation_id

        lead_dict["source"] = "agent"

        await _leads_collection.insert_one(lead_dict)

        return {
            "captured": True,
            "duplicate": False,
            "lead_id": lead_dict["id"],
        }
