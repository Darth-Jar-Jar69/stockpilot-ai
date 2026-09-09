/** Lightweight Yahoo Finance chart fallback when FastAPI is unreachable. */

type YahooChartResult = {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    currency?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      open?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
};

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!;
    if (change >= 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macdHistogram(values: number[]): number | null {
  if (values.length < 35) return null;
  const ema = (period: number) => {
    const k = 2 / (period + 1);
    let prev = values[0]!;
    for (let i = 1; i < values.length; i++) {
      prev = values[i]! * k + prev * (1 - k);
    }
    return prev;
  };
  const macdLine = ema(12) - ema(26);
  // Approximate signal as short EMA of MACD isn't available without series — use 0 baseline gap
  return macdLine;
}

async function fetchYahooChart(symbol: string, range = "6mo"): Promise<YahooChartResult> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", range);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StockPilot/1.0)",
      Accept: "application/json",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned ${res.status}`);
  }

  const json = (await res.json()) as { chart?: { result?: YahooChartResult[]; error?: unknown } };
  const result = json.chart?.result?.[0];
  if (!result?.meta) {
    throw new Error("Yahoo Finance returned no chart data.");
  }
  return result;
}

export async function yahooQuoteFallback(symbol: string) {
  const chart = await fetchYahooChart(symbol.toUpperCase(), "5d");
  const price = chart.meta?.regularMarketPrice;
  if (price == null) throw new Error("No price from Yahoo Finance.");

  const previous = chart.meta?.previousClose ?? chart.meta?.chartPreviousClose ?? null;
  const change = previous != null ? price - previous : null;
  const changePercent = previous != null && previous !== 0 ? (change! / previous) * 100 : null;

  return {
    symbol: chart.meta?.symbol ?? symbol.toUpperCase(),
    price,
    change,
    change_percent: changePercent,
    currency: chart.meta?.currency ?? "USD",
    provider: "yahoo_finance",
    freshness: "live",
  };
}

export async function yahooAnalysisFallback(symbol: string) {
  const chart = await fetchYahooChart(symbol.toUpperCase(), "1y");
  const closes =
    chart.indicators?.quote?.[0]?.close?.filter((v): v is number => typeof v === "number") ?? [];
  const price = chart.meta?.regularMarketPrice ?? closes.at(-1);
  if (price == null) throw new Error("No price from Yahoo Finance.");

  const previous = chart.meta?.previousClose ?? chart.meta?.chartPreviousClose ?? null;
  const change = previous != null ? price - previous : null;
  const changePercent = previous != null && previous !== 0 ? (change! / previous) * 100 : null;

  const rsi14 = rsi(closes, 14);
  const sma50 = sma(closes, 50);
  const macdHist = macdHistogram(closes);

  const technicalScore =
    rsi14 == null
      ? null
      : Math.max(0, Math.min(100, rsi14 > 70 ? 35 : rsi14 < 30 ? 75 : 50 + (50 - rsi14) * 0.4));
  const momentumScore =
    changePercent == null ? null : Math.max(0, Math.min(100, 50 + changePercent * 4));
  const riskScore =
    rsi14 == null ? null : Math.max(0, Math.min(100, Math.abs(rsi14 - 50) * 1.5 + 25));

  return {
    symbol: chart.meta?.symbol ?? symbol.toUpperCase(),
    quote: {
      symbol: chart.meta?.symbol ?? symbol.toUpperCase(),
      price,
      change,
      change_percent: changePercent,
      currency: chart.meta?.currency ?? "USD",
      provider: "yahoo_finance",
      freshness: "live",
    },
    technical: {
      rsi_14: rsi14,
      macd_histogram: macdHist,
      sma_50: sma50,
      data_points: closes.length,
    },
    scores: {
      technical_score: technicalScore,
      momentum_score: momentumScore,
      risk_score: riskScore,
    },
    data_warnings: ["Served via Yahoo Finance fallback (primary API unreachable)."],
  };
}

export async function yahooHealthFallback() {
  try {
    await yahooQuoteFallback("AAPL");
    return {
      status: "ok",
      app: "StockPilot (fallback)",
      environment: process.env.NODE_ENV ?? "production",
      providers: [
        { name: "yahoo_finance", status: "ok", message: "Direct fallback active" },
        { name: "fastapi", status: "error", message: "Primary backend unreachable" },
      ],
    };
  } catch (error) {
    return {
      status: "error",
      app: "StockPilot",
      environment: process.env.NODE_ENV ?? "production",
      providers: [
        {
          name: "yahoo_finance",
          status: "error",
          message: error instanceof Error ? error.message : "Unavailable",
        },
      ],
      error: "Market data providers unreachable.",
    };
  }
}
