"use client";

import { Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PaperAccountState } from "@/types/paper-trading";
import { cn } from "@/lib/utils";

type TradingDashboardProps = {
  account: PaperAccountState;
  isActive: boolean;
};

function Metric({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <Card className="glass border-border/50">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-white">{value}</p>
        {sub && (
          <p
            className={cn(
              "mt-0.5 text-sm tabular-nums",
              positive === true && "text-gain",
              positive === false && "text-loss",
              positive === undefined && "text-slate-400",
            )}
          >
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TradingDashboard({ account, isActive }: TradingDashboardProps) {
  const dash = (v: number) => (isActive ? formatCurrency(v, "USD") : "—");
  const dailyUp = account.dailyPnl >= 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            account.marketStatus.isOpen ? "border-gain/40 text-gain" : "border-slate-500 text-slate-400",
          )}
        >
          <Circle
            className={cn("h-2 w-2 fill-current", account.marketStatus.isOpen && "animate-pulse")}
          />
          {account.marketStatus.label}
        </Badge>
        <span className="text-xs text-slate-500">{account.marketStatus.nextEvent}</span>
        <span className="text-xs text-slate-600">
          Synced {new Date(account.lastSynced).toLocaleTimeString()}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Account Value" value={dash(account.equity)} />
        <Metric label="Available Cash" value={dash(account.cash)} />
        <Metric label="Buying Power" value={dash(account.buyingPower)} />
        <Metric label="Invested" value={dash(account.investedAmount)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Daily P&L"
          value={isActive ? formatCurrency(account.dailyPnl, "USD") : "—"}
          sub={isActive ? formatPercent(account.dailyPnlPercent) : undefined}
          positive={dailyUp}
        />
        <Metric
          label="Total Return"
          value={isActive ? formatCurrency(account.totalPnl, "USD") : "—"}
          sub={isActive && account.startingCash > 0 ? formatPercent(account.totalPnlPercent) : undefined}
          positive={account.totalPnl >= 0}
        />
        <Metric
          label="Portfolio Performance"
          value={
            isActive && account.startingCash > 0
              ? formatPercent(account.totalPnlPercent)
              : "—"
          }
          sub={isActive ? `Since funding · ${formatCurrency(account.startingCash, "USD")} base` : undefined}
        />
      </div>
    </div>
  );
}
