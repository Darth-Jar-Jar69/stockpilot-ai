import asyncio
from datetime import datetime, timezone

import yfinance as yf

from app.core.exceptions import ProviderUnavailableError, SymbolNotFoundError
from app.core.logging import logger
from app.schemas.market import DataFreshness, OHLCVBar, Quote
from app.services.market_data.base import MarketDataProvider


class YahooFinanceProvider(MarketDataProvider):
    """Yahoo Finance via yfinance — no API key required."""

    name = "yahoo_finance"

    async def get_quote(self, symbol: str) -> Quote:
        return await asyncio.to_thread(self._get_quote_sync, symbol.upper())

    def _get_quote_sync(self, symbol: str) -> Quote:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            history = ticker.history(period="5d", interval="1d")

            price = getattr(info, "last_price", None) or getattr(info, "previous_close", None)
            if price is None and not history.empty:
                price = float(history["Close"].iloc[-1])

            if price is None:
                raise SymbolNotFoundError(symbol, self.name)

            previous_close = getattr(info, "previous_close", None)
            change = None
            change_percent = None
            if previous_close and price:
                change = round(price - previous_close, 4)
                change_percent = round((change / previous_close) * 100, 4)

            return Quote(
                symbol=symbol,
                price=round(float(price), 4),
                change=change,
                change_percent=change_percent,
                currency=str(getattr(info, "currency", "USD") or "USD"),
                market_cap=getattr(info, "market_cap", None),
                volume=int(history["Volume"].iloc[-1]) if not history.empty else None,
                previous_close=float(previous_close) if previous_close else None,
                provider=self.name,
                freshness=DataFreshness.DELAYED,
                as_of=datetime.now(timezone.utc),
            )
        except SymbolNotFoundError:
            raise
        except Exception as exc:
            logger.exception("Yahoo quote failed for %s", symbol)
            raise ProviderUnavailableError(str(exc), self.name) from exc

    async def get_ohlcv(self, symbol: str, period: str = "6mo", interval: str = "1d") -> list[OHLCVBar]:
        return await asyncio.to_thread(self._get_ohlcv_sync, symbol.upper(), period, interval)

    def _get_ohlcv_sync(self, symbol: str, period: str, interval: str) -> list[OHLCVBar]:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval, auto_adjust=True)

            if df.empty:
                raise SymbolNotFoundError(symbol, self.name)

            bars: list[OHLCVBar] = []
            for ts, row in df.iterrows():
                bars.append(
                    OHLCVBar(
                        timestamp=ts.to_pydatetime().replace(tzinfo=timezone.utc),
                        open=round(float(row["Open"]), 4),
                        high=round(float(row["High"]), 4),
                        low=round(float(row["Low"]), 4),
                        close=round(float(row["Close"]), 4),
                        volume=int(row["Volume"]),
                    )
                )
            return bars
        except SymbolNotFoundError:
            raise
        except Exception as exc:
            logger.exception("Yahoo OHLCV failed for %s", symbol)
            raise ProviderUnavailableError(str(exc), self.name) from exc
