export const maxDuration = 60;

import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";
import { yahooScannerFallback } from "@/lib/market/yahoo-fallback";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  params.set("limit", searchParams.get("limit") ?? "30");
  const horizon = searchParams.get("investment_horizon");
  const risk = searchParams.get("risk_level");
  if (horizon) params.set("investment_horizon", horizon);
  if (risk) params.set("risk_level", risk);

  try {
    const { ok, status, data } = await fetchBackendJson({
      path: "/api/v1/scanner",
      searchParams: params,
      revalidate: false,
    });
    if (ok) return NextResponse.json(data);
    try {
      return NextResponse.json(await yahooScannerFallback(Number(params.get("limit") || 30)));
    } catch {
      return NextResponse.json(
        { error: backendErrorMessage(data, "Scanner unavailable.") },
        { status },
      );
    }
  } catch {
    try {
      return NextResponse.json(await yahooScannerFallback(Number(params.get("limit") || 30)));
    } catch {
      return NextResponse.json({ error: "Scanner temporarily unavailable." }, { status: 503 });
    }
  }
}
