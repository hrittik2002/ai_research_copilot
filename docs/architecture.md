# architecture.md — AI Research Copilot

---

## 1. Overview

The AI Research Copilot is a full-stack AI application that automates company research
for sales and business professionals. A user provides a company name, website, and
research objective. A LangGraph-powered workflow executes a multi-step research
pipeline, producing a structured briefing report. The user can then ask follow-up
questions about the report via a chat interface.

---

## 2. Functional Requirements

| # | Requirement |
|---|-------------|
| FR-1 | User can create a research session with company name, website, and objective |
| FR-2 | System executes a LangGraph research workflow on session creation |
| FR-3 | User can view real-time workflow progress as each node completes |
| FR-4 | System generates a structured report covering all required sections |
| FR-5 | User can view session history and revisit past sessions |
| FR-6 | User can ask follow-up questions about the generated report via chat |
| FR-7 | Chat messages and reports are persisted across sessions |
| FR-8 | Workflow state is checkpointed so failed runs can be recovered |

---

## 3. Non-Functional Requirements

| # | Requirement |
|---|-------------|
| NFR-1 | Workflow progress must stream to the client in real time (< 1s latency per event) |
| NFR-2 | Chat responses must stream token by token, not as a single block |
| NFR-3 | API must handle workflow failures gracefully with meaningful error states |
| NFR-4 | All sensitive config (API keys) must be environment-variable driven |
| NFR-5 | System must log all workflow node executions and errors |
| NFR-6 | Workflow must be recoverable from the last successful checkpoint on failure |
| NFR-7 | Backend must be stateless at the HTTP layer (state lives in DB only) |
| NFR-8 | Workflow execution must be decoupled from the API layer via a job queue |

---

## 4. System Architecture

### High-Level Architecture

```
┌──────────────────────────────────┐
│         React Frontend           │
│   REST       SSE      WebSocket  │
└───┬───────────┬───────────┬──────┘
    │           │           │
    ▼           ▼           ▼
┌──────────────────────────────────┐       ┌──────────────┐
│         FastAPI Backend          │──────▶│   MongoDB    │
│                                  │       │              │
│  Session APIs   POST /sessions   │       │  sessions    │
│  Workflow APIs  POST /sessions   │       │  messages    │
│                 /{id}/run        │       │  checkpoints │
│  Chat APIs      WS /chat/{id}    │       └──────────────┘
│  SSE            GET /sessions    │
│                 /{id}/status     │
└──────────────────┬───────────────┘
                   │
                   │ lpush job
                   ▼
          ┌─────────────────┐
          │   Redis Queue   │
          │                 │
          │  research_jobs  │  ←── jobs sit here
          └────────┬────────┘
                   │
                   │ brpop job
                   ▼
┌──────────────────────────────────┐       ┌──────────────┐
│      LangGraph Worker            │──────▶│  OpenAI API  │
│      (separate process)          │       │  (GPT-4o)    │
│                                  │       └──────────────┘
│  Pulls job from Redis            │
│  Runs full research workflow     │       ┌──────────────┐
│  Emits SSE events per node       │──────▶│Tavily Search │
│  Saves report to MongoDB         │       └──────────────┘
│  Saves checkpoints to MongoDB    │
└──────────────────────────────────┘
```

---

### 4.1 Database — MongoDB

MongoDB is chosen over a relational DB because research reports are naturally
document-shaped — nested JSON with variable fields per section. No rigid schema
is needed, and documents map directly to the report structure.

**Collections:**

```
users
{
  _id:        ObjectId,
  full_name:  String,
  email:      String,       // unique
  password:   String,       // bcrypt hashed
  created_at: DateTime
}

sessions
{
  _id:                  ObjectId,
  user_id:              ObjectId,    // ref → users
  company_name:         String,
  company_website:      String,
  research_objective:   String,
  status:               String,      // "pending" | "running" | "complete" | "failed"
  created_at:           DateTime,
  updated_at:           DateTime
}

reports                              // separate collection — 1:1 with sessions
{
  _id:          ObjectId,
  session_id:   ObjectId,            // ref → sessions
  generated_at: DateTime,
  content: {
    company_overview:       String,
    products_services:      String,
    target_customers:       String,
    business_signals:       String,
    risks_challenges:       String,
    discovery_questions:    String[],
    outreach_strategy:      String,
    unknowns:               String,
    sources:                String[]
  }
}

workflow_runs                        // execution log — 1:1 with sessions
{
  _id:            ObjectId,
  session_id:     ObjectId,          // ref → sessions
  status:         String,            // "pending" | "running" | "complete" | "failed"
  started_at:     DateTime,
  completed_at:   DateTime,
  error_message:  String,            // null if no error
  nodes: [
    {
      node_name:  String,            // e.g. "intent_parser", "web_searcher"
      status:     String,            // "pending" | "running" | "complete" | "failed"
      started_at: DateTime,
      output:     Object,            // whatever the node produced (raw JSON)
      error:      String             // null if no error
    }
  ]
}

messages                             // chat history — not in db_design.png but required by spec
{
  _id:        ObjectId,
  session_id: ObjectId,              // ref → sessions
  role:       String,                // "user" | "assistant"
  content:    String,
  created_at: DateTime
}
```

> **Note on `reports` vs embedded document:** The DB design (`db_design.png`) stores the report as a separate collection with a `session_id` FK rather than embedding it inside the session document. This keeps session documents small for list queries and lets the report be written atomically by the worker when the workflow completes.

> **Note on `workflow_runs` vs `checkpoints`:** The DB design uses `workflow_runs` with a `nodes[]` array as an execution log (per-node status, output, error). This replaces the earlier `checkpoints` design (which stored raw LangGraph state snapshots). LangGraph's built-in memory checkpointer handles in-process recovery; `workflow_runs` serves as the persistent audit log and the data source for SSE progress events.

---

### 4.2 External APIs

| API | Purpose | Why |
|-----|---------|-----|
| OpenAI GPT-4o | LLM for all reasoning, extraction, and report generation nodes | Strong structured output, reliable JSON mode |
| Tavily Search API | Web search inside the Researcher node | Purpose-built for LLM agents, returns clean summarized results |

---

### 4.3 Redis Queue

Redis acts as the job queue between FastAPI and the LangGraph worker. When a user
triggers a research session, FastAPI pushes a job into Redis and returns immediately.
The LangGraph worker runs as a separate process, pulling jobs one at a time.

**Why Redis queue instead of running the workflow directly inside FastAPI:**

Without a queue, every user triggering a workflow fires a LangGraph run directly
inside FastAPI. Under load this causes concurrency issues, timeouts, and server
crashes. Redis decouples the API layer from the compute layer — FastAPI stays fast
and responsive, the worker processes jobs at a controlled pace.

```
# FastAPI — enqueue job (non-blocking, returns immediately)
redis.lpush("research_jobs", json.dumps({
    "session_id": session_id,
    "company_name": company_name,
    "company_website": company_website,
    "research_objective": research_objective
}))

# LangGraph Worker — pull job (blocking, waits for next job)
_, job = redis.brpop("research_jobs", timeout=0)
data = json.loads(job)
# run LangGraph workflow with data
```

**Redis data structures used:**

| Key | Type | Purpose |
|-----|------|---------|
| `research_jobs` | List | Incoming workflow job queue (FIFO via lpush/brpop) |
| `session:{id}:status` | String | Current node name for SSE polling fallback |

---

## 5. LangGraph Workflow

### Design Philosophy

The workflow is designed around the idea that research has two distinct phases —
**data collection** and **insight generation** — and these should be separate concerns
in the graph. Web search and website scraping run in parallel to reduce latency.
A dedicated Gap Detector node decides whether the collected data is sufficient before
any LLM synthesis begins, avoiding wasted LLM calls on incomplete data.

### Graph State

```python
class ResearchState(TypedDict):
    # Inputs — match DB field names exactly
    company_name:          str
    company_website:       str
    research_objective:    str

    # Populated during data collection
    search_results:    list[str]      # from Tavily web search
    website_content:   str            # scraped from company website
    merged_raw_data:   str            # combined and deduplicated

    # Populated during insight extraction
    company_overview:       str
    products_services:      str
    target_customers:       str
    business_signals:       str
    risks_challenges:       str
    discovery_questions:    list[str]
    outreach_strategy:      str
    unknowns:               str
    sources:                list[str]

    # Control fields
    data_gaps:         list[str]      # what's missing, identified by gap detector
    retry_count:       int
    quality_passed:    bool
    current_node:      str
    final_report:      dict
```

---

### Workflow Graph

```
                    ┌─────────────────┐
                    │  Intent Parser  │
                    │                 │
                    │ Understands the │
                    │ objective deeply│
                    │ Decides what to │
                    │ look for        │
                    └────────┬────────┘
                             │
               ┌─────────────┴──────────────┐
               │                            │
               ▼                            ▼
   ┌───────────────────┐        ┌───────────────────────┐
   │   Web Searcher    │        │   Website Scraper     │
   │                   │        │                       │
   │ Tavily API calls  │        │ Scrapes company site  │
   │ based on intent   │        │ Extracts key content  │
   └─────────┬─────────┘        └───────────┬───────────┘
             │                              │
             └──────────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │     Data Merger       │
                │                       │
                │ Combines search +     │
                │ scrape results        │
                │ Deduplicates content  │
                └───────────┬───────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │     Gap Detector      │◀──────────────┐
                │                       │               │
                │ Checks if data is     │               │
                │ sufficient for all    │               │
                │ report sections       │               │
                └───────────┬───────────┘               │
                            │                           │
              ┌─────────────┴──────────────┐            │
              │ sufficient?                │ gaps found  │
              ▼                            ▼ (max 2x)   │
  ┌───────────────────┐        ┌───────────────────────┐│
  │  Insight Extractor│        │   Targeted Researcher ││
  │                   │        │                       ││
  │ LLM extracts all  │        │ Re-searches only for  │┘
  │ report sections   │        │ the identified gaps   │
  │ from merged data  │        └───────────────────────┘
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │  Report Compiler  │
  │                   │
  │ Structures all    │
  │ sections into     │
  │ final JSON report │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │ Quality Validator │
  │                   │
  │ Checks report     │
  │ completeness and  │
  │ coherence         │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │    Finalizer      │
  │                   │
  │ Saves report to   │
  │ MongoDB           │
  │ Marks session     │
  │ complete          │
  └───────────────────┘
```

### Node Responsibilities

| Node | Input | Output | LLM Used? |
|------|-------|--------|-----------|
| Intent Parser | company name, website, objective | structured search strategy | Yes |
| Web Searcher | search strategy | raw search results | No (Tavily API) |
| Website Scraper | website URL | scraped page content | No (HTTP + parser) |
| Data Merger | search results + scraped content | merged, deduplicated data | No (code logic) |
| Gap Detector | merged data, report sections needed | list of gaps or "sufficient" | Yes |
| Targeted Researcher | gap list | additional search results | No (Tavily API) |
| Insight Extractor | merged data | all report section content | Yes |
| Report Compiler | all section content | structured JSON report | Yes |
| Quality Validator | compiled report | quality_passed bool | Yes |
| Finalizer | report | saved to DB, session marked complete | No |

### Conditional Routing

```python
# After Gap Detector
def route_after_gap_detection(state: ResearchState) -> str:
    if not state["data_gaps"] or state["retry_count"] >= 2:
        return "insight_extractor"
    return "targeted_researcher"

# After Quality Validator
def route_after_quality_check(state: ResearchState) -> str:
    if state["quality_passed"]:
        return "finalizer"
    return "finalizer"    # proceed with what we have, flag as partial
```

---

### Real-time Communication

**SSE — Workflow Progress**
- Each node completion emits an SSE event to the frontend
- Payload: `{ node, status, message, timestamp }`
- Frontend animates progress step by step

**WebSocket — Follow-up Chat**
- On connect: backend loads report from MongoDB into system prompt
- User message → LLM call with report as context → streamed response
- All messages persisted to `messages` collection

---

## 6. Technology Choices

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React + TypeScript + Vite | Fast setup, type safety |
| Backend | FastAPI | Async support, native SSE + WebSocket |
| Job Queue | Redis (List + BRPOP) | Decouples API from workflow, prevents overload |
| AI Workflow | LangGraph | Multi-node, stateful, conditional routing |
| LLM | OpenAI GPT-4o | Strong structured output, reliable JSON mode |
| Web Search | Tavily API | Purpose-built for LLM agents |
| Database | MongoDB | Document-shaped report data, flexible schema |
| Real-time (progress) | SSE | One-way stream from worker to client |
| Real-time (chat) | WebSocket | Bidirectional communication for chat |
| Styling | Tailwind CSS | Rapid UI development |