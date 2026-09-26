"""
ExecutorAgent - Carries out individual subtasks produced by the PlannerAgent.
"""

import logging
from typing import Any, Callable, Dict, List, Optional

from agentflow.agents.base import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class ExecutorAgent(BaseAgent):
    """
    Executes a single subtask, optionally using registered tools or an LLM.

    Supports three execution modes:
      - "tool"   : routes the task to the best matching tool
      - "llm"    : sends the task to a language model
      - "hybrid" : tries tools first, falls back to LLM

    Example:
        executor = ExecutorAgent(name="Executor", mode="llm", llm_client=my_llm)
        result = executor.execute("Summarise the following text: ...")
    """

    def __init__(
        self,
        name: str = "ExecutorAgent",
        mode: str = "tool",
        llm_client=None,
        custom_handler: Optional[Callable[[str, Dict], Any]] = None,
        **kwargs,
    ):
        super().__init__(name=name, description="Executes individual subtasks", **kwargs)
        self.mode = mode
        self.llm_client = llm_client
        self.custom_handler = custom_handler

    # ------------------------------------------------------------------
    # Core
    # ------------------------------------------------------------------

    def run(self, task: Any, context: Optional[Dict] = None) -> AgentResult:
        context = context or {}
        task_str = str(task)

        try:
            if self.custom_handler:
                output = self.custom_handler(task_str, context)
            elif self.mode == "llm" and self.llm_client:
                output = self._run_llm(task_str, context)
            elif self.mode == "hybrid":
                output = self._run_hybrid(task_str, context)
            else:
                output = self._run_tools(task_str, context)

            logger.info(f"[{self.name}] Task completed: {task_str[:60]}")
            return AgentResult(
                success=True,
                output=output,
                agent_id=self.id,
                agent_name=self.name,
                metadata={"mode": self.mode, "task_preview": task_str[:120]},
            )
        except Exception as exc:
            logger.error(f"[{self.name}] Execution error: {exc}")
            return AgentResult(
                success=False,
                output=None,
                agent_id=self.id,
                agent_name=self.name,
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Execution strategies
    # ------------------------------------------------------------------

    def _run_tools(self, task: str, context: Dict) -> Any:
        """Try to match the task to a registered tool."""
        if not self.tools:
            return self._fallback_execute(task, context)

        best_tool = self._select_tool(task)
        if best_tool:
            logger.debug(f"[{self.name}] Using tool: {best_tool.name}")
            return best_tool.execute(task=task, context=context)
        return self._fallback_execute(task, context)

    def _run_llm(self, task: str, context: Dict) -> Any:
        """Delegate execution to a language model."""
        system_prompt = (
            "You are a highly capable AI executor. "
            "Complete the assigned task accurately and concisely."
        )
        context_str = ""
        if context.get("previous_results"):
            context_str = f"\n\nPrevious results:\n{context['previous_results']}"

        prompt = f"{system_prompt}\n\nTask: {task}{context_str}"
        return self.llm_client.complete(prompt)

    def _run_hybrid(self, task: str, context: Dict) -> Any:
        """Try tools first; fall back to LLM if no tool matches."""
        if self.tools:
            best_tool = self._select_tool(task)
            if best_tool:
                return best_tool.execute(task=task, context=context)
        if self.llm_client:
            return self._run_llm(task, context)
        return self._fallback_execute(task, context)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _select_tool(self, task: str):
        """Simple keyword-based tool selection. Override for smarter routing."""
        task_lower = task.lower()
        best, best_score = None, 0
        for tool in self.tools:
            keywords: List[str] = getattr(tool, "keywords", [])
            score = sum(1 for kw in keywords if kw.lower() in task_lower)
            if score > best_score:
                best, best_score = tool, score
        return best if best_score > 0 else (self.tools[0] if self.tools else None)

    def _fallback_execute(self, task: str, context: Dict) -> str:
        """Minimal fallback when no tool or LLM is available."""
        logger.warning(f"[{self.name}] No tool/LLM available; returning stub result.")
        return f"[STUB] Task acknowledged: {task}"
