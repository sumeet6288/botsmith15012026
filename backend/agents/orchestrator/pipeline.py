"""
AgentPipeline - Orchestrates multiple agents in sequence or parallel.
"""

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from agentflow.agents.base import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


@dataclass
class PipelineRun:
    """Captures the complete record of a pipeline execution."""
    pipeline_name: str
    task: Any
    steps: List[Dict] = field(default_factory=list)
    final_output: Any = None
    success: bool = False
    total_time: float = 0.0
    error: Optional[str] = None

    def add_step(self, agent_name: str, result: AgentResult, duration: float) -> None:
        self.steps.append({
            "agent": agent_name,
            "success": result.success,
            "output_preview": str(result.output)[:200],
            "error": result.error,
            "duration_s": round(duration, 4),
        })

    def to_dict(self) -> Dict:
        return {
            "pipeline": self.pipeline_name,
            "task_preview": str(self.task)[:120],
            "success": self.success,
            "total_time_s": round(self.total_time, 4),
            "steps": self.steps,
            "final_output_preview": str(self.final_output)[:300],
            "error": self.error,
        }


class AgentPipeline:
    """
    Executes a list of agents in a defined order, passing context forward.

    Modes
    -----
    sequential (default)
        Each agent receives the previous agent's output as its task.
        The pipeline halts on the first failure unless `stop_on_failure=False`.

    parallel
        All agents receive the *same* initial task and run concurrently.
        Results are collected into a list and passed as context["parallel_results"].

    plan_execute
        Expects the first agent to be a PlannerAgent. Subsequent agents are
        dispatched step-by-step according to the plan.

    Example
    -------
        pipeline = AgentPipeline(
            name="ResearchPipeline",
            agents=[planner, executor, critic],
            mode="sequential",
        )
        run = pipeline.run("Write a technical blog post about LLMs")
        print(run.final_output)
    """

    def __init__(
        self,
        name: str = "Pipeline",
        agents: Optional[List[BaseAgent]] = None,
        mode: str = "sequential",
        stop_on_failure: bool = True,
        max_workers: int = 4,
        shared_context: Optional[Dict] = None,
    ):
        self.name = name
        self.agents: List[BaseAgent] = agents or []
        self.mode = mode
        self.stop_on_failure = stop_on_failure
        self.max_workers = max_workers
        self.shared_context: Dict = shared_context or {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_agent(self, agent: BaseAgent) -> "AgentPipeline":
        """Fluent builder method."""
        self.agents.append(agent)
        return self

    def run(self, task: Any) -> PipelineRun:
        run = PipelineRun(pipeline_name=self.name, task=task)
        t0 = time.perf_counter()

        try:
            if self.mode == "parallel":
                self._run_parallel(task, run)
            elif self.mode == "plan_execute":
                self._run_plan_execute(task, run)
            else:
                self._run_sequential(task, run)
        except Exception as exc:
            run.error = str(exc)
            run.success = False
            logger.error(f"[{self.name}] Pipeline crashed: {exc}")
        finally:
            run.total_time = time.perf_counter() - t0

        logger.info(
            f"[{self.name}] Finished in {run.total_time:.2f}s | "
            f"success={run.success} | steps={len(run.steps)}"
        )
        return run

    # ------------------------------------------------------------------
    # Execution strategies
    # ------------------------------------------------------------------

    def _run_sequential(self, task: Any, run: PipelineRun) -> None:
        context = dict(self.shared_context)
        current_input = task

        for agent in self.agents:
            t0 = time.perf_counter()
            result = agent.execute(current_input, context)
            duration = time.perf_counter() - t0
            run.add_step(agent.name, result, duration)

            if not result.success:
                run.success = False
                run.error = f"Agent '{agent.name}' failed: {result.error}"
                if self.stop_on_failure:
                    logger.warning(f"[{self.name}] Halting pipeline at '{agent.name}'")
                    return
            else:
                context["previous_output"] = result.output
                context.setdefault("all_outputs", []).append(result.output)
                current_input = result.output

        run.final_output = current_input
        run.success = True

    def _run_parallel(self, task: Any, run: PipelineRun) -> None:
        context = dict(self.shared_context)
        results = {}

        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            futures = {pool.submit(agent.execute, task, dict(context)): agent for agent in self.agents}
            for future in as_completed(futures):
                agent = futures[future]
                t_done = time.perf_counter()
                try:
                    result = future.result()
                except Exception as exc:
                    result = AgentResult(
                        success=False, output=None,
                        agent_id=agent.id, agent_name=agent.name,
                        error=str(exc),
                    )
                run.add_step(agent.name, result, 0.0)
                results[agent.name] = result.output if result.success else None

        run.final_output = results
        run.success = all(s["success"] for s in run.steps)

    def _run_plan_execute(self, task: Any, run: PipelineRun) -> None:
        if not self.agents:
            raise ValueError("plan_execute mode requires at least one agent (PlannerAgent).")

        planner = self.agents[0]
        executors = self.agents[1:] if len(self.agents) > 1 else self.agents

        # Step 1: Plan
        t0 = time.perf_counter()
        plan_result = planner.execute(task, dict(self.shared_context))
        run.add_step(planner.name, plan_result, time.perf_counter() - t0)

        if not plan_result.success:
            run.success = False
            run.error = f"Planning failed: {plan_result.error}"
            return

        plan = plan_result.output
        context = dict(self.shared_context)
        context["plan"] = plan.to_dict() if hasattr(plan, "to_dict") else str(plan)
        step_outputs = []

        # Step 2: Execute each plan step
        while not plan.is_complete():
            step = plan.next_step()
            if not step:
                break

            executor = self._select_executor(step.get("agent", ""), executors)
            t0 = time.perf_counter()
            result = executor.execute(step["description"], context)
            run.add_step(executor.name, result, time.perf_counter() - t0)

            if not result.success and self.stop_on_failure:
                run.success = False
                run.error = f"Step {step['id']} failed: {result.error}"
                return

            context["previous_output"] = result.output
            step_outputs.append({"step": step["description"], "output": result.output})

        run.final_output = step_outputs
        run.success = True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _select_executor(self, preferred_name: str, executors: List[BaseAgent]) -> BaseAgent:
        for agent in executors:
            if agent.name == preferred_name or agent.__class__.__name__ == preferred_name:
                return agent
        return executors[0] if executors else self.agents[-1]

    def __repr__(self) -> str:
        agent_names = [a.name for a in self.agents]
        return f"<AgentPipeline name={self.name!r} agents={agent_names} mode={self.mode!r}>"
