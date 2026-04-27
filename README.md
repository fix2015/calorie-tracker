# Calorie Tracker

AI-powered calorie tracking application with photo recognition.

## Features

- **AI Photo Scanning** — Take a photo of your meal and get instant calorie/macro estimates via GPT-4o Vision
- **Manual Logging** — Quick-add meals with calories and macros
- **Smart Suggestions** — AI-powered daily nutrition advice (token-conscious, cached)
- **Dashboard** — Calorie ring, macro breakdown, daily meal list
- **Reports** — Daily/weekly charts with Recharts
- **Profile** — Mifflin-St Jeor calorie target auto-calculation

## Tech Stack

- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL
- **Frontend**: React, Vite, plain CSS, Recharts
- **Auth**: JWT (access + refresh tokens), bcrypt
- **AI**: OpenAI GPT-4o (swappable via `AI_PROVIDER` env)

## Quick Start

### With Docker

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your OPENAI_API_KEY
docker-compose up
```

### Without Docker

**Prerequisites:** Node.js 20+, PostgreSQL running locally

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
npm install
npx prisma migrate dev
npm run db:seed
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

**Demo account:** `demo@example.com` / `demo1234`

## Environment Variables

See `backend/.env.example` for all required variables.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `OPENAI_API_KEY` | OpenAI API key for photo scanning |
| `AI_PROVIDER` | `openai` (default). Extensible to other providers |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with profile |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh tokens |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| PATCH | `/api/users/me` | Update profile |
| POST | `/api/meals/manual` | Log meal manually |
| POST | `/api/meals/photo` | Upload photo for AI scan |
| GET | `/api/meals` | List meals (filter: from, to) |
| DELETE | `/api/meals/:id` | Delete meal |
| GET | `/api/reports/daily` | Daily totals + meals |
| GET | `/api/reports/weekly` | 7-day trend |
| GET | `/api/reports/suggestion` | AI suggestion |

## License

MIT
