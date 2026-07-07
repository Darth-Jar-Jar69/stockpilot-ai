from app.schemas.research import EquityAnalystReport, ExtendedFundamentals, FairValueEstimate, StockPilotScores
from app.schemas.market import Quote, TechnicalIndicators


def build_equity_report(
    symbol: str,
    fund: ExtendedFundamentals | None,
    quote: Quote | None,
    technical: TechnicalIndicators | None,
    stockpilot_scores: StockPilotScores | None,
    fair_value: FairValueEstimate | None,
) -> EquityAnalystReport:
    bull: list[str] = []
    bear: list[str] = []
    growth_ops: list[str] = []
    advantages: list[str] = []
    risks: list[str] = []
    catalysts: list[str] = []
    concerns: list[str] = []

    if stockpilot_scores:
        for block in [
            stockpilot_scores.financial_health,
            stockpilot_scores.growth,
            stockpilot_scores.quality,
            stockpilot_scores.momentum,
        ]:
            if block.score is not None and block.score >= 65:
                bull.extend(block.reasons[:2])
            if block.risks:
                bear.extend(block.risks[:2])

        if stockpilot_scores.value.risks:
            concerns.extend(stockpilot_scores.value.risks[:2])
        if stockpilot_scores.risk.risks:
            risks.extend(stockpilot_scores.risk.risks[:3])

    if fund:
        if fund.revenue_growth and fund.revenue_growth > 0.1:
            growth_ops.append(f"Revenue growing at {fund.revenue_growth * 100:.1f}% (live data).")
        if fund.return_on_equity and fund.return_on_equity > 0.15:
            advantages.append("High return on equity indicates efficient capital use.")
        if fund.sector:
            advantages.append(f"Operates in {fund.sector} — {fund.industry or 'diversified'}.")
        if fund.institutional_ownership and fund.institutional_ownership > 0.6:
            catalysts.append("Strong institutional ownership may support liquidity.")
        if fund.debt_to_equity and fund.debt_to_equity > 150:
            risks.append("Leverage is elevated relative to equity base.")
        if fund.beta and fund.beta > 1.4:
            risks.append(f"Beta {fund.beta:.2f} implies above-market volatility.")

    if fair_value and fair_value.upside_percent is not None:
        if fair_value.upside_percent > 10:
            bull.append(
                f"Fair value mid-point ${fair_value.fair_value_mid:.2f} suggests "
                f"~{fair_value.upside_percent:.1f}% upside vs current price (model-based)."
            )
        elif fair_value.upside_percent < -10:
            bear.append(
                f"Model fair value mid-point implies stock may trade above estimated range."
            )
            concerns.append("Valuation models suggest limited upside at current price.")

    if technical and quote:
        if technical.sma_50 and quote.price > technical.sma_50:
            bull.append("Price above 50-day moving average — positive trend.")
        if technical.sma_200 and quote.price < technical.sma_200:
            bear.append("Price below 200-day moving average — longer-term trend weak.")

    rating = stockpilot_scores.overall.score if stockpilot_scores else None

    moat = "Narrow"
    if fund and fund.gross_margin and fund.gross_margin > 0.5:
        moat = "Wide — strong margins suggest pricing power"
    elif fund and fund.return_on_equity and fund.return_on_equity > 0.2:
        moat = "Moderate — solid profitability"

    thesis_parts = [f"{symbol} research profile based on verified live data."]
    if rating is not None:
        thesis_parts.append(f"StockPilot overall score: {rating:.0f}/100.")
    if fund and fund.name:
        thesis_parts[0] = f"{fund.name} ({symbol}) — quantitative research profile from live APIs."

    return EquityAnalystReport(
        bull_case=list(dict.fromkeys(bull))[:6] or ["Insufficient data for bull case."],
        bear_case=list(dict.fromkeys(bear))[:6] or ["Insufficient data for bear case."],
        investment_thesis=" ".join(thesis_parts),
        growth_opportunities=growth_ops[:4],
        competitive_advantages=advantages[:4],
        main_risks=risks[:5] or ["General market risk applies."],
        catalysts=catalysts[:4],
        concerns=concerns[:4],
        stockpilot_rating=rating,
        moat_assessment=moat,
    )
