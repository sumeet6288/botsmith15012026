"""
AgentRouter - Dynamically dispatches a task to the most suitable agent.
"""

import logging
from typing import Any, Callable, Dict, List, Optional, Tuple

from agentflow.agents.base import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class AgentRouter:
    """
    Routes an incoming task to the best-matching registered agent.

    Routing strategies
    ------------------
    keyword   (default) – scores agents by keyword overlap with the task string.
    round_robin         – cycles through agents regardless of task content.
    custom              – user-supplied scoring function: fn(task, agent) -> float.

    Example
    -------
        router = AgentRouter(strategy="keyword")
        router.register(planner,  keywords=["plan", "goal", "decompose"])
        router.register(executor, keywords=["execute", "run", "do", "build"])
        router.register(critic,   keywords=["review", "evaluate", "check"])

        result = router.dispatch("Please review the output and check for errors")
        # → CriticAgent handles it
    """

    def __init__(
        self,
        strategy: str = "keyword",
        scoring_fn: Optional[Callable[[Any, BaseAgent], float]] = None,
        fallback_agent: Optional[BaseAgent] = None,
    ):
        self.strategy = strategy
        self.scoring_fn = scoring_fn
        self.fallback_agent = fallback_agent
        self._registry: List[Dict] = []   # [{agent, keywords, weight}]
        self._rr_index: int = 0

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        agent: BaseAgent,
        keywords: Optional[List[str]] = None,
        weight: float = 1.0,
    ) -> "AgentRouter":
        """Register an agent. Fluent builder — returns self."""
        self._registry.append({
            "agent": agent,
            "keywords": [k.lower() for k in (keywords or [])],
            "weight": weight,
        })
        logger.debug(f"[Router] Registered agent: {agent.name!r}")
        return self

    def unregister(self, agent_name: str) -> bool:
        before = len(self._registry)
        self._registry = [e for e in self._registry if e["agent"].name != agent_name]
        return len(self._registry) < before

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    def dispatch(self, task: Any, context: Optional[Dict] = None) -> AgentResult:
        """Select the best agent and execute the task."""
        agent = self.select(task)
        if agent is None:
            if self.fallback_agent:
                logger.warning("[Router] No match found; using fallback agent.")
                agent = self.fallback_agent
            else:
                return AgentResult(
                    success=False,
                    output=None,
                    agent_id="router",
                    agent_name="AgentRouter",
                    error="No suitable agent found and no fallback configured.",
                )
        logger.info(f"[Router] Dispatching to: {agent.name!r}")
        return agent.execute(task, context or {})

    def select(self, task: Any) -> Optional[BaseAgent]:
        """Return the best agent without executing."""
        if not self._registry:
            return None

        if self.strategy == "round_robin":
            return self._select_round_robin()
        if self.strategy == "custom" and self.scoring_fn:
            return self._select_custom(task)
        return self._select_keyword(task)

    # ------------------------------------------------------------------
    # Strategies
    # ------------------------------------------------------------------

    def _select_keyword(self, task: Any) -> Optional[BaseAgent]:
        task_str = str(task).lower()
        best_agent, best_score = None, -1.0

        for entry in self._registry:
            keywords: List[str] = entry["keywords"]
            weight: float = entry["weight"]

            if not keywords:
                score = 0.1 * weight  # small baseline for agents with no keywords
            else:
                hits = sum(1 for kw in keywords if kw in task_str)
                score = (hits / len(keywords)) * weight

            if score > best_score:
                best_score = score
                best_agent = entry["agent"]

        return best_agent

    def _select_round_robin(self) -> BaseAgent:
        agent = self._registry[self._rr_index % len(self._registry)]["agent"]
        self._rr_index += 1
        return agent

    def _select_custom(self, task: Any) -> Optional[BaseAgent]:
        best_agent, best_score = None, float("-inf")
        for entry in self._registry:
            score = float(self.scoring_fn(task, entry["agent"]))
            if score > best_score:
                best_score = score
                best_agent = entry["agent"]
        return best_agent

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def list_agents(self) -> List[str]:
        return [e["agent"].name for e in self._registry]

    def score_all(self, task: Any) -> List[Tuple[str, float]]:
        """Return (agent_name, score) for every registered agent (keyword mode)."""
        task_str = str(task).lower()
        scores = []
        for entry in self._registry:
            keywords = entry["keywords"]
            weight = entry["weight"]
            hits = sum(1 for kw in keywords if kw in task_str)
            score = (hits / max(len(keywords), 1)) * weight
            scores.append((entry["agent"].name, round(score, 4)))
        return sorted(scores, key=lambda x: x[1], reverse=True)

    def __repr__(self) -> str:
        return f"<AgentRouter strategy={self.strategy!r} agents={self.list_agents()}>"
