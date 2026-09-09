import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooQuoteFallback } from "@/lib/market/yahoo-fallback";

/** Proxy to FastAPI — falls back to Yahoo Finance if the backend is down. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;

  try {
    const { ok, status, data } = await fetchBackendJson({
      path: `/api/v1/quotes/${encodeURIComponent(symbol)}`,
      revalidate: 30,
    });

    if (ok) {
      return NextResponse.json(data);
    }

    try {
      return NextResponse.json(await yahooQuoteFallback(symbol));
    } catch {
      return NextResponse.json(
        { error: backendErrorMessage(data, "Market data unavailable.") },
        { status },
      );
    }
  } catch {
    try {
      return NextResponse.json(await yahooQuoteFallback(symbol));
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
