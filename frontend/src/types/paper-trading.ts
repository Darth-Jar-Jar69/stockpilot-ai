/** Shared types for the paper trading terminal. */

export type OrderType = "market" | "limit" | "stop_loss" | "take_profit";

export type PaperPosition = {
  symbol: string;
  companyName: string | null;
  shares: number;
  avgCost: number;
  price: number;
  marketValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  portfolioPercent: number;
};

export type PaperTradeRow = {
  id: string;
  symbol: string;
  companyName: string | null;
  side: string;
  shares: number;
  price: number;
  orderType: string;
  commission: number;
  totalValue: number;
  createdAt: string;
  realizedPnl: number | null;
};

export type MarketStatus = {
  isOpen: boolean;
  label: string;
  nextEvent: string;
};

export type PaperAccountState = {
  cash: number;
  startingCash: number;
  equity: number;
  buyingPower: number;
  investedAmount: number;
  positionsValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  marketStatus: MarketStatus;
  lastSynced: string;
  positions: PaperPosition[];
  trades: PaperTradeRow[];
  equityCurve: { time: string; equity: number }[];
};

export type LiveQuote = {
  symbol: string;
  price: number;
  change: number | null;
  change_percent: number | null;
  bid: number;
  ask: number;
  spread: number;
  previous_close: number | null;
  volume: number | null;
  as_of: string;
};

export type ChartTimeframe = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y";

export const CHART_TIMEFRAMES: Record<ChartTimeframe, { period: string; interval: string }> = {
  "1D": { period: "5d", interval: "1h" },
  "5D": { period: "5d", interval: "1d" },
  "1M": { period: "1mo", interval: "1d" },
  "6M": { period: "6mo", interval: "1d" },
  "1Y": { period: "1y", interval: "1d" },
  "5Y": { period: "5y", interval: "1wk" },
};
