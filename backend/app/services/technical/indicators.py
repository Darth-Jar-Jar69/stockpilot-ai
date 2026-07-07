"""Technical indicators computed from real OHLCV data — never AI-generated."""

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.schemas.market import OHLCVBar, TechnicalIndicators


def _bars_to_df(bars: list[OHLCVBar]) -> pd.DataFrame:
    df = pd.DataFrame(
        {
            "open": [b.open for b in bars],
            "high": [b.high for b in bars],
            "low": [b.low for b in bars],
            "close": [b.close for b in bars],
            "volume": [b.volume for b in bars],
        },
        index=pd.to_datetime([b.timestamp for b in bars]),
    )
    return df.sort_index()


def _last_valid(series: pd.Series) -> float | None:
    cleaned = series.dropna()
    if cleaned.empty:
        return None
    return round(float(cleaned.iloc[-1]), 4)


def compute_indicators(symbol: str, bars: list[OHLCVBar], provider: str) -> TechnicalIndicators:
    """Calculate technical indicators from historical price data."""
    if len(bars) < 30:
        raise ValueError(f"Insufficient data: need at least 30 bars, got {len(bars)}")

    df = _bars_to_df(bars)
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    # RSI (14)
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))

    # EMA / SMA
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    sma_20 = close.rolling(20).mean()
    sma_50 = close.rolling(50).mean()
    sma_200 = close.rolling(200).mean()

    # MACD
    macd_line = ema_12 - ema_26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - macd_signal

    # Bollinger Bands (20, 2)
    bb_middle = sma_20
    bb_std = close.rolling(20).std()
    bb_upper = bb_middle + 2 * bb_std
    bb_lower = bb_middle - 2 * bb_std

    # ATR (14)
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    atr = tr.rolling(14).mean()

    # VWAP (cumulative for available window)
    typical_price = (high + low + close) / 3
    vwap = (typical_price * volume).cumsum() / volume.cumsum()

    # ADX (14) — simplified directional movement
    up_move = high.diff()
    down_move = -low.diff()
    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
    plus_dm_series = pd.Series(plus_dm, index=df.index)
    minus_dm_series = pd.Series(minus_dm, index=df.index)
    atr_safe = atr.replace(0, np.nan)
    plus_di = 100 * (plus_dm_series.rolling(14).mean() / atr_safe)
    minus_di = 100 * (minus_dm_series.rolling(14).mean() / atr_safe)
    dx = (100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)).rolling(14).mean()

    return TechnicalIndicators(
        symbol=symbol.upper(),
        rsi_14=_last_valid(rsi),
        macd=_last_valid(macd_line),
        macd_signal=_last_valid(macd_signal),
        macd_histogram=_last_valid(macd_hist),
        ema_12=_last_valid(ema_12),
        ema_26=_last_valid(ema_26),
        sma_20=_last_valid(sma_20),
        sma_50=_last_valid(sma_50),
        sma_200=_last_valid(sma_200),
        atr_14=_last_valid(atr),
        vwap=_last_valid(vwap),
        bb_upper=_last_valid(bb_upper),
        bb_middle=_last_valid(bb_middle),
        bb_lower=_last_valid(bb_lower),
        adx_14=_last_valid(dx),
        provider=provider,
        computed_at=datetime.now(timezone.utc),
        data_points=len(bars),
    )


def compute_scores(indicators: TechnicalIndicators) -> dict[str, float | None]:
    """Deterministic scoring from real indicator values — not LLM output."""
    technical_score: float | None = None
    momentum_score: float | None = None
    risk_score: float | None = None

    if indicators.rsi_14 is not None:
        # RSI: 30-70 neutral band scores higher for stability
        rsi = indicators.rsi_14
        if 40 <= rsi <= 60:
            technical_score = 70.0
        elif 30 <= rsi < 40 or 60 < rsi <= 70:
            technical_score = 55.0
        else:
            technical_score = 35.0

    if indicators.macd_histogram is not None and indicators.rsi_14 is not None:
        macd_bullish = indicators.macd_histogram > 0
        momentum_score = 65.0 if macd_bullish else 40.0
        if indicators.rsi_14 > 50 and macd_bullish:
            momentum_score = min(85.0, momentum_score + 10)

    if indicators.atr_14 is not None and indicators.sma_20 is not None:
        # Higher ATR relative to price = higher risk
        atr_pct = (indicators.atr_14 / indicators.sma_20) * 100
        risk_score = min(90.0, max(10.0, atr_pct * 5))

    return {
        "technical_score": technical_score,
        "momentum_score": momentum_score,
        "risk_score": risk_score,
    }
