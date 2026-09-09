import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`, { next: { revalidate: 30 } });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { status: "error", providers: [], error: "Backend offline" },
      { status: 503 },
    );
  }
}
