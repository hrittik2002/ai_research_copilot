from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class NodeRun(BaseModel):
    node_name: str
    status: str                       # "pending" | "running" | "complete" | "failed"
    started_at: Optional[datetime] = None
    output: Optional[Any] = None      # whatever the node produced (raw JSON)
    error: Optional[str] = None


class StartWorkflowResponse(BaseModel):
    session_id: str
    status: str
    message: str


class WorkflowStatusResponse(BaseModel):
    session_id: str
    status: str                       # mirrors session status
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    nodes: list[NodeRun] = []
