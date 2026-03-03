# STRANGR — Anonymous Random Chat with AI Suggestions

A full-stack anonymous chat app with real-time WebSockets and AI-powered smart replies.

---

## 🗂️ Project Structure

```
chatroulette/
├── backend/
│   ├── main.py          ← FastAPI WebSocket server + matchmaking + AI
│   ├── database.py      ← PostgreSQL (Supabase) integration
│   ├── requirements.txt
│   └── .env             ← Your API keys (never commit this!)
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── App.js        ← Main React component
    │   ├── index.js      ← Entry point
    │   ├── index.css     ← All styles
    │   └── hooks/
    │       └── useChat.js ← WebSocket hook
    ├── .env              ← WS URL for local dev
    ├── .env.production   ← WS URL for deployment
    └── package.json
```

---

## ⚙️ LOCAL SETUP (VSCode)

### Step 1 — Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ Backend running at: http://localhost:8000  
✅ Health check: http://localhost:8000/health  
✅ WebSocket: ws://localhost:8000/ws

---

### Step 2 — Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm start
```

✅ Frontend running at: http://localhost:3000

---

### Step 3 — Test the Chat

1. Open **two browser tabs** at http://localhost:3000
2. Click **"Start Chat"** in both tabs
3. They will be matched automatically
4. Send messages — AI suggestions appear for the recipient
5. Click **⏭ Skip** to find a new stranger

---

## 🚀 DEPLOYMENT

### Backend → Render

1. Push your code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your repo, select the `backend/` folder
4. Set:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add Environment Variables:
   ```
   GROQ_API_KEY=xxxxxxxxxxxxxxxx
   DATABASE_URL=xxxxxxxxxxxxxxxxx
   ```
6. Deploy — note your URL e.g. `https://strangr-api.onrender.com`

### Frontend → Vercel

1. Update `frontend/.env.production`:
   ```
   REACT_APP_WS_URL=wss://strangr-api.onrender.com/ws
   ```
2. Push to GitHub
3. Go to https://vercel.com → New Project → Import repo
4. Set **Root Directory** to `frontend`
5. Deploy ✅

---

## 🤖 How AI Suggestions Work

1. User A sends a message
2. Backend forwards it to User B
3. Backend simultaneously calls **Groq API** (LLaMA 70B)
4. Groq returns 3 short reply suggestions as JSON
5. Suggestions are sent to User B as clickable buttons
6. User B can tap a suggestion to send it instantly

---

## 🏗️ Architecture

```
Browser Tab A          Browser Tab B
     │                      │
     └──── WebSocket ────────┘
                │
          FastAPI Server
         /     |      \
   Matchmaking │   Groq API
         \     │      /
          PostgreSQL (Supabase)
```

---

## 📝 Environment Variables

| Variable | Value |
|----------|-------|
| `GROQ_API_KEY` | Your Groq API key |
| `DATABASE_URL` | PostgreSQL connection string |
| `REACT_APP_WS_URL` | WebSocket URL (ws:// local, wss:// prod) |

---

## 🛠️ Troubleshooting

**"Not connected to anyone"** → Make sure two tabs are open and both clicked Start Chat

**AI suggestions not showing** → Check Groq API key is valid in `.env`

**Database errors** → The app works without DB (messages just won't persist). Check Supabase is running.

**CORS errors** → Backend allows all origins by default for local dev. For production, update `allow_origins` in `main.py`.
