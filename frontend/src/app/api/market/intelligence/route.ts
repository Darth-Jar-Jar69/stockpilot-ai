import { NextResponse } from "next/server";

import { fetchBackendJson } from "@/lib/backend";
import { yahooIntelligenceFallback } from "@/lib/market/yahoo-fallback";

export async function GET() {
  try {
    const { ok, data } = await fetchBackendJson({
      path: "/api/v1/market/intelligence",
      revalidate: 60,
    });

    if (ok) {
      return NextResponse.json(data);
    }

    return NextResponse.json(await yahooIntelligenceFallback());
  } catch {
    try {
      return NextResponse.json(await yahooIntelligenceFallback());
    } catch {
      return NextResponse.json({ error: "Market intelligence unavailable." }, { status: 503 });
    }
  }
}
