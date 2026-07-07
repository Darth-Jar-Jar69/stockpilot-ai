from datetime import datetime

from pydantic import BaseModel, Field


class Fundamentals(BaseModel):
    """Company fundamentals from real API data — never AI-generated."""

    symbol: str
    pe_ratio: float | None = None
    forward_pe: float | None = None
    peg_ratio: float | None = None
    eps: float | None = None
    dividend_yield: float | None = None
    beta: float | None = None
    profit_margin: float | None = None
    revenue_growth: float | None = None
    sector: str | None = None
    industry: str | None = None
    provider: str
    as_of: datetime


class AnalysisExplanation(BaseModel):
    """Deterministic research summary from computed scores — not LLM hallucination."""

    overall_rating: str
    investment_thesis: str
    reasons: list[str] = Field(default_factory=list)
    potential_risks: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1, description="Based on data completeness")
