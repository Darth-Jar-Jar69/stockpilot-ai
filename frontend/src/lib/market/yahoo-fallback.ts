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
  "AVGO", "COST", "LLY", "AMD", "NFLX", "ASML", "RACE", "TSM",
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
  const previous = chart.meta?.previousClose ?? chart.meta?.chartPreviousClose ?? null;
  const change = price != null && previous != null ? price - previous : null;
  const changePercent =
    price != null && previous != null && previous !== 0 ? (change! / previous) * 100 : null;

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
          status: "degraded",
          message: "Primary analysis API not linked — using Yahoo fallback",
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
      "Yahoo Finance fallback scan. Probabilistic estimates only — not financial advice.",
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
      "Yahoo Finance fallback screener. Probabilistic estimates only — not financial advice.",
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
    ? `${leader.symbol} leads this Yahoo fallback comparison with score ${leader.overall_score ?? "—"}/100. Estimates only — not financial advice.`
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
    const previous = chart.meta?.previousClose ?? chart.meta?.chartPreviousClose ?? null;
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
        "Probabilistic estimates only — not financial advice",
      ],
    },
    disclaimer: "Yahoo Finance fallback. Probabilistic estimates only — not financial advice.",
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
          : "A sharp dislocation can mean-revert if the business remains intact — verify fundamentals separately.",
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
      data_warnings: [
        "Fallen Giants fallback uses price drawdowns only — catalyst/news enrichment requires the FastAPI backend.",
      ],
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
      "Fallen Giants Yahoo fallback. Price-based only — not financial advice.",
  };
}

function scoreBlock(
  label: string,
  score: number | null,
  reasons: string[],
  risks: string[],
) {
  return { score, label, reasons, risks };
}

async function fetchYahooQuoteSummary(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const url = new URL(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`,
    );
    url.searchParams.set(
      "modules",
      "summaryProfile,defaultKeyStatistics,financialData,price",
    );
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      quoteSummary?: { result?: Array<Record<string, unknown>> };
    };
    return json.quoteSummary?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

function rawNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "raw" in value) {
    const raw = (value as { raw?: unknown }).raw;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }
  return null;
}

/** Full company research page payload when FastAPI is unavailable. */
export async function yahooResearchFallback(symbol: string) {
  const analysis = await yahooAnalysisFallback(symbol);
  const summary = await fetchYahooQuoteSummary(symbol.toUpperCase());
  const profile = (summary?.summaryProfile ?? {}) as Record<string, unknown>;
  const stats = (summary?.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const financial = (summary?.financialData ?? {}) as Record<string, unknown>;
  const priceMod = (summary?.price ?? {}) as Record<string, unknown>;

  const techScore = analysis.scores?.technical_score ?? null;
  const momScore = analysis.scores?.momentum_score ?? null;
  const riskScore = analysis.scores?.risk_score ?? null;
  const overallParts = [techScore, momScore].filter((v): v is number => v != null);
  const overall =
    overallParts.length > 0
      ? Math.round(overallParts.reduce((a, b) => a + b, 0) / overallParts.length)
      : null;

  const price = analysis.quote.price;
  const sma50 = analysis.technical.sma_50;
  const fairMid =
    sma50 != null ? sma50 : price != null ? price * (1 + (momScore != null ? (momScore - 50) / 400 : 0)) : null;
  const fairLow = fairMid != null ? fairMid * 0.9 : null;
  const fairHigh = fairMid != null ? fairMid * 1.1 : null;
  const upside =
    price != null && fairMid != null && price !== 0 ? ((fairMid - price) / price) * 100 : null;

  const name =
    (typeof priceMod.longName === "string" && priceMod.longName) ||
    (typeof priceMod.shortName === "string" && priceMod.shortName) ||
    companyNameFor(symbol);

  const peRatio = rawNumber(stats.trailingPE);
  const roe = rawNumber(financial.returnOnEquity);
  const debtToEquity = rawNumber(financial.debtToEquity);
  const marketCap = rawNumber(priceMod.marketCap) ?? rawNumber(stats.marketCap);
  const volume = rawNumber(priceMod.regularMarketVolume);

  const rsi14 = analysis.technical.rsi_14;
  const bull: string[] = [];
  const bear: string[] = [];
  if (momScore != null && momScore >= 55) bull.push("Near-term momentum is constructive on Yahoo price data.");
  if (rsi14 != null && rsi14 < 35) bull.push("RSI is relatively washed out, which can favor mean-reversion setups.");
  if (sma50 != null && price != null && price >= sma50) {
    bull.push("Price is holding above the 50-day average.");
  }
  if (bull.length === 0) bull.push("Watch for stabilizing price action and improving breadth before sizing up.");

  if (rsi14 != null && rsi14 > 70) bear.push("RSI is elevated — pullback risk is higher.");
  if (sma50 != null && price != null && price < sma50) {
    bear.push("Price is below the 50-day average, signaling weaker intermediate trend.");
  }
  if (momScore != null && momScore < 45) bear.push("Momentum score is soft on recent session moves.");
  if (bear.length === 0) bear.push("Macro shocks and earnings surprises can invalidate a technical-only thesis.");

  return {
    symbol: analysis.symbol,
    company_name: name,
    quote: {
      symbol: analysis.quote.symbol,
      price: analysis.quote.price,
      change: analysis.quote.change,
      change_percent: analysis.quote.change_percent,
      currency: analysis.quote.currency,
      market_cap: marketCap,
      volume,
      previous_close: null,
      provider: "yahoo_finance",
      freshness: "live",
      as_of: new Date().toISOString(),
    },
    fundamentals: {
      pe_ratio: peRatio,
      return_on_equity: roe,
      debt_to_equity: debtToEquity,
      sector: typeof profile.sector === "string" ? profile.sector : null,
      industry: typeof profile.industry === "string" ? profile.industry : null,
      description: typeof profile.longBusinessSummary === "string" ? profile.longBusinessSummary : null,
      provider: "yahoo_finance",
    },
    technical: {
      symbol: analysis.symbol,
      rsi_14: analysis.technical.rsi_14,
      macd: null,
      macd_signal: null,
      macd_histogram: analysis.technical.macd_histogram,
      ema_12: null,
      ema_26: null,
      sma_20: null,
      sma_50: analysis.technical.sma_50,
      sma_200: null,
      atr_14: null,
      vwap: null,
      bb_upper: null,
      bb_middle: null,
      bb_lower: null,
      adx_14: null,
      provider: "yahoo_finance",
      computed_at: new Date().toISOString(),
      data_points: analysis.technical.data_points,
    },
    scores: analysis.scores,
    stockpilot_scores: {
      overall: scoreBlock(
        "Overall",
        overall,
        ["Blended from Yahoo technical + momentum signals"],
        ["Fundamentals may be incomplete in fallback mode"],
      ),
      financial_health: scoreBlock(
        "Financial Health",
        roe != null ? Math.max(20, Math.min(90, 50 + roe * 100)) : 50,
        roe != null ? [`ROE ${((roe ?? 0) * 100).toFixed(1)}%`] : ["Limited fundamental fields from Yahoo"],
        ["Balance-sheet depth requires full backend research"],
      ),
      growth: scoreBlock(
        "Growth",
        momScore,
        ["Proxy from recent price momentum"],
        ["Not a substitute for revenue/EPS growth analysis"],
      ),
      value: scoreBlock(
        "Value",
        peRatio != null && peRatio > 0 ? Math.max(15, Math.min(85, 80 - peRatio)) : 50,
        peRatio != null ? [`Trailing P/E ${peRatio.toFixed(1)}`] : ["P/E unavailable"],
        ["Valuation models are simplified in fallback mode"],
      ),
      quality: scoreBlock(
        "Quality",
        techScore,
        ["Technical structure quality from RSI / SMA context"],
        ["Does not measure moat or accounting quality"],
      ),
      momentum: scoreBlock(
        "Momentum",
        momScore,
        ["Derived from recent % change"],
        ["Short-term noise can distort momentum"],
      ),
      risk: scoreBlock(
        "Risk",
        riskScore,
        ["Derived from RSI extremity"],
        ["Does not include drawdown/volatility regime fully"],
      ),
    },
    fair_value: {
      current_price: price,
      fair_value_low: fairLow,
      fair_value_mid: fairMid,
      fair_value_high: fairHigh,
      upside_percent: upside,
      methods: [
        {
          name: "SMA50 anchor",
          estimate: fairMid,
          note: "Lightweight technical anchor while FastAPI research is offline",
        },
      ],
      confidence: 40,
      disclaimer: "Yahoo fallback fair-value band — illustrative only, not a valuation model.",
    },
    equity_report: {
      bull_case: bull,
      bear_case: bear,
      investment_thesis: `${analysis.symbol} research is running in Yahoo fallback mode. Overall technical/momentum score is ${overall ?? "n/a"}/100. Use this as a starting point, not a complete equity thesis.`,
      growth_opportunities: [
        "Confirm product/segment growth in the latest filings",
        "Watch whether price reclaims key moving averages with volume",
      ],
      competitive_advantages: [
        typeof profile.sector === "string"
          ? `Operates in ${profile.sector}${typeof profile.industry === "string" ? ` / ${profile.industry}` : ""}`
          : "Review competitive positioning in company filings",
      ],
      main_risks: bear,
      catalysts: ["Upcoming earnings", "Sector rotation / macro risk appetite"],
      concerns: ["Fallback mode cannot fully verify fundamentals or analyst models"],
      stockpilot_rating: overall,
      moat_assessment: "Moat not scored in Yahoo fallback — qualitative only.",
    },
    explanation: {
      overall_rating: recommendationFromScore(overall) ?? "Hold",
      investment_thesis: `Technical/momentum snapshot for ${analysis.symbol} via Yahoo Finance.`,
      reasons: bull,
      potential_risks: bear,
      confidence: 45,
    },
    data_warnings: [
      "Company research served via Yahoo Finance fallback (FastAPI research API not linked).",
    ],
    disclaimer:
      "Probabilistic estimates only — not financial advice. Past performance does not guarantee future results.",
  };
}
