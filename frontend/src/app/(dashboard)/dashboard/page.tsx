import type { Metadata } from "next";

import { DashboardOverview } from "@/components/features/dashboard/dashboard-overview";
import { SymbolSearch } from "@/components/features/analysis/symbol-search";

export const metadata: Metadata = {
  title: "Dashboard",
};

/** Dashboard — one-screen summary of every StockPilot surface, each card linking into its full page. */
export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-slate-300">
            Your book, your watchlist, the tape and the scanner — summarised. Jump into any card for the full view.
          </p>
        </div>
        <SymbolSearch />
      </div>

      <DashboardOverview />
    </div>
  );
}
