from __future__ import annotations

import json
import logging
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.config import Settings

# Fields whose values must never appear in log records.
_SENSITIVE_FIELDS = {"content", "text", "body", "message"}


class SensitiveDataFilter(logging.Filter):
    """Redact sensitive fields from every LogRecord before it is emitted."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        for field in _SENSITIVE_FIELDS:
            if hasattr(record, field):
                setattr(record, field, "[REDACTED]")
        # Also scrub the formatted message string if it leaks any of the keys.
        if isinstance(record.msg, str):
            for field in _SENSITIVE_FIELDS:
                if f'"{field}"' in record.msg or f"'{field}'" in record.msg:
                    record.msg = "[REDACTED LOG MESSAGE]"
                    record.args = ()
                    break
        return True


class _JsonFormatter(logging.Formatter):
    """Minimal JSON log formatter for non-production environments."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        payload = {
            "severity": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def setup_logging(settings: "Settings") -> None:
    """Configure application-wide logging.

    In production: attaches Google Cloud Logging so all records are shipped to
    Cloud Logging automatically.  In all other environments: writes structured
    JSON to stdout.

    A :class:`SensitiveDataFilter` is installed on the root logger in every
    environment to prevent sensitive field values from leaking into logs.
    """
    sensitive_filter = SensitiveDataFilter()

    if settings.ENVIRONMENT == "production":
        try:
            import google.cloud.logging as cloud_logging  # type: ignore[import]

            client = cloud_logging.Client(project=settings.GOOGLE_CLOUD_PROJECT)
            client.setup_logging(log_level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
        except Exception as exc:  # pragma: no cover
            # Fall back gracefully if the Cloud Logging client cannot initialise
            # (e.g. missing credentials in a CI/test context).
            logging.basicConfig(stream=sys.stdout, level=logging.WARNING)
            logging.getLogger(__name__).warning(
                "Cloud Logging setup failed, falling back to stdout: %s", exc
            )
    else:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        root = logging.getLogger()
        root.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))
        # Remove any existing handlers before adding ours.
        root.handlers.clear()
        root.addHandler(handler)

    # Install the sensitive-data filter on the root logger so it applies to
    # every logger in the hierarchy regardless of environment.
    logging.getLogger().addFilter(sensitive_filter)
