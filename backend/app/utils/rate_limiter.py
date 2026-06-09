import asyncio
import time

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)


class RateLimiter:
    """
    Simple async token-bucket rate limiter for the Gemini API (15 RPM ceiling).
    Uses 12 RPM by default to stay safely under the quota.
    """

    def __init__(self, calls_per_minute: int = 12):
        self.calls_per_minute = calls_per_minute
        self.min_interval = 60.0 / calls_per_minute
        self._last_call: float = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Block until it is safe to make the next API call."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self._last_call = time.monotonic()


def gemini_retry(func):
    """
    Decorator that retries the wrapped coroutine on any exception with
    exponential back-off (2 s → 4 s → 8 s, max 3 attempts).

    Designed for 429 / rate-limit errors from the Gemini API, but is
    conservative and retries on all exceptions.
    """
    return retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=8),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )(func)


# Module-level singleton used by all Gemini callers
rate_limiter = RateLimiter()
