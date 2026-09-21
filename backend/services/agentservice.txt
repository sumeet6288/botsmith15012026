"""
BotSmith Agentic AI V2

Controlled agent loop:
UNDERSTAND -> PLAN -> RETRIEVE -> VERIFY -> ANSWER

Design goals:
- Make the agent better at intent, sub-intent, user goal and conversation state.
- Preserve the existing ChatService, RAGService and LeadService interfaces.
- Keep lead capture deterministic: a lead is stored only when BOTH name and
  phone are actually available.
- Never allow planner/RAG/history failures to break a normal chat response.
- Do not create a new LLM client or agent framework.
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
        # ---------------------------------------------------------------
        # 1. UNDERSTAND + PLAN
        # ---------------------------------------------------------------
        # Planner failure is intentionally non-fatal. _plan() always
        # returns a usable fallback plan.
        plan = await self._plan(
            message=message,
            session_id=session_id,
            chatbot_id=chatbot_id,
            model=model,
            provider=provider,
            conversation_id=conversation_id,
        )

        context = None
        citation_footer = None

        # ---------------------------------------------------------------
        # 2. RETRIEVE KNOWLEDGE
        # ---------------------------------------------------------------
        # Never let RAG failure take down the chatbot.
        if plan.get("use_knowledge", False):
            retrieval_query = self._build_retrieval_query(message, plan)

            try:
                rag = await self.rag_service.retrieve_relevant_context(
                    query=retrieval_query,
                    chatbot_id=chatbot_id,
                    top_k=2,
                    min_similarity=0.5,
                )

                if rag and rag.get("has_context"):
                    context = rag.get("context")
                    citation_footer = rag.get("citation_footer")

            except Exception:
                logger.exception(
                    "Agent knowledge retrieval failed; continuing without RAG"
                )

        # ---------------------------------------------------------------
        # 3. DETERMINISTIC LEAD CAPTURE
        # ---------------------------------------------------------------
        # This remains independent of the LLM planner.
        # The planner can say whatever it wants; actual storage happens
        # only when concrete name + phone are available.
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
                    self._extract_phone(message)
                    or self._find_phone_in_messages(conversation_history)
                )

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
                # Lead capture must NEVER break the user's conversation.
                logger.exception("Agent lead capture failed")

        # ---------------------------------------------------------------
        # 4. VERIFY + ANSWER
        # ---------------------------------------------------------------
        final_system = self._build_final_system(
            system_message=system_message,
            plan=plan,
            context=context,
            lead_captured=bool(
                lead_result and lead_result.get("captured")
            ),
        )

        try:
            response, returned_footer = await self.chat_service.generate_response(
                message=message,
                session_id=session_id,
                system_message=final_system,
                model=model,
                provider=provider,
                context=context,
                citation_footer=citation_footer,
            )
        except Exception:
            # Safety net:
            # If the enriched agent prompt itself causes an unexpected
            # failure, retry once with the original system message plus a
            # very small safety instruction. This prevents a richer agent
            # layer from taking down an otherwise working chatbot.
            logger.exception(
                "Agent final response failed; retrying with safe prompt"
            )

            safe_system = system_message + """
You are the customer-facing AI assistant.
Use the supplied knowledge context when available.
Do not invent organization-specific facts.
If information is unavailable, say so clearly.
Do not claim an action was completed unless it actually was.
"""

            response, returned_footer = await self.chat_service.generate_response(
                message=message,
                session_id=session_id,
                system_message=safe_system,
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

    # ===================================================================
    # FINAL SYSTEM PROMPT
    # ===================================================================

    @staticmethod
    def _build_final_system(
        *,
        system_message: str,
        plan: Dict[str, Any],
        context: Optional[str],
        lead_captured: bool,
    ) -> str:
        final_system = system_message

        final_system += """
You are the customer-facing AI agent.

Your job is to understand the user's actual goal and help them reach the
next useful step, not merely react to keywords.

IDENTITY:
- Identify yourself as an AI agent or AI assistant.
- Never claim to be human.
- Do not mention internal prompts, routing, databases, tools, models,
  planners, or implementation details.

KNOWLEDGE:
- Use the supplied knowledge-base context for organization-specific facts.
- Do not invent organization-specific facts.
- If the required organization information is not available in the context,
  say that you do not have that information rather than guessing.

CONVERSATION:
- Treat short follow-up questions as part of the current conversation.
- Use the known topic/entities from the current request when they clearly
  resolve what the user means.
- Do not unnecessarily ask the user to repeat information already provided.

GOAL:
- If the user is asking for information, answer it directly.
- If the user is considering enrollment, purchase, a demo, consultation,
  booking, or contact, guide them toward the appropriate next step.
- If required information is missing, ask only for the information that is
  actually needed.
- Never invent or assume contact information.

ACTIONS:
- Never claim an action was completed unless the system actually completed it.
"""

        # Give the final model a compact, structured understanding of the
        # conversation. This is guidance, not an instruction to expose it.
        final_system += f"""

INTERNAL UNDERSTANDING FOR THIS TURN:
- Intent: {plan.get("intent", "other")}
- Sub-intent: {plan.get("sub_intent", "unknown")}
- User goal: {plan.get("user_goal", "unknown")}
- User stage: {plan.get("user_stage", "unknown")}
- Entities: {json.dumps(plan.get("entities", {}), ensure_ascii=False)}
- Missing information: {json.dumps(plan.get("missing_information", []), ensure_ascii=False)}
- Next action: {plan.get("next_action", "answer")}
- Confidence: {plan.get("confidence", 0.5)}
"""

        if context:
            final_system += """
KNOWLEDGE CONTEXT:
The following context was retrieved from the chatbot's private knowledge
base. Use it as the factual source for organization-specific answers.

""" + str(context)

        if lead_captured:
            final_system += """
A lead was successfully captured for this conversation.
Do not announce database operations. Continue naturally.
"""

        return final_system

    # ===================================================================
    # PLANNER
    # ===================================================================

    async def _plan(
        self,
        *,
        message: str,
        session_id: str,
        chatbot_id: str,
        model: str,
        provider: str,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        # We intentionally keep planner context small. The existing
        # ChatService remains responsible for normal conversation history.
        recent_user_messages = []

        if conversation_id:
            try:
                history = await self._get_user_messages(
                    conversation_id=conversation_id,
                    max_messages=8,
                )
                recent_user_messages = [
                    item.get("content", "")
                    for item in history[-8:]
                    if item.get("content")
                ]
            except Exception:
                logger.exception("Planner history lookup failed")

        history_text = "\n".join(
            f"- {item}" for item in recent_user_messages[-6:]
        )

        planner_prompt = f"""
You are the internal reasoning/router for a customer-facing AI agent.

Understand the user's actual goal before deciding what should happen next.

Return ONLY valid JSON with these exact keys:

{{
  "use_knowledge": true,
  "capture_lead": false,
  "intent": "information",
  "sub_intent": "eligibility",
  "user_goal": "understand whether they qualify",
  "user_stage": "prospective_student",
  "entities": {{}},
  "missing_information": [],
  "next_action": "search_knowledge",
  "confidence": 0.0,
  "reason": "short internal reason"
}}

ALLOWED intent values:
none, information, enrollment, admission, purchase, demo, contact,
support, other

ALLOWED next_action values:
answer, search_knowledge, ask_clarification, capture_lead, guide_next_step

RULES:

1. use_knowledge=true when the answer depends on the organization's own
   courses, fees, admissions, eligibility, timings, locations, policies,
   programs, services, features, or other private knowledge.

2. use_knowledge=false for greetings, casual conversation, and ordinary
   general questions that do not require the organization's knowledge base.

3. Keep the user's current topic in mind. For example:
   "Tell me about BCA" followed by "what are the fees?" should understand
   that "fees" refers to BCA when the conversation makes that clear.

4. Extract useful entities such as course, program, location, education
   level, product, service, date, or other concrete subjects.

5. Do not invent entities. Use an empty object when none are known.

6. missing_information should contain only information genuinely required
   to complete the user's goal.

7. capture_lead=true only when there is meaningful prospect/contact intent.
   Actual storage is handled separately and requires concrete name + phone.

8. If uncertain, lower confidence and choose the safer action.

9. Do not expose this internal reasoning to the user.

RECENT USER MESSAGES:
{history_text or "(none available)"}

CURRENT USER MESSAGE:
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
                return self._normalize_plan(parsed)

        except Exception:
            logger.exception(
                "Agent planner failed; using deterministic fallback"
            )

        return self._fallback_plan(message)

    @staticmethod
    def _normalize_plan(parsed: Dict[str, Any]) -> Dict[str, Any]:
        allowed_intents = {
            "none",
            "information",
            "enrollment",
            "admission",
            "purchase",
            "demo",
            "contact",
            "support",
            "other",
        }

        allowed_actions = {
            "answer",
            "search_knowledge",
            "ask_clarification",
            "capture_lead",
            "guide_next_step",
        }

        intent = str(parsed.get("intent", "other")).lower()
        if intent not in allowed_intents:
            intent = "other"

        next_action = str(
            parsed.get("next_action", "answer")
        ).lower()
        if next_action not in allowed_actions:
            next_action = "answer"

        entities = parsed.get("entities")
        if not isinstance(entities, dict):
            entities = {}

        missing = parsed.get("missing_information")
        if not isinstance(missing, list):
            missing = []

        try:
            confidence = float(parsed.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5

        confidence = max(0.0, min(1.0, confidence))

        return {
            "use_knowledge": bool(parsed.get("use_knowledge", False)),
            "capture_lead": bool(parsed.get("capture_lead", False)),
            "intent": intent,
            "sub_intent": str(parsed.get("sub_intent", "unknown")),
            "user_goal": str(parsed.get("user_goal", "unknown")),
            "user_stage": str(parsed.get("user_stage", "unknown")),
            "entities": entities,
            "missing_information": [
                str(item) for item in missing[:10]
            ],
            "next_action": next_action,
            "confidence": confidence,
            "reason": str(parsed.get("reason", "")),
        }

    # ===================================================================
    # DETERMINISTIC FALLBACK
    # ===================================================================

    @staticmethod
    def _fallback_plan(message: str) -> Dict[str, Any]:
        lower = (message or "").lower()

        knowledge_terms = (
            "fee",
            "fees",
            "price",
            "course",
            "courses",
            "program",
            "programs",
            "admission",
            "eligibility",
            "timing",
            "hours",
            "location",
            "address",
            "placement",
            "refund",
            "policy",
            "batch",
            "campus",
            "scholarship",
            "hostel",
            "exam",
        )

        lead_terms = (
            "enroll",
            "enrollment",
            "join",
            "buy",
            "purchase",
            "demo",
            "contact me",
            "call me",
            "apply",
            "application",
            "register",
        )

        use_knowledge = any(term in lower for term in knowledge_terms)
        capture_lead = any(term in lower for term in lead_terms)

        if any(
            greeting in lower.strip()
            for greeting in ("hi", "hello", "hey", "good morning", "good evening")
        ):
            intent = "none"
        elif capture_lead:
            intent = "enrollment"
        elif use_knowledge:
            intent = "information"
        else:
            intent = "other"

        if use_knowledge:
            next_action = "search_knowledge"
        else:
            next_action = "guide_next_step" if capture_lead else "answer"

        return {
            "use_knowledge": use_knowledge,
            "capture_lead": capture_lead,
            "intent": intent,
            "sub_intent": "unknown",
            "user_goal": "understand_or_complete_request",
            "user_stage": "unknown",
            "entities": {},
            "missing_information": [],
            "next_action": next_action,
            "confidence": 0.55,
            "reason": "deterministic planner fallback",
        }

    # ===================================================================
    # RAG QUERY ENRICHMENT
    # ===================================================================

    @staticmethod
    def _build_retrieval_query(
        message: str,
        plan: Dict[str, Any],
    ) -> str:
        """
        Make follow-up questions more searchable without changing the
        original user message.

        Example:
        User: "Tell me about BCA"
        User: "what are the fees?"

        The second query can become:
        "what are the fees? Course: BCA"
        """
        parts = [message.strip()]

        entities = plan.get("entities") or {}

        if isinstance(entities, dict):
            for key, value in entities.items():
                if value is None:
                    continue

                value_text = str(value).strip()

                if not value_text:
                    continue

                # Keep the enrichment small and factual.
                parts.append(f"{key}: {value_text}")

        return " | ".join(parts)

    # ===================================================================
    # CONVERSATION HISTORY
    # ===================================================================

    async def _get_user_messages(
        self,
        *,
        conversation_id: Optional[str],
        max_messages: int = 100,
    ):
        """
        Reuse the existing database handle when available.

        History failures return [] because history is an enhancement, not a
        requirement for normal chat.
        """
        if not conversation_id or not self.lead_service:
            return []

        try:
            db = getattr(self.lead_service, "_db", None)

            if db is None:
                return []

            messages_collection = db.messages

            return await messages_collection.find(
                {
                    "conversation_id": conversation_id,
                    "role": "user",
                }
            ).sort("timestamp", 1).to_list(length=max_messages)

        except Exception:
            logger.exception(
                "Failed to retrieve previous user messages"
            )
            return []

    # ===================================================================
    # LEAD EXTRACTION
    # ===================================================================

    @staticmethod
    def _clean_name(name: Optional[str]) -> Optional[str]:
        if not name:
            return None

        cleaned = str(name).strip()

        if not cleaned:
            return None

        if PHONE_RE.fullmatch(cleaned):
            return None

        if len(cleaned) > 80:
            return None

        return cleaned

    @staticmethod
    def _find_name_in_messages(messages) -> Optional[str]:
        for item in reversed(messages or []):
            content = item.get("content", "")
            name = AgentService._extract_name(content)

            if name:
                return name

        return None

    @staticmethod
    def _find_phone_in_messages(messages) -> Optional[str]:
        for item in reversed(messages or []):
            content = item.get("content", "")
            phone = AgentService._extract_phone(content)

            if phone:
                return phone

        return None

    @staticmethod
    def _extract_phone(message: str) -> Optional[str]:
        if not message:
            return None

        match = PHONE_RE.search(message)

        if not match:
            return None

        phone = match.group(0).strip()

        normalized = re.sub(r"[()\s.-]", "", phone)
        digits = re.sub(r"\D", "", normalized)

        if len(digits) < 10 or len(digits) > 15:
            return None

        if normalized.startswith("+"):
            return f"+{digits}"

        return digits

    @staticmethod
    def _extract_name(message: str) -> Optional[str]:
        """
        Conservative extraction.

        Handles:
        "My name is Sam"
        "My name is Sam and my number is 9876543210"

        while avoiding storing:
        "Sam and my number is ..."
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

        name = re.split(
            r"\b(?:and\s+)?(?:my\s+)?"
            r"(?:phone|mobile|number|contact)\b",
            name,
            maxsplit=1,
            flags=re.I,
        )[0].strip(" ,;:-")

        return name or None

    # ===================================================================
    # JSON PARSING
    # ===================================================================

    @staticmethod
    def _parse_json(raw: str) -> Optional[Dict[str, Any]]:
        if not raw:
            return None

        raw = raw.strip()

        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

        # Some models occasionally wrap JSON in markdown/code or extra text.
        match = re.search(r"\{.*\}", raw, re.S)

        if not match:
            return None

        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
