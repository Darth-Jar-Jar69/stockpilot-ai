import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooHealthFallback } from "@/lib/market/yahoo-fallback";

export async function GET() {
  try {
    const { ok, status, data } = await fetchBackendJson({
      path: "/api/v1/health",
      revalidate: 15,
    });

    if (ok) {
      return NextResponse.json(data, { status });
    }

    // Backend up but unhealthy — still try Yahoo so the dashboard isn't blank
    const fallback = await yahooHealthFallback();
    return NextResponse.json(
      {
        ...fallback,
        error: backendErrorMessage(data, "Backend health check failed."),
      },
      { status: 200 },
    );
  } catch {
    const fallback = await yahooHealthFallback();
    return NextResponse.json(fallback, {
      status: fallback.status === "ok" ? 200 : 503,
    });
  }
}
