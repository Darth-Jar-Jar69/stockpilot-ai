# Shared Types & API Contracts

**Why this folder exists:** Keeps TypeScript types and OpenAPI-generated interfaces in sync between the Next.js frontend and FastAPI backend. Prevents drift when request/response shapes change.

## Contents (planned)

- `types/analysis.ts` — AnalysisReport, ScoreBreakdown, ProbabilityEstimate
- `types/portfolio.ts` — Allocation, Holding, OptimizerInput/Output
- `types/market.ts` — Quote, OHLCV, Fundamentals
- `openapi/` — Exported OpenAPI spec from FastAPI for codegen

The backend exposes `/openapi.json`; the frontend can regenerate types with `openapi-typescript`.
