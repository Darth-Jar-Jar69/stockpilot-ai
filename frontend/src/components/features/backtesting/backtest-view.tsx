"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function BacktestView() {
  const [symbol, setSymbol] = useState("AAPL");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const res = await fetch("/api/backtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, strategy: "sma_crossover", period: "1y" }),
    });
    setResult(await res.json());
    setLoading(false);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">Backtesting</h1>
      <Card className="glass border-border/50">
        <CardHeader><CardTitle className="text-white">SMA Crossover (20/50)</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="w-32 bg-secondary/50" />
          <Button onClick={run} disabled={loading}>{loading ? "Running…" : "Run on real OHLCV"}</Button>
        </CardContent>
      </Card>
      {result && (
        <Card className="glass border-border/50">
          <CardContent className="grid gap-2 pt-6 text-sm text-slate-300">
            <p>Strategy return: {String(result.total_return_percent)}%</p>
            <p>Buy & hold: {String(result.buy_hold_return_percent)}%</p>
            <p>Trades: {String(result.trades)}</p>
            <p className="text-xs text-slate-500">{String(result.disclaimer)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
