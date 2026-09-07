"""Fallen Giants — event-driven recovery candidate schemas."""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


CatalystType = Literal[
    "earnings_miss",
    "guidance_cut",
    "regulatory",
    "lawsuit",
    "product_failure",
    "management_change",
    "government_action",
    "contract_loss",
    "financial_warning",
    "other",
    "unclear",
]


class FallenGiantSource(BaseModel):
    title: str
    source: str | None = None
    url: str | None = None
    published_at: datetime | None = None


class FallenGiantCandidate(BaseModel):
    symbol: str
    company_name: str | None = None
    market_cap: float | None = None
    current_price: float | None = None
    pre_catalyst_price: float | None = None
    lowest_price_after_catalyst: float | None = None
    decline_percent: float | None = None
    recovered_percent: float | None = None
    catalyst: str | None = None
    catalyst_type: CatalystType = "unclear"
    catalyst_date: datetime | None = None
    fundamental_health_score: float | None = Field(None, ge=0, le=100)
    valuation_score: float | None = Field(None, ge=0, le=100)
    recovery_score: float | None = Field(None, ge=0, le=100)
    risk_score: float | None = Field(None, ge=0, le=100)
    catalyst_clarity_score: float | None = Field(None, ge=0, le=15)
    price_dislocation_score: float | None = Field(None, ge=0, le=20)
    fallen_giants_score: float | None = Field(None, ge=0, le=100)
    why_it_fell: str | None = None
    why_it_could_recover: str | None = None
    why_it_might_not_recover: str | None = None
    recovery_confirmations: list[str] = Field(default_factory=list)
    sources: list[FallenGiantSource] = Field(default_factory=list)
    sector: str | None = None
    relative_to_spy_decline: float | None = None
    days_since_catalyst: int | None = None
    selloff_days: int | None = None
    provider: str | None = None
    data_warnings: list[str] = Field(default_factory=list)


class FallenGiantsFilters(BaseModel):
    min_decline: float = Field(10.0, ge=5, le=80)
    min_market_cap: float | None = Field(10_000_000_000, ge=0)  # $10B default
    risk: Literal["low", "medium", "high"] | None = None
    min_recovery_score: float | None = Field(None, ge=0, le=100)
    min_fundamental_score: float | None = Field(None, ge=0, le=100)
    catalyst_type: CatalystType | None = None
    max_days_since_crash: int | None = Field(90, ge=7, le=180)
    sort_by: Literal[
        "fallen_giants_score",
        "decline_percent",
        "recovery_score",
        "fundamental_health_score",
    ] = "fallen_giants_score"
    limit: int = Field(20, ge=1, le=40)


class FallenGiantsResponse(BaseModel):
    results: list[FallenGiantCandidate]
    scanned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    universe_size: int
    filters_applied: dict[str, str | float | int | bool] = Field(default_factory=dict)
    disclaimer: str = (
        "Fallen Giants identifies event-driven dislocation candidates from live market data "
        "and news — not buy recommendations or financial advice. Verify all figures and sources."
    )
