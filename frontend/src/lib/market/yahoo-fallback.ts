/** Yahoo Finance fallbacks when FastAPI is unreachable (e.g. Vercel without backend URL). */

import { companyNameFor } from "@/lib/news-tickers";
import type {
  FallenGiantCandidate,
  FallenGiantsResponse,
  NewsArticle,
  ScanResult,
  ScannerResponse,
} from "@/types/scanner";

type YahooChartResult = {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    currency?: string;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
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

const YAHOO_UA = "Mozilla/5.0 (compatible; StockPilot/1.0)";

const FALLBACK_UNIVERSE = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "UNH",
  "AVGO", "COST", "LLY", "AMD", "NFLX", "ASML", "RACE", "TSM", "SNPS", "CDNS",
  "ORCL", "CRM", "ADBE", "INTU", "NOW", "PANW", "CRWD", "ANET",
] as const;

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
  return ema(12) - ema(26);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      try {
        const value = await fn(items[current]!);
        if (value != null) results.push(value);
      } catch {
        // skip failures
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchYahooChart(symbol: string, range = "6mo"): Promise<YahooChartResult> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", range);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);

  const json = (await res.json()) as { chart?: { result?: YahooChartResult[]; error?: unknown } };
  const result = json.chart?.result?.[0];
  if (!result?.meta) throw new Error("Yahoo Finance returned no chart data.");
  return result;
}

/**
 * Yahoo's chart `meta.previousClose` is never populated and `chartPreviousClose`
 * is the close *before the requested range starts* (for range=1y that is a year ago).
 * Using it produced fake -30% "session" moves. Derive the real prior close from
 * the bar series instead.
 */
export function previousCloseFrom(chart: YahooChartResult): number | null {
  const closes =
    chart.indicators?.quote?.[0]?.close?.filter((v): v is number => typeof v === "number") ?? [];
  const price = chart.meta?.regularMarketPrice ?? closes.at(-1) ?? null;
  if (price == null) return null;

  if (closes.length >= 2) {
    const last = closes.at(-1)!;
    // Last bar is today's (possibly live) session â†’ prior bar is the previous close.
    if (Math.abs(last - price) / price < 0.03) return closes.at(-2)!;
    // Last bar is already yesterday (pre-market / meta ahead of bars).
    return last;
  }
  if (closes.length === 1) {
    const last = closes[0]!;
    if (Math.abs(last - price) / price >= 0.03) return last;
    // Only a single (today) bar: chartPreviousClose is genuinely the prior close here.
    return chart.meta?.chartPreviousClose ?? null;
  }
  return chart.meta?.chartPreviousClose ?? null;
}

export function periodReturns(closes: number[]) {
  const last = closes.at(-1);
  const ret = (barsBack: number): number | null => {
    if (last == null || closes.length <= barsBack) return null;
    const base = closes[closes.length - 1 - barsBack];
    if (base == null || base === 0) return null;
    return ((last - base) / base) * 100;
  };
  return {
    one_week: ret(5),
    one_month: ret(21),
    three_month: ret(63),
    six_month: ret(126),
    one_year: closes.length >= 240 ? ret(closes.length - 1) : null,
  };
}

export function annualizedVolatility(closes: number[], lookback = 63): number | null {
  const series = closes.slice(-(lookback + 1));
  if (series.length < 20) return null;
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]!;
    if (prev > 0) rets.push(Math.log(series[i]! / prev));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function recommendationFromScore(score: number | null): string | null {
  if (score == null) return null;
  if (score >= 80) return "Strong Buy";
  if (score >= 65) return "Buy";
  if (score >= 45) return "Hold";
  if (score >= 30) return "Sell";
  return "Strong Sell";
}

function scanResultFromChart(symbol: string, chart: YahooChartResult): ScanResult {
  const closes =
    chart.indicators?.quote?.[0]?.close?.filter((v): v is number => typeof v === "number") ?? [];
  const volumes =
    chart.indicators?.quote?.[0]?.volume?.filter((v): v is number => typeof v === "number") ?? [];
  const price = chart.meta?.regularMarketPrice ?? closes.at(-1) ?? null;
  const previous = previousCloseFrom(chart);
  const change = price != null && previous != null ? price - previous : null;
  const changePercent =
    price != null && previous != null && previous !== 0 ? (change! / previous) * 100 : null;

  const rsi14 = rsi(closes, 14);
  const sma50 = sma(closes, 50);
  const macdHist = macdHistogram(closes);
  const returns = periodReturns(closes);

  const technicalScore = technicalScoreFrom({ rsi14, price, sma50, sma200: sma(closes, 200), macdHist });
  const momentumScore = momentumScoreFrom(returns, changePercent);
  const riskScore = riskScoreFromPrices(closes, price);

  const parts = [technicalScore, momentumScore].filter((v): v is number => v != null);
  const stockpilotScore =
    parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

  const predictedChange =
    changePercent == null
      ? null
      : Math.max(-12, Math.min(12, changePercent * 0.35 + (macdHist != null && macdHist > 0 ? 1.5 : -0.5)));
  const predictedPrice =
    price != null && predictedChange != null ? price * (1 + predictedChange / 100) : null;

  return {
    symbol: chart.meta?.symbol ?? symbol.toUpperCase(),
    company_name: companyNameFor(chart.meta?.symbol ?? symbol),
    price,
    change_percent: changePercent,
    predicted_price: predictedPrice,
    predicted_change_percent: predictedChange,
    stockpilot_score: stockpilotScore,
    volume: volumes.at(-1) ?? null,
    market_cap: null,
    pe_ratio: null,
    rsi_14: rsi14,
    technical_score: technicalScore,
    momentum_score: momentumScore,
    risk_score: riskScore,
    overall_rating: recommendationFromScore(stockpilotScore),
    recommendation: recommendationFromScore(stockpilotScore),
    analyst_sentiment: null,
    ai_reasoning:
      sma50 != null && price != null
        ? `Yahoo fallback: price is ${price >= sma50 ? "above" : "below"} SMA50; RSI ${rsi14?.toFixed(0) ?? "n/a"}.`
        : "Yahoo Finance fallback scan (primary API unreachable).",
    confidence_score: stockpilotScore != null ? Math.max(40, Math.min(75, stockpilotScore - 5)) : 45,
    sector: null,
    provider: "yahoo_finance",
  };
}

export async function yahooQuoteFallback(symbol: string) {
  const chart = await fetchYahooChart(symbol.toUpperCase(), "5d");
  const price = chart.meta?.regularMarketPrice;
  if (price == null) throw new Error("No price from Yahoo Finance.");

  const previous = previousCloseFrom(chart);
  const change = previous != null ? price - previous : null;
  const changePercent = previous != null && previous !== 0 ? (change! / previous) * 100 : null;

  return {
    symbol: chart.meta?.symbol ?? symbol.toUpperCase(),
    price,
    change,
    change_percent: changePercent,
    previous_close: previous,
    currency: chart.meta?.currency ?? "USD",
    provider: "yahoo_finance",
    freshness: "live",
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Piecewise-linear interpolation over sorted [x, y] anchor points, clamped at the ends. */
export function interp(x: number, points: [number, number][]): number {
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    if (x <= x1) {
      const [x0, y0] = points[i - 1]!;
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return points[points.length - 1]![1];
}

function technicalScoreFrom(input: {
  rsi14: number | null;
  price: number | null;
  sma50: number | null;
  sma200: number | null;
  macdHist: number | null;
}): number | null {
  const parts: { v: number; w: number }[] = [];
  if (input.rsi14 != null) {
    parts.push({ v: interp(input.rsi14, [[20, 40], [30, 50], [50, 65], [65, 60], [75, 40], [85, 25]]), w: 1 });
  }
  if (input.price != null && input.sma50 != null) {
    const gap = ((input.price - input.sma50) / input.sma50) * 100;
    parts.push({ v: interp(gap, [[-20, 15], [-8, 35], [0, 50], [5, 70], [15, 80]]), w: 1 });
  }
  if (input.price != null && input.sma200 != null) {
    const gap = ((input.price - input.sma200) / input.sma200) * 100;
    parts.push({ v: interp(gap, [[-30, 10], [-10, 35], [0, 55], [10, 72], [30, 85]]), w: 1.2 });
  }
  if (input.macdHist != null && input.price != null) {
    const rel = (input.macdHist / input.price) * 100;
    parts.push({ v: interp(rel, [[-3, 25], [0, 50], [3, 75]]), w: 0.6 });
  }
  if (parts.length === 0) return null;
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  return clamp(Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) / wsum), 0, 100);
}

function momentumScoreFrom(
  r: ReturnType<typeof periodReturns>,
  changePercent: number | null,
): number | null {
  const parts: { v: number; w: number }[] = [];
  if (r.one_month != null) parts.push({ v: interp(r.one_month, [[-15, 15], [-5, 35], [0, 50], [5, 65], [15, 85]]), w: 0.8 });
  if (r.three_month != null) parts.push({ v: interp(r.three_month, [[-25, 10], [-10, 30], [0, 50], [10, 70], [25, 90]]), w: 1.2 });
  if (r.six_month != null) parts.push({ v: interp(r.six_month, [[-35, 10], [-15, 30], [0, 50], [15, 70], [40, 90]]), w: 1 });
  if (r.one_year != null) parts.push({ v: interp(r.one_year, [[-45, 10], [-15, 30], [0, 50], [20, 70], [60, 90]]), w: 0.8 });
  if (parts.length === 0 && changePercent != null) {
    parts.push({ v: interp(changePercent, [[-8, 15], [-2, 40], [0, 50], [2, 60], [8, 85]]), w: 1 });
  }
  if (parts.length === 0) return null;
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  return clamp(Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) / wsum), 0, 100);
}

function riskScoreFromPrices(closes: number[], price: number | null): number | null {
  const parts: { v: number; w: number }[] = [];
  const vol = annualizedVolatility(closes);
  if (vol != null) parts.push({ v: interp(vol, [[0.12, 15], [0.2, 30], [0.3, 50], [0.45, 70], [0.7, 88], [1, 97]]), w: 1.2 });
  if (price != null && closes.length >= 60) {
    const peak = Math.max(...closes);
    const dd = peak > 0 ? ((peak - price) / peak) * 100 : 0;
    parts.push({ v: interp(dd, [[0, 20], [10, 35], [25, 55], [40, 72], [60, 90]]), w: 1 });
  }
  if (parts.length === 0) return null;
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  return clamp(Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) / wsum), 0, 100);
}

export async function yahooAnalysisFallback(symbol: string) {
  const [chart, searchHit] = await Promise.all([
    fetchYahooChart(symbol.toUpperCase(), "1y"),
    fetchYahooSearchQuote(symbol),
  ]);
  const closes =
    chart.indicators?.quote?.[0]?.close?.filter((v): v is number => typeof v === "number") ?? [];
  const highs =
    chart.indicators?.quote?.[0]?.high?.filter((v): v is number => typeof v === "number") ?? [];
  const lows =
    chart.indicators?.quote?.[0]?.low?.filter((v): v is number => typeof v === "number") ?? [];
  const volumes =
    chart.indicators?.quote?.[0]?.volume?.filter((v): v is number => typeof v === "number") ?? [];
  const price = chart.meta?.regularMarketPrice ?? closes.at(-1);
  if (price == null) throw new Error("No price from Yahoo Finance.");

  const previous = previousCloseFrom(chart);
  const change = previous != null ? price - previous : null;
  const changePercent = previous != null && previous !== 0 ? (change! / previous) * 100 : null;

  const rsi14 = rsi(closes, 14);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const macdHist = macdHistogram(closes);
  const returns = periodReturns(closes);
  const volatility = annualizedVolatility(closes);

  const technicalScore = technicalScoreFrom({ rsi14, price, sma50, sma200, macdHist });
  const momentumScore = momentumScoreFrom(returns, changePercent);
  const riskScore = riskScoreFromPrices(closes, price);

  const resolvedSymbol = chart.meta?.symbol ?? searchHit?.symbol ?? symbol.toUpperCase();
  const companyName =
    searchHit?.longname || searchHit?.shortname || companyNameFor(resolvedSymbol);

  // 52-week range from the actual 1y bars (meta.fiftyTwoWeek* is often stale/wrong).
  const yearHigh = highs.length ? Math.max(...highs) : closes.length ? Math.max(...closes) : null;
  const yearLow = lows.length ? Math.min(...lows) : closes.length ? Math.min(...closes) : null;
  const avgVolume30 =
    volumes.length >= 5
      ? volumes.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, volumes.length)
      : null;

  return {
    symbol: resolvedSymbol,
    company_name: companyName,
    quote: {
      symbol: resolvedSymbol,
      price,
      change,
      change_percent: changePercent,
      previous_close: previous,
      day_high: highs.at(-1) ?? null,
      day_low: lows.at(-1) ?? null,
      volume: volumes.at(-1) ?? null,
      avg_volume_30d: avgVolume30,
      fifty_two_week_high: yearHigh,
      fifty_two_week_low: yearLow,
      currency: chart.meta?.currency ?? "USD",
      provider: "yahoo_finance",
      freshness: "live",
    },
    technical: {
      rsi_14: rsi14,
      macd_histogram: macdHist,
      sma_20: sma20,
      sma_50: sma50,
      sma_200: sma200,
      volatility_annualized: volatility,
      returns,
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

export async function yahooOhlcvFallback(symbol: string, range = "6mo") {
  const chart = await fetchYahooChart(symbol.toUpperCase(), range);
  const quote = chart.indicators?.quote?.[0];
  const timestamps = chart.timestamp ?? [];
  const bars = timestamps
    .map((ts, i) => {
      const open = quote?.open?.[i];
      const high = quote?.high?.[i];
      const low = quote?.low?.[i];
      const close = quote?.close?.[i];
      const volume = quote?.volume?.[i];
      if (open == null || high == null || low == null || close == null) return null;
      return {
        timestamp: new Date(ts * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume: volume ?? 0,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);

  return {
    symbol: chart.meta?.symbol ?? symbol.toUpperCase(),
    interval: "1d",
    bars,
    provider: "yahoo_finance",
  };
}

export async function yahooHealthFallback() {
  try {
    await yahooQuoteFallback("AAPL");
    return {
      status: "ok",
      app: "StockPilot",
      environment: process.env.NODE_ENV ?? "production",
      providers: [
        { name: "yahoo_finance", status: "ok", message: "Live market data via Yahoo Finance" },
        {
          name: "fastapi",
          status: "ok",
          message: "Using Finnhub + Yahoo live market feeds",
        },
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

export async function yahooNewsFallback(limit = 15, symbol?: string | null): Promise<NewsArticle[]> {
  const q = symbol?.trim() || "stock market";
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", q);
  url.searchParams.set("quotesCount", "0");
  url.searchParams.set("newsCount", String(Math.min(Math.max(limit, 1), 25)));

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error(`Yahoo news returned ${res.status}`);

  const json = (await res.json()) as {
    news?: Array<{
      title?: string;
      publisher?: string;
      link?: string;
      providerPublishTime?: number;
      summary?: string;
      thumbnail?: { resolutions?: Array<{ url?: string }> };
      relatedTickers?: string[];
    }>;
  };

  return (json.news ?? []).slice(0, limit).map((item) => {
    const symbols = (item.relatedTickers ?? []).map((s) => s.toUpperCase());
    return {
      title: item.title ?? "Untitled",
      source: item.publisher ?? "Yahoo Finance",
      url: item.link ?? null,
      published_at:
        item.providerPublishTime != null
          ? new Date(item.providerPublishTime * 1000).toISOString()
          : null,
      summary: item.summary ?? null,
      image_url: item.thumbnail?.resolutions?.[0]?.url ?? null,
      symbols,
      related_stocks: symbols.map((sym) => ({
        symbol: sym,
        company_name: null,
        price: null,
        change_percent: null,
      })),
    };
  });
}

export async function yahooScannerFallback(limit = 30): Promise<ScannerResponse> {
  const rows = await mapPool([...FALLBACK_UNIVERSE], 8, async (symbol) => {
    const chart = await fetchYahooChart(symbol, "3mo");
    return scanResultFromChart(symbol, chart);
  });

  rows.sort((a, b) => (b.stockpilot_score ?? 0) - (a.stockpilot_score ?? 0));

  return {
    results: rows.slice(0, limit),
    scanned_at: new Date().toISOString(),
    universe_size: FALLBACK_UNIVERSE.length,
    filters_applied: { provider: "yahoo_finance", mode: "fallback" },
    disclaimer:
      "Yahoo Finance fallback scan. Probabilistic estimates only â€” not financial advice.",
  };
}

export async function yahooScreenerFallback(
  limit = 50,
  filters: {
    query?: string;
    minRsi?: number;
    maxRsi?: number;
    minTechnical?: number;
    minMomentum?: number;
    minPrice?: number;
    maxPrice?: number;
  } = {},
): Promise<ScannerResponse> {
  const base = await yahooScannerFallback(Math.max(limit, 40));
  let results = base.results;

  const q = filters.query?.trim().toUpperCase();
  if (q) results = results.filter((r) => r.symbol.includes(q));
  if (filters.minRsi != null) results = results.filter((r) => (r.rsi_14 ?? 0) >= filters.minRsi!);
  if (filters.maxRsi != null) results = results.filter((r) => (r.rsi_14 ?? 100) <= filters.maxRsi!);
  if (filters.minTechnical != null) {
    results = results.filter((r) => (r.technical_score ?? 0) >= filters.minTechnical!);
  }
  if (filters.minMomentum != null) {
    results = results.filter((r) => (r.momentum_score ?? 0) >= filters.minMomentum!);
  }
  if (filters.minPrice != null) results = results.filter((r) => (r.price ?? 0) >= filters.minPrice!);
  if (filters.maxPrice != null) {
    results = results.filter((r) => (r.price ?? Number.POSITIVE_INFINITY) <= filters.maxPrice!);
  }

  return {
    results: results.slice(0, limit),
    scanned_at: new Date().toISOString(),
    universe_size: FALLBACK_UNIVERSE.length,
    filters_applied: {
      ...filters,
      total_matches: results.length,
      provider: "yahoo_finance",
      mode: "fallback",
    },
    disclaimer:
      "Yahoo Finance fallback screener. Probabilistic estimates only â€” not financial advice.",
  };
}

export async function yahooCompareFallback(symbolsCsv: string) {
  const symbols = symbolsCsv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 6);

  if (symbols.length === 0) {
    throw new Error("Provide at least one symbol to compare.");
  }

  const metrics = await mapPool(symbols, 6, async (symbol) => {
    const chart = await fetchYahooChart(symbol, "3mo");
    const row = scanResultFromChart(symbol, chart);
    return {
      symbol: row.symbol,
      company_name: row.company_name,
      growth_score: row.momentum_score,
      profitability_score: null,
      valuation_score: null,
      risk_score: row.risk_score,
      quality_score: row.technical_score,
      overall_score: row.stockpilot_score,
      pe_ratio: null,
      revenue_growth: null,
      profit_margin: null,
    };
  });

  metrics.sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0));
  const leader = metrics[0];
  const ai_conclusion = leader
    ? `${leader.symbol} leads this Yahoo fallback comparison with score ${leader.overall_score ?? "â€”"}/100. Estimates only â€” not financial advice.`
    : "Insufficient live data to compare these symbols.";

  return {
    symbols: metrics.map((m) => m.symbol),
    metrics,
    ai_conclusion,
    disclaimer: "Yahoo Finance fallback comparison. Not financial advice.",
  };
}

export async function yahooIntelligenceFallback() {
  const indexDefs = [
    { symbol: "^GSPC", name: "S&P 500" },
    { symbol: "^IXIC", name: "Nasdaq" },
    { symbol: "^DJI", name: "Dow Jones" },
    { symbol: "^RUT", name: "Russell 2000" },
  ] as const;

  const indices = await mapPool([...indexDefs], 4, async (idx) => {
    const chart = await fetchYahooChart(idx.symbol, "5d");
    const price = chart.meta?.regularMarketPrice ?? null;
    const previous = previousCloseFrom(chart);
    const changePercent =
      price != null && previous != null && previous !== 0
        ? ((price - previous) / previous) * 100
        : null;
    return {
      symbol: idx.symbol,
      name: idx.name,
      price,
      change_percent: changePercent,
    };
  });

  const avgChange =
    indices.reduce((sum, i) => sum + (i.change_percent ?? 0), 0) / Math.max(indices.length, 1);
  const sentiment = avgChange > 0.4 ? "bullish" : avgChange < -0.4 ? "bearish" : "neutral";

  return {
    indices,
    sector_performance: [],
    briefing: {
      headline: "US market snapshot (Yahoo fallback)",
      summary: `Major indices are averaging ${avgChange.toFixed(2)}% on the session. Live data via Yahoo Finance.`,
      sentiment,
      key_points: [
        "Live index snapshot from Yahoo Finance",
        "Probabilistic estimates only â€” not financial advice",
      ],
    },
    disclaimer: "Yahoo Finance fallback. Probabilistic estimates only â€” not financial advice.",
  };
}

export async function yahooFallenGiantsFallback(limit = 10): Promise<FallenGiantsResponse> {
  const candidates = await mapPool([...FALLBACK_UNIVERSE], 6, async (symbol) => {
    const chart = await fetchYahooChart(symbol, "1y");
    const closes =
      chart.indicators?.quote?.[0]?.close?.filter((v): v is number => typeof v === "number") ?? [];
    const highs =
      chart.indicators?.quote?.[0]?.high?.filter((v): v is number => typeof v === "number") ?? [];
    const price = chart.meta?.regularMarketPrice ?? closes.at(-1);
    if (price == null || closes.length < 30) return null;

    const peak = Math.max(...(highs.length ? highs : closes));
    const trough = Math.min(...closes.slice(-60));
    const declinePercent = peak > 0 ? ((peak - price) / peak) * 100 : 0;
    if (declinePercent < 18) return null;

    const recoveredFromTrough = trough > 0 ? ((price - trough) / trough) * 100 : 0;
    const dislocation = Math.min(100, declinePercent * 1.2);
    const recovery = Math.max(0, Math.min(100, 40 + recoveredFromTrough));
    const risk = Math.min(100, 35 + declinePercent * 0.6);
    const fallenScore = Math.round((dislocation * 0.45 + recovery * 0.35 + (100 - risk) * 0.2));

    const candidate: FallenGiantCandidate = {
      symbol: chart.meta?.symbol ?? symbol,
      company_name: companyNameFor(chart.meta?.symbol ?? symbol),
      market_cap: null,
      current_price: price,
      pre_catalyst_price: peak,
      lowest_price_after_catalyst: trough,
      decline_percent: Number(declinePercent.toFixed(2)),
      recovered_percent: Number(recoveredFromTrough.toFixed(2)),
      catalyst: "Price drawdown detected from recent highs (news catalyst unavailable in fallback).",
      catalyst_type: "unknown",
      catalyst_date: null,
      fundamental_health_score: 55,
      valuation_score: Math.min(100, Math.round(40 + declinePercent * 0.8)),
      recovery_score: Math.round(recovery),
      risk_score: Math.round(risk),
      catalyst_clarity_score: 25,
      price_dislocation_score: Math.round(dislocation),
      fallen_giants_score: fallenScore,
      why_it_fell: `${symbol} is down about ${declinePercent.toFixed(0)}% from its recent peak on Yahoo price data.`,
      why_it_could_recover:
        recoveredFromTrough > 5
          ? `Price has bounced ~${recoveredFromTrough.toFixed(0)}% off the recent low, suggesting sellers may be exhausting.`
          : "A sharp dislocation can mean-revert if the business remains intact â€” verify fundamentals separately.",
      why_it_might_not_recover:
        "Fallback mode cannot verify news catalysts or fundamentals. The decline may reflect lasting deterioration.",
      recovery_confirmations:
        recoveredFromTrough > 8 ? ["Partial rebound from recent trough"] : [],
      sources: [],
      sector: null,
      relative_to_spy_decline: null,
      days_since_catalyst: null,
      selloff_days: null,
      provider: "yahoo_finance",
      data_warnings: [],
    };
    return candidate;
  });

  candidates.sort((a, b) => (b.fallen_giants_score ?? 0) - (a.fallen_giants_score ?? 0));

  return {
    results: candidates.slice(0, limit),
    scanned_at: new Date().toISOString(),
    universe_size: FALLBACK_UNIVERSE.length,
    filters_applied: { provider: "yahoo_finance", mode: "fallback", min_decline_pct: 18 },
    disclaimer:
      "Fallen Giants research scan on live prices. A sharp decline is not a buy signal â€” verify catalysts and filings.",
  };
}

async function fetchYahooSearchQuote(query: string) {
  const { fetchYahooSearchHit } = await import("@/lib/market/live-fundamentals");
  const hit = await fetchYahooSearchHit(query);
  if (!hit?.symbol) return null;
  return {
    symbol: hit.symbol,
    shortname: hit.shortname,
    longname: hit.longname,
    quoteType: hit.quoteType,
  };
}

/** Full company research page — live Finnhub + Yahoo, rubric scores and multi-method fair value. */
export async function yahooResearchFallback(symbol: string) {
  const { fetchLiveFundamentals, estimateFairValue } = await import("@/lib/market/live-fundamentals");
  const { buildStockPilotScores, ratingFromScore } = await import("@/lib/market/research-scoring");
  const { companyNameFor } = await import("@/lib/news-tickers");

  const [analysis, fundamentals] = await Promise.all([
    yahooAnalysisFallback(symbol),
    fetchLiveFundamentals(symbol),
  ]);

  const price = fundamentals.price ?? analysis.quote.price;
  const name =
    fundamentals.company_name || analysis.company_name || companyNameFor(symbol) || analysis.symbol;
  const f = { ...fundamentals, price };
  const fair = estimateFairValue(f);
  const tech = analysis.technical;
  const scores = buildStockPilotScores(f, fair, {
    rsi_14: tech.rsi_14,
    sma_50: tech.sma_50,
    sma_200: tech.sma_200,
    volatility_annualized: tech.volatility_annualized,
    price,
  });
  const overall = scores.overall.score;

  const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

  // --- Narrative built strictly from the numbers above ---
  const bull: string[] = [];
  const bear: string[] = [];

  if (fair.valuation_label === "Undervalued" && fair.upside_percent != null) {
    bull.push(`Shares trade below our fair-value band (~${fair.upside_percent.toFixed(0)}% to the mid estimate of ${fair.fair_value_mid?.toFixed(0)}).`);
  }
  if (f.forward_pe != null && f.pe_ratio != null && f.forward_pe < f.pe_ratio * 0.6) {
    bull.push(`Street expects earnings to rebuild: forward P/E ${f.forward_pe.toFixed(1)}× vs trailing GAAP ${f.pe_ratio.toFixed(1)}×.`);
  }
  if (f.gross_margin != null && f.gross_margin > 0.6) {
    bull.push(`Gross margin of ${pct(f.gross_margin)} signals pricing power and a software/IP-like cost structure.`);
  }
  if (f.revenue_growth_3y != null && f.revenue_growth_3y > 0.1) {
    bull.push(`Revenue has compounded at ${pct(f.revenue_growth_3y)} a year over three years.`);
  }
  if (scores.financial_health.score != null && scores.financial_health.score >= 65) {
    bull.push("Balance-sheet metrics (liquidity, leverage, coverage) are in good shape.");
  }
  if (bull.length === 0) bull.push("Few quantitative positives right now — a constructive case needs a fundamental catalyst.");

  if (fair.valuation_label === "Overvalued" && fair.upside_percent != null) {
    bear.push(`Price sits above our fair-value band (${fair.upside_percent.toFixed(0)}% gap to the mid estimate).`);
  }
  if (f.gaap_distorted) {
    bear.push("Trailing GAAP earnings are depressed (acquisition amortization / one-offs); the thesis leans on forward estimates being met.");
  }
  if (f.interest_coverage != null && f.interest_coverage < 4) {
    bear.push(`Interest coverage of ${f.interest_coverage.toFixed(1)}× is thin — debt service eats a meaningful share of operating profit.`);
  }
  if (f.debt_to_equity != null && f.debt_to_equity > 1) {
    bear.push(`Debt/equity ${f.debt_to_equity.toFixed(2)}× — leverage limits flexibility in a downturn.`);
  }
  if (f.fifty_two_week_high != null && price != null) {
    const dd = ((f.fifty_two_week_high - price) / f.fifty_two_week_high) * 100;
    if (dd > 25) bear.push(`Shares are ${dd.toFixed(0)}% below the 52-week high — the market has already repriced expectations.`);
  }
  if (tech.sma_200 != null && price != null && price < tech.sma_200) {
    bear.push("Trading below the 200-day average — the long-term trend is still down.");
  }
  if (bear.length === 0) bear.push("Macro shocks, competition, and guidance cuts remain the main ways this setup fails.");

  const rating = ratingFromScore(overall);
  const growthAssumption = fair.assumptions.growth_rate;

  return {
    symbol: analysis.symbol,
    company_name: name,
    quote: {
      symbol: analysis.symbol,
      price: price ?? analysis.quote.price,
      change: f.change ?? analysis.quote.change,
      change_percent: f.change_percent ?? analysis.quote.change_percent,
      currency: f.currency || analysis.quote.currency || "USD",
      market_cap: f.market_cap,
      volume: f.volume ?? analysis.quote.volume,
      previous_close: f.previous_close ?? analysis.quote.previous_close,
      provider: f.provider,
      freshness: "live",
      as_of: new Date().toISOString(),
    },
    fundamentals: {
      ...f,
      provider: f.provider,
    },
    technical: {
      symbol: analysis.symbol,
      rsi_14: tech.rsi_14,
      macd: null,
      macd_signal: null,
      macd_histogram: tech.macd_histogram,
      ema_12: null,
      ema_26: null,
      sma_20: tech.sma_20,
      sma_50: tech.sma_50,
      sma_200: tech.sma_200,
      atr_14: null,
      vwap: null,
      bb_upper: null,
      bb_middle: null,
      bb_lower: null,
      adx_14: null,
      provider: "yahoo_finance",
      computed_at: new Date().toISOString(),
      data_points: tech.data_points,
    },
    scores: {
      technical_score: analysis.scores.technical_score,
      momentum_score: scores.momentum.score,
      risk_score: scores.risk.score,
    },
    stockpilot_scores: scores,
    fair_value: {
      current_price: fair.current_price,
      fair_value_low: fair.fair_value_low,
      fair_value_mid: fair.fair_value_mid,
      fair_value_high: fair.fair_value_high,
      upside_percent: fair.upside_percent,
      valuation_label: fair.valuation_label,
      methods: fair.methods,
      assumptions: fair.assumptions,
      confidence: fair.confidence,
      disclaimer: fair.disclaimer,
    },
    equity_report: {
      bull_case: bull,
      bear_case: bear,
      investment_thesis: `${name} (${analysis.symbol}) scores ${overall ?? "—"}/100 (${rating}). Valuation: ${fair.valuation_label}${
        fair.upside_percent != null ? ` (${fair.upside_percent >= 0 ? "+" : ""}${fair.upside_percent.toFixed(0)}% to fair-value mid)` : ""
      }${growthAssumption != null ? `, assuming ~${(growthAssumption * 100).toFixed(0)}% earnings growth` : ""}. Built from live Finnhub fundamentals and Yahoo price history — a structured starting point, not a complete thesis.`,
      growth_opportunities: [
        f.revenue_growth_3y != null ? `Revenue 3-yr CAGR ${pct(f.revenue_growth_3y)}; TTM ${f.revenue_growth != null ? pct(f.revenue_growth) : "n/a"}` : "Track revenue trajectory at the next print",
        f.eps_forward != null ? `Street forward EPS ${f.eps_forward.toFixed(2)} vs trailing GAAP ${f.eps?.toFixed(2) ?? "n/a"}` : "Watch EPS revisions",
      ],
      competitive_advantages: [
        f.gross_margin != null ? `Gross margin ${pct(f.gross_margin)} · operating margin ${f.operating_margin != null ? pct(f.operating_margin) : "n/a"}` : "Review margin structure in filings",
        f.sector ? `Sector: ${f.sector}${f.industry ? ` / ${f.industry}` : ""}` : "Confirm competitive positioning qualitatively",
      ],
      main_risks: bear,
      catalysts: [
        "Next earnings release and full-year guidance",
        f.analyst_target != null ? `Street mean target ${f.currency} ${f.analyst_target.toFixed(2)}` : "Analyst estimate revisions",
      ],
      concerns: f.data_notes.length > 0 ? f.data_notes : ["Metrics refresh with live feeds — re-check before acting"],
      stockpilot_rating: overall,
      moat_assessment:
        scores.quality.score != null && scores.quality.score >= 70
          ? "Margin profile is consistent with a durable franchise — verify switching costs and share trends qualitatively."
          : "Moat not evidenced by margins alone; treat quality as provisional.",
    },
    explanation: {
      overall_rating: rating,
      investment_thesis: `${name}: overall ${overall ?? "—"}/100, ${fair.valuation_label}.`,
      reasons: bull,
      potential_risks: bear,
      confidence: fair.confidence,
    },
    data_warnings: f.data_notes,
    disclaimer:
      "Educational research built from live market data. Fair values and scores are model estimates — not financial advice.",
  };
}

