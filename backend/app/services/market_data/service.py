from app.core.cache import analysis_cache, ohlcv_cache, quote_cache
from app.core.config import settings
from app.core.exceptions import MarketDataError, MissingApiKeyError
from app.core.logging import logger
from app.schemas.market import DataFreshness, DataSourceStatus, OHLCVResponse, ProviderHealth, Quote
from app.services.market_data.base import MarketDataProvider
from app.services.market_data.finnhub import FinnhubProvider
from app.services.market_data.yahoo import YahooFinanceProvider


class MarketDataService:
    """
    Orchestrates multiple providers with caching and fallback.
    NEVER returns fabricated data — surfaces errors to callers.
    """

    def __init__(self) -> None:
        self._providers: list[MarketDataProvider] = [
            FinnhubProvider(),
            YahooFinanceProvider(),
        ]

    async def get_quote(self, symbol: str, *, use_cache: bool = True) -> Quote:
        cache_key = f"quote:{symbol.upper()}"
        if use_cache:
            cached = await quote_cache.get(cache_key)
            if cached:
                cached.freshness = DataFreshness.CACHED
                return cached

        errors: list[str] = []
        for provider in self._providers:
            try:
                quote = await provider.get_quote(symbol)
                await quote_cache.set(cache_key, quote, settings.cache_ttl_quote)
                return quote
            except MissingApiKeyError as exc:
                errors.append(f"{provider.name}: {exc.message}")
                continue
            except MarketDataError as exc:
                errors.append(f"{exc.provider}: {exc.message}")
                logger.warning("Quote provider failed: %s", exc.message)
                continue

        raise MarketDataError(
            f"All providers failed for {symbol}. " + "; ".join(errors),
            code="unavailable",
        )

    async def get_ohlcv(
        self,
        symbol: str,
        period: str = "6mo",
        interval: str = "1d",
        *,
        use_cache: bool = True,
    ) -> OHLCVResponse:
        cache_key = f"ohlcv:{symbol.upper()}:{period}:{interval}"
        if use_cache:
            cached = await ohlcv_cache.get(cache_key)
            if cached:
                cached.freshness = DataFreshness.CACHED
                return cached

        errors: list[str] = []
        for provider in self._providers:
            try:
                bars = await provider.get_ohlcv(symbol, period=period, interval=interval)
                response = OHLCVResponse(
                    symbol=symbol.upper(),
                    interval=interval,
                    bars=bars,
                    provider=provider.name,
                    freshness=DataFreshness.LIVE,
                )
                await ohlcv_cache.set(cache_key, response, settings.cache_ttl_ohlcv)
                return response
            except MissingApiKeyError as exc:
                errors.append(f"{provider.name}: {exc.message}")
                continue
            except MarketDataError as exc:
                errors.append(f"{exc.provider}: {exc.message}")
                logger.warning("OHLCV provider failed: %s", exc.message)
                continue

        raise MarketDataError(
            f"All providers failed for OHLCV {symbol}. " + "; ".join(errors),
            code="unavailable",
        )

    async def provider_health(self) -> list[ProviderHealth]:
        results: list[ProviderHealth] = []
        for provider in self._providers:
            if isinstance(provider, FinnhubProvider) and not settings.finnhub_api_key:
                results.append(
                    ProviderHealth(
                        name=provider.name,
                        status=DataSourceStatus.MISSING_KEY,
                        message="Set FINNHUB_API_KEY in backend/.env",
                    )
                )
                continue

            healthy, message = await provider.health_check()
            results.append(
                ProviderHealth(
                    name=provider.name,
                    status=DataSourceStatus.OK if healthy else DataSourceStatus.UNAVAILABLE,
                    message=message,
                )
            )
        return results


market_data_service = MarketDataService()
