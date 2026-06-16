from fastapi import APIRouter

from app.models.research import StartResearchRequest, StartResearchResponse
from app.services import research_service

router = APIRouter(prefix="/research", tags=["research"])


@router.post("/start", response_model=StartResearchResponse)
async def start_research(payload: StartResearchRequest):
    return await research_service.queue_research_job(payload)