from app.core.cache import analysis_cache
from app.core.config import settings
from app.core.exceptions import MarketDataError
from app.schemas.market import AnalysisScores
from app.services.ai.equity_analyst import build_equity_report
from app.services.ai.explainer import build_explanation
from app.services.fundamentals.extended import fetch_extended_fundamentals
from app.services.market_data.service import market_data_service
from app.services.research.scoring import compute_stockpilot_scores
from app.services.research.valuation import compute_fair_value
from app.services.technical.indicators import compute_indicators, compute_scores
from app.schemas.research import CompanyResearch


class ResearchService:
    """Full company research pipeline — real data, structured scores, AI explanations."""

    async def get_company_research(self, symbol: str) -> CompanyResearch:
        cache_key = f"research:{symbol.upper()}"
        cached = await analysis_cache.get(cache_key)
        if cached:
            return cached

        warnings: list[str] = []
        quote = None
        fundamentals = None
        technical = None
        scores: AnalysisScores | None = None

        try:
            quote = await market_data_service.get_quote(symbol)
        except MarketDataError as exc:
            warnings.append(f"Quote unavailable: {exc.message}")

        try:
            fundamentals = await fetch_extended_fundamentals(symbol)
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
                f"Unable to fetch any real data for {symbol}.",
                code="unavailable",
            )

        stockpilot_scores = compute_stockpilot_scores(fundamentals, quote, technical, scores)
        fair_value = compute_fair_value(fundamentals, quote)
        equity_report = build_equity_report(
            symbol.upper(), fundamentals, quote, technical, stockpilot_scores, fair_value
        )
        explanation = build_explanation(symbol, quote, technical, fundamentals, scores)

        result = CompanyResearch(
            symbol=symbol.upper(),
            company_name=fundamentals.name if fundamentals else None,
            quote=quote,
            fundamentals=fundamentals,
            technical=technical,
            scores=scores,
            stockpilot_scores=stockpilot_scores,
            fair_value=fair_value,
            equity_report=equity_report,
            explanation=explanation,
            data_warnings=warnings,
        )
        await analysis_cache.set(cache_key, result, settings.cache_ttl_fundamentals)
        return result


research_service = ResearchService()
