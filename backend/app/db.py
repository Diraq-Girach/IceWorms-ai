"""Database engine + session dependency (SQLite via SQLModel/SQLAlchemy)."""
from pathlib import Path
from typing import Iterator

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from .config import DATABASE_PATH

Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DATABASE_PATH}",
    # FastAPI runs sync endpoints in a threadpool, so allow cross-thread use
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    """SQLite ignores foreign keys unless this pragma is enabled per connection.
    Needed for ON DELETE CASCADE / SET NULL to actually fire."""
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")  # better read concurrency
    cur.close()


def create_db_and_tables() -> None:
    from . import models  # noqa: F401  (register tables on the metadata)

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
