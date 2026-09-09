"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPercent } from "@/lib/utils";

type BacktestResult = {
  symbol?: string;
  strategy?: string;
  period?: string;
  total_return_percent?: number;
  buy_hold_return_percent?: number;
  trades?: number;
  win_rate?: number | null;
  max_drawdown_percent?: number | null;
  explanation?: string;
  disclaimer?: string;
  error?: string;
};

export function BacktestView() {
  const [symbol, setSymbol] = useState("AAPL");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Deep link: /backtesting?symbol=NVDA
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sym = new URLSearchParams(window.location.search).get("symbol");
    if (sym) setSymbol(sym.toUpperCase());
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, strategy: "sma_crossover", period: "1y" }),
      });
      setResult(await res.json());
    } catch {
      setResult({ error: "Backtest request failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <FlaskConical className="h-6 w-6 text-primary" />
          Backtesting
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Backtesting asks: <span className="text-slate-200">“If I had followed this rule on
          historical prices, what would have happened?”</span>{" "}
          StockPilot runs a simple <span className="text-slate-200">SMA 20/50 crossover</span> on
          live daily OHLCV: buy when the 20-day average crosses above the 50-day, sell when it
          crosses below. Results are educational — past paths do not guarantee future returns, and
          they ignore taxes, slippage, and overnight gaps.
        </p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">SMA Crossover (20 / 50)</CardTitle>
          <CardDescription className="text-slate-400">
            Uses one year of daily bars. Compare strategy return vs buy-and-hold for the same window.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-32 bg-secondary/50"
            placeholder="AAPL"
          />
          <Button onClick={run} disabled={loading || !symbol.trim()}>
            {loading ? "Running…" : "Run on live OHLCV"}
          </Button>
        </CardContent>
      </Card>

      {result?.error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {result.error}
          </CardContent>
        </Card>
      )}

      {result && !result.error && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-white">
              Results · {result.symbol ?? symbol}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {result.strategy ?? "sma_crossover"} · {result.period ?? "1y"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Strategy return"
                value={
                  result.total_return_percent != null
                    ? formatPercent(result.total_return_percent)
                    : "—"
                }
              />
              <Stat
                label="Buy & hold"
                value={
                  result.buy_hold_return_percent != null
                    ? formatPercent(result.buy_hold_return_percent)
                    : "—"
                }
              />
              <Stat label="Trades" value={String(result.trades ?? "—")} />
              <Stat
                label="Max drawdown"
                value={
                  result.max_drawdown_percent != null
                    ? formatPercent(-Math.abs(result.max_drawdown_percent))
                    : "—"
                }
              />
            </div>
            {result.explanation && (
              <p className="rounded-lg border border-border/40 bg-card/40 p-3 text-slate-300">
                {result.explanation}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {result.disclaimer ??
                "Educational simulation only — not financial advice."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
