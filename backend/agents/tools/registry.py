"""
Tool Registry - Register, discover, and execute agent tools.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class BaseTool(ABC):
    """Abstract base for all AgentFlow tools."""

    def __init__(self, name: str, description: str = "", keywords: Optional[List[str]] = None):
        self.name = name
        self.description = description
        self.keywords: List[str] = keywords or []

    @abstractmethod
    def execute(self, **kwargs) -> Any:
        ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name!r}>"


class FunctionTool(BaseTool):
    """
    Wraps a plain Python function as an AgentFlow tool.

    Example:
        def my_search(query: str, **_) -> str:
            return f"Results for {query}"

        tool = FunctionTool("web_search", my_search, keywords=["search", "find"])
    """

    def __init__(
        self,
        name: str,
        fn: Callable,
        description: str = "",
        keywords: Optional[List[str]] = None,
    ):
        super().__init__(name=name, description=description, keywords=keywords)
        self._fn = fn

    def execute(self, **kwargs) -> Any:
        return self._fn(**kwargs)


class ToolRegistry:
    """
    Central registry for all tools available to agents.

    Example:
        registry = ToolRegistry()
        registry.register(FunctionTool("calculator", calc_fn, keywords=["calculate", "math"]))

        tool = registry.get("calculator")
        tools = registry.search("calc")
    """

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, tool: BaseTool) -> None:
        if tool.name in self._tools:
            logger.warning(f"[ToolRegistry] Overwriting existing tool: {tool.name!r}")
        self._tools[tool.name] = tool
        logger.debug(f"[ToolRegistry] Registered tool: {tool.name!r}")

    def register_function(
        self,
        name: str,
        fn: Callable,
        description: str = "",
        keywords: Optional[List[str]] = None,
    ) -> FunctionTool:
        """Convenience wrapper: register a plain function."""
        tool = FunctionTool(name=name, fn=fn, description=description, keywords=keywords)
        self.register(tool)
        return tool

    def unregister(self, name: str) -> bool:
        return bool(self._tools.pop(name, None))

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def all_tools(self) -> List[BaseTool]:
        return list(self._tools.values())

    def search(self, query: str) -> List[BaseTool]:
        """Return tools whose name, description, or keywords match the query."""
        q = query.lower()
        return [
            t for t in self._tools.values()
            if q in t.name.lower()
            or q in t.description.lower()
            or any(q in kw.lower() for kw in t.keywords)
        ]

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    def execute(self, name: str, **kwargs) -> Any:
        tool = self.get(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not found in registry.")
        return tool.execute(**kwargs)

    # ------------------------------------------------------------------
    # Decorator API
    # ------------------------------------------------------------------

    def tool(self, name: str, description: str = "", keywords: Optional[List[str]] = None):
        """
        Decorator to register a function as a tool.

        Example:
            registry = ToolRegistry()

            @registry.tool("web_search", keywords=["search"])
            def web_search(query: str, **_) -> str:
                return f"Searching: {query}"
        """
        def decorator(fn: Callable) -> Callable:
            self.register_function(name=name, fn=fn, description=description, keywords=keywords)
            return fn
        return decorator

    def __len__(self) -> int:
        return len(self._tools)

    def __repr__(self) -> str:
        return f"<ToolRegistry tools={list(self._tools.keys())}>"
