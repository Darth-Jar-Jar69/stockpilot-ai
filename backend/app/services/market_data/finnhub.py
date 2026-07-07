from datetime import datetime, timezone

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.exceptions import (
    MissingApiKeyError,
    ProviderUnavailableError,
    RateLimitError,
    SymbolNotFoundError,
)
from app.core.logging import logger
from app.schemas.market import DataFreshness, OHLCVBar, Quote
from app.services.market_data.base import MarketDataProvider

FINNHUB_BASE = "https://finnhub.io/api/v1"


class FinnhubProvider(MarketDataProvider):
    """Finnhub market data — requires FINNHUB_API_KEY."""

    name = "finnhub"

    def _require_key(self) -> str:
        if not settings.finnhub_api_key:
            raise MissingApiKeyError(self.name)
        return settings.finnhub_api_key

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def _get(self, path: str, params: dict | None = None) -> dict:
        api_key = self._require_key()
        query = {"token": api_key, **(params or {})}
        async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
            response = await client.get(f"{FINNHUB_BASE}{path}", params=query)

        if response.status_code == 429:
            raise RateLimitError("Finnhub rate limit exceeded.", self.name)
        if response.status_code == 404:
            raise SymbolNotFoundError(params.get("symbol", "unknown") if params else "unknown", self.name)
        if response.status_code >= 400:
            raise ProviderUnavailableError(
                f"Finnhub HTTP {response.status_code}: {response.text[:200]}",
                self.name,
            )
        return response.json()

    async def get_quote(self, symbol: str) -> Quote:
        data = await self._get("/quote", {"symbol": symbol.upper()})
        price = data.get("c")
        if price is None or price == 0:
            raise SymbolNotFoundError(symbol, self.name)

        previous_close = data.get("pc")
        change = round(price - previous_close, 4) if previous_close else None
        change_percent = (
            round((change / previous_close) * 100, 4) if change is not None and previous_close else None
        )

        return Quote(
            symbol=symbol.upper(),
            price=round(float(price), 4),
            change=change,
            change_percent=change_percent,
            previous_close=float(previous_close) if previous_close else None,
            provider=self.name,
            freshness=DataFreshness.LIVE,
            as_of=datetime.fromtimestamp(data.get("t", 0), tz=timezone.utc)
            if data.get("t")
            else datetime.now(timezone.utc),
        )

    async def get_ohlcv(self, symbol: str, period: str = "6mo", interval: str = "1d") -> list[OHLCVBar]:
        # Finnhub candle endpoint uses unix timestamps
        import time

        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}.get(period, 180)
        resolution = {"1d": "D", "1h": "60", "15m": "15"}.get(interval, "D")
        now = int(time.time())
        start = now - period_days * 86400

        data = await self._get(
            "/stock/candle",
            {"symbol": symbol.upper(), "resolution": resolution, "from": start, "to": now},
        )

        if data.get("s") != "ok":
            raise ProviderUnavailableError(f"No candle data for {symbol}", self.name)

        bars: list[OHLCVBar] = []
        for i, ts in enumerate(data["t"]):
            bars.append(
                OHLCVBar(
                    timestamp=datetime.fromtimestamp(ts, tz=timezone.utc),
                    open=round(float(data["o"][i]), 4),
                    high=round(float(data["h"][i]), 4),
                    low=round(float(data["l"][i]), 4),
                    close=round(float(data["c"][i]), 4),
                    volume=int(data["v"][i]),
                )
            )
        return bars

    async def health_check(self) -> tuple[bool, str | None]:
        if not settings.finnhub_api_key:
            return False, "FINNHUB_API_KEY not configured"
        try:
            await self._get("/quote", {"symbol": "AAPL"})
            return True, None
        except Exception as exc:
            logger.warning("Finnhub health check failed: %s", exc)
            return False, str(exc)
