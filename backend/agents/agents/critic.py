"""
CriticAgent - Reviews, scores, and optionally re-queues task results.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from agentflow.agents.base import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


@dataclass
class CriticReport:
    """Structured output from CriticAgent."""
    score: float          # 0.0 – 1.0
    passed: bool
    feedback: str
    suggestions: List[str] = field(default_factory=list)
    should_retry: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "score": self.score,
            "passed": self.passed,
            "feedback": self.feedback,
            "suggestions": self.suggestions,
            "should_retry": self.should_retry,
            "metadata": self.metadata,
        }


class CriticAgent(BaseAgent):
    """
    Evaluates the output of another agent and decides whether it passes.

    Evaluation modes:
      - "heuristic": rule-based checks (length, keywords, non-empty)
      - "llm"      : asks an LLM to score and provide feedback
      - "custom"   : user-supplied scoring function

    Example:
        critic = CriticAgent(name="Critic", pass_threshold=0.7)
        result = critic.execute({"task": "Write a summary", "output": "Here is..."})
        report: CriticReport = result.output
        if report.should_retry:
            # re-run the executor ...
    """

    def __init__(
        self,
        name: str = "CriticAgent",
        mode: str = "heuristic",
        pass_threshold: float = 0.6,
        llm_client=None,
        scoring_fn=None,
        **kwargs,
    ):
        super().__init__(name=name, description="Reviews and scores agent outputs", **kwargs)
        self.mode = mode
        self.pass_threshold = pass_threshold
        self.llm_client = llm_client
        self.scoring_fn = scoring_fn

    # ------------------------------------------------------------------
    # Core
    # ------------------------------------------------------------------

    def run(self, task: Any, context: Optional[Dict] = None) -> AgentResult:
        """
        Args:
            task: A dict with keys "task" (original goal) and "output" (result to review),
                  or a plain string (output only).
        """
        context = context or {}

        if isinstance(task, dict):
            original_task = task.get("task", "")
            output = task.get("output", "")
        else:
            original_task = context.get("task", "")
            output = str(task)

        try:
            if self.mode == "llm" and self.llm_client:
                report = self._evaluate_llm(original_task, output, context)
            elif self.mode == "custom" and self.scoring_fn:
                report = self._evaluate_custom(original_task, output, context)
            else:
                report = self._evaluate_heuristic(original_task, output, context)

            status = "PASS" if report.passed else "FAIL"
            logger.info(f"[{self.name}] Evaluation: {status} (score={report.score:.2f})")
            return AgentResult(
                success=True,
                output=report,
                agent_id=self.id,
                agent_name=self.name,
                metadata={"score": report.score, "passed": report.passed},
            )
        except Exception as exc:
            logger.error(f"[{self.name}] Critic error: {exc}")
            return AgentResult(
                success=False,
                output=None,
                agent_id=self.id,
                agent_name=self.name,
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Evaluation strategies
    # ------------------------------------------------------------------

    def _evaluate_heuristic(self, task: str, output: str, context: Dict) -> CriticReport:
        output_str = str(output)
        suggestions = []
        score = 1.0

        # Check 1: non-empty
        if not output_str.strip():
            return CriticReport(
                score=0.0, passed=False,
                feedback="Output is empty.",
                suggestions=["Re-run the executor with a more specific prompt."],
                should_retry=True,
            )

        # Check 2: minimum length (task-dependent)
        min_len = 20 if "summary" in task.lower() else 10
        if len(output_str) < min_len:
            score -= 0.3
            suggestions.append("Output is too short; provide more detail.")

        # Check 3: no obvious error markers
        error_markers = ["error:", "exception:", "traceback", "undefined", "[stub]"]
        if any(m in output_str.lower() for m in error_markers):
            score -= 0.4
            suggestions.append("Output contains error indicators; the task may have failed.")

        # Check 4: relevant to task (keyword overlap)
        task_words = set(task.lower().split())
        output_words = set(output_str.lower().split())
        overlap = len(task_words & output_words) / max(len(task_words), 1)
        if overlap < 0.1:
            score -= 0.2
            suggestions.append("Output may not be relevant to the original task.")

        score = max(0.0, min(1.0, score))
        passed = score >= self.pass_threshold

        return CriticReport(
            score=score,
            passed=passed,
            feedback=f"Heuristic score: {score:.2f}. {'Acceptable output.' if passed else 'Output needs improvement.'}",
            suggestions=suggestions,
            should_retry=not passed,
        )

    def _evaluate_llm(self, task: str, output: str, context: Dict) -> CriticReport:
        prompt = (
            "You are a strict quality-control reviewer.\n"
            f"Original task: {task}\n"
            f"Agent output: {output}\n\n"
            "Score the output from 0.0 to 1.0 and provide brief feedback.\n"
            "Respond in JSON: {\"score\": <float>, \"feedback\": \"...\", \"suggestions\": [\"...\"]}"
        )
        import json
        raw = self.llm_client.complete(prompt)
        try:
            data = json.loads(raw)
            score = float(data.get("score", 0.5))
            passed = score >= self.pass_threshold
            return CriticReport(
                score=score,
                passed=passed,
                feedback=data.get("feedback", ""),
                suggestions=data.get("suggestions", []),
                should_retry=not passed,
            )
        except Exception:
            return self._evaluate_heuristic(task, output, context)

    def _evaluate_custom(self, task: str, output: str, context: Dict) -> CriticReport:
        score = float(self.scoring_fn(task, output, context))
        passed = score >= self.pass_threshold
        return CriticReport(
            score=score,
            passed=passed,
            feedback=f"Custom scorer returned {score:.2f}.",
            should_retry=not passed,
        )
