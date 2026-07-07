"""Domain exceptions for market data — never mask failures with fake data."""


class MarketDataError(Exception):
    """Base error for market data operations."""

    def __init__(self, message: str, code: str = "unavailable", provider: str = "unknown"):
        self.message = message
        self.code = code
        self.provider = provider
        super().__init__(message)


class RateLimitError(MarketDataError):
    def __init__(self, message: str, provider: str):
        super().__init__(message, code="rate_limited", provider=provider)


class ProviderUnavailableError(MarketDataError):
    def __init__(self, message: str, provider: str):
        super().__init__(message, code="unavailable", provider=provider)


class SymbolNotFoundError(MarketDataError):
    def __init__(self, symbol: str, provider: str):
        super().__init__(f"Symbol '{symbol}' not found.", code="not_found", provider=provider)


class MissingApiKeyError(MarketDataError):
    def __init__(self, provider: str):
        super().__init__(
            f"API key not configured for {provider}.",
            code="missing_api_key",
            provider=provider,
        )
