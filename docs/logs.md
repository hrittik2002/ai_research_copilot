# Change Log — AI Research Copilot

All code changes are recorded here chronologically.
Format: `## YYYY-MM-DD HH:MM` followed by a bullet list of what changed and why.

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
