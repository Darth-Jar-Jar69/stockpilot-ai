"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  Flame,
  Newspaper,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnrichedNewsArticle, NewsDesk, NewsSentiment } from "@/lib/market/live-news";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type NewsDeskResponse = {
  as_of: string;
  lead: EnrichedNewsArticle | null;
  articles: EnrichedNewsArticle[];
  pulse: { desk: NewsDesk; count: number; sentiment: NewsSentiment }[];
  movers: {
    symbol: string;
    company_name: string | null;
    change_percent: number | null;
    price: number | null;
  }[];
  error?: string;
};

const DESKS: { id: NewsDesk | "all"; label: string }[] = [
  { id: "all", label: "All desks" },
  { id: "markets", label: "Markets" },
  { id: "tech", label: "Tech" },
  { id: "macro", label: "Macro" },
  { id: "earnings", label: "Earnings" },
  { id: "energy", label: "Energy" },
  { id: "deals", label: "Deals" },
];

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&h=900&fit=crop";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function sentimentClass(s: NewsSentiment): string {
  if (s === "bullish") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (s === "bearish") return "border-rose-500/40 bg-rose-500/15 text-rose-300";
  return "border-slate-500/40 bg-slate-500/15 text-slate-300";
}

function deskLabel(desk: NewsDesk): string {
  return DESKS.find((d) => d.id === desk)?.label ?? desk;
}

export function NewsView() {
  const [data, setData] = useState<NewsDeskResponse | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [desk, setDesk] = useState<NewsDesk | "all">("all");
  const [query, setQuery] = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({ limit: "28", desk });
      if (activeSymbol) params.set("symbol", activeSymbol);
      const res = await fetch(`/api/market/news?${params}`, { cache: "no-store" });
      const json = (await res.json()) as NewsDeskResponse;
      if (!res.ok) {
        setError(json.error ?? "News desk unavailable.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Failed to reach the news desk.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [desk, activeSymbol]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data?.articles) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.articles;
    return data.articles.filter((a) => {
      const hay = `${a.title} ${a.summary ?? ""} ${a.source ?? ""} ${a.symbols.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

  const lead = filtered[0] ?? data?.lead ?? null;
  const rest = lead ? filtered.filter((a) => a.id !== lead.id) : filtered;
  const secondary = rest.slice(0, 3);
  const stream = rest.slice(3);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.08),_transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative space-y-8 p-6 pb-16">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              StockPilot News Desk
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Markets, decoded in real time
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-400">
              A live desk that wires headlines to tickers, prices, and sentiment — so you see{" "}
              <span className="text-slate-200">what moved</span>,{" "}
              <span className="text-slate-200">why it matters</span>, and{" "}
              <span className="text-slate-200">which names are in the blast radius</span>. Built for
              traders and researchers, not doomscrolling.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh desk
            </Button>
            {data?.as_of && (
              <span className="text-xs text-slate-500">
                Updated {new Date(data.as_of).toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headlines, tickers, sources…"
              className="border-border/60 bg-secondary/50 pl-9 text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {DESKS.map((d) => (
              <Button
                key={d.id}
                size="sm"
                variant={desk === d.id ? "default" : "outline"}
                className="h-8"
                onClick={() => {
                  setDesk(d.id);
                  setActiveSymbol(null);
                }}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>

        {data?.movers && data.movers.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40">
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              Tape movers in today&apos;s stories
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 py-3">
              {data.movers.map((m) => {
                const up = (m.change_percent ?? 0) >= 0;
                return (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() =>
                      setActiveSymbol((cur) => (cur === m.symbol ? null : m.symbol))
                    }
                    className={cn(
                      "min-w-[140px] rounded-xl border px-3 py-2 text-left transition",
                      activeSymbol === m.symbol
                        ? "border-primary/50 bg-primary/10"
                        : "border-border/50 bg-secondary/30 hover:border-primary/30",
                    )}
                  >
                    <p className="font-mono text-sm font-semibold text-white">{m.symbol}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {m.company_name ?? "—"}
                    </p>
                    <p className={cn("mt-1 text-sm font-semibold", up ? "text-gain" : "text-loss")}>
                      {m.change_percent != null ? formatPercent(m.change_percent) : "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {data?.pulse && data.pulse.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.pulse.slice(0, 4).map((p) => (
              <div
                key={p.desk}
                className="rounded-xl border border-border/50 bg-card/30 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {deskLabel(p.desk)}
                  </p>
                  <Badge variant="outline" className={sentimentClass(p.sentiment)}>
                    {p.sentiment}
                  </Badge>
                </div>
                <p className="mt-1 text-2xl font-semibold text-white">{p.count}</p>
                <p className="text-xs text-slate-500">active stories on desk</p>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-[420px] w-full rounded-3xl" />
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        )}

        {!loading && lead && (
          <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <a
              href={lead.url ?? "#"}
              target={lead.url ? "_blank" : undefined}
              rel="noreferrer"
              className="group relative block min-h-[420px] overflow-hidden rounded-3xl border border-border/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lead.image_url || PLACEHOLDER}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 space-y-3 p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="bg-primary text-primary-foreground">Lead story</Badge>
                  <Badge variant="outline" className={sentimentClass(lead.sentiment)}>
                    {lead.sentiment}
                  </Badge>
                  <Badge variant="secondary">{deskLabel(lead.desk)}</Badge>
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Clock3 className="h-3.5 w-3.5" />
                    {timeAgo(lead.published_at)}
                  </span>
                  {lead.source && <span className="text-slate-400">{lead.source}</span>}
                </div>
                <h2 className="max-w-4xl text-3xl font-semibold leading-tight text-white md:text-4xl">
                  {lead.title}
                </h2>
                {lead.summary && (
                  <p className="max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
                    {lead.summary}
                  </p>
                )}
                <p className="inline-flex items-start gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-200 backdrop-blur">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {lead.why_it_matters}
                </p>
                {lead.related_stocks.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {lead.related_stocks.map((s) => (
                      <TickerChip key={s.symbol} stock={s} />
                    ))}
                  </div>
                )}
              </div>
            </a>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Newspaper className="h-3.5 w-3.5" />
                On the wire
              </div>
              {secondary.map((story, i) => (
                <article
                  key={story.id}
                  className="group overflow-hidden rounded-2xl border border-border/50 bg-card/40 transition hover:border-primary/35"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="grid grid-cols-[112px_1fr] gap-0 sm:grid-cols-[140px_1fr]">
                    <div className="relative min-h-[110px] overflow-hidden bg-secondary/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={story.image_url || PLACEHOLDER}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <Badge variant="outline" className={cn("text-[10px]", sentimentClass(story.sentiment))}>
                          {story.sentiment}
                        </Badge>
                        <span>{deskLabel(story.desk)}</span>
                        <span>{timeAgo(story.published_at)}</span>
                      </div>
                      <h3 className="text-sm font-semibold leading-snug text-white">
                        {story.url ? (
                          <a
                            href={story.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary"
                          >
                            {story.title}
                          </a>
                        ) : (
                          story.title
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {story.related_stocks.slice(0, 3).map((s) => (
                          <TickerChip key={s.symbol} stock={s} compact />
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {secondary.length === 0 && (
                <p className="rounded-2xl border border-border/40 bg-card/30 p-4 text-sm text-slate-500">
                  More stories will appear here as the desk fills.
                </p>
              )}
            </div>
          </section>
        )}

        {!loading && stream.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Full desk stream</h2>
                <p className="text-sm text-slate-500">
                  Every story tagged to tickers with live session moves.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {stream.map((story, i) => (
                <article
                  key={story.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/35 transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_20px_50px_-30px_rgba(34,197,94,0.55)]"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="relative h-44 overflow-hidden bg-secondary/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={story.image_url || PLACEHOLDER}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={sentimentClass(story.sentiment)}>
                        {story.sentiment}
                      </Badge>
                      <Badge variant="secondary">{deskLabel(story.desk)}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col space-y-3 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{story.source ?? "Wire"}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {timeAgo(story.published_at)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold leading-snug text-white">
                      {story.url ? (
                        <a
                          href={story.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-start gap-1 hover:text-primary"
                        >
                          {story.title}
                          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        story.title
                      )}
                    </h3>
                    {story.summary && (
                      <p className="line-clamp-3 text-sm text-slate-400">{story.summary}</p>
                    )}
                    <p className="rounded-lg border border-border/40 bg-secondary/25 px-3 py-2 text-xs leading-relaxed text-slate-300">
                      <span className="font-medium text-primary">Why it matters · </span>
                      {story.why_it_matters}
                    </p>
                    {story.related_stocks.length > 0 && (
                      <div className="mt-auto space-y-2 border-t border-border/40 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Stocks in the blast radius
                        </p>
                        <div className="space-y-1.5">
                          {story.related_stocks.slice(0, 4).map((s) => (
                            <StockRow key={s.symbol} stock={s} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-border/50 bg-card/30 px-6 py-16 text-center">
            <p className="text-lg font-medium text-white">No stories matched that filter</p>
            <p className="mt-2 text-sm text-slate-500">
              Clear search or switch desks to widen the tape.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TickerChip({
  stock,
  compact = false,
}: {
  stock: {
    symbol: string;
    company_name: string | null;
    price: number | null;
    change_percent: number | null;
  };
  compact?: boolean;
}) {
  const up = (stock.change_percent ?? 0) >= 0;
  return (
    <Link
      href={`/analysis/${stock.symbol}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-xs backdrop-blur transition hover:border-primary/50",
        compact && "bg-secondary/50",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="font-mono font-semibold text-white">{stock.symbol}</span>
      {stock.change_percent != null && (
        <span className={up ? "text-gain" : "text-loss"}>
          {formatPercent(stock.change_percent)}
        </span>
      )}
    </Link>
  );
}

function StockRow({
  stock,
}: {
  stock: {
    symbol: string;
    company_name: string | null;
    price: number | null;
    change_percent: number | null;
  };
}) {
  const up = stock.change_percent != null && stock.change_percent >= 0;
  const down = stock.change_percent != null && stock.change_percent < 0;
  return (
    <Link
      href={`/analysis/${stock.symbol}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-secondary/25 px-3 py-2 transition hover:border-primary/40"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-white">{stock.symbol}</p>
        {stock.company_name && (
          <p className="truncate text-[11px] text-slate-500">{stock.company_name}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {stock.price != null && (
          <p className="text-sm text-slate-200">{formatCurrency(stock.price, "USD")}</p>
        )}
        <p
          className={cn(
            "flex items-center justify-end gap-1 text-sm font-semibold",
            up ? "text-gain" : down ? "text-loss" : "text-slate-400",
          )}
        >
          {up && <TrendingUp className="h-3.5 w-3.5" />}
          {down && <TrendingDown className="h-3.5 w-3.5" />}
          {stock.change_percent != null ? formatPercent(stock.change_percent) : "—"}
        </p>
      </div>
    </Link>
  );
}
