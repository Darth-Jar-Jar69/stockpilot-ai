from app.schemas.research import ComparisonMetric, ComparisonResponse
from app.services.research.service import research_service


class ComparisonService:
    async def compare(self, symbols: list[str]) -> ComparisonResponse:
        clean = [s.upper().strip() for s in symbols if s.strip()][:5]
        if len(clean) < 2:
            raise ValueError("At least two symbols required for comparison.")

        metrics: list[ComparisonMetric] = []
        for sym in clean:
            try:
                research = await research_service.get_company_research(sym)
                sp = research.stockpilot_scores
                metrics.append(
                    ComparisonMetric(
                        symbol=sym,
                        company_name=research.company_name,
                        growth_score=sp.growth.score if sp else None,
                        profitability_score=sp.quality.score if sp else None,
                        valuation_score=sp.value.score if sp else None,
                        risk_score=sp.risk.score if sp else None,
                        quality_score=sp.quality.score if sp else None,
                        overall_score=sp.overall.score if sp else None,
                        pe_ratio=research.fundamentals.pe_ratio if research.fundamentals else None,
                        revenue_growth=research.fundamentals.revenue_growth
                        if research.fundamentals
                        else None,
                        profit_margin=research.fundamentals.profit_margin
                        if research.fundamentals
                        else None,
                    )
                )
            except Exception:
                metrics.append(ComparisonMetric(symbol=sym))

        ranked = sorted(
            [m for m in metrics if m.overall_score is not None],
            key=lambda m: m.overall_score or 0,
            reverse=True,
        )

        if len(ranked) >= 2:
            best = ranked[0]
            second = ranked[1]
            conclusion = (
                f"Based on current live metrics, {best.symbol} "
                f"({best.company_name or 'N/A'}) scores highest overall "
                f"({best.overall_score:.0f}/100) with "
                f"{'stronger growth' if (best.growth_score or 0) > (second.growth_score or 0) else 'comparable growth'} "
                f"vs {second.symbol} ({second.overall_score:.0f}/100). "
                f"{second.symbol} may offer {'better valuation' if (second.valuation_score or 0) > (best.valuation_score or 0) else 'different risk/reward'}. "
                "This is quantitative research — not a recommendation."
            )
        elif ranked:
            conclusion = f"{ranked[0].symbol} is the only symbol with complete score data in this comparison."
        else:
            conclusion = "Insufficient live data to compare these symbols."

        return ComparisonResponse(
            symbols=clean,
            metrics=metrics,
            ai_conclusion=conclusion,
            disclaimer="Comparison uses live API data and computed scores — not financial advice.",
        )


comparison_service = ComparisonService()
