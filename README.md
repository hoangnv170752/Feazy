# Feazy Meet

Video meeting platform with smart face recognition capabilities.

## Features

- **Video Calls** - High quality video meetings with camera support
- **Face Registration** - Register faces via camera capture
- **Face Verification** - Verify identity against registered faces
- **Face Search** - Search for similar faces in database
- **Multi-language** - Vietnamese and English support

## Tech Stack

### Backend
- **FastAPI** - Python web framework
- **SQLite/PostgreSQL** - Database
- **DeepFace** - Face recognition (ArcFace model)
- **InsightFace/RetinaFace** - Face detection

### Frontend
- **Next.js 16** - React framework
- **TailwindCSS + DaisyUI** - Styling
- **TypeScript** - Type safety

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/faces/register` | Register a face |
| POST | `/api/v1/faces/verify` | Verify identity |
| POST | `/api/v1/faces/search` | Search similar faces |
| GET | `/api/v1/faces/{person_id}` | Get faces by person |
| DELETE | `/api/v1/faces/{person_id}` | Delete person's faces |

## Project Structure

```
Feazy/
├── backend/
│   ├── app/
│   │   ├── api/v1/        # API routes
│   │   ├── core/          # Config, exceptions
│   │   ├── db/            # Database
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   └── main.py        # Entry point
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── lib/           # API client, i18n
│   │   ├── meeting/       # Meeting page
│   │   └── page.tsx       # Landing page
│   └── package.json
└── README.md
```

## License

MIT
