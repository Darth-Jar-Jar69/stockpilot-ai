import asyncio

import yfinance as yf

from app.schemas.research import BacktestRequest, BacktestResult


async def run_backtest(req: BacktestRequest) -> BacktestResult:
    return await asyncio.to_thread(_run_sync, req)


def _run_sync(req: BacktestRequest) -> BacktestResult:
    ticker = yf.Ticker(req.symbol.upper())
    hist = ticker.history(period=req.period)
    if hist.empty or len(hist) < 50:
        return BacktestResult(
            symbol=req.symbol.upper(),
            strategy=req.strategy,
            disclaimer="Insufficient historical data for backtest.",
        )

    close = hist["Close"]
    if req.strategy == "sma_crossover":
        sma_fast = close.rolling(20).mean()
        sma_slow = close.rolling(50).mean()
        signal = (sma_fast > sma_slow).astype(int)
        returns = close.pct_change() * signal.shift(1)
        strat_return = (1 + returns.fillna(0)).prod() - 1
        buy_hold = (close.iloc[-1] / close.iloc[0]) - 1
        trades = int(signal.diff().abs().sum())
        wins = returns[returns > 0]
        win_rate = len(wins) / max(1, len(returns.dropna()) - 1)

        return BacktestResult(
            symbol=req.symbol.upper(),
            strategy=req.strategy,
            total_return_percent=round(strat_return * 100, 2),
            buy_hold_return_percent=round(buy_hold * 100, 2),
            trades=trades,
            win_rate=round(win_rate * 100, 1),
            disclaimer="Historical simulation on real OHLCV — past performance ≠ future results.",
        )

    return BacktestResult(
        symbol=req.symbol.upper(),
        strategy=req.strategy,
        disclaimer="Unknown strategy.",
    )
