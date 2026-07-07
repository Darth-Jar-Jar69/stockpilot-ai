"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SymbolSearch } from "@/components/features/analysis/symbol-search";

export function WatchlistView() {
  const [items, setItems] = useState<{ symbol: string }[]>([]);
  const [symbol, setSymbol] = useState("");

  const load = () => fetch("/api/watchlist").then((r) => r.json()).then((d) => setItems(d.items ?? []));

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!symbol.trim()) return;
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol }) });
    setSymbol("");
    load();
  };

  const remove = async (sym: string) => {
    await fetch("/api/watchlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: sym }) });
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">Watchlist</h1>
      <SymbolSearch />
      <Card className="glass border-border/50">
        <CardHeader><CardTitle className="text-white">Add symbol</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="TSLA" className="bg-secondary/50" />
          <Button onClick={add}><Star className="mr-2 h-4 w-4" />Add</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.symbol} className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 px-4 py-3">
            <Link href={`/analysis/${item.symbol}`} className="font-semibold text-white hover:text-primary">{item.symbol}</Link>
            <Button variant="ghost" size="icon" onClick={() => remove(item.symbol)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
