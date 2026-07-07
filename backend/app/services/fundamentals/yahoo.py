import asyncio
from datetime import datetime, timezone

import yfinance as yf

from app.core.exceptions import ProviderUnavailableError, SymbolNotFoundError
from app.core.logging import logger
from app.schemas.fundamentals import Fundamentals


async def fetch_yahoo_fundamentals(symbol: str) -> Fundamentals:
    return await asyncio.to_thread(_fetch_sync, symbol.upper())


def _fetch_sync(symbol: str) -> Fundamentals:
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
            raise SymbolNotFoundError(symbol, "yahoo_finance")

        def _f(key: str) -> float | None:
            val = info.get(key)
            if val is None:
                return None
            try:
                return round(float(val), 4)
            except (TypeError, ValueError):
                return None

        return Fundamentals(
            symbol=symbol,
            pe_ratio=_f("trailingPE"),
            forward_pe=_f("forwardPE"),
            peg_ratio=_f("pegRatio"),
            eps=_f("trailingEps"),
            dividend_yield=_f("dividendYield"),
            beta=_f("beta"),
            profit_margin=_f("profitMargins"),
            revenue_growth=_f("revenueGrowth"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            provider="yahoo_finance",
            as_of=datetime.now(timezone.utc),
        )
    except SymbolNotFoundError:
        raise
    except Exception as exc:
        logger.exception("Yahoo fundamentals failed for %s", symbol)
        raise ProviderUnavailableError(str(exc), "yahoo_finance") from exc
