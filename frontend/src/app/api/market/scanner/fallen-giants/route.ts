import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();

  const pass = [
    "min_decline",
    "min_market_cap",
    "risk",
    "min_recovery_score",
    "min_fundamental_score",
    "catalyst_type",
    "max_days_since_crash",
    "sort_by",
    "limit",
  ] as const;

  for (const key of pass) {
    const value = searchParams.get(key);
    if (value != null && value !== "") params.set(key, value);
  }
  if (!params.has("limit")) params.set("limit", "20");

  try {
    const res = await fetch(`${API_URL}/api/v1/scanner/fallen-giants?${params}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail?.message ?? data.message ?? "Fallen Giants unavailable." },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unavailable." }, { status: 503 });
  }
}
