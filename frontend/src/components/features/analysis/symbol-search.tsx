"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Quick symbol lookup — navigates to /analysis/[symbol]. */
export function SymbolSearch() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = symbol.trim().toUpperCase();
    if (trimmed) router.push(`/analysis/${trimmed}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        placeholder="Enter symbol (e.g. AAPL, MSFT)"
        className="max-w-xs border-border/60 bg-secondary/80 text-white placeholder:text-slate-500"
      />
      <Button type="submit" variant="secondary">
        <Search className="mr-2 h-4 w-4" />
        Analyze
      </Button>
    </form>
  );
}
