"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { ScanResult, ScannerResponse } from "@/types/scanner";

type Horizon = "" | "long" | "medium" | "short";
type Risk = "" | "low" | "medium" | "high";
type SortKey =
  | "symbol"
  | "price"
  | "change_percent"
  | "predicted_price"
  | "predicted_change_percent"
  | "stockpilot_score"
  | "confidence_score"
  | "recommendation";

const HORIZONS: { id: Horizon; label: string }[] = [
  { id: "", label: "Any Horizon" },
  { id: "long", label: "Long-Term" },
  { id: "medium", label: "Medium-Term" },
  { id: "short", label: "Short-Term" },
];

const RISKS: { id: Risk; label: string }[] = [
  { id: "", label: "Any Risk" },
  { id: "low", label: "Low Risk" },
  { id: "medium", label: "Medium Risk" },
  { id: "high", label: "High Risk" },
];

function recBadgeClass(rec: string | null): string {
  switch (rec) {
    case "Strong Buy":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "Buy":
      return "bg-green-500/15 text-green-300 border-green-500/25";
    case "Hold":
      return "bg-amber-500/15 text-amber-200 border-amber-500/25";
    case "Sell":
      return "bg-orange-500/15 text-orange-300 border-orange-500/25";
    case "Strong Sell":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    default:
      return "";
  }
}

function formatMarketCap(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return formatCurrency(n);
}

export function ScannerView() {
  const [data, setData] = useState<ScannerResponse | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>("");
  const [risk, setRisk] = useState<Risk>("");
  const [sortKey, setSortKey] = useState<SortKey>("stockpilot_score");
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (horizon) params.set("investment_horizon", horizon);
      if (risk) params.set("risk_level", risk);
      const res = await fetch(`/api/market/scanner?${params}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Scanner unavailable.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to load scanner. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [horizon, risk]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => {
    if (!data?.results) return [];
    const rows = [...data.results];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return rows;
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return sortAsc ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            Market Scanner
            <Badge variant="secondary" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Powered by AI
            </Badge>
          </h1>
          <p className="text-sm text-slate-400">
            AI stock discovery across {data?.universe_size ?? 300}+ US-listed equities & ADRs — live data, StockPilot scores.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs font-medium uppercase tracking-wide text-slate-500">
            Horizon
          </span>
          {HORIZONS.map((h) => (
            <Button
              key={h.id || "any-h"}
              size="sm"
              variant={horizon === h.id ? "default" : "outline"}
              onClick={() => setHorizon(h.id)}
            >
              {h.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs font-medium uppercase tracking-wide text-slate-500">
            Risk
          </span>
          {RISKS.map((r) => (
            <Button
              key={r.id || "any-r"}
              size="sm"
              variant={risk === r.id ? "default" : "outline"}
              onClick={() => setRisk(r.id)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Scanning 140+ US equities with live data… first load may take up to a minute.
          </p>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-sm text-amber-100">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-white">AI-Ranked Opportunities</CardTitle>
            <CardDescription className="text-slate-400">{data.disclaimer}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {sorted.length === 0 ? (
              <p className="text-sm text-slate-400">No matches for these filters. Try broadening your criteria.</p>
            ) : (
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-slate-500">
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("symbol")}>
                      Symbol <SortIcon col="symbol" />
                    </th>
                    <th className="pb-3 pr-4">Company</th>
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("price")}>
                      Price <SortIcon col="price" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("change_percent")}>
                      Today <SortIcon col="change_percent" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("predicted_price")}>
                      Predicted <SortIcon col="predicted_price" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("predicted_change_percent")}>
                      Pred % <SortIcon col="predicted_change_percent" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("stockpilot_score")}>
                      StockPilot Score <SortIcon col="stockpilot_score" />
                    </th>
                    <th className="pb-3 pr-4">Mkt Cap</th>
                    <th className="pb-3 pr-4">P/E</th>
                    <th className="pb-3 pr-4">Sentiment</th>
                    <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("recommendation")}>
                      AI Rating <SortIcon col="recommendation" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <ScannerRow key={row.symbol} row={row} />
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScannerRow({ row }: { row: ScanResult }) {
  const positive = (row.change_percent ?? 0) >= 0;
  const predPositive = (row.predicted_change_percent ?? 0) >= 0;
  const score = row.stockpilot_score ?? 0;
  return (
    <>
      <tr className="border-b border-border/30 transition-colors hover:bg-card/50">
        <td className="py-3 pr-4">
          <Link href={`/analysis/${row.symbol}`} className="font-mono font-semibold text-white hover:text-primary">
            {row.symbol}
          </Link>
        </td>
        <td className="max-w-[140px] truncate py-3 pr-4 text-slate-300">
          {row.company_name ?? "—"}
        </td>
        <td className="py-3 pr-4 text-white">
          {row.price != null ? formatCurrency(row.price, "USD") : "—"}
        </td>
        <td className={cn("py-3 pr-4 font-medium", positive ? "text-gain" : "text-loss")}>
          {row.change_percent != null ? formatPercent(row.change_percent) : "—"}
        </td>
        <td className="py-3 pr-4 text-slate-200">
          {row.predicted_price != null ? formatCurrency(row.predicted_price, "USD") : "—"}
        </td>
        <td className={cn("py-3 pr-4 font-medium", predPositive ? "text-gain" : "text-loss")}>
          {row.predicted_change_percent != null ? formatPercent(row.predicted_change_percent) : "—"}
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full", score >= 60 ? "bg-gain" : score >= 40 ? "bg-amber-400" : "bg-loss")}
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
            <span className="font-mono text-white">{row.stockpilot_score?.toFixed(1) ?? "—"}</span>
          </div>
        </td>
        <td className="py-3 pr-4 text-slate-300">{formatMarketCap(row.market_cap)}</td>
        <td className="py-3 pr-4 text-slate-300">
          {row.pe_ratio != null ? row.pe_ratio.toFixed(1) : "—"}
        </td>
        <td className="py-3 pr-4 text-slate-300">{row.analyst_sentiment ?? "—"}</td>
        <td className="py-3 pr-4">
          {row.recommendation && (
            <Badge variant="outline" className={recBadgeClass(row.recommendation)}>
              {row.recommendation}
            </Badge>
          )}
        </td>
      </tr>
      {row.ai_reasoning && (
        <tr className="border-b border-border/20 bg-card/20">
          <td colSpan={11} className="px-2 py-2 text-xs leading-relaxed text-slate-400">
            <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
            {row.ai_reasoning.replace(/\*\*/g, "")}
          </td>
        </tr>
      )}
    </>
  );
}
