import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { symbol } = await request.json();
  const sym = String(symbol ?? "").toUpperCase().trim();
  if (!sym) return NextResponse.json({ error: "Symbol required." }, { status: 400 });
  const item = await prisma.watchlistItem.upsert({
    where: { userId_symbol: { userId: session.userId, symbol: sym } },
    create: { userId: session.userId, symbol: sym },
    update: {},
  });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { symbol } = await request.json();
  await prisma.watchlistItem.deleteMany({
    where: { userId: session.userId, symbol: String(symbol).toUpperCase() },
  });
  return NextResponse.json({ ok: true });
}
