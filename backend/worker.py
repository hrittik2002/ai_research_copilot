"""
Standalone worker process — run separately from the API with: python worker.py

Responsibilities:
  1. Block on Redis queue waiting for research jobs (BRPOP)
  2. Stream the LangGraph graph node-by-node
  3. After each node: append a completion record to workflow_runs.nodes[] in MongoDB
  4. After finalizer node: write the report to reports collection, mark session complete
  5. On any failure: mark workflow_run and session as failed

MongoDB writes happen HERE, not inside graph nodes — keeps nodes side-effect free
and gives us a clean separation between graph logic and persistence.
"""

import asyncio
import json
from datetime import datetime, timezone

from bson import ObjectId

from app.infra.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.infra.redis_client import RESEARCH_QUEUE_KEY, get_redis
from app.workflows.research_graph import ResearchState, research_graph


# ─── MongoDB helpers ───────────────────────────────────────────────────────────

async def _mark_workflow_running(session_id: str) -> None:
    """Transition workflow_run to 'running' when the worker picks up the job."""
    db = get_database()
    await db.workflow_runs.update_one(
        {"session_id": session_id},
        {"$set": {"status": "running"}},
    )


async def _record_node_complete(session_id: str, node_name: str, output: dict) -> None:
    """Append one completed-node entry to workflow_runs.nodes[]."""
    db = get_database()
    entry = {
        "node_name": node_name,
        "status": "complete",
        "started_at": datetime.now(timezone.utc),
        "output": _trim_output(output),
        "error": None,
    }
    await db.workflow_runs.update_one(
        {"session_id": session_id},
        {"$push": {"nodes": entry}},
    )


async def _save_report_and_complete(session_id: str, final_report: dict) -> None:
    """Write the completed report and mark both workflow_run and session as done."""
    db = get_database()
    now = datetime.now(timezone.utc)

    await db.reports.insert_one({
        "session_id": session_id,
        "generated_at": now,
        "content": final_report,
    })

    await db.workflow_runs.update_one(
        {"session_id": session_id},
        {"$set": {"status": "complete", "completed_at": now}},
    )

    # session._id is an ObjectId; session_id here is its string representation
    await db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": "complete", "updated_at": now}},
    )


async def _mark_workflow_failed(session_id: str, error: str) -> None:
    """Record failure on both workflow_run and session so the client sees it."""
    db = get_database()
    now = datetime.now(timezone.utc)

    await db.workflow_runs.update_one(
        {"session_id": session_id},
        {"$set": {"status": "failed", "error_message": error, "completed_at": now}},
    )
    await db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": "failed", "updated_at": now}},
    )


def _trim_output(output: dict) -> dict:
    """
    Truncate long strings and lists before storing in workflow_runs.
    workflow_runs.nodes[] is an audit log, not a data store — we keep it small.
    """
    trimmed: dict = {}
    for key, value in output.items():
        if isinstance(value, str) and len(value) > 300:
            trimmed[key] = value[:300] + " ...[truncated]"
        elif isinstance(value, list) and len(value) > 10:
            trimmed[key] = value[:10]
        else:
            trimmed[key] = value
    return trimmed


# ─── Job processor ─────────────────────────────────────────────────────────────

async def process_job(job_data: dict) -> None:
    session_id: str = job_data["session_id"]
    print(f"[worker] Starting job for session {session_id}")

    await _mark_workflow_running(session_id)

    # Build the initial LangGraph state from the job payload
    initial_state: ResearchState = {
        "company_name": job_data["company_name"],
        "company_website": job_data["company_website"],
        "research_objective": job_data["research_objective"],
        # Default values for fields that nodes will populate
        "search_queries": [],
        "search_results": [],
        "website_content": "",
        "merged_raw_data": "",
        "company_overview": "",
        "products_services": "",
        "target_customers": "",
        "business_signals": "",
        "risks_challenges": "",
        "discovery_questions": [],
        "outreach_strategy": "",
        "unknowns": "",
        "sources": [],
        "data_gaps": [],
        "retry_count": 0,
        "quality_passed": False,
        "final_report": {},
    }

    # Accumulate state across all node updates so we can read final_report at the end
    accumulated_state: dict = dict(initial_state)

    try:
        # stream_mode="updates" yields {node_name: state_update} after each node.
        # Iterating a sync generator from an async function is fine — each node
        # blocks the thread while it runs, then yields so we can await the DB write.
        for chunk in research_graph.stream(initial_state, stream_mode="updates"):
            for node_name, state_update in chunk.items():
                if node_name.startswith("__"):
                    continue  # skip LangGraph internal events (e.g. __end__)

                accumulated_state.update(state_update)
                await _record_node_complete(session_id, node_name, state_update)
                print(f"[worker] ✓ {node_name} — session {session_id}")

        # All nodes done — persist the report and mark everything complete
        final_report = accumulated_state.get("final_report", {})
        await _save_report_and_complete(session_id, final_report)
        print(f"[worker] ✓ session {session_id} complete")

    except Exception as exc:
        error_msg = str(exc)
        print(f"[worker] ✗ session {session_id} failed: {error_msg}")
        await _mark_workflow_failed(session_id, error_msg)
        raise


# ─── Main loop ─────────────────────────────────────────────────────────────────

async def main() -> None:
    # Worker is a separate process — needs its own DB connection
    await connect_to_mongo()
    redis = get_redis()
    print("[worker] Connected — listening on 'research_jobs'...")

    try:
        while True:
            # BRPOP blocks until a job exists — no polling, no CPU waste
            _, raw_job = await redis.brpop(RESEARCH_QUEUE_KEY)
            job_data = json.loads(raw_job)

            try:
                await process_job(job_data)
            except Exception as exc:
                # Already logged and persisted inside process_job — just keep looping
                print(f"[worker] Job loop continuing after error: {exc}")

    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
