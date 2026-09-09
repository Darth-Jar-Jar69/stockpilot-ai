import { NextResponse } from "next/server";

import { backendErrorMessage, fetchBackendJson } from "@/lib/backend";

type YahooOhlcvBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

async function yahooOhlcvFallback(symbol: string, period: string, interval: string) {
  const rangeMap: Record<string, string> = {
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
    "2y": "2y",
  };
  const intervalMap: Record<string, string> = {
    "1d": "1d",
    "1h": "60m",
    "15m": "15m",
  };

  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", rangeMap[period] ?? "6mo");
  url.searchParams.set("interval", intervalMap[interval] ?? "1d");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StockPilot/1.0)",
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Yahoo OHLCV ${res.status}`);

  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: { symbol?: string; currency?: string };
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
    };
  };

  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];
  if (!result || !quote || timestamps.length === 0) {
    throw new Error("Yahoo returned empty OHLCV.");
  }

  const bars: YahooOhlcvBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];
    if ([open, high, low, close].some((v) => v == null)) continue;
    bars.push({
      time: new Date(timestamps[i]! * 1000).toISOString().slice(0, 10),
      open: open!,
      high: high!,
      low: low!,
      close: close!,
      volume: volume ?? 0,
    });
  }

  return {
    symbol: result.meta?.symbol ?? symbol.toUpperCase(),
    currency: result.meta?.currency ?? "USD",
    interval,
    period,
    provider: "yahoo_finance",
    bars,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "6mo";
  const interval = searchParams.get("interval") ?? "1d";

  try {
    const query = new URLSearchParams({ period, interval });
    const { ok, status, data } = await fetchBackendJson({
      path: `/api/v1/ohlcv/${encodeURIComponent(symbol)}`,
      searchParams: query,
      revalidate: 300,
    });

    if (ok) return NextResponse.json(data);

    try {
      return NextResponse.json(await yahooOhlcvFallback(symbol, period, interval));
    } catch {
      return NextResponse.json(
        { error: backendErrorMessage(data, "OHLCV data unavailable.") },
        { status },
      );
    }
  } catch {
    try {
      return NextResponse.json(await yahooOhlcvFallback(symbol, period, interval));
    } catch {
      return NextResponse.json(
        { error: "Market data is temporarily unavailable.", code: "backend_unavailable" },
        { status: 503 },
      );
    }
  }
}
