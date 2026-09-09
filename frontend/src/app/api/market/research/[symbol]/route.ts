import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson, isBackendConfigured } from "@/lib/backend";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;

  if (!isBackendConfigured()) {
    return NextResponse.json(
      {
        error: "Full company research requires the FastAPI backend. Try the Analysis page for Yahoo fallback data.",
        code: "backend_not_configured",
      },
      { status: 503 },
    );
  }

  try {
    const { ok, status, data } = await fetchBackendJson({
      path: `/api/v1/research/${encodeURIComponent(symbol)}`,
      revalidate: 120,
    });

    if (ok) {
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: backendErrorMessage(data, "Research unavailable.") },
      { status },
    );
  } catch {
    return NextResponse.json(
      { error: "Research unavailable. Backend is unreachable." },
      { status: 503 },
    );
  }
}
