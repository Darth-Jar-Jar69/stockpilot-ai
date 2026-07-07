import { ScreenerView } from "@/components/features/scanner/screener-view";

export const metadata = {
  title: "Stock Screener | StockPilot",
  description: "Filter stocks by RSI, technical score, and sector using live data.",
};

export default function ScreenerPage() {
  return <ScreenerView />;
}
