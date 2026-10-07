"""App settings, read from environment variables (with local-dev defaults).

For local development, put settings in backend/.env (git-ignored); see .env.example.
Real environment variables (e.g. on Railway) take precedence over the file.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)

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


# ---------- AI (optional) ----------
# Any OpenAI-compatible chat-completions API (Groq, Gemini, OpenAI, OpenRouter, Ollama, ...).
# AI features turn on only when LLM_API_KEY and LLM_MODEL are set; otherwise the
# rule-based summarizer is used and "Ask AI" shows as unavailable.
# Read at call time (not import time) so tests can change them.
def llm_settings() -> dict:
    return {
        "base_url": os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        "api_key": os.getenv("LLM_API_KEY", "").strip(),
        "model": os.getenv("LLM_MODEL", "").strip(),
        "timeout": float(os.getenv("LLM_TIMEOUT", "45")),
        # optional, for reasoning models (low | medium | high); sent only when set
        "reasoning_effort": os.getenv("LLM_REASONING_EFFORT", "").strip().lower(),
        # optional cap on output tokens (reasoning + answer); sent only when set
        "max_tokens": int(os.getenv("LLM_MAX_TOKENS", "0") or 0),
    }
