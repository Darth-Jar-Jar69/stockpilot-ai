"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PortfolioAnalysis } from "@/types/research";

type Holding = { symbol: string; shares: number; avgCost?: number | null };

function isAnalysis(value: unknown): value is PortfolioAnalysis {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.error === "string" && !Array.isArray(v.insights)) return false;
  return "health_score" in v || "insights" in v || "total_value" in v;
}

export function PortfolioView() {
  const [holdings, setHoldings] = useState<Holding[]>([{ symbol: "AAPL", shares: 10 }]);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/portfolio")
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          setError(typeof d?.error === "string" ? d.error : "Could not load portfolio.");
          return;
        }
        const rows = Array.isArray(d?.holdings) ? d.holdings : [];
        if (rows.length > 0) {
          setHoldings(
            rows.map((h: { symbol?: string; shares?: number; avgCost?: number | null }) => ({
              symbol: String(h.symbol ?? "").toUpperCase(),
              shares: Number(h.shares) || 0,
              avgCost: h.avgCost != null ? Number(h.avgCost) : null,
            })),
          );
        }
      })
      .catch(() => setError("Could not load portfolio."));
  }, []);

  const save = async () => {
    setLoading(true);
    setError(undefined);
    setAnalysis(null);
    try {
      const clean = holdings
        .map((h) => ({
          symbol: h.symbol.trim().toUpperCase(),
          shares: Number(h.shares) || 0,
          avgCost: h.avgCost != null && h.avgCost !== ("" as unknown) ? Number(h.avgCost) : null,
        }))
        .filter((h) => h.symbol && h.shares > 0);

      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      if (Array.isArray(data.holdings) && data.holdings.length > 0) {
        setHoldings(
          data.holdings.map((h: Holding) => ({
            symbol: String(h.symbol).toUpperCase(),
            shares: Number(h.shares) || 0,
            avgCost: h.avgCost != null ? Number(h.avgCost) : null,
          })),
        );
      }
      if (isAnalysis(data.analysis)) {
        setAnalysis(data.analysis);
      } else if (data.analysis && typeof data.analysis === "object" && "error" in data.analysis) {
        setError(
          typeof (data.analysis as { error?: string }).error === "string"
            ? (data.analysis as { error: string }).error
            : "Holdings saved. Live portfolio scoring needs the market backend.",
        );
      }
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const insights = Array.isArray(analysis?.insights) ? analysis.insights : [];
  const weak = Array.isArray(analysis?.weak_positions) ? analysis.weak_positions : [];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">Portfolio Intelligence</h1>
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Holdings</CardTitle>
          <CardDescription className="text-slate-400">
            Saved to your account — analysed with live data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(holdings ?? []).map((h, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Input
                placeholder="Symbol"
                value={h.symbol}
                onChange={(e) => {
                  const n = [...holdings];
                  n[i] = { ...n[i]!, symbol: e.target.value.toUpperCase() };
                  setHoldings(n);
                }}
                className="w-28 bg-secondary/50"
              />
              <Input
                type="number"
                placeholder="Shares"
                value={h.shares}
                onChange={(e) => {
                  const n = [...holdings];
                  n[i] = { ...n[i]!, shares: Number(e.target.value) };
                  setHoldings(n);
                }}
                className="w-28 bg-secondary/50"
              />
              <Input
                type="number"
                placeholder="Avg cost"
                value={h.avgCost ?? ""}
                onChange={(e) => {
                  const n = [...holdings];
                  const v = e.target.value;
                  n[i] = { ...n[i]!, avgCost: v === "" ? null : Number(v) };
                  setHoldings(n);
                }}
                className="w-28 bg-secondary/50"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHoldings(holdings.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setHoldings([...holdings, { symbol: "", shares: 0, avgCost: null }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
            <Button onClick={save} disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Analysing…" : "Save & Analyse"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">Health</p>
              <p className="text-3xl font-bold text-white">
                {analysis.health_score?.toFixed(0) ?? "—"}/100
              </p>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">Diversification</p>
              <p className="text-3xl font-bold text-white">
                {analysis.diversification_score?.toFixed(0) ?? "—"}/100
              </p>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">Total value</p>
              <p className="text-3xl font-bold text-white">
                ${analysis.total_value?.toLocaleString() ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="glass border-border/50 md:col-span-3">
            <CardHeader>
              <CardTitle className="text-white">Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {insights.length > 0 ? (
                insights.map((i) => <p key={i}>• {i}</p>)
              ) : (
                <p className="text-slate-500">No insights yet — save holdings to refresh the score.</p>
              )}
              {weak.length > 0 && (
                <p className="text-amber-300">
                  Weak:{" "}
                  {weak.map((s) => (
                    <Link key={s} href={`/analysis/${s}`} className="underline">
                      {s}{" "}
                    </Link>
                  ))}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
