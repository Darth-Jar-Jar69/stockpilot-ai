"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/utils";
import type { MarketIntelligence } from "@/types/research";

export function MarketIntelligencePanel() {
  const [data, setData] = useState<MarketIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market/intelligence")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="text-white">Market Intelligence</CardTitle>
        <CardDescription className="text-slate-400">
          {data.briefing.headline} · {data.briefing.sentiment}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-300">{data.briefing.summary}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.indices.map((idx) => (
            <div key={idx.symbol} className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
              <p className="text-xs text-slate-400">{idx.name}</p>
              <p className="text-sm font-semibold text-white">{idx.price?.toFixed(2) ?? "—"}</p>
              {idx.change_percent != null && (
                <p className={idx.change_percent >= 0 ? "text-gain text-xs" : "text-loss text-xs"}>
                  {formatPercent(idx.change_percent)}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
