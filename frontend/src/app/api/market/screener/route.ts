export const maxDuration = 60;

import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooScreenerFallback } from "@/lib/market/yahoo-fallback";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams(searchParams);
  if (!params.get("limit")) params.set("limit", "50");

  const limit = Number(params.get("limit") || 50);
  const filters = {
    query: params.get("query") ?? undefined,
    minRsi: params.get("min_rsi") ? Number(params.get("min_rsi")) : undefined,
    maxRsi: params.get("max_rsi") ? Number(params.get("max_rsi")) : undefined,
    minTechnical: params.get("min_technical_score")
      ? Number(params.get("min_technical_score"))
      : undefined,
    minMomentum: params.get("min_momentum_score")
      ? Number(params.get("min_momentum_score"))
      : undefined,
    minPrice: params.get("min_price") ? Number(params.get("min_price")) : undefined,
    maxPrice: params.get("max_price") ? Number(params.get("max_price")) : undefined,
  };

  try {
    const { ok, status, data } = await fetchBackendJson({
      path: "/api/v1/screener",
      searchParams: params,
      revalidate: false,
    });
    if (ok) return NextResponse.json(data);
    try {
      return NextResponse.json(await yahooScreenerFallback(limit, filters));
    } catch {
      return NextResponse.json(
        { error: backendErrorMessage(data, "Screener unavailable.") },
        { status },
      );
    }
  } catch {
    try {
      return NextResponse.json(await yahooScreenerFallback(limit, filters));
    } catch {
      return NextResponse.json({ error: "Screener temporarily unavailable." }, { status: 503 });
    }
  }
}
