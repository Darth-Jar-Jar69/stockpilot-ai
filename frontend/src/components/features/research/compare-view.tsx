"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GitCompare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ComparisonResponse } from "@/types/research";

export function CompareView() {
  const [symbols, setSymbols] = useState("NVDA,MSFT,AAPL");
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const run = useCallback(async (list?: string) => {
    const target = (list ?? symbols).trim();
    if (!target) return;
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/market/compare?symbols=${encodeURIComponent(target)}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error);
        return;
      }
      setData(await res.json());
    } catch {
      setError("Comparison failed.");
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  // Deep link: /compare?symbols=NVDA,AMD,INTC — pre-fill and run immediately.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const list = new URLSearchParams(window.location.search).get("symbols");
    if (list) {
      const clean = list.toUpperCase().split(",").map((s) => s.trim()).filter(Boolean).join(",");
      setSymbols(clean);
      run(clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">AI Company Comparison</h1>
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Compare symbols</CardTitle>
          <CardDescription className="text-slate-400">Comma-separated tickers — uses live scores</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} className="bg-secondary/50" />
          <Button onClick={() => run()} disabled={loading}><GitCompare className="mr-2 h-4 w-4" />{loading ? "Comparing…" : "Compare"}</Button>
        </CardContent>
      </Card>
      {error && <p className="text-amber-300">{error}</p>}
      {data && (
        <>
          <Card className="glass border-primary/30 bg-primary/5">
            <CardContent className="py-4 text-sm text-slate-200">{data.ai_conclusion}</CardContent>
          </Card>
          <div className="grid gap-3">
            {data.metrics.map((m) => (
              <Link key={m.symbol} href={`/analysis/${m.symbol}`} className="rounded-lg border border-border/40 bg-card/40 p-4 hover:bg-card/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{m.symbol}</p>
                    <p className="text-xs text-slate-400">{m.company_name}</p>
                  </div>
                  <p className="text-lg font-bold text-primary">{m.overall_score?.toFixed(0) ?? "—"}/100</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
