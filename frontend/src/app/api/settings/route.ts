import { NextResponse } from "next/server";

import { getOrCreateUserProfile } from "@/lib/paper-trading";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getOrCreateUserProfile(session.userId);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const riskTolerance = body.riskTolerance ? String(body.riskTolerance) : undefined;
  const preferredMarkets = body.preferredMarkets ? String(body.preferredMarkets) : undefined;

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      riskTolerance: riskTolerance ?? "moderate",
      preferredMarkets: preferredMarkets ?? "US",
    },
    update: {
      ...(riskTolerance ? { riskTolerance } : {}),
      ...(preferredMarkets ? { preferredMarkets } : {}),
    },
  });

  return NextResponse.json({ profile });
}
