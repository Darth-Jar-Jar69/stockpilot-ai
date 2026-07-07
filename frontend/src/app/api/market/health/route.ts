import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`, { next: { revalidate: 15 } });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        status: "offline",
        providers: [],
        error: "FastAPI backend not reachable at " + (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"),
      },
      { status: 503 },
    );
  }
}
