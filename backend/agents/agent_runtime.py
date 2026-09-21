"""Bounded autonomous loop: understand -> plan -> act -> observe -> verify."""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from .context_builder import ContextBuilder
from .evaluator import AgentEvaluator
from .executor import ToolExecutor
from .memory_manager import MongoMemoryManager
from .models import AgentContext, AgentDefinition, AgentRun, AgentStep, AgentTask, RunStatus, TaskStatus
from .planner import AgentPlanner
from .state_manager import MongoAgentStateManager

logger = logging.getLogger(__name__)


class AgentRuntime:
    def __init__(
        self,
        *,
        planner: AgentPlanner,
        executor: ToolExecutor,
        state_manager: MongoAgentStateManager,
        memory_manager: MongoMemoryManager,
        evaluator: AgentEvaluator,
        context_builder: ContextBuilder,
    ) -> None:
        self.planner = planner
        self.executor = executor
        self.state = state_manager
        self.memory = memory_manager
        self.evaluator = evaluator
        self.context_builder = context_builder

    async def run(
        self,
        *,
        agent: AgentDefinition,
        task: AgentTask,
        conversation: List[Dict[str, Any]],
        model: str,
        provider: str,
        answer_writer,
    ) -> Dict[str, Any]:
        if agent.tenant_id != task.tenant_id or agent.chatbot_id != task.chatbot_id:
            raise PermissionError("Agent/task tenant or chatbot mismatch")

        run = AgentRun(
            tenant_id=task.tenant_id,
            agent_id=agent.id,
            task_id=task.id,
        )
        await self.state.create_task(task)
        await self.state.create_run(run)

        observations: List[Dict[str, Any]] = []
        tool_call_count = 0

        try:
            for step_number in range(1, min(agent.max_steps, task.max_steps) + 1):
                task.current_step = step_number
                await self.state.update_task(
                    task.tenant_id,
                    task.id,
                    current_step=step_number,
                    status=TaskStatus.RUNNING.value,
                )

                memories = await self.memory.recall(
                    tenant_id=task.tenant_id,
                    chatbot_id=task.chatbot_id,
                    conversation_id=task.conversation_id,
                )

                context = AgentContext(
                    tenant_id=task.tenant_id,
                    agent=agent,
                    task=task,
                    run=run,
                    conversation=conversation,
                    observations=observations,
                    memories=memories,
                    available_tools=self.executor.registry.definitions(agent.tool_names),
                )

                decision = await self.planner.plan(
                    context=context,
                    model=model,
                    provider=provider,
                    session_id=f"{task.session_id}:agent-step-{step_number}",
                )

                if decision.action == "answer":
                    if not self.evaluator.can_finish(
                        user_message=task.goal,
                        observations=observations,
                    ):
                        # Do not trust the model's premature answer on a knowledge question.
                        decision.action = "search_knowledge"
                        decision.tool_call = self._build_forced_search(task.goal, observations)
                    else:
                        final_answer = await answer_writer(
                            task=task,
                            agent=agent,
                            conversation=conversation,
                            observations=observations,
                        )
                        await self.state.update_task(
                            task.tenant_id,
                            task.id,
                            status=TaskStatus.COMPLETED.value,
                            result=final_answer,
                        )
                        await self.state.finish_run(
                            task.tenant_id,
                            run.id,
                            RunStatus.COMPLETED,
                            step_count=step_number,
                            tool_call_count=tool_call_count,
                            final_output=final_answer,
                        )
                        return {
                            "response": final_answer,
                            "used_knowledge": any(
                                obs.get("tool") == "search_knowledge" and obs.get("success")
                                for obs in observations
                            ),
                            "observations": observations,
                            "run_id": run.id,
                        }

                if decision.action not in {"search_knowledge", "capture_lead"} or not decision.tool_call:
                    # Deterministic recovery instead of an unsafe/invalid action.
                    if self.evaluator.requires_knowledge(task.goal) and not any(
                        obs.get("tool") == "search_knowledge" and obs.get("success")
                        for obs in observations
                    ):
                        decision.tool_call = self._build_forced_search(task.goal, observations)
                        decision.action = "search_knowledge"
                    else:
                        raise RuntimeError("Agent planner returned an invalid action")

                result = await self.executor.execute(
                    tenant_id=task.tenant_id,
                    agent=agent,
                    call=decision.tool_call,
                )
                tool_call_count += 1

                observation = {
                    "step": step_number,
                    "tool": decision.tool_call.tool_name,
                    "success": result.success,
                    "output": result.output,
                    "error": result.error,
                }
                observations.append(observation)

                await self.state.add_step(
                    AgentStep(
                        tenant_id=task.tenant_id,
                        run_id=run.id,
                        step_number=step_number,
                        action="tool_call",
                        tool_call=decision.tool_call,
                        tool_result=result,
                        observation=observation,
                    )
                )
                await self.state.add_observation(task.tenant_id, run.id, observation)

                # IMPORTANT:
                # A successful knowledge search is sufficient to move to the
                # final answer stage. Do not call the planner again and allow
                # it to repeat search_knowledge unnecessarily.
                if (
                    decision.tool_call.tool_name == "search_knowledge"
                    and result.success
                ):
                    final_answer = await answer_writer(
                        task=task,
                        agent=agent,
                        conversation=conversation,
                        observations=observations,
                    )
                    await self.state.update_task(
                        task.tenant_id,
                        task.id,
                        status=TaskStatus.COMPLETED.value,
                        result=final_answer,
                    )
                    await self.state.finish_run(
                        task.tenant_id,
                        run.id,
                        RunStatus.COMPLETED,
                        step_count=step_number,
                        tool_call_count=tool_call_count,
                        final_output=final_answer,
                    )
                    return {
                        "response": final_answer,
                        "used_knowledge": True,
                        "observations": observations,
                        "run_id": run.id,
                    }

                # Tool errors are observations, not runtime crashes. The next
                # planner step decides whether recovery is possible.
                if not result.success:
                    logger.warning(
                        "Agent tool failed: tool=%s error=%s",
                        decision.tool_call.tool_name,
                        result.error,
                    )

            # We reached the autonomy budget. Produce a safe final response rather than crashing.
            final_answer = await answer_writer(
                task=task,
                agent=agent,
                conversation=conversation,
                observations=observations,
                budget_exhausted=True,
            )
            await self.state.update_task(
                task.tenant_id,
                task.id,
                status=TaskStatus.COMPLETED.value,
                result=final_answer,
            )
            await self.state.finish_run(
                task.tenant_id,
                run.id,
                RunStatus.COMPLETED,
                step_count=min(agent.max_steps, task.max_steps),
                tool_call_count=tool_call_count,
                final_output=final_answer,
            )
            return {
                "response": final_answer,
                "used_knowledge": any(
                    obs.get("tool") == "search_knowledge" and obs.get("success")
                    for obs in observations
                ),
                "observations": observations,
                "run_id": run.id,
            }

        except Exception as exc:
            logger.exception("Agent runtime failed")
            await self.state.update_task(
                task.tenant_id,
                task.id,
                status=TaskStatus.FAILED.value,
                error=str(exc),
            )
            await self.state.finish_run(
                task.tenant_id,
                run.id,
                RunStatus.FAILED,
                step_count=task.current_step,
                tool_call_count=tool_call_count,
                error=str(exc),
            )
            raise

    @staticmethod
    def _build_forced_search(goal: str, observations: List[Dict[str, Any]]):
        query = goal
        previous = [
            str(obs.get("output", {}).get("context", ""))[:1000]
            for obs in observations
            if obs.get("tool") == "search_knowledge"
        ]
        if previous:
            query = f"{goal} specific policy details conditions exceptions"
        from .models import ToolCall
        return ToolCall(
            tool_name="search_knowledge",
            arguments={"query": query, "top_k": 4},
        )
