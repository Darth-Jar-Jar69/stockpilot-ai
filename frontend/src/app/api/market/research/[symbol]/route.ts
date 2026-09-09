import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooResearchFallback } from "@/lib/market/yahoo-fallback";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;

  try {
    const { ok, status, data } = await fetchBackendJson({
      path: `/api/v1/research/${encodeURIComponent(symbol)}`,
      revalidate: 120,
    });

    if (ok) {
      return NextResponse.json(data);
    }

    try {
      return NextResponse.json(await yahooResearchFallback(symbol));
    } catch {
      return NextResponse.json(
        { error: backendErrorMessage(data, "Research unavailable.") },
        { status },
      );
    }
  } catch {
    try {
      return NextResponse.json(await yahooResearchFallback(symbol));
    } catch {
      return NextResponse.json(
        {
          error: "Company research is temporarily unavailable. Please try again shortly.",
          code: "backend_unavailable",
        },
        { status: 503 },
      );
    }
  }
}
