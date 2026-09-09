import { SYMBOL_NAMES } from "@/lib/news-tickers";
import type { MarketStatus } from "@/types/paper-trading";

const COMMISSION_RATE = 0.001;
const MIN_COMMISSION = 1;

/** US market hours (NYSE) — simplified ET check. */
export function getMarketStatus(now = new Date()): MarketStatus {
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const minutes = et.getHours() * 60 + et.getMinutes();
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  if (day === 0 || day === 6) {
    return { isOpen: false, label: "Market Closed", nextEvent: "Opens Monday 9:30 AM ET" };
  }
  if (minutes < open) {
    return { isOpen: false, label: "Pre-Market", nextEvent: "Opens 9:30 AM ET" };
  }
  if (minutes >= close) {
    return { isOpen: false, label: "After Hours", nextEvent: "Opens tomorrow 9:30 AM ET" };
  }
  return { isOpen: true, label: "Market Open", nextEvent: "Closes 4:00 PM ET" };
}

export function companyNameFor(symbol: string): string | null {
  return SYMBOL_NAMES[symbol.toUpperCase()] ?? null;
}

export function simulateBidAsk(price: number): { bid: number; ask: number; spread: number } {
  const spreadPct = 0.0008;
  const half = price * spreadPct * 0.5;
  const bid = Math.round((price - half) * 100) / 100;
  const ask = Math.round((price + half) * 100) / 100;
  return { bid, ask, spread: Math.round((ask - bid) * 100) / 100 };
}

export function calcCommission(shares: number, price: number): number {
  return Math.max(MIN_COMMISSION, Math.round(shares * price * COMMISSION_RATE * 100) / 100);
}

export type OrderInput = {
  orderType: string;
  side: string;
  livePrice: number;
  limitPrice?: number;
  stopPrice?: number;
};

/** Resolve simulated execution price for paper orders. */
export function resolveExecutionPrice(input: OrderInput): { price: number } | { error: string } {
  const { orderType, side, livePrice, limitPrice, stopPrice } = input;
  const { bid, ask } = simulateBidAsk(livePrice);
  const base = side === "buy" ? ask : bid;

  if (orderType === "market") {
    return { price: base };
  }

  if (orderType === "limit") {
    if (!limitPrice || limitPrice <= 0) return { error: "Limit price is required." };
    if (side === "buy" && limitPrice < ask) {
      return { error: `Limit buy $${limitPrice.toFixed(2)} is below ask $${ask.toFixed(2)}.` };
    }
    if (side === "sell" && limitPrice > bid) {
      return { error: `Limit sell $${limitPrice.toFixed(2)} is above bid $${bid.toFixed(2)}.` };
    }
    return { price: limitPrice };
  }

  if (orderType === "stop_loss") {
    if (!stopPrice || stopPrice <= 0) return { error: "Stop price is required." };
    if (side !== "sell") return { error: "Stop-loss applies to sell orders." };
    if (stopPrice > bid) {
      return { error: `Stop not triggered — price above stop $${stopPrice.toFixed(2)}.` };
    }
    return { price: bid };
  }

  if (orderType === "take_profit") {
    if (!stopPrice || stopPrice <= 0) return { error: "Take-profit price is required." };
    if (side !== "sell") return { error: "Take-profit applies to sell orders." };
    if (stopPrice < bid) {
      return { error: `Target not reached — price below $${stopPrice.toFixed(2)}.` };
    }
    return { price: bid };
  }

  return { price: base };
}

export const SEARCHABLE_SYMBOLS = Object.entries(SYMBOL_NAMES).map(([symbol, name]) => ({
  symbol,
  name,
}));

export function searchSymbols(query: string, limit = 12) {
  const q = query.trim().toUpperCase();
  if (!q) return SEARCHABLE_SYMBOLS.slice(0, limit);
  const lower = query.trim().toLowerCase();
  const matches = SEARCHABLE_SYMBOLS.filter(
    (s) =>
      s.symbol.startsWith(q) ||
      s.symbol.includes(q) ||
      s.name.toUpperCase().includes(q) ||
      s.name.toLowerCase().includes(lower),
  ).slice(0, limit);

  // Allow any ticker-like input even if it isn't in the curated list
  if (/^[A-Z][A-Z0-9.\-]{0,6}$/.test(q) && !matches.some((s) => s.symbol === q)) {
    return [{ symbol: q, name: SYMBOL_NAMES[q] ?? q }, ...matches].slice(0, limit);
  }
  return matches;
}
