# Feazy Backend

Production-ready FastAPI + Uvicorn/Gunicorn backend with PostgreSQL (async SQLAlchemy 2).

## Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115 |
| Server | Uvicorn (dev) / Gunicorn + UvicornWorker (prod) |
| ORM | SQLAlchemy 2 async |
| Database | PostgreSQL 16 + asyncpg |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Logging | structlog |
| Serialization | orjson |
| Validation | Pydantic v2 |

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── dependencies.py          # Shared FastAPI dependencies
│   │   └── v1/
│   │       ├── router.py            # API v1 root router
│   │       └── endpoints/           # One file per resource
│   ├── core/
│   │   ├── config.py                # Pydantic Settings
│   │   ├── exceptions.py            # Typed HTTP exceptions
│   │   ├── logging.py               # structlog configuration
│   │   └── security.py              # JWT + password hashing
│   ├── db/
│   │   ├── base.py                  # DeclarativeBase
│   │   ├── mixins.py                # UUID + Timestamp mixins
│   │   ├── session.py               # Async engine + get_db dependency
│   │   └── migrations/              # Alembic environment
│   ├── middleware/
│   │   ├── logging.py               # Request/response logging middleware
│   │   └── rate_limit.py            # Rate-limit middleware (pluggable)
│   ├── models/                      # SQLAlchemy ORM models
│   ├── repositories/
│   │   └── base.py                  # Generic async CRUD repository
│   ├── schemas/
│   │   └── base.py                  # Pydantic base schemas
│   ├── services/                    # Business logic layer
│   ├── utils/
│   │   ├── pagination.py            # Generic pagination helpers
│   │   └── responses.py             # Typed JSON response helpers
│   └── main.py                      # App factory + entrypoint
├── tests/
│   ├── conftest.py                  # Shared fixtures
│   ├── integration/
│   └── unit/
├── .env.example
├── .gitignore
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── gunicorn.conf.py
├── pyproject.toml
├── requirements.txt
└── requirements-dev.txt
```

## Getting Started

### 1. Install dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in SECRET_KEY, POSTGRES_* values
```

### 3. Run database migrations

```bash
alembic upgrade head
```

### 4. Start dev server

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Run tests

```bash
pytest
```

## Production

### Docker Compose

```bash
docker compose up --build -d
```

### Standalone Gunicorn

```bash
gunicorn -c gunicorn.conf.py app.main:app
```

## Adding a New Resource

1. **Model** → `app/models/<resource>.py` (inherit `Base` + `AuditMixin`)
2. **Schema** → `app/schemas/<resource>.py` (inherit `BaseSchema`)
3. **Repository** → `app/repositories/<resource>.py` (inherit `BaseRepository[Model]`)
4. **Service** → `app/services/<resource>.py`
5. **Endpoint** → `app/api/v1/endpoints/<resource>.py`
6. **Register** → add `include_router` in `app/api/v1/router.py`
7. **Migration** → `alembic revision --autogenerate -m "add <resource>"` then `alembic upgrade head`
