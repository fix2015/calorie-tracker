# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Full stack with Docker
```bash
docker-compose up          # starts postgres, backend (3001), frontend (5173)
```

### Optional microservices (image, notification, messaging, social)
```bash
docker-compose -f docker-compose.services-local.yml up   # ports 3021-3024, separate postgres on 5433
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

### Mobile (Capacitor)
```bash
cd frontend
npm run cap:ios              # build + sync + open Xcode
npm run cap:android          # build + sync + open Android Studio
```

### Tests
```bash
cd backend && npm test                              # all tests
cd backend && node --test src/tests/foo.test.js     # single test file
```
Uses Node.js built-in test runner (no framework). Test directory: `backend/src/tests/`.

### Production deployment
```bash
# See infra/ for docker-compose.prod.yml and nginx configs
# CI/CD: .github/workflows/ci.yml builds+pushes Docker images to GHCR on main push
#         .github/workflows/deploy.yml deploys to EC2 via SSH on successful CI
# Node 20-alpine in Docker; health check at GET /api/health
```

## Architecture

**Monorepo with two apps:** `backend/` (Express API) and `frontend/` (React SPA), plus optional external microservices.

### Backend (CommonJS, Node.js)
- **Entry:** `src/index.js` — Express app with CORS, static uploads, route mounting. Health check at `GET /api/health`.
- **Routes:** `src/routes/` — REST endpoints under `/api/`:
  - `auth.js` — register, login, refresh, logout, me
  - `meals.js` — manual/photo meal logging, list, delete
  - `reports.js` — daily/weekly totals, AI suggestion
  - `users.js` — profile update, follow/unfollow, block
  - `messages.js` — conversations and direct messages
  - `notifications.js` — notification list, mark-read
  - `stories.js` — video stories (upload, view, 24h expiry)
  - `public.js` — public profiles and explore feed
  - `admin.js` — admin endpoints
- **Services:** `src/services/vision.js` (OpenAI GPT-4o photo scanning, configurable via `AI_PROVIDER`), `s3.js` (image resize via sharp + S3 upload with local fallback), `microservices.js` (HTTP client for external microservices)
- **Middleware:** `auth.js` (JWT verify with `authenticate()` and `optionalAuth()` variants), `upload.js` (multer — images 10MB, videos 50MB), `errorHandler.js` (catches ZodError → 400)
- **Rate limiting:** `express-rate-limit` on auth routes and AI endpoints (photo scan 20/hr, suggestions 20/hr, nutrition analysis 10/day)
- **Validation:** Zod schemas in `src/utils/validation.js`, validated in route handlers
- **Utils:** `src/utils/` — `jwt.js` (sign/verify access+refresh tokens), `calories.js` (Mifflin-St Jeor formula), `dailyStats.js` (meal aggregation), `languageName.js` (language codes → native names for GPT)

### Database (PostgreSQL + Prisma)
Schema at `backend/prisma/schema.prisma`. Prisma uses `@map` to snake_case DB columns while keeping camelCase in JS. All models cascade-delete from User.

Core models: User, Meal, RefreshToken, SuggestionCache

Social models: Like, Comment, CommentLike, Follow, Conversation, ConversationParticipant, Message, Notification, SavedMeal, BlockedUser

Tracking models: WeightLog, DailyStat

Enums: Gender, ActivityLevel, Goal, MealSource. Unique constraints enforce one-per-pair for likes, follows, saves, and blocks.

### API Patterns
- **Auth:** JWT access tokens (default 15m) + refresh tokens (default 7d). `optionalAuth()` middleware used on public endpoints.
- **Pagination:** Cursor-based on most list endpoints (feed, explore, followers). Configurable `limit` param with defaults (12 for meals, 10 for users).
- **File uploads:** Multer to disk → sharp resize → S3 (or local `uploads/` fallback). Client-side resize in `frontend/src/services/imageResize.js` before upload.

### Frontend (React 19, Vite 8, ES modules)
- **Routing:** React Router v7 in `App.jsx`. Protected routes use `<ProtectedLayout>` with `<Outlet>`. Public routes (`/login`, `/register`) redirect authenticated users to `/`. `/explore` works for both auth'd and anonymous users.
- **i18n:** Custom context-based system in `src/i18n/`. Supports en, uk, es, fr, de, pl. Locale JSON files in `src/i18n/locales/`. Uses `LanguageProvider` wrapper, localStorage key `appLanguage`, and sends `X-Language` header on API requests.
- **Auth state:** `services/AuthContext.jsx` — React context with auto-refresh on mount. Tokens stored in localStorage.
- **API client:** `services/api.js` — fetch wrapper with automatic JWT refresh on 401
- **Pages:** Dashboard (calorie ring + meal list), Scan (camera/upload → AI), Reports (Recharts), Profile, Explore, Feed, Messages, Notifications, Saved, Admin, PublicProfile
- **Components:** `components/` — AddMealModal, MealDetailModal, MealGrid, Navbar, TopBar, StoryRing, FeedCard, AvatarUpload, FollowListModal
- **Styling:** Plain CSS in `styles/` directory, no CSS framework
- **Other services:** `imageResize.js` (client-side resize before upload), `macroCalc.js`, `notifications.js` (push notifications), `share.js`, `photoUrl.js`, `useInfiniteScroll.js`

### Mobile (Capacitor)
Capacitor 8 wraps the Vite SPA for iOS/Android (`frontend/capacitor.config.json`, app ID: `com.calorietracker.app`). Build flow: `npm run build:cap` → `npx cap sync` → open in Xcode/Android Studio.

### Microservices (optional, external repos)
Configured in `docker-compose.services-local.yml`. The backend communicates with these via `src/services/microservices.js`:
- `service-image` (port 3021) — image processing
- `service-notification` (port 3022) — push notifications
- `service-messaging` (port 3023) — messaging
- `service-social` (port 3024) — social features

Each microservice has its own database; all share a postgres instance on port 5433 with databases initialized via `infra/init-services-db.sql`.

### Key env vars
- `VITE_API_URL` — frontend API base (default `http://localhost:3001/api`)
- `VITE_BASE_PATH` — frontend route basename (used for subdirectory deploys)
- Backend vars in `backend/.env.example`: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, OPENAI_API_KEY, AI_PROVIDER
- S3 vars (optional — falls back to local `uploads/`): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
