"""Deterministic assistant replies when OpenAI is unavailable."""

from app.schemas.scanner import ChatContext

FALLBACK_NOTICE = (
    "*(Offline assistant — OpenAI quota unavailable. Answers are template-based; "
    "verify numbers on the analysis page.)*\n\n"
)


def _context_line(context: ChatContext | None) -> str:
    if not context:
        return ""
    parts: list[str] = []
    if context.symbol:
        parts.append(f"You're viewing **{context.symbol.upper()}**.")
    if context.page:
        parts.append(f"Current page: `{context.page}`.")
    return " ".join(parts)


def generate_fallback_reply(message: str, context: ChatContext | None = None) -> str:
    text = message.lower().strip()
    ctx = _context_line(context)

    if any(w in text for w in ("rsi", "relative strength")):
        return (
            FALLBACK_NOTICE
            + f"{ctx}\n"
            "**RSI (Relative Strength Index)** measures momentum on a 0–100 scale.\n"
            "- Above **70**: often considered overbought (strong recent gains).\n"
            "- Below **30**: often considered oversold (weak recent price action).\n"
            "- Near **50**: neutral momentum.\n\n"
            "On StockPilot, RSI is computed from real daily OHLCV on each symbol's analysis page — "
            "it is not a prediction. Use it alongside fundamentals and risk scores."
        )

    if any(w in text for w in ("macd", "moving average convergence")):
        return (
            FALLBACK_NOTICE
            + f"{ctx}\n"
            "**MACD** tracks the relationship between two moving averages.\n"
            "- Positive histogram: short-term momentum above the signal line.\n"
            "- Negative histogram: momentum fading.\n\n"
            "Check the analysis page for the live MACD histogram computed from Yahoo Finance data."
        )

    if any(w in text for w in ("scanner", "scan", "screen")):
        return (
            FALLBACK_NOTICE
            + "The **Market Scanner** ranks symbols by technical score, momentum, and live price change.\n"
            "Open **Scanner** in the sidebar — results come from the FastAPI backend using real quotes.\n"
            "Use **Screener** to filter by sector and price range."
        )

    if any(w in text for w in ("paper", "simulate", "practice")):
        return (
            FALLBACK_NOTICE
            + "**Paper Trading** starts with an empty virtual portfolio — fund it, then practice at live prices.\n"
            "- Buy/sell updates cash and positions.\n"
            "- Equity curve and allocation charts show portfolio performance.\n"
            "- No real money is involved — great for testing ideas."
        )

    if any(w in text for w in ("portfolio", "holding", "allocation")):
        return (
            FALLBACK_NOTICE
            + "**Portfolio** tracks your holdings with live quotes and allocation weights.\n"
            "Add symbols and share counts — StockPilot computes value and concentration from real market data."
        )

    if any(w in text for w in ("backtest", "backtesting", "strategy")):
        return (
            FALLBACK_NOTICE
            + "**Backtesting** runs a simple moving-average crossover on historical OHLCV.\n"
            "It shows return, max drawdown, and trade count — useful for learning, not guaranteed future results."
        )

    if any(w in text for w in ("fair value", "valuation", "dcf")):
        return (
            FALLBACK_NOTICE
            + f"{ctx}\n"
            "The **Fair Value** section on each research page blends earnings-based and growth estimates.\n"
            "It shows upside/downside ranges with confidence bands — always probabilistic, never a price target."
        )

    if any(w in text for w in ("hello", "hi", "hey", "help")):
        return (
            FALLBACK_NOTICE
            + f"{ctx}\n"
            "I'm StockPilot's research assistant. I can explain:\n"
            "- **RSI, MACD, scores** on analysis pages\n"
            "- **Scanner & screener** usage\n"
            "- **Paper trading & portfolio** features\n\n"
            "Ask a specific question, or open a symbol's analysis page for live data."
        )

    if context and context.symbol:
        sym = context.symbol.upper()
        return (
            FALLBACK_NOTICE
            + f"For **{sym}**, open the analysis page for live quote, technicals, fair value, and StockPilot scores.\n"
            "Try asking: \"What does RSI mean?\" or \"How do I read the scores?\"\n\n"
            "This is research only — not financial advice."
        )

    return (
        FALLBACK_NOTICE
        + "I can help explain StockPilot features and market concepts (RSI, MACD, scanner, paper trading).\n"
        "For live prices and scores, use the **analysis** page for any symbol.\n\n"
        "Research only — not financial advice."
    )
