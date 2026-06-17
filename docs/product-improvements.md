# Product Improvements — AI Research Copilot

---

## 1. Weaknesses in the Current Product Design

1. **Research takes too long with no feedback on quality.** The workflow runs for 60–90 seconds and the user stares at a progress bar. There is no signal about whether the data found was rich or shallow — a report on a Fortune 500 company looks identical in the UI to one where DuckDuckGo returned nothing useful.

2. **Single-user workflow queue.** One user triggering a long research job blocks everyone else on the shared worker. There is no queue visibility, no ETA, and no fairness — a power user running 10 sessions back-to-back starves all other users.

3. **No export or sharing.** The report lives inside the app. Sales reps need to paste it into a CRM, send it to a colleague, or attach it to a call prep doc. Without PDF export or a shareable link, the user must manually copy sections — friction that kills adoption.

4. **Chat has no memory across sessions.** Each WebSocket connection loads the full message history for that session, but there is no cross-session user context. If a user researches the same company twice, the second chat has no awareness of the first conversation or prior insights.

5. **No CRM integration.** The end state of a research session is a briefing doc, but the user's actual job is logged in Salesforce, HubSpot, or Outreach. Without a push-to-CRM action, the report is a dead end — the user leaves the app to do the real work.

6. **Report quality is opaque.** The `quality_validator` silently passes or fails with no user-visible confidence signal. Users have no way to know if a section is LLM-inferred (no real data found) vs grounded in actual sources.

---

## 2. Top 3 Improvements to Build Next

**1. PDF export + shareable link** — Highest leverage for adoption. A sales rep who can send a one-click briefing PDF to their manager or attach it to a Salesforce opportunity becomes an active distributor of the product. Implementation: `@react-pdf/renderer` maps the existing JSON report to a template; shareable link is a signed URL with a 7-day TTL. Estimated effort: 3 days.

**2. Per-section confidence indicators** — Directly addresses the trust problem. Show a `[sourced]` / `[inferred]` badge per report section based on whether the insight extractor found real data or fell back to LLM knowledge. This is a UX change on top of data already available in the workflow state. Estimated effort: 2 days.

**3. Salesforce / HubSpot one-click push** — Converts the product from a standalone research tool into part of the sales workflow. A rep researches a company, clicks "Push to CRM", and the report populates the account notes field. This is the unlock for enterprise deals where IT evaluates tools based on stack integration. Estimated effort: 1 week per CRM.

---

## 3. Who Buys, Who Uses, Why They Pay

**Buyer:** VP of Sales or RevOps at a B2B company with 20–500 sellers. They are measured on pipeline velocity and rep ramp time. They pay for tools that make their team more effective per hour.

**User:** Account Executive or SDR. They do 5–15 meeting preps per week, each taking 30–60 minutes of manual research. This product cuts that to 90 seconds. The value is time — 1 hour saved per rep per day × 50 reps = 250 hours/week returned to selling.

**Why they pay:** The alternative is manual research across LinkedIn, Crunchbase, company websites, and news — fragmented, inconsistent, and not replicable. This product standardises what "good meeting prep" looks like across the whole team and makes it instant. At $30–$50/user/month, it pays back in the first reclaimed meeting prep.

---

## 4. Success Metrics

| Metric | Target (90 days) |
|--------|-----------------|
| Sessions created per active user per week | ≥ 3 |
| Report completion rate (started → complete) | ≥ 90% |
| Time-to-report (p95) | < 2 minutes |
| Chat engagement rate (% of complete sessions where user asks ≥ 1 question) | ≥ 40% |
| Week-2 retention | ≥ 60% |
| NPS | ≥ 40 |

---

## 5. 4-Week AI Roadmap

**Week 1 — Report quality**
Switch web search from DuckDuckGo to Tavily. Add per-section source attribution and `[inferred]` flags. Replace the heuristic quality validator with an LLM-scored rubric that returns a confidence score per section.

**Week 2 — Real-time UX**
Replace polling with SSE via Redis Pub/Sub. The user sees each node complete in real time (<100ms latency). Add an estimated time-remaining indicator based on average node completion times.

**Week 3 — Distribution**
PDF export with branded template. Shareable read-only report links (signed URL, 7-day TTL). Email delivery: "Your briefing on Acme Corp is ready" with the PDF attached.

**Week 4 — Workflow intelligence**
Add a Research Memory layer: before running a new workflow, check if the company was researched in the last 30 days and surface the prior report with a "refresh" option. Add multi-company comparison: run two sessions side-by-side and generate a competitive diff.

---

## 6. Biggest Cost, Scaling, and Reliability Risks

**Cost:** Every research session makes 5–8 LLM calls (intent parser, gap detector, insight extractor, report compiler, quality validator). At GPT-4o pricing, a single session costs ~$0.05–$0.15. At 1,000 sessions/day this is $50–$150/day in LLM costs alone — before infra. Mitigation: cache reports for 30 days, use GPT-4o-mini for non-critical nodes (gap detector, quality validator).

**Scaling:** The single-process LangGraph worker is the primary bottleneck. One slow job (website scrape timeout, LLM retry) blocks the queue for all users. Mitigation: run multiple worker processes, add per-job timeouts, implement a fair queue with per-user rate limits.

**Reliability:** DuckDuckGo's Instant Answer API is undocumented and has no SLA. If it goes down, all search results are empty and reports degrade silently to LLM-hallucinated content. Mitigation: switch to Tavily immediately; add a search health check that alerts on >20% empty-result rate.

---

## 7. Feature to Remove

**The `GET /sessions/{id}/workflow` endpoint** (full node execution detail with raw outputs). It was built for debugging and exposes internal worker state — truncated LLM outputs, node timing, error strings — to authenticated clients. It adds maintenance surface with no user-facing value. Remove it; move node-level debugging to internal observability tooling (Datadog, Sentry) instead.

---

## 8. Feature to Add

**Async email delivery with a briefing PDF.** After a workflow completes, send the user an email with the report as a PDF attachment. This decouples report delivery from the browser tab — a rep can trigger research on their phone, close the app, and have the briefing in their inbox before the meeting. It also creates a natural re-engagement loop: every completed session sends an email, keeping the product top-of-mind even for infrequent users.

---

## 9. First 90-Day Roadmap

**Days 1–30 — Make the core trustworthy**
Fix the search quality problem (Tavily). Add source attribution and confidence badges. Achieve >90% workflow completion rate. These are table-stakes — no amount of new features matters if users don't trust the report.

**Days 31–60 — Drive distribution**
Ship PDF export and shareable links. Integrate with one CRM (Salesforce first — largest market). Add email delivery on completion. Measure whether users share reports; sharing is the primary viral loop.

**Days 61–90 — Expand the use case**
Add Research Memory (skip re-research for recently studied companies). Add a team workspace so managers can see their reps' research sessions. Begin building the pricing page and self-serve signup flow for the paid tier.

---

## 10. What I Would Change First

**Switch DuckDuckGo to Tavily.** Everything else — report trust, feature adoption, retention — depends on the quality of the underlying research data. The current DuckDuckGo integration returns shallow snippets for most queries; the report is partly LLM-hallucinated on any company that isn't a household name. The code change is a single function in `research_graph.py`. Until the research quality problem is solved, every other improvement is built on a weak foundation.
