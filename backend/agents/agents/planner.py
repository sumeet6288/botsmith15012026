"""
PlannerAgent - Breaks a high-level goal into an ordered list of subtasks.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from agentflow.agents.base import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class Plan:
    """Structured plan produced by the PlannerAgent."""

    def __init__(self, goal: str, steps: List[Dict]):
        self.goal = goal
        self.steps: List[Dict] = steps  # [{id, description, agent, depends_on}]
        self.current_step = 0

    def next_step(self) -> Optional[Dict]:
        if self.current_step < len(self.steps):
            step = self.steps[self.current_step]
            self.current_step += 1
            return step
        return None

    def is_complete(self) -> bool:
        return self.current_step >= len(self.steps)

    def to_dict(self) -> Dict:
        return {"goal": self.goal, "steps": self.steps, "current_step": self.current_step}

    def __repr__(self):
        return f"<Plan goal={self.goal!r} steps={len(self.steps)} done={self.current_step}>"


class PlannerAgent(BaseAgent):
    """
    Decomposes a high-level goal into ordered, executable subtasks.

    The planner uses a configurable strategy:
      - "sequential": simple numbered steps
      - "dependency": DAG-based steps with explicit depends_on fields
      - "llm": delegates planning to a language model (requires llm_client)

    Example:
        planner = PlannerAgent(name="Planner", strategy="sequential")
        result = planner.execute("Build a REST API for a todo app")
        plan: Plan = result.output
    """

    def __init__(
        self,
        name: str = "PlannerAgent",
        strategy: str = "sequential",
        llm_client=None,
        max_steps: int = 10,
        **kwargs,
    ):
        super().__init__(name=name, description="Decomposes goals into subtasks", **kwargs)
        self.strategy = strategy
        self.llm_client = llm_client
        self.max_steps = max_steps

    def run(self, task: Any, context: Optional[Dict] = None) -> AgentResult:
        context = context or {}
        goal = str(task)

        try:
            if self.strategy == "llm" and self.llm_client:
                plan = self._plan_with_llm(goal, context)
            elif self.strategy == "dependency":
                plan = self._plan_dependency(goal, context)
            else:
                plan = self._plan_sequential(goal, context)

            logger.info(f"[{self.name}] Created plan with {len(plan.steps)} steps for goal: {goal[:60]}")
            return AgentResult(
                success=True,
                output=plan,
                agent_id=self.id,
                agent_name=self.name,
                metadata={"strategy": self.strategy, "num_steps": len(plan.steps)},
            )
        except Exception as exc:
            logger.error(f"[{self.name}] Planning failed: {exc}")
            return AgentResult(
                success=False,
                output=None,
                agent_id=self.id,
                agent_name=self.name,
                error=str(exc),
            )

    def _plan_sequential(self, goal: str, context: Dict) -> Plan:
        """Heuristic rule-based sequential planner."""
        keywords = goal.lower()

        # Generic task decomposition heuristics
        if any(k in keywords for k in ["build", "create", "develop", "make"]):
            steps = [
                {"id": 1, "description": f"Analyze requirements for: {goal}", "agent": "ExecutorAgent", "depends_on": []},
                {"id": 2, "description": "Design the solution architecture", "agent": "ExecutorAgent", "depends_on": [1]},
                {"id": 3, "description": "Implement the core functionality", "agent": "ExecutorAgent", "depends_on": [2]},
                {"id": 4, "description": "Write tests and validate the implementation", "agent": "ExecutorAgent", "depends_on": [3]},
                {"id": 5, "description": "Document and finalize the deliverable", "agent": "ExecutorAgent", "depends_on": [4]},
            ]
        elif any(k in keywords for k in ["research", "analyze", "study", "investigate"]):
            steps = [
                {"id": 1, "description": f"Gather information on: {goal}", "agent": "ExecutorAgent", "depends_on": []},
                {"id": 2, "description": "Synthesize and organize findings", "agent": "ExecutorAgent", "depends_on": [1]},
                {"id": 3, "description": "Identify key insights and patterns", "agent": "ExecutorAgent", "depends_on": [2]},
                {"id": 4, "description": "Produce a structured report", "agent": "ExecutorAgent", "depends_on": [3]},
            ]
        else:
            steps = [
                {"id": 1, "description": f"Understand and clarify: {goal}", "agent": "ExecutorAgent", "depends_on": []},
                {"id": 2, "description": "Execute the primary task", "agent": "ExecutorAgent", "depends_on": [1]},
                {"id": 3, "description": "Review and verify the output", "agent": "CriticAgent", "depends_on": [2]},
            ]

        return Plan(goal=goal, steps=steps[: self.max_steps])

    def _plan_dependency(self, goal: str, context: Dict) -> Plan:
        """Returns a simple DAG plan — extend with real logic as needed."""
        steps = [
            {"id": 1, "description": "Initialize and gather context", "agent": "ExecutorAgent", "depends_on": []},
            {"id": 2, "description": "Process primary task", "agent": "ExecutorAgent", "depends_on": [1]},
            {"id": 3, "description": "Validate results", "agent": "CriticAgent", "depends_on": [2]},
            {"id": 4, "description": "Compile and deliver final output", "agent": "ExecutorAgent", "depends_on": [2, 3]},
        ]
        return Plan(goal=goal, steps=steps)

    def _plan_with_llm(self, goal: str, context: Dict) -> Plan:
        """Delegates plan generation to an LLM."""
        prompt = (
            f"Break the following goal into at most {self.max_steps} clear, atomic steps.\n"
            f"Return ONLY valid JSON: {{\"steps\": [{{\"id\": 1, \"description\": \"...\", \"agent\": \"ExecutorAgent\", \"depends_on\": []}}]}}\n\n"
            f"Goal: {goal}"
        )
        response = self.llm_client.complete(prompt)
        try:
            data = json.loads(response)
            return Plan(goal=goal, steps=data["steps"])
        except (json.JSONDecodeError, KeyError) as exc:
            logger.warning(f"LLM plan parsing failed ({exc}), falling back to sequential")
            return self._plan_sequential(goal, context)
