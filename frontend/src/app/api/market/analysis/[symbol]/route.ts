import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooAnalysisFallback } from "@/lib/market/yahoo-fallback";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;

  try {
    const { ok, status, data } = await fetchBackendJson({
      path: `/api/v1/analysis/${encodeURIComponent(symbol)}`,
      revalidate: 60,
    });

    if (ok) {
      return NextResponse.json(data);
    }

    // Prefer Yahoo fallback over surfacing Railway 502 noise
    try {
      const fallback = await yahooAnalysisFallback(symbol);
      return NextResponse.json(fallback);
    } catch {
      return NextResponse.json(
        { error: backendErrorMessage(data, "Analysis unavailable.") },
        { status },
      );
    }
  } catch {
    try {
      const fallback = await yahooAnalysisFallback(symbol);
      return NextResponse.json(fallback);
    } catch {
      return NextResponse.json(
        {
          error: "Market data is temporarily unavailable. Please try again shortly.",
          code: "backend_unavailable",
        },
        { status: 503 },
      );
    }
  }
}
