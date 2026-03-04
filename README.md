# STRANGR — Anonymous Random Chat with AI Suggestions

A full-stack anonymous chat app with real-time WebSockets, AI-powered smart replies, and heartbeat-based disconnect handling.

**Live:** https://chatroulette-sooty.vercel.app

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│              React (Vercel CDN)                     │
│   Landing → Waiting → Chatting → Disconnected       │
└───────────────────┬─────────────────────────────────┘
                    │  WebSocket (wss://)
┌───────────────────▼─────────────────────────────────┐
│                    BACKEND                          │
│             FastAPI (Render.com)                    │
│                                                     │
│   ┌────────────┐  ┌────────────┐  ┌─────────────┐  │
│   │ Matchmaking│  │  Heartbeat │  │  AI Engine  │  │
│   │   Queue    │  │  Monitor   │  │  (Groq API) │  │
│   └────────────┘  └────────────┘  └─────────────┘  │
│                        │                            │
│   ┌────────────────────▼────────────────────────┐   │
│   │         PostgreSQL — Supabase               │   │
│   │         (message persistence)              │   │
│   └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Stack:**
- **Frontend** — React, custom WebSocket hook (`useChat.js`), Vercel deployment
- **Backend** — Python FastAPI, async WebSockets, in-memory state
- **AI** — Groq API (LLaMA 3.3 70B) for smart reply suggestions
- **Database** — PostgreSQL via Supabase (message history)
- **Real-time** — Native WebSocket protocol, no Socket.io

---

## 💬 Matchmaking & Chat Flow

```
User A opens app          User B opens app
       │                         │
       ▼                         ▼
  WS connects              WS connects
       │                         │
       ▼                         │
  Added to queue  ◄──── B joins queue
       │                         │
       └──── Paired together ────┘
                    │
              Both get "matched"
                    │
         ┌──────────▼──────────┐
         │   A types message   │
         │         │           │
         │  Server forwards    │
         │  to B instantly     │
         │         │           │
         │  Groq API called    │
         │  → 3 suggestions    │
         │  sent back to B     │
         └─────────────────────┘
```

**Matchmaking logic (in-memory):**
- New user connects → server checks `waiting_queue`
- If queue is empty → user is added to queue, shown "Searching..."
- If queue has someone → instantly paired, both notified
- On disconnect or skip → partner is notified, re-queued after 1.5s delay

**Heartbeat system:**
- Server pings every client every **20 seconds**
- Client must reply with `pong` within **35 seconds**
- No pong = silent disconnect detected → partner notified with reason:
  - `⚠️ Stranger lost connection` — abrupt drop
  - `⏱️ Stranger timed out` — internet issue
  - `⏭️ Stranger skipped` — clicked Skip
  - `👋 Stranger left` — clicked End

---

## 🗂️ Project Structure

```
chatroulette/
├── backend/
│   ├── main.py          ← FastAPI server, matchmaking, AI, heartbeat
│   ├── database.py      ← PostgreSQL (Supabase) async integration
│   ├── requirements.txt
│   └── .env             ← API keys (never commit this!)
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── App.js        ← Main UI with all screen states
    │   ├── index.css     ← Woody theme styles
    │   └── hooks/
    │       └── useChat.js ← WebSocket hook with auto-reconnect
    ├── .env              ← ws://localhost:8000/ws (local)
    ├── .env.production   ← wss://your-render-url/ws (prod)
    └── package.json
```

---

## ⚙️ Local Setup

### Step 1 — Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate      # Mac/Linux

# Install and run
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ API: http://localhost:8000  
✅ Health: http://localhost:8000/health  
✅ WebSocket: ws://localhost:8000/ws  
✅ Test AI: http://localhost:8000/test-ai

### Step 2 — Frontend

```bash
cd frontend
npm install
npm start
```

✅ App: http://localhost:3000

### Step 3 — Test

1. Open **two browser tabs** at http://localhost:3000
2. Click **"Start Chat"** in both
3. They match automatically
4. Send a message — AI suggestions appear for the recipient
5. Click **Skip** to find a new stranger

---

## 🚀 Deployment

### Backend → Render

1. Push to GitHub
2. Render → New Web Service → connect repo → select `backend/` as root
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables:
   ```
   GROQ_API_KEY=your_groq_key
   DATABASE_URL=your_supabase_postgres_url
   ```
6. Note your deployed URL: `https://your-service.onrender.com`

### Frontend → Vercel

1. Set `frontend/.env.production`:
   ```
   REACT_APP_WS_URL=wss://your-service.onrender.com/ws
   ```
   ⚠️ Use `wss://` not `ws://` and not `wss://https://`
2. Vercel → New Project → import repo → root directory: `frontend`
3. Deploy → share your permanent URL: `https://your-app.vercel.app`

**Only share the Vercel URL.** The Render backend runs silently in the background.

---

## 🤖 AI Suggestions

1. User A sends a message
2. Server forwards it to User B in real-time
3. Server simultaneously calls Groq API (LLaMA 3.3 70B)
4. Groq returns 3 short reply suggestions
5. Suggestions appear as clickable chips for User B
6. Clicking a chip sends it instantly

---

## 📝 Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `GROQ_API_KEY` | Render | Your Groq API key |
| `DATABASE_URL` | Render | Supabase PostgreSQL URL |
| `REACT_APP_WS_URL` | Vercel | `wss://your-render-url.onrender.com/ws` |

---

## ⚠️ Known Limitations

**In-memory state** — All active connections, pairs, and the waiting queue live in server RAM. If the Render instance restarts (deploy, crash, or daily free-tier restart), all active chats are lost and users must reconnect. A production version would use Redis for shared state.

**No persistence between sessions** — Chat history is saved to Supabase but the app never loads it back. Each session starts fresh with no history visible.

**Render free-tier cold starts** — The backend spins down after ~15 minutes of inactivity. The first user to connect after that waits ~30–50 seconds. The frontend auto-reconnects, but the experience is slow. Fix: ping `https://your-service.onrender.com/health` every 14 minutes using UptimeRobot (free).

**Single server, no scaling** — The matchmaking queue is in-memory on one process. Running multiple server instances would break matching since users could land on different instances and never see each other. A production setup would need a message broker (Redis pub/sub) for cross-instance signaling.

**No identity or moderation** — Users are fully anonymous with no accounts, blocking, or reporting system. Unsuitable for public production use without adding those safeguards.

**AI suggestions are best-effort** — If Groq API is slow or fails, the server falls back to three generic suggestions. Suggestion quality depends on message length and context.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| App loads but can't connect | Check `REACT_APP_WS_URL` in Vercel — must be `wss://` not `ws://` |
| Two tabs don't match | Open browser console — look for WebSocket errors |
| AI suggestions missing | Visit `/test-ai` endpoint to isolate Groq vs WebSocket issue |
| Render keeps sleeping | Set up UptimeRobot to ping `/health` every 14 min |
| Database errors | App degrades gracefully without DB — check Supabase dashboard |
| CORS errors | Backend uses `allow_origins=["*"]` — should not occur |
