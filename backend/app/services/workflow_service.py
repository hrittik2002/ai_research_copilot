import json
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status

from app.infra.mongodb import get_database
from app.infra.redis_client import get_redis, RESEARCH_QUEUE_KEY


async def start_workflow(session_id: str, user_id: str) -> dict:
    db = get_database()

    try:
        oid = ObjectId(session_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session = await db.sessions.find_one({"_id": oid})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Prevent double-triggering — only pending sessions can be started
    if session["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workflow already {session['status']} for this session",
        )

    now = datetime.now(timezone.utc)

    # Create the WorkflowRun document upfront so the status endpoint has something to return
    # immediately, even before the worker picks up the job
    await db.workflow_runs.insert_one({
        "session_id": session_id,    # stored as str — matches how worker will reference it
        "status": "pending",
        "started_at": now,
        "completed_at": None,
        "error_message": None,
        "nodes": [],
    })

    # Transition session to "running" so the client sees feedback right away
    await db.sessions.update_one(
        {"_id": oid},
        {"$set": {"status": "running", "updated_at": now}},
    )

    # Push to Redis queue — worker picks this up via BRPOP
    job = {
        "session_id": session_id,
        "company_name": session["company_name"],
        "company_website": session["company_website"],
        "research_objective": session["research_objective"],
    }
    redis = get_redis()
    await redis.lpush(RESEARCH_QUEUE_KEY, json.dumps(job))

    return {"session_id": session_id, "status": "running", "message": "Workflow started"}


async def get_workflow_status(session_id: str, user_id: str) -> dict:
    db = get_database()

    try:
        oid = ObjectId(session_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session = await db.sessions.find_one({"_id": oid})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    workflow_run = await db.workflow_runs.find_one({"session_id": session_id})
    if workflow_run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not started yet — call POST /sessions/{session_id}/run first",
        )

    return {
        "session_id": session_id,
        "status": workflow_run["status"],
        "started_at": workflow_run["started_at"],
        "completed_at": workflow_run["completed_at"],
        "error_message": workflow_run["error_message"],
        "nodes": workflow_run.get("nodes", []),
    }
