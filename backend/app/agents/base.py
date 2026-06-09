import logging
from abc import ABC, abstractmethod
from typing import Any

from app.services.sse_manager import sse_manager

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all EIH pipeline agents."""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.agent_name = self.__class__.__name__

    async def run(self, **kwargs) -> Any:
        """Execute the agent with SSE progress tracking and error handling."""
        await sse_manager.emit(
            self.job_id,
            stage=self.agent_name,
            status="started",
            message=f"{self.agent_name} starting...",
        )
        try:
            result = await self.execute(**kwargs)
            await sse_manager.emit(
                self.job_id,
                stage=self.agent_name,
                status="complete",
                progress=1.0,
                message=f"{self.agent_name} complete",
            )
            return result
        except Exception as exc:
            logger.exception("%s failed: %s", self.agent_name, exc)
            await sse_manager.emit(
                self.job_id,
                stage=self.agent_name,
                status="failed",
                error=str(exc),
            )
            raise

    @abstractmethod
    async def execute(self, **kwargs) -> Any: ...

    async def report_progress(self, progress: float, message: str) -> None:
        await sse_manager.emit(
            self.job_id,
            stage=self.agent_name,
            status="running",
            progress=progress,
            message=message,
        )
