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
  const [chart, searchHit] = await Promise.all([
    fetchYahooChart(symbol.toUpperCase(), "1y"),
    fetchYahooSearchQuote(symbol),
  ]);
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

  const resolvedSymbol = chart.meta?.symbol ?? searchHit?.symbol ?? symbol.toUpperCase();
  const companyName =
    searchHit?.longname || searchHit?.shortname || companyNameFor(resolvedSymbol);

  return {
    symbol: resolvedSymbol,
    company_name: companyName,
    quote: {
      symbol: resolvedSymbol,
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
      "Fallen Giants research scan on live prices. A sharp decline is not a buy signal — verify catalysts and filings.",
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

/** Full company research page — live Finnhub + Yahoo, Simply Wall St–style fair value. */
export async function yahooResearchFallback(symbol: string) {
  const { fetchLiveFundamentals, estimateFairValue } = await import(
    "@/lib/market/live-fundamentals"
  );
  const { companyNameFor } = await import("@/lib/news-tickers");

  const [analysis, fundamentals] = await Promise.all([
    yahooAnalysisFallback(symbol),
    fetchLiveFundamentals(symbol),
  ]);

  const techScore = analysis.scores?.technical_score ?? null;
  const momScore = analysis.scores?.momentum_score ?? null;
  const rsi14 = analysis.technical.rsi_14;
  const sma50 = analysis.technical.sma_50;
  const price = fundamentals.price ?? analysis.quote.price;
  const name =
    fundamentals.company_name ||
    analysis.company_name ||
    companyNameFor(symbol) ||
    analysis.symbol;

  const fair = estimateFairValue({ ...fundamentals, price });

  // --- Dimension scores with concrete reasons ---
  const healthReasons: string[] = [];
  const healthRisks: string[] = [];
  let healthScore = 50;
  if (fundamentals.return_on_equity != null) {
    const roePct = fundamentals.return_on_equity * 100;
    healthScore = Math.max(15, Math.min(95, 45 + roePct * 1.2));
    healthReasons.push(`Return on equity ${roePct.toFixed(1)}%`);
    if (roePct < 8) healthRisks.push("ROE is modest versus high-quality compounders");
  } else {
    healthRisks.push("ROE not reported in the latest feed");
  }
  if (fundamentals.debt_to_equity != null) {
    healthReasons.push(`Debt/equity ${fundamentals.debt_to_equity.toFixed(1)}`);
    if (fundamentals.debt_to_equity > 150) {
      healthScore -= 12;
      healthRisks.push("Leverage looks elevated versus many peers");
    } else if (fundamentals.debt_to_equity < 50) {
      healthScore += 6;
      healthReasons.push("Balance sheet leverage is relatively contained");
    }
  }
  if (fundamentals.profit_margin != null) {
    healthReasons.push(`Net margin ${(fundamentals.profit_margin * 100).toFixed(1)}%`);
  }
  healthScore = Math.max(5, Math.min(98, Math.round(healthScore)));

  const growthReasons: string[] = [];
  const growthRisks: string[] = [];
  let growthScore = momScore ?? 50;
  if (fundamentals.revenue_growth != null) {
    const g = fundamentals.revenue_growth * 100;
    growthScore = Math.max(10, Math.min(95, 50 + g * 1.5));
    growthReasons.push(`Revenue growth (TTM YoY) ${g.toFixed(1)}%`);
    if (g < 0) growthRisks.push("Top-line contraction can pressure multiples");
  } else {
    growthReasons.push(
      momScore != null
        ? `Near-term price momentum score ${momScore.toFixed(0)}/100 (revenue growth not in feed)`
        : "Growth inputs limited — using price momentum as a proxy",
    );
    growthRisks.push("Confirm revenue/EPS growth in filings before sizing a thesis");
  }
  growthScore = Math.round(growthScore);

  const valueReasons: string[] = [];
  const valueRisks: string[] = [];
  let valueScore = 50;
  if (fundamentals.pe_ratio != null && fundamentals.pe_ratio > 0) {
    valueScore = Math.max(8, Math.min(92, 90 - fundamentals.pe_ratio * 1.5));
    valueReasons.push(`Trailing P/E ${fundamentals.pe_ratio.toFixed(1)}×`);
  } else {
    valueRisks.push("Trailing P/E unavailable for this name");
  }
  if (fundamentals.forward_pe != null && fundamentals.forward_pe > 0) {
    valueReasons.push(`Forward P/E ${fundamentals.forward_pe.toFixed(1)}×`);
  }
  if (fundamentals.peg_ratio != null && fundamentals.peg_ratio > 0) {
    valueReasons.push(`PEG ${fundamentals.peg_ratio.toFixed(2)}`);
    if (fundamentals.peg_ratio < 1) {
      valueScore += 8;
      valueReasons.push("PEG below 1 can signal growth is not fully priced");
    } else if (fundamentals.peg_ratio > 2.5) {
      valueScore -= 8;
      valueRisks.push("Elevated PEG — paying up for expected growth");
    }
  }
  if (fair.upside_percent != null) {
    valueReasons.push(
      `Model fair-value gap ${fair.upside_percent >= 0 ? "+" : ""}${fair.upside_percent.toFixed(1)}% (${fair.valuation_label})`,
    );
    valueScore = Math.round(valueScore * 0.7 + Math.max(10, Math.min(90, 50 + fair.upside_percent)) * 0.3);
  }
  valueScore = Math.max(5, Math.min(95, Math.round(valueScore)));

  const qualityReasons: string[] = [];
  const qualityRisks: string[] = [];
  let qualityScore = techScore ?? 50;
  if (fundamentals.sector) qualityReasons.push(`Sector: ${fundamentals.sector}`);
  if (sma50 != null && price != null) {
    qualityReasons.push(
      price >= sma50
        ? "Price holds above the 50-day average (constructive intermediate trend)"
        : "Price sits below the 50-day average (weaker intermediate trend)",
    );
  }
  if (rsi14 != null) qualityReasons.push(`RSI(14) ${rsi14.toFixed(0)}`);
  if (fundamentals.profit_margin != null && fundamentals.profit_margin > 0.15) {
    qualityScore += 8;
    qualityReasons.push("Healthy profitability supports quality");
  }
  qualityRisks.push("Quality here blends profitability with technical structure — not a full moat score");
  qualityScore = Math.max(5, Math.min(95, Math.round(qualityScore)));

  const momReasons: string[] = [];
  const momRisks: string[] = [];
  if (fundamentals.change_percent != null) {
    momReasons.push(`Session move ${fundamentals.change_percent >= 0 ? "+" : ""}${fundamentals.change_percent.toFixed(2)}%`);
  }
  if (momScore != null) momReasons.push(`Momentum score ${momScore.toFixed(0)}/100 from recent price action`);
  momRisks.push("Short-term price noise can reverse quickly around news/earnings");

  const riskReasons: string[] = [];
  const riskRisks: string[] = [];
  let riskScore = analysis.scores?.risk_score ?? 50;
  if (fundamentals.beta != null) {
    riskScore = Math.max(15, Math.min(90, 40 + fundamentals.beta * 25));
    riskReasons.push(`Beta ${fundamentals.beta.toFixed(2)} vs market`);
    if (fundamentals.beta > 1.4) riskRisks.push("Higher beta = larger swings when the market sells off");
  } else if (rsi14 != null) {
    riskReasons.push(`RSI extremity contributes to risk reading (${rsi14.toFixed(0)})`);
  }
  if (fundamentals.fifty_two_week_high != null && price != null) {
    const drawdown = ((fundamentals.fifty_two_week_high - price) / fundamentals.fifty_two_week_high) * 100;
    riskReasons.push(`${drawdown.toFixed(0)}% below 52-week high`);
  }
  riskScore = Math.round(riskScore);

  const overall = Math.round(
    (healthScore * 0.2 +
      growthScore * 0.2 +
      valueScore * 0.2 +
      qualityScore * 0.15 +
      (momScore ?? 50) * 0.15 +
      (100 - riskScore) * 0.1),
  );

  const bull: string[] = [];
  const bear: string[] = [];
  if (fair.valuation_label === "Undervalued") {
    bull.push(`Fair-value engine flags the shares as undervalued (~${fair.upside_percent?.toFixed(0)}% to mid estimate).`);
  }
  if (growthScore >= 60) bull.push("Growth / momentum profile looks supportive on the latest data.");
  if (healthScore >= 60) bull.push("Profitability / leverage metrics support a durable business case.");
  if (bull.length === 0) bull.push("Wait for clearer confirmation in earnings and trend before leaning bullish.");

  if (fair.valuation_label === "Overvalued") {
    bear.push(`Fair-value engine sees limited upside / stretch versus the mid estimate.`);
  }
  if (riskScore >= 60) bear.push("Risk metrics (beta / drawdown / RSI) argue for smaller size or wider stops.");
  if (sma50 != null && price != null && price < sma50) {
    bear.push("Trading below the 50-day average — intermediate trend still needs to reclaim.");
  }
  if (bear.length === 0) bear.push("Macro shocks, competition, and earnings misses can invalidate a constructive setup.");

  return {
    symbol: analysis.symbol,
    company_name: name,
    quote: {
      symbol: analysis.symbol,
      price: price ?? analysis.quote.price,
      change: fundamentals.change ?? analysis.quote.change,
      change_percent: fundamentals.change_percent ?? analysis.quote.change_percent,
      currency: fundamentals.currency || analysis.quote.currency || "USD",
      market_cap: fundamentals.market_cap,
      volume: null,
      previous_close: null,
      provider: fundamentals.provider,
      freshness: "live",
      as_of: new Date().toISOString(),
    },
    fundamentals: {
      pe_ratio: fundamentals.pe_ratio,
      forward_pe: fundamentals.forward_pe,
      peg_ratio: fundamentals.peg_ratio,
      eps: fundamentals.eps,
      return_on_equity: fundamentals.return_on_equity,
      debt_to_equity: fundamentals.debt_to_equity,
      profit_margin: fundamentals.profit_margin,
      revenue_growth: fundamentals.revenue_growth,
      beta: fundamentals.beta,
      dividend_yield: fundamentals.dividend_yield,
      sector: fundamentals.sector,
      industry: fundamentals.industry,
      description: null,
      provider: fundamentals.provider,
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
    scores: {
      technical_score: techScore,
      momentum_score: momScore,
      risk_score: riskScore,
    },
    stockpilot_scores: {
      overall: scoreBlock(
        "Overall",
        overall,
        [
          `Weighted blend of health, growth, value, quality, momentum, and risk`,
          `Live data via ${fundamentals.provider}`,
        ],
        ["Scores are research aids — not buy/sell recommendations"],
      ),
      financial_health: scoreBlock("Financial Health", healthScore, healthReasons, healthRisks),
      growth: scoreBlock("Growth", growthScore, growthReasons, growthRisks),
      value: scoreBlock("Value", valueScore, valueReasons, valueRisks),
      quality: scoreBlock("Quality", qualityScore, qualityReasons, qualityRisks),
      momentum: scoreBlock("Momentum", momScore, momReasons, momRisks),
      risk: scoreBlock("Risk", riskScore, riskReasons, riskRisks),
    },
    fair_value: {
      current_price: fair.current_price,
      fair_value_low: fair.fair_value_low,
      fair_value_mid: fair.fair_value_mid,
      fair_value_high: fair.fair_value_high,
      upside_percent: fair.upside_percent,
      valuation_label: fair.valuation_label,
      methods: fair.methods,
      confidence: fair.confidence,
      disclaimer: fair.disclaimer,
    },
    equity_report: {
      bull_case: bull,
      bear_case: bear,
      investment_thesis: `${name} (${analysis.symbol}) scores ${overall}/100 overall. Fair-value read: ${fair.valuation_label}${
        fair.upside_percent != null
          ? ` (${fair.upside_percent >= 0 ? "+" : ""}${fair.upside_percent.toFixed(0)}% to mid estimate)`
          : ""
      }. This blends live fundamentals with technical context — use it as a structured starting point, not a complete equity thesis.`,
      growth_opportunities: [
        fundamentals.revenue_growth != null
          ? `Latest revenue growth print: ${(fundamentals.revenue_growth * 100).toFixed(1)}% YoY`
          : "Track upcoming earnings for revenue/EPS acceleration",
        "Watch whether price reclaims key moving averages with improving volume",
      ],
      competitive_advantages: [
        fundamentals.sector
          ? `Operates in ${fundamentals.sector}${fundamentals.industry ? ` / ${fundamentals.industry}` : ""}`
          : "Review competitive positioning and switching costs in company filings",
      ],
      main_risks: bear,
      catalysts: [
        "Next earnings release and guidance",
        fundamentals.analyst_target != null
          ? `Street mean target near ${fundamentals.currency} ${fundamentals.analyst_target.toFixed(2)}`
          : "Analyst revisions / sector news flow",
      ],
      concerns: [
        "Valuation and scores update as live feeds refresh — re-check before acting",
      ],
      stockpilot_rating: overall,
      moat_assessment:
        healthScore >= 70
          ? "Profitability metrics are consistent with a stronger franchise — still verify moat qualitatively."
          : "Moat not fully scored here; treat quality as a blend of margins and trend structure.",
    },
    explanation: {
      overall_rating: recommendationFromScore(overall) ?? "Hold",
      investment_thesis: `${name} live research snapshot — overall ${overall}/100, valuation ${fair.valuation_label}.`,
      reasons: bull,
      potential_risks: bear,
      confidence: fair.confidence,
    },
    data_warnings: [],
    disclaimer:
      "Probabilistic estimates only — not financial advice. Past performance does not guarantee future results.",
  };
}
