import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/market/intelligence`, { next: { revalidate: 60 } });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail?.message ?? "Unavailable." }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unavailable." }, { status: 503 });
  }
}
