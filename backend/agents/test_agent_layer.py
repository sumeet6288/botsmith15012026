"""Focused unit tests for the old BotSmith agent architecture."""

from __future__ import annotations

import asyncio

import pytest

from agents.context import AgentContext
from agents.executor import AgentExecutionError, Executor
from agents.models import AgentConfig, ExecutionLimits, PlanDecision
from agents.planner import Planner
from agents.registry import (
    InvalidToolArgumentsError,
    ToolRegistry,
    ToolRegistryError,
    UnknownToolError,
)
from agents.runtime import AgentRuntime, agents_enabled
from agents.state import AgentState, AgentStateStore
from agents.tools.base import Tool


class EchoTool(Tool):
    name: str = "echo"
    description: str = "Echo a value."
    input_schema: dict = {
        "type": "object",
        "required": ["value"],
        "properties": {
            "value": {"type": "string", "minLength": 1},
        },
        "additionalProperties": False,
    }

    async def execute(self, arguments: dict) -> dict:
        return {"echo": arguments["value"]}


class FakeChatService:
    def __init__(self, planner_json: str):
        self.planner_json = planner_json
        self.calls = []

    async def generate_response(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs["session_id"].endswith(":agent-planner"):
            if isinstance(self.planner_json, list):
                return self.planner_json.pop(0), None
            return self.planner_json, None
        return "The requested action is complete.", None


async def _legacy_runner(**request):
    return {
        "response": "legacy response",
        "citation_footer": None,
        "plan": {"intent": "general"},
        "lead": None,
        "lead_captured": False,
        "used_knowledge": False,
        "intent": "general",
    }


def _context(task: str = "hello") -> AgentContext:
    return AgentContext(
        system_instructions="Be helpful.",
        user_task=task,
        chatbot_id="chatbot-a",
        session_id="session-a",
        model="gpt-4o-mini",
        provider="openai",
        max_steps=4,
        max_tool_calls=2,
        max_runtime_seconds=10,
        max_retries=0,
        max_result_chars=10_000,
    )


def test_context_builder_preserves_execution_limits():
    config = AgentConfig(
        chatbot_id="chatbot-a",
        session_id="session-a",
        limits=ExecutionLimits(max_steps=8, max_tool_calls=4),
    )
    from agents.context import ContextBuilder

    context = ContextBuilder.build(config, "  schedule a meeting  ")
    assert context.user_task == "schedule a meeting"
    assert context.max_steps == 8
    assert context.max_tool_calls == 4


def test_planner_scheduling_fallback_selects_only_registered_tool():
    decision = Planner.decide(
        _context("Please schedule a meeting"),
        [{"name": "calendly_get_event_types"}],
    )
    assert decision.action == "tool"
    assert decision.tool_name == "calendly_get_event_types"

    delegated = Planner.decide(_context("Please schedule a meeting"), [])
    assert delegated.action == "delegate"


def test_registry_validates_arguments_and_unknown_tools():
    registry = ToolRegistry()
    registry.register(EchoTool())
    assert registry.exists("echo")
    assert registry.validate("echo", {"value": "ok"})
    assert not registry.validate("echo", {"value": ""})
    assert not registry.validate("echo", {"value": "ok", "extra": True})
    with pytest.raises(UnknownToolError):
        registry.get("missing")
    with pytest.raises(InvalidToolArgumentsError):
        asyncio.run(registry.execute("echo", {}))


def test_registry_rejects_duplicate_tools_without_overwriting():
    registry = ToolRegistry()
    registry.register(EchoTool())
    with pytest.raises(ToolRegistryError):
        registry.register(EchoTool())


def test_executor_executes_registered_tool_and_records_result():
    registry = ToolRegistry()
    registry.register(EchoTool())
    state = AgentState(
        chatbot_id="chatbot-a",
        task="echo",
        limits=ExecutionLimits(max_tool_calls=1),
    )
    result = asyncio.run(
        Executor(_legacy_runner, registry).execute(
            decision=PlanDecision(
                action="tool",
                tool_name="echo",
                arguments={"value": "hello"},
            ),
            context=_context(),
            state=state,
            request={},
        )
    )
    assert result["tool_result"] == {"echo": "hello"}
    assert state.tool_call_count == 1


def test_executor_rejects_unknown_tool_instead_of_delegating():
    registry = ToolRegistry()
    state = AgentState(chatbot_id="chatbot-a", task="echo")
    with pytest.raises(AgentExecutionError):
        asyncio.run(
            Executor(_legacy_runner, registry).execute(
                decision=PlanDecision(
                    action="tool",
                    tool_name="missing",
                    arguments={},
                ),
                context=_context(),
                state=state,
                request={},
            )
        )


def test_runtime_delegates_normal_requests_and_preserves_response_contract():
    chat = FakeChatService(
        '{"action":"delegate","reason":"normal BotSmith request",'
        '"next_action":"delegate","intent":"general","confidence":0.9}'
    )
    runtime = AgentRuntime(_legacy_runner, chat_service=chat)
    result = asyncio.run(
        runtime.run(
            message="What are your hours?",
            session_id="session-a",
            chatbot_id="chatbot-a",
            owner_user_id=None,
            conversation_id="conversation-a",
            system_message="Be helpful.",
            model="gpt-4o-mini",
            provider="openai",
        )
    )
    assert result["response"] == "legacy response"
    assert result["intent"] == "general"
    assert result["runtime"]["status"] == "completed"


class ToolRuntime(AgentRuntime):
    async def _build_tool_registry(self, *, chatbot_id, user_id):
        registry = ToolRegistry()
        registry.register(EchoTool())
        return registry


class MemoryStateStore:
    def __init__(self):
        self.state = None

    async def load(self, **kwargs):
        if self.state is None:
            return None
        return type(self.state).model_validate(self.state.model_dump())

    async def save(self, state):
        self.state = type(state).model_validate(state.model_dump())

    async def delete(self, state):
        self.state = None


class CountingTool(EchoTool):
    name: str = "counting_echo"

    def __init__(self, counter, **data):
        super().__init__(**data)
        self._counter = counter

    async def execute(self, arguments: dict) -> dict:
        self._counter["calls"] += 1
        return await super().execute(arguments)


class HighRiskCountingTool(CountingTool):
    name: str = "high_risk_echo"
    risk_level: str = "high"


class FinishToolRuntime(AgentRuntime):
    def __init__(self, legacy_runner, chat_service, counter):
        self._counter = counter
        super().__init__(legacy_runner, chat_service=chat_service)

    async def _build_tool_registry(self, *, chatbot_id, user_id):
        registry = ToolRegistry()
        registry.register(HighRiskCountingTool(self._counter))
        return registry


def test_runtime_executes_tool_then_writes_final_response():
    chat = FakeChatService(
        '{"action":"tool","tool_name":"echo",'
        '"arguments":{"value":"hello"},"reason":"echo it",'
        '"next_action":"finish","intent":"test","confidence":1.0}'
    )
    runtime = ToolRuntime(_legacy_runner, chat_service=chat)
    result = asyncio.run(
        runtime.run(
            message="Echo hello",
            session_id="session-a",
            chatbot_id="chatbot-a",
            owner_user_id=None,
            conversation_id=None,
            system_message="Be helpful.",
            model="gpt-4o-mini",
            provider="openai",
            limits=ExecutionLimits(max_steps=4, max_tool_calls=1),
        )
    )
    assert result["response"] == "The requested action is complete."
    assert result["runtime"]["tool_calls"] == 1
    assert result["plan"]["tool_name"] == "echo"


def test_runtime_tracks_and_replans_multi_step_goal():
    first_plan = (
        '{"action":"tool","tool_name":"echo","arguments":{"value":"first"},'
        '"goal_steps":[{"id":"first","description":"Complete the first action",'
        '"tool_name":"echo"},{"id":"second","description":"Complete the next action",'
        '"tool_name":"echo"}],"active_step_id":"first",'
        '"next_action":"continue","intent":"multi_step"}'
    )
    second_plan = (
        '{"action":"tool","tool_name":"echo","arguments":{"value":"second"},'
        '"goal_steps":[{"id":"first","description":"Complete the first action",'
        '"tool_name":"echo"},{"id":"second","description":"Complete the next action",'
        '"tool_name":"echo"}],"active_step_id":"second",'
        '"next_action":"finish","intent":"multi_step"}'
    )
    chat = FakeChatService([first_plan, second_plan])
    runtime = ToolRuntime(_legacy_runner, chat_service=chat)

    result = asyncio.run(
        runtime.run(
            message="Complete two actions",
            session_id="session-a",
            chatbot_id="chatbot-a",
            owner_user_id=None,
            conversation_id=None,
            system_message="Be helpful.",
            model="gpt-4o-mini",
            provider="openai",
            limits=ExecutionLimits(max_steps=8, max_tool_calls=3),
        )
    )

    planner_calls = [
        call for call in chat.calls
        if call["session_id"].endswith(":agent-planner")
    ]
    assert len(planner_calls) == 2
    assert '"status": "completed"' in planner_calls[1]["system_message"]
    assert result["runtime"]["tool_calls"] == 2
    assert [step["status"] for step in result["plan"]["goal_steps"]] == [
        "completed",
        "completed",
    ]


def test_runtime_replans_when_planner_stops_with_unfinished_steps():
    execute_first_step = (
        '{"action":"tool","tool_name":"echo","arguments":{"value":"first"},'
        '"goal_steps":[{"id":"first","description":"Complete the first action",'
        '"tool_name":"echo"},{"id":"second","description":"Complete the next action",'
        '"tool_name":"echo"}],"active_step_id":"first",'
        '"next_action":"continue"}'
    )
    premature_stop = '{"action":"stop","goal_steps":null}'
    completed_replan = (
        '{"action":"stop","goal_steps":[],"final_response":"The goal is complete."}'
    )
    chat = FakeChatService(
        [execute_first_step, premature_stop, completed_replan]
    )
    runtime = ToolRuntime(_legacy_runner, chat_service=chat)

    result = asyncio.run(
        runtime.run(
            message="Complete the goal",
            session_id="session-a",
            chatbot_id="chatbot-a",
            owner_user_id=None,
            conversation_id=None,
            system_message="Be helpful.",
            model="gpt-4o-mini",
            provider="openai",
            limits=ExecutionLimits(max_steps=8, max_tool_calls=3),
        )
    )

    planner_calls = [
        call for call in chat.calls
        if call["session_id"].endswith(":agent-planner")
    ]
    assert len(planner_calls) == 3
    assert result["response"] == "The goal is complete."
    assert result["runtime"]["tool_calls"] == 1
    assert result["plan"]["goal_steps"] == []


def test_runtime_resumes_after_clarification_with_original_goal():
    clarify = (
        '{"action":"clarify","final_response":"Which day should I use?",'
        '"goal_steps":[{"id":"book","description":"Book the requested meeting",'
        '"tool_name":"echo"}],"intent":"scheduling"}'
    )
    continue_after_clarification = (
        '{"action":"tool","tool_name":"echo","arguments":{"value":"Friday"},'
        '"goal_steps":[{"id":"book","description":"Book the requested meeting",'
        '"tool_name":"echo"}],"active_step_id":"book",'
        '"next_action":"finish","intent":"scheduling"}'
    )
    chat = FakeChatService([clarify, continue_after_clarification])
    runtime = ToolRuntime(_legacy_runner, chat_service=chat)
    state_store = MemoryStateStore()
    runtime._state_store = state_store

    first_result = asyncio.run(
        runtime.run(
            message="Book a meeting",
            session_id="session-a",
            chatbot_id="chatbot-a",
            owner_user_id="owner-a",
            conversation_id="conversation-a",
            system_message="Be helpful.",
            model="gpt-4o-mini",
            provider="openai",
        )
    )

    assert first_result["response"] == "Which day should I use?"
    assert first_result["runtime"]["awaiting_input"] is True
    assert state_store.state.status == "awaiting_input"
    assert state_store.state.task == "Book a meeting"

    second_result = asyncio.run(
        runtime.run(
            message="Friday",
            session_id="session-a",
            chatbot_id="chatbot-a",
            owner_user_id="owner-a",
            conversation_id="conversation-a",
            system_message="Be helpful.",
            model="gpt-4o-mini",
            provider="openai",
        )
    )

    resumed_prompt = next(
        call["system_message"]
        for call in chat.calls
        if call["session_id"].endswith(":agent-planner")
        and "User clarification(s):" in call["system_message"]
    )
    assert "Book a meeting" in resumed_prompt
    assert "Friday" in resumed_prompt
    assert second_result["runtime"]["tool_calls"] == 1
    assert state_store.state is None


def test_runtime_does_not_repeat_a_tool_when_planner_says_finish():
    counter = {"calls": 0}
    chat = FakeChatService(
        '{"action":"tool","tool_name":"high_risk_echo",'
        '"arguments":{"value":"hello"},"reason":"one action",'
        '"next_action":"finish","intent":"test","confidence":1.0}'
    )
    runtime = FinishToolRuntime(_legacy_runner, chat, counter)
    result = asyncio.run(
        runtime.run(
            message="Echo once",
            session_id="session-a",
            chatbot_id="chatbot-a",
            owner_user_id=None,
            conversation_id=None,
            system_message="Be helpful.",
            model="gpt-4o-mini",
            provider="openai",
            limits=ExecutionLimits(max_steps=6, max_tool_calls=3),
        )
    )
    assert counter["calls"] == 1
    assert result["runtime"]["tool_calls"] == 1


def test_state_store_key_is_tenant_scoped():
    first = AgentStateStore.workflow_id(
        chatbot_id="a",
        conversation_id="conversation",
        user_id="owner-a",
    )
    second = AgentStateStore.workflow_id(
        chatbot_id="b",
        conversation_id="conversation",
        user_id="owner-a",
    )
    assert first != second


def test_feature_flag_is_explicit(monkeypatch):
    monkeypatch.setenv("BOTSMITH_AGENTS_ENABLED", "true")
    assert agents_enabled()
    monkeypatch.setenv("BOTSMITH_AGENTS_ENABLED", "false")
    assert not agents_enabled()