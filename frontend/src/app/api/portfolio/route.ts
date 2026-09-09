import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

import { fetchBackendJson, isBackendConfigured } from "@/lib/backend";

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

  const body = await request.json();
  const holdings = Array.isArray(body.holdings) ? body.holdings : [];

  const portfolio = await prisma.portfolio.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId },
    update: {},
  });

  await prisma.holding.deleteMany({ where: { portfolioId: portfolio.id } });
  for (const h of holdings) {
    await prisma.holding.create({
      data: {
        portfolioId: portfolio.id,
        symbol: String(h.symbol).toUpperCase(),
        shares: Number(h.shares),
        avgCost: h.avgCost != null ? Number(h.avgCost) : null,
      },
    });
  }

  let analysis: unknown = {
    error: "Portfolio analysis requires the FastAPI backend.",
    code: "backend_not_configured",
  };

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
      // Holdings saved; analysis skipped when backend unreachable.
    }
  }

  return NextResponse.json({ holdings, analysis });
}
