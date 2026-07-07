# StockPilot

AI-powered investment research platform with live market data, probabilistic analysis, and portfolio tools. Probabilistic estimates — never guarantees.

## Status

**Milestone 2 complete:** Frontend scaffold (Next.js 15, Tailwind, shadcn/ui, Clerk, landing page, dashboard shell).  
Next milestone (pending approval): Database schema (Prisma) + Docker PostgreSQL.

## Monorepo Layout

```
stockpilot-ai/
├── frontend/     # Next.js 14+ App Router, Clerk, Prisma, TradingView charts
├── backend/      # FastAPI — market data, analysis engine, AI reasoning, optimizer
├── shared/       # API contracts and shared TypeScript types
└── docs/         # Architecture decisions, API specs, data-source notes
```

## Quick Start (after setup milestones)

```bash
# Database
docker compose up -d

# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

Copy `.env.example` files to `.env` in each package and add your API keys.

## Disclaimer

StockPilot provides probabilistic estimates and educational research tools. It is **not** financial advice. Past performance does not guarantee future results. Always do your own due diligence.

## License

Proprietary — all rights reserved.
