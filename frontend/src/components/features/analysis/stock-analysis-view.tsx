"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";

import { StockChart } from "@/components/charts/stock-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { OHLCVResponse, SymbolAnalysis } from "@/types/market";

function formatLargeNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

/** Full stock analysis page — real data only, clear errors when unavailable. */
export function StockAnalysisView({ symbol }: { symbol: string }) {
  const [analysis, setAnalysis] = useState<SymbolAnalysis | null>(null);
  const [ohlcv, setOhlcv] = useState<OHLCVResponse | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(undefined);

      try {
        const [analysisRes, ohlcvRes] = await Promise.all([
          fetch(`/api/market/analysis/${encodeURIComponent(symbol)}`),
          fetch(`/api/market/ohlcv/${encodeURIComponent(symbol)}?period=1y&interval=1d`),
        ]);

        if (!analysisRes.ok) {
          const err = await analysisRes.json();
          setError(err.error ?? "Analysis unavailable.");
          return;
        }

        setAnalysis(await analysisRes.json());

        if (ohlcvRes.ok) {
          setOhlcv(await ohlcvRes.json());
        }
      } catch {
        setError("Failed to load market data. Is the backend running on port 8000?");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <div>
              <p className="font-medium text-amber-100">No data for {symbol.toUpperCase()}</p>
              <p className="text-sm text-amber-200/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quote = analysis.quote;
  const tech = analysis.technical;
  const fund = analysis.fundamentals;
  const expl = analysis.explanation;
  const isPositive = (quote?.change ?? 0) >= 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-slate-400" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">{analysis.symbol}</h1>
          {fund?.sector && (
            <p className="text-sm text-slate-400">
              {fund.sector}
              {fund.industry ? ` · ${fund.industry}` : ""}
            </p>
          )}
        </div>

        {quote && (
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{formatCurrency(quote.price, quote.currency)}</p>
            <p className={`flex items-center justify-end gap-1 text-sm ${isPositive ? "text-gain" : "text-loss"}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {quote.change != null ? formatCurrency(quote.change, quote.currency) : "—"}
              {quote.change_percent != null && ` (${formatPercent(quote.change_percent)})`}
            </p>
            <p className="text-xs text-slate-500">
              {quote.provider} · {quote.freshness}
            </p>
          </div>
        )}
      </div>

      {analysis.data_warnings.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-amber-200/90">
            {analysis.data_warnings.join(" · ")}
          </CardContent>
        </Card>
      )}

      {ohlcv && ohlcv.bars.length > 0 ? (
        <Card className="glass border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-white">Price Chart</CardTitle>
            <CardDescription className="text-slate-400">
              {ohlcv.bars.length} daily bars via {ohlcv.provider}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StockChart bars={ohlcv.bars} symbol={analysis.symbol} />
          </CardContent>
        </Card>
      ) : (
        <Card className="glass border-border/50">
          <CardContent className="py-8 text-center text-slate-400">
            Chart data unavailable for this symbol.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Market Cap" value={formatLargeNumber(quote?.market_cap)} />
        <Metric label="P/E Ratio" value={fund?.pe_ratio?.toFixed(2) ?? "—"} />
        <Metric label="EPS" value={fund?.eps != null ? `$${fund.eps.toFixed(2)}` : "—"} />
        <Metric label="Dividend Yield" value={fund?.dividend_yield != null ? formatPercent(fund.dividend_yield * 100) : "—"} />
        <Metric label="Volume" value={quote?.volume?.toLocaleString() ?? "—"} />
        <Metric label="RSI (14)" value={tech?.rsi_14?.toFixed(2) ?? "—"} />
        <Metric label="SMA (50)" value={tech?.sma_50 != null ? `$${tech.sma_50.toFixed(2)}` : "—"} />
        <Metric label="Beta" value={fund?.beta?.toFixed(2) ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-white">Technical Indicators</CardTitle>
            <CardDescription className="text-slate-400">
              Computed from {tech?.data_points ?? 0} real OHLCV bars
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm text-slate-200">
            <p>MACD: {tech?.macd?.toFixed(4) ?? "—"}</p>
            <p>MACD Signal: {tech?.macd_signal?.toFixed(4) ?? "—"}</p>
            <p>EMA (12): {tech?.ema_12?.toFixed(2) ?? "—"}</p>
            <p>EMA (26): {tech?.ema_26?.toFixed(2) ?? "—"}</p>
            <p>SMA (200): {tech?.sma_200?.toFixed(2) ?? "—"}</p>
            <p>ATR (14): {tech?.atr_14?.toFixed(2) ?? "—"}</p>
            <p>VWAP: {tech?.vwap?.toFixed(2) ?? "—"}</p>
            <p>ADX (14): {tech?.adx_14?.toFixed(2) ?? "—"}</p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-white">Scores</CardTitle>
            <CardDescription className="text-slate-400">From real indicators — not AI guesses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Technical</span>
              <span className="font-semibold text-white">
                {analysis.scores?.technical_score?.toFixed(0) ?? "—"}/100
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Momentum</span>
              <span className="font-semibold text-white">
                {analysis.scores?.momentum_score?.toFixed(0) ?? "—"}/100
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Risk</span>
              <span className="font-semibold text-white">
                {analysis.scores?.risk_score?.toFixed(0) ?? "—"}/100
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {expl && (
        <Card className="glass border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-white">Research Summary</CardTitle>
              <Badge>{expl.overall_rating}</Badge>
            </div>
            <CardDescription className="text-slate-300 leading-relaxed">
              {expl.investment_thesis}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Reasons</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                {expl.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Potential Risks</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                {expl.potential_risks.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
            <p className="md:col-span-2 text-xs text-slate-500">
              Confidence: {(expl.confidence * 100).toFixed(0)}% (based on data completeness) ·{" "}
              {analysis.disclaimer}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
