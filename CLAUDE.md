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
npm run build:cap           # build for Capacitor (mobile)
npx cap sync                # sync web assets to native projects
```

### Tests
```bash
cd backend && npm test                              # all tests
cd backend && node --test src/tests/foo.test.js     # single test file
```
Uses Node.js built-in test runner (no framework). Test directory: `backend/src/tests/` (currently empty — tests need to be added).

### Production deployment
```bash
# See infra/ for docker-compose.prod.yml and nginx configs
# CI/CD via GitHub Actions (.github/workflows/deploy.yml) deploys to EC2
```

## Architecture

**Monorepo with two apps:** `backend/` (Express API) and `frontend/` (React SPA).

### Backend (CommonJS, Node.js)
- **Entry:** `src/index.js` — Express app with CORS, static uploads, route mounting. Health check at `GET /api/health`.
- **Routes:** `src/routes/{auth,users,meals,reports}.js` — REST endpoints under `/api/`. Notable rate limits: photo scan (20/hr), AI suggestions (20/hr), nutrition analysis (10/day).
- **Services:** `src/services/vision.js` — calls OpenAI GPT-4o for photo meal scanning. Provider configurable via `AI_PROVIDER` env var. `src/services/s3.js` — image resize (sharp) + S3 upload with local fallback when S3 is not configured.
- **Middleware:** `src/middleware/auth.js` (JWT verify), `upload.js` (multer for photo uploads), `errorHandler.js`
- **Rate limiting:** `express-rate-limit` applied to auth routes and AI-powered endpoints (photo scan, suggestions)
- **Database:** PostgreSQL via Prisma ORM. Schema at `prisma/schema.prisma`
  - Models: User, Meal, RefreshToken, SuggestionCache
  - Prisma uses `@map` to snake_case DB columns while keeping camelCase in JS
  - All models use `onDelete: Cascade` from User
- **Auth flow:** JWT access + refresh tokens. Refresh tokens stored hashed in DB.
- **Validation:** Zod schemas in route handlers

### Frontend (React 19, Vite, ES modules)
- **Routing:** React Router v7 in `App.jsx`. Protected routes use `<ProtectedLayout>` with `<Outlet>`. Public routes (`/login`, `/register`) redirect authenticated users to `/`.
- **Auth state:** `services/AuthContext.jsx` — React context with auto-refresh on mount
- **API client:** `services/api.js` — fetch wrapper with automatic JWT refresh on 401
- **Pages:** Dashboard (calorie ring + meal list), Scan (camera/upload → AI), Reports (Recharts), Profile (Mifflin-St Jeor calorie target auto-calculation)
- **Styling:** Plain CSS in `styles/` directory, no CSS framework
- **Image handling:** Client-side resize before upload (`services/imageResize.js`)
- **Other services:** `macroCalc.js` (macro calculations), `notifications.js` (push notifications for meal reminders), `share.js` (share functionality), `photoUrl.js` (photo URL resolution)

### Mobile (Capacitor)
- Capacitor 8 wraps the Vite SPA for iOS/Android (`frontend/capacitor.config.json`, app ID: `com.calorietracker.app`)
- Native projects in `frontend/ios/` and `frontend/android/`
- Build flow: `npm run build:cap` → `npx cap sync` → open in Xcode/Android Studio

### Key env vars
- `VITE_API_URL` — frontend API base (default `http://localhost:3001/api`)
- `VITE_BASE_PATH` — frontend route basename (used for subdirectory deploys)
- Backend vars in `backend/.env.example`: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, OPENAI_API_KEY, AI_PROVIDER
- S3 vars (optional — falls back to local `uploads/`): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
