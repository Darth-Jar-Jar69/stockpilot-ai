# Market Data Services (`services/market_data/`)

**Why:** Single abstraction over multiple live data providers. Each adapter implements a common interface so the analysis pipeline can swap sources when rate-limited.

## Planned adapters

| File | Provider | Data |
|------|----------|------|
| `yahoo.py` | Yahoo Finance | OHLCV, quotes, basic fundamentals |
| `finnhub.py` | Finnhub | Quotes, news, earnings, insiders |
| `alpha_vantage.py` | Alpha Vantage | Quotes, technical indicators |
| `fred.py` | FRED | Macro economic series |
| `base.py` | — | `MarketDataProvider` ABC |

## Interface (conceptual)

```python
class MarketDataProvider(ABC):
    async def get_quote(self, symbol: str) -> Quote: ...
    async def get_ohlcv(self, symbol: str, period: str) -> list[OHLCV]: ...
```

Adapters handle retries, rate limits, and normalize symbols (e.g. `AAPL` vs `AAPL.US`).
