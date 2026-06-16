# API Design — AI Research Copilot

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Built and working |
| ⚠️ | Built but needs changes |
| 🔲 | Not yet built |

All protected endpoints require `Authorization: Bearer <token>` header.
All timestamps are ISO 8601 UTC strings.

---

## Auth

### POST /auth/signup ✅
Create a new user account.

**Request**
```json
{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Response 201**
```json
{
  "id": "user_abc123",
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "created_at": "2026-06-16T10:00:00Z"
}
```

**Errors**
- `409` — email already registered

---

### POST /auth/login ✅
Authenticate and receive a JWT access token.

**Request**
```json
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Response 200**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

**Errors**
- `401` — invalid credentials

---

## Sessions

> A Session is the top-level entity: it holds the research inputs, current status, and links to the report and workflow run.
> The DB design shows `Session` has: `company_name`, `company_website`, `research_objective`, `status`, `created_at`, `updated_at`.

### POST /sessions 🔲
Create a new research session. Does **not** start the workflow — session is created in `pending` state. The client calls `POST /sessions/{id}/run` next to trigger research.

**Auth required**

**Request**
```json
{
  "company_name": "Acme Corp",
  "company_website": "https://acme.com",
  "research_objective": "Understand their product offerings before a discovery call"
}
```

**Response 201**
```json
{
  "session_id": "sess_abc123",
  "company_name": "Acme Corp",
  "company_website": "https://acme.com",
  "research_objective": "Understand their product offerings before a discovery call",
  "status": "pending",
  "created_at": "2026-06-16T10:00:00Z",
  "updated_at": "2026-06-16T10:00:00Z"
}
```

**Errors**
- `422` — validation error (missing required fields)

---

### GET /sessions 🔲
List all sessions for the authenticated user, newest first.

**Auth required**

**Response 200**
```json
[
  {
    "session_id": "sess_abc123",
    "company_name": "Acme Corp",
    "company_website": "https://acme.com",
    "research_objective": "Understand their product offerings before a discovery call",
    "status": "complete",
    "created_at": "2026-06-16T10:00:00Z",
    "updated_at": "2026-06-16T10:05:00Z"
  }
]
```

`status` values: `pending` | `running` | `complete` | `failed`

---

### GET /sessions/{session_id} 🔲
Get a single session. If the session is complete, includes the report inline (fetched from the `reports` collection and merged into the response — stored separately in DB but returned together for convenience).

**Auth required**

**Response 200**
```json
{
  "session_id": "sess_abc123",
  "company_name": "Acme Corp",
  "company_website": "https://acme.com",
  "research_objective": "...",
  "status": "complete",
  "created_at": "2026-06-16T10:00:00Z",
  "updated_at": "2026-06-16T10:05:00Z",
  "report": {
    "company_overview": "...",
    "products_services": "...",
    "target_customers": "...",
    "business_signals": "...",
    "risks_challenges": "...",
    "discovery_questions": ["...", "..."],
    "outreach_strategy": "...",
    "unknowns": "...",
    "sources": ["https://...", "https://..."]
  }
}
```

`report` is `null` if status is not `complete`.

**Errors**
- `404` — session not found
- `403` — session belongs to a different user

---

## Workflow

### POST /sessions/{session_id}/run 🔲
Trigger the LangGraph research workflow for an existing session. Pushes a job to the Redis queue and immediately returns. Session status transitions to `running`.

**Auth required**

**Response 202**
```json
{
  "session_id": "sess_abc123",
  "status": "running",
  "message": "Workflow started"
}
```

**Errors**
- `404` — session not found
- `409` — workflow already running or already complete for this session

---

### GET /sessions/{session_id}/status 🔲
**Polling endpoint** — client calls this every 2–3 seconds to get the current workflow state. Reads directly from the `workflow_runs` collection in MongoDB. No streaming, no open connection.

When `status` is `complete` or `failed`, the client stops polling and (if complete) opens the WebSocket for chat.

**Auth required**

**Response 200**
```json
{
  "session_id": "sess_abc123",
  "status": "running",
  "started_at": "2026-06-16T10:00:05Z",
  "completed_at": null,
  "error_message": null,
  "nodes": [
    {
      "node_name": "intent_parser",
      "status": "complete",
      "started_at": "2026-06-16T10:00:06Z",
      "output": { "search_queries": ["Acme Corp products", "Acme Corp funding"] },
      "error": null
    },
    {
      "node_name": "web_searcher",
      "status": "running",
      "started_at": "2026-06-16T10:00:09Z",
      "output": null,
      "error": null
    }
  ]
}
```

**Node names** (in execution order):
`intent_parser` → `web_searcher` / `website_scraper` (parallel) → `data_merger` → `gap_detector` → `targeted_researcher` (conditional) → `insight_extractor` → `report_compiler` → `quality_validator` → `finalizer`

**Node status values:** `pending` | `running` | `complete` | `failed`

**Errors**
- `404` — session not found or workflow not yet started (call `POST /run` first)
- `403` — session belongs to a different user

---

## Report

### GET /sessions/{session_id}/report 🔲
Fetch the completed report for a session. Convenience endpoint — same report is also embedded in `GET /sessions/{session_id}` when complete.

**Auth required**

**Response 200**
```json
{
  "session_id": "sess_abc123",
  "generated_at": "2026-06-16T10:05:00Z",
  "content": {
    "company_overview": "Acme Corp is a B2B SaaS company...",
    "products_services": "Their flagship product is...",
    "target_customers": "Mid-market sales teams...",
    "business_signals": "Series B raised in Jan 2026, hiring 40 AEs...",
    "risks_challenges": "Facing competition from...",
    "discovery_questions": [
      "How are you currently handling X?",
      "What does your current workflow look like?"
    ],
    "outreach_strategy": "Lead with the ROI angle, reference...",
    "unknowns": "Could not determine pricing model or ARR.",
    "sources": [
      "https://acme.com/about",
      "https://techcrunch.com/acme-series-b"
    ]
  }
}
```

**Errors**
- `404` — session not found or report not yet generated
- `409` — session is still running (report not ready)

---

## Chat

### WS /chat/{session_id} 🔲
**WebSocket** — bidirectional chat. The report is loaded as system context on connect. The LLM streams its reply token-by-token back to the client. All messages are persisted to the `messages` collection in MongoDB.

**Auth required** — pass the JWT as a query param on connect: `WS /chat/{session_id}?token=<jwt>` (WebSocket upgrades cannot carry custom headers in the browser).

**Why WebSocket instead of SSE for chat:** SSE is one-way (server → client only). Chat needs the client to send messages too. WebSocket is bidirectional.

**Client → Server (JSON text frame)**
```json
{ "message": "What is their main product?" }
```

**Server → Client — streamed token frames (plain text)**
```
Their
 main
 product
 is
...
```

**Server → Client — done signal (JSON text frame)**
```json
{ "done": true, "message_id": "msg_xyz789" }
```

**Server → Client — error frame (JSON text frame)**
```json
{ "error": "Session not found" }
```

**Errors**
- `4003` (close code) — session not found
- `4004` (close code) — report not ready, cannot start chat yet
- `4001` (close code) — invalid or expired JWT

---

### GET /sessions/{session_id}/messages 🔲
Fetch full chat history for a session, ordered oldest first.

**Auth required**

**Response 200**
```json
[
  {
    "message_id": "msg_001",
    "role": "user",
    "content": "What is their main product?",
    "created_at": "2026-06-16T10:10:00Z"
  },
  {
    "message_id": "msg_002",
    "role": "assistant",
    "content": "Their main product is...",
    "created_at": "2026-06-16T10:10:03Z"
  }
]
```

---

## Workflow Run Detail (internal / optional)

### GET /sessions/{session_id}/workflow 🔲
Fetch the WorkflowRun record — useful for debugging and showing which nodes ran, their outputs, and errors. This maps to the `WorkflowRun` entity in the DB.

**Auth required**

**Response 200**
```json
{
  "session_id": "sess_abc123",
  "status": "complete",
  "started_at": "2026-06-16T10:00:05Z",
  "completed_at": "2026-06-16T10:05:00Z",
  "error_message": null,
  "nodes": [
    {
      "node_name": "intent_parser",
      "status": "complete",
      "started_at": "2026-06-16T10:00:05Z",
      "output": { "search_strategy": "..." },
      "error": null
    },
    {
      "node_name": "web_searcher",
      "status": "complete",
      "started_at": "2026-06-16T10:00:08Z",
      "output": { "result_count": 8 },
      "error": null
    }
  ]
}
```

---

## Health

### GET /health ✅
```json
{ "status": "ok" }
```

---

## Summary Table

| # | Method | Path | Status | Auth |
|---|--------|------|--------|------|
| 1 | POST | `/auth/signup` | ✅ Done | No |
| 2 | POST | `/auth/login` | ✅ Done | No |
| 3 | POST | `/sessions` | 🔲 Build | Yes |
| 4 | GET | `/sessions` | 🔲 Build | Yes |
| 5 | GET | `/sessions/{session_id}` | 🔲 Build | Yes |
| 6 | POST | `/sessions/{session_id}/run` | 🔲 Build | Yes |
| 7 | GET | `/sessions/{session_id}/status` | 🔲 Build (polling) | Yes |
| 8 | GET | `/sessions/{session_id}/report` | 🔲 Build | Yes |
| 9 | WS | `/chat/{session_id}` | 🔲 Build | Yes (query param) |
| 10 | GET | `/sessions/{session_id}/messages` | 🔲 Build | Yes |
| 11 | GET | `/sessions/{session_id}/workflow` | 🔲 Build | Yes |
| 12 | GET | `/health` | ✅ Done | No |

> **Note on `/research/start`:** The existing `POST /research/start` endpoint uses field names (`topic`, `objective`) that don't match the DB design (`company_name`, `company_website`, `research_objective`) and doesn't persist anything to MongoDB. It will be replaced by `POST /sessions` + `POST /sessions/{id}/run`.

> **Note on DB storage:** `Report` is a separate collection (not embedded in `Session`) per `db_design.png`. `GET /sessions/{id}` merges them at the API layer for client convenience. `WorkflowRun` (with `nodes[]`) replaces the earlier `checkpoints` design — it is the execution log that SSE events are derived from.
