"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Flame,
  GitCompare,
  LineChart,
  MessageCircle,
  Newspaper,
  ScanSearch,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { NewsDeskPayload } from "@/lib/market/live-news";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { PaperAccountState } from "@/types/paper-trading";
import type { MarketIntelligence } from "@/types/research";
import type { FallenGiantsResponse, ScannerResponse } from "@/types/scanner";

// ---------------------------------------------------------------------------
// Tiny fetch hook — every card loads independently so one slow provider never blocks the page.
// ---------------------------------------------------------------------------
function useResource<T>(url: string | null, init?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    fetch(url, { cache: "no-store", ...init })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok) {
          setError(typeof j?.error === "string" ? j.error : r.status === 401 ? "Sign in to see this" : "Unavailable");
          setData(null);
        } else {
          setData(j as T);
          setError(null);
        }
      })
      .catch(() => alive && setError("Unavailable"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, error, loading };
}

type QuoteLite = { symbol: string; price: number; change_percent: number | null };

function useQuotes(symbols: string[]) {
  const key = symbols.join(",");
  const [quotes, setQuotes] = useState<Record<string, QuoteLite>>({});
  useEffect(() => {
    if (!key) return;
    let alive = true;
    Promise.all(
      key.split(",").map(async (s) => {
        try {
          const r = await fetch(`/api/market/quote/${encodeURIComponent(s)}`);
          if (!r.ok) return null;
          const j = (await r.json()) as QuoteLite;
          return typeof j.price === "number" ? { symbol: s, price: j.price, change_percent: j.change_percent ?? null } : null;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (!alive) return;
      const map: Record<string, QuoteLite> = {};
      for (const q of rows) if (q) map[q.symbol] = q;
      setQuotes(map);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return quotes;
}

// ---------------------------------------------------------------------------

function Panel({
  title,
  href,
  icon: Icon,
  cta = "Open",
  children,
  className,
  accent,
}: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  cta?: string;
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <Card className={cn("glass flex flex-col border-border/50", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary", accent)}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        <Link href={href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {cta} <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("font-mono text-base font-semibold", tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function Row({
  symbol,
  name,
  right,
  sub,
  href,
}: {
  symbol: string;
  name?: string | null;
  right: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
}) {
  return (
    <Link
      href={href ?? `/analysis/${symbol}`}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-secondary/40"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-white">{symbol}</p>
        {name && <p className="truncate text-[11px] text-slate-500">{name}</p>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm">{right}</div>
        {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
      </div>
    </Link>
  );
}

const pctTone = (v: number | null | undefined) => (v == null ? null : v >= 0 ? "gain" : "loss");
const Pct = ({ v }: { v: number | null | undefined }) => (
  <span className={cn("font-mono", v == null ? "text-slate-500" : v >= 0 ? "text-gain" : "text-loss")}>
    {v == null ? "—" : formatPercent(v)}
  </span>
);

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2 py-3 text-sm text-slate-500">
      <p>{text}</p>
      <Link href={href} className="text-primary hover:underline">
        {cta} →
      </Link>
    </div>
  );
}

function Lines({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-8 rounded-md" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function DashboardOverview() {
  const intel = useResource<MarketIntelligence>("/api/market/intelligence");
  const paper = useResource<PaperAccountState>("/api/paper-trading");
  const portfolio = useResource<{ holdings: { symbol: string; shares: number; avgCost: number | null }[] }>("/api/portfolio");
  const watch = useResource<{ items: { symbol: string }[] }>("/api/watchlist");
  const scanner = useResource<ScannerResponse>("/api/market/scanner?limit=6");
  const giants = useResource<FallenGiantsResponse>("/api/market/scanner/fallen-giants?limit=4");
  const news = useResource<NewsDeskPayload>("/api/market/news?limit=8");
  const health = useResource<{ providers?: { name: string; status: string }[] }>("/api/market/health");

  const holdingSymbols = (portfolio.data?.holdings ?? []).map((h) => h.symbol.toUpperCase()).slice(0, 8);
  const watchSymbols = (watch.data?.items ?? []).map((w) => w.symbol.toUpperCase()).slice(0, 8);
  const quotes = useQuotes([...new Set([...holdingSymbols, ...watchSymbols])]);

  // Portfolio roll-up from live quotes
  const holdings = (portfolio.data?.holdings ?? []).map((h) => {
    const q = quotes[h.symbol.toUpperCase()];
    const value = q ? q.price * h.shares : null;
    const cost = h.avgCost != null ? h.avgCost * h.shares : null;
    return { ...h, symbol: h.symbol.toUpperCase(), value, cost, pnl: value != null && cost != null ? value - cost : null, day: q?.change_percent ?? null };
  });
  const pfValue = holdings.reduce((a, h) => a + (h.value ?? 0), 0);
  const pfCost = holdings.reduce((a, h) => a + (h.cost ?? 0), 0);
  const pfPnl = pfCost > 0 ? pfValue - pfCost : null;
  const pfDay = holdings.reduce((a, h) => a + (h.value != null && h.day != null ? (h.value * h.day) / 100 : 0), 0);
  const topHoldings = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 4);

  const watchRows = watchSymbols
    .map((s) => ({ symbol: s, q: quotes[s] }))
    .sort((a, b) => Math.abs(b.q?.change_percent ?? 0) - Math.abs(a.q?.change_percent ?? 0))
    .slice(0, 5);

  const p = paper.data;
  const topPositions = [...(p?.positions ?? [])].sort((a, b) => b.marketValue - a.marketValue).slice(0, 3);
  const recentTrades = (p?.trades ?? []).slice(0, 3);

  const scan = scanner.data?.results ?? [];
  const fg = giants.data?.results ?? [];
  const headlines = news.data?.articles ?? [];
  const movers = news.data?.movers ?? [];
  const okProviders = (health.data?.providers ?? []).filter((x) => x.status === "ok").length;

  return (
    <div className="space-y-6">
      {/* Market tape */}
      <Card className="glass border-border/50">
        <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            {intel.loading ? (
              <Skeleton className="h-5 w-80" />
            ) : intel.data ? (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                  {intel.data.briefing.headline}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase",
                      intel.data.briefing.sentiment === "bullish"
                        ? "border-emerald-500/40 text-emerald-300"
                        : intel.data.briefing.sentiment === "bearish"
                          ? "border-rose-500/40 text-rose-300"
                          : "border-slate-500/40 text-slate-300",
                    )}
                  >
                    {intel.data.briefing.sentiment}
                  </Badge>
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{intel.data.briefing.summary}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Market briefing unavailable.</p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            {(intel.data?.indices ?? []).slice(0, 4).map((idx) => (
              <div key={idx.symbol} className="rounded-lg border border-border/40 bg-card/40 px-3 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{idx.name}</p>
                <p className="font-mono text-sm font-semibold text-white">{idx.price?.toFixed(0) ?? "—"}</p>
                <Pct v={idx.change_percent} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Paper trading */}
        <Panel title="Paper Trading" href="/paper-trading" icon={Brain} cta="Trade">
          {paper.loading ? (
            <Lines />
          ) : paper.error || !p ? (
            <Empty text={paper.error ?? "No paper account yet."} href="/paper-trading" cta="Open the simulator" />
          ) : p.startingCash === 0 && p.trades.length === 0 ? (
            <Empty text="Account not funded yet." href="/paper-trading" cta="Fund $100k and start trading" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Equity" value={formatCurrency(p.equity, "USD")} />
                <Stat label="Day P&L" value={formatCurrency(p.dailyPnl, "USD")} tone={pctTone(p.dailyPnl)} />
                <Stat label="Total P&L" value={formatPercent(p.totalPnlPercent)} tone={pctTone(p.totalPnl)} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Cash {formatCurrency(p.cash, "USD")}</span>
                <span>{p.positions.length} positions · {p.trades.length} trades</span>
                <span className={p.marketStatus?.isOpen ? "text-emerald-400" : ""}>{p.marketStatus?.label ?? ""}</span>
              </div>
              {topPositions.length > 0 && (
                <div className="-mx-2 border-t border-border/40 pt-2">
                  {topPositions.map((pos) => (
                    <Row
                      key={pos.symbol}
                      symbol={pos.symbol}
                      name={`${pos.shares} sh · ${pos.portfolioPercent.toFixed(0)}% of book`}
                      right={<Pct v={pos.pnlPercent} />}
                      sub={formatCurrency(pos.marketValue, "USD")}
                    />
                  ))}
                </div>
              )}
              {recentTrades.length > 0 && (
                <div className="border-t border-border/40 pt-2 text-[11px] text-slate-500">
                  Last: {recentTrades.map((t) => `${t.side.toUpperCase()} ${t.shares} ${t.symbol} @ ${t.price.toFixed(2)}`).join(" · ")}
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Portfolio */}
        <Panel title="Portfolio" href="/portfolio" icon={Wallet}>
          {portfolio.loading ? (
            <Lines />
          ) : portfolio.error ? (
            <Empty text={portfolio.error} href="/portfolio" cta="Open portfolio" />
          ) : holdings.length === 0 ? (
            <Empty text="No holdings tracked yet." href="/portfolio" cta="Add your positions" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Value" value={pfValue > 0 ? formatCurrency(pfValue, "USD") : "—"} />
                <Stat label="Today" value={pfValue > 0 ? formatPercent((pfDay / pfValue) * 100) : "—"} tone={pctTone(pfDay)} />
                <Stat label="Unrealized" value={pfPnl != null ? formatPercent((pfPnl / pfCost) * 100) : "—"} tone={pctTone(pfPnl)} />
              </div>
              <p className="text-[11px] text-slate-500">{holdings.length} holdings · largest positions</p>
              <div className="-mx-2">
                {topHoldings.map((h) => (
                  <Row
                    key={h.symbol}
                    symbol={h.symbol}
                    name={`${h.shares} sh${h.value != null && pfValue > 0 ? ` · ${((h.value / pfValue) * 100).toFixed(0)}%` : ""}`}
                    right={<Pct v={h.day} />}
                    sub={h.value != null ? formatCurrency(h.value, "USD") : "—"}
                  />
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Watchlist */}
        <Panel title="Watchlist" href="/watchlist" icon={LineChart}>
          {watch.loading ? (
            <Lines />
          ) : watch.error ? (
            <Empty text={watch.error} href="/watchlist" cta="Open watchlist" />
          ) : watchRows.length === 0 ? (
            <Empty text="Nothing on the watchlist." href="/news" cta="Add names from the news desk" />
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">{watchSymbols.length} names · biggest moves today</p>
              <div className="-mx-2">
                {watchRows.map(({ symbol, q }) => (
                  <Row
                    key={symbol}
                    symbol={symbol}
                    right={<Pct v={q?.change_percent} />}
                    sub={q ? formatCurrency(q.price, "USD") : "—"}
                  />
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Scanner */}
        <Panel title="Market Scanner" href="/scanner" icon={ScanSearch} cta="Full scan">
          {scanner.loading ? (
            <Lines n={5} />
          ) : scan.length === 0 ? (
            <Empty text={scanner.error ?? "Scanner idle."} href="/scanner" cta="Run a scan" />
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">
                Top-ranked setups of {scanner.data?.universe_size ?? scan.length} scanned
              </p>
              <div className="-mx-2">
                {scan.slice(0, 5).map((r) => (
                  <Row
                    key={r.symbol}
                    symbol={r.symbol}
                    name={r.recommendation ?? r.overall_rating ?? r.company_name}
                    right={
                      <span className="font-mono text-white">
                        {r.stockpilot_score != null ? `${r.stockpilot_score.toFixed(0)}/100` : "—"}
                      </span>
                    }
                    sub={<Pct v={r.change_percent} />}
                  />
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Fallen giants */}
        <Panel title="Fallen Giants" href="/scanner" icon={Flame} cta="See all" accent="bg-amber-500/15 text-amber-300">
          {giants.loading ? (
            <Lines />
          ) : fg.length === 0 ? (
            <Empty text={giants.error ?? "No qualifying drawdowns right now."} href="/scanner" cta="Open scanner" />
          ) : (
            <div className="-mx-2">
              {fg.slice(0, 4).map((g) => (
                <Row
                  key={g.symbol}
                  symbol={g.symbol}
                  name={g.company_name}
                  right={
                    <span className="inline-flex items-center gap-1 font-mono text-loss">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {g.decline_percent != null ? `${g.decline_percent.toFixed(0)}%` : "—"}
                    </span>
                  }
                  sub={
                    <span>
                      recovery {g.recovery_score ?? "—"} · FG {g.fallen_giants_score ?? "—"}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        {/* News */}
        <Panel title="News Desk" href="/news" icon={Newspaper} cta="Full tape" className="md:col-span-2 xl:col-span-1">
          {news.loading ? (
            <Lines n={5} />
          ) : headlines.length === 0 ? (
            <Empty text={news.error ?? "Wire quiet."} href="/news" cta="Open the desk" />
          ) : (
            <div className="space-y-3">
              {movers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {movers.slice(0, 6).map((m) => (
                    <Link
                      key={m.symbol}
                      href={`/news?symbol=${m.symbol}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/40 px-2 py-0.5 text-[11px]"
                    >
                      <span className="font-mono font-semibold text-white">{m.symbol}</span>
                      <Pct v={m.change_percent} />
                    </Link>
                  ))}
                </div>
              )}
              <ul className="space-y-2">
                {headlines.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        a.sentiment === "bullish" ? "bg-emerald-400" : a.sentiment === "bearish" ? "bg-rose-400" : "bg-slate-500",
                      )}
                    />
                    <div className="min-w-0">
                      <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="line-clamp-2 leading-snug text-slate-200 hover:text-primary">
                        {a.title}
                      </a>
                      <p className="text-[11px] text-slate-500">
                        {a.source} · {a.symbols.slice(0, 3).join(", ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Tools strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/screener", icon: Activity, title: "Screener", blurb: "Filter by RSI, momentum, price and technical score." },
          { href: "/compare", icon: GitCompare, title: "Compare", blurb: movers.length >= 2 ? `Try ${movers.slice(0, 3).map((m) => m.symbol).join(" vs ")}` : "Side-by-side scores and fundamentals." },
          { href: "/backtesting", icon: BarChart3, title: "Backtesting", blurb: "SMA 20/50 crossover on live Yahoo history." },
          { href: "/assistant", icon: MessageCircle, title: "AI Assistant", blurb: "Ask about any ticker, headline or setup." },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 p-3 transition hover:border-primary/40 hover:bg-card/70"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <t.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium text-white">
                {t.title} <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
              </span>
              <span className="block text-xs text-slate-500">{t.blurb}</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className={cn("h-1.5 w-1.5 rounded-full", okProviders > 0 ? "bg-emerald-400" : "bg-slate-500")} />
        {health.data?.providers
          ? `${okProviders}/${health.data.providers.length} data providers live`
          : "Checking data providers…"}
        {" · "}
        <TrendingUp className="inline h-3 w-3" /> Research aids only — not financial advice.
      </p>
    </div>
  );
}
