from datetime import datetime, timezone

from app.core.cache import intelligence_cache
from app.core.exceptions import MarketDataError
from app.schemas.research import IndexSnapshot, MarketBriefing, MarketIntelligence, SectorPerformance
from app.services.market_data.service import market_data_service

INDEX_SYMBOLS = [
    ("^GSPC", "S&P 500"),
    ("^IXIC", "NASDAQ"),
    ("^DJI", "Dow Jones"),
    ("^VIX", "VIX"),
]

# Sector ETFs — one quote each, much faster than full scanner
SECTOR_ETFS = [
    ("XLK", "Technology"),
    ("XLF", "Financials"),
    ("XLE", "Energy"),
    ("XLV", "Health Care"),
    ("XLY", "Consumer Disc."),
    ("XLP", "Consumer Staples"),
    ("XLI", "Industrials"),
    ("XLU", "Utilities"),
]

CACHE_KEY = "market_intelligence"
CACHE_TTL = 120


class MarketIntelligenceService:
    async def get_market_overview(self) -> MarketIntelligence:
        cached = await intelligence_cache.get(CACHE_KEY)
        if cached is not None:
            return cached

        indices: list[IndexSnapshot] = []
        for sym, name in INDEX_SYMBOLS:
            try:
                q = await market_data_service.get_quote(sym)
                indices.append(
                    IndexSnapshot(
                        symbol=sym,
                        name=name,
                        price=q.price,
                        change_percent=q.change_percent,
                    )
                )
            except MarketDataError:
                indices.append(IndexSnapshot(symbol=sym, name=name))

        sectors: list[SectorPerformance] = []
        for sym, sector in SECTOR_ETFS:
            try:
                q = await market_data_service.get_quote(sym)
                sectors.append(
                    SectorPerformance(
                        sector=sector,
                        avg_change_percent=q.change_percent,
                        symbol_count=1,
                    )
                )
            except MarketDataError:
                sectors.append(SectorPerformance(sector=sector, symbol_count=0))

        sectors.sort(
            key=lambda s: s.avg_change_percent if s.avg_change_percent is not None else -999,
            reverse=True,
        )

        avg_change = (
            sum(i.change_percent for i in indices if i.change_percent is not None)
            / max(1, sum(1 for i in indices if i.change_percent is not None))
        )
        if avg_change > 0.5:
            sentiment = "Risk-on"
            headline = "Markets trending higher"
        elif avg_change < -0.5:
            sentiment = "Risk-off"
            headline = "Markets under pressure"
        else:
            sentiment = "Mixed"
            headline = "Markets mixed in today's session"

        briefing = MarketBriefing(
            headline=headline,
            summary=(
                f"Live index snapshot shows {sentiment.lower()} sentiment. "
                f"Sector leadership: {sectors[0].sector if sectors else 'large-cap names'}."
            ),
            sentiment=sentiment,
            key_points=[
                f"{idx.name}: {idx.change_percent or 0:.2f}% today"
                for idx in indices[:3]
                if idx.change_percent is not None
            ],
            as_of=datetime.now(timezone.utc),
        )

        result = MarketIntelligence(
            indices=indices,
            sector_performance=sectors[:8],
            briefing=briefing,
            disclaimer="Market briefing from live delayed data — not financial advice.",
        )
        await intelligence_cache.set(CACHE_KEY, result, CACHE_TTL)
        return result


market_intelligence_service = MarketIntelligenceService()
