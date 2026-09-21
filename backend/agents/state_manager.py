"""Tenant-scoped MongoDB persistence for agent execution state."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from .models import AgentRun, AgentStep, AgentTask, RunStatus, TaskStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MongoAgentStateManager:
    """Persists tasks, runs, steps and observations in existing MongoDB."""

    def __init__(self, db) -> None:
        self.db = db
        self.tasks = db.agent_tasks
        self.runs = db.agent_runs
        self.steps = db.agent_steps
        self.observations = db.agent_observations

    async def ensure_indexes(self) -> None:
        await self.tasks.create_index([("tenant_id", 1), ("id", 1)], unique=True)
        await self.runs.create_index([("tenant_id", 1), ("id", 1)], unique=True)
        await self.steps.create_index([("tenant_id", 1), ("run_id", 1), ("step_number", 1)])
        await self.observations.create_index([("tenant_id", 1), ("run_id", 1), ("step", 1)])

    async def create_task(self, task: AgentTask) -> None:
        await self.tasks.insert_one(task.model_dump(mode="json"))

    async def update_task(self, tenant_id: str, task_id: str, **changes: Any) -> None:
        changes["updated_at"] = _now()
        await self.tasks.update_one(
            {"tenant_id": tenant_id, "id": task_id},
            {"$set": changes},
        )

    async def create_run(self, run: AgentRun) -> None:
        await self.runs.insert_one(run.model_dump(mode="json"))

    async def add_step(self, step: AgentStep) -> None:
        await self.steps.insert_one(step.model_dump(mode="json"))

    async def add_observation(self, tenant_id: str, run_id: str, observation: Dict[str, Any]) -> None:
        document = {
            "tenant_id": tenant_id,
            "run_id": run_id,
            "step": observation.get("step", 0),
            "observation": observation,
            "created_at": _now(),
        }
        await self.observations.insert_one(document)

    async def get_observations(self, tenant_id: str, run_id: str) -> List[Dict[str, Any]]:
        docs = await self.observations.find(
            {"tenant_id": tenant_id, "run_id": run_id}
        ).sort("step", 1).to_list(length=20)
        return [doc.get("observation", {}) for doc in docs]

    async def finish_run(self, tenant_id: str, run_id: str, status: RunStatus, **changes: Any) -> None:
        changes["status"] = status.value
        changes["finished_at"] = _now()
        await self.runs.update_one(
            {"tenant_id": tenant_id, "id": run_id},
            {"$set": changes},
        )
