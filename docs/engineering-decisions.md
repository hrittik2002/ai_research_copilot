=# Engineering Decisions — AI Research Copilot

---

## Decision 1: DB Polling for Workflow Progress (instead of SSE)

### What we built

The frontend polls `GET /sessions/{id}/status` every 2–3 seconds to check workflow progress. Each poll reads directly from the `workflow_runs` collection in MongoDB, which the LangGraph worker keeps updated as each node completes. When the status reaches `complete` or `failed`, the client stops polling.

### Alternatives considered

**Option A — True SSE from worker via Redis Pub/Sub (the better architecture)**

The worker publishes a message to a Redis channel (`session:{id}:events`) after each node completes. The FastAPI backend subscribes to that channel and streams those events to the browser over an open HTTP connection (SSE). The client receives a push notification the moment a node finishes — no repeated requests.

```
Worker → redis.publish("session:abc:events", "{node: 'intent_parser', status: 'complete'}")
FastAPI → subscribes → streams as SSE to browser
```

**Option B — Long polling**

Client sends a request, backend holds it open until a new event arrives (or timeout), then responds. More efficient than naive polling but adds complexity in connection management and timeout handling.

### Why we went with polling

Polling was the fastest path to a working UI. SSE with Redis Pub/Sub introduces two new moving parts: a pub/sub channel lifecycle and a long-lived connection between FastAPI and the browser. If the SSE connection drops mid-workflow, reconnect logic becomes necessary. Polling is stateless — every request is independent, and a client can drop and reconnect without missing progress (because the full node history is in MongoDB, not in-memory).

For a 3-day build with many moving parts, the simplicity of polling was worth the latency tradeoff.

### Tradeoffs

| | Polling (current) | SSE + Redis Pub/Sub |
|---|---|---|
| Latency per event | 2–3 seconds (poll interval) | < 100ms (push) |
| Complexity | Low — one GET endpoint | Medium — pub/sub channel + SSE stream |
| Missed events | Impossible — DB is source of truth | Possible if connection drops without reconnect |
| Server load | N clients × poll interval requests | One open connection per active workflow |
| Implementation time | 1 hour | 4–6 hours |

### What we'd change with more time

Replace polling with SSE. The worker already writes to MongoDB per node — it would only need to additionally call `redis.publish()` per node. FastAPI would expose `GET /sessions/{id}/events` as an SSE endpoint, subscribing to that Redis channel and forwarding events to the browser. The client gets sub-second progress updates with no repeated requests.

---

## Decision 2: Side-Effect-Free LangGraph Nodes (Worker Owns All Persistence)

### What we built

Every LangGraph node is a pure function: it reads from `ResearchState`, does its work, and returns a partial state dict. **No node touches MongoDB or Redis.** All persistence — writing node completion records, saving the report, updating session status — happens in the worker's streaming loop, after each node yields.

```python
# worker.py — after each node completes
for chunk in research_graph.stream(initial_state, stream_mode="updates"):
    for node_name, state_update in chunk.items():
        accumulated_state.update(state_update)
        await _record_node_complete(session_id, node_name, state_update)  # DB write here
```

### Alternative considered

**Embed DB writes inside each node.** The `finalizer_node` could call `db.reports.insert_one(...)` directly. Each node could record its own completion. This mirrors a common pattern where side effects live close to the logic that produces them.

### Why we separated concerns

LangGraph nodes are synchronous functions (the graph runs with `.stream()`, not `async_stream()`). Mixing async MongoDB writes directly into sync node functions requires `asyncio.run()` hacks or a separate event loop — both fragile. More importantly, keeping nodes pure makes them independently testable: you can call `insight_extractor_node(state)` in a unit test without a database connection.

The worker's streaming loop is already the natural place to observe node outputs (LangGraph yields them). Attaching persistence there means the separation between "graph logic" and "infrastructure" is explicit and enforced by structure, not convention.

### Tradeoffs

| | Side-effect-free nodes (current) | DB writes inside nodes |
|---|---|---|
| Testability | High — nodes are pure functions | Low — every test needs a DB |
| Code locality | Low — persistence is separate from logic | High — each node owns its effects |
| Async complexity | None — worker handles all async | Medium — async inside sync graph nodes |
| Failure recovery | Worker can retry the DB write without re-running the node | Node failure is ambiguous (did the node fail, or just the DB write?) |

### What we'd change with more time

This decision holds. The only improvement would be making the worker's streaming loop more robust — e.g., wrapping each `_record_node_complete` in a retry with exponential backoff so a transient MongoDB timeout doesn't fail the whole workflow.

---

## Decision 3: DuckDuckGo Instant Answer API Instead of Tavily

### What we built

The `web_searcher_node` and `targeted_researcher_node` call DuckDuckGo's free Instant Answer API (`api.duckduckgo.com`) — no API key required, no account, no rate-limit tier to manage.

```python
resp = httpx.get(
    "https://api.duckduckgo.com/",
    params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
)
```

### Alternative considered

**Tavily Search API** — documented in `architecture.md` as the intended search provider. Tavily is purpose-built for LLM agents: it returns full-page summaries, filters noise, and consistently returns structured, high-quality results per query. It was the original design choice.

**SerpAPI / Bing Search API** — paid tiers with higher quality and higher daily limits than DuckDuckGo.

### Why we switched to DuckDuckGo

Tavily requires an API key and has a free tier limited to ~1,000 requests/month. During development with repeated test runs this limit gets consumed quickly, and a failed key mid-demo is worse than lower-quality results. DuckDuckGo's API has no key and no hard rate limits — it works unconditionally.

The tradeoff is significant: DuckDuckGo's Instant Answer API returns short abstract snippets, not full-page content. Many company-specific queries return empty results. This is why the `gap_detector_node` and `targeted_researcher_node` exist — to compensate for shallow initial results with targeted follow-up searches.

### Tradeoffs

| | DuckDuckGo (current) | Tavily |
|---|---|---|
| Setup friction | Zero — no key needed | API key required |
| Result quality | Low — short snippets, many misses | High — full-page summaries, filtered |
| Rate limits | None (informal) | 1,000 req/month on free tier |
| Cost | Free | Free tier, then paid |
| Reliability for obscure companies | Poor | Good |

### What we'd change with more time

Switch to Tavily as originally designed. Tavily's results would make the `gap_detector` loop less necessary for well-known companies, and the final report sections would be richer. The switch is a one-line change in the node implementation — the node interface is identical, only the HTTP call changes.

---

## Top Technical Debt Items

1. **No connection pool limits on MongoDB or Redis.** Under concurrent load, every workflow job opens connections without a ceiling. Should configure Motor's `maxPoolSize` and enforce one Redis connection per worker process.

2. **Worker is a single-process, single-job-at-a-time loop.** The `BRPOP` loop processes one session before picking up the next. A single LangGraph run takes 60–90 seconds (network I/O, 5–8 LLM calls). With 100 concurrent users each triggering a workflow, the 100th user waits 100 × 75s ≈ **2 hours** for their report. There is no queue position indicator, no ETA, and no way for the user to know why nothing is happening. Should run multiple worker processes (e.g. `python worker.py` × N), add a Redis-backed queue depth metric, and surface a "position in queue" estimate to the user.

3. **LangGraph graph runs synchronously inside an async event loop.** `research_graph.stream()` is a synchronous generator called from `asyncio.run(main())`. This blocks the event loop during each node execution. Should offload with `asyncio.run_in_executor()` or switch to LangGraph's async graph API.

4. **No retry logic for failed workflow jobs.** If the worker crashes mid-job, the session stays in `running` state permanently — there is no dead-letter queue or re-enqueue logic on startup.

5. **No rate limiting on any endpoint.** A single user can hammer `POST /sessions` and `POST /sessions/{id}/run` in a tight loop, flooding the Redis queue and starving other users. Auth endpoints (`/auth/login`, `/auth/signup`) have no brute-force protection either. Should add per-IP and per-user limits using a sliding window counter in Redis (e.g. `slowapi` for FastAPI).

6. **Chat history grows unbounded in the WebSocket loop.** The in-memory `history` list accumulates every turn in the session. For long conversations this inflates the LLM context window and increases cost per message.

---

## Biggest Technical Risk

**DuckDuckGo's Instant Answer API has no official SLA and is undocumented.** It is a public endpoint that DuckDuckGo exposes for its browser extension and widget use — not a developer API. DuckDuckGo could rate-limit, change the response schema, or shut it down without notice. If this happens in production (or during a demo), `web_searcher_node` returns empty strings for every query, and the report degrades to LLM-inferred content with no real research data.

The mitigation is to switch to Tavily (the original design choice) before any production or demo use. The code change is minimal — the risk is entirely in the current API dependency.

---

## What We Would Improve with 2 Additional Weeks

**Week 1 — Real-time infrastructure and search quality**

- Replace the polling `/status` endpoint with SSE via Redis Pub/Sub (Decision 1). The worker publishes per-node events; FastAPI streams them to the browser. Sub-100ms progress updates.
- Switch web search from DuckDuckGo to Tavily (Decision 3). The report quality improvement is immediate and significant.
- Add a dead-letter queue for failed jobs. On worker startup, scan MongoDB for sessions stuck in `running` (from a previous worker crash) and re-enqueue them.

**Week 2 — Scalability and product completeness**

- Run the LangGraph graph in a thread executor so the async worker event loop stays unblocked between nodes. This enables multiple concurrent in-progress workflows without separate worker processes.
- Add PDF export using `@react-pdf/renderer` — the report is already structured JSON, mapping it to a PDF template is low effort.
- Add rate limiting to the session creation and workflow trigger endpoints so one user cannot starve others on the shared worker queue.
- Replace the heuristic `quality_validator_node` with an LLM-scored quality check that returns a structured confidence score per section, enabling partial-report UX (show sections as they pass quality, rather than all at once at the end).
