"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PaperTradeRow } from "@/types/paper-trading";
import { cn } from "@/lib/utils";

type TradeHistoryTableProps = {
  trades: PaperTradeRow[];
};

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="text-white">Transaction History</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {trades.length === 0 ? (
          <p className="text-sm text-slate-400">No trades yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-xs uppercase text-slate-500">
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Symbol</th>
                <th className="pb-2 pr-3">Action</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Qty</th>
                <th className="pb-2 pr-3">Price</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2 pr-3">Fee</th>
                <th className="pb-2">Realized P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-border/20">
                  <td className="py-2 pr-3 text-xs text-slate-400">
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-mono font-medium text-white">{t.symbol}</span>
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 font-medium uppercase",
                      t.side === "buy" ? "text-gain" : "text-loss",
                    )}
                  >
                    {t.side}
                  </td>
                  <td className="py-2 pr-3 text-xs capitalize text-slate-400">
                    {t.orderType.replace("_", " ")}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{t.shares.toFixed(2)}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatCurrency(t.price, "USD")}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatCurrency(t.totalValue, "USD")}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-400">
                    {formatCurrency(t.commission, "USD")}
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 tabular-nums",
                      t.realizedPnl != null && t.realizedPnl >= 0 ? "text-gain" : "text-loss",
                    )}
                  >
                    {t.realizedPnl != null ? formatCurrency(t.realizedPnl, "USD") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
