import asyncio
import logging
from typing import Any, Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages live WebSocket clients and broadcasts post-commit domain events."""

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        self._loop = asyncio.get_running_loop()

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast(self, event: str, data: Dict[str, Any]) -> None:
        if not self.active_connections:
            return

        message = {"event": event, "data": data}
        disconnected: list[WebSocket] = []

        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)

    def broadcast_from_sync(self, event: str, data: Dict[str, Any]) -> None:
        """Schedule a broadcast safely from a synchronous route after DB commit."""
        if not self.active_connections or self._loop is None or self._loop.is_closed():
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(event, data), self._loop)
        except Exception as exc:
            logger.debug("WebSocket broadcast skipped: %s", exc)


ws_manager = WebSocketManager()

