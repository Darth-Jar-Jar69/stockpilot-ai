import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooHealthFallback } from "@/lib/market/yahoo-fallback";

export async function GET() {
  try {
    const { ok, status, data } = await fetchBackendJson({
      path: "/api/v1/health",
      revalidate: 30,
    });

    if (ok) {
      return NextResponse.json(data, { status });
    }

    const fallback = await yahooHealthFallback();
    return NextResponse.json(
      {
        ...fallback,
        error: backendErrorMessage(data, "Backend health check failed."),
      },
      { status: fallback.status === "ok" ? 200 : 503 },
    );
  } catch {
    const fallback = await yahooHealthFallback();
    return NextResponse.json(fallback, {
      status: fallback.status === "ok" ? 200 : 503,
    });
  }
}
