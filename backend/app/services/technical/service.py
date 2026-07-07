from app.core.cache import analysis_cache
from app.core.config import settings
from app.core.exceptions import MarketDataError
from app.schemas.market import AnalysisScores, SymbolAnalysis, TechnicalIndicators
from app.services.ai.explainer import build_explanation
from app.services.fundamentals.yahoo import fetch_yahoo_fundamentals
from app.services.market_data.service import market_data_service
from app.services.technical.indicators import compute_indicators, compute_scores


class AnalysisService:
    """Combines real market data + computed indicators into structured analysis."""

    async def analyze_symbol(self, symbol: str) -> SymbolAnalysis:
        cache_key = f"analysis:{symbol.upper()}"
        cached = await analysis_cache.get(cache_key)
        if cached:
            return cached

        warnings: list[str] = []
        quote = None
        fundamentals = None
        technical: TechnicalIndicators | None = None
        scores: AnalysisScores | None = None

        try:
            quote = await market_data_service.get_quote(symbol)
        except MarketDataError as exc:
            warnings.append(f"Quote unavailable: {exc.message}")

        try:
            fundamentals = await fetch_yahoo_fundamentals(symbol)
        except MarketDataError as exc:
            warnings.append(f"Fundamentals unavailable: {exc.message}")

        try:
            ohlcv = await market_data_service.get_ohlcv(symbol, period="1y", interval="1d")
            technical = compute_indicators(symbol, ohlcv.bars, ohlcv.provider)
            score_values = compute_scores(technical)
            scores = AnalysisScores(**score_values)
        except (MarketDataError, ValueError) as exc:
            warnings.append(f"Technical analysis unavailable: {exc}")

        if not quote and not technical:
            raise MarketDataError(
                f"Unable to fetch any real data for {symbol}. Check symbol and API status.",
                code="unavailable",
            )

        explanation = build_explanation(symbol, quote, technical, fundamentals, scores)

        result = SymbolAnalysis(
            symbol=symbol.upper(),
            quote=quote,
            fundamentals=fundamentals,
            technical=technical,
            scores=scores,
            explanation=explanation,
            data_warnings=warnings,
        )
        await analysis_cache.set(cache_key, result, settings.cache_ttl_quote)
        return result


analysis_service = AnalysisService()
