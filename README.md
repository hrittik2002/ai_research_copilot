# AI Research Copilot

Researches a company and generates a structured sales briefing using a multi-node LangGraph workflow. Follow-up questions answered via a chat interface grounded in the report.

---

## Demo

[Watch the demo on Loom](https://www.loom.com/share/3f833a95a148493ebaed5eebe5c8c234)

---

## Docs

| Document | What's in it |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | System design, DB schema, workflow graph, technology choices |
| [`docs/engineering-decisions.md`](docs/engineering-decisions.md) | 3 major engineering decisions, tradeoffs, and technical debt |
| [`docs/product-improvements.md`](docs/product-improvements.md) | Weaknesses, roadmap, success metrics, business thinking |
| [`docs/api_design.md`](docs/api_design.md) | Full API reference with request/response shapes |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for MongoDB and Redis)
- An OpenAI API key

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd ai_research_copilot
```

### 2. Start MongoDB and Redis

```bash
cd backend
docker compose up -d
```

This starts MongoDB on port `27017` and Redis on port `6379`. Data is persisted in a Docker volume (`mongo_data`).

### 3. Set up the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=research_copilot
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=sk-...
```

> `JWT_SECRET_KEY` can be any long random string. Generate one with `python -c "import secrets; print(secrets.token_hex(32))"`.

### 4. Set up the frontend

```bash
cd frontend
npm install
```

---

## Running

You need **three terminals** running at the same time.

**Terminal 1 — FastAPI backend**

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Runs on `http://localhost:8000`.

**Terminal 2 — LangGraph worker**

```bash
cd backend
source venv/bin/activate
python worker.py
```

The worker listens on the Redis queue and processes research jobs. Keep this running — without it, workflow runs will queue up but never execute.

**Terminal 3 — Frontend**

```bash
cd frontend
npm run dev
```

Runs on `http://localhost:5173`. Open this in your browser.

---

## Verify everything is up

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Check Docker containers:

```bash
docker compose -f backend/docker-compose.yml ps
```

Both `mongo` and `redis` should show as running.

---

## Stopping

```bash
# Stop the three terminal processes with Ctrl+C

# Stop Docker containers
cd backend
docker compose down
```

To also delete all stored data (MongoDB volume):

```bash
docker compose down -v
```
