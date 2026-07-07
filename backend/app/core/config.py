from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "StockPilot"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    cors_origins: str = "http://localhost:3000"

    # Market data API keys — never expose to frontend
    finnhub_api_key: str = ""
    alpha_vantage_api_key: str = ""
    fmp_api_key: str = ""
    polygon_api_key: str = ""
    news_api_key: str = ""
    fred_api_key: str = ""

    # AI assistant
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Cache TTL (seconds)
    cache_ttl_quote: int = 30
    cache_ttl_ohlcv: int = 300
    cache_ttl_fundamentals: int = 3600

    # HTTP client
    http_timeout: float = 15.0
    http_max_retries: int = 3

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
