import { prisma } from "@/lib/db";

const DEFAULT_CASH = 0;

export async function getOrCreateUserProfile(userId: string) {
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  const trades = await prisma.paperTrade.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  let cash = DEFAULT_CASH;
  for (const t of trades) {
    if (t.side === "buy") cash -= t.shares * t.price;
    else cash += t.shares * t.price;
  }

  return prisma.userProfile.create({
    data: {
      userId,
      paperCashBalance: cash,
      paperStartingCash: DEFAULT_CASH,
    },
  });
}

export type PaperPosition = {
  symbol: string;
  shares: number;
  avgCost: number;
};

/** Compute open positions from trade history (FIFO average cost). */
export function computePaperPositions(
  trades: { symbol: string; side: string; shares: number; price: number }[],
): PaperPosition[] {
  const map = new Map<string, { shares: number; costBasis: number }>();

  for (const trade of trades) {
    const sym = trade.symbol.toUpperCase();
    const entry = map.get(sym) ?? { shares: 0, costBasis: 0 };

    if (trade.side === "buy") {
      entry.costBasis += trade.shares * trade.price;
      entry.shares += trade.shares;
    } else {
      const sellShares = Math.min(trade.shares, entry.shares);
      if (sellShares > 0 && entry.shares > 0) {
        const avg = entry.costBasis / entry.shares;
        entry.costBasis -= avg * sellShares;
        entry.shares -= sellShares;
      }
    }
    map.set(sym, entry);
  }

  return [...map.entries()]
    .filter(([, v]) => v.shares > 0.0001)
    .map(([symbol, v]) => ({
      symbol,
      shares: v.shares,
      avgCost: v.costBasis / v.shares,
    }));
}
