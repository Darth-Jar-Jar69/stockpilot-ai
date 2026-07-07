from abc import ABC, abstractmethod

from app.schemas.market import OHLCVBar, Quote


class MarketDataProvider(ABC):
    """Interface for all external market data sources."""

    name: str

    @abstractmethod
    async def get_quote(self, symbol: str) -> Quote:
        """Fetch a live or delayed quote. Must return real data or raise."""

    @abstractmethod
    async def get_ohlcv(self, symbol: str, period: str = "6mo", interval: str = "1d") -> list[OHLCVBar]:
        """Fetch historical OHLCV bars. Must return real data or raise."""

    async def health_check(self) -> tuple[bool, str | None]:
        """Return (healthy, message)."""
        return True, None
