from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.fundamentals import AnalysisExplanation, Fundamentals
from app.schemas.market import AnalysisScores, OHLCVResponse, Quote, TechnicalIndicators


class ExtendedFundamentals(Fundamentals):
    """Extended company fundamentals from live Yahoo data."""

    name: str | None = None
    description: str | None = None
    debt_to_equity: float | None = None
    free_cash_flow: float | None = None
    return_on_equity: float | None = None
    return_on_assets: float | None = None
    ev_to_ebitda: float | None = None
    price_to_book: float | None = None
    operating_margin: float | None = None
    gross_margin: float | None = None
    current_ratio: float | None = None
    total_debt: float | None = None
    total_cash: float | None = None
    enterprise_value: float | None = None
    ebitda: float | None = None
    revenue: float | None = None
    earnings_growth: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    shares_outstanding: float | None = None
    institutional_ownership: float | None = None
    country: str | None = None
    website: str | None = None


class ScoreBlock(BaseModel):
    score: float | None = Field(None, ge=0, le=100)
    label: str
    reasons: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class StockPilotScores(BaseModel):
    financial_health: ScoreBlock
    growth: ScoreBlock
    value: ScoreBlock
    quality: ScoreBlock
    momentum: ScoreBlock
    risk: ScoreBlock
    overall: ScoreBlock


class ValuationMethod(BaseModel):
    name: str
    estimate: float | None
    note: str | None = None


class FairValueEstimate(BaseModel):
    current_price: float | None = None
    fair_value_low: float | None = None
    fair_value_mid: float | None = None
    fair_value_high: float | None = None
    upside_percent: float | None = None
    methods: list[ValuationMethod] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    disclaimer: str = "Probabilistic estimate from real inputs — not a price target guarantee."


class EquityAnalystReport(BaseModel):
    bull_case: list[str] = Field(default_factory=list)
    bear_case: list[str] = Field(default_factory=list)
    investment_thesis: str = ""
    growth_opportunities: list[str] = Field(default_factory=list)
    competitive_advantages: list[str] = Field(default_factory=list)
    main_risks: list[str] = Field(default_factory=list)
    catalysts: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    stockpilot_rating: float | None = Field(None, ge=0, le=100)
    moat_assessment: str | None = None


class CompanyResearch(BaseModel):
    symbol: str
    company_name: str | None = None
    quote: Quote | None = None
    fundamentals: ExtendedFundamentals | None = None
    technical: TechnicalIndicators | None = None
    scores: AnalysisScores | None = None
    stockpilot_scores: StockPilotScores | None = None
    fair_value: FairValueEstimate | None = None
    equity_report: EquityAnalystReport | None = None
    explanation: AnalysisExplanation | None = None
    data_warnings: list[str] = Field(default_factory=list)
    disclaimer: str = (
        "Probabilistic research only — not financial advice. "
        "Figures sourced from live APIs; verify before trading."
    )


class ComparisonMetric(BaseModel):
    symbol: str
    company_name: str | None = None
    growth_score: float | None = None
    profitability_score: float | None = None
    valuation_score: float | None = None
    risk_score: float | None = None
    quality_score: float | None = None
    overall_score: float | None = None
    pe_ratio: float | None = None
    revenue_growth: float | None = None
    profit_margin: float | None = None


class ComparisonResponse(BaseModel):
    symbols: list[str]
    metrics: list[ComparisonMetric]
    ai_conclusion: str
    disclaimer: str


class IndexSnapshot(BaseModel):
    symbol: str
    name: str
    price: float | None = None
    change_percent: float | None = None


class SectorPerformance(BaseModel):
    sector: str
    avg_change_percent: float | None = None
    symbol_count: int = 0


class MarketBriefing(BaseModel):
    headline: str
    summary: str
    sentiment: str
    key_points: list[str] = Field(default_factory=list)
    as_of: datetime


class MarketIntelligence(BaseModel):
    indices: list[IndexSnapshot]
    sector_performance: list[SectorPerformance]
    briefing: MarketBriefing
    disclaimer: str


class PortfolioHoldingInput(BaseModel):
    symbol: str
    shares: float = Field(gt=0)
    avg_cost: float | None = Field(None, ge=0)


class PortfolioAnalysis(BaseModel):
    holdings_count: int
    total_value: float | None = None
    health_score: float | None = None
    diversification_score: float | None = None
    risk_exposure: float | None = None
    sector_concentration: dict[str, float] = Field(default_factory=dict)
    weak_positions: list[str] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
    disclaimer: str


class NewsStockMention(BaseModel):
    symbol: str
    company_name: str | None = None
    price: float | None = None
    change_percent: float | None = None


class NewsArticle(BaseModel):
    title: str
    source: str | None = None
    url: str | None = None
    published_at: datetime | None = None
    summary: str | None = None
    image_url: str | None = None
    symbols: list[str] = Field(default_factory=list)
    related_stocks: list[NewsStockMention] = Field(default_factory=list)


class BacktestRequest(BaseModel):
    symbol: str
    strategy: str = "sma_crossover"
    period: str = "1y"


class BacktestResult(BaseModel):
    symbol: str
    strategy: str
    total_return_percent: float | None = None
    buy_hold_return_percent: float | None = None
    trades: int = 0
    win_rate: float | None = None
    disclaimer: str
