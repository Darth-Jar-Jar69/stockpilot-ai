"""Scanner AI reasoning, recommendations, and filter matching."""

from app.schemas.scanner import ScanResult
from app.services.scanner.symbol_names import SYMBOL_NAMES


def company_name(symbol: str) -> str | None:
    return SYMBOL_NAMES.get(symbol.upper())


def stockpilot_score(
    technical: float | None,
    momentum: float | None,
    risk: float | None,
    confidence: float | None,
) -> float:
    """Composite 0–100 StockPilot score for ranking."""
    tech = technical or 50
    mom = momentum or 50
    rsk = risk or 50
    conf = (confidence or 0.5) * 100
    raw = tech * 0.32 + mom * 0.32 + (100 - rsk) * 0.18 + conf * 0.18
    return round(min(100.0, max(0.0, raw)), 1)


def predict_price_target(
    price: float | None,
    technical: float | None,
    momentum: float | None,
    risk: float | None,
    horizon: str | None = None,
) -> tuple[float | None, float | None]:
    """Model-based price target from technical/momentum scores (research only)."""
    if price is None or price <= 0:
        return None, None

    tech = technical or 50
    mom = momentum or 50
    rsk = risk or 50
    h = (horizon or "medium").lower().replace("_", "-")

    if "short" in h:
        horizon_days = 10
    elif "long" in h:
        horizon_days = 180
    else:
        horizon_days = 60

    edge = (tech * 0.35 + mom * 0.45 - rsk * 0.15 - 50) / 50
    daily_drift = edge * 0.0012
    expected_pct = daily_drift * horizon_days * 100
    predicted = price * (1 + expected_pct / 100)
    return round(predicted, 2), round(expected_pct, 2)


def recommendation_badge(
    technical: float | None,
    momentum: float | None,
    risk: float | None,
) -> str:
    tech = technical or 50
    mom = momentum or 50
    rsk = risk or 50
    score = tech * 0.4 + mom * 0.4 - rsk * 0.2
    if score >= 72:
        return "Strong Buy"
    if score >= 58:
        return "Buy"
    if score >= 42:
        return "Hold"
    if score >= 28:
        return "Sell"
    return "Strong Sell"


def confidence_score(
    technical: float | None,
    momentum: float | None,
    risk: float | None,
    has_fundamentals: bool,
) -> float:
    parts = [s for s in [technical, momentum, risk] if s is not None]
    base = len(parts) / 3 * 0.7
    if has_fundamentals:
        base += 0.2
    return round(min(0.95, max(0.35, base + 0.1)), 2)


def matches_investment_horizon(result: ScanResult, horizon: str | None) -> bool:
    if not horizon:
        return True
    mom = result.momentum_score or 50
    risk = result.risk_score or 50
    tech = result.technical_score or 50
    h = horizon.lower()
    if h in ("long", "long-term", "long_term"):
        return risk < 55 and tech >= 40
    if h in ("short", "short-term", "short_term"):
        return mom >= 45
    if h in ("medium", "medium-term", "medium_term"):
        return 32 <= risk <= 68
    return True


def matches_risk_level(result: ScanResult, level: str | None) -> bool:
    if not level:
        return True
    risk = result.risk_score or 50
    lv = level.lower().replace(" ", "_")
    if lv in ("low", "low_risk"):
        return risk < 45
    if lv in ("high", "high_risk"):
        return risk >= 48
    if lv in ("medium", "medium_risk"):
        return 32 <= risk < 68
    return True


def build_ai_reasoning(
    result: ScanResult,
    horizon: str | None,
    risk_level: str | None,
) -> str:
    parts: list[str] = []
    name = company_name(result.symbol) or result.symbol
    badge = result.recommendation or recommendation_badge(
        result.technical_score, result.momentum_score, result.risk_score
    )
    parts.append(f"{name} ({result.symbol}) aligns with a **{badge}** AI outlook.")

    if horizon:
        h = horizon.replace("_", "-")
        if matches_investment_horizon(result, horizon):
            parts.append(f"Fits **{h}** horizon: momentum {result.momentum_score or '—'}/100, risk {result.risk_score or '—'}/100.")
        else:
            parts.append(f"Partial {h} horizon fit — review metrics before acting.")

    if risk_level:
        rl = risk_level.replace("_", " ")
        if matches_risk_level(result, risk_level):
            parts.append(f"Matches **{rl}** risk profile (volatility score {result.risk_score or '—'}).")

    if result.change_percent is not None:
        direction = "up" if result.change_percent >= 0 else "down"
        parts.append(f"Trading {direction} {abs(result.change_percent):.2f}% today on live data.")

    if result.pe_ratio is not None:
        parts.append(f"Trailing P/E {result.pe_ratio:.1f}.")

    if result.predicted_price is not None and result.predicted_change_percent is not None:
        direction = "upside" if result.predicted_change_percent >= 0 else "downside"
        parts.append(
            f"AI model target ${result.predicted_price:.2f} "
            f"({result.predicted_change_percent:+.1f}% {direction} vs current)."
        )

    return " ".join(parts)
