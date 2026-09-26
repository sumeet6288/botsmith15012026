"""
Built-in tools bundled with AgentFlow.

These are lightweight, dependency-free implementations suitable for
development and testing. Replace with production versions as needed.
"""

import math
import os
import time
from pathlib import Path
from typing import Any, Optional

from agentflow.tools.registry import BaseTool


# ──────────────────────────────────────────────
# WebSearchTool
# ──────────────────────────────────────────────

class WebSearchTool(BaseTool):
    """
    Performs a web search.

    By default uses a stub that returns a placeholder.
    Pass a `search_fn(query: str) -> str` to use a real search provider.

    Example:
        tool = WebSearchTool(search_fn=my_duckduckgo_fn)
        result = tool.execute(task="What is the capital of France?")
    """

    def __init__(self, search_fn=None):
        super().__init__(
            name="web_search",
            description="Search the web for current information",
            keywords=["search", "web", "find", "lookup", "google", "query"],
        )
        self._search_fn = search_fn

    def execute(self, task: str = "", query: str = "", **kwargs) -> str:
        q = query or task
        if self._search_fn:
            return self._search_fn(q)
        # Stub for offline/testing use
        return (
            f"[WebSearchTool] Search results for '{q}':\n"
            "  1. Example result A — https://example.com/a\n"
            "  2. Example result B — https://example.com/b\n"
            "  (Configure a real search_fn for live results.)"
        )


# ──────────────────────────────────────────────
# FileTool
# ──────────────────────────────────────────────

class FileTool(BaseTool):
    """
    Read and write text files.

    Example:
        tool = FileTool(base_dir="/tmp/agent_files")
        tool.execute(action="write", path="notes.txt", content="Hello!")
        text = tool.execute(action="read", path="notes.txt")
    """

    def __init__(self, base_dir: str = "."):
        super().__init__(
            name="file",
            description="Read and write files on disk",
            keywords=["file", "read", "write", "save", "load", "disk"],
        )
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def execute(self, action: str = "read", path: str = "", content: str = "", **kwargs) -> Any:
        target = self.base_dir / path
        if action == "read":
            if not target.exists():
                raise FileNotFoundError(f"File not found: {target}")
            return target.read_text(encoding="utf-8")
        elif action == "write":
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            return f"Written {len(content)} chars to {target}"
        elif action == "list":
            return [str(p.relative_to(self.base_dir)) for p in self.base_dir.rglob("*") if p.is_file()]
        elif action == "delete":
            if target.exists():
                target.unlink()
                return f"Deleted {target}"
            return "File not found."
        else:
            raise ValueError(f"Unknown action '{action}'. Use: read | write | list | delete")


# ──────────────────────────────────────────────
# CalculatorTool
# ──────────────────────────────────────────────

class CalculatorTool(BaseTool):
    """
    Evaluates safe mathematical expressions.

    Example:
        tool = CalculatorTool()
        result = tool.execute(expression="sqrt(144) + 2**8")  # → 268.0
    """

    _SAFE_NAMES = {k: getattr(math, k) for k in dir(math) if not k.startswith("_")}
    _SAFE_NAMES.update({"abs": abs, "round": round, "min": min, "max": max, "sum": sum})

    def __init__(self):
        super().__init__(
            name="calculator",
            description="Evaluate mathematical expressions",
            keywords=["calculate", "math", "compute", "expression", "formula"],
        )

    def execute(self, expression: str = "", task: str = "", **kwargs) -> float:
        expr = expression or task
        try:
            result = eval(expr, {"__builtins__": {}}, self._SAFE_NAMES)  # noqa: S307
            return float(result)
        except Exception as exc:
            raise ValueError(f"Could not evaluate expression '{expr}': {exc}") from exc


# ──────────────────────────────────────────────
# TimerTool
# ──────────────────────────────────────────────

class TimerTool(BaseTool):
    """
    Measures elapsed wall-clock time for sub-tasks.

    Example:
        timer = TimerTool()
        timer.execute(action="start", label="step1")
        # ... do work ...
        elapsed = timer.execute(action="stop", label="step1")
    """

    def __init__(self):
        super().__init__(
            name="timer",
            description="Track elapsed time for tasks",
            keywords=["timer", "time", "elapsed", "benchmark", "measure"],
        )
        self._timers: dict = {}

    def execute(self, action: str = "start", label: str = "default", **kwargs) -> Any:
        if action == "start":
            self._timers[label] = time.perf_counter()
            return f"Timer '{label}' started."
        elif action == "stop":
            start = self._timers.pop(label, None)
            if start is None:
                raise KeyError(f"No timer named '{label}' is running.")
            elapsed = time.perf_counter() - start
            return elapsed
        elif action == "list":
            return list(self._timers.keys())
        else:
            raise ValueError(f"Unknown action '{action}'. Use: start | stop | list")
