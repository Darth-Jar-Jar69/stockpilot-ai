import type { Metadata } from "next";

import { LiveMarketPanel } from "@/components/features/dashboard/live-market-panel";
import { MarketIntelligencePanel } from "@/components/features/dashboard/market-intelligence-panel";
import { SymbolSearch } from "@/components/features/analysis/symbol-search";

export const metadata: Metadata = {
  title: "Dashboard",
};

/** Dashboard — portfolio shell with live market data from FastAPI. */
export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-slate-300">
            Live market data from Yahoo Finance &amp; Finnhub — AI-Powered Market Analysis.
          </p>
        </div>
        <SymbolSearch />
      </div>

      <MarketIntelligencePanel />
      <LiveMarketPanel />
    </div>
  );
}
