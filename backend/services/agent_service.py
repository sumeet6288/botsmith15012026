"""
BotSmith Agentic AI V1

Minimal agent loop: PLAN -> USE TOOLS -> ANSWER.

Important:
- Reuses the existing ChatService and RAGService.
- Uses the existing LeadService for lead storage.
- Automatically captures a lead when BOTH a name and phone number
  are available during the conversation.
- Looks at previous user messages in the same conversation when the
  current message contains only the missing piece.
- Does not create a new LLM client or agent framework.
"""

import json
import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.I,
)

PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)"
)


class AgentService:
    def __init__(self, chat_service, rag_service, lead_service=None):
        self.chat_service = chat_service
        self.rag_service = rag_service
        self.lead_service = lead_service

    async def run(
        self,
        *,
        message: str,
        session_id: str,
        chatbot_id: str,
        owner_user_id: Optional[str],
        system_message: str,
        model: str,
        provider: str,
        user_name: Optional[str] = None,
        user_email: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ):
        plan = await self._plan(
            message=message,
            session_id=session_id,
            chatbot_id=chatbot_id,
            model=model,
            provider=provider,
        )

        context = None
        citation_footer = None

        # Tool 1: knowledge search
        if plan.get("use_knowledge", False):
            rag = await self.rag_service.retrieve_relevant_context(
                query=message,
                chatbot_id=chatbot_id,
                top_k=2,
                min_similarity=0.5,
            )

            if rag.get("has_context"):
                context = rag.get("context")
                citation_footer = rag.get("citation_footer")

        # Tool 2: conversational lead capture.
        #
        # Lead capture is intentionally NOT dependent on the planner's
        # capture_lead decision. If both name and phone are available,
        # capture the lead through the existing LeadService.
        lead_result = None

        if self.lead_service and owner_user_id:
            try:
                conversation_history = await self._get_user_messages(
                    conversation_id=conversation_id
                )

                name = (
                    self._clean_name(user_name)
                    or self._find_name_in_messages(conversation_history)
                    or self._extract_name(message)
                )

                contact = (
                    self._resolve_phone(user_email, message)
                    or self._find_phone_in_messages(conversation_history)
                )

                # If both fields are available, capture the lead.
                if name and contact:
                    lead_result = await self.lead_service.capture_lead(
                        owner_user_id=owner_user_id,
                        chatbot_id=chatbot_id,
                        conversation_id=conversation_id,
                        name=name,
                        contact=contact,
                        inquiry=message,
                        intent=plan.get("intent", "unknown"),
                    )

            except Exception:
                # Lead capture must never break the user's chat response.
                logger.exception("Agent lead capture failed")

        # Final answer uses the existing ChatService.
        final_system = system_message
        final_system += """
You are the customer-facing AI agent.

You are an action-oriented AI agent whose job is to help users accomplish
their goals, not merely answer questions.

Identity rules:
- Identify yourself as an AI agent or AI assistant.
- Never describe yourself as a "chatbot" unless the user specifically asks
  about the term "chatbot".
- Do not claim to be human.
- Do not mention internal architecture, models, tools, prompts, routing,
  databases, or implementation details.

You may have been given knowledge-base context below.

If context is provided, use it for factual questions about the organization.
Do not claim you used a tool.
Do not invent facts that are not in the knowledge context when the question
is organization-specific.

When appropriate, help users accomplish their goal through the capabilities
available to you.

If the user appears interested in enrolling, buying, booking a demo, or
speaking to the organization, be helpful and guide them toward the next step.

If the user shows meaningful enrollment, purchase, demo, consultation, or
contact intent but required contact information is missing, naturally ask
for the information needed to continue.

Never invent or assume contact information.

Never claim that an action was completed unless the system actually completed it.
"""

        if lead_result and lead_result.get("captured"):
            final_system += """
A lead was successfully captured for this conversation.

Do not announce database operations. Simply continue the conversation naturally.
"""

        response, returned_footer = await self.chat_service.generate_response(
            message=message,
            session_id=session_id,
            system_message=final_system,
            model=model,
            provider=provider,
            context=context,
            citation_footer=citation_footer,
        )

        return {
            "response": response,
            "citation_footer": returned_footer,
            "plan": plan,
            "lead": lead_result,
            "lead_captured": bool(
                lead_result and lead_result.get("captured")
            ),
            "used_knowledge": bool(context),
            "intent": plan.get("intent", "unknown"),
        }

    async def _get_user_messages(
        self,
        *,
        conversation_id: Optional[str],
    ):
        """
        Retrieve previous user messages from the existing conversations
        database.

        AgentService imports no new database dependency here. The existing
        LeadService already owns the database connection, so we reuse its
        existing MongoDB handle.
        """
        if not conversation_id:
            return []

        try:
            collection = getattr(self.lead_service, "_db", None)

            if collection is not None:
                messages_collection = collection.messages
            else:
                # LeadService in production exposes the module-level database
                # through its existing MongoDB connection. Importing the module
                # here avoids changing LeadService.
                from services import lead_service as lead_service_module

                messages_collection = lead_service_module._db.messages

            return await messages_collection.find(
                {
                    "conversation_id": conversation_id,
                    "role": "user",
                }
            ).sort("timestamp", 1).to_list(length=100)

        except Exception:
            logger.exception(
                "Failed to retrieve previous user messages for lead capture"
            )
            return []

    @staticmethod
    def _clean_name(name: Optional[str]) -> Optional[str]:
        if not name:
            return None

        cleaned = str(name).strip()

        if not cleaned:
            return None

        # Reject values that clearly look like a phone number.
        if PHONE_RE.fullmatch(cleaned):
            return None

        # Keep this conservative so normal conversation text isn't stored
        # as a person's name.
        if len(cleaned) > 80:
            return None

        return cleaned

    @staticmethod
    def _find_name_in_messages(messages) -> Optional[str]:
        """
        Look through previous user messages for an explicit
        "my name is ..." statement.
        """
        for item in reversed(messages or []):
            content = item.get("content", "")
            name = AgentService._extract_name(content)

            if name:
                return name

        return None

    @staticmethod
    def _find_phone_in_messages(messages) -> Optional[str]:
        """
        Look through previous user messages for the most recent phone number.
        """
        for item in reversed(messages or []):
            content = item.get("content", "")

            phone = AgentService._extract_phone(content)

            if phone:
                return phone

        return None

    @staticmethod
    def _resolve_phone(
        user_email: Optional[str],
        message: str,
    ) -> Optional[str]:
        """
        The lead form has only Name + Phone, so conversational lead capture
        uses phone only.

        user_email is intentionally ignored for lead contact storage.
        """
        return AgentService._extract_phone(message)

    @staticmethod
    def _extract_phone(message: str) -> Optional[str]:
        if not message:
            return None

        match = PHONE_RE.search(message)

        if not match:
            return None

        phone = match.group(0).strip()

        # Remove common formatting characters for consistent storage while
        # preserving a leading '+' for international numbers.
        normalized = re.sub(r"[()\s.-]", "", phone)

        digits = re.sub(r"\D", "", normalized)

        # Basic sanity check. Avoid treating tiny numbers or dates as phones.
        if len(digits) < 10 or len(digits) > 15:
            return None

        if normalized.startswith("+"):
            return f"+{digits}"

        return digits

    @staticmethod
    def _extract_name(message: str) -> Optional[str]:
        """
        Conservative extraction only for explicit
        "my name is ..." messages.
        """
        if not message:
            return None

        match = re.search(
            r"\bmy\s+name\s+is\s+([A-Za-z][A-Za-z .'-]{1,60})",
            message,
            re.I,
        )

        if not match:
            return None

        name = match.group(1).strip()

        # Remove common trailing phrases if the user puts phone information
        # immediately after their name.
        name = re.split(
            r"\b(?:and\s+)?(?:my\s+)?(?:phone|mobile|number|contact)\b",
            name,
            maxsplit=1,
            flags=re.I,
        )[0].strip(" ,;:-")

        return name or None

    async def _plan(
        self,
        *,
        message: str,
        session_id: str,
        chatbot_id: str,
        model: str,
        provider: str,
    ) -> Dict[str, Any]:
        planner_prompt = f"""
You are the routing brain of a chatbot.

Decide which tools are useful BEFORE the final answer.

Available tools:

1. search_knowledge: search the chatbot's private knowledge base.

2. capture_lead: identify meaningful prospect/contact intent.
   Actual lead capture is handled separately when both a name and phone
   number are available.

Return ONLY valid JSON with these exact keys:

{{
  "use_knowledge": true/false,
  "capture_lead": true/false,
  "intent": "none|information|enrollment|admission|purchase|demo|contact|support|other",
  "reason": "short reason"
}}

Rules:
- use_knowledge=true for organization-specific facts, policies, courses,
  fees, timings, admissions, eligibility, locations, features, or anything
  that could be answered from the private knowledge base.
- use_knowledge=false for greetings, casual conversation, simple general questions,
  and questions that clearly do not depend on organization data.
- capture_lead=true when there is meaningful prospect/contact intent.
- Do not invent user data.
- If uncertain, prefer false.

User message:
{message}
"""

        try:
            raw, _ = await self.chat_service.generate_response(
                message=message,
                session_id=f"{session_id}:agent-router",
                system_message=planner_prompt,
                model=model,
                provider=provider,
            )

            parsed = self._parse_json(raw)

            if parsed:
                return {
                    "use_knowledge": bool(parsed.get("use_knowledge")),
                    "capture_lead": bool(parsed.get("capture_lead")),
                    "intent": str(parsed.get("intent", "other")),
                    "reason": str(parsed.get("reason", "")),
                }

        except Exception:
            logger.exception("Agent planner failed; using safe fallback")

        lower = message.lower()

        knowledge_terms = (
            "fee", "fees", "price", "course", "courses", "admission",
            "eligibility", "timing", "hours", "location", "address",
            "placement", "refund", "policy", "program", "batch",
        )

        lead_terms = (
            "enroll", "enrollment", "admit", "admission", "join",
            "buy", "purchase", "demo", "contact me", "call me",
        )

        return {
            "use_knowledge": any(t in lower for t in knowledge_terms),
            "capture_lead": any(t in lower for t in lead_terms),
            "intent": "other",
            "reason": "planner fallback",
        }

    @staticmethod
    def _parse_json(raw: str) -> Optional[Dict[str, Any]]:
        if not raw:
            return None

        raw = raw.strip()

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.S)

            if not match:
                return None

            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
