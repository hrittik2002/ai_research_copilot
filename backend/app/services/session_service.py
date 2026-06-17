from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status

from app.infra.mongodb import get_database
from app.models.session import CreateSessionRequest


async def create_session(payload: CreateSessionRequest, user_id: str) -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)

    session_doc = {
        "user_id": user_id,          # stored as str — matches JWT "sub" claim
        "company_name": payload.company_name,
        "company_website": payload.company_website,
        "research_objective": payload.research_objective,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }

    result = await db.sessions.insert_one(session_doc)

    return {
        "session_id": str(result.inserted_id),
        "company_name": payload.company_name,
        "company_website": payload.company_website,
        "research_objective": payload.research_objective,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "report": None,
    }


async def get_sessions(user_id: str) -> list[dict]:
    db = get_database()

    # sort -1 = newest first
    cursor = db.sessions.find({"user_id": user_id}).sort("created_at", -1)

    sessions = []
    async for doc in cursor:
        sessions.append(_serialize_session(doc))

    return sessions


async def get_session(session_id: str, user_id: str) -> dict:
    db = get_database()

    try:
        oid = ObjectId(session_id)
    except InvalidId:
        # malformed ID string should look like a 404, not a 400
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    doc = await db.sessions.find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if doc["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    session = {**_serialize_session(doc), "report": None}

    # Fetch report from its own collection only when the workflow has finished
    if doc["status"] == "complete":
        report_doc = await db.reports.find_one({"session_id": session_id})
        if report_doc:
            session["report"] = report_doc["content"]

    return session


async def get_report(session_id: str, user_id: str) -> dict:
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

    if session["status"] in ("pending", "running"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Report not ready — workflow is still running",
        )

    report_doc = await db.reports.find_one({"session_id": session_id})
    if report_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    return {
        "session_id": session_id,
        "generated_at": report_doc["generated_at"],
        "content": report_doc["content"],
    }


def _serialize_session(doc: dict) -> dict:
    """Convert a raw MongoDB session document to a serializable dict."""
    return {
        "session_id": str(doc["_id"]),
        "company_name": doc["company_name"],
        "company_website": doc["company_website"],
        "research_objective": doc["research_objective"],
        "status": doc["status"],
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }
