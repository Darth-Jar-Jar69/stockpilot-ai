"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PortfolioAnalysis } from "@/types/research";

type Holding = { symbol: string; shares: number; avgCost?: number };

export function PortfolioView() {
  const [holdings, setHoldings] = useState<Holding[]>([{ symbol: "AAPL", shares: 10 }]);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        if (d.holdings?.length) setHoldings(d.holdings);
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setLoading(true);
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings }),
    });
    const data = await res.json();
    setAnalysis(data.analysis);
    setLoading(false);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">Portfolio Intelligence</h1>
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Holdings</CardTitle>
          <CardDescription className="text-slate-400">Saved to your account — analysed with live data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {holdings.map((h, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Input placeholder="Symbol" value={h.symbol} onChange={(e) => { const n = [...holdings]; n[i].symbol = e.target.value.toUpperCase(); setHoldings(n); }} className="w-28 bg-secondary/50" />
              <Input type="number" placeholder="Shares" value={h.shares} onChange={(e) => { const n = [...holdings]; n[i].shares = Number(e.target.value); setHoldings(n); }} className="w-28 bg-secondary/50" />
              <Button variant="ghost" size="icon" onClick={() => setHoldings(holdings.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setHoldings([...holdings, { symbol: "", shares: 0 }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
            <Button onClick={save} disabled={loading}><Save className="mr-2 h-4 w-4" />{loading ? "Analysing…" : "Save & Analyse"}</Button>
          </div>
        </CardContent>
      </Card>
      {analysis && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass border-border/50"><CardContent className="pt-6"><p className="text-xs text-slate-400">Health</p><p className="text-3xl font-bold text-white">{analysis.health_score?.toFixed(0) ?? "—"}/100</p></CardContent></Card>
          <Card className="glass border-border/50"><CardContent className="pt-6"><p className="text-xs text-slate-400">Diversification</p><p className="text-3xl font-bold text-white">{analysis.diversification_score?.toFixed(0) ?? "—"}/100</p></CardContent></Card>
          <Card className="glass border-border/50"><CardContent className="pt-6"><p className="text-xs text-slate-400">Total value</p><p className="text-3xl font-bold text-white">${analysis.total_value?.toLocaleString() ?? "—"}</p></CardContent></Card>
          <Card className="glass border-border/50 md:col-span-3">
            <CardHeader><CardTitle className="text-white">Insights</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {analysis.insights.map((i) => <p key={i}>• {i}</p>)}
              {analysis.weak_positions.length > 0 && (
                <p className="text-amber-300">Weak: {analysis.weak_positions.map((s) => <Link key={s} href={`/analysis/${s}`} className="underline">{s} </Link>)}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
