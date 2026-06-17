from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_current_user
from app.models.chat import MessageResponse
from app.models.session import CreateSessionRequest, SessionResponse, SessionListItemResponse, ReportResponse
from app.models.workflow import StartWorkflowResponse, WorkflowStatusResponse
from app.services import chat_service, session_service, workflow_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: CreateSessionRequest,
    user_id: str = Depends(get_current_user),
):
    return await session_service.create_session(payload, user_id)


@router.get("", response_model=list[SessionListItemResponse])
async def list_sessions(user_id: str = Depends(get_current_user)):
    return await session_service.get_sessions(user_id)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    return await session_service.get_session(session_id, user_id)


@router.post("/{session_id}/run", response_model=StartWorkflowResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_workflow(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    return await workflow_service.start_workflow(session_id, user_id)


@router.get("/{session_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    return await workflow_service.get_workflow_status(session_id, user_id)


@router.get("/{session_id}/report", response_model=ReportResponse)
async def get_report(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    return await session_service.get_report(session_id, user_id)


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    return await chat_service.get_messages(session_id, user_id)
