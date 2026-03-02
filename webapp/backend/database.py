from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

def _normalize_sqlite_url(url: str) -> str:
    if not url.startswith("sqlite:///"):
        return url

    raw_path = url[len("sqlite:///"):]
    if not raw_path or raw_path == ":memory:":
        return url

    base_dir = Path(__file__).resolve().parent

    if os.name == "nt" and raw_path.startswith("/data/"):
        db_name = Path(raw_path).name
        existing_local_db = base_dir / db_name
        if existing_local_db.exists():
            return f"sqlite:///{existing_local_db.as_posix()}"

        local_data_dir = base_dir / "data"
        local_data_dir.mkdir(parents=True, exist_ok=True)
        db_file = local_data_dir / db_name
        return f"sqlite:///{db_file.as_posix()}"

    path = Path(raw_path)
    if not path.is_absolute():
        path = (base_dir / path).resolve()

    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{path.as_posix()}"


SQLALCHEMY_DATABASE_URL = _normalize_sqlite_url(
    os.getenv("DATABASE_URL", "sqlite:///./associacao.db")
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
