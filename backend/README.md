# Backend — FastAPI Analysis Engine

**Why this package exists:** Compute-heavy services run here — live market data ingestion, technical/fundamental analysis, news sentiment, portfolio optimization, backtesting, and paper-trading simulation. Deployed to Railway or Render.

## Structure

```
app/
├── main.py           # FastAPI app entry point
├── api/              # Route handlers (routers)
│   └── v1/           # Versioned API
├── core/             # Config, CORS, auth middleware, logging
├── schemas/          # Pydantic request/response models
├── models/           # Domain entities (analysis results, scores)
├── services/
│   ├── market_data/  # Yahoo, Finnhub, Alpha Vantage, FRED adapters
│   ├── fundamentals/ # PE, EPS, FCF, SEC filings
│   ├── technical/    # RSI, MACD, Bollinger, etc.
│   ├── news/         # News fetch + sentiment
│   ├── risk/         # Volatility, beta, Sharpe, drawdown
│   ├── portfolio/    # Optimizer and rebalancing
│   ├── backtest/     # Historical strategy engine
│   ├── paper_trading/# Simulated trades on live prices
│   └── ai/           # Report synthesis and scoring aggregation
└── utils/            # Caching, retries, date helpers
tests/                # pytest unit and integration tests
```

## Environment

Copy `.env.example` to `.env` before running.

## Commands (after scaffold)

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
