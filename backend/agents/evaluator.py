"""Deterministic checks before an agent is allowed to finish."""
from __future__ import annotations

from typing import Any, Dict, List


class AgentEvaluator:
    KNOWLEDGE_TERMS = (
        "policy", "policies", "acceptable use", "terms", "pricing", "price",
        "fee", "fees", "course", "courses", "program", "programs", "admission",
        "admissions", "eligibility", "refund", "location", "address", "timing",
        "hours", "placement", "scholarship", "hostel", "exam", "feature", "features",
        "service", "services",
    )

    @classmethod
    def requires_knowledge(cls, message: str) -> bool:
        lower = (message or "").lower()
        return any(term in lower for term in cls.KNOWLEDGE_TERMS)

    def can_finish(self, *, user_message: str, observations: List[Dict[str, Any]]) -> bool:
        if not self.requires_knowledge(user_message):
            return True
        for observation in observations:
            if observation.get("tool") == "search_knowledge" and observation.get("success"):
                output = observation.get("output") or {}
                if output.get("has_context"):
                    return True
        return False
