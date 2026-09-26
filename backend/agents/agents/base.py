"""
Base Agent - Foundation class for all AgentFlow agents
"""

import uuid
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class AgentMessage:
    """Represents a message passed between agents."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    sender: str = ""
    receiver: str = ""
    content: Any = None
    message_type: str = "text"  # text | task | result | error | signal
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "sender": self.sender,
            "receiver": self.receiver,
            "content": self.content,
            "message_type": self.message_type,
            "metadata": self.metadata,
            "timestamp": self.timestamp,
        }


@dataclass
class AgentResult:
    """Represents the result of an agent's execution."""
    success: bool
    output: Any
    agent_id: str
    agent_name: str
    error: Optional[str] = None
    execution_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "output": self.output,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "error": self.error,
            "execution_time": self.execution_time,
            "metadata": self.metadata,
        }


class BaseAgent(ABC):
    """
    Abstract base class for all AgentFlow agents.

    Every agent must implement the `run()` method. Agents can optionally
    override `pre_run()` and `post_run()` hooks for setup/teardown logic.
    """

    def __init__(
        self,
        name: str,
        description: str = "",
        tools: Optional[List] = None,
        memory=None,
        max_retries: int = 3,
        verbose: bool = False,
    ):
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = description
        self.tools = tools or []
        self.memory = memory
        self.max_retries = max_retries
        self.verbose = verbose
        self._message_inbox: List[AgentMessage] = []
        self._message_outbox: List[AgentMessage] = []
        self._state: Dict[str, Any] = {}

        logger.debug(f"[{self.name}] Agent initialized with ID {self.id}")

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    @abstractmethod
    def run(self, task: Any, context: Optional[Dict] = None) -> AgentResult:
        """
        Execute the agent's primary task.

        Args:
            task: The task or prompt for this agent.
            context: Optional shared context dictionary from the pipeline.

        Returns:
            AgentResult with success flag, output, and metadata.
        """
        ...

    def execute(self, task: Any, context: Optional[Dict] = None) -> AgentResult:
        """
        Public entry-point that wraps run() with retry logic and hooks.
        """
        import time

        context = context or {}
        self.pre_run(task, context)

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            start = time.perf_counter()
            try:
                if self.verbose:
                    logger.info(f"[{self.name}] Attempt {attempt}/{self.max_retries}")
                result = self.run(task, context)
                result.execution_time = time.perf_counter() - start
                self.post_run(result, context)
                return result
            except Exception as exc:
                last_error = exc
                logger.warning(f"[{self.name}] Attempt {attempt} failed: {exc}")

        return AgentResult(
            success=False,
            output=None,
            agent_id=self.id,
            agent_name=self.name,
            error=str(last_error),
        )

    # ------------------------------------------------------------------
    # Lifecycle hooks (optional overrides)
    # ------------------------------------------------------------------

    def pre_run(self, task: Any, context: Dict) -> None:
        """Called before run(). Override for custom setup."""
        pass

    def post_run(self, result: AgentResult, context: Dict) -> None:
        """Called after a successful run(). Override for cleanup/logging."""
        if self.memory and result.success:
            self.memory.store({"task": str(task), "result": str(result.output)})

    # ------------------------------------------------------------------
    # Messaging
    # ------------------------------------------------------------------

    def send_message(self, receiver: str, content: Any, message_type: str = "text") -> AgentMessage:
        msg = AgentMessage(
            sender=self.name,
            receiver=receiver,
            content=content,
            message_type=message_type,
        )
        self._message_outbox.append(msg)
        return msg

    def receive_message(self, message: AgentMessage) -> None:
        self._message_inbox.append(message)

    def get_inbox(self) -> List[AgentMessage]:
        return list(self._message_inbox)

    def clear_inbox(self) -> None:
        self._message_inbox.clear()

    # ------------------------------------------------------------------
    # State management
    # ------------------------------------------------------------------

    def set_state(self, key: str, value: Any) -> None:
        self._state[key] = value

    def get_state(self, key: str, default: Any = None) -> Any:
        return self._state.get(key, default)

    def reset_state(self) -> None:
        self._state.clear()

    # ------------------------------------------------------------------
    # Tool access
    # ------------------------------------------------------------------

    def get_tool(self, name: str):
        for tool in self.tools:
            if tool.name == name:
                return tool
        return None

    def use_tool(self, name: str, **kwargs) -> Any:
        tool = self.get_tool(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not found on agent '{self.name}'")
        return tool.execute(**kwargs)

    # ------------------------------------------------------------------
    # Representation
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name!r} id={self.id[:8]}>"
