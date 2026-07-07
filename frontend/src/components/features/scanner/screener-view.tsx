"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchSymbols } from "@/lib/paper-trading-market";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { ScanResult, ScannerResponse } from "@/types/scanner";

const SECTORS = [
  "",
  "Technology",
  "Healthcare",
  "Financial",
  "Consumer",
  "Energy",
  "Industrial",
  "Communication",
  "Utilities",
  "Real Estate",
];

type SortKey =
  | "symbol"
  | "price"
  | "change_percent"
  | "stockpilot_score"
  | "predicted_change_percent"
  | "rsi_14"
  | "technical_score"
  | "momentum_score";

export function ScreenerView() {
  const [data, setData] = useState<ScannerResponse | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sector, setSector] = useState("");
  const [minRsi, setMinRsi] = useState("");
  const [maxRsi, setMaxRsi] = useState("");
  const [minTechnical, setMinTechnical] = useState("");
  const [minMomentum, setMinMomentum] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [limit, setLimit] = useState("50");
  const [sortKey, setSortKey] = useState<SortKey>("stockpilot_score");
  const [sortAsc, setSortAsc] = useState(false);

  const suggestions = useMemo(() => searchSymbols(query, 8), [query]);

  const runScreen = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (sector) params.set("sector", sector);
    if (minRsi) params.set("min_rsi", minRsi);
    if (maxRsi) params.set("max_rsi", maxRsi);
    if (minTechnical) params.set("min_technical_score", minTechnical);
    if (minMomentum) params.set("min_momentum_score", minMomentum);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    params.set("limit", limit || "50");

    try {
      const res = await fetch(`/api/market/screener?${params}`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Screener unavailable.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to run screener.");
    } finally {
      setLoading(false);
    }
  }, [query, sector, minRsi, maxRsi, minTechnical, minMomentum, minPrice, maxPrice, limit]);

  useEffect(() => {
    runScreen();
    // Initial load only — use Run Screener to refresh after changing filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const totalMatches = Number(data?.filters_applied?.total_matches ?? data?.results.length ?? 0);
  const universe = data?.universe_size ?? 200;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Stock Screener</h1>
        <p className="text-sm text-slate-400">
          Screen {universe}+ real US stocks by symbol, sector, price, RSI, and StockPilot scores.
        </p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Search &amp; Filters</CardTitle>
          <CardDescription className="text-slate-400">
            Leave fields blank to ignore. Search by ticker (AAPL), company (Apple), or sector.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative space-y-2 sm:col-span-2">
            <Label className="text-slate-300">Search symbol or company</Label>
            <Input
              value={query}
              placeholder="e.g. NVDA, Apple, Technology"
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="bg-secondary/50"
            />
            {showSuggestions && query && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border/60 bg-card shadow-xl">
                {suggestions.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/60"
                    onMouseDown={() => {
                      setQuery(s.symbol);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="font-mono font-semibold text-white">{s.symbol}</span>
                    <span className="truncate pl-2 text-xs text-slate-400">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Sector</Label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-secondary/50 px-3 py-2 text-sm text-white"
            >
              <option value="">All sectors</option>
              {SECTORS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Max results</Label>
            <select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-secondary/50 px-3 py-2 text-sm text-white"
            >
              {["25", "50", "75", "100"].map((n) => (
                <option key={n} value={n}>
                  {n} stocks
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Min price ($)</Label>
            <Input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Optional" className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Max price ($)</Label>
            <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Optional" className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Min RSI</Label>
            <Input value={minRsi} onChange={(e) => setMinRsi(e.target.value)} placeholder="Optional" className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Max RSI</Label>
            <Input value={maxRsi} onChange={(e) => setMaxRsi(e.target.value)} placeholder="Optional" className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Min technical score</Label>
            <Input value={minTechnical} onChange={(e) => setMinTechnical(e.target.value)} placeholder="Optional" className="bg-secondary/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Min momentum score</Label>
            <Input value={minMomentum} onChange={(e) => setMinMomentum(e.target.value)} placeholder="Optional" className="bg-secondary/50" />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
            <Button onClick={runScreen} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Screening…" : "Run Screener"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setSector("");
                setMinRsi("");
                setMaxRsi("");
                setMinTechnical("");
                setMinMomentum("");
                setMinPrice("");
                setMaxPrice("");
                setLimit("50");
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <p className="text-sm text-slate-500">
          Scanning {universe} stocks with live data… first run may take up to a minute.
        </p>
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
            <CardTitle className="text-white">
              Results ({data.results.length}
              {totalMatches > data.results.length ? ` of ${totalMatches} matches` : ""})
            </CardTitle>
            <CardDescription className="text-slate-400">
              Scanned {universe} stocks · sorted by StockPilot score · {data.disclaimer}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {sorted.length === 0 ? (
              <p className="text-sm text-slate-400">
                No matches. Try clearing filters or broadening your search.
              </p>
            ) : (
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-slate-500">
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("symbol")}>
                      Symbol <SortIcon col="symbol" />
                    </th>
                    <th className="pb-3 pr-3">Company</th>
                    <th className="pb-3 pr-3">Sector</th>
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("price")}>
                      Price <SortIcon col="price" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("change_percent")}>
                      Today <SortIcon col="change_percent" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("predicted_change_percent")}>
                      Pred % <SortIcon col="predicted_change_percent" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("stockpilot_score")}>
                      Score <SortIcon col="stockpilot_score" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("rsi_14")}>
                      RSI <SortIcon col="rsi_14" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("technical_score")}>
                      Tech <SortIcon col="technical_score" />
                    </th>
                    <th className="cursor-pointer pb-3 pr-3" onClick={() => toggleSort("momentum_score")}>
                      Mom <SortIcon col="momentum_score" />
                    </th>
                    <th className="pb-3">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <ScreenerRow key={row.symbol} row={row} />
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

function ScreenerRow({ row }: { row: ScanResult }) {
  const up = (row.change_percent ?? 0) >= 0;
  const predUp = (row.predicted_change_percent ?? 0) >= 0;
  return (
    <tr className="border-b border-border/30 hover:bg-card/50">
      <td className="py-2.5 pr-3">
        <Link href={`/analysis/${row.symbol}`} className="font-mono font-semibold text-white hover:text-primary">
          {row.symbol}
        </Link>
      </td>
      <td className="max-w-[120px] truncate py-2.5 pr-3 text-slate-300">
        {row.company_name ?? "—"}
      </td>
      <td className="max-w-[100px] truncate py-2.5 pr-3 text-xs text-slate-400">
        {row.sector ?? "—"}
      </td>
      <td className="py-2.5 pr-3 text-white">
        {row.price != null ? formatCurrency(row.price, "USD") : "—"}
      </td>
      <td className={cn("py-2.5 pr-3 font-medium", up ? "text-gain" : "text-loss")}>
        {row.change_percent != null ? formatPercent(row.change_percent) : "—"}
      </td>
      <td className={cn("py-2.5 pr-3 font-medium", predUp ? "text-gain" : "text-loss")}>
        {row.predicted_change_percent != null ? formatPercent(row.predicted_change_percent) : "—"}
      </td>
      <td className="py-2.5 pr-3 font-mono text-white">
        {row.stockpilot_score?.toFixed(1) ?? "—"}
      </td>
      <td className="py-2.5 pr-3 text-slate-300">
        {row.rsi_14 != null ? row.rsi_14.toFixed(1) : "—"}
      </td>
      <td className="py-2.5 pr-3 text-slate-300">
        {row.technical_score != null ? row.technical_score.toFixed(0) : "—"}
      </td>
      <td className="py-2.5 pr-3 text-slate-300">
        {row.momentum_score != null ? row.momentum_score.toFixed(0) : "—"}
      </td>
      <td className="py-2.5">
        {row.recommendation && (
          <Badge variant="outline" className="text-xs">
            <Sparkles className="mr-1 inline h-3 w-3" />
            {row.recommendation}
          </Badge>
        )}
      </td>
    </tr>
  );
}
