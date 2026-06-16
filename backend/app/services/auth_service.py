
from datetime import datetime, timezone
from app.core.security import hash_password, verify_password, create_access_token
from fastapi import HTTPException, status

from app.infra.mongodb import get_database
from app.models.user import UserSignupRequest, UserLoginRequest

async def create_user(payload: UserSignupRequest) -> dict:
    db = get_database()

    # Check if user with the same email already exists
    existing_user = await db.users.find_one({"email": payload.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    user_doc = {
        "email": payload.email,
        "full_name": payload.full_name,
        "hashed_password": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.users.insert_one(user_doc)

    return {
        "id": str(result.inserted_id),
        "email": user_doc["email"],
        "full_name": user_doc["full_name"],
        "created_at": user_doc["created_at"],
    }

async def authenticate_user(payload: UserLoginRequest) -> str:
    db = get_database()

    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    token = create_access_token({"sub": str(user["_id"])})
    return token