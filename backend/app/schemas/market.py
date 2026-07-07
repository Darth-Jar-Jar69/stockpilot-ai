from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.fundamentals import AnalysisExplanation, Fundamentals


class DataFreshness(str, Enum):
    LIVE = "live"
    CACHED = "cached"
    DELAYED = "delayed"


class DataSourceStatus(str, Enum):
    OK = "ok"
    RATE_LIMITED = "rate_limited"
    MISSING_KEY = "missing_key"
    UNAVAILABLE = "unavailable"


class ProviderHealth(BaseModel):
    name: str
    status: DataSourceStatus
    message: str | None = None


class Quote(BaseModel):
    symbol: str
    price: float
    change: float | None = None
    change_percent: float | None = None
    currency: str = "USD"
    market_cap: float | None = None
    volume: int | None = None
    previous_close: float | None = None
    provider: str
    freshness: DataFreshness
    as_of: datetime


class OHLCVBar(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


class OHLCVResponse(BaseModel):
    symbol: str
    interval: str
    bars: list[OHLCVBar]
    provider: str
    freshness: DataFreshness


class TechnicalIndicators(BaseModel):
    symbol: str
    rsi_14: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_histogram: float | None = None
    ema_12: float | None = None
    ema_26: float | None = None
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    atr_14: float | None = None
    vwap: float | None = None
    bb_upper: float | None = None
    bb_middle: float | None = None
    bb_lower: float | None = None
    adx_14: float | None = None
    provider: str
    computed_at: datetime
    data_points: int = Field(description="Number of OHLCV bars used in calculation")


class AnalysisScores(BaseModel):
    technical_score: float | None = Field(None, ge=0, le=100)
    momentum_score: float | None = Field(None, ge=0, le=100)
    risk_score: float | None = Field(None, ge=0, le=100)


class SymbolAnalysis(BaseModel):
    symbol: str
    quote: Quote | None = None
    fundamentals: Fundamentals | None = None
    technical: TechnicalIndicators | None = None
    scores: AnalysisScores | None = None
    explanation: AnalysisExplanation | None = None
    data_warnings: list[str] = Field(default_factory=list)
    disclaimer: str = (
        "Probabilistic research only — not financial advice. "
        "Figures sourced from live APIs; verify before trading."
    )


class HealthResponse(BaseModel):
    status: str
    app: str
    environment: str
    providers: list[ProviderHealth]
