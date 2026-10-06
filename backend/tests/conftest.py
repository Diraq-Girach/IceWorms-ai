import os
import tempfile

import pytest

# Point the app at a throwaway database BEFORE importing it (config reads env at import time)
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_PATH"] = os.path.join(_tmp, "test.db")
os.environ["SEED_ON_STARTUP"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed.seed import reset_and_seed  # noqa: E402


@pytest.fixture
def client():
    """Fresh, seeded database for every test."""
    reset_and_seed()
    with TestClient(app) as c:
        yield c
