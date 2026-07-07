"""Build human-readable explanations from real computed scores — no invented data."""

from app.schemas.fundamentals import AnalysisExplanation, Fundamentals
from app.schemas.market import AnalysisScores, Quote, TechnicalIndicators


def build_explanation(
    symbol: str,
    quote: Quote | None,
    technical: TechnicalIndicators | None,
    fundamentals: Fundamentals | None,
    scores: AnalysisScores | None,
) -> AnalysisExplanation:
    reasons: list[str] = []
    risks: list[str] = []
    data_points = sum(1 for x in [quote, technical, fundamentals, scores] if x is not None)
    confidence = round(data_points / 4, 2)

    if quote:
        direction = "up" if (quote.change or 0) >= 0 else "down"
        reasons.append(
            f"Live price ${quote.price:.2f} ({direction} {quote.change_percent or 0:.2f}% today) "
            f"via {quote.provider}."
        )

    if technical:
        if technical.rsi_14 is not None:
            if technical.rsi_14 > 70:
                reasons.append(f"RSI at {technical.rsi_14:.1f} suggests overbought conditions.")
                risks.append("Momentum may reverse if RSI remains elevated.")
            elif technical.rsi_14 < 30:
                reasons.append(f"RSI at {technical.rsi_14:.1f} suggests oversold conditions.")
            else:
                reasons.append(f"RSI at {technical.rsi_14:.1f} is in neutral territory.")

        if technical.macd_histogram is not None:
            trend = "bullish" if technical.macd_histogram > 0 else "bearish"
            reasons.append(f"MACD histogram is {trend} ({technical.macd_histogram:.4f}).")

        if technical.sma_50 is not None and quote:
            above = quote.price > technical.sma_50
            reasons.append(
                f"Price is {'above' if above else 'below'} the 50-day SMA (${technical.sma_50:.2f})."
            )

    if fundamentals:
        if fundamentals.pe_ratio is not None:
            reasons.append(f"Trailing P/E ratio is {fundamentals.pe_ratio:.2f}.")
        if fundamentals.eps is not None:
            reasons.append(f"EPS (trailing) is ${fundamentals.eps:.2f}.")
        if fundamentals.sector:
            reasons.append(f"Sector: {fundamentals.sector}.")

    if scores:
        if scores.risk_score is not None and scores.risk_score > 60:
            risks.append(f"Elevated volatility risk score ({scores.risk_score:.0f}/100).")

    # Overall rating from average of available scores
    available = [s for s in [scores.technical_score, scores.momentum_score] if s is not None] if scores else []
    avg = sum(available) / len(available) if available else 50

    if avg >= 65:
        rating = "Moderate Opportunity"
    elif avg >= 45:
        rating = "Neutral"
    else:
        rating = "Cautious"

    thesis = (
        f"{symbol} shows a {rating.lower()} profile based on real market data. "
        f"Technical and fundamental inputs are derived from live APIs — not guaranteed outcomes."
    )

    if not reasons:
        reasons.append("Limited data available for this symbol. Verify API connectivity.")

    return AnalysisExplanation(
        overall_rating=rating,
        investment_thesis=thesis,
        reasons=reasons,
        potential_risks=risks or ["Market conditions can change rapidly; always verify data."],
        confidence=confidence,
    )
