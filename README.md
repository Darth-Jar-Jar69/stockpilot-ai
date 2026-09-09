# StockPilot

AI-powered investment research platform with live market data, probabilistic analysis, and portfolio tools. Probabilistic estimates — never guarantees.

## Features

- **Live dashboard** — real-time quotes, movers, and market news (Finnhub + Yahoo Finance, with automatic fallback if a provider is down)
- **Analysis engine** — technical + fundamental scoring with entry/exit levels and probability estimates for any symbol
- **Market Scanner** — two strategies:
  - *StockPilot Opportunities* — ranked setups across a 380+ symbol universe (US large/mid caps + major global ADRs)
  - *Fallen Giants* — event-driven recovery scanner that finds quality companies in sharp drawdowns, classifies the catalyst from news, and scores recovery odds with plain-English bull/bear narratives
- **Stock Screener** — filter the universe by valuation, growth, quality, and momentum
- **Paper trading** — simulated portfolio with live pricing
- **AI assistant** — research chat grounded in live market data
- **Auth** — email/password signup with 6-digit email verification (Resend) and Google OAuth

## Monorepo Layout

```
stockpilot-ai/
├── frontend/     # Next.js 15 App Router, Tailwind, shadcn/ui, Prisma
├── backend/      # FastAPI — market data, analysis engine, scanners, AI reasoning
├── shared/       # API contracts and shared TypeScript types
└── docs/         # Architecture decisions, API specs, data-source notes
```

## Quick Start

Requires Node 20+, Python 3.11+.

```bash
# Backend (http://localhost:8000)
cd backend
pip install -r requirements.txt
cp .env.example .env   # add your Finnhub API key (free at finnhub.io)
uvicorn app.main:app --reload

# Frontend (http://localhost:3000)
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npx prisma db push
npm run dev
```

Optional keys in `frontend/.env.local`:

- `RESEND_API_KEY` / `EMAIL_FROM` — send real verification emails (otherwise the code is shown inline during signup)
- `OPENAI_API_KEY` — enables the AI assistant
- Google OAuth client ID/secret — enables "Sign in with Google"

The frontend degrades gracefully: if the FastAPI backend is unreachable, core market data falls back to Yahoo Finance directly.

## Disclaimer

StockPilot provides probabilistic estimates and educational research tools. It is **not** financial advice. Past performance does not guarantee future results. Always do your own due diligence.

## License

Proprietary — all rights reserved.
