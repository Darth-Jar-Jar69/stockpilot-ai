from fastapi import APIRouter, HTTPException, Query

from app.core.exceptions import MarketDataError
from app.schemas.market import HealthResponse, OHLCVResponse, Quote, SymbolAnalysis
from app.schemas.research import (
    BacktestRequest,
    BacktestResult,
    CompanyResearch,
    ComparisonResponse,
    MarketIntelligence,
    NewsArticle,
    PortfolioAnalysis,
    PortfolioHoldingInput,
)
from app.schemas.scanner import ChatRequest, ChatResponse, ScannerResponse, ScreenerFilters
from app.services.ai.chat import generate_chat_reply
from app.services.backtest.service import run_backtest
from app.services.market_data.intelligence import market_intelligence_service
from app.services.market_data.service import market_data_service
from app.services.news.service import fetch_market_news
from app.services.portfolio.service import portfolio_service
from app.services.research.comparison import comparison_service
from app.services.research.service import research_service
from app.services.scanner.service import scanner_service
from app.services.technical.service import analysis_service
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    from app.core.config import settings

    providers = await market_data_service.provider_health()
    all_down = all(p.status.value != "ok" for p in providers if p.name != "yahoo_finance")
    return HealthResponse(
        status="degraded" if all_down else "ok",
        app=settings.app_name,
        environment=settings.app_env,
        providers=providers,
    )


@router.get("/quotes/{symbol}", response_model=Quote)
async def get_quote(symbol: str) -> Quote:
    try:
        return await market_data_service.get_quote(symbol)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/ohlcv/{symbol}", response_model=OHLCVResponse)
async def get_ohlcv(
    symbol: str,
    period: str = Query("6mo", pattern="^(1mo|3mo|6mo|1y|2y)$"),
    interval: str = Query("1d", pattern="^(1d|1h|15m)$"),
) -> OHLCVResponse:
    try:
        return await market_data_service.get_ohlcv(symbol, period=period, interval=interval)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/analysis/{symbol}", response_model=SymbolAnalysis)
async def get_analysis(symbol: str) -> SymbolAnalysis:
    try:
        return await analysis_service.analyze_symbol(symbol)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/scanner", response_model=ScannerResponse)
async def get_scanner(
    limit: int = Query(30, ge=1, le=50),
    investment_horizon: str | None = Query(None, description="long, medium, or short"),
    risk_level: str | None = Query(None, description="low, medium, or high"),
) -> ScannerResponse:
    try:
        return await scanner_service.scan_market(
            limit=limit,
            investment_horizon=investment_horizon,
            risk_level=risk_level,
        )
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/scanner/fallen-giants")
async def get_fallen_giants(
    min_decline: float = Query(10, ge=5, le=80),
    min_market_cap: float | None = Query(10_000_000_000, ge=0),
    risk: str | None = Query(None, description="low, medium, or high"),
    min_recovery_score: float | None = Query(None, ge=0, le=100),
    min_fundamental_score: float | None = Query(None, ge=0, le=100),
    catalyst_type: str | None = Query(None),
    max_days_since_crash: int | None = Query(90, ge=7, le=180),
    sort_by: str = Query("fallen_giants_score"),
    limit: int = Query(20, ge=1, le=40),
):
    from app.schemas.fallen_giants import FallenGiantsFilters
    from app.services.scanner.fallen_giants import fallen_giants_service

    allowed_sort = {
        "fallen_giants_score",
        "decline_percent",
        "recovery_score",
        "fundamental_health_score",
    }
    allowed_catalyst = {
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
    }
    if sort_by not in allowed_sort:
        sort_by = "fallen_giants_score"
    if risk is not None and risk not in {"low", "medium", "high"}:
        risk = None
    if catalyst_type is not None and catalyst_type not in allowed_catalyst:
        catalyst_type = None

    filters = FallenGiantsFilters(
        min_decline=min_decline,
        min_market_cap=min_market_cap,
        risk=risk,  # type: ignore[arg-type]
        min_recovery_score=min_recovery_score,
        min_fundamental_score=min_fundamental_score,
        catalyst_type=catalyst_type,  # type: ignore[arg-type]
        max_days_since_crash=max_days_since_crash,
        sort_by=sort_by,  # type: ignore[arg-type]
        limit=limit,
    )
    try:
        return await fallen_giants_service.scan(filters)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"message": str(exc)}) from exc


@router.get("/screener", response_model=ScannerResponse)
async def get_screener(
    min_rsi: float | None = Query(None, ge=0, le=100),
    max_rsi: float | None = Query(None, ge=0, le=100),
    min_technical_score: float | None = Query(None, ge=0, le=100),
    min_momentum_score: float | None = Query(None, ge=0, le=100),
    sector: str | None = None,
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    query: str | None = Query(None, description="Symbol, company, or sector search"),
    limit: int = Query(50, ge=1, le=100),
) -> ScannerResponse:
    filters = ScreenerFilters(
        min_rsi=min_rsi,
        max_rsi=max_rsi,
        min_technical_score=min_technical_score,
        min_momentum_score=min_momentum_score,
        sector=sector,
        min_price=min_price,
        max_price=max_price,
        query=query,
        limit=limit,
    )
    try:
        return await scanner_service.screen(filters)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.post("/assistant/chat", response_model=ChatResponse)
async def assistant_chat(body: ChatRequest) -> ChatResponse:
    try:
        reply = await generate_chat_reply(body.message, body.history, body.context)
        return ChatResponse(reply=reply)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/research/{symbol}", response_model=CompanyResearch)
async def get_research(symbol: str) -> CompanyResearch:
    try:
        return await research_service.get_company_research(symbol)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/compare", response_model=ComparisonResponse)
async def compare_companies(symbols: str = Query(..., description="Comma-separated symbols")) -> ComparisonResponse:
    try:
        return await comparison_service.compare(symbols.split(","))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/market/intelligence", response_model=MarketIntelligence)
async def get_market_intelligence() -> MarketIntelligence:
    try:
        return await market_intelligence_service.get_market_overview()
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.get("/news", response_model=list[NewsArticle])
async def get_news(symbol: str | None = None, limit: int = Query(15, ge=1, le=30)) -> list[NewsArticle]:
    try:
        return await fetch_market_news(symbol, limit)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.post("/portfolio/analyze", response_model=PortfolioAnalysis)
async def analyze_portfolio(holdings: list[PortfolioHoldingInput]) -> PortfolioAnalysis:
    try:
        return await portfolio_service.analyze_holdings(holdings)
    except MarketDataError as exc:
        raise HTTPException(status_code=503, detail={"code": exc.code, "message": exc.message}) from exc


@router.post("/backtest", response_model=BacktestResult)
async def backtest_strategy(body: BacktestRequest) -> BacktestResult:
    try:
        return await run_backtest(body)
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"message": str(exc)}) from exc