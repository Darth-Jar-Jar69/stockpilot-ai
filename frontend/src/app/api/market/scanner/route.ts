import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  params.set("limit", searchParams.get("limit") ?? "30");
  const horizon = searchParams.get("investment_horizon");
  const risk = searchParams.get("risk_level");
  if (horizon) params.set("investment_horizon", horizon);
  if (risk) params.set("risk_level", risk);

  try {
    const res = await fetch(`${API_URL}/api/v1/scanner?${params}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail?.message ?? "Scanner unavailable." },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unavailable." }, { status: 503 });
  }
}
