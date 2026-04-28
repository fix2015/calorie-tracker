# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Full stack with Docker
```bash
docker-compose up          # starts postgres, backend (3001), frontend (5173)
```

### Backend (without Docker)
```bash
cd backend
npm install
npx prisma migrate dev     # apply migrations
npm run db:seed             # seed demo data (demo@example.com / demo1234)
npm run dev                 # starts on port 3001 (uses --watch)
npm run db:studio           # Prisma Studio GUI
```

### Frontend (without Docker)
```bash
cd frontend
npm install
npm run dev                 # Vite dev server on port 5173
npm run build               # production build
npm run lint                # ESLint
```

### Tests
```bash
cd backend && npm test      # Node.js built-in test runner: node --test src/tests/**/*.test.js
```

### Production deployment
```bash
# See infra/ for docker-compose.prod.yml and nginx configs
# CI/CD via GitHub Actions deploys to EC2
```

## Architecture

**Monorepo with two apps:** `backend/` (Express API) and `frontend/` (React SPA).

### Backend (CommonJS, Node.js)
- **Entry:** `src/index.js` — Express app with CORS, static uploads, route mounting
- **Routes:** `src/routes/{auth,users,meals,reports}.js` — REST endpoints under `/api/`
- **Services:** `src/services/{auth,vision}.js` — business logic; vision service calls OpenAI GPT-4o for photo meal scanning
- **Middleware:** `src/middleware/auth.js` (JWT verify), `upload.js` (multer), `errorHandler.js`
- **Database:** PostgreSQL via Prisma ORM. Schema at `prisma/schema.prisma`
  - Models: User, Meal, RefreshToken, SuggestionCache
  - Prisma uses `@map` to snake_case DB columns while keeping camelCase in JS
- **Auth flow:** JWT access + refresh tokens. Refresh tokens stored hashed in DB.
- **AI:** OpenAI GPT-4o Vision for photo scanning. Provider configurable via `AI_PROVIDER` env var.
- **Validation:** Zod schemas in route handlers

### Frontend (React 19, Vite, ES modules)
- **Routing:** React Router v7 in `App.jsx`. Protected routes use `<ProtectedLayout>` with `<Outlet>`
- **Auth state:** `services/AuthContext.jsx` — React context with auto-refresh on mount
- **API client:** `services/api.js` — fetch wrapper with automatic JWT refresh on 401
- **Pages:** Dashboard (calorie ring + meal list), Scan (camera/upload → AI), Reports (Recharts), Profile (auto-calc calorie target via Mifflin-St Jeor)
- **Styling:** Plain CSS in `styles/` directory, no CSS framework
- **Image handling:** Client-side resize before upload (`services/imageResize.js`)

### Key env vars
- `VITE_API_URL` — frontend API base (default `http://localhost:3001/api`)
- `VITE_BASE_PATH` — frontend route basename (used for subdirectory deploys)
- Backend vars in `backend/.env.example`: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
