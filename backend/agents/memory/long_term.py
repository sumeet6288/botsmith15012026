"""
LongTermMemory - File-backed persistent memory using JSON Lines.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

logger = logging.getLogger(__name__)

_SENTINEL = object()


class LongTermMemory:
    """
    Persistent memory backed by a JSON Lines (.jsonl) file.

    Each entry is stored as a single JSON object per line, which allows
    efficient appending without loading the whole file.

    Example:
        mem = LongTermMemory(path="./agent_memory.jsonl")
        mem.store({"task": "translate text", "result": "..."}, tags=["translation"])
        hits = mem.search("translate", top_k=3)
    """

    def __init__(self, path: str = "./agentflow_memory.jsonl", max_records: int = 10_000):
        self.path = Path(path)
        self.max_records = max_records
        self.path.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def store(self, entry: Any, tags: Optional[List[str]] = None) -> str:
        """Append an entry to the store. Returns the assigned entry ID."""
        record = {
            "id": str(uuid.uuid4()),
            "data": entry,
            "tags": tags or [],
            "timestamp": datetime.utcnow().isoformat(),
        }
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        self._maybe_compact()
        logger.debug(f"[LTM] Stored entry {record['id']}")
        return record["id"]

    def delete(self, entry_id: str) -> bool:
        """Remove a record by ID. Returns True if found and deleted."""
        records = self._load_all()
        new_records = [r for r in records if r.get("id") != entry_id]
        if len(new_records) == len(records):
            return False
        self._write_all(new_records)
        return True

    def clear(self) -> None:
        """Wipe all records."""
        self.path.write_text("", encoding="utf-8")

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def recall_recent(self, n: int = 10) -> List[Dict]:
        records = self._load_all()
        return records[-n:]

    def recall_all(self) -> List[Dict]:
        return self._load_all()

    def get_by_id(self, entry_id: str, default=_SENTINEL):
        for record in self._load_all():
            if record.get("id") == entry_id:
                return record
        if default is _SENTINEL:
            raise KeyError(f"Entry '{entry_id}' not found.")
        return default

    def search(self, query: str, top_k: int = 10, tags: Optional[List[str]] = None) -> List[Dict]:
        """
        Substring search. Optionally filter by tags.
        Returns up to `top_k` most-recent matches.
        """
        query_lower = query.lower()
        results = []
        for record in self._load_all():
            if tags and not any(t in record.get("tags", []) for t in tags):
                continue
            if query_lower in str(record["data"]).lower():
                results.append(record)
        return results[-top_k:]

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _load_all(self) -> List[Dict]:
        if not self.path.exists():
            return []
        records = []
        with open(self.path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        logger.warning(f"[LTM] Skipped corrupt line in {self.path}")
        return records

    def _write_all(self, records: List[Dict]) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            for record in records:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")

    def _maybe_compact(self) -> None:
        """Trim to max_records if the file grows too large."""
        records = self._load_all()
        if len(records) > self.max_records:
            logger.info(f"[LTM] Compacting memory: {len(records)} → {self.max_records}")
            self._write_all(records[-self.max_records:])

    def __len__(self) -> int:
        return len(self._load_all())

    def __repr__(self) -> str:
        return f"<LongTermMemory path={self.path} records={len(self)}>"
