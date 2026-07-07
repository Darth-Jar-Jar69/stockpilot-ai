"use client";

import { useEffect, useState } from "react";
import { Clock, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { NewsArticle, NewsStockMention } from "@/types/scanner";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=240&fit=crop";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StockAffectedRow({ stock }: { stock: NewsStockMention }) {
  const up = stock.change_percent != null && stock.change_percent >= 0;
  const down = stock.change_percent != null && stock.change_percent < 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-white">{stock.symbol}</p>
        {stock.company_name && (
          <p className="truncate text-xs text-slate-500">{stock.company_name}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {stock.price != null && (
          <p className="text-sm font-medium text-slate-200">
            {formatCurrency(stock.price, "USD")}
          </p>
        )}
        <p
          className={`flex items-center justify-end gap-1 text-sm font-semibold ${
            up ? "text-gain" : down ? "text-loss" : "text-slate-400"
          }`}
        >
          {up && <TrendingUp className="h-3.5 w-3.5" />}
          {down && <TrendingDown className="h-3.5 w-3.5" />}
          {stock.change_percent != null ? formatPercent(stock.change_percent) : "—"}
        </p>
      </div>
    </div>
  );
}

export function NewsView() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market/news")
      .then(async (r) => {
        if (!r.ok) {
          setError((await r.json()).error);
          return;
        }
        setArticles(await r.json());
      })
      .catch(() => setError("Failed to load news."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Market News</h1>
        <p className="text-sm text-slate-400">
          Live headlines with affected stocks and today&apos;s price moves
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-amber-300">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {articles.map((a, i) => (
          <Card
            key={`${a.url ?? a.title}-${i}`}
            className="glass group overflow-hidden border-border/50 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="relative h-40 w-full overflow-hidden bg-secondary/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.image_url || PLACEHOLDER_IMAGE}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {a.source && <Badge variant="secondary">{a.source}</Badge>}
                {a.published_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(a.published_at)}
                  </span>
                )}
              </div>

              <h2 className="text-base font-semibold leading-snug text-white">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 hover:text-primary"
                  >
                    {a.title}
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                  </a>
                ) : (
                  a.title
                )}
              </h2>

              {a.summary && (
                <p className="line-clamp-3 text-sm text-slate-400">{a.summary}</p>
              )}

              {(a.related_stocks ?? []).length > 0 && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Stocks affected
                  </p>
                  <div className="space-y-2">
                    {(a.related_stocks ?? []).map((s) => (
                      <StockAffectedRow key={s.symbol} stock={s} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
