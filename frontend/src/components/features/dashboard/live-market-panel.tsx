"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";

type Quote = {
  symbol: string;
  price: number;
  change: number | null;
  change_percent: number | null;
  provider: string;
  freshness: string;
};

type Analysis = {
  symbol: string;
  quote: Quote | null;
  technical: {
    rsi_14: number | null;
    macd_histogram: number | null;
    sma_50: number | null;
    data_points: number;
  } | null;
  scores: {
    technical_score: number | null;
    momentum_score: number | null;
    risk_score: number | null;
  } | null;
  data_warnings: string[];
};

type Health = {
  status: string;
  providers: { name: string; status: string; message?: string }[];
  error?: string;
};

const DEMO_SYMBOL = "AAPL";

/** Dashboard panel showing real market data or clear error states. */
export function LiveMarketPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(undefined);

      try {
        const [healthRes, analysisRes] = await Promise.all([
          fetch("/api/market/health"),
          fetch(`/api/market/analysis/${DEMO_SYMBOL}`),
        ]);

        const healthData = await healthRes.json();
        setHealth(healthData);

        if (!analysisRes.ok) {
          const err = await analysisRes.json().catch(() => ({}));
          setError(
            typeof err.error === "string"
              ? err.error
              : "Unable to load market data. Please refresh in a moment.",
          );
          setAnalysis(null);
        } else {
          const payload = await analysisRes.json();
          setAnalysis(payload);
          if (Array.isArray(payload.data_warnings) && payload.data_warnings.length > 0) {
            // Soft notice only — data still rendered from fallback providers
            setError(undefined);
          }
        }
      } catch {
        setError("Failed to connect to market data services. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  const quote = analysis?.quote;
  const isPositive = (quote?.change ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
            <div>
              <p className="font-medium text-amber-100">Market data unavailable</p>
              <p className="text-sm text-amber-200/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              <Link href={`/analysis/${DEMO_SYMBOL}`} className="hover:text-primary">
                Live Quote — {DEMO_SYMBOL} →
              </Link>
            </CardTitle>
            <CardDescription className="text-slate-400">
              {quote ? `via ${quote.provider} · ${quote.freshness}` : "No data"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quote ? (
              <>
                <p className="text-3xl font-bold text-white">{formatCurrency(quote.price, "USD")}</p>
                <p className={`mt-1 flex items-center gap-1 text-sm ${isPositive ? "text-gain" : "text-loss"}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {quote.change != null ? formatCurrency(quote.change, "USD") : "—"}
                  {quote.change_percent != null && ` (${formatPercent(quote.change_percent)})`}
                </p>
              </>
            ) : (
              <p className="text-slate-400">—</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Technical (real OHLCV)</CardTitle>
            <CardDescription className="text-slate-400">
              {analysis?.technical
                ? `${analysis.technical.data_points} daily bars`
                : "Computed by backend"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-200">
            <p>RSI (14): {analysis?.technical?.rsi_14?.toFixed(2) ?? "—"}</p>
            <p>MACD Hist: {analysis?.technical?.macd_histogram?.toFixed(4) ?? "—"}</p>
            <p>SMA (50): {analysis?.technical?.sma_50?.toFixed(2) ?? "—"}</p>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Scores</CardTitle>
            <CardDescription className="text-slate-400">From real indicators, not AI guesses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-200">
            <p>Technical: {analysis?.scores?.technical_score?.toFixed(0) ?? "—"}</p>
            <p>Momentum: {analysis?.scores?.momentum_score?.toFixed(0) ?? "—"}</p>
            <p>Risk: {analysis?.scores?.risk_score?.toFixed(0) ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Data Provider Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {health?.providers?.map((p) => (
            <Badge
              key={p.name}
              variant={p.status === "ok" ? "default" : "secondary"}
              className="text-slate-100"
            >
              {p.name}: {p.status}
            </Badge>
          )) ?? (
            <span className="text-slate-400">
              {health?.error ?? "Waiting for provider status…"}
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
