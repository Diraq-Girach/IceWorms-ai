"""App settings, read from environment variables (with local-dev defaults)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Local: ./data/app.db  |  Railway: set DATABASE_PATH=/data/app.db (volume mount)
DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "app.db"))

# Comma-separated list of allowed frontend origins
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
# Also allow any Vercel preview deployment (regex), handy for PR previews
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")

# Seed the DB on startup when it is empty
SEED_ON_STARTUP = os.getenv("SEED_ON_STARTUP", "true").lower() == "true"
