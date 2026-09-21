"""Deterministic checks before an agent is allowed to finish."""
from __future__ import annotations

from typing import Any, Dict, List


class AgentEvaluator:
    """Deterministic guardrails for the bounded agent loop."""

    KNOWLEDGE_TERMS = (
        "policy", "policies", "acceptable use", "terms", "pricing", "price",
        "fee", "fees", "course", "courses", "program", "programs", "admission",
        "admissions", "eligibility", "refund", "location", "address", "timing",
        "hours", "placement", "scholarship", "hostel", "exam", "feature", "features",
        "service", "services", "what is", "what's", "tell me about", "about ",
        "how does", "how do", "does botsmith", "can botsmith", "botsmith ",
    )

    @classmethod
    def requires_knowledge(cls, message: str) -> bool:
        lower = (message or "").strip().lower()
        if not lower:
            return False

        # Organization/product identity questions should always use the
        # chatbot's configured knowledge instead of relying on model memory.
        if "botsmith" in lower and any(
            phrase in lower
            for phrase in (
                "what", "who", "about", "how", "can", "does", "features",
                "pricing", "price", "service", "services", "offer",
            )
        ):
            return True

        return any(term in lower for term in cls.KNOWLEDGE_TERMS)

    @staticmethod
    def has_successful_knowledge(observations: List[Dict[str, Any]]) -> bool:
        for observation in observations:
            if observation.get("tool") != "search_knowledge":
                continue
            if not observation.get("success"):
                continue
            output = observation.get("output") or {}
            if isinstance(output, dict) and output.get("has_context"):
                return True
        return False

    def can_finish(self, *, user_message: str, observations: List[Dict[str, Any]]) -> bool:
        if not self.requires_knowledge(user_message):
            return True
        return self.has_successful_knowledge(observations)
