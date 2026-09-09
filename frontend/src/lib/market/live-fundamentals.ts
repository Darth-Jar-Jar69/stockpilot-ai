/** Live fundamentals via Finnhub (preferred) with Yahoo chart/search support. */

const YAHOO_UA = "Mozilla/5.0 (compatible; StockPilot/1.0)";

export type LiveFundamentals = {
  symbol: string;
  company_name: string | null;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  currency: string;
  market_cap: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  peg_ratio: number | null;
  eps: number | null;
  revenue_growth: number | null;
  profit_margin: number | null;
  return_on_equity: number | null;
  debt_to_equity: number | null;
  beta: number | null;
  dividend_yield: number | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  analyst_target: number | null;
  provider: string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

async function finnhubGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) return null;
  const url = new URL(`https://finnhub.io/api/v1${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

type YahooChartMeta = {
  currency?: string;
  symbol?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketVolume?: number;
};

export async function fetchYahooChartMeta(symbol: string, range = "1y") {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", range);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: YahooChartMeta;
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
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  if (!result?.meta) throw new Error("Yahoo chart empty");
  return result;
}

export async function fetchYahooSearchHit(query: string) {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "8");
  url.searchParams.set("newsCount", "0");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    quotes?: Array<{
      symbol?: string;
      shortname?: string;
      longname?: string;
      quoteType?: string;
      sector?: string;
      industry?: string;
    }>;
  };
  const quotes = json.quotes ?? [];
  const upper = query.trim().toUpperCase();
  return (
    quotes.find((q) => (q.symbol ?? "").toUpperCase() === upper) ??
    quotes.find((q) => q.quoteType === "EQUITY") ??
    quotes[0] ??
    null
  );
}

/** Aggregate live fundamentals for research / scoring. */
export async function fetchLiveFundamentals(symbol: string): Promise<LiveFundamentals> {
  const sym = symbol.toUpperCase();

  const [chart, search, quote, profile, metrics, target] = await Promise.all([
    fetchYahooChartMeta(sym, "1y"),
    fetchYahooSearchHit(sym),
    finnhubGet<Record<string, number>>("/quote", { symbol: sym }),
    finnhubGet<Record<string, unknown>>("/stock/profile2", { symbol: sym }),
    finnhubGet<{ metric?: Record<string, unknown> }>("/stock/metric", {
      symbol: sym,
      metric: "all",
    }),
    finnhubGet<Record<string, unknown>>("/stock/price-target", { symbol: sym }),
  ]);

  const meta = chart.meta ?? {};
  const closes =
    chart.indicators?.quote?.[0]?.close?.filter((v): v is number => typeof v === "number") ?? [];
  const price =
    num(quote?.c) ??
    meta.regularMarketPrice ??
    closes.at(-1) ??
    null;
  const previous = num(quote?.pc) ?? meta.previousClose ?? meta.chartPreviousClose ?? null;
  const change = price != null && previous != null ? price - previous : num(quote?.d);
  const changePercent =
    price != null && previous != null && previous !== 0
      ? (change! / previous) * 100
      : num(quote?.dp);

  const m = metrics?.metric ?? {};
  const marketCap =
    num(profile?.marketCapitalization) != null
      ? num(profile?.marketCapitalization)! * 1_000_000 // Finnhub returns millions
      : num(m.marketCapitalization) != null
        ? num(m.marketCapitalization)! * 1_000_000
        : null;

  const pe =
    num(m.peNormalizedAnnual) ??
    num(m.peBasicExclExtraTTM) ??
    num(m.peTTM) ??
    num(m.peAnnual);
  const forwardPe = num(m.forwardPE);
  const peg = num(m.pegTTM) ?? num(m.pegRatio);
  const eps = num(m.epsNormalizedAnnual) ?? num(m.epsBasicExclExtraItemsTTM) ?? num(m.epsTTM);
  const revGrowth = num(m.revenueGrowthTTMYoy) ?? num(m.revenueGrowthQuarterlyYoy);
  // Finnhub often returns growth as percent already (e.g. 12.5) — normalize to ratio if > 2
  const revenueGrowth =
    revGrowth == null ? null : Math.abs(revGrowth) > 2 ? revGrowth / 100 : revGrowth;
  const profitMargin =
    (() => {
      const v = num(m.netProfitMarginTTM) ?? num(m.netMargin);
      if (v == null) return null;
      return Math.abs(v) > 1 ? v / 100 : v;
    })();
  const roe =
    (() => {
      const v = num(m.roeTTM) ?? num(m.roeRfy);
      if (v == null) return null;
      return Math.abs(v) > 2 ? v / 100 : v;
    })();
  const debtToEquity = num(m.totalDebtToEquityAnnual) ?? num(m.totalDebtToEquityQuarterly);
  const beta = num(m.beta);
  const divYield =
    (() => {
      const v = num(m.dividendYieldIndicatedAnnual);
      if (v == null) return null;
      return Math.abs(v) > 1 ? v / 100 : v;
    })();

  const companyName =
    (typeof profile?.name === "string" && profile.name) ||
    search?.longname ||
    search?.shortname ||
    null;

  return {
    symbol: sym,
    company_name: companyName,
    price,
    change,
    change_percent: changePercent,
    currency: meta.currency ?? "USD",
    market_cap: marketCap,
    pe_ratio: pe,
    forward_pe: forwardPe,
    peg_ratio: peg,
    eps,
    revenue_growth: revenueGrowth,
    profit_margin: profitMargin,
    return_on_equity: roe,
    debt_to_equity: debtToEquity,
    beta,
    dividend_yield: divYield,
    sector:
      (typeof profile?.finnhubIndustry === "string" && profile.finnhubIndustry) ||
      search?.sector ||
      null,
    industry: search?.industry ?? null,
    description: typeof profile?.weburl === "string" ? null : null,
    fifty_two_week_high: meta.fiftyTwoWeekHigh ?? num(m["52WeekHigh"]),
    fifty_two_week_low: meta.fiftyTwoWeekLow ?? num(m["52WeekLow"]),
    analyst_target: num(target?.targetMean) ?? num(target?.targetMedian),
    provider: process.env.FINNHUB_API_KEY ? "finnhub+yahoo" : "yahoo_finance",
  };
}

/**
 * Simply Wall St–style relative fair value:
 * blend of (EPS × fair PE), analyst target, and 52-week midpoint pull.
 */
export function estimateFairValue(f: LiveFundamentals): {
  current_price: number | null;
  fair_value_low: number | null;
  fair_value_mid: number | null;
  fair_value_high: number | null;
  upside_percent: number | null;
  valuation_label: "Undervalued" | "About fair" | "Overvalued" | "Insufficient data";
  methods: { name: string; estimate: number | null; note: string | null }[];
  confidence: number;
  disclaimer: string;
} {
  const price = f.price;
  const methods: { name: string; estimate: number | null; note: string | null }[] = [];

  // 1) Earnings power: EPS × growth-adjusted PE
  let earningsFv: number | null = null;
  if (f.eps != null && f.eps > 0) {
    const growthPct = (f.revenue_growth ?? 0.08) * 100;
    const fairPe = Math.max(10, Math.min(35, 14 + growthPct * 0.45));
    earningsFv = f.eps * fairPe;
    methods.push({
      name: "Earnings multiple",
      estimate: earningsFv,
      note: `EPS ${f.eps.toFixed(2)} × fair P/E ${fairPe.toFixed(1)} (growth-adjusted)`,
    });
  }

  // 2) PEG-style: if PEG available, imply fair PE = growth
  if (f.pe_ratio != null && f.peg_ratio != null && f.peg_ratio > 0 && f.eps != null && f.eps > 0) {
    const growth = f.pe_ratio / f.peg_ratio;
    const pegFv = f.eps * Math.max(8, Math.min(40, growth));
    methods.push({
      name: "PEG-implied value",
      estimate: pegFv,
      note: `Implies ~${growth.toFixed(0)}% earnings growth from current PEG`,
    });
    if (earningsFv == null) earningsFv = pegFv;
  }

  // 3) Analyst consensus target
  if (f.analyst_target != null && f.analyst_target > 0) {
    methods.push({
      name: "Analyst target",
      estimate: f.analyst_target,
      note: "Mean Street target (Finnhub)",
    });
  }

  // 4) 52-week context midpoint (weak signal)
  if (f.fifty_two_week_high != null && f.fifty_two_week_low != null) {
    const mid = (f.fifty_two_week_high + f.fifty_two_week_low) / 2;
    methods.push({
      name: "52-week range midpoint",
      estimate: mid,
      note: "Contextual only — not a valuation model by itself",
    });
  }

  const estimates = methods
    .map((m) => m.estimate)
    .filter((v): v is number => v != null && v > 0);

  if (estimates.length === 0 || price == null) {
    return {
      current_price: price,
      fair_value_low: null,
      fair_value_mid: null,
      fair_value_high: null,
      upside_percent: null,
      valuation_label: "Insufficient data",
      methods,
      confidence: 20,
      disclaimer: "Not enough fundamentals yet for a fair-value band.",
    };
  }

  // Weight analyst + earnings higher
  let weighted = 0;
  let weightSum = 0;
  for (const m of methods) {
    if (m.estimate == null) continue;
    const w = m.name.includes("Analyst") ? 1.4 : m.name.includes("Earnings") ? 1.2 : 0.6;
    weighted += m.estimate * w;
    weightSum += w;
  }
  const mid = weighted / weightSum;
  const low = mid * 0.88;
  const high = mid * 1.12;
  const upside = ((mid - price) / price) * 100;

  const valuation_label =
    upside >= 15 ? "Undervalued" : upside <= -15 ? "Overvalued" : "About fair";

  return {
    current_price: price,
    fair_value_low: low,
    fair_value_mid: mid,
    fair_value_high: high,
    upside_percent: upside,
    valuation_label,
    methods,
    confidence: Math.min(85, 40 + estimates.length * 12),
    disclaimer:
      "Fair-value band blends earnings multiples and analyst targets (Simply Wall St–style relative valuation). Educational estimate — not a guarantee or recommendation.",
  };
}
