from app.schemas.research import PortfolioAnalysis, PortfolioHoldingInput
from app.services.research.service import research_service


class PortfolioService:
    async def analyze_holdings(self, holdings: list[PortfolioHoldingInput]) -> PortfolioAnalysis:
        if not holdings:
            return PortfolioAnalysis(
                holdings_count=0,
                insights=["Add holdings to analyse your portfolio."],
                disclaimer="Portfolio analysis uses live market data.",
            )

        total_value = 0.0
        sector_weights: dict[str, float] = {}
        scores: list[float] = []
        weak: list[str] = []

        for h in holdings:
            try:
                research = await research_service.get_company_research(h.symbol)
                price = research.quote.price if research.quote else h.avg_cost or 0
                value = price * h.shares
                total_value += value

                sector = research.fundamentals.sector if research.fundamentals else "Unknown"
                sector_weights[sector] = sector_weights.get(sector, 0) + value

                overall = (
                    research.stockpilot_scores.overall.score
                    if research.stockpilot_scores
                    else None
                )
                if overall is not None:
                    scores.append(overall)
                    if overall < 45:
                        weak.append(h.symbol.upper())
            except Exception:
                weak.append(h.symbol.upper())

        sector_pct = {
            k: round((v / total_value) * 100, 1) if total_value else 0
            for k, v in sector_weights.items()
        }
        max_sector = max(sector_pct.values()) if sector_pct else 0
        diversification = max(0, 100 - max_sector * 1.2)
        health = sum(scores) / len(scores) if scores else None
        risk_exposure = 100 - diversification if max_sector > 40 else max(20, max_sector)

        insights: list[str] = []
        if max_sector > 50:
            top = max(sector_pct, key=sector_pct.get)
            insights.append(
                f"Your portfolio has {max_sector:.0f}% exposure to {top}. "
                f"A sector decline could significantly impact returns."
            )
        if weak:
            insights.append(f"Weak positions (score <45): {', '.join(weak[:5])}.")
        if health and health > 65:
            insights.append(f"Portfolio health score {health:.0f}/100 — generally solid fundamentals.")
        if not insights:
            insights.append("Portfolio composition looks balanced across available metrics.")

        return PortfolioAnalysis(
            holdings_count=len(holdings),
            total_value=round(total_value, 2) if total_value else None,
            health_score=round(health, 1) if health else None,
            diversification_score=round(diversification, 1),
            risk_exposure=round(risk_exposure, 1),
            sector_concentration=sector_pct,
            weak_positions=weak,
            insights=insights,
            disclaimer="Portfolio intelligence from live data — not financial advice.",
        )


portfolio_service = PortfolioService()
