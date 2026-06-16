from fastapi import APIRouter, status

from app.models.user import UserSignupRequest, UserLoginRequest, UserResponse, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: UserSignupRequest):
    return await auth_service.create_user(payload)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLoginRequest):
    token = await auth_service.authenticate_user(payload)
    return TokenResponse(access_token=token)