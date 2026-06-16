
from datetime import datetime, timezone
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from fastapi import HTTPException, status
from jose import JWTError

from app.infra.mongodb import get_database
from app.infra.redis_client import get_redis
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


async def logout_user(token: str) -> None:
    try:
        payload = decode_access_token(token)
    except JWTError:
        # Already expired or malformed — nothing to blocklist
        return

    jti: str | None = payload.get("jti")
    exp: float | None = payload.get("exp")
    if not jti or not exp:
        return

    remaining_secs = int(exp - datetime.now(timezone.utc).timestamp())
    if remaining_secs > 0:
        redis = get_redis()
        # TTL matches the token's remaining lifetime so the key auto-cleans
        await redis.setex(f"token_blocklist:{jti}", remaining_secs, "1")