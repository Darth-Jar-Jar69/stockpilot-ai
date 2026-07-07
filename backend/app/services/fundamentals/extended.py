import asyncio
from datetime import datetime, timezone

import yfinance as yf

from app.core.exceptions import ProviderUnavailableError, SymbolNotFoundError
from app.core.logging import logger
from app.schemas.research import ExtendedFundamentals


async def fetch_extended_fundamentals(symbol: str) -> ExtendedFundamentals:
    return await asyncio.to_thread(_fetch_sync, symbol.upper())


def _fetch_sync(symbol: str) -> ExtendedFundamentals:
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        if not info or (
            info.get("regularMarketPrice") is None and info.get("currentPrice") is None
        ):
            raise SymbolNotFoundError(symbol, "yahoo_finance")

        def _f(key: str) -> float | None:
            val = info.get(key)
            if val is None:
                return None
            try:
                return round(float(val), 4)
            except (TypeError, ValueError):
                return None

        return ExtendedFundamentals(
            symbol=symbol,
            name=info.get("longName") or info.get("shortName"),
            description=(info.get("longBusinessSummary") or "")[:1200] or None,
            pe_ratio=_f("trailingPE"),
            forward_pe=_f("forwardPE"),
            peg_ratio=_f("pegRatio"),
            eps=_f("trailingEps"),
            dividend_yield=_f("dividendYield"),
            beta=_f("beta"),
            profit_margin=_f("profitMargins"),
            revenue_growth=_f("revenueGrowth"),
            earnings_growth=_f("earningsGrowth"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            debt_to_equity=_f("debtToEquity"),
            free_cash_flow=_f("freeCashflow"),
            return_on_equity=_f("returnOnEquity"),
            return_on_assets=_f("returnOnAssets"),
            ev_to_ebitda=_f("enterpriseToEbitda"),
            price_to_book=_f("priceToBook"),
            operating_margin=_f("operatingMargins"),
            gross_margin=_f("grossMargins"),
            current_ratio=_f("currentRatio"),
            total_debt=_f("totalDebt"),
            total_cash=_f("totalCash"),
            enterprise_value=_f("enterpriseValue"),
            ebitda=_f("ebitda"),
            revenue=_f("totalRevenue"),
            fifty_two_week_high=_f("fiftyTwoWeekHigh"),
            fifty_two_week_low=_f("fiftyTwoWeekLow"),
            shares_outstanding=_f("sharesOutstanding"),
            institutional_ownership=_f("heldPercentInstitutions"),
            country=info.get("country"),
            website=info.get("website"),
            provider="yahoo_finance",
            as_of=datetime.now(timezone.utc),
        )
    except SymbolNotFoundError:
        raise
    except Exception as exc:
        logger.exception("Extended fundamentals failed for %s", symbol)
        raise ProviderUnavailableError(str(exc), "yahoo_finance") from exc
