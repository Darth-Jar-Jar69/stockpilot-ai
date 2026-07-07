import asyncio
import logging

from app.core.cache import TTLCache
from app.core.exceptions import MarketDataError
from app.schemas.market import AnalysisScores
from app.schemas.scanner import ScanResult, ScannerResponse, ScreenerFilters
from app.services.fundamentals.yahoo import fetch_yahoo_fundamentals
from app.services.market_data.service import market_data_service
from app.services.scanner.reasoning import (
    build_ai_reasoning,
    company_name,
    confidence_score,
    matches_investment_horizon,
    matches_risk_level,
    predict_price_target,
    recommendation_badge,
    stockpilot_score,
)
from app.services.scanner.universe import SCANNER_UNIVERSE
from app.services.technical.indicators import compute_indicators, compute_scores
from app.services.technical.service import analysis_service

logger = logging.getLogger("stockpilot.scanner")

_CONCURRENCY = 10
_scanner_cache: TTLCache[ScannerResponse] = TTLCache()


def _analyst_sentiment(technical: float | None, momentum: float | None) -> str:
    tech = technical or 50
    mom = momentum or 50
    avg = (tech + mom) / 2
    if avg >= 65:
        return "Bullish"
    if avg >= 45:
        return "Neutral"
    return "Bearish"


def matches_query(item: ScanResult, query: str | None) -> bool:
    if not query or not query.strip():
        return True
    q = query.strip()
    qu = q.upper()
    if qu in item.symbol or item.symbol.startswith(qu):
        return True
    if item.company_name and q.lower() in item.company_name.lower():
        return True
    if item.sector and q.lower() in item.sector.lower():
        return True
    return False


class ScannerService:
    """Scan a broad US equity universe using real market data."""

    async def _scan_symbol_fast(self, symbol: str) -> ScanResult | None:
        """Lighter scan — quote + OHLCV indicators, skip full AI explanation."""
        try:
            quote = await market_data_service.get_quote(symbol)
            ohlcv = await market_data_service.get_ohlcv(symbol, period="6mo", interval="1d")
            technical = compute_indicators(symbol, ohlcv.bars, ohlcv.provider)
            score_values = compute_scores(technical)
            scores = AnalysisScores(**score_values)
            fund = None
            try:
                fund = await fetch_yahoo_fundamentals(symbol)
            except MarketDataError:
                pass

            tech_score = scores.technical_score
            mom_score = scores.momentum_score
            risk_score = scores.risk_score
            conf = confidence_score(tech_score, mom_score, risk_score, fund is not None)

            return ScanResult(
                symbol=symbol.upper(),
                company_name=company_name(symbol),
                price=quote.price,
                change_percent=quote.change_percent,
                volume=int(quote.volume) if quote.volume else None,
                market_cap=quote.market_cap,
                pe_ratio=fund.pe_ratio if fund else None,
                rsi_14=technical.rsi_14,
                technical_score=tech_score,
                momentum_score=mom_score,
                risk_score=risk_score,
                overall_rating=None,
                recommendation=recommendation_badge(tech_score, mom_score, risk_score),
                analyst_sentiment=_analyst_sentiment(tech_score, mom_score),
                confidence_score=conf,
                sector=fund.sector if fund else None,
                provider=quote.provider,
                stockpilot_score=stockpilot_score(tech_score, mom_score, risk_score, conf),
                predicted_price=None,
                predicted_change_percent=None,
            )
        except MarketDataError as exc:
            logger.debug("Skip %s: %s", symbol, exc.message)
            return None

    async def _scan_symbol(self, symbol: str) -> ScanResult | None:
        try:
            analysis = await analysis_service.analyze_symbol(symbol)
        except MarketDataError as exc:
            logger.debug("Skip %s: %s", symbol, exc.message)
            return None

        quote = analysis.quote
        tech = analysis.technical
        scores = analysis.scores
        fund = analysis.fundamentals
        expl = analysis.explanation

        tech_score = scores.technical_score if scores else None
        mom_score = scores.momentum_score if scores else None
        risk_score = scores.risk_score if scores else None
        conf = confidence_score(tech_score, mom_score, risk_score, fund is not None)

        return ScanResult(
            symbol=analysis.symbol,
            company_name=company_name(analysis.symbol),
            price=quote.price if quote else None,
            change_percent=quote.change_percent if quote else None,
            volume=int(quote.volume) if quote and quote.volume else None,
            market_cap=quote.market_cap if quote else None,
            pe_ratio=fund.pe_ratio if fund else None,
            rsi_14=tech.rsi_14 if tech else None,
            technical_score=tech_score,
            momentum_score=mom_score,
            risk_score=risk_score,
            overall_rating=expl.overall_rating if expl else None,
            recommendation=recommendation_badge(tech_score, mom_score, risk_score),
            analyst_sentiment=_analyst_sentiment(tech_score, mom_score),
            confidence_score=conf,
            sector=fund.sector if fund else None,
            provider=quote.provider if quote else None,
            stockpilot_score=stockpilot_score(tech_score, mom_score, risk_score, conf),
            predicted_price=None,
            predicted_change_percent=None,
        )

    async def _scan_many(self, symbols: tuple[str, ...]) -> list[ScanResult]:
        sem = asyncio.Semaphore(_CONCURRENCY)

        async def bounded(symbol: str) -> ScanResult | None:
            async with sem:
                return await self._scan_symbol_fast(symbol)

        raw = await asyncio.gather(*(bounded(s) for s in symbols))
        return [r for r in raw if r is not None]

    def _rank_opportunities(self, results: list[ScanResult]) -> list[ScanResult]:
        return sorted(
            results,
            key=lambda item: item.stockpilot_score or 0,
            reverse=True,
        )

    def _apply_filters(self, results: list[ScanResult], filters: ScreenerFilters) -> list[ScanResult]:
        filtered: list[ScanResult] = []
        for item in results:
            if filters.min_rsi is not None and (item.rsi_14 is None or item.rsi_14 < filters.min_rsi):
                continue
            if filters.max_rsi is not None and (item.rsi_14 is None or item.rsi_14 > filters.max_rsi):
                continue
            if filters.min_technical_score is not None and (
                item.technical_score is None or item.technical_score < filters.min_technical_score
            ):
                continue
            if filters.min_momentum_score is not None and (
                item.momentum_score is None or item.momentum_score < filters.min_momentum_score
            ):
                continue
            if filters.sector and (
                not item.sector or filters.sector.lower() not in item.sector.lower()
            ):
                continue
            if filters.min_price is not None and (item.price is None or item.price < filters.min_price):
                continue
            if filters.max_price is not None and (item.price is None or item.price > filters.max_price):
                continue
            if not matches_investment_horizon(item, filters.investment_horizon):
                continue
            if not matches_risk_level(item, filters.risk_level):
                continue
            if not matches_query(item, filters.query):
                continue
            filtered.append(item)
        return filtered

    def _attach_enrichment(
        self,
        results: list[ScanResult],
        horizon: str | None,
        risk_level: str | None,
    ) -> list[ScanResult]:
        enriched: list[ScanResult] = []
        for item in results:
            pred_price, pred_pct = predict_price_target(
                item.price,
                item.technical_score,
                item.momentum_score,
                item.risk_score,
                horizon,
            )
            with_pred = item.model_copy(
                update={
                    "predicted_price": pred_price,
                    "predicted_change_percent": pred_pct,
                }
            )
            enriched.append(
                with_pred.model_copy(
                    update={
                        "ai_reasoning": build_ai_reasoning(with_pred, horizon, risk_level),
                    }
                )
            )
        return enriched

    async def scan_market(
        self,
        limit: int = 30,
        investment_horizon: str | None = None,
        risk_level: str | None = None,
    ) -> ScannerResponse:
        cache_key = f"scanner:{limit}:{investment_horizon}:{risk_level}"
        cached = await _scanner_cache.get(cache_key)
        if cached:
            return cached

        filters = ScreenerFilters(
            investment_horizon=investment_horizon,
            risk_level=risk_level,
            limit=limit,
        )
        results = await self._scan_many(SCANNER_UNIVERSE)
        filtered = self._apply_filters(results, filters)

        if len(filtered) < min(8, limit) and (investment_horizon or risk_level):
            loose = ScreenerFilters(
                investment_horizon=None,
                risk_level=None,
                limit=limit,
            )
            filtered = self._apply_filters(results, loose)
            if investment_horizon:
                filtered = [
                    r for r in filtered if matches_investment_horizon(r, investment_horizon)
                ] or filtered
            if risk_level:
                filtered = [r for r in filtered if matches_risk_level(r, risk_level)] or filtered

        ranked = self._rank_opportunities(filtered)[:limit]
        ranked = self._attach_enrichment(ranked, investment_horizon, risk_level)

        applied: dict[str, str | float | int | bool] = {
            "mode": "stockpilot_score_rank",
            "sort": "stockpilot_score",
        }
        if investment_horizon:
            applied["investment_horizon"] = investment_horizon
        if risk_level:
            applied["risk_level"] = risk_level

        response = ScannerResponse(
            results=ranked,
            universe_size=len(SCANNER_UNIVERSE),
            filters_applied=applied,
        )
        await _scanner_cache.set(cache_key, response, 180)
        return response

    async def screen(self, filters: ScreenerFilters) -> ScannerResponse:
        cache_key = f"screener:{filters.model_dump_json()}"
        cached = await _scanner_cache.get(cache_key)
        if cached:
            return cached

        results = await self._scan_many(SCANNER_UNIVERSE)
        filtered = self._apply_filters(results, filters)
        ranked = self._rank_opportunities(filtered)[: filters.limit]
        ranked = self._attach_enrichment(ranked, filters.investment_horizon, filters.risk_level)
        applied = {k: v for k, v in filters.model_dump().items() if v is not None}
        applied["sort"] = "stockpilot_score"
        applied["total_matches"] = len(filtered)
        applied["returned"] = len(ranked)

        response = ScannerResponse(
            results=ranked,
            universe_size=len(SCANNER_UNIVERSE),
            filters_applied=applied,
        )
        await _scanner_cache.set(cache_key, response, 180)
        return response


scanner_service = ScannerService()
