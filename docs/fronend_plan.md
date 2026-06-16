# Frontend Plan — AI Research Copilot

> Reference docs used: `api_design.md`, `architecture.md`, hand-drawn wireframe (Create Session / Chat Page with workflow nodes / Chat Page with messages).

---

## 1. Design Pattern

**Pattern: Claude/ChatGPT shell** — persistent left sidebar + single dynamic main panel.

> Scope: this shell (and its sidebar) applies **only after login** — i.e. `/sessions/new` and `/sessions/:sessionId`. The auth pages (`/login`, `/signup`) render with **no sidebar at all** — just a centered card on a blank background, confirmed again in §3.

```
┌──────────────┬─────────────────────────────────────┐
│ + New Session│                                       │
│──────────────│         MAIN PANEL                   │
│ Session Hist. │  (swaps based on session.status)     │
│  Xempla       │                                       │
│  Flytbase     │   pending  → redirect to form         │
│  Acme Corp    │   running  → Workflow Progress View   │
│  ...          │   complete → Chat View                │
│              │   failed   → Error View + Retry        │
│              ├───────────────────────────────────────┤
│              │  [ message input — disabled until      │
│              │    status === "complete" ]   [ > ]     │
└──────────────┴─────────────────────────────────────┘
```

The sidebar **never changes once the user is inside the app shell**. Only the main panel content changes based on `session.status`. This matches the wireframe exactly — same sidebar across all three post-login screens, only the right side differs. The auth pages sit entirely outside this shell.

**Theme:** Dark mode only (v1). No light/dark toggle needed — matches Claude/ChatGPT default and removes a state dimension from this build.

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#1a1a1a` | App background |
| `--bg-sidebar` | `#171717` | Sidebar (slightly darker) |
| `--bg-elevated` | `#2a2a2a` | Input bars, cards, hover states |
| `--border` | `#3a3a3a` | Dividers, input outlines |
| `--text-primary` | `#e8e8e6` | Main text |
| `--text-secondary` | `#9b9b97` | Timestamps, muted labels |
| `--accent` | `#d97757` | Primary actions (matches Claude's accent warmth) — adjust freely |
| `--success` | `#4ade80` | Node complete |
| `--error` | `#f87171` | Node/session failed |

Font: system stack (`-apple-system, Inter, sans-serif`) for body, monospace (`ui-monospace, "SF Mono"`) for any node-name/status text — gives it a slight "engineering tool" feel that fits a research copilot.

---

## 2. Route Map

| Route | Page | Auth | Notes |
|---|---|---|---|
| `/login` | Sign In | Public | Redirects to `/` if already authed |
| `/signup` | Sign Up | Public | |
| `/` | Smart redirect | Protected | See §3 logic |
| `/sessions/new` | Create New Session | Protected | Matches wireframe 1 |
| `/sessions/:sessionId` | Session Shell (Progress or Chat) | Protected | Matches wireframe 2 & 3 — same route, different rendered state |

We do **not** create separate routes for "progress" vs "chat" — it's one route (`/sessions/:sessionId`) whose main panel content is derived from `session.status`. This avoids a confusing URL change mid-flow and means refreshing the page mid-research just resumes polling correctly.

---

## 3. Auth Flow

**No sidebar on these pages — full-bleed, blank background, just a centered card.** This is the one part of the app outside the shell described in §1.

**Pages:** `/login`, `/signup` — matches every Claude/ChatGPT auth screen.

| Action | API | On success |
|---|---|---|
| Sign up | `POST /auth/signup` | Show success, auto-redirect to `/login` (no auto-login per current API — signup doesn't return a token) |
| Sign in | `POST /auth/login` | Store `access_token` (see storage decision below), redirect to `/` |

**Token storage decision:** `localStorage` for v1 simplicity (assignment-scope, not production hardened — flag this explicitly in `engineering-decisions.md` as a tradeoff vs. httpOnly cookies). Attach as `Authorization: Bearer <token>` via a single axios/fetch interceptor — every protected call goes through one client instance so this is a one-line concern.

**Route guard:** A `<ProtectedRoute>` wrapper checks for a token; if absent, redirect to `/login`. A `401` response from *any* API call globally clears the token and redirects to `/login` (handles expiry mid-session).

**Root `/` redirect logic (your point #3/#4):**
```
on load:
  GET /sessions
  if list is empty        → redirect to /sessions/new
  if list is non-empty     → redirect to /sessions/{most_recent.session_id}
```
This satisfies "if user has no sessions → create page; if user has past sessions → land in the chat-like shell" without a dead/empty home page.

---

## 4. Page-by-Page Breakdown

### 4.1 Create New Session (`/sessions/new`)

Matches wireframe 1 — centered card, 3 inputs, 1 button. No sidebar shown here in the wireframe, but since it's also reachable via "+ New Session" from inside the shell (wireframe 2/3 sidebar), it should support **both**:
- Standalone full-page version (first-ever visit, root redirect)
- Rendered inside the shell's main panel (clicked from sidebar while already in a session)

Simplest implementation: always render inside the shell layout (sidebar always present once authed) — just keep the form itself centered and minimal like the wireframe shows. One component, reused.

**Form fields → request body for `POST /sessions`:**

| Field | Maps to |
|---|---|
| Company Name | `company_name` |
| Company Website | `company_website` |
| Research Objective | `research_objective` |

**Flow on "Start Research" click:**
1. `POST /sessions` → returns `session_id`, `status: "pending"`
2. Immediately `POST /sessions/{session_id}/run` → status flips to `"running"`
3. Navigate to `/sessions/{session_id}`
4. Sidebar's session list re-fetches (or optimistically prepends the new session)

Validation: disable submit until all 3 fields are non-empty; basic URL shape check on website field client-side (backend still returns `422` as source of truth — show that message verbatim if it fires).

---

### 4.2 Session Shell (`/sessions/:sessionId`)

This single route renders **one layout, four possible main-panel states**, driven by `session.status`:

#### State: `pending`
Rare/instant — shown only in the gap between `POST /sessions` and `POST /run` if that gap is ever visible. Simple "Starting research…" spinner. (In practice §4.1's flow fires both calls back to back, so this state is mostly invisible — but handle it so a page refresh during it doesn't break.)

#### State: `running` — Workflow Progress View (wireframe 2, left chat page)

This is the vertical node-chain in your wireframe: circles connected by arrows, top to bottom.

**Data source:** Poll `GET /sessions/{session_id}/status` every **2.5 seconds** (per `architecture.md` SSE-vs-polling note — your API doc explicitly says this is a polling endpoint, no SSE/streaming on this one despite architecture.md mentioning SSE elsewhere; **the API doc wins as source of truth** since it's the more recently specified contract).

**Render the fixed node sequence** from the API doc, in order:
```
intent_parser → web_searcher / website_scraper (parallel) → data_merger
→ gap_detector → targeted_researcher (conditional) → insight_extractor
→ report_compiler → quality_validator → finalizer
```

Each node circle has 4 visual states matching the API's node `status` enum:

| API status | Circle style |
|---|---|
| `pending` | Outline only, muted gray, no fill |
| `running` | Pulsing border (CSS animation), accent color |
| `complete` | Filled, `--success` checkmark inside |
| `failed` | Filled, `--error`, with error icon |

Since `web_searcher` and `website_scraper` run in parallel, render them as two circles **side by side** at the same vertical step (small deviation from the strictly-linear wireframe sketch, but matches the actual graph topology) — connected by one incoming arrow from `intent_parser` and one outgoing arrow merging into `data_merger`.

`targeted_researcher` is conditional — only render/highlight that node if it actually appears in the `nodes[]` array for this run (i.e., gaps were found). Otherwise skip straight from `gap_detector` to `insight_extractor`.

**Polling stop condition:** stop polling when `status` is `"complete"` or `"failed"`.
- `complete` → transition main panel to Chat View (§ below), and this is the trigger to open the WebSocket.
- `failed` → show `error_message` from the response, with a "Retry" button. (No retry endpoint exists yet per the API doc — so "Retry" for now just means "Create New Session" again; flag the missing retry-resume endpoint as a product gap in `product-improvements.md`.)

**Input bar during this state:** disabled/grayed out (matches wireframe — the `>` bar is drawn but visually inert until chat is ready). Placeholder text: "Chat will be available once research is complete."

#### State: `complete` — Chat View (wireframe 3, right chat page)

**Layout revision:** the report stays open as a persistent panel alongside the chat — it is not collapsed into a small header badge. Split the main panel into two columns:

```
┌─────────────────────────┬───────────────────────────┐
│   REPORT PANEL            │      CHAT PANEL             │
│   (scrollable, ~45%)      │      (~55%)                 │
│                          │                             │
│  Acme Corp        [PDF↓] │  [message bubbles...]        │
│  ─────────────────────── │                             │
│  Company Overview        │                             │
│  ...                     │                             │
│  Products & Services     │                             │
│  ...                     │                             │
│  (all 9 sections,        │                             │
│   sources at bottom)      │                             │
│                          ├───────────────────────────┤
│                          │  [ message input ]   [>]    │
└─────────────────────────┴───────────────────────────┘
```

This applies every time a `complete` session is opened — both right after the workflow finishes, and when revisiting an old session from the sidebar. The report is never hidden while its chat is open.

On mobile (<1024px, per §10), stack instead of split: a collapsible "View Report" panel above the chat, collapsed by default with a toggle, since side-by-side won't fit.

**On transition into this state:**
1. Fetch `GET /sessions/{session_id}` once (gets the full session + embedded `report`) — render `report.content`'s 9 fields directly into the Report Panel (overview, products/services, target customers, business signals, risks, discovery questions, outreach strategy, unknowns, sources).
2. Open WebSocket: `wss://<host>/chat/{session_id}?token=<jwt>`
3. Fetch `GET /sessions/{session_id}/messages` to hydrate any prior chat history (important for revisiting old sessions from the sidebar — wireframe 3 explicitly shows this as a *separate* possible entry point, not just post-workflow).

**Sending a message:**
```ts
ws.send(JSON.stringify({ message: userInput }))
```
**Receiving:**
- Plain-text frames → append/stream into the current assistant bubble token-by-token
- JSON frame `{ done: true, message_id }` → finalize that bubble, re-enable input
- JSON frame `{ error: "..." }` → show inline error bubble, re-enable input

**WebSocket close codes → UI handling:**

| Close code | Meaning | UI behavior |
|---|---|---|
| `4001` | Invalid/expired JWT | Clear token, redirect to `/login` |
| `4003` | Session not found | Show "Session not found" state, link back to sidebar |
| `4004` | Report not ready | Shouldn't happen if we only open WS post-`complete`, but fall back to Progress View defensively if it does |

**Reconnect handling:** if the WebSocket drops unexpectedly (not via an explicit close code, e.g. network blip), attempt one silent reconnect; if it fails again, show a small "reconnecting…" indicator rather than a hard error — keeps the experience calm rather than alarming for a transient blip.

#### State: `failed`
Covered above under `running` — same panel handles both since a fail can happen at any point during the run.

---

## 5. Sidebar Component (persistent across all shell screens)

Matches wireframe exactly:

```
┌──────────────────┐
│ [+ New Session]   │  ← always navigates to /sessions/new
│───────────────────│  ← divider (the underline in your sketch)
│ Session History    │  ← section label, not clickable
│                   │
│ ● Acme Corp        │  ← GET /sessions, newest first
│ ● Xempla           │     (API already returns this sorted)
│ ● Flytbase         │
│ ...               │
└──────────────────┘
```

- Source: `GET /sessions` on shell mount, plus refetch when a new session is created.
- Each row label = `session.company_name` (wireframe shows company names directly — "Xempla", "Flytbase" — not generic "Session 1, 2, 3", so use `company_name` as the display string).
- Small status dot per row (subtle, secondary signal) using the same color tokens as the node circles: gray=pending, accent-pulse=running, green=complete, red=failed. This lets a user glance at the sidebar and see if a background research run finished without opening it.
- Active session row gets a highlighted background (`--bg-elevated`).
- Clicking a row navigates to `/sessions/{that_id}` — the shell re-derives state from that session's `status` fresh (don't assume cached state; always re-check status/messages on navigation, since a "running" session might have completed while the user was elsewhere).

---

## 6. State Management

Given the size of this app, **React Query (TanStack Query) + light local component state** is the right call — no need for Redux/Zustand here.

| Concern | Approach |
|---|---|
| `GET /sessions` (sidebar list) | `useQuery`, refetch on new session creation |
| `GET /sessions/{id}` | `useQuery`, keyed by `sessionId` |
| `GET /sessions/{id}/status` (polling) | `useQuery` with `refetchInterval: 2500`, auto-disabled (`enabled: false`) once status is terminal |
| `GET /sessions/{id}/messages` | `useQuery`, runs once on entering chat state |
| WebSocket chat | Plain `useRef<WebSocket>` + local `useState` for the streaming buffer — React Query isn't a great fit for a stateful streaming connection, keep it simple and manual here |
| Auth token | Context provider wrapping the app, backed by `localStorage`, exposes `login()`, `logout()`, `token` |

This also gives you free request deduplication and caching, which matters since the sidebar and the shell both want `GET /sessions` data without double-fetching.

---

## 7. Component Tree (suggested)

```
App
├── AuthProvider
├── ProtectedRoute
│   └── AppShell                      (renders sidebar + outlet)
│       ├── Sidebar
│       │   ├── NewSessionButton
│       │   └── SessionHistoryList
│       │       └── SessionRow
│       └── <Outlet />
│           ├── CreateSessionPage      (/sessions/new)
│           │   └── SessionForm
│           └── SessionShellPage       (/sessions/:sessionId)
│               ├── WorkflowProgressView   (when status === running/pending/failed)
│               │   └── WorkflowNode (×N)
│               └── CompleteSessionView    (when status === complete)
│                   ├── ReportPanel
│                   │   ├── ReportSection (×9)
│                   │   ├── DownloadPdfButton
│                   │   └── ReportPdfDocument   (off-screen, used only by @react-pdf/renderer)
│                   └── ChatPanel
│                       ├── MessageList
│                       │   └── MessageBubble
│                       └── ChatInputBar
├── LoginPage    (/login,  no AppShell)
└── SignupPage   (/signup, no AppShell)
```

---

## 8. API Call Reference (quick lookup table)

| UI Action | Endpoint | When |
|---|---|---|
| Sign up form submit | `POST /auth/signup` | Auth page |
| Sign in form submit | `POST /auth/login` | Auth page |
| App root load | `GET /sessions` | Decide redirect target |
| Sidebar mount | `GET /sessions` | Populate history list |
| Create session submit | `POST /sessions` → `POST /sessions/{id}/run` | Form page |
| Entering shell route | `GET /sessions/{id}` | Get status + report (if ready) |
| While `status === running` | `GET /sessions/{id}/status` (poll 2.5s) | Progress view |
| On status → `complete` | `GET /sessions/{id}/messages` | Hydrate chat history |
| On status → `complete` | `WS /chat/{id}?token=` | Open chat connection |
| Sending a chat message | WS send `{ message }` | Chat input |
| (optional, debug only) | `GET /sessions/{id}/workflow` | Not used in v1 UI — internal/debug per API doc, skip unless building an admin view later |
| (optional) | `GET /sessions/{id}/report` | Not needed separately — `GET /sessions/{id}` already embeds report on completion |

---

## 9. Loading / Error / Empty States Checklist

Per the assignment's explicit requirement (Frontend → "Loading States", "Error States"):

| Screen | Loading | Empty | Error |
|---|---|---|---|
| Sidebar | Skeleton rows (3) | "No sessions yet — create one" | Toast, keep stale list visible |
| Create form | Button shows spinner, disabled | — | Inline message under field (422), or banner (network/500) |
| Progress view | First poll: skeleton node chain | — | `failed` status → red node + `error_message` shown inline |
| Report panel | Skeleton text blocks while session fetch resolves | — | If `report` is `null` despite `complete` status (shouldn't happen), show "Report unavailable" fallback |
| Chat panel | Skeleton bubbles while messages fetch | "No messages yet — ask something about the report" | WS error frame → inline error bubble; close-code errors → full-panel message |
| PDF download | Button spinner during `pdf().toBlob()` | — | If generation throws, toast "Couldn't generate PDF, try again" |
| Auth pages | Button spinner | — | `401`/`409` shown inline under the form |

---

## 10. Responsive Behavior (assignment requires this)

- **Desktop (≥1024px):** Sidebar always visible, fixed width (~260px).
- **Tablet/Mobile (<1024px):** Sidebar collapses behind a hamburger toggle in a top bar; opens as an overlay drawer. Main panel takes full width. This is the standard Claude-mobile pattern and needs no novel design — just CSS breakpoints + a toggle state.
- Chat input bar always pinned to the bottom of the viewport on mobile (avoid it scrolling out of view under the keyboard — use `100dvh` not `100vh` for the shell container to handle mobile keyboard resize correctly).

---

## 11. PDF Export (Report Panel → `[PDF↓]`)

**Library:** `@react-pdf/renderer` (the actively maintained package — note it's `@react-pdf/renderer`, not the older standalone `react-pdf`, which is actually a *viewer* package, not a generator). Generation happens **entirely client-side** — no new backend endpoint needed, since `GET /sessions/{session_id}` already returns every field the PDF needs in `report.content`.

**Flow:**
1. User clicks `[PDF↓]` in the Report Panel header (only enabled once `report` is loaded — i.e. only in the `complete` state, same data already in memory from §4.2 step 1).
2. Build a `<Document>` from `report.content`, mapping each section to its own page block:
   - Header: company name + `generated_at` date
   - Sections in the same fixed order as the Report Panel: Company Overview → Products & Services → Target Customers → Business Signals → Risks & Challenges → Discovery Questions (as a list) → Outreach Strategy → Unknowns → Sources (as a list of links)
3. Use `usePDF()` or `pdf(<ReportDocument />).toBlob()` to generate in-browser, then trigger a download via a temporary `<a>` + `URL.createObjectURL`.
4. Filename: `{company_name}-research-report.pdf` (slugify spaces/special chars).

**Component sketch:**

```tsx
// ReportPdfDocument.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  heading: { fontSize: 16, marginBottom: 12, fontWeight: 700 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  body: { lineHeight: 1.4 },
  listItem: { marginBottom: 2 },
});

interface ReportPdfDocumentProps {
  companyName: string;
  generatedAt: string;
  content: ReportContent; // matches GET /sessions/{id}/report → content shape
}

export function ReportPdfDocument({ companyName, generatedAt, content }: ReportPdfDocumentProps) {
  const sections: Array<{ title: string; value: string | string[] }> = [
    { title: 'Company Overview', value: content.company_overview },
    { title: 'Products & Services', value: content.products_services },
    { title: 'Target Customers', value: content.target_customers },
    { title: 'Business Signals', value: content.business_signals },
    { title: 'Risks & Challenges', value: content.risks_challenges },
    { title: 'Suggested Discovery Questions', value: content.discovery_questions },
    { title: 'Suggested Outreach Strategy', value: content.outreach_strategy },
    { title: 'Unknowns', value: content.unknowns },
    { title: 'Sources', value: content.sources },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{companyName} — Research Report</Text>
        <Text style={{ marginBottom: 16, color: '#666' }}>Generated {generatedAt}</Text>

        {sections.map(({ title, value }) => (
          <View key={title} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {Array.isArray(value) ? (
              value.map((item, i) => (
                <Text key={i} style={styles.listItem}>• {item}</Text>
              ))
            ) : (
              <Text style={styles.body}>{value}</Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
```

```tsx
// usage in ReportPanel.tsx — trigger download
import { pdf } from '@react-pdf/renderer';
import { ReportPdfDocument } from './ReportPdfDocument';

async function handleDownloadPdf(session: Session) {
  if (!session.report) return; // guard — button should already be disabled otherwise

  const blob = await pdf(
    <ReportPdfDocument
      companyName={session.company_name}
      generatedAt={session.updated_at}
      content={session.report}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(session.company_name)}-research-report.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
```

**Edge cases to handle:**
- `discovery_questions` and `sources` are arrays — render as bullet lists (handled above via `Array.isArray` branch); all other fields are plain strings.
- Long text sections (e.g. `company_overview` running several paragraphs) — `@react-pdf/renderer` auto-paginates within a `<Page>`, but use `wrap={false}` only on short blocks (as above) so a single long section doesn't get awkwardly orphaned mid-sentence across a page break; let `wrap={true}` (default) apply to the body `<Text>` itself within long sections.
- Button should show a brief "Generating…" spinner state during `pdf().toBlob()` since it's not instant for longer reports — this runs on the main thread, so for very large reports consider a loading micro-state on the button itself rather than blocking the whole panel.

---

## 12. Open Questions / Assumptions Made

State these explicitly since they weren't 100% spelled out in the source docs:

1. **SSE vs. polling for progress:** `architecture.md` describes SSE for workflow progress, but `api_design.md` defines `/status` as an explicit polling endpoint with no SSE route listed. This plan follows the API doc (polling) since it's the more granular, endpoint-level contract — flag this discrepancy in `engineering-decisions.md`.
2. **Retry-on-failure:** No `POST /sessions/{id}/retry` exists. v1 UI treats "failed" as terminal — user must start a new session. Worth proposing as a `product-improvements.md` item.
3. **Token in WS URL:** Per API doc this is required (`?token=<jwt>`) since browsers can't set custom WS headers — noting this is a known minor security tradeoff (token in URL/logs) worth a line in `engineering-decisions.md`.