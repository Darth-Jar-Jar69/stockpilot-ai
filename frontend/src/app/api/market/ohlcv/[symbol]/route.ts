import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "6mo";
  const interval = searchParams.get("interval") ?? "1d";

  try {
    const url = new URL(`${API_URL}/api/v1/ohlcv/${encodeURIComponent(symbol)}`);
    url.searchParams.set("period", period);
    url.searchParams.set("interval", interval);

    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail?.message ?? "OHLCV data unavailable." },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable.", code: "backend_unavailable" },
      { status: 503 },
    );
  }
}
