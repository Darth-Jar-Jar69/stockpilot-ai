from app.schemas.market import AnalysisScores, Quote, TechnicalIndicators
from app.schemas.research import ExtendedFundamentals, ScoreBlock, StockPilotScores


def _clamp(score: float) -> float:
    return max(0.0, min(100.0, round(score, 1)))


def _score_financial_health(fund: ExtendedFundamentals | None) -> ScoreBlock:
    reasons: list[str] = []
    risks: list[str] = []
    if not fund:
        return ScoreBlock(score=None, label="Financial Health", reasons=["Data unavailable."], risks=[])

    score = 50.0
    if fund.profit_margin is not None:
        if fund.profit_margin > 0.2:
            score += 15
            reasons.append("Strong profit margins.")
        elif fund.profit_margin > 0.1:
            score += 8
            reasons.append("Healthy profit margins.")
        elif fund.profit_margin < 0:
            score -= 20
            risks.append("Company is unprofitable.")

    if fund.debt_to_equity is not None:
        if fund.debt_to_equity < 80:
            score += 12
            reasons.append("Manageable debt levels.")
        elif fund.debt_to_equity > 200:
            score -= 15
            risks.append("Elevated debt-to-equity ratio.")

    if fund.free_cash_flow is not None:
        if fund.free_cash_flow > 0:
            score += 15
            reasons.append("Positive free cash flow.")
        else:
            score -= 10
            risks.append("Negative free cash flow.")

    if fund.current_ratio is not None:
        if fund.current_ratio > 1.5:
            score += 8
            reasons.append("Solid liquidity (current ratio).")
        elif fund.current_ratio < 1:
            score -= 10
            risks.append("Liquidity may be strained.")

    if fund.operating_margin is not None and fund.operating_margin > 0.15:
        score += 5
        reasons.append("Improving operating efficiency.")

    if not reasons:
        reasons.append("Limited fundamental health signals available.")

    return ScoreBlock(score=_clamp(score), label="Financial Health", reasons=reasons, risks=risks)


def _score_growth(fund: ExtendedFundamentals | None) -> ScoreBlock:
    reasons: list[str] = []
    risks: list[str] = []
    if not fund:
        return ScoreBlock(score=None, label="Growth", reasons=["Data unavailable."], risks=[])

    score = 50.0
    if fund.revenue_growth is not None:
        if fund.revenue_growth > 0.2:
            score += 25
            reasons.append(f"Strong revenue growth ({fund.revenue_growth * 100:.1f}%).")
        elif fund.revenue_growth > 0.08:
            score += 12
            reasons.append(f"Moderate revenue growth ({fund.revenue_growth * 100:.1f}%).")
        elif fund.revenue_growth < 0:
            score -= 20
            risks.append("Revenue is declining.")

    if fund.earnings_growth is not None:
        if fund.earnings_growth > 0.15:
            score += 15
            reasons.append("Earnings growth is accelerating.")
        elif fund.earnings_growth < 0:
            score -= 10
            risks.append("Earnings growth is negative.")

    return ScoreBlock(score=_clamp(score), label="Growth", reasons=reasons or ["Growth data limited."], risks=risks)


def _score_value(fund: ExtendedFundamentals | None, quote: Quote | None) -> ScoreBlock:
    reasons: list[str] = []
    risks: list[str] = []
    if not fund:
        return ScoreBlock(score=None, label="Value", reasons=["Data unavailable."], risks=[])

    score = 50.0
    if fund.pe_ratio is not None:
        if fund.pe_ratio < 15:
            score += 20
            reasons.append(f"Attractive trailing P/E ({fund.pe_ratio:.1f}).")
        elif fund.pe_ratio > 35:
            score -= 15
            risks.append(f"High valuation (P/E {fund.pe_ratio:.1f}).")

    if fund.peg_ratio is not None:
        if fund.peg_ratio < 1.2:
            score += 15
            reasons.append(f"PEG suggests reasonable growth-adjusted value ({fund.peg_ratio:.2f}).")
        elif fund.peg_ratio > 2.5:
            score -= 10
            risks.append("PEG indicates premium valuation.")

    if fund.ev_to_ebitda is not None and fund.ev_to_ebitda < 12:
        score += 10
        reasons.append(f"EV/EBITDA ({fund.ev_to_ebitda:.1f}) is reasonable.")

    if fund.price_to_book is not None and fund.price_to_book < 3:
        score += 5
        reasons.append("Price-to-book is not excessive.")

    if quote and fund.fifty_two_week_high and fund.fifty_two_week_low:
        if quote.price >= fund.fifty_two_week_high * 0.95:
            risks.append("Trading near 52-week high.")
        if quote.price <= fund.fifty_two_week_low * 1.05:
            reasons.append("Trading near 52-week low — potential value entry.")

    return ScoreBlock(score=_clamp(score), label="Value", reasons=reasons or ["Valuation data limited."], risks=risks)


def _score_quality(fund: ExtendedFundamentals | None) -> ScoreBlock:
    reasons: list[str] = []
    risks: list[str] = []
    if not fund:
        return ScoreBlock(score=None, label="Quality", reasons=["Data unavailable."], risks=[])

    score = 50.0
    if fund.return_on_equity is not None:
        if fund.return_on_equity > 0.18:
            score += 20
            reasons.append("Excellent return on equity.")
        elif fund.return_on_equity > 0.1:
            score += 10
            reasons.append("Solid return on equity.")
        elif fund.return_on_equity < 0.05:
            score -= 10
            risks.append("Low return on equity.")

    if fund.return_on_assets is not None and fund.return_on_assets > 0.08:
        score += 10
        reasons.append("Efficient use of assets.")

    if fund.gross_margin is not None and fund.gross_margin > 0.4:
        score += 8
        reasons.append("Strong gross margins suggest pricing power.")

    if fund.institutional_ownership is not None and fund.institutional_ownership > 0.5:
        score += 5
        reasons.append("High institutional ownership.")

    return ScoreBlock(score=_clamp(score), label="Quality", reasons=reasons or ["Quality data limited."], risks=risks)


def _score_momentum(
    technical: TechnicalIndicators | None,
    scores: AnalysisScores | None,
) -> ScoreBlock:
    reasons: list[str] = []
    risks: list[str] = []
    score = scores.momentum_score if scores and scores.momentum_score is not None else 50.0

    if technical:
        if technical.rsi_14 is not None:
            if 45 <= technical.rsi_14 <= 65:
                reasons.append(f"RSI ({technical.rsi_14:.1f}) shows healthy momentum.")
            elif technical.rsi_14 > 70:
                risks.append("RSI indicates overbought momentum.")
            elif technical.rsi_14 < 35:
                reasons.append("RSI suggests oversold bounce potential.")

        if technical.macd_histogram is not None:
            if technical.macd_histogram > 0:
                score += 5
                reasons.append("MACD histogram is bullish.")
            else:
                risks.append("MACD histogram is bearish.")

    return ScoreBlock(score=_clamp(score), label="Momentum", reasons=reasons or ["Momentum data limited."], risks=risks)


def _score_risk(
    fund: ExtendedFundamentals | None,
    scores: AnalysisScores | None,
) -> ScoreBlock:
    """Higher score = lower risk (safer)."""
    reasons: list[str] = []
    risks: list[str] = []
    score = 70.0

    if fund and fund.beta is not None:
        if fund.beta < 1.0:
            score += 10
            reasons.append(f"Lower market beta ({fund.beta:.2f}).")
        elif fund.beta > 1.5:
            score -= 20
            risks.append(f"High volatility beta ({fund.beta:.2f}).")

    if scores and scores.risk_score is not None:
        score -= scores.risk_score * 0.3
        if scores.risk_score > 50:
            risks.append("Elevated price volatility.")

    if fund and fund.debt_to_equity is not None and fund.debt_to_equity > 150:
        score -= 10
        risks.append("Leverage increases downside risk.")

    return ScoreBlock(score=_clamp(score), label="Risk", reasons=reasons or ["Risk profile from live metrics."], risks=risks)


def compute_stockpilot_scores(
    fund: ExtendedFundamentals | None,
    quote: Quote | None,
    technical: TechnicalIndicators | None,
    scores: AnalysisScores | None,
) -> StockPilotScores:
    financial = _score_financial_health(fund)
    growth = _score_growth(fund)
    value = _score_value(fund, quote)
    quality = _score_quality(fund)
    momentum = _score_momentum(technical, scores)
    risk = _score_risk(fund, scores)

    parts = [s.score for s in [financial, growth, value, quality, momentum, risk] if s.score is not None]
    overall_val = sum(parts) / len(parts) if parts else None

    overall = ScoreBlock(
        score=_clamp(overall_val) if overall_val is not None else None,
        label="StockPilot Score",
        reasons=[
            f"Composite of {len(parts)} dimension scores from verified market data.",
            "Higher scores indicate stronger overall research profile — not a buy signal.",
        ],
        risks=["Scores change as live market data updates."],
    )

    return StockPilotScores(
        financial_health=financial,
        growth=growth,
        value=value,
        quality=quality,
        momentum=momentum,
        risk=risk,
        overall=overall,
    )
