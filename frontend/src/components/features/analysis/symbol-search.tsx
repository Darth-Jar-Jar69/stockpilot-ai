"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchSymbols } from "@/lib/paper-trading-market";
import { resolveSymbolQuery } from "@/lib/news-tickers";

/** Quick symbol lookup — navigates to /analysis/[symbol]. Supports company names. */
export function SymbolSearch() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => searchSymbols(symbol, 8), [symbol]);

  const go = (raw: string) => {
    const resolved = resolveSymbolQuery(raw) ?? raw.trim().toUpperCase();
    if (!resolved) return;
    setSymbol(resolved);
    setOpen(false);
    router.push(`/analysis/${encodeURIComponent(resolved)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    go(symbol);
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex gap-2">
      <div className="relative max-w-xs flex-1">
        <Input
          value={symbol}
          onChange={(e) => {
            setSymbol(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Symbol or name (SNPS, Synopsys…)"
          className="border-border/60 bg-secondary/80 text-white placeholder:text-slate-500"
          autoComplete="off"
        />
        {open && symbol.trim().length > 0 && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border/60 bg-card shadow-lg">
            {suggestions.map((s) => (
              <li key={s.symbol}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/80"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(s.symbol)}
                >
                  <span className="font-medium text-white">{s.symbol}</span>
                  <span className="truncate pl-3 text-xs text-slate-400">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="submit" variant="secondary">
        <Search className="mr-2 h-4 w-4" />
        Analyze
      </Button>
    </form>
  );
}
