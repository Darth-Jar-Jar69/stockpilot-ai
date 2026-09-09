import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson, isBackendConfigured } from "@/lib/backend";

export async function POST(request: Request) {
  if (!isBackendConfigured()) {
    return NextResponse.json(
      {
        error: "Backtesting requires the FastAPI backend. Configure BACKEND_URL or run the backend locally.",
        code: "backend_not_configured",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { ok, status, data } = await fetchBackendJson({
      path: "/api/v1/backtest",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      revalidate: false,
    });

    if (ok) {
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: backendErrorMessage(data, "Backtest failed.") },
      { status },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Backtesting requires the FastAPI backend. It is unreachable right now.",
        code: "backend_unavailable",
      },
      { status: 503 },
    );
  }
}
