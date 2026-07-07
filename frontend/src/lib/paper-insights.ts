import type { PaperAccountState } from "@/types/paper-trading";

/** Client-side portfolio insights — no live AI required. */
export function generatePaperInsights(account: PaperAccountState): string[] {
  const insights: string[] = [];

  if (account.startingCash <= 0 && account.trades.length === 0) {
    return ["Fund your paper account to start building a simulated portfolio."];
  }

  if (account.positions.length === 0) {
    insights.push("No open positions — consider diversifying across sectors when you start trading.");
    return insights;
  }

  const total = account.equity || 1;
  const techSymbols = new Set(["AAPL", "MSFT", "GOOGL", "GOOG", "NVDA", "META", "AMD", "INTC", "CRM"]);
  const techWeight =
    account.positions
      .filter((p) => techSymbols.has(p.symbol))
      .reduce((sum, p) => sum + p.marketValue, 0) / total;

  if (techWeight > 0.55) {
    insights.push(
      `Your portfolio is ${(techWeight * 100).toFixed(0)}% technology stocks. Consider adding exposure to other sectors to reduce concentration risk.`,
    );
  }

  const losers = account.positions.filter((p) => p.pnl < 0);
  const winners = account.positions.filter((p) => p.pnl > 0);
  if (losers.length > 0 && winners.length === 0) {
    insights.push(
      `All ${losers.length} position(s) are underwater. Review stop-loss levels and position sizing.`,
    );
  } else if (winners.length > 0) {
    const best = [...account.positions].sort((a, b) => b.pnlPercent - a.pnlPercent)[0];
    insights.push(
      `${best.symbol} is your top performer (${best.pnlPercent >= 0 ? "+" : ""}${best.pnlPercent.toFixed(1)}% unrealized).`,
    );
  }

  if (account.dailyPnl < 0 && Math.abs(account.dailyPnlPercent) > 1) {
    insights.push(
      `Today's P&L is ${account.dailyPnlPercent.toFixed(2)}%. Volatility is elevated — paper trade with your planned risk limits.`,
    );
  } else if (account.dailyPnl > 0) {
    insights.push(`Portfolio is up ${account.dailyPnlPercent.toFixed(2)}% today based on live quote moves.`);
  }

  if (account.cash / total > 0.4) {
    insights.push(`${((account.cash / total) * 100).toFixed(0)}% of equity is in cash — you have dry powder for new entries.`);
  } else if (account.cash / total < 0.05) {
    insights.push("Cash reserves are low — limited buying power for new positions.");
  }

  return insights.slice(0, 4);
}
