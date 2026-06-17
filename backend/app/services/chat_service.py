"""
Chat service — loads the research report as LLM context and streams replies.

MongoDB writes (save messages) stay in the WS route; this service has no
side effects so it can be reasoned about and tested in isolation.
"""

from typing import AsyncGenerator

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import settings
from app.infra.mongodb import get_database

_llm = ChatOpenAI(
    model="gpt-4o-mini",
    api_key=settings.openai_api_key,
    temperature=0.3,
    streaming=True,
)

_SYSTEM_TEMPLATE = """\
You are a B2B sales research assistant. You have been given a completed research \
report about a company. Answer the user's questions using this report as your \
primary source. Be concise and accurate. If something isn't covered in the report, \
say so clearly rather than making things up.

## Research Report

Company: {company_name}
Website: {company_website}

### Company Overview
{company_overview}

### Products & Services
{products_services}

### Target Customers
{target_customers}

### Business Signals
{business_signals}

### Risks & Challenges
{risks_challenges}

### Discovery Questions
{discovery_questions}

### Outreach Strategy
{outreach_strategy}

### Unknowns
{unknowns}

### Sources
{sources}
"""


async def load_report_context(session_id: str, user_id: str) -> dict:
    """
    Fetch session + report from MongoDB, verify ownership and readiness.
    Returns a context dict consumed by `stream_reply` and `get_messages`.
    Raises HTTPException on auth/not-found/not-ready errors.
    """
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

    if session["status"] != "complete":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Report not ready — workflow must complete before chatting",
        )

    report_doc = await db.reports.find_one({"session_id": session_id})
    if report_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    return {
        "company_name": session["company_name"],
        "company_website": session["company_website"],
        "report": report_doc["content"],
    }


def _build_system_prompt(context: dict) -> str:
    report = context["report"]
    dqs = "\n".join(f"- {q}" for q in report.get("discovery_questions", []))
    sources = "\n".join(f"- {s}" for s in report.get("sources", []))

    return _SYSTEM_TEMPLATE.format(
        company_name=context["company_name"],
        company_website=context["company_website"],
        company_overview=report.get("company_overview", ""),
        products_services=report.get("products_services", ""),
        target_customers=report.get("target_customers", ""),
        business_signals=report.get("business_signals", ""),
        risks_challenges=report.get("risks_challenges", ""),
        discovery_questions=dqs,
        outreach_strategy=report.get("outreach_strategy", ""),
        unknowns=report.get("unknowns", ""),
        sources=sources,
    )


async def stream_reply(
    context: dict,
    history: list[dict],
    user_message: str,
) -> AsyncGenerator[str, None]:
    """
    Stream LLM reply tokens for a user message.

    `context`  — dict from `load_report_context`
    `history`  — list of {role, content} dicts, oldest first, excluding current message
    Yields individual text chunks as they arrive from the model.
    """
    messages = [SystemMessage(content=_build_system_prompt(context))]

    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))

    messages.append(HumanMessage(content=user_message))

    async for chunk in _llm.astream(messages):
        if chunk.content:
            yield chunk.content


async def get_messages(session_id: str, user_id: str) -> list[dict]:
    """
    Return full message history for a session, ordered oldest first.
    Verifies session ownership before reading messages.
    """
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

    messages = []
    async for doc in db.messages.find(
        {"session_id": session_id}, sort=[("created_at", 1)]
    ):
        messages.append({
            "message_id": doc["message_id"],
            "role": doc["role"],
            "content": doc["content"],
            "created_at": doc["created_at"],
        })

    return messages
