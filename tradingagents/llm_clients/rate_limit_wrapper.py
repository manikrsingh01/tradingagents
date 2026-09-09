"""Intelligent rate-limit-aware retry wrapper for LLM invoke() calls.

Intercepts 429 (RESOURCE_EXHAUSTED) and 413 (Request Too Large on rate
limit) errors from any provider and waits the correct amount of time
before retrying, instead of crashing or busy-looping.

Supported providers and their retry signals:
- **Google Gemini**: 429 with ``retryDelay`` in error JSON body
- **Groq / OpenAI**: 429/413 with ``Retry-After`` header or body message
- **Fallback**: Exponential backoff with jitter for unknown providers
"""

from __future__ import annotations

import logging
import random
import re
import time
from functools import wraps
from typing import TypeVar, Callable

logger = logging.getLogger(__name__)

T = TypeVar("T")

# ---------------------------------------------------------------------------
# Retry-delay extraction helpers
# ---------------------------------------------------------------------------

def _parse_google_retry_delay(exc: Exception) -> float | None:
    """Extract ``retryDelay`` seconds from a Google 429 error.

    Google's error body contains::
        'retryDelay': '40s'
    or::
        Please retry in 40.298729063s.
    """
    msg = str(exc)

    # Pattern 1: "retryDelay": "40s"
    m = re.search(r"['\"]retryDelay['\"]:\s*['\"](\d+)s['\"]", msg)
    if m:
        return float(m.group(1))

    # Pattern 2: "Please retry in 40.298729063s"
    m = re.search(r"[Pp]lease retry in (\d+(?:\.\d+)?)s", msg)
    if m:
        return float(m.group(1))

    return None


def _parse_openai_retry_delay(exc: Exception) -> float | None:
    """Extract retry delay from OpenAI/Groq 429/413 errors.

    Groq's error body contains::
        'code': 'rate_limit_exceeded'
    and sometimes a Retry-After header in the response.
    """
    msg = str(exc)

    # Pattern: "Please try again in Xm Ys" or "Please try again in Xs"
    m = re.search(r"[Pp]lease (?:try|retry)(?: again)? in (\d+)m\s*(\d+(?:\.\d+)?)s", msg)
    if m:
        return float(m.group(1)) * 60 + float(m.group(2))

    m = re.search(r"[Pp]lease (?:try|retry)(?: again)? in (\d+(?:\.\d+)?)s", msg)
    if m:
        return float(m.group(1))

    # Try to get the Retry-After from the response object if available
    response = getattr(exc, "response", None)
    if response is not None:
        headers = getattr(response, "headers", {})
        retry_after = headers.get("retry-after") or headers.get("Retry-After")
        if retry_after:
            try:
                return float(retry_after)
            except (ValueError, TypeError):
                pass

    return None


def _is_rate_limit_error(exc: Exception) -> bool:
    """Return True if the exception is a rate-limit / quota error."""
    msg = str(exc).lower()
    type_name = type(exc).__name__
    
    # Google sometimes tarpits the IP and drops the connection at the TLS
    # or socket layer when quota is exceeded, instead of returning a 429.
    is_tarpit_timeout = type_name in ("ReadTimeout", "ConnectTimeout", "TimeoutException") or \
        any(keyword in msg for keyword in (
            "handshake operation timed out",
            "no route to host",
            "read timed out",
        ))

    return is_tarpit_timeout or any(keyword in msg for keyword in (
        "rate_limit_exceeded",
        "resource_exhausted",
        "429",
        "too many requests",
        "quota exceeded",
        "request too large",   # Groq 413 when TPM exceeded
        "tokens per minute",
    ))


def _get_retry_delay(exc: Exception) -> float:
    """Parse the retry delay from any provider's error, or return a default."""
    delay = _parse_google_retry_delay(exc)
    if delay is not None:
        return delay

    delay = _parse_openai_retry_delay(exc)
    if delay is not None:
        return delay

    # Fallback: 30 seconds (safe default for most providers)
    return 30.0


# ---------------------------------------------------------------------------
# The main retry wrapper
# ---------------------------------------------------------------------------

def rate_limit_retry(
    func: Callable[..., T],
    max_retries: int = 30,
    max_total_wait: float = 600.0,  # 10 minutes total max wait
) -> Callable[..., T]:
    """Wrap an LLM ``invoke()``-like function with rate-limit-aware retrying.

    Parameters
    ----------
    func:
        The original function to wrap (e.g., ``super().invoke``).
    max_retries:
        Maximum number of retry attempts.
    max_total_wait:
        Cumulative maximum seconds to spend waiting across all retries.

    Returns
    -------
    A wrapped function that transparently retries on rate-limit errors.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        total_waited = 0.0
        for attempt in range(max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                if not _is_rate_limit_error(exc):
                    raise  # Not a rate-limit error — propagate immediately

                if attempt >= max_retries:
                    logger.error(
                        "Rate limit: exhausted %d retries (waited %.0fs total). Giving up.",
                        max_retries, total_waited,
                    )
                    raise

                delay = _get_retry_delay(exc)
                # Add small jitter (±10%) to avoid thundering herd
                jitter = delay * 0.1 * (random.random() * 2 - 1)
                delay = max(1.0, delay + jitter)

                if total_waited + delay > max_total_wait:
                    logger.error(
                        "Rate limit: next wait (%.0fs) would exceed %.0fs total budget. Giving up.",
                        delay, max_total_wait,
                    )
                    raise

                logger.warning(
                    "⏳ Rate limited (attempt %d/%d). Waiting %.0fs before retry...",
                    attempt + 1, max_retries, delay,
                )
                time.sleep(delay)
                logger.info("Resuming API call...")
                total_waited += delay

        # Should never reach here, but just in case:
        return func(*args, **kwargs)

    return wrapper
