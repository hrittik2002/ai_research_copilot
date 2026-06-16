from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routes import auth, research, sessions
from app.infra.mongodb import connect_to_mongo, close_mongo_connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(title="AI Research Copilot", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(research.router)
app.include_router(sessions.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}