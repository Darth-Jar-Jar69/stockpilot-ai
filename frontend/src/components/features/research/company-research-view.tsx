"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";

import { StockChart } from "@/components/charts/stock-chart";
import { ScoreCard } from "@/components/features/research/score-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { OHLCVResponse } from "@/types/market";
import type { CompanyResearch } from "@/types/research";

function formatLargeNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

/** Next-gen company research page — real data, scored dimensions, AI equity report. */
export function CompanyResearchView({ symbol }: { symbol: string }) {
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  const [ohlcv, setOhlcv] = useState<OHLCVResponse | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const [researchRes, ohlcvRes] = await Promise.all([
          fetch(`/api/market/research/${encodeURIComponent(symbol)}`),
          fetch(`/api/market/ohlcv/${encodeURIComponent(symbol)}?period=1y&interval=1d`),
        ]);
        if (!researchRes.ok) {
          const err = await researchRes.json();
          setError(err.error ?? "Research unavailable.");
          return;
        }
        setResearch(await researchRes.json());
        if (ohlcvRes.ok) setOhlcv(await ohlcvRes.json());
      } catch {
        setError("Failed to load research. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !research) {
    return (
      <div className="p-6">
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex gap-3 py-6">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-amber-100">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quote = research.quote;
  const fund = research.fundamentals as Record<string, number | string | null> | null;
  const sp = research.stockpilot_scores;
  const fv = research.fair_value;
  const report = research.equity_report;
  const isPositive = (quote?.change ?? 0) >= 0;

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-slate-400" asChild>
            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">{research.company_name ?? research.symbol}</h1>
          <p className="text-lg text-slate-400">{research.symbol}</p>
          {fund?.sector && (
            <p className="text-sm text-slate-500">{String(fund.sector)} · {String(fund.industry ?? "")}</p>
          )}
          {fund?.description && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 line-clamp-4">
              {String(fund.description)}
            </p>
          )}
        </div>
        {quote && (
          <div className="text-right">
            <p className="text-4xl font-bold text-white">{formatCurrency(quote.price, quote.currency)}</p>
            <p className={`flex items-center justify-end gap-1 ${isPositive ? "text-gain" : "text-loss"}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {quote.change_percent != null && formatPercent(quote.change_percent)}
            </p>
            {sp?.overall.score != null && (
              <Badge className="mt-2 text-base">StockPilot Score: {sp.overall.score.toFixed(0)}/100</Badge>
            )}
          </div>
        )}
      </div>

      {ohlcv && ohlcv.bars.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader><CardTitle className="text-white">Price Chart</CardTitle></CardHeader>
          <CardContent><StockChart bars={ohlcv.bars} symbol={research.symbol} /></CardContent>
        </Card>
      )}

      {sp && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white">StockPilot Scores</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ScoreCard block={sp.overall} />
            <ScoreCard block={sp.financial_health} />
            <ScoreCard block={sp.growth} />
            <ScoreCard block={sp.value} />
            <ScoreCard block={sp.quality} />
            <ScoreCard block={sp.momentum} />
            <ScoreCard block={sp.risk} />
          </div>
        </div>
      )}

      {fv && fv.fair_value_mid != null && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-white">Fair Value Engine</CardTitle>
            <CardDescription className="text-slate-400">{fv.disclaimer}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-slate-400">Current</p><p className="text-lg font-bold text-white">{formatCurrency(fv.current_price ?? 0)}</p></div>
            <div><p className="text-xs text-slate-400">Fair Value (mid)</p><p className="text-lg font-bold text-primary">{formatCurrency(fv.fair_value_mid)}</p></div>
            <div><p className="text-xs text-slate-400">Range</p><p className="text-sm text-slate-200">{formatCurrency(fv.fair_value_low ?? 0)} – {formatCurrency(fv.fair_value_high ?? 0)}</p></div>
            <div><p className="text-xs text-slate-400">Model upside</p><p className={`text-lg font-bold ${(fv.upside_percent ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>{fv.upside_percent != null ? formatPercent(fv.upside_percent) : "—"}</p></div>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-gain">Bull Case</CardTitle>
              <CardDescription>{report.moat_assessment}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {report.bull_case.map((b) => <p key={b}>• {b}</p>)}
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardHeader><CardTitle className="text-loss">Bear Case</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {report.bear_case.map((b) => <p key={b}>• {b}</p>)}
            </CardContent>
          </Card>
          <Card className="glass border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white">AI Equity Analyst</CardTitle>
              <CardDescription className="text-slate-300">{report.investment_thesis}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 text-sm text-slate-400">
              <div><p className="mb-1 font-medium text-slate-200">Growth opportunities</p>{report.growth_opportunities.map((g) => <p key={g}>• {g}</p>)}</div>
              <div><p className="mb-1 font-medium text-slate-200">Competitive advantages</p>{report.competitive_advantages.map((g) => <p key={g}>• {g}</p>)}</div>
              <div><p className="mb-1 font-medium text-slate-200">Catalysts</p>{report.catalysts.map((g) => <p key={g}>• {g}</p>)}</div>
              <div><p className="mb-1 font-medium text-slate-200">Main risks</p>{report.main_risks.map((g) => <p key={g}>• {g}</p>)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40 bg-card/40 px-3 py-2"><p className="text-xs text-slate-400">Market Cap</p><p className="font-semibold text-white">{formatLargeNumber(quote?.market_cap)}</p></Card>
        <Card className="border-border/40 bg-card/40 px-3 py-2"><p className="text-xs text-slate-400">P/E</p><p className="font-semibold text-white">{fund?.pe_ratio != null ? Number(fund.pe_ratio).toFixed(2) : "—"}</p></Card>
        <Card className="border-border/40 bg-card/40 px-3 py-2"><p className="text-xs text-slate-400">ROE</p><p className="font-semibold text-white">{fund?.return_on_equity != null ? `${(Number(fund.return_on_equity) * 100).toFixed(1)}%` : "—"}</p></Card>
        <Card className="border-border/40 bg-card/40 px-3 py-2"><p className="text-xs text-slate-400">Debt/Equity</p><p className="font-semibold text-white">{fund?.debt_to_equity != null ? Number(fund.debt_to_equity).toFixed(1) : "—"}</p></Card>
      </div>

      <p className="text-xs text-slate-500">{research.disclaimer}</p>
    </div>
  );
}
