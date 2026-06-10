"""Structured JSON logging with per-request correlation ids."""

import json
import logging
import sys
import uuid
from contextvars import ContextVar

correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def new_correlation_id() -> str:
    correlation_id = f"req_{uuid.uuid4().hex[:12]}"
    correlation_id_var.set(correlation_id)
    return correlation_id


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        correlation_id = correlation_id_var.get()
        if correlation_id:
            payload["correlation_id"] = correlation_id
        # Structured fields (GCP DoD): callers attach
        # extra={"caseflow": {...}} — request id, agent, model, prompt
        # version, evidence ids, confidence, latency, outcome.
        caseflow = getattr(record, "caseflow", None)
        if isinstance(caseflow, dict):
            payload.update(caseflow)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
