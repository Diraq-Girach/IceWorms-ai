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
    _add_missing_columns()


# create_all() creates missing tables but never alters existing ones. These are the
# columns added after the first release, so databases created earlier (a local
# app.db, a Railway volume) upgrade in place instead of crashing. A project with many
# migrations would use Alembic; one additive column doesn't justify it yet.
_ADDED_COLUMNS = {
    "action_items": {"source": "VARCHAR NOT NULL DEFAULT 'user'"},
}


def _add_missing_columns() -> None:
    with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
