"""
ShortTermMemory - Fast, in-process memory with a configurable sliding window.
"""

import logging
from collections import deque
from datetime import datetime
from typing import Any, Deque, Dict, List, Optional

logger = logging.getLogger(__name__)


class ShortTermMemory:
    """
    In-process, sliding-window memory.

    Stores the N most recent entries and supports simple substring search.

    Example:
        mem = ShortTermMemory(capacity=50)
        mem.store({"task": "summarise text", "result": "..."})
        hits = mem.search("summarise")
    """

    def __init__(self, capacity: int = 100):
        self.capacity = capacity
        self._store: Deque[Dict] = deque(maxlen=capacity)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def store(self, entry: Any) -> None:
        record = {
            "data": entry,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._store.append(record)
        logger.debug(f"[STM] Stored entry ({len(self._store)}/{self.capacity})")

    def clear(self) -> None:
        self._store.clear()

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def recall_recent(self, n: int = 5) -> List[Dict]:
        """Return the last n entries."""
        items = list(self._store)
        return items[-n:]

    def recall_all(self) -> List[Dict]:
        return list(self._store)

    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        """Simple substring search over serialised entries."""
        query_lower = query.lower()
        hits = [
            record for record in self._store
            if query_lower in str(record["data"]).lower()
        ]
        return hits[-top_k:]

    # ------------------------------------------------------------------
    # Summaries
    # ------------------------------------------------------------------

    def summary(self) -> str:
        items = list(self._store)
        if not items:
            return "Memory is empty."
        lines = [f"- [{r['timestamp']}] {str(r['data'])[:80]}" for r in items[-10:]]
        return "\n".join(lines)

    def __len__(self) -> int:
        return len(self._store)

    def __repr__(self) -> str:
        return f"<ShortTermMemory entries={len(self._store)}/{self.capacity}>"
