import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooCompareFallback } from "@/lib/market/yahoo-fallback";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols") ?? "";

  try {
    const { ok, data } = await fetchBackendJson({
      path: "/api/v1/compare",
      searchParams: new URLSearchParams({ symbols }),
      revalidate: 120,
    });

    if (ok) {
      return NextResponse.json(data);
    }

    return NextResponse.json(await yahooCompareFallback(symbols));
  } catch {
    try {
      return NextResponse.json(await yahooCompareFallback(symbols));
    } catch (error) {
      return NextResponse.json(
        {
          error: backendErrorMessage(
            null,
            error instanceof Error ? error.message : "Compare failed.",
          ),
        },
        { status: 503 },
      );
    }
  }
}
