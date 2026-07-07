# API Routes (`src/app/api/`)

**Why:** Server-side proxy layer between the browser and FastAPI. Keeps API keys and backend URLs off the client.

Planned routes:

- `POST /api/analysis` — trigger symbol analysis
- `GET /api/quotes/[symbol]` — live quote proxy
- `POST /api/portfolio/optimize` — run optimizer with user inputs
- `GET /api/health` — data provider status

All routes verify Clerk session before forwarding to FastAPI.
