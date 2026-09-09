"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Brain,
  Clock3,
  Flame,
  GitCompare,
  LayoutDashboard,
  LineChart,
  Loader2,
  MessageCircle,
  Newspaper,
  Plus,
  Radio,
  RefreshCw,
  ScanSearch,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnrichedNewsArticle, NewsDesk, NewsDeskPayload, NewsSentiment } from "@/lib/market/live-news";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type NewsDeskResponse = NewsDeskPayload & { error?: string };

const DESKS: { id: NewsDesk | "all"; label: string }[] = [
  { id: "all", label: "All desks" },
  { id: "markets", label: "Markets" },
  { id: "tech", label: "Tech" },
  { id: "macro", label: "Macro" },
  { id: "earnings", label: "Earnings" },
  { id: "energy", label: "Energy" },
  { id: "deals", label: "Deals" },
];

const JUMP_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, blurb: "Everything at a glance" },
  { href: "/scanner", label: "Scanner", icon: ScanSearch, blurb: "Top-ranked setups + Fallen Giants" },
  { href: "/screener", label: "Screener", icon: Activity, blurb: "Filter the universe" },
  { href: "/compare", label: "Compare", icon: GitCompare, blurb: "Side-by-side fundamentals" },
  { href: "/watchlist", label: "Watchlist", icon: LineChart, blurb: "Names you follow" },
  { href: "/portfolio", label: "Portfolio", icon: Wallet, blurb: "Holdings & exposure" },
  { href: "/paper-trading", label: "Paper Trading", icon: Brain, blurb: "Trade the headline risk-free" },
  { href: "/backtesting", label: "Backtesting", icon: BarChart3, blurb: "Test a strategy on history" },
  { href: "/assistant", label: "AI Assistant", icon: MessageCircle, blurb: "Ask about any story" },
] as const;

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&h=900&fit=crop";

const PAGE_SIZE = 24;

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

function dedupeKey(a: EnrichedNewsArticle): string {
  return (a.url || a.title).toLowerCase().replace(/\W+/g, "").slice(0, 80);
}

export function NewsView() {
  const [head, setHead] = useState<NewsDeskResponse | null>(null);
  const [articles, setArticles] = useState<EnrichedNewsArticle[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [desk, setDesk] = useState<NewsDesk | "all">("all");
  const [query, setQuery] = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const seen = useRef<Set<string>>(new Set());
  const emptyStreak = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestId = useRef(0);

  // Deep link: /news?symbol=NVDA
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sym = new URLSearchParams(window.location.search).get("symbol");
    if (sym) setActiveSymbol(sym.toUpperCase());
  }, []);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.items) setWatchlist(new Set(j.items.map((i: { symbol: string }) => i.symbol.toUpperCase())));
      })
      .catch(() => undefined);
  }, []);

  const fetchPage = useCallback(
    async (p: number): Promise<NewsDeskResponse | null> => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), desk, page: String(p) });
      if (activeSymbol) params.set("symbol", activeSymbol);
      const res = await fetch(`/api/market/news?${params}`, { cache: "no-store" });
      const json = (await res.json()) as NewsDeskResponse;
      if (!res.ok) throw new Error(json.error ?? "News desk unavailable.");
      return json;
    },
    [desk, activeSymbol],
  );

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(undefined);
    seen.current = new Set();
    emptyStreak.current = 0;
    try {
      const json = await fetchPage(0);
      if (id !== requestId.current || !json) return;
      const fresh: EnrichedNewsArticle[] = [];
      for (const a of json.articles) {
        const k = dedupeKey(a);
        if (seen.current.has(k)) continue;
        seen.current.add(k);
        fresh.push(a);
      }
      setHead(json);
      setArticles(fresh);
      setPage(0);
      setHasMore(json.has_more);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to reach the news desk.");
      setHead(null);
      setArticles([]);
      setHasMore(false);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const json = await fetchPage(next);
      if (id !== requestId.current || !json) return;
      const fresh: EnrichedNewsArticle[] = [];
      for (const a of json.articles) {
        const k = dedupeKey(a);
        if (seen.current.has(k)) continue;
        seen.current.add(k);
        fresh.push(a);
      }
      emptyStreak.current = fresh.length === 0 ? emptyStreak.current + 1 : 0;
      setArticles((cur) => [...cur, ...fresh]);
      setPage(next);
      setHasMore(json.has_more && emptyStreak.current < 4);
    } catch {
      // Transient failure — keep hasMore so the observer can retry on the next intersection.
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleWatch = useCallback(
    async (symbol: string) => {
      const inList = watchlist.has(symbol);
      setWatchlist((cur) => {
        const n = new Set(cur);
        if (inList) n.delete(symbol);
        else n.add(symbol);
        return n;
      });
      try {
        const res = await fetch("/api/watchlist", {
          method: inList ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        if (!res.ok) throw new Error();
        setToast(inList ? `${symbol} removed from watchlist` : `${symbol} added to watchlist`);
      } catch {
        setWatchlist((cur) => {
          const n = new Set(cur);
          if (inList) n.add(symbol);
          else n.delete(symbol);
          return n;
        });
        setToast("Sign in to use the watchlist");
      }
    },
    [watchlist],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const hay = `${a.title} ${a.summary ?? ""} ${a.source ?? ""} ${a.symbols.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [articles, query]);

  const lead = filtered[0] ?? null;
  const rest = lead ? filtered.slice(1) : filtered;
  const secondary = rest.slice(0, 3);
  const stream = rest.slice(3);
  const moverSymbols = (head?.movers ?? []).slice(0, 4).map((m) => m.symbol);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.08),_transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:48px_48px]" />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/60 bg-background/95 px-4 py-2 text-sm text-white shadow-xl backdrop-blur">
          {toast}
        </div>
      )}

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
              An endless, ticker-aware tape. Every story links straight into{" "}
              <span className="text-slate-200">research</span>, <span className="text-slate-200">compare</span>,{" "}
              <span className="text-slate-200">backtests</span> and <span className="text-slate-200">paper trades</span> —
              read it, then act on it without leaving the flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh desk
            </Button>
            {head?.as_of && (
              <span className="text-xs text-slate-500">Updated {new Date(head.as_of).toLocaleTimeString()}</span>
            )}
          </div>
        </header>

        {/* Jump-to rail */}
        <nav aria-label="Jump to" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {JUMP_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex min-w-[168px] shrink-0 items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2.5 transition hover:border-primary/40 hover:bg-card/70"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <l.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{l.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{l.blurb}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter loaded headlines, tickers, sources…"
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
                onClick={() => setDesk(d.id)}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>

        {activeSymbol && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
            <span className="text-slate-200">
              Showing the full wire for <span className="font-mono font-semibold text-white">{activeSymbol}</span> — scroll for
              older coverage.
            </span>
            <Link href={`/analysis/${activeSymbol}`} className="text-primary hover:underline">
              Open research →
            </Link>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setActiveSymbol(null)}>
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        )}

        {head?.movers && head.movers.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                Tape movers in today&apos;s stories
              </span>
              {moverSymbols.length >= 2 && (
                <Link
                  href={`/compare?symbols=${moverSymbols.join(",")}`}
                  className="inline-flex items-center gap-1 normal-case tracking-normal text-primary hover:underline"
                >
                  <GitCompare className="h-3.5 w-3.5" /> Compare top movers
                </Link>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 py-3">
              {head.movers.map((m) => {
                const up = (m.change_percent ?? 0) >= 0;
                return (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => setActiveSymbol((cur) => (cur === m.symbol ? null : m.symbol))}
                    className={cn(
                      "min-w-[140px] rounded-xl border px-3 py-2 text-left transition",
                      activeSymbol === m.symbol
                        ? "border-primary/50 bg-primary/10"
                        : "border-border/50 bg-secondary/30 hover:border-primary/30",
                    )}
                  >
                    <p className="font-mono text-sm font-semibold text-white">{m.symbol}</p>
                    <p className="truncate text-[11px] text-slate-500">{m.company_name ?? "—"}</p>
                    <p className={cn("mt-1 text-sm font-semibold", up ? "text-gain" : "text-loss")}>
                      {m.change_percent != null ? formatPercent(m.change_percent) : "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {head?.pulse && head.pulse.length > 0 && !activeSymbol && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {head.pulse.slice(0, 4).map((p) => (
              <button
                key={p.desk}
                type="button"
                onClick={() => setDesk(p.desk)}
                className="rounded-xl border border-border/50 bg-card/30 px-4 py-3 text-left transition hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{deskLabel(p.desk)}</p>
                  <Badge variant="outline" className={sentimentClass(p.sentiment)}>
                    {p.sentiment}
                  </Badge>
                </div>
                <p className="mt-1 text-2xl font-semibold text-white">{p.count}</p>
                <p className="text-xs text-slate-500">stories on desk · click to focus</p>
              </button>
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
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>
        )}

        {!loading && lead && (
          <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="group relative block min-h-[440px] overflow-hidden rounded-3xl border border-border/50">
              <a href={lead.url ?? "#"} target={lead.url ? "_blank" : undefined} rel="noreferrer" className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lead.image_url || PLACEHOLDER}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
              </a>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-3 p-6 md:p-8">
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
                <h2 className="max-w-4xl text-3xl font-semibold leading-tight text-white md:text-4xl">{lead.title}</h2>
                {lead.summary && (
                  <p className="max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">{lead.summary}</p>
                )}
                <p className="inline-flex items-start gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-200 backdrop-blur">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {lead.why_it_matters}
                </p>
                <div className="pointer-events-auto">
                  <StoryActions story={lead} watchlist={watchlist} onWatch={toggleWatch} onFocus={setActiveSymbol} light />
                </div>
              </div>
            </article>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Newspaper className="h-3.5 w-3.5" />
                On the wire
              </div>
              {secondary.map((story) => (
                <article
                  key={story.id}
                  className="group overflow-hidden rounded-2xl border border-border/50 bg-card/40 transition hover:border-primary/35"
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
                          <a href={story.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                            {story.title}
                          </a>
                        ) : (
                          story.title
                        )}
                      </h3>
                      <StoryActions story={story} watchlist={watchlist} onWatch={toggleWatch} onFocus={setActiveSymbol} compact />
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
                  Every story tagged to tickers with live session moves — keeps loading as you scroll.
                </p>
              </div>
              <span className="text-xs text-slate-500">{filtered.length} loaded</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {stream.map((story) => (
                <article
                  key={story.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/35 transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_20px_50px_-30px_rgba(34,197,94,0.55)]"
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
                        <a href={story.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 hover:text-primary">
                          {story.title}
                          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        story.title
                      )}
                    </h3>
                    {story.summary && <p className="line-clamp-3 text-sm text-slate-400">{story.summary}</p>}
                    <p className="rounded-lg border border-border/40 bg-secondary/25 px-3 py-2 text-xs leading-relaxed text-slate-300">
                      <span className="font-medium text-primary">Why it matters · </span>
                      {story.why_it_matters}
                    </p>
                    {story.related_stocks.length > 0 && (
                      <div className="mt-auto space-y-2 border-t border-border/40 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stocks in the blast radius</p>
                        <div className="space-y-1.5">
                          {story.related_stocks.slice(0, 4).map((s) => (
                            <StockRow key={s.symbol} stock={s} />
                          ))}
                        </div>
                      </div>
                    )}
                    <StoryActions story={story} watchlist={watchlist} onWatch={toggleWatch} onFocus={setActiveSymbol} compact />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-border/50 bg-card/30 px-6 py-16 text-center">
            <p className="text-lg font-medium text-white">No stories matched that filter</p>
            <p className="mt-2 text-sm text-slate-500">Clear search or switch desks to widen the tape.</p>
          </div>
        )}

        {/* Infinite-scroll sentinel */}
        <div ref={sentinelRef} className="flex h-16 items-center justify-center text-sm text-slate-500">
          {loadingMore && (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading more from the wire…
            </span>
          )}
          {!loadingMore && !hasMore && articles.length > 0 && <span>You&apos;ve reached the end of the tape for now.</span>}
        </div>
      </div>
    </div>
  );
}

function StoryActions({
  story,
  watchlist,
  onWatch,
  onFocus,
  compact = false,
  light = false,
}: {
  story: EnrichedNewsArticle;
  watchlist: Set<string>;
  onWatch: (symbol: string) => void;
  onFocus: (symbol: string) => void;
  compact?: boolean;
  light?: boolean;
}) {
  const primary = story.related_stocks[0]?.symbol ?? story.symbols[0] ?? null;
  const compareSet = story.symbols.slice(0, 3);
  const chip = cn(
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition",
    light
      ? "border-white/15 bg-black/40 text-slate-200 backdrop-blur hover:border-primary/50"
      : "border-border/50 bg-secondary/40 text-slate-300 hover:border-primary/40 hover:text-white",
  );

  return (
    <div className={cn("flex flex-wrap gap-1.5", compact ? "pt-1" : "pt-1")}>
      {story.related_stocks.slice(0, compact ? 2 : 4).map((s) => (
        <TickerChip key={s.symbol} stock={s} compact={compact} light={light} />
      ))}
      {primary && (
        <>
          <button type="button" className={chip} onClick={() => onFocus(primary)} title={`All ${primary} coverage`}>
            <Newspaper className="h-3 w-3" /> Wire
          </button>
          <Link href={`/paper-trading?symbol=${primary}`} className={chip} title="Paper trade this name">
            <Brain className="h-3 w-3" /> Trade
          </Link>
          <Link href={`/backtesting?symbol=${primary}`} className={chip} title="Backtest a strategy on this name">
            <BarChart3 className="h-3 w-3" /> Backtest
          </Link>
          <button
            type="button"
            className={cn(chip, watchlist.has(primary) && "border-primary/50 text-primary")}
            onClick={() => onWatch(primary)}
            title={watchlist.has(primary) ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Plus className="h-3 w-3" /> {watchlist.has(primary) ? "Watching" : "Watch"}
          </button>
        </>
      )}
      {compareSet.length >= 2 && (
        <Link href={`/compare?symbols=${compareSet.join(",")}`} className={chip} title="Compare the names in this story">
          <GitCompare className="h-3 w-3" /> Compare
        </Link>
      )}
    </div>
  );
}

function TickerChip({
  stock,
  compact = false,
  light = false,
}: {
  stock: { symbol: string; company_name: string | null; price: number | null; change_percent: number | null };
  compact?: boolean;
  light?: boolean;
}) {
  const up = (stock.change_percent ?? 0) >= 0;
  return (
    <Link
      href={`/analysis/${stock.symbol}`}
      title={`${stock.company_name ?? stock.symbol} — open research`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition hover:border-primary/50",
        light ? "border-white/15 bg-black/40 backdrop-blur" : "border-border/50 bg-secondary/50",
        compact && "text-[11px]",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="font-mono font-semibold text-white">{stock.symbol}</span>
      {stock.change_percent != null && (
        <span className={up ? "text-gain" : "text-loss"}>{formatPercent(stock.change_percent)}</span>
      )}
    </Link>
  );
}

function StockRow({
  stock,
}: {
  stock: { symbol: string; company_name: string | null; price: number | null; change_percent: number | null };
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
        {stock.company_name && <p className="truncate text-[11px] text-slate-500">{stock.company_name}</p>}
      </div>
      <div className="shrink-0 text-right">
        {stock.price != null && <p className="text-sm text-slate-200">{formatCurrency(stock.price, "USD")}</p>}
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
