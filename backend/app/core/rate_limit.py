from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# ---------------------------------------------------------------------------
# Central limiter instance — attach to FastAPI app via app.state.limiter
# ---------------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# Convenience decorators
# ---------------------------------------------------------------------------

# These are thin wrappers around ``limiter.limit`` so route handlers can be
# decorated without hard-coding the rate-limit strings.
#
# Usage::
#
#     @router.post("/chat")
#     @chat_rate_limit
#     async def send_message(request: Request, ...):
#         ...


def chat_rate_limit(func):  # type: ignore[type-arg]
    """Apply the chat-specific rate limit (settings.RATE_LIMIT_CHAT)."""
    return limiter.limit(settings.RATE_LIMIT_CHAT)(func)


def api_rate_limit(func):  # type: ignore[type-arg]
    """Apply the default API rate limit (settings.RATE_LIMIT_DEFAULT)."""
    return limiter.limit(settings.RATE_LIMIT_DEFAULT)(func)
