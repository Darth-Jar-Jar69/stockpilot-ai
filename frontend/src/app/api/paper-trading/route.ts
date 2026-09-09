import { NextResponse } from "next/server";

import {
  calcCommission,
  companyNameFor,
  getMarketStatus,
  resolveExecutionPrice,
  simulateBidAsk,
} from "@/lib/paper-trading-market";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { computePaperPositions, getOrCreateUserProfile } from "@/lib/paper-trading";
import type { PaperAccountState, PaperPosition, PaperTradeRow } from "@/types/paper-trading";

import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

type QuoteData = {
  price: number;
  change: number | null;
  change_percent: number | null;
  previous_close: number | null;
  volume: number | null;
  as_of: string;
};

async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/quotes/${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.price === "number") {
        return {
          price: data.price,
          change: data.change ?? null,
          change_percent: data.change_percent ?? null,
          previous_close: data.previous_close ?? null,
          volume: data.volume ?? null,
          as_of: data.as_of ?? new Date().toISOString(),
        };
      }
    }
  } catch {
    // fall through to Yahoo
  }

  try {
    const { yahooQuoteFallback } = await import("@/lib/market/yahoo-fallback");
    const data = await yahooQuoteFallback(symbol);
    return {
      price: data.price,
      change: data.change,
      change_percent: data.change_percent,
      previous_close: data.change != null ? data.price - data.change : null,
      volume: null,
      as_of: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function computeRealizedPnl(
  trade: { id: string; symbol: string; side: string; shares: number; price: number },
  allTrades: { id: string; symbol: string; side: string; shares: number; price: number }[],
): number | null {
  if (trade.side !== "sell") return null;
  const prior = allTrades.filter(
    (t) => t.symbol === trade.symbol && t.id !== trade.id && new Date(0) <= new Date(0),
  );
  const buys = prior.filter((t) => t.side === "buy");
  if (buys.length === 0) return null;
  const avgCost = buys.reduce((s, t) => s + t.shares * t.price, 0) / buys.reduce((s, t) => s + t.shares, 0);
  return (trade.price - avgCost) * trade.shares;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getOrCreateUserProfile(session.userId);
  const trades = await prisma.paperTrade.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });

  const positions = computePaperPositions(trades);
  const symbols = [...new Set(positions.map((p) => p.symbol))];
  const quoteEntries = await Promise.all(symbols.map(async (s) => [s, await fetchQuote(s)] as const));
  const quoteMap = Object.fromEntries(quoteEntries) as Record<string, QuoteData | null>;

  let positionsValue = 0;
  let investedAmount = 0;
  let dailyPnl = 0;

  const enriched: PaperPosition[] = positions.map((p) => {
    const q = quoteMap[p.symbol];
    const price = q?.price ?? p.avgCost;
    const marketValue = p.shares * price;
    const cost = p.shares * p.avgCost;
    positionsValue += marketValue;
    investedAmount += cost;

    const prevClose = q?.previous_close ?? price;
    const dayChange = (price - prevClose) * p.shares;
    dailyPnl += dayChange;

    return {
      symbol: p.symbol,
      companyName: companyNameFor(p.symbol),
      shares: p.shares,
      avgCost: p.avgCost,
      price,
      marketValue,
      cost,
      pnl: marketValue - cost,
      pnlPercent: cost > 0 ? ((marketValue - cost) / cost) * 100 : 0,
      dayChange,
      dayChangePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      portfolioPercent: 0,
    };
  });

  const cash = profile.paperCashBalance;
  const equity = cash + positionsValue;
  const starting = profile.paperStartingCash;
  const totalPnl = equity - starting;
  const totalPnlPercent = starting > 0 ? (totalPnl / starting) * 100 : 0;
  const dailyPnlPercent = equity > 0 ? (dailyPnl / equity) * 100 : 0;

  for (const p of enriched) {
    p.portfolioPercent = equity > 0 ? (p.marketValue / equity) * 100 : 0;
  }

  let runningCash = starting;
  const holdings = new Map<string, { shares: number; avgCost: number }>();
  const equityCurve: { time: string; equity: number }[] = [];

  if (starting > 0 || trades.length > 0 || cash > 0) {
    const startTime =
      trades.length > 0
        ? new Date(trades[0].createdAt.getTime() - 1000)
        : new Date(profile.createdAt);
    equityCurve.push({ time: startTime.toISOString(), equity: starting });

    for (const t of trades) {
      const sym = t.symbol.toUpperCase();
      const pos = holdings.get(sym) ?? { shares: 0, avgCost: 0 };

      if (t.side === "buy") {
        runningCash -= t.shares * t.price + (t.commission ?? 0);
        const totalShares = pos.shares + t.shares;
        pos.avgCost =
          totalShares > 0
            ? (pos.shares * pos.avgCost + t.shares * t.price) / totalShares
            : t.price;
        pos.shares = totalShares;
      } else {
        const sell = Math.min(t.shares, pos.shares);
        runningCash += sell * t.price - (t.commission ?? 0);
        pos.shares -= sell;
        if (pos.shares <= 0) {
          pos.shares = 0;
          pos.avgCost = 0;
        }
      }
      holdings.set(sym, pos);

      let posVal = 0;
      for (const [symbol, h] of holdings) {
        if (h.shares > 0) {
          const px = symbol === sym ? t.price : (quoteMap[symbol]?.price ?? h.avgCost);
          posVal += h.shares * px;
        }
      }
      equityCurve.push({ time: t.createdAt.toISOString(), equity: runningCash + posVal });
    }

    if (trades.length > 0) {
      const lastPoint = equityCurve[equityCurve.length - 1];
      const lastMs = new Date(lastPoint.time).getTime();
      const snapTime = new Date(Math.max(Date.now(), lastMs + 1000));
      equityCurve.push({ time: snapTime.toISOString(), equity });
    } else if (cash > 0 && cash !== starting) {
      equityCurve.push({ time: new Date().toISOString(), equity });
    }
  }

  const tradeRows: PaperTradeRow[] = [...trades].reverse().map((t) => ({
    id: t.id,
    symbol: t.symbol,
    companyName: companyNameFor(t.symbol),
    side: t.side,
    shares: t.shares,
    price: t.price,
    orderType: t.orderType ?? "market",
    commission: t.commission ?? 0,
    totalValue: t.shares * t.price,
    createdAt: t.createdAt.toISOString(),
    realizedPnl: computeRealizedPnl(t, trades),
  }));

  const response: PaperAccountState = {
    cash,
    startingCash: starting,
    equity,
    buyingPower: cash,
    investedAmount,
    positionsValue,
    totalPnl,
    totalPnlPercent,
    dailyPnl,
    dailyPnlPercent,
    marketStatus: getMarketStatus(),
    lastSynced: new Date().toISOString(),
    positions: enriched,
    trades: tradeRows,
    equityCurve,
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.action === "fund") {
    const amount = Number(body.amount ?? 100_000);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid fund amount." }, { status: 400 });
    }

    const profile = await getOrCreateUserProfile(session.userId);
    const updated = await prisma.userProfile.update({
      where: { userId: session.userId },
      data: {
        paperCashBalance: profile.paperCashBalance + amount,
        paperStartingCash: profile.paperStartingCash + amount,
      },
    });

    return NextResponse.json({
      cash: updated.paperCashBalance,
      startingCash: updated.paperStartingCash,
      funded: amount,
    });
  }

  const symbol = String(body.symbol ?? "").toUpperCase();
  const side = String(body.side ?? "buy").toLowerCase();
  const shares = Number(body.shares);
  const orderType = String(body.orderType ?? "market").toLowerCase();
  const limitPrice = body.limitPrice != null ? Number(body.limitPrice) : undefined;
  const stopPrice = body.stopPrice != null ? Number(body.stopPrice) : undefined;

  if (!symbol || !shares || shares <= 0 || !["buy", "sell"].includes(side)) {
    return NextResponse.json({ error: "Invalid trade." }, { status: 400 });
  }

  const quote = await fetchQuote(symbol);
  if (quote == null) {
    return NextResponse.json({ error: "Could not fetch live price." }, { status: 503 });
  }

  const execution = resolveExecutionPrice({
    orderType,
    side,
    livePrice: quote.price,
    limitPrice,
    stopPrice,
  });
  if ("error" in execution) {
    return NextResponse.json({ error: execution.error }, { status: 400 });
  }

  const price = execution.price;
  const commission = calcCommission(shares, price);
  const gross = shares * price;
  const totalCost = side === "buy" ? gross + commission : gross - commission;

  const profile = await getOrCreateUserProfile(session.userId);
  const priorTrades = await prisma.paperTrade.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });
  const positions = computePaperPositions(priorTrades);
  const held = positions.find((p) => p.symbol === symbol)?.shares ?? 0;

  if (side === "sell" && shares > held + 0.0001) {
    return NextResponse.json(
      { error: `Insufficient shares. You hold ${held.toFixed(4)} ${symbol}.` },
      { status: 400 },
    );
  }

  if (side === "buy" && totalCost > profile.paperCashBalance + 0.01) {
    return NextResponse.json(
      {
        error: `Insufficient buying power. Need $${totalCost.toFixed(2)} (incl. $${commission.toFixed(2)} commission).`,
      },
      { status: 400 },
    );
  }

  const [trade] = await prisma.$transaction([
    prisma.paperTrade.create({
      data: {
        userId: session.userId,
        symbol,
        side,
        shares,
        price,
        orderType,
        limitPrice: limitPrice ?? null,
        commission,
      },
    }),
    prisma.userProfile.update({
      where: { userId: session.userId },
      data: {
        paperCashBalance:
          side === "buy"
            ? profile.paperCashBalance - totalCost
            : profile.paperCashBalance + totalCost,
      },
    }),
  ]);

  const spread = simulateBidAsk(quote.price);
  return NextResponse.json({
    trade,
    price,
    commission,
    bid: spread.bid,
    ask: spread.ask,
    executionDelayMs: 600 + Math.floor(Math.random() * 900),
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.$transaction([
    prisma.paperTrade.deleteMany({ where: { userId: session.userId } }),
    prisma.userProfile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        paperCashBalance: 0,
        paperStartingCash: 0,
      },
      update: {
        paperCashBalance: 0,
        paperStartingCash: 0,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
