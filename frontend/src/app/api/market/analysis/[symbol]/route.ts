import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;

  try {
    const res = await fetch(`${API_URL}/api/v1/analysis/${encodeURIComponent(symbol)}`, {
      next: { revalidate: 60 },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail?.message ?? data.message ?? "Analysis unavailable." },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable. Start the FastAPI server on port 8000.", code: "backend_unavailable" },
      { status: 503 },
    );
  }
}
