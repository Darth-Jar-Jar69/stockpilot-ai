import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson, isBackendConfigured } from "@/lib/backend";

function sma(values: number[], period: number, end: number): number | null {
  if (end + 1 < period) return null;
  const slice = values.slice(end + 1 - period, end + 1);
  return slice.reduce((a, b) => a + b, 0) / period;
}

async function yahooSmaBacktest(symbol: string, period: string) {
  const rangeMap: Record<string, string> = {
    "6mo": "6mo",
    "1y": "1y",
    "2y": "2y",
    "5y": "5y",
  };
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", rangeMap[period] ?? "1y");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StockPilot/1.0)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo OHLCV ${res.status}`);

  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const closes =
    json.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(
      (v): v is number => typeof v === "number",
    ) ?? [];
  if (closes.length < 60) throw new Error("Not enough price history for a 20/50 SMA backtest.");

  let cash = 1;
  let shares = 0;
  let trades = 0;
  let wins = 0;
  let entry = 0;
  let peak = 1;
  let maxDd = 0;
  const equity: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    const price = closes[i]!;
    const fast = sma(closes, 20, i);
    const slow = sma(closes, 50, i);
    if (fast == null || slow == null) {
      equity.push(cash + shares * price);
      continue;
    }

    const prevFast = sma(closes, 20, i - 1);
    const prevSlow = sma(closes, 50, i - 1);
    if (prevFast != null && prevSlow != null) {
      const crossUp = prevFast <= prevSlow && fast > slow;
      const crossDown = prevFast >= prevSlow && fast < slow;
      if (crossUp && shares === 0) {
        shares = cash / price;
        cash = 0;
        entry = price;
        trades += 1;
      } else if (crossDown && shares > 0) {
        cash = shares * price;
        if (price > entry) wins += 1;
        shares = 0;
        trades += 1;
      }
    }

    const eq = cash + shares * price;
    equity.push(eq);
    peak = Math.max(peak, eq);
    maxDd = Math.max(maxDd, peak > 0 ? ((peak - eq) / peak) * 100 : 0);
  }

  const finalEq = equity.at(-1) ?? 1;
  const buyHold = (closes.at(-1)! / closes[0]! - 1) * 100;
  const strat = (finalEq - 1) * 100;
  const closedTrades = Math.floor(trades / 2);

  return {
    symbol: symbol.toUpperCase(),
    strategy: "sma_crossover",
    period: period || "1y",
    total_return_percent: Number(strat.toFixed(2)),
    buy_hold_return_percent: Number(buyHold.toFixed(2)),
    trades,
    win_rate: closedTrades > 0 ? Number(((wins / closedTrades) * 100).toFixed(1)) : null,
    max_drawdown_percent: Number(maxDd.toFixed(2)),
    explanation: `Bought when SMA20 crossed above SMA50 and sold on the opposite cross across ${closes.length} daily bars. Strategy ${strat >= buyHold ? "beat" : "lagged"} buy-and-hold by ${Math.abs(strat - buyHold).toFixed(1)} percentage points in this window.`,
    disclaimer:
      "Educational simulation on live Yahoo OHLCV. Ignores fees, taxes, and slippage — not financial advice.",
    provider: "yahoo_finance",
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const symbol = String(body.symbol ?? "AAPL").trim().toUpperCase();
  const period = String(body.period ?? "1y");

  if (isBackendConfigured()) {
    try {
      const { ok, status, data } = await fetchBackendJson({
        path: "/api/v1/backtest",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        revalidate: false,
      });
      if (ok) return NextResponse.json(data);
      // Prefer Yahoo path over hard failure
      try {
        return NextResponse.json(await yahooSmaBacktest(symbol, period));
      } catch {
        return NextResponse.json(
          { error: backendErrorMessage(data, "Backtest failed.") },
          { status },
        );
      }
    } catch {
      // fall through
    }
  }

  try {
    return NextResponse.json(await yahooSmaBacktest(symbol, period));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Backtest unavailable right now. Try another symbol or period.",
      },
      { status: 503 },
    );
  }
}
