# Change Log — AI Research Copilot

All code changes are recorded here chronologically.
Format: `## YYYY-MM-DD HH:MM` followed by a bullet list of what changed and why.

---

## 2026-06-16 — Auth integration (frontend + backend logout)

**Backend:**
- `app/core/security.py` — `create_access_token` now injects a `jti` (UUID v4) into every JWT so individual tokens can be revoked without invalidating all tokens.
- `app/services/auth_service.py` — added `logout_user(token)`: decodes the token, writes `token_blocklist:{jti}` to Redis with TTL = remaining token lifetime. Key auto-expires so no cleanup needed.
- `app/core/dependencies.py` — `get_current_user` now checks Redis for `token_blocklist:{jti}` before accepting the token. Revoked tokens return `401 Token has been revoked`.
- `app/routes/auth.py` — added `POST /auth/logout` (requires Bearer token). Calls `logout_user`; idempotent (double-logout returns 200).
- `app/main.py` — added `CORSMiddleware` allowing `http://localhost:5173` (the Vite dev server origin).

**Frontend:**
- `src/api/client.ts` — axios instance with `baseURL: http://localhost:8000`. Request interceptor auto-attaches `Authorization: Bearer <token>`. Response interceptor clears token + redirects to `/login` on any `401`.
- `src/api/auth.ts` — typed wrappers: `login()`, `signup()`, `logout()`.
- `src/contexts/AuthContext.tsx` — rewrote to call real API. `login()` stores the returned JWT; `logout()` calls the API first, always clears localStorage in `finally` so local state clears even if the network call fails.
- `src/pages/LoginPage.tsx` — replaced mock timeout with real `login()` call; shows backend error detail verbatim on failure.
- `src/pages/SignupPage.tsx` — replaced mock timeout with real `signup()` call; redirects to `/login` on success.
- `src/components/Sidebar.tsx` — added "Sign out" button pinned to the bottom of the sidebar. Calls `logout()` and navigates to `/login`.

---

## 2026-06-16 — Frontend scaffold (layout-only, mock data)

- Scaffolded `frontend/` — React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed in v4). Added `react-router-dom` v7, `@tanstack/react-query` v5, `lucide-react`, `axios`.
- `src/index.css` — Tailwind v4 `@theme` block with all design tokens from `fronend_plan.md` (bg-primary, bg-sidebar, bg-elevated, border, text-primary, text-secondary, accent, success, error).
- `src/types.ts` — TypeScript types for `Session`, `ReportContent`, `WorkflowNode`, `WorkflowStatus`, `Message` matching the API contract exactly.
- `src/mock-data.ts` — mock sessions (Acme Corp=complete, Xempla=running, Flytbase=failed), mock workflow node statuses, mock chat messages. Used in place of real API for layout validation.
- `src/contexts/AuthContext.tsx` — token stored in `localStorage`, exposes `login`, `signup`, `logout`.
- `src/components/ProtectedRoute.tsx` — redirects to `/login` if no token.
- `src/components/AppShell.tsx` — persistent sidebar (260px, desktop) + `<Outlet />`. Mobile: hamburger toggle opens sidebar as overlay drawer. Uses `100dvh` for correct mobile keyboard handling.
- `src/components/Sidebar.tsx` — "+ New Session" button, session history list (company_name as label, colored status dot per session status), Sign out button.
- `src/components/WorkflowProgressView.tsx` — vertical node chain. `web_searcher` + `website_scraper` rendered side-by-side (parallel). Animated pulsing border for `running` node. Checkmark/X icons for complete/failed.
- `src/components/CompleteSessionView.tsx` — desktop: 45/55 split (report panel left, chat panel right). Mobile (<1024px): collapsible "View Report" panel above chat. Chat panel has auto-growing textarea, token-streaming simulation, typing indicator (3 bouncing dots).
- `src/pages/LoginPage.tsx`, `SignupPage.tsx` — centered card, no sidebar, dark theme.
- `src/pages/CreateSessionPage.tsx` — 3-field form (company_name, company_website, research_objective). Submit disabled until all fields non-empty.
- `src/pages/SessionShellPage.tsx` — reads `session.status` and renders: pending→spinner, running/failed→WorkflowProgressView, complete→CompleteSessionView.
- `src/pages/RootRedirect.tsx` — if sessions exist, redirect to most recent; else redirect to `/sessions/new`.
- Route map: `/login`, `/signup` (public, no shell) | `/`, `/sessions/new`, `/sessions/:sessionId` (protected, inside AppShell).

---

## 2026-06-16 — LangGraph workflow + Worker checkpointing

- Rewrote `backend/app/workflows/research_graph.py` — full 10-node sequential LangGraph flow:
  - `intent_parser` → `web_searcher` → `website_scraper` → `data_merger` → `gap_detector` → (conditional) `targeted_researcher` → `insight_extractor` → `report_compiler` → `quality_validator` → `finalizer`
  - Web search uses DuckDuckGo free JSON API (no Tavily key needed for demo)
  - Website scraping uses `httpx` + Python built-in `html.parser` (no beautifulsoup4 needed)
  - All LLM calls use `gpt-4o-mini` via `langchain_openai`
  - Nodes are pure functions (no side effects) — all MongoDB writes live in the worker
  - `gap_detector` loops back via `targeted_researcher` up to 2 retries
  - `finalizer_node` is a no-op terminal node — signals completion to the worker
- Rewrote `backend/worker.py` — streaming loop with per-node MongoDB checkpointing:
  - Calls `connect_to_mongo()` on startup (separate process from FastAPI)
  - Uses `graph.stream(state, stream_mode="updates")` to get per-node state diffs
  - After each node: appends to `workflow_runs.nodes[]` in MongoDB (the polling endpoint reads this)
  - After `finalizer` node: writes `reports` doc + marks session and workflow_run `complete`
  - On exception: marks both `workflow_runs` and `sessions` as `failed`
- Updated `backend/requirements.txt` — added `httpx`, `langchain`, `langchain-core`, `langchain-openai`, `langgraph` (all were installed in venv but missing from the file)

**IDE note:** `bson` and `httpx` show unresolved import warnings in the IDE because the interpreter isn't pointed at `.venv`. Both packages are confirmed installed. Fix: set VS Code Python interpreter to `backend/.venv/bin/python`.

---

## 2026-06-16 — Workflow APIs (POST /sessions/{id}/run, GET /sessions/{id}/status)

- Updated `docs/api_design.md` — changed `GET /sessions/{id}/status` from SSE to a plain polling REST endpoint. Client calls every 2–3 seconds; stops when status is `complete` or `failed`. Simpler for a demo.
- Created `backend/app/models/workflow.py` — `NodeRun`, `StartWorkflowResponse`, `WorkflowStatusResponse` schemas.
- Created `backend/app/services/workflow_service.py`:
  - `start_workflow`: validates session ownership and `pending` state, creates a `workflow_runs` doc in MongoDB (so status endpoint works immediately), sets session status to `running`, then pushes job to Redis queue.
  - `get_workflow_status`: reads from `workflow_runs` collection and returns current state + node list.
- Updated `backend/app/routes/sessions.py` — added `POST /{session_id}/run` (202) and `GET /{session_id}/status` routes.

---

## 2026-06-16 — Sessions API (POST /sessions, GET /sessions, GET /sessions/{id})

- Created `backend/app/core/dependencies.py` — `get_current_user` FastAPI dependency. Extracts the JWT from the `Authorization: Bearer` header, decodes it via `decode_access_token`, and returns the `sub` claim (user_id string). No DB roundtrip — trusts the signed token.
- Created `backend/app/models/session.py` — three Pydantic schemas: `CreateSessionRequest` (with field validation), `ReportContent` (all 9 report sections typed), `SessionResponse` (full session + optional report), `SessionListItemResponse` (no report, for list endpoints).
- Created `backend/app/services/session_service.py` — `create_session`, `get_sessions`, `get_session`. `get_session` fetches the report from the `reports` collection only when `status == "complete"`. `user_id` stored as string in MongoDB to match the JWT `sub` claim pattern. Malformed ObjectId returns 404 (not 400) to avoid leaking schema details.
- Created `backend/app/routes/sessions.py` — three route handlers, all protected via `Depends(get_current_user)`.
- Updated `backend/app/main.py` — imported and registered `sessions.router`.

---

## 2026-06-16 — DB Schema Alignment

- Updated `docs/architecture.md` §4.1 to match `docs/db_design.png` (authoritative source):
  - `sessions`: added `user_id` FK, renamed `website` → `company_website`, `objective` → `research_objective`, removed embedded `report` field.
  - Added `reports` as a separate collection (1:1 with sessions) with `generated_at` and typed `content` object.
  - Replaced `checkpoints` collection with `workflow_runs` collection (per db_design.png): stores per-node `status`, `output`, and `error` as `nodes[]` array — execution log, not raw LangGraph state snapshots.
  - Kept `messages` collection (required for chat, absent from image likely an oversight).
  - Added explanatory notes on why `reports` is separate and why `workflow_runs` replaced `checkpoints`.
- Updated `docs/architecture.md` §4.3 Redis example: fixed field names to `company_website`, `research_objective`.
- Updated `docs/architecture.md` §5 LangGraph `ResearchState`: `website` → `company_website`, `objective` → `research_objective` to match DB.
- Updated `docs/api_design.md`: clarified that `GET /sessions/{id}` merges data from both `sessions` and `reports` collections at the API layer. Added DB storage notes at the bottom.

---

## 2026-06-16 — API Design

- Created `docs/api_design.md` — full API design covering all 12 endpoints across Auth, Sessions, Workflow, Report, Chat, and Health. Includes request/response shapes, status codes, SSE event format, WebSocket protocol, and a summary table marking what's built vs. what's not.
- Flagged that `POST /research/start` (existing) uses wrong field names and will be replaced by `POST /sessions` + `POST /sessions/{id}/run`.

---

## 2026-06-16 — Project Setup

- Created `CLAUDE.md` at project root — documents stack, code style rules, layered architecture conventions, current project state, and how to run the project. This is Claude Code's working context file.
- Created `docs/logs.md` (this file) — chronological record of all code changes.
- Created `.gitignore` at project root — covers Python, Node/frontend, environment files, IDE artifacts, Docker volumes, and macOS system files.
