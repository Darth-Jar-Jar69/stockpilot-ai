import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  try {
    const res = await fetch(`${API_URL}/api/v1/research/${encodeURIComponent(symbol)}`, {
      next: { revalidate: 120 },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail?.message ?? "Research unavailable." },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unavailable." }, { status: 503 });
  }
}
