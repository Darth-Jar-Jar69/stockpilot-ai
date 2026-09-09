import { NextResponse } from "next/server";

import { fetchMarketNewsDesk, type NewsDesk } from "@/lib/market/live-news";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const desk = (searchParams.get("desk") as NewsDesk | "all" | null) ?? "all";
  const limit = Number(searchParams.get("limit") ?? "28");
  const page = Number(searchParams.get("page") ?? "0");

  try {
    const deskData = await fetchMarketNewsDesk({
      limit,
      symbol,
      desk: desk || "all",
      page: Number.isFinite(page) ? page : 0,
    });
    return NextResponse.json(deskData, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "News desk temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
