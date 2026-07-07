# Real Market Data Policy

StockPilot **never fabricates** prices, financial metrics, analyst opinions, or market events.

## Data flow

```
User → Next.js → FastAPI → Financial APIs → Indicators → Scores → AI (explanation only)
```

## Implemented providers (Milestone 4–5)

| Provider | Key required | Data |
|----------|--------------|------|
| Yahoo Finance | No | Quotes, OHLCV (delayed) |
| Finnhub | `FINNHUB_API_KEY` | Quotes, OHLCV (live) |

## Planned providers

- Financial Modeling Prep — financial statements
- Alpha Vantage — backup quotes
- FRED — macroeconomic data
- SEC EDGAR — insider filings
- NewsAPI / Finnhub News — headlines

## Failure handling

When an API fails or is rate-limited:

1. Retry with exponential backoff (httpx + tenacity)
2. Fall back to the next provider
3. Serve cached **real** data if available
4. Return HTTP 503 with a clear error — **never substitute fake numbers**

## Technical indicators

RSI, MACD, EMA, SMA, ATR, VWAP, Bollinger Bands, and ADX are computed in `backend/app/services/technical/indicators.py` from real OHLCV bars.

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/health` | Provider status |
| `GET /api/v1/quotes/{symbol}` | Live quote |
| `GET /api/v1/ohlcv/{symbol}` | Historical OHLCV |
| `GET /api/v1/analysis/{symbol}` | Quote + indicators + scores |

## Running the backend

```bash
cd backend
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs
