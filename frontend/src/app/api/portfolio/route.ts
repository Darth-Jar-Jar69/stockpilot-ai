import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

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

  const res = await fetch(`${API_URL}/api/v1/portfolio/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      holdings.map((h: { symbol: string; shares: number; avgCost?: number }) => ({
        symbol: String(h.symbol).toUpperCase(),
        shares: Number(h.shares),
        avg_cost: h.avgCost != null ? Number(h.avgCost) : null,
      })),
    ),
  });
  const analysis = await res.json();
  return NextResponse.json({ holdings, analysis });
}
