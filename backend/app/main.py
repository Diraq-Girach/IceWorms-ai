import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGIN_REGEX, CORS_ORIGINS, SEED_ON_STARTUP
from .db import create_db_and_tables
from .routers import action_items, ai, meetings, misc


# Show our own log lines (and httpx's one-line "HTTP Request: POST ... 200 OK" per AI call)
# next to uvicorn's. Uvicorn's loggers don't propagate to root, so nothing is printed twice.
logging.basicConfig(level=logging.INFO, format="%(levelname)-9s %(name)s - %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    if SEED_ON_STARTUP:
        from .seed.seed import seed_if_empty

        seed_if_empty()
    yield


app = FastAPI(
    title="IceWorms.ai API",
    version="1.0.0",
    description="Meetings, transcripts, summaries and action items.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meetings.router)
app.include_router(action_items.router)
app.include_router(misc.router)
app.include_router(ai.router)


@app.get("/health", tags=["misc"])
def health():
    return {"status": "ok"}
