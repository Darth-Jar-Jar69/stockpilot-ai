"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";

import { EquityChart } from "@/components/charts/equity-chart";
import { OrderPanel } from "@/components/features/paper-trading/order-panel";
import { PaperAiPanel } from "@/components/features/paper-trading/paper-ai-panel";
import { PositionsTable } from "@/components/features/paper-trading/positions-table";
import { TradeHistoryTable } from "@/components/features/paper-trading/trade-history-table";
import { TradingChart } from "@/components/features/paper-trading/trading-chart";
import { TradingDashboard } from "@/components/features/paper-trading/trading-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrderType, PaperAccountState } from "@/types/paper-trading";

export function PaperTradingView() {
  const [symbol, setSymbol] = useState("AAPL");
  const [presetShares, setPresetShares] = useState<number | undefined>();
  const [data, setData] = useState<PaperAccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [funding, setFunding] = useState(false);

  // Deep link: /paper-trading?symbol=NVDA
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sym = new URLSearchParams(window.location.search).get("symbol");
    if (sym) setSymbol(sym.toUpperCase());
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/paper-trading", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load paper account.");
      setData(await res.json());
    } catch {
      setError("Could not load paper trading account.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const isActive =
    (data?.startingCash ?? 0) > 0 ||
    (data?.trades?.length ?? 0) > 0 ||
    (data?.positions?.length ?? 0) > 0;

  const held = data?.positions.find((p) => p.symbol === symbol)?.shares ?? 0;

  const fund = async () => {
    setFunding(true);
    try {
      const res = await fetch("/api/paper-trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fund", amount: 100_000 }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not fund account.");
        return;
      }
      await load(true);
    } catch {
      setError("Fund request failed.");
    } finally {
      setFunding(false);
    }
  };

  const reset = async () => {
    if (!confirm("Reset paper account to empty and clear all trades?")) return;
    await fetch("/api/paper-trading", { method: "DELETE" });
    load();
  };

  const executeTrade = async (order: {
    symbol: string;
    side: "buy" | "sell";
    shares: number;
    orderType: OrderType;
    limitPrice?: number;
    stopPrice?: number;
  }) => {
    setError(undefined);
    const delay = 600 + Math.floor(Math.random() * 900);
    await new Promise((r) => setTimeout(r, delay));

    const res = await fetch("/api/paper-trading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Trade failed.");
      return;
    }
    setSymbol(order.symbol);
    setPresetShares(undefined);
    await load(true);
  };

  const handlePositionTrade = (sym: string, side: "buy" | "sell", shares?: number) => {
    setSymbol(sym);
    if (shares != null) setPresetShares(shares);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Paper Trading Terminal</h1>
          <p className="text-sm text-slate-400">
            Simulated brokerage · live quotes · virtual capital only
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {!isActive && (
        <Card className="glass border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="font-medium text-white">Start your simulated account</p>
              <p className="text-sm text-slate-400">
                Fund virtual capital to access the full trading terminal experience.
              </p>
            </div>
            <Button onClick={fund} disabled={funding}>
              {funding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Fund $100,000
            </Button>
          </CardContent>
        </Card>
      )}

      {data && <TradingDashboard account={data} isActive={isActive} />}

      {error && <p className="text-sm text-amber-300">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="glass border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-white">{symbol}</CardTitle>
            </CardHeader>
            <CardContent>
              <TradingChart symbol={symbol} />
            </CardContent>
          </Card>

          {data && (
            <PositionsTable
              positions={data.positions}
              onSelect={setSymbol}
              onTrade={handlePositionTrade}
            />
          )}
        </div>

        <div className="space-y-5">
          <OrderPanel
            symbol={symbol}
            onSymbolChange={setSymbol}
            buyingPower={data?.buyingPower ?? 0}
            heldShares={held}
            presetShares={presetShares}
            disabled={!isActive}
            onTrade={executeTrade}
          />

          {data && <PaperAiPanel account={data} />}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-white">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityChart points={data?.equityCurve ?? []} height={240} />
          </CardContent>
        </Card>
        {data && <TradeHistoryTable trades={data.trades} />}
      </div>
    </div>
  );
}
