import asyncio
import json
import uuid
import os
import time
import traceback
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx
from database import Database

app = FastAPI(title="Anonymous Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, set to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state
waiting_queue: list[str] = []
connections: dict[str, WebSocket] = {}
pairs: dict[str, str] = {}
last_pong: dict[str, float] = {}  # tracks heartbeat — detects silent disconnects

PING_INTERVAL = 20   # send ping every 20s
PING_TIMEOUT  = 35   # no pong in 35s = declare dead

DISCONNECT_MESSAGES = {
    "disconnected": "⚠️  Stranger lost connection.",
    "timeout":      "⏱️  Stranger timed out (internet issue).",
    "left":         "👋 Stranger left the chat.",
    "skipped":      "⏭️  Stranger skipped to next chat.",
}

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

db = Database()


async def get_ai_suggestions(message: str) -> list[str]:
    """Call Groq API to get smart reply suggestions."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a chat assistant. Given a message in an anonymous chat, "
                                "generate exactly 3 short, natural reply suggestions. "
                                "Return ONLY a JSON array of 3 strings, no other text. "
                                "Example: [\"That's cool!\", \"Tell me more\", \"Interesting!\"]"
                            ),
                        },
                        {"role": "user", "content": f"Message: {message}"},
                    ],
                    "max_tokens": 150,
                    "temperature": 0.8,
                },
            )
            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()
            # Clean possible markdown fences
            text = text.replace("```json", "").replace("```", "").strip()
            suggestions = json.loads(text)
            return suggestions[:3] if isinstance(suggestions, list) else []
    except Exception as e:
        print(f"AI suggestion error: {e}")
        return ["That's interesting!", "Tell me more 😊", "Haha, really?"]


async def match_user(user_id: str):
    """Try to match a user with someone in the waiting queue."""
    if waiting_queue and waiting_queue[0] != user_id:
        partner_id = waiting_queue.pop(0)
        pairs[user_id] = partner_id
        pairs[partner_id] = user_id

        # Notify both users
        await send_to(user_id, {"type": "matched", "message": "You are now connected with a stranger!"})
        await send_to(partner_id, {"type": "matched", "message": "You are now connected with a stranger!"})
    else:
        if user_id not in waiting_queue:
            waiting_queue.append(user_id)
        await send_to(user_id, {"type": "waiting", "message": "Looking for a stranger..."})


async def send_to(user_id: str, data: dict):
    ws = connections.get(user_id)
    if ws:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            asyncio.create_task(disconnect_user(user_id, reason="disconnected"))


async def _delayed_rematch(user_id: str):
    await asyncio.sleep(1.5)
    if user_id in connections:
        await match_user(user_id)


async def disconnect_user(user_id: str, notify_partner: bool = True, reason: str = "disconnected"):
    """Full cleanup. Notifies partner with specific reason message."""
    if user_id not in connections and user_id not in pairs and user_id not in waiting_queue:
        return
    partner_id = pairs.get(user_id)
    pairs.pop(user_id, None)
    last_pong.pop(user_id, None)
    if user_id in waiting_queue:
        waiting_queue.remove(user_id)
    connections.pop(user_id, None)
    print(f"👋 {user_id[:8]} gone ({reason})")
    if partner_id and notify_partner and partner_id in connections:
        msg = DISCONNECT_MESSAGES.get(reason, "Stranger disconnected.")
        await send_to(partner_id, {"type": "partner_disconnected", "message": msg, "reason": reason})
        pairs.pop(partner_id, None)
        asyncio.create_task(_delayed_rematch(partner_id))


async def heartbeat_monitor():
    """Detects silent drops: WiFi loss, phone sleep, browser tab killed, etc."""
    while True:
        await asyncio.sleep(PING_INTERVAL)
        now = time.time()
        timed_out = [uid for uid, ts in list(last_pong.items()) if now - ts > PING_TIMEOUT]
        for uid in timed_out:
            print(f"💀 {uid[:8]} timed out ({int(now - last_pong.get(uid, now))}s)")
            await disconnect_user(uid, reason="timeout")
        for uid, ws in list(connections.items()):
            try:
                await ws.send_text(json.dumps({"type": "ping"}))
            except Exception:
                await disconnect_user(uid, reason="disconnected")


@app.on_event("startup")
async def startup():
    await db.connect()
    await db.create_tables()
    asyncio.create_task(heartbeat_monitor())
    print("🚀 Server started with heartbeat monitor")


@app.on_event("shutdown")
async def shutdown():
    await db.disconnect()


@app.get("/health")
async def health():
    return {"status": "ok", "waiting": len(waiting_queue), "pairs": len(pairs) // 2}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_id = str(uuid.uuid4())
    connections[user_id] = websocket
    last_pong[user_id] = time.time()

    await send_to(user_id, {"type": "connected", "user_id": user_id})

    # Save to DB
    await db.create_user(user_id)

    # Try to match
    await match_user(user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            # Heartbeat — keeps connection alive, detects silent drops
            if msg_type == "pong":
                last_pong[user_id] = time.time()
                continue

            if msg_type == "message":
                text = data.get("text", "").strip()
                if not text:
                    continue

                partner_id = pairs.get(user_id)
                if not partner_id:
                    await send_to(user_id, {"type": "error", "message": "Not connected to anyone."})
                    continue

                # Forward message to partner
                await send_to(partner_id, {
                    "type": "message",
                    "text": text,
                    "from": "stranger",
                })

                # Echo back to sender with "you" label
                await send_to(user_id, {
                    "type": "message",
                    "text": text,
                    "from": "you",
                })

                # Save to DB
                await db.save_message(user_id, partner_id, text)

                # Get AI suggestions for the RECIPIENT
                suggestions = await get_ai_suggestions(text)
                await send_to(partner_id, {
                    "type": "ai_suggestions",
                    "suggestions": suggestions,
                })

            elif msg_type == "skip":
                partner_id = pairs.get(user_id)
                if partner_id:
                    pairs.pop(partner_id, None)
                    await send_to(partner_id, {
                        "type":    "partner_disconnected",
                        "message": DISCONNECT_MESSAGES["skipped"],
                        "reason":  "skipped",
                    })
                    asyncio.create_task(_delayed_rematch(partner_id))
                pairs.pop(user_id, None)
                await send_to(user_id, {"type": "skipped"})
                await match_user(user_id)

            elif msg_type == "typing":
                partner_id = pairs.get(user_id)
                if partner_id:
                    await send_to(partner_id, {"type": "typing"})

    except WebSocketDisconnect:
        await disconnect_user(user_id, reason="disconnected")
    except Exception as e:
        print(f"Error for user {user_id}: {e}")
        traceback.print_exc()
        await disconnect_user(user_id, reason="disconnected")
