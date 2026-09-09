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

function compactNumber(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(digits)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(digits)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(digits)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(digits)}K`;
  return value.toFixed(digits);
}

type Fund = Record<string, unknown>;

function fnum(fund: Fund | null, key: string): number | null {
  const v = fund?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

const fmtX = (v: number | null, d = 2) => (v == null ? "—" : `${v.toFixed(d)}×`);
const fmtPctFrac = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const fmtSignedPct = (v: number | null, d = 1) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;

function StatRow({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss" | null;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/30 py-2 text-sm last:border-b-0">
      <span className="text-slate-400" title={hint}>
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RangeBar({
  low,
  high,
  value,
  format,
}: {
  low: number | null;
  high: number | null;
  value: number | null;
  format: (v: number) => string;
}) {
  if (low == null || high == null || value == null || high <= low) return <span className="text-slate-500">—</span>;
  const pct = Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
  return (
    <div className="w-full">
      <div className="flex justify-between font-mono text-[11px] text-slate-400">
        <span>{format(low)}</span>
        <span>{format(high)}</span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-secondary">
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function valuationBadgeClass(label?: string): string {
  if (label === "Undervalued") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (label === "Overvalued") return "bg-rose-500/20 text-rose-300 border-rose-500/40";
  if (label === "About fair") return "bg-amber-500/15 text-amber-200 border-amber-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

/** Next-gen company research page — live fundamentals + fair value + explained scores. */
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
  const currency = quote?.currency ?? "USD";
  const fund = research.fundamentals as Fund | null;
  const sp = research.stockpilot_scores;
  const fv = research.fair_value;
  const report = research.equity_report;
  const isPositive = (quote?.change ?? 0) >= 0;
  const money = (v: number) => formatCurrency(v, currency);

  // Debt/equity: our live layer stores a ratio; the FastAPI/yfinance path stores percent.
  const rawDe = fnum(fund, "debt_to_equity");
  const debtToEquity = rawDe == null ? null : rawDe > 5 ? rawDe / 100 : rawDe;
  const returns = (fund?.returns ?? null) as Record<string, number | null> | null;
  const gaapDistorted = fund?.gaap_distorted === true;
  const price = quote?.price ?? fnum(fund, "price");
  const yearHigh = fnum(fund, "fifty_two_week_high");
  const yearLow = fnum(fund, "fifty_two_week_low");
  const drawdown =
    yearHigh != null && price != null && yearHigh > 0 ? ((yearHigh - price) / yearHigh) * 100 : null;
  const fvPos =
    fv?.fair_value_low != null && fv.fair_value_high != null && price != null
      ? (() => {
          const span = fv.fair_value_high - fv.fair_value_low;
          const lo = fv.fair_value_low - span * 0.6;
          const hi = fv.fair_value_high + span * 0.6;
          return {
            lo,
            hi,
            pricePct: Math.max(2, Math.min(98, ((price - lo) / (hi - lo)) * 100)),
            bandStart: ((fv.fair_value_low - lo) / (hi - lo)) * 100,
            bandEnd: ((fv.fair_value_high - lo) / (hi - lo)) * 100,
            midPct: fv.fair_value_mid != null ? ((fv.fair_value_mid - lo) / (hi - lo)) * 100 : null,
          };
        })()
      : null;

  return (
    <div className="space-y-8 p-6">
      <div className="sticky top-0 z-30 -mx-6 border-b border-border/40 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-400">
              <span className="font-mono text-white">{research.symbol}</span>
              {research.company_name ? ` · ${research.company_name}` : ""}
            </p>
            {quote && (
              <p className="text-lg font-semibold text-white">
                {formatCurrency(quote.price, currency)}
                {quote.change_percent != null && (
                  <span className={`ml-2 text-sm ${isPositive ? "text-gain" : "text-loss"}`}>
                    {formatPercent(quote.change_percent)}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sp?.overall.score != null && (
              <Badge className="text-sm">Score {sp.overall.score.toFixed(0)}/100</Badge>
            )}
            {fv?.valuation_label && (
              <Badge variant="outline" className={valuationBadgeClass(fv.valuation_label)}>
                {fv.valuation_label}
                {fv.upside_percent != null ? ` · ${formatPercent(fv.upside_percent)}` : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-slate-400" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">
            {research.company_name ?? research.symbol}
          </h1>
          <p className="text-lg text-slate-400">{research.symbol}</p>
          {typeof fund?.sector === "string" && fund.sector && (
            <p className="text-sm text-slate-500">
              {fund.sector}
              {typeof fund.industry === "string" && fund.industry ? ` · ${fund.industry}` : ""}
              {typeof fund.exchange === "string" && fund.exchange ? ` · ${fund.exchange}` : ""}
            </p>
          )}
          {report?.investment_thesis && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
              {report.investment_thesis}
            </p>
          )}
        </div>
        {quote && (
          <div className="text-right">
            <p className="text-4xl font-bold text-white">
              {formatCurrency(quote.price, currency)}
            </p>
            <p
              className={`flex items-center justify-end gap-1 ${isPositive ? "text-gain" : "text-loss"}`}
            >
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {quote.change_percent != null && formatPercent(quote.change_percent)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Live via {quote.provider} · {quote.freshness}
            </p>
          </div>
        )}
      </div>

      {research.data_warnings.length > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {research.data_warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {ohlcv && ohlcv.bars.length > 0 ? (
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-white">Price Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <StockChart bars={ohlcv.bars} symbol={research.symbol} />
            </CardContent>
          </Card>
        ) : (
          <div />
        )}

        <StatPanel title="Trading Information">
          <StatRow
            label="Previous close"
            value={quote?.previous_close != null ? money(quote.previous_close) : fnum(fund, "previous_close") != null ? money(fnum(fund, "previous_close")!) : "—"}
          />
          <div className="border-b border-border/30 py-2 text-sm">
            <p className="mb-1 text-slate-400">Day range</p>
            <RangeBar low={fnum(fund, "day_low")} high={fnum(fund, "day_high")} value={price} format={money} />
          </div>
          <div className="border-b border-border/30 py-2 text-sm">
            <p className="mb-1 flex items-center justify-between text-slate-400">
              <span>52-week range</span>
              {drawdown != null && (
                <span className="text-xs text-slate-500">{drawdown.toFixed(0)}% below high</span>
              )}
            </p>
            <RangeBar low={yearLow} high={yearHigh} value={price} format={money} />
          </div>
          <StatRow label="Market cap" value={quote?.market_cap != null ? `${currency === "USD" ? "$" : ""}${compactNumber(quote.market_cap)}` : "—"} />
          <StatRow label="Enterprise value" value={fnum(fund, "enterprise_value") != null ? `${currency === "USD" ? "$" : ""}${compactNumber(fnum(fund, "enterprise_value"))}` : "—"} />
          <StatRow label="Shares outstanding" value={compactNumber(fnum(fund, "shares_outstanding"))} />
          <StatRow
            label="Volume / avg"
            value={`${compactNumber(quote?.volume ?? fnum(fund, "volume"), 1)} / ${compactNumber(fnum(fund, "avg_volume_30d"), 1)}`}
          />
          <StatRow label="Beta" value={fnum(fund, "beta")?.toFixed(2) ?? "—"} />
          <StatRow label="Dividend yield" value={fnum(fund, "dividend_yield") != null ? fmtPctFrac(fnum(fund, "dividend_yield"), 2) : "0.00%"} />
        </StatPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatPanel title="Valuation">
          <StatRow label="P/E (GAAP, TTM)" value={fmtX(fnum(fund, "pe_ratio"), 2)} hint="Price ÷ trailing-twelve-month GAAP EPS" />
          <StatRow label="P/E (forward)" value={fmtX(fnum(fund, "forward_pe"), 2)} hint="Price ÷ Street next-twelve-month EPS estimate" />
          <StatRow label="P/E (normalized, last FY)" value={fmtX(fnum(fund, "pe_normalized"), 2)} hint="Excludes extraordinary items. Morningstar's 'normalized' additionally uses adjusted (non-GAAP) EPS, so it can be lower." />
          <StatRow label="PEG" value={fnum(fund, "peg_ratio")?.toFixed(2) ?? "—"} />
          <StatRow label="Price/Sales" value={fmtX(fnum(fund, "ps_ratio"), 2)} />
          <StatRow label="Price/Book" value={fmtX(fnum(fund, "pb_ratio"), 2)} />
          <StatRow label="Price/Cash flow" value={fmtX(fnum(fund, "pcf_ratio"), 2)} />
        </StatPanel>

        <StatPanel title="Profitability">
          <StatRow label="Gross margin" value={fmtPctFrac(fnum(fund, "gross_margin"))} />
          <StatRow label="Operating margin" value={fmtPctFrac(fnum(fund, "operating_margin"))} />
          <StatRow label="Net margin" value={fmtPctFrac(fnum(fund, "profit_margin"))} />
          <StatRow label="Return on equity" value={fmtPctFrac(fnum(fund, "return_on_equity"))} />
          <StatRow label="Return on assets" value={fmtPctFrac(fnum(fund, "return_on_assets"))} />
          <StatRow label="EPS (GAAP, TTM)" value={fnum(fund, "eps") != null ? money(fnum(fund, "eps")!) : "—"} />
          <StatRow label="EPS (forward est.)" value={fnum(fund, "eps_forward") != null ? money(fnum(fund, "eps_forward")!) : "—"} />
        </StatPanel>

        <StatPanel title="Financial Strength">
          <StatRow label="Current ratio" value={fnum(fund, "current_ratio")?.toFixed(2) ?? "—"} />
          <StatRow label="Quick ratio" value={fnum(fund, "quick_ratio")?.toFixed(2) ?? "—"} />
          <StatRow label="Debt/Equity" value={fmtX(debtToEquity, 2)} />
          <StatRow label="Interest coverage" value={fmtX(fnum(fund, "interest_coverage"), 1)} />
          <StatRow label="Book value / share" value={fnum(fund, "book_value_per_share") != null ? money(fnum(fund, "book_value_per_share")!) : "—"} />
          <StatRow label="Cash flow / share" value={fnum(fund, "cash_flow_per_share") != null ? money(fnum(fund, "cash_flow_per_share")!) : "—"} />
        </StatPanel>

        <StatPanel title="Growth & Performance">
          <StatRow label="Revenue growth (3-yr CAGR)" value={fmtPctFrac(fnum(fund, "revenue_growth_3y"))} tone={(fnum(fund, "revenue_growth_3y") ?? 0) >= 0 ? "gain" : "loss"} />
          <StatRow label={`Revenue growth (TTM)${gaapDistorted ? " *" : ""}`} value={fmtPctFrac(fnum(fund, "revenue_growth"))} tone={(fnum(fund, "revenue_growth") ?? 0) >= 0 ? "gain" : "loss"} hint={gaapDistorted ? "Includes acquired revenue" : undefined} />
          <StatRow label="EPS growth (3-yr CAGR)" value={fmtPctFrac(fnum(fund, "eps_growth_3y"))} tone={(fnum(fund, "eps_growth_3y") ?? 0) >= 0 ? "gain" : "loss"} />
          <StatRow label={`EPS growth (TTM, GAAP)${gaapDistorted ? " *" : ""}`} value={fmtPctFrac(fnum(fund, "eps_growth"))} tone={(fnum(fund, "eps_growth") ?? 0) >= 0 ? "gain" : "loss"} hint={gaapDistorted ? "Distorted by one-off / acquisition charges" : undefined} />
          {returns && (
            <div className="mt-2 grid grid-cols-3 gap-2 pt-2">
              {(
                [
                  ["1W", returns.one_week],
                  ["1M", returns.one_month],
                  ["3M", returns.three_month],
                  ["6M", returns.six_month],
                  ["YTD", returns.ytd],
                  ["1Y", returns.one_year],
                ] as [string, number | null][]
              ).map(([k, v]) => (
                <div key={k} className="rounded-md border border-border/40 bg-secondary/30 px-2 py-1.5 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{k}</p>
                  <p className={`font-mono text-xs font-semibold ${v == null ? "text-slate-500" : v >= 0 ? "text-gain" : "text-loss"}`}>
                    {fmtSignedPct(v)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </StatPanel>
      </div>

      {sp && (
        <div>
          <h2 className="mb-2 text-xl font-semibold text-white">StockPilot Scores</h2>
          <p className="mb-4 max-w-3xl text-sm text-slate-400">
            Each card explains <span className="text-slate-200">why</span> the score is where it is
            (reasons) and what could go wrong (risks). Overall blends financial health, growth,
            value, quality, momentum, and risk — similar in spirit to multi-factor research dashboards.
          </p>
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

      {fv && (
        <Card className="glass border-border/50">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-white">Fair Value Engine</CardTitle>
              {fv.valuation_label && (
                <Badge variant="outline" className={valuationBadgeClass(fv.valuation_label)}>
                  {fv.valuation_label}
                </Badge>
              )}
            </div>
            <CardDescription className="text-slate-400">{fv.disclaimer}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {fvPos && fv.fair_value_low != null && fv.fair_value_high != null && price != null && (
              <div className="pt-4">
                <p className="mb-6 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Price vs fair value
                </p>
                <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-500/50 via-amber-400/50 to-rose-500/50">
                  <div
                    className="absolute inset-y-0 rounded-sm border-x border-white/40 bg-white/10"
                    style={{ left: `${fvPos.bandStart}%`, width: `${fvPos.bandEnd - fvPos.bandStart}%` }}
                  />
                  {fvPos.midPct != null && (
                    <div className="absolute -top-1 bottom-[-4px] w-0.5 bg-primary" style={{ left: `${fvPos.midPct}%` }} />
                  )}
                  <div
                    className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-background px-2 py-0.5 font-mono text-[11px] text-white shadow"
                    style={{ left: `${fvPos.pricePct}%` }}
                  >
                    Price {money(price)}
                  </div>
                  <div
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-white shadow"
                    style={{ left: `${fvPos.pricePct}%` }}
                  />
                </div>
                <div className="relative mt-2 h-4 font-mono text-[11px] text-slate-400">
                  <span className="absolute -translate-x-1/2" style={{ left: `${fvPos.bandStart}%` }}>
                    {money(fv.fair_value_low)}
                  </span>
                  {fvPos.midPct != null && fv.fair_value_mid != null && (
                    <span className="absolute -translate-x-1/2 text-primary" style={{ left: `${fvPos.midPct}%` }}>
                      {money(fv.fair_value_mid)}
                    </span>
                  )}
                  <span className="absolute -translate-x-1/2" style={{ left: `${fvPos.bandEnd}%` }}>
                    {money(fv.fair_value_high)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Current</p>
                <p className="text-lg font-bold text-white">
                  {fv.current_price != null ? formatCurrency(fv.current_price, currency) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Fair Value (mid)</p>
                <p className="text-lg font-bold text-primary">
                  {fv.fair_value_mid != null ? formatCurrency(fv.fair_value_mid, currency) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Range</p>
                <p className="text-sm text-slate-200">
                  {fv.fair_value_low != null && fv.fair_value_high != null
                    ? `${formatCurrency(fv.fair_value_low, currency)} – ${formatCurrency(fv.fair_value_high, currency)}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Model upside</p>
                <p
                  className={`text-lg font-bold ${(fv.upside_percent ?? 0) >= 0 ? "text-gain" : "text-loss"}`}
                >
                  {fv.upside_percent != null ? formatPercent(fv.upside_percent) : "—"}
                </p>
              </div>
            </div>
            {fv.assumptions && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
                <span>
                  Growth assumption{" "}
                  <span className="font-mono text-slate-200">
                    {fv.assumptions.growth_rate != null ? `${(fv.assumptions.growth_rate * 100).toFixed(1)}%` : "—"}
                  </span>
                </span>
                <span>
                  Fair P/E{" "}
                  <span className="font-mono text-slate-200">{fv.assumptions.fair_pe?.toFixed(1) ?? "—"}×</span>
                </span>
                <span>
                  Discount rate{" "}
                  <span className="font-mono text-slate-200">{(fv.assumptions.discount_rate * 100).toFixed(0)}%</span>
                </span>
                <span>
                  Exit P/E{" "}
                  <span className="font-mono text-slate-200">{fv.assumptions.terminal_pe?.toFixed(0) ?? "—"}×</span>
                </span>
                <span>
                  Confidence <span className="font-mono text-slate-200">{fv.confidence}/100</span>
                </span>
              </div>
            )}

            {fv.methods.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  How we got here
                </p>
                {fv.methods.map((m) => {
                  const gap =
                    m.estimate != null && price != null && price > 0 ? ((m.estimate - price) / price) * 100 : null;
                  return (
                    <div
                      key={m.name}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200">
                          {m.name}
                          {m.weight != null && (
                            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-slate-400">
                              weight {m.weight.toFixed(2)}
                            </span>
                          )}
                        </p>
                        {m.note && <p className="text-xs text-slate-500">{m.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-slate-100">
                          {m.estimate != null ? formatCurrency(m.estimate, currency) : "—"}
                        </p>
                        {gap != null && (
                          <p className={`font-mono text-[11px] ${gap >= 0 ? "text-gain" : "text-loss"}`}>
                            {fmtSignedPct(gap, 0)} vs price
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              {report.bull_case.map((b) => (
                <p key={b}>• {b}</p>
              ))}
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-loss">Bear Case</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {report.bear_case.map((b) => (
                <p key={b}>• {b}</p>
              ))}
            </CardContent>
          </Card>
          <Card className="glass border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white">Equity Analyst Notes</CardTitle>
              <CardDescription className="text-slate-300">{report.investment_thesis}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-slate-400 md:grid-cols-2">
              <div>
                <p className="mb-1 font-medium text-slate-200">Growth opportunities</p>
                {report.growth_opportunities.map((g) => (
                  <p key={g}>• {g}</p>
                ))}
              </div>
              <div>
                <p className="mb-1 font-medium text-slate-200">Competitive advantages</p>
                {report.competitive_advantages.map((g) => (
                  <p key={g}>• {g}</p>
                ))}
              </div>
              <div>
                <p className="mb-1 font-medium text-slate-200">Catalysts</p>
                {report.catalysts.map((g) => (
                  <p key={g}>• {g}</p>
                ))}
              </div>
              <div>
                <p className="mb-1 font-medium text-slate-200">Main risks</p>
                {report.main_risks.map((g) => (
                  <p key={g}>• {g}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {research.disclaimer}
        {gaapDistorted ? " * Marked figures include acquisition effects or one-off charges." : ""}
      </p>
    </div>
  );
}
