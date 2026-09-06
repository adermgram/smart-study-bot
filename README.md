# Smart Study Assistant Bot

A course-grounded study assistant for a university pilot: students ask questions and
take self-assessment quizzes answered strictly from lecturer-uploaded material;
lecturers get an anonymized dashboard of which topics students are struggling with.

**Live**: https://smart-study-bot-five.vercel.app

## Stack

- **Backend**: FastAPI (Python), SQLAlchemy (async), Alembic migrations
- **Frontend**: Next.js (App Router, TypeScript, Tailwind)
- **Database**: Postgres + pgvector (Supabase)
- **LLM**: Groq (chat/quiz generation, topic-tagging), OpenAI (embeddings)
- **Hosting**: Render (backend), Vercel (frontend)

## Running locally

**Backend**

```
cd backend
python -m venv venv && venv\Scripts\activate   # or source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # fill in the values -- see comments in the file
alembic upgrade head
python -m app.seed        # seeds the pilot courses
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

## Project layout

```
backend/app/
  models/       SQLAlchemy models
  routers/      API endpoints
  services/     business logic (RAG, quiz generation, topic-tagging, ingestion)
  schemas/      Pydantic request/response models
frontend/app/   Next.js pages (one folder per route)
```

## Deployment

Both Render and Vercel auto-deploy from `main`. Render's start command runs
`alembic upgrade head` before starting the server, so migrations apply on every
deploy automatically.

See `PROJECT_PLAN.md` for the full design writeup (requirements, schema, RAG/
topic-tagging pipeline design, and open decisions).
