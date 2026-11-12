from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
import jwt

from app.services.auth import decode_access_token
from app.services.websocket_manager import ws_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    """Real-time WebSocket stream for post-commit snack stock and vote updates."""
    if not token:
        await websocket.close(code=4001, reason="Authentication token required")
        return

    try:
        decode_access_token(token)
    except jwt.PyJWTError:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await ws_manager.connect(websocket)
    try:
        await websocket.send_json({"event": "connected", "data": {"status": "ok"}})
        while True:
            # Keep connection open and handle optional client pings
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

