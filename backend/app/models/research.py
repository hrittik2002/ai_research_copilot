from pydantic import BaseModel


class StartResearchRequest(BaseModel):
    topic: str
    objective: str


class StartResearchResponse(BaseModel):
    job_id: str
    status: str