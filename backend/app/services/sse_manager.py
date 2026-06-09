import asyncio
import json
from typing import Optional
from datetime import datetime


class SSEManager:
    """Manages Server-Sent Events streams for job progress."""

    def __init__(self):
        # job_id -> asyncio.Queue
        self._queues: dict[str, asyncio.Queue] = {}

    def create_queue(self, job_id: str) -> asyncio.Queue:
        """Create a new SSE queue for a job."""
        queue = asyncio.Queue(maxsize=100)
        self._queues[job_id] = queue
        return queue

    def get_queue(self, job_id: str) -> Optional[asyncio.Queue]:
        """Get existing queue for a job."""
        return self._queues.get(job_id)

    async def emit(
        self,
        job_id: str,
        stage: str,
        status: str,
        progress: float = 0.0,
        message: str = "",
        error: str = "",
    ):
        """Emit a progress event to the job's SSE queue."""
        queue = self._queues.get(job_id)
        if queue:
            event = {
                "stage": stage,
                "status": status,
                "progress": progress,
                "message": message,
                "error": error,
                "timestamp": datetime.utcnow().isoformat(),
            }
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass  # Drop event if queue full

    async def close_queue(self, job_id: str):
        """Signal that the job is done by putting a sentinel."""
        queue = self._queues.get(job_id)
        if queue:
            await queue.put(None)  # None = sentinel to close stream

    def remove_queue(self, job_id: str):
        """Remove queue after job completes."""
        self._queues.pop(job_id, None)

    async def event_generator(self, job_id: str):
        """Async generator that yields SSE-formatted events."""
        queue = self._queues.get(job_id)
        if not queue:
            yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
            return

        while True:
            try:
                # Wait for events with keepalive ping every 15s
                event = await asyncio.wait_for(queue.get(), timeout=15.0)

                if event is None:  # Sentinel — job done
                    yield f"data: {json.dumps({'status': 'done'})}\n\n"
                    break

                yield f"data: {json.dumps(event)}\n\n"

                # Stop streaming on terminal states
                if event.get('status') in ('complete', 'failed') and event.get('stage') == 'pipeline':
                    break

            except asyncio.TimeoutError:
                # Send keepalive ping
                yield f": keepalive\n\n"


# Global singleton
sse_manager = SSEManager()
