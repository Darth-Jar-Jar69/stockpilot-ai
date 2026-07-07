from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.core.exceptions import MarketDataError
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    logger.info("Starting %s [%s]", settings.app_name, settings.app_env)
    yield
    logger.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    description="Real-time market data analysis engine. Never returns fabricated financial data.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(MarketDataError)
async def market_data_error_handler(_request: Request, exc: MarketDataError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"code": exc.code, "message": exc.message, "provider": exc.provider},
    )


app.include_router(v1_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "docs": "/docs",
        "health": f"{settings.api_v1_prefix}/health",
    }
