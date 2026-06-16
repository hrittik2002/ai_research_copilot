from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str
    mongodb_db_name: str = "research_copilot"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1 day

    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str

    class Config:
        env_file = ".env"


settings = Settings()