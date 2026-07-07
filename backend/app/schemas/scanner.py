from datetime import datetime, timezone

from pydantic import BaseModel, Field


class ScanResult(BaseModel):
    symbol: str
    company_name: str | None = None
    price: float | None = None
    change_percent: float | None = None
    predicted_price: float | None = None
    predicted_change_percent: float | None = None
    stockpilot_score: float | None = None
    volume: int | None = None
    market_cap: float | None = None
    pe_ratio: float | None = None
    rsi_14: float | None = None
    technical_score: float | None = None
    momentum_score: float | None = None
    risk_score: float | None = None
    overall_rating: str | None = None
    recommendation: str | None = None
    analyst_sentiment: str | None = None
    ai_reasoning: str | None = None
    confidence_score: float | None = None
    sector: str | None = None
    provider: str | None = None


class ScannerResponse(BaseModel):
    results: list[ScanResult]
    scanned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    universe_size: int
    filters_applied: dict[str, str | float | int | bool] = Field(default_factory=dict)
    disclaimer: str = (
        "AI-ranked opportunities from live market data — not financial advice."
    )


class ScreenerFilters(BaseModel):
    min_rsi: float | None = Field(None, ge=0, le=100)
    max_rsi: float | None = Field(None, ge=0, le=100)
    min_technical_score: float | None = Field(None, ge=0, le=100)
    min_momentum_score: float | None = Field(None, ge=0, le=100)
    sector: str | None = None
    min_price: float | None = Field(None, ge=0)
    max_price: float | None = Field(None, ge=0)
    investment_horizon: str | None = None
    risk_level: str | None = None
    query: str | None = Field(None, description="Symbol, company name, or sector search")
    limit: int = Field(50, ge=1, le=100)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatContext(BaseModel):
    page: str | None = None
    symbol: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list)
    context: ChatContext | None = None


class ChatResponse(BaseModel):
    reply: str
    disclaimer: str = "AI assistant for research only — not financial advice. Verify all figures."
