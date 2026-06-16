# CLAUDE.md — AI Research Copilot

## Project Purpose

This is a production-grade AI Research Copilot built as a technical assignment. It researches companies and generates structured briefings using a multi-node LangGraph workflow. Users can then ask follow-up questions about the report via chat.

See `docs/architecture.md` for the full system design and `docs/requirements.md` for the assignment spec.

---

## Who I Am

- Learning as I build — when introducing a new concept (SSE vs WebSocket, semaphores, embedding vs referencing in MongoDB), explain it briefly before using it.
- I communicate by voice-to-text sometimes — if a message doesn't make sense in context, ask before assuming. Example: "mood" might mean "node".
- Prefer a clarifying question over guessing when a requirement is ambiguous, but don't ask if it's derivable from `docs/architecture.md` or `docs/db_design.png`.

---

## Code Style Rules

- **Comments explain WHY, not WHAT.** `# increment counter` is useless. `# BRPOP blocks until a job exists, avoids polling` is useful.
- Keep functions small and single-purpose.
- Use type hints everywhere in Python — function signatures should be self-documenting.
- **Layered structure — never break it:**
  - `routes/` → HTTP only (no business logic)
  - `services/` → business logic
  - `infra/` → external connections (DB, Redis, etc.)
  - `models/` → Pydantic schemas
  - `workflows/` → LangGraph graphs
- Routes call services. Services do the work. Never put business logic in a route handler.
- Match naming and import style in neighboring files before adding a new one.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| AI Workflow | LangGraph (mandatory — no single LLM call wrappers) |
| LLM | OpenAI GPT-4o |
| Web Search | Tavily API |
| Database | MongoDB (via Motor, async) |
| Job Queue | Redis (LPUSH/BRPOP — FIFO) |
| Real-time progress | SSE (server-sent events) |
| Real-time chat | WebSocket |
| Frontend | React + TypeScript + Vite + Tailwind |

---

## Current State (as of project start)

- Auth: signup/login working with JWT + bcrypt, MongoDB via Motor.
- Research flow (in progress): `/research/start` → pushes job to Redis → `worker.py` picks it up via BRPOP → runs a single-node LangGraph graph → prints result (no DB persistence yet).
- Redis and MongoDB run via `docker-compose.yml` in `backend/`.

**Not yet built:**
- Job status tracking / SSE polling
- Multi-node LangGraph workflow (see `docs/architecture.md` §5 for the full graph)
- Persisting results to MongoDB
- SSE for workflow progress
- WebSocket for follow-up chat
- Frontend (React)

---

## Architecture Decisions Already Made

Read `docs/architecture.md` before making structural changes. Key decisions:

1. **Redis queue decouples API from LangGraph worker** — FastAPI stays non-blocking; worker runs as a separate process.
2. **MongoDB for reports** — reports are document-shaped (nested JSON), not relational.
3. **SSE for workflow progress, WebSocket for chat** — SSE is one-way (progress events), WebSocket is bidirectional (chat turns).
4. **LangGraph worker emits SSE events per node** — each node completion emits `{ node, status, message, timestamp }`.

If a decision you're about to make conflicts with something documented in `docs/architecture.md`, point it out rather than silently overriding it.

---

## Running the Project

```bash
# Start Redis + MongoDB
cd backend && docker-compose up -d

# Start FastAPI
cd backend && uvicorn app.main:app --reload

# Start worker (separate terminal)
cd backend && python worker.py
```

Environment variables live in `backend/.env` — never commit this file.

---

## Change Log

All code changes are tracked in `docs/logs.md` with date and time.
