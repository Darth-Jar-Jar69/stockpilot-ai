# Data Sources Reference

**Why:** Documents external API behavior before we implement adapters in Milestone 5.

## Providers

| Provider | Free tier | Key env var | Primary use |
|----------|-----------|-------------|-------------|
| Yahoo Finance | Unofficial / no key | — | OHLCV, quotes |
| Finnhub | 60 calls/min | `FINNHUB_API_KEY` | Quotes, news, earnings, insiders |
| Alpha Vantage | 25 calls/day | `ALPHA_VANTAGE_API_KEY` | Backup quotes |
| Financial Modeling Prep | 250 calls/day | `FMP_API_KEY` | Financial statements |
| NewsAPI | 100 req/day | `NEWS_API_KEY` | Headlines |
| FRED | Unlimited with key | `FRED_API_KEY` | Macro data |
| SEC EDGAR | Public | — | Insider Form 4 filings |

## Rate-limit strategy

1. Cache quotes for 15–60 seconds in memory (Redis later)
2. Batch symbol requests where APIs allow
3. Fall back to secondary provider on 429 errors
4. Surface `data_freshness` and `provider` in API responses

## Disclaimer

All data is provided for research purposes. Verify critical figures against official exchange or company filings.
