import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols") ?? "";
  try {
    const res = await fetch(
      `${API_URL}/api/v1/compare?symbols=${encodeURIComponent(symbols)}`,
      { next: { revalidate: 120 } },
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail?.message ?? "Compare failed." }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unavailable." }, { status: 503 });
  }
}
