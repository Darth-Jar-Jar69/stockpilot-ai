"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PaperPosition } from "@/types/paper-trading";
import { cn } from "@/lib/utils";

type PositionsTableProps = {
  positions: PaperPosition[];
  onSelect: (symbol: string) => void;
  onTrade: (symbol: string, side: "buy" | "sell", shares?: number) => void;
};

export function PositionsTable({ positions, onSelect, onTrade }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">No open positions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="text-white">Open Positions</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left text-xs uppercase text-slate-500">
              <th className="pb-2 pr-3">Symbol</th>
              <th className="pb-2 pr-3">Shares</th>
              <th className="pb-2 pr-3">Avg Cost</th>
              <th className="pb-2 pr-3">Last</th>
              <th className="pb-2 pr-3">Day</th>
              <th className="pb-2 pr-3">P&L</th>
              <th className="pb-2 pr-3">Value</th>
              <th className="pb-2 pr-3">%</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr
                key={p.symbol}
                className="border-b border-border/20 hover:bg-secondary/20"
              >
                <td className="py-2.5 pr-3">
                  <button
                    type="button"
                    onClick={() => onSelect(p.symbol)}
                    className="text-left"
                  >
                    <p className="font-mono font-semibold text-white">{p.symbol}</p>
                    <p className="text-xs text-slate-500">{p.companyName ?? "—"}</p>
                  </button>
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-slate-200">{p.shares.toFixed(2)}</td>
                <td className="py-2.5 pr-3 tabular-nums">{formatCurrency(p.avgCost, "USD")}</td>
                <td className="py-2.5 pr-3 tabular-nums">{formatCurrency(p.price, "USD")}</td>
                <td
                  className={cn(
                    "py-2.5 pr-3 tabular-nums",
                    p.dayChangePercent >= 0 ? "text-gain" : "text-loss",
                  )}
                >
                  {formatPercent(p.dayChangePercent)}
                </td>
                <td
                  className={cn(
                    "py-2.5 pr-3 tabular-nums",
                    p.pnl >= 0 ? "text-gain" : "text-loss",
                  )}
                >
                  {formatCurrency(p.pnl, "USD")}
                  <span className="ml-1 text-xs">({formatPercent(p.pnlPercent)})</span>
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-slate-200">
                  {formatCurrency(p.marketValue, "USD")}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-slate-400">
                  {p.portfolioPercent.toFixed(1)}%
                </td>
                <td className="py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onTrade(p.symbol, "buy")}>
                      +
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onTrade(p.symbol, "sell")}>
                      Sell
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onTrade(p.symbol, "sell", p.shares)}
                    >
                      Close
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
