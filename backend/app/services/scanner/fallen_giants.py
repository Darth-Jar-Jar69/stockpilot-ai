"""Fallen Giants scanner — large-cap event-driven drawdown recovery candidates."""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from app.core.cache import TTLCache
from app.core.config import settings
from app.core.exceptions import MarketDataError
from app.schemas.fallen_giants import (
    CatalystType,
    FallenGiantCandidate,
    FallenGiantSource,
    FallenGiantsFilters,
    FallenGiantsResponse,
)
from app.services.fundamentals.extended import fetch_extended_fundamentals
from app.services.market_data.service import market_data_service
from app.services.market_data.yahoo import YahooFinanceProvider
from app.services.scanner.symbol_names import SYMBOL_NAMES
from app.services.scanner.universe import SCANNER_UNIVERSE

logger = logging.getLogger("stockpilot.fallen_giants")

_CONCURRENCY = 6
_yahoo = YahooFinanceProvider()
_cache: TTLCache[FallenGiantsResponse] = TTLCache()

# Prefer liquid mega/large names first for faster, higher-quality scans
_PRIORITY: tuple[str, ...] = (
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "CRM",
    "AMD", "INTC", "NFLX", "DIS", "JPM", "V", "MA", "BAC", "WFC", "GS", "UNH", "JNJ",
    "LLY", "MRK", "ABBV", "PFE", "XOM", "CVX", "WMT", "COST", "HD", "PG", "KO", "PEP",
    "NKE", "SBUX", "MCD", "BA", "CAT", "GE", "HON", "RTX", "LMT", "UPS", "FDX",
    "ASML", "TSM", "SAP", "NVO", "UL", "SHEL", "BP", "TM", "RACE", "STLA", "BABA",
    "SONY", "SHOP", "MELI", "BUD", "DEO", "AZN", "GSK", "SNY", "HSBC", "RY", "TD",
    "BHP", "RIO", "VALE", "ENB", "IBM", "CSCO", "QCOM", "TXN", "AMAT", "MU", "ARM",
    "PLTR", "COIN", "UBER", "ABNB", "BKNG", "CMG", "LULU", "TGT", "LOW", "SNOW",
    "CRWD", "PANW", "NOW", "ADBE", "INTU", "BLK", "SPGI", "AXP", "C", "MS",
)

_CATALYST_PATTERNS: list[tuple[CatalystType, re.Pattern[str], str]] = [
    ("earnings_miss", re.compile(r"earnings\s+miss|missed\s+estimates|below\s+expectations|eps\s+miss", re.I), "Earnings miss"),
    ("guidance_cut", re.compile(r"cut\s+guidance|lower(ed|s)?\s+outlook|guidance\s+cut|reduced\s+forecast", re.I), "Guidance cut"),
    ("regulatory", re.compile(r"\bSEC\b|FDA|regulator|antitrust|probe|investigation|doj\b", re.I), "Regulatory action"),
    ("lawsuit", re.compile(r"lawsuit|litigation|sued|class\s+action|settlement", re.I), "Lawsuit / legal risk"),
    ("product_failure", re.compile(r"recall|product\s+fail|safety\s+issue|defect|cyberattack|outage|breach", re.I), "Product / operational failure"),
    ("management_change", re.compile(r"CEO\s+(resign|step|depart)|CFO\s+(resign|step)|management\s+shakeup|fired\s+CEO", re.I), "Management change"),
    ("government_action", re.compile(r"ban|tariff|sanction|government\s+order|executive\s+order|export\s+restrict", re.I), "Government action"),
    ("contract_loss", re.compile(r"lost\s+contract|contract\s+cancel|loses?\s+deal|customer\s+loss", re.I), "Major contract loss"),
    ("financial_warning", re.compile(r"profit\s+warning|going\s+concern|liquidity\s+crunch|debt\s+concern|writedown|impairment", re.I), "Financial warning"),
]


@dataclass
class _Drawdown:
    peak_price: float
    trough_price: float
    peak_date: datetime
    trough_date: datetime
    decline_pct: float
    selloff_days: int
    current_price: float
    recovered_pct: float


def _company_name(symbol: str, fallback: str | None = None) -> str | None:
    return SYMBOL_NAMES.get(symbol.upper()) or fallback


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _find_drawdown(bars, lookback_days: int, min_decline: float) -> _Drawdown | None:
    if len(bars) < 15:
        return None

    cutoff = bars[-1].timestamp - timedelta(days=lookback_days)
    window = [b for b in bars if b.timestamp >= cutoff]
    if len(window) < 8:
        window = bars[-max(20, lookback_days // 2) :]

    best: _Drawdown | None = None
    for i, peak_bar in enumerate(window[:-1]):
        peak = peak_bar.high
        if peak <= 0:
            continue
        trough_price = peak
        trough_idx = i
        for j in range(i + 1, len(window)):
            low = window[j].low
            if low < trough_price:
                trough_price = low
                trough_idx = j
        if trough_price <= 0 or trough_price >= peak:
            continue
        decline = (peak - trough_price) / peak * 100
        if decline < min_decline:
            continue
        selloff_days = max(1, (window[trough_idx].timestamp - peak_bar.timestamp).days)
        current = bars[-1].close
        denom = peak - trough_price
        recovered = ((current - trough_price) / denom * 100) if denom > 0 else 0.0
        recovered = _clamp(recovered, 0.0, 150.0)
        candidate = _Drawdown(
            peak_price=round(peak, 4),
            trough_price=round(trough_price, 4),
            peak_date=peak_bar.timestamp,
            trough_date=window[trough_idx].timestamp,
            decline_pct=round(decline, 2),
            selloff_days=selloff_days,
            current_price=round(current, 4),
            recovered_pct=round(recovered, 2),
        )
        if best is None or candidate.decline_pct > best.decline_pct:
            best = candidate
    return best


def _spy_decline_over(bars, start: datetime, end: datetime) -> float | None:
    if not bars:
        return None
    pre = [b for b in bars if b.timestamp <= start]
    post = [b for b in bars if start <= b.timestamp <= end]
    if not pre or not post:
        return None
    peak = pre[-1].close
    trough = min(b.low for b in post)
    if peak <= 0:
        return None
    return round((peak - trough) / peak * 100, 2)


def _classify_catalyst(text: str) -> tuple[CatalystType, str]:
    for ctype, pattern, label in _CATALYST_PATTERNS:
        if pattern.search(text):
            return ctype, label
    return "unclear", "Company-specific selloff (catalyst unclear from headlines)"


async def _fetch_finnhub_news(symbol: str, start: datetime, end: datetime) -> list[FallenGiantSource]:
    if not settings.finnhub_api_key:
        return []
    try:
        params = {
            "symbol": symbol.upper(),
            "from": start.strftime("%Y-%m-%d"),
            "to": end.strftime("%Y-%m-%d"),
            "token": settings.finnhub_api_key,
        }
        async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
            res = await client.get("https://finnhub.io/api/v1/company-news", params=params)
            if res.status_code != 200:
                return []
            items = res.json()
        sources: list[FallenGiantSource] = []
        for item in items[:8]:
            published = None
            if item.get("datetime"):
                published = datetime.fromtimestamp(item["datetime"], tz=timezone.utc)
            sources.append(
                FallenGiantSource(
                    title=item.get("headline") or "Untitled",
                    source=item.get("source"),
                    url=item.get("url"),
                    published_at=published,
                )
            )
        return sources
    except Exception as exc:
        logger.debug("Finnhub news failed for %s: %s", symbol, exc)
        return []


async def _fetch_newsapi(symbol: str) -> list[FallenGiantSource]:
    if not settings.news_api_key:
        return []
    try:
        params = {
            "apiKey": settings.news_api_key,
            "q": f"{symbol} stock",
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 6,
        }
        async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
            res = await client.get("https://newsapi.org/v2/everything", params=params)
            if res.status_code != 200:
                return []
            articles = res.json().get("articles", [])
        out: list[FallenGiantSource] = []
        for item in articles[:6]:
            published = None
            if item.get("publishedAt"):
                try:
                    published = datetime.fromisoformat(item["publishedAt"].replace("Z", "+00:00"))
                except ValueError:
                    published = None
            out.append(
                FallenGiantSource(
                    title=item.get("title") or "Untitled",
                    source=(item.get("source") or {}).get("name"),
                    url=item.get("url"),
                    published_at=published,
                )
            )
        return out
    except Exception as exc:
        logger.debug("NewsAPI failed for %s: %s", symbol, exc)
        return []


def _score_fundamentals(fund) -> tuple[float, float, float]:
    """Return (fundamental_health 0-100, valuation 0-100, structural_risk 0-100)."""
    health = 50.0
    valuation = 50.0
    risk = 40.0

    if fund is None:
        return 45.0, 45.0, 55.0

    # Health
    if fund.revenue_growth is not None:
        health += _clamp(fund.revenue_growth * 100, -15, 15)
    if fund.earnings_growth is not None:
        health += _clamp(fund.earnings_growth * 80, -12, 12)
    if fund.operating_margin is not None:
        health += _clamp(fund.operating_margin * 40, -10, 12)
    if fund.free_cash_flow is not None:
        health += 8 if fund.free_cash_flow > 0 else -12
    if fund.return_on_equity is not None:
        health += _clamp(fund.return_on_equity * 30, -8, 10)
    if fund.current_ratio is not None:
        if fund.current_ratio >= 1.2:
            health += 5
        elif fund.current_ratio < 0.9:
            health -= 8

    # Valuation (lower PE / reasonable PEG better for recovery setups)
    if fund.pe_ratio is not None and fund.pe_ratio > 0:
        if fund.pe_ratio < 15:
            valuation += 15
        elif fund.pe_ratio < 25:
            valuation += 8
        elif fund.pe_ratio > 45:
            valuation -= 12
        elif fund.pe_ratio > 35:
            valuation -= 6
    if fund.forward_pe is not None and fund.pe_ratio and fund.forward_pe < fund.pe_ratio:
        valuation += 6
    if fund.peg_ratio is not None and 0 < fund.peg_ratio < 1.5:
        valuation += 8
    elif fund.peg_ratio is not None and fund.peg_ratio > 3:
        valuation -= 8
    if fund.price_to_book is not None and 0 < fund.price_to_book < 3:
        valuation += 5

    # Risk (higher = more dangerous)
    if fund.debt_to_equity is not None:
        if fund.debt_to_equity > 200:
            risk += 25
        elif fund.debt_to_equity > 100:
            risk += 12
        elif fund.debt_to_equity < 40:
            risk -= 8
    if fund.total_cash is not None and fund.total_debt is not None:
        if fund.total_cash > fund.total_debt:
            risk -= 10
        elif fund.total_debt > fund.total_cash * 3:
            risk += 12
    if fund.profit_margin is not None and fund.profit_margin < 0:
        risk += 15
        health -= 10
    if fund.beta is not None and fund.beta > 1.6:
        risk += 8

    return (
        round(_clamp(health, 0, 100), 1),
        round(_clamp(valuation, 0, 100), 1),
        round(_clamp(risk, 0, 100), 1),
    )


def _build_narratives(
    *,
    company: str,
    decline: float,
    recovered: float,
    catalyst_label: str,
    catalyst_type: CatalystType,
    fund,
    health: float,
    risk: float,
    relative_spy: float | None,
    sources: list[FallenGiantSource],
) -> tuple[str, str, str, list[str]]:
    source_bits = []
    for s in sources[:3]:
        bit = s.title
        if s.source:
            bit += f" ({s.source})"
        source_bits.append(bit)
    source_line = "; ".join(source_bits) if source_bits else "Headline coverage around the selloff window"

    why_fell = (
        f"{company} fell about {decline:.1f}% from its recent peak amid a "
        f"{catalyst_label.lower()}. Key coverage: {source_line}."
    )
    if relative_spy is not None and decline > relative_spy + 5:
        why_fell += f" The move was larger than the S&P 500 drawdown (~{relative_spy:.1f}%) over a similar window."

    recover_bits = []
    if health >= 60:
        recover_bits.append("financial metrics still score in healthy territory")
    if fund and fund.free_cash_flow and fund.free_cash_flow > 0:
        recover_bits.append("positive free cash flow")
    if fund and fund.revenue_growth and fund.revenue_growth > 0:
        recover_bits.append(f"revenue growth near {fund.revenue_growth * 100:.1f}%")
    if fund and fund.operating_margin and fund.operating_margin > 0.1:
        recover_bits.append("solid operating margins")
    if recovered < 50:
        recover_bits.append(f"only ~{recovered:.0f}% of the decline has been retraced so far")
    if not recover_bits:
        recover_bits.append("the selloff may partly reflect sentiment rather than fully measured fundamentals")
    why_recover = (
        f"Potential recovery case: {', '.join(recover_bits)}. "
        "This is a research hypothesis, not a prediction of price recovery."
    )

    bear_bits = []
    if catalyst_type in {"regulatory", "lawsuit", "government_action", "financial_warning"}:
        bear_bits.append("the catalyst may imply lasting franchise or legal damage")
    if risk >= 65:
        bear_bits.append("elevated balance-sheet / business-risk metrics")
    if fund and fund.revenue_growth is not None and fund.revenue_growth < 0:
        bear_bits.append("contracting revenue")
    if fund and fund.profit_margin is not None and fund.profit_margin < 0:
        bear_bits.append("negative profitability")
    if not bear_bits:
        bear_bits.append("the market may be correctly pricing a weaker growth or margin outlook")
    why_not = f"Bear case: {'; '.join(bear_bits)}. A large crash alone does not imply mispricing."

    confirms = [
        "Next earnings report and guidance tone",
        "Management commentary on the specific catalyst",
        "Stabilization of revenue / margin trends vs peers",
    ]
    if catalyst_type == "regulatory":
        confirms.append("Regulatory decision or investigation update")
    if catalyst_type == "product_failure":
        confirms.append("Product remediation, recall progress, or relaunch milestones")
    if catalyst_type == "management_change":
        confirms.append("New leadership plan and operating KPIs")
    if catalyst_type in {"earnings_miss", "guidance_cut"}:
        confirms.append("Subsequent guidance revisions and estimate revisions")

    return why_fell, why_recover, why_not, confirms


class FallenGiantsService:
    async def scan(self, filters: FallenGiantsFilters) -> FallenGiantsResponse:
        cache_key = f"fallen:{filters.model_dump_json()}"
        cached = await _cache.get(cache_key)
        if cached:
            return cached

        lookback = filters.max_days_since_crash or 90
        scan_list = list(dict.fromkeys(_PRIORITY))[:40]

        spy_bars = []
        try:
            spy = await market_data_service.get_ohlcv("SPY", period="6mo", interval="1d")
            spy_bars = spy.bars
        except MarketDataError:
            logger.warning("SPY OHLCV unavailable for relative decline")

        sem = asyncio.Semaphore(_CONCURRENCY)

        @dataclass
        class _Hit:
            symbol: str
            provider: str
            mcap: float | None
            dd: _Drawdown
            relative: float | None

        async def phase1(symbol: str) -> _Hit | None:
            """Fast pass: Yahoo quote + OHLCV drawdown (avoids Finnhub rate limits)."""
            async with sem:
                try:
                    quote = await asyncio.wait_for(_yahoo.get_quote(symbol), timeout=12)
                    bars = await asyncio.wait_for(
                        _yahoo.get_ohlcv(symbol, period="6mo", interval="1d"),
                        timeout=15,
                    )
                    dd = _find_drawdown(bars, lookback, filters.min_decline)
                    if dd is None:
                        return None
                    relative = _spy_decline_over(spy_bars, dd.peak_date, dd.trough_date)
                    return _Hit(
                        symbol=symbol,
                        provider=quote.provider,
                        mcap=quote.market_cap,
                        dd=dd,
                        relative=relative,
                    )
                except Exception as exc:
                    logger.debug("Fallen Giants phase1 skip %s: %s", symbol, exc)
                    return None

        hits = [h for h in await asyncio.gather(*(phase1(s) for s in scan_list)) if h]
        hits.sort(key=lambda h: h.dd.decline_pct, reverse=True)
        enrich_budget = max(filters.limit, 10)
        shortlist = hits[:enrich_budget]

        async def phase2(hit: _Hit) -> FallenGiantCandidate | None:
            """Enrich only shortlisted drawdowns with news + fundamentals."""
            async with sem:
                try:
                    symbol = hit.symbol
                    dd = hit.dd
                    mcap = hit.mcap

                    fund = None
                    try:
                        fund = await asyncio.wait_for(
                            fetch_extended_fundamentals(symbol),
                            timeout=8,
                        )
                    except (MarketDataError, asyncio.TimeoutError, Exception):
                        pass

                    if mcap is None and fund and fund.shares_outstanding and dd.current_price:
                        mcap = fund.shares_outstanding * dd.current_price
                    if mcap is None and fund and fund.enterprise_value:
                        mcap = fund.enterprise_value
                    if filters.min_market_cap and mcap is not None and mcap < filters.min_market_cap:
                        return None
                    if mcap is None and symbol not in _PRIORITY:
                        return None

                    news_start = dd.peak_date - timedelta(days=3)
                    news_end = dd.trough_date + timedelta(days=5)
                    sources: list[FallenGiantSource] = []
                    try:
                        sources = await asyncio.wait_for(
                            _fetch_finnhub_news(symbol, news_start, news_end),
                            timeout=6,
                        )
                    except Exception:
                        sources = []
                    if not sources:
                        try:
                            sources = await asyncio.wait_for(_fetch_newsapi(symbol), timeout=6)
                        except Exception:
                            sources = []

                    blob = " ".join(f"{s.title} {s.source or ''}" for s in sources)
                    catalyst_type, catalyst_label = _classify_catalyst(blob)
                    if sources:
                        best_src = min(
                            sources,
                            key=lambda s: abs(
                                (s.published_at or dd.trough_date) - dd.trough_date
                            ).total_seconds()
                            if s.published_at
                            else 10**12,
                        )
                        catalyst_text = best_src.title
                    else:
                        catalyst_text = catalyst_label

                    health, valuation, risk = _score_fundamentals(fund)

                    clarity = 4.0
                    if sources:
                        clarity += 6
                    if catalyst_type != "unclear":
                        clarity += 5
                    clarity = _clamp(clarity, 0, 15)

                    dislocation = _clamp((dd.decline_pct - filters.min_decline) / 2.0, 0, 12)
                    if dd.selloff_days <= 3:
                        dislocation += 6
                    elif dd.selloff_days <= 10:
                        dislocation += 3
                    if hit.relative is not None and dd.decline_pct > hit.relative + 8:
                        dislocation += 2
                    dislocation = _clamp(dislocation, 0, 20)

                    recovery = 0.0
                    if dd.recovered_pct < 35:
                        recovery += 10
                    elif dd.recovered_pct < 60:
                        recovery += 6
                    elif dd.recovered_pct < 85:
                        recovery += 3
                    else:
                        recovery += 1
                    recovery += _clamp((health - 50) / 5, -4, 6)
                    if catalyst_type in {"earnings_miss", "guidance_cut", "other"} and health >= 55:
                        recovery += 3
                    if catalyst_type in {"regulatory", "lawsuit", "financial_warning"}:
                        recovery -= 4
                    recovery = _clamp(recovery, 0, 20)

                    fund_points = health * 0.25
                    val_points = valuation * 0.10
                    risk_points = (100 - risk) * 0.10
                    total = clarity + dislocation + fund_points + recovery + val_points + risk_points
                    if catalyst_type in {"financial_warning", "regulatory"} and risk >= 70:
                        total *= 0.75
                    if health < 35:
                        total *= 0.7
                    total = round(_clamp(total, 0, 100), 1)

                    company = _company_name(symbol, fund.name if fund else None) or symbol
                    why_fell, why_recover, why_not, confirms = _build_narratives(
                        company=company,
                        decline=dd.decline_pct,
                        recovered=dd.recovered_pct,
                        catalyst_label=catalyst_label,
                        catalyst_type=catalyst_type,
                        fund=fund,
                        health=health,
                        risk=risk,
                        relative_spy=hit.relative,
                        sources=sources,
                    )

                    warnings: list[str] = []
                    if not sources:
                        warnings.append(
                            "No catalyst headlines found near the selloff window — clarity reduced."
                        )
                    if mcap is None:
                        warnings.append("Market cap unavailable from quote providers.")

                    days_since = max(0, (datetime.now(timezone.utc) - dd.trough_date).days)

                    return FallenGiantCandidate(
                        symbol=symbol,
                        company_name=company,
                        market_cap=mcap,
                        current_price=dd.current_price,
                        pre_catalyst_price=dd.peak_price,
                        lowest_price_after_catalyst=dd.trough_price,
                        decline_percent=dd.decline_pct,
                        recovered_percent=dd.recovered_pct,
                        catalyst=catalyst_text,
                        catalyst_type=catalyst_type,
                        catalyst_date=dd.trough_date,
                        fundamental_health_score=health,
                        valuation_score=round(valuation, 1),
                        recovery_score=round(recovery / 20 * 100, 1),
                        risk_score=round(risk, 1),
                        catalyst_clarity_score=round(clarity, 1),
                        price_dislocation_score=round(dislocation, 1),
                        fallen_giants_score=total,
                        why_it_fell=why_fell,
                        why_it_could_recover=why_recover,
                        why_it_might_not_recover=why_not,
                        recovery_confirmations=confirms,
                        sources=sources[:5],
                        sector=fund.sector if fund else None,
                        relative_to_spy_decline=hit.relative,
                        days_since_catalyst=days_since,
                        selloff_days=dd.selloff_days,
                        provider=hit.provider,
                        data_warnings=warnings,
                    )
                except Exception as exc:
                    logger.debug("Fallen Giants phase2 skip %s: %s", hit.symbol, exc)
                    return None

        candidates = [r for r in await asyncio.gather(*(phase2(h) for h in shortlist)) if r]

        filtered: list[FallenGiantCandidate] = []
        for item in candidates:
            if filters.catalyst_type and item.catalyst_type != filters.catalyst_type:
                continue
            if filters.min_recovery_score is not None and (
                item.recovery_score is None or item.recovery_score < filters.min_recovery_score
            ):
                continue
            if filters.min_fundamental_score is not None and (
                item.fundamental_health_score is None
                or item.fundamental_health_score < filters.min_fundamental_score
            ):
                continue
            if filters.risk:
                rs = item.risk_score or 50
                if filters.risk == "low" and rs > 45:
                    continue
                if filters.risk == "medium" and (rs < 35 or rs > 70):
                    continue
                if filters.risk == "high" and rs < 55:
                    continue
            if filters.max_days_since_crash and item.days_since_catalyst is not None:
                if item.days_since_catalyst > filters.max_days_since_crash:
                    continue
            filtered.append(item)

        sort_key = filters.sort_by
        filtered.sort(
            key=lambda x: (getattr(x, sort_key) is not None, getattr(x, sort_key) or 0),
            reverse=True,
        )
        ranked = filtered[: filters.limit]

        applied: dict[str, str | float | int | bool] = {
            "min_decline": filters.min_decline,
            "sort_by": filters.sort_by,
            "scanned": len(scan_list),
            "drawdowns_found": len(hits),
            "candidates": len(candidates),
            "returned": len(ranked),
        }
        if filters.min_market_cap is not None:
            applied["min_market_cap"] = filters.min_market_cap
        if filters.risk:
            applied["risk"] = filters.risk
        if filters.catalyst_type:
            applied["catalyst_type"] = filters.catalyst_type
        if filters.max_days_since_crash:
            applied["max_days_since_crash"] = filters.max_days_since_crash

        response = FallenGiantsResponse(
            results=ranked,
            universe_size=len(scan_list),
            filters_applied=applied,
        )
        await _cache.set(cache_key, response, 600)
        return response


fallen_giants_service = FallenGiantsService()
