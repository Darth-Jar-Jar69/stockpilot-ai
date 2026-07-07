/** Client-side fallback when the FastAPI assistant is unavailable. */

const NOTICE =
  "*(Offline assistant — using built-in answers. Verify live data on analysis pages.)*\n\n";

export function generateAssistantFallback(
  message: string,
  context?: { page?: string; symbol?: string },
): string {
  const text = message.toLowerCase().trim();
  const ctx = context?.symbol ? `You're viewing ${context.symbol.toUpperCase()}. ` : "";

  if (text.includes("rsi")) {
    return (
      NOTICE +
      `${ctx}**RSI (Relative Strength Index)** measures momentum on a 0–100 scale.\n` +
      "- Above **70**: often overbought.\n" +
      "- Below **30**: often oversold.\n\n" +
      "See live RSI on any symbol's analysis page."
    );
  }

  if (text.includes("macd")) {
    return (
      NOTICE +
      `${ctx}**MACD** tracks short vs long-term momentum. Positive histogram = bullish momentum; negative = fading momentum.`
    );
  }

  if (text.includes("scanner") || text.includes("scan")) {
    return (
      NOTICE +
      "The **Market Scanner** ranks stocks using live quotes and AI filters for horizon and risk. Open Scanner in the sidebar."
    );
  }

  if (text.includes("paper")) {
    return (
      NOTICE +
      "**Paper Trading** starts empty — fund a virtual account, then trade at live prices with equity curve, positions, and P&L on the Paper Trading page."
    );
  }

  if (text === "?" || text.includes("help") || text.includes("hello") || text.includes("hi")) {
    return (
      NOTICE +
      "I'm **StockPilot Assistant**. Ask about RSI, MACD, the scanner, paper trading, or how to read analysis pages."
    );
  }

  return (
    NOTICE +
    `${ctx}Ask about **RSI**, **MACD**, the **scanner**, or **paper trading**. For live prices, open a symbol's analysis page. Research only — not financial advice.`
  );
}
