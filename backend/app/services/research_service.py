import json
import uuid

from app.models.research import StartResearchRequest, StartResearchResponse
from app.infra.redis_client import get_redis, RESEARCH_QUEUE_KEY


async def queue_research_job(payload: StartResearchRequest) -> StartResearchResponse:
    job_id = str(uuid.uuid4())

    job_data = {
        "job_id": job_id,
        "topic": payload.topic,
        "objective": payload.objective,
    }

    redis_conn = get_redis()
    await redis_conn.lpush(RESEARCH_QUEUE_KEY, json.dumps(job_data))

    return StartResearchResponse(job_id=job_id, status="queued")