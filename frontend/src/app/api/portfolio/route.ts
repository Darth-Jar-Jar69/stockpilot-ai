import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fetchBackendJson, isBackendConfigured } from "@/lib/backend";
import { yahooQuoteFallback } from "@/lib/market/yahoo-fallback";

async function localPortfolioAnalysis(
  holdings: { symbol: string; shares: number; avgCost?: number | null }[],
) {
  const rows = await Promise.all(
    holdings.slice(0, 20).map(async (h) => {
      const symbol = String(h.symbol).toUpperCase();
      try {
        const q = await yahooQuoteFallback(symbol);
        const value = q.price * Number(h.shares);
        const cost =
          h.avgCost != null && Number.isFinite(Number(h.avgCost))
            ? Number(h.avgCost) * Number(h.shares)
            : null;
        const pnl = cost != null ? value - cost : null;
        return {
          symbol,
          value,
          cost,
          pnl,
          pnl_percent: cost && cost > 0 ? (pnl! / cost) * 100 : null,
          change_percent: q.change_percent,
        };
      } catch {
        return {
          symbol,
          value: null as number | null,
          cost: null as number | null,
          pnl: null as number | null,
          pnl_percent: null as number | null,
          change_percent: null as number | null,
        };
      }
    }),
  );

  const valued = rows.filter((r) => r.value != null) as Array<{
    symbol: string;
    value: number;
    cost: number | null;
    pnl: number | null;
    pnl_percent: number | null;
    change_percent: number | null;
  }>;
  const total = valued.reduce((a, r) => a + r.value, 0);
  const weights = valued.map((r) => (total > 0 ? r.value / total : 0));
  const herfindahl = weights.reduce((a, w) => a + w * w, 0);
  const diversification = Math.max(5, Math.min(95, Math.round((1 - herfindahl) * 100)));
  const losers = valued
    .filter((r) => (r.pnl_percent ?? r.change_percent ?? 0) < -5)
    .map((r) => r.symbol);
  const dayMoves = valued
    .map((r) => r.change_percent)
    .filter((v): v is number => v != null);
  const avgDay =
    dayMoves.length > 0 ? dayMoves.reduce((a, b) => a + b, 0) / dayMoves.length : null;
  const health = Math.max(
    10,
    Math.min(
      95,
      Math.round(55 + (avgDay ?? 0) * 2 + (diversification - 50) * 0.3 - losers.length * 6),
    ),
  );

  const insights: string[] = [];
  insights.push(
    total > 0
      ? `Live book value about $${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${valued.length} priced holdings.`
      : "Add symbols with share counts to value the book.",
  );
  if (diversification >= 70) insights.push("Position weights look reasonably diversified.");
  else if (valued.length > 0)
    insights.push("Book is concentrated — a single name can dominate P&L.");
  if (avgDay != null)
    insights.push(
      `Average session move across holdings: ${avgDay >= 0 ? "+" : ""}${avgDay.toFixed(2)}%.`,
    );
  if (losers.length > 0) insights.push(`Under pressure today / vs cost: ${losers.join(", ")}.`);
  else if (valued.length > 0) insights.push("No major weak positions on the latest prints.");

  return {
    holdings_count: holdings.length,
    total_value: total > 0 ? total : null,
    health_score: health,
    diversification_score: diversification,
    risk_exposure: Math.max(5, Math.min(95, 100 - diversification)),
    sector_concentration: {},
    weak_positions: losers,
    insights,
    disclaimer:
      "Local portfolio snapshot from live Yahoo quotes. Probabilistic estimates only — not financial advice.",
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.userId },
    include: { holdings: true },
  });
  return NextResponse.json({ holdings: portfolio?.holdings ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const holdings = Array.isArray(body.holdings) ? body.holdings : [];

  const portfolio = await prisma.portfolio.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId },
    update: {},
  });

  await prisma.holding.deleteMany({ where: { portfolioId: portfolio.id } });
  for (const h of holdings) {
    const symbol = String(h.symbol ?? "").toUpperCase().trim();
    const shares = Number(h.shares);
    if (!symbol || !Number.isFinite(shares) || shares <= 0) continue;
    await prisma.holding.create({
      data: {
        portfolioId: portfolio.id,
        symbol,
        shares,
        avgCost: h.avgCost != null && h.avgCost !== "" ? Number(h.avgCost) : null,
      },
    });
  }

  let analysis: unknown = null;

  if (isBackendConfigured()) {
    try {
      const { ok, data } = await fetchBackendJson({
        path: "/api/v1/portfolio/analyze",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            holdings.map((h: { symbol: string; shares: number; avgCost?: number }) => ({
              symbol: String(h.symbol).toUpperCase(),
              shares: Number(h.shares),
              avg_cost: h.avgCost != null ? Number(h.avgCost) : null,
            })),
          ),
        },
        revalidate: false,
      });
      if (ok) analysis = data;
    } catch {
      // fall through to local analysis
    }
  }

  if (!analysis || (typeof analysis === "object" && analysis !== null && "error" in analysis)) {
    try {
      analysis = await localPortfolioAnalysis(holdings);
    } catch {
      analysis = {
        holdings_count: holdings.length,
        total_value: null,
        health_score: null,
        diversification_score: null,
        risk_exposure: null,
        sector_concentration: {},
        weak_positions: [],
        insights: ["Holdings saved. Live scoring temporarily unavailable — try again shortly."],
        disclaimer: "Not financial advice.",
      };
    }
  }

  return NextResponse.json({ holdings, analysis });
}
