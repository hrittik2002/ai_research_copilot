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

## Current State

### Backend — built and working
- **Auth** — `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`. JWTs carry a `jti`; logout blocklists the token in Redis. `get_current_user` dependency checks the blocklist.
- **Sessions API** — `POST /sessions`, `GET /sessions`, `GET /sessions/{id}` (embeds report when complete).
- **Workflow API** — `POST /sessions/{id}/run` (enqueues to Redis, sets status=running), `GET /sessions/{id}/status` (polling, reads `workflow_runs` collection).
- **LangGraph worker** (`worker.py`) — full 10-node graph with parallel web_searcher/website_scraper, conditional targeted_researcher loop, per-node MongoDB checkpointing, report saved to `reports` collection on completion.
- **CORS** — `http://localhost:5173` allowed.

### Frontend — layout complete, API calls mocked
- `frontend/` — React 19 + TypeScript + Vite 8 + Tailwind CSS v4. See `docs/fronend_plan.md` for the full design spec.
- Auth flow wired to real API (login/signup/logout all working).
- All other data (sessions list, workflow status, messages) still uses mock data in `src/mock-data.ts`.

**Next to build:**
- Replace mock data with real React Query hooks (sessions, workflow polling, chat).
- WebSocket chat (`WS /chat/{session_id}?token=<jwt>`).
- `GET /sessions/{id}/messages` endpoint (backend).
- PDF export (`@react-pdf/renderer`).

### Running the project
```bash
cd backend && docker-compose up -d          # Redis + MongoDB
cd backend && uvicorn app.main:app --reload  # FastAPI
cd backend && python worker.py              # LangGraph worker
cd frontend && npm run dev                  # Vite dev server → http://localhost:5173
```

Environment variables in `backend/.env` — never commit this file.

---

## Architecture Decisions Already Made

Read `docs/architecture.md` before making structural changes. Key decisions:

1. **Redis queue decouples API from LangGraph worker** — FastAPI stays non-blocking; worker runs as a separate process.
2. **MongoDB for reports** — reports are document-shaped (nested JSON), not relational.
3. **SSE for workflow progress, WebSocket for chat** — SSE is one-way (progress events), WebSocket is bidirectional (chat turns).
4. **LangGraph worker emits SSE events per node** — each node completion emits `{ node, status, message, timestamp }`.

If a decision you're about to make conflicts with something documented in `docs/architecture.md`, point it out rather than silently overriding it.

---

## Change Log

All code changes are tracked in `docs/logs.md` with date and time.
