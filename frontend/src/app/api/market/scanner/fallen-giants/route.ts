export const maxDuration = 60;

import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooFallenGiantsFallback } from "@/lib/market/yahoo-fallback";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams(searchParams);
  if (!params.get("limit")) params.set("limit", "12");
  const limit = Number(params.get("limit") || 12);

  try {
    const { ok, status, data } = await fetchBackendJson({
      path: "/api/v1/scanner/fallen-giants",
      searchParams: params,
      revalidate: false,
    });
    if (ok) return NextResponse.json(data);
    try {
      return NextResponse.json(await yahooFallenGiantsFallback(limit));
    } catch {
      return NextResponse.json(
        { error: backendErrorMessage(data, "Fallen Giants unavailable.") },
        { status },
      );
    }
  } catch {
    try {
      return NextResponse.json(await yahooFallenGiantsFallback(limit));
    } catch {
      return NextResponse.json(
        { error: "Fallen Giants temporarily unavailable." },
        { status: 503 },
      );
    }
  }
}
