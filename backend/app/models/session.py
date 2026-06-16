from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    company_website: str = Field(min_length=1, max_length=500)
    research_objective: str = Field(min_length=1, max_length=1000)


class ReportContent(BaseModel):
    company_overview: str
    products_services: str
    target_customers: str
    business_signals: str
    risks_challenges: str
    discovery_questions: list[str]
    outreach_strategy: str
    unknowns: str
    sources: list[str]


class SessionResponse(BaseModel):
    session_id: str
    company_name: str
    company_website: str
    research_objective: str
    status: str
    created_at: datetime
    updated_at: datetime
    report: Optional[ReportContent] = None


class SessionListItemResponse(BaseModel):
    """Lightweight version for list endpoints — no report payload."""
    session_id: str
    company_name: str
    company_website: str
    research_objective: str
    status: str
    created_at: datetime
    updated_at: datetime
