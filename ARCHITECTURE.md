# StockPilot — System Architecture

## Overview

StockPilot is a **monorepo** with a Next.js frontend and a Python FastAPI backend. The frontend handles authentication, UI, and database access via Prisma. The backend performs compute-heavy work: live data ingestion, technical/fundamental analysis, news sentiment, portfolio optimization, backtesting, and paper-trading simulation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         User (Browser)                                   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Next.js (Vercel)        │
                    │   Clerk Auth              │
                    │   App Router + RSC        │
                    │   Prisma → PostgreSQL     │
                    └─────────────┬─────────────┘
                                  │ REST / Server Actions
                    ┌─────────────▼─────────────┐
                    │   FastAPI (Railway/Render)│
                    │   Analysis Engine         │
                    │   Data Adapters           │
                    │   AI Reasoning Layer      │
                    └─────────────┬─────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
  Yahoo Finance            Finnhub / Alpha Vantage    FRED / SEC / NewsAPI
```

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Real data only** | All prices and fundamentals come from live APIs; stale data is flagged |
| **Probabilistic output** | Scores, confidence bands, upside/downside ranges — no certainty language |
| **Separation of concerns** | UI in frontend; analysis & data in backend |
| **Adapter pattern** | Each external API behind a `MarketDataProvider` interface |
| **Fail gracefully** | Rate limits, missing keys, and partial data surfaced to the user |
| **Type safety** | TypeScript frontend; Pydantic schemas backend; shared OpenAPI contract |

## Frontend (`frontend/`)

**Stack:** Next.js 14+, React, TypeScript, Tailwind CSS, shadcn/ui, Clerk, Prisma, TradingView Lightweight Charts.

**Responsibilities:**

- Landing, auth, dashboard, and all user-facing pages
- Clerk session management and protected routes
- Prisma ORM for users, portfolios, watchlists, paper trades, backtest runs
- Server Components for initial data; client components for charts and interactivity
- API route proxies to FastAPI (keeps secrets server-side)

**Key route groups (planned):**

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/dashboard` | Portfolio summary, targets, alerts |
| `/portfolio` | Holdings, allocation, rebalancing |
| `/scanner` | Market-wide opportunity scan |
| `/screener` | Filter stocks by criteria |
| `/analysis/[symbol]` | Deep AI report per symbol |
| `/watchlist` | Tracked symbols |
| `/news` | Aggregated news feed |
| `/backtesting` | Strategy simulation UI |
| `/paper-trading` | Simulated trading |
| `/settings` | Preferences, API status, risk profile | ✅ Done |

## Backend (`backend/`)

**Stack:** Python 3.11+, FastAPI, Pydantic v2, httpx, pandas, numpy, ta-lib or pandas-ta.

**Layered structure:**

```
app/
├── api/          # HTTP routers (thin — validate input, call services)
├── core/         # Config, security, dependencies, logging
├── schemas/      # Pydantic request/response models
├── models/       # Domain entities (not ORM — Prisma owns persistence)
├── services/     # Business logic
│   ├── market_data/    # Yahoo, Finnhub, Alpha Vantage adapters
│   ├── fundamentals/   # PE, EPS, FCF, etc.
│   ├── technical/      # RSI, MACD, Bollinger, etc.
│   ├── news/           # Fetch + sentiment scoring
│   ├── risk/           # Volatility, beta, Sharpe, drawdown
│   ├── portfolio/      # Optimizer, allocation, rebalancing
│   ├── backtest/       # Historical strategy engine
│   ├── paper_trading/  # Simulated execution on live prices
│   └── ai/             # Report generation, thesis, scoring aggregation
└── utils/        # Helpers (dates, caching, retry)
```

**Analysis pipeline (per symbol):**

1. **Ingest** — OHLCV, fundamentals, news, analyst ratings, insider filings
2. **Compute** — Technical indicators, fundamental ratios, risk metrics
3. **Score** — Weighted sub-scores (technical, fundamental, momentum, risk, news)
4. **Reason** — Structured AI report with thesis, risks, allocation suggestion
5. **Rank** — Compare across universe for scanner/optimizer

## Database (PostgreSQL + Prisma)

Prisma schema lives in `frontend/prisma/`. The FastAPI backend reads/writes via:

- **Option A (MVP):** Frontend API routes use Prisma; backend is stateless and returns computed results only
- **Option B (scale):** Backend uses `asyncpg` with shared schema; Prisma remains migration source of truth

**Planned entities:** `User`, `UserProfile`, `Portfolio`, `Holding`, `WatchlistItem`, `PaperTrade`, `BacktestRun`, `AnalysisCache`, `Alert`.

## External Data Sources

| Source | Data | Adapter location |
|--------|------|------------------|
| Yahoo Finance | Quotes, OHLCV | `services/market_data/yahoo.py` |
| Finnhub | Quotes, news, earnings, insiders | `services/market_data/finnhub.py` |
| Alpha Vantage | Quotes, indicators | `services/market_data/alpha_vantage.py` |
| Financial Modeling Prep | Financial statements | `services/fundamentals/fmp.py` |
| NewsAPI | Headlines | `services/news/newsapi.py` |
| FRED | Macro economic series | `services/market_data/fred.py` |
| SEC EDGAR | Insider filings | `services/fundamentals/sec.py` |

All keys stored in environment variables. A **data health** endpoint reports which providers are configured and reachable.

## AI Reasoning Layer

The AI layer does **not** replace quantitative analysis — it **synthesizes** computed scores into human-readable reports:

```json
{
  "overall_rating": "Moderate Buy",
  "technical_score": 72,
  "fundamental_score": 65,
  "momentum_score": 58,
  "risk_score": 41,
  "news_sentiment": "neutral",
  "analyst_consensus": "hold",
  "estimated_upside_pct": { "low": 4, "mid": 9, "high": 14 },
  "estimated_downside_pct": { "low": -3, "mid": -8, "high": -15 },
  "confidence": 0.62,
  "investment_thesis": "...",
  "reasons": ["..."],
  "potential_risks": ["..."],
  "suggested_allocation_pct": 12
}
```

LLM calls (when added) receive **only structured scores and facts** — not raw hallucination-prone prompts like "pick a stock."

## Portfolio Optimizer

**Inputs:** capital, target, timeframe, risk tolerance, country, preferred markets.

**Process:**

1. Screen universe by liquidity and user market preferences
2. Score candidates via analysis pipeline
3. Mean-variance or risk-parity style allocation with constraints (max position %, sector caps)
4. Monte Carlo or historical bootstrap for **probability of reaching target**
5. Output allocation table + expected return range + rebalancing triggers

## Authentication (Clerk)

- Clerk handles sign-up, sign-in, sessions
- Next.js middleware protects `/dashboard` and below
- Backend validates Clerk JWT on protected endpoints (optional for MVP if all calls proxy through Next.js)

## Deployment

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Vercel | `frontend/` root, env vars for Clerk + DB |
| Backend | Railway or Render | Docker or `uvicorn` start command |
| Database | Railway Postgres / Neon / Supabase | Connection string in Prisma |

## Security

- API keys never exposed to the browser
- Rate limiting on backend routes
- Input validation on all endpoints
- Disclaimer on every analysis view

## Milestone Roadmap

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Folder structure + architecture | ✅ Done |
| 2 | Frontend scaffold (Next.js, Tailwind, shadcn, Clerk) | ✅ Done |
| 3 | Database schema (Prisma) + user settings | ✅ Done |
| 4 | Backend scaffold (FastAPI) + health check | ✅ Done |
| 5 | Market data adapters (Yahoo + Finnhub) | ✅ Done (Yahoo live; Finnhub when key set) |
| 6 | Landing page + auth flow | ✅ Done (simple email auth) |
| 7 | Dashboard shell + live market data | ✅ Done |
| 8 | Stock detail page + live chart | ✅ Done |
| 9 | Market scanner / screener | ✅ Done |
| 10 | AI analysis report endpoint | ✅ Done (deterministic + LLM assistant chat) |
| 11 | Portfolio intelligence + optimizer | ✅ Done |
| 12 | Paper trading | ✅ Done |
| 13 | Backtesting engine | ✅ Done |
| 14 | Watchlist with persistence | ✅ Done |
| 15 | News feed (NewsAPI) | ✅ Done |
| 16 | Market intelligence dashboard | ✅ Done |
| 17 | AI company comparison | ✅ Done |
| 18 | Fair value engine | ✅ Done |
| 19 | StockPilot multi-factor scores | ✅ Done |
| 20 | AI equity analyst reports | ✅ Done |
