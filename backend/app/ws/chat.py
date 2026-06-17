from __future__ import annotations

"""
WebSocket endpoint — WS /chat/{session_id}?token=<jwt>

Auth via query param because browser WebSocket upgrades cannot carry custom
headers. The JWT is verified and blocklist-checked identically to the HTTP
dependency, but manually since FastAPI Depends doesn't compose with WS accept.

Close codes (sent after accept so the browser receives them):
  4001 — invalid / expired / revoked token
  4003 — session not found or access denied
  4004 — report not ready (workflow still running)

Message protocol (matches api_design.md):
  Client → Server:  {"message": "..."}
  Server → Client:  "<token>"             (plain text, repeated per streaming chunk)
  Server → Client:  {"done": true, "message_id": "<id>"}   (stream finished)
  Server → Client:  {"error": "..."}      (unexpected error)
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.security import decode_access_token
from app.infra.mongodb import get_database
from app.infra.redis_client import get_redis
from app.services import chat_service

router = APIRouter()


async def _authenticate(token: str) -> str | None:
    """Verify JWT and check the logout blocklist. Returns user_id or None."""
    try:
        payload = decode_access_token(token)
    except JWTError:
        return None

    jti = payload.get("jti")
    if jti:
        redis = get_redis()
        if await redis.exists(f"token_blocklist:{jti}"):
            return None

    return payload.get("sub")


@router.websocket("/chat/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: str):
    # Always accept first so we can send a proper close code on failure
    await websocket.accept()

    token = websocket.query_params.get("token", "")
    user_id = await _authenticate(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    try:
        context = await chat_service.load_report_context(session_id, user_id)
    except Exception as exc:
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            close_code = 4004 if exc.status_code == 409 else 4003
        else:
            close_code = 4003
        await websocket.close(code=close_code)
        return

    db = get_database()

    # Load persisted history so the LLM has full conversation context on reconnect
    history: list[dict] = []
    async for msg_doc in db.messages.find(
        {"session_id": session_id}, sort=[("created_at", 1)]
    ):
        history.append({"role": msg_doc["role"], "content": msg_doc["content"]})

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            user_text = data.get("message", "").strip()
            if not user_text:
                continue

            now = datetime.now(timezone.utc)
            user_msg_id = str(uuid.uuid4())
            await db.messages.insert_one({
                "message_id": user_msg_id,
                "session_id": session_id,
                "role": "user",
                "content": user_text,
                "created_at": now,
            })

            full_reply = ""
            async for token in chat_service.stream_reply(context, history, user_text):
                full_reply += token
                await websocket.send_text(token)

            assistant_msg_id = str(uuid.uuid4())
            await db.messages.insert_one({
                "message_id": assistant_msg_id,
                "session_id": session_id,
                "role": "assistant",
                "content": full_reply,
                "created_at": datetime.now(timezone.utc),
            })

            # Keep in-memory history current for subsequent turns in this session
            history.append({"role": "user", "content": user_text})
            history.append({"role": "assistant", "content": full_reply})

            await websocket.send_text(json.dumps({"done": True, "message_id": assistant_msg_id}))

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_text(json.dumps({"error": str(exc)}))
        except Exception:
            pass
