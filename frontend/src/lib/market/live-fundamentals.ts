/**
 * Live fundamentals via Finnhub (preferred) with Yahoo chart/search support.
 *
 * Unit conventions (normalized here so consumers never guess):
 *  - Ratios such as margins, ROE, ROA, growth rates, dividend yield are FRACTIONS (0.12 = 12%).
 *  - Price returns are PERCENT (12.0 = 12%).
 *  - debt_to_equity is a plain ratio (0.48 = debt is 48% of equity).
 *  - market_cap / enterprise_value are absolute currency values (Finnhub reports millions).
 *
 * Finnhub `stock/metric` percent-type fields (roeTTM, netProfitMarginTTM, revenueGrowthTTMYoy, …)
 * are always expressed in percent by the API, so they are divided by 100 unconditionally.
 */

const YAHOO_UA = "Mozilla/5.0 (compatible; StockPilot/1.0)";

export type PeriodReturns = {
  one_week: number | null;
  one_month: number | null;
  three_month: number | null;
  six_month: number | null;
  ytd: number | null;
  one_year: number | null;
};

export type LiveFundamentals = {
  symbol: string;
  company_name: string | null;
  currency: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  logo: string | null;

  // Trading information
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  day_high: number | null;
  day_low: number | null;
  open: number | null;
  volume: number | null;
  avg_volume_30d: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  fifty_two_week_high_date: string | null;
  fifty_two_week_low_date: string | null;
  market_cap: number | null;
  enterprise_value: number | null;
  shares_outstanding: number | null;
  beta: number | null;

  // Valuation
  pe_ratio: number | null; // GAAP trailing twelve months
  pe_normalized: number | null; // Finnhub "normalized annual" (latest fiscal year, excl. extraordinary items)
  forward_pe: number | null;
  peg_ratio: number | null;
  ps_ratio: number | null;
  pb_ratio: number | null;
  pcf_ratio: number | null;
  ev_to_ebitda: number | null;
  dividend_yield: number | null;

  // Per-share
  eps: number | null; // GAAP TTM
  eps_normalized: number | null; // latest fiscal year, normalized
  eps_forward: number | null; // derived: price / forward P/E
  revenue_per_share: number | null;
  cash_flow_per_share: number | null;
  free_cash_flow_per_share: number | null;
  book_value_per_share: number | null;

  // Profitability (fractions)
  gross_margin: number | null;
  operating_margin: number | null;
  profit_margin: number | null;
  return_on_equity: number | null;
  return_on_assets: number | null;

  // Growth (fractions)
  revenue_growth: number | null; // TTM YoY
  revenue_growth_3y: number | null; // 3-year CAGR
  eps_growth: number | null; // TTM YoY
  eps_growth_3y: number | null;
  eps_growth_forward: number | null; // derived: forward EPS vs GAAP TTM EPS

  // Financial strength
  current_ratio: number | null;
  quick_ratio: number | null;
  debt_to_equity: number | null;
  interest_coverage: number | null;

  // Price performance (percent)
  returns: PeriodReturns;

  analyst_target: number | null;
  /** True when trailing GAAP earnings look depressed by one-offs / acquisition accounting. */
  gaap_distorted: boolean;
  data_notes: string[];
  provider: string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Finnhub percent field → fraction. */
function pct(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : n / 100;
}

function first(...vals: (number | null)[]): number | null {
  for (const v of vals) if (v != null) return v;
  return null;
}

async function finnhubGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) return null;
  const url = new URL(`https://finnhub.io/api/v1${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", token);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type YahooChartMeta = {
  currency?: string;
  symbol?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  regularMarketPrice?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
};

export type YahooChart = {
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
};

export async function fetchYahooChartMeta(symbol: string, range = "1y"): Promise<YahooChart> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", range);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);
  const json = (await res.json()) as { chart?: { result?: YahooChart[] } };
  const result = json.chart?.result?.[0];
  if (!result?.meta) throw new Error("Yahoo chart empty");
  return result;
}

export async function fetchYahooSearchHit(query: string) {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "8");
  url.searchParams.set("newsCount", "0");
  try {
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
        exchange?: string;
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
  } catch {
    return null;
  }
}

function seriesFrom(chart: YahooChart) {
  const q = chart.indicators?.quote?.[0];
  const pick = (arr?: Array<number | null>) =>
    (arr ?? []).filter((v): v is number => typeof v === "number");
  return {
    closes: pick(q?.close),
    highs: pick(q?.high),
    lows: pick(q?.low),
    opens: pick(q?.open),
    volumes: pick(q?.volume),
    timestamps: chart.timestamp ?? [],
  };
}

/** Prior close derived from bars — Yahoo's meta.chartPreviousClose is the close before the *range*. */
function previousCloseFromBars(closes: number[], price: number | null, chart: YahooChart): number | null {
  if (price == null) return null;
  if (closes.length >= 2) {
    const last = closes.at(-1)!;
    return Math.abs(last - price) / price < 0.03 ? closes.at(-2)! : last;
  }
  if (closes.length === 1) {
    const last = closes[0]!;
    return Math.abs(last - price) / price >= 0.03 ? last : chart.meta?.chartPreviousClose ?? null;
  }
  return chart.meta?.chartPreviousClose ?? null;
}

function returnOver(closes: number[], barsBack: number): number | null {
  const last = closes.at(-1);
  if (last == null || closes.length <= barsBack) return null;
  const base = closes[closes.length - 1 - barsBack];
  return base && base !== 0 ? ((last - base) / base) * 100 : null;
}

function ytdReturn(closes: number[], timestamps: number[]): number | null {
  if (closes.length === 0 || timestamps.length !== closes.length) return null;
  const year = new Date().getUTCFullYear();
  let idx = -1;
  for (let i = 0; i < timestamps.length; i++) {
    if (new Date(timestamps[i]! * 1000).getUTCFullYear() === year) {
      idx = i;
      break;
    }
  }
  if (idx <= 0) return null;
  const base = closes[idx - 1]!; // last close of the prior year
  const last = closes.at(-1)!;
  return base > 0 ? ((last - base) / base) * 100 : null;
}

/** Aggregate live fundamentals for research / scoring. */
export async function fetchLiveFundamentals(symbol: string): Promise<LiveFundamentals> {
  const sym = symbol.toUpperCase();
  const notes: string[] = [];

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
  const { closes, highs, lows, opens, volumes, timestamps } = seriesFrom(chart);

  // ---- Trading information -------------------------------------------------
  const price = first(num(quote?.c), meta.regularMarketPrice ?? null, closes.at(-1) ?? null);
  const previous = first(num(quote?.pc), previousCloseFromBars(closes, price, chart));
  const change = price != null && previous != null ? price - previous : num(quote?.d);
  const changePercent =
    price != null && previous != null && previous !== 0 ? ((price - previous) / previous) * 100 : num(quote?.dp);

  const m = metrics?.metric ?? {};
  const hasFinnhub = Boolean(metrics?.metric);
  if (!hasFinnhub) notes.push("Fundamental ratios unavailable from Finnhub for this symbol — showing price-derived data only.");

  const marketCapMillions = first(num(profile?.marketCapitalization), num(m.marketCapitalization));
  const marketCap = marketCapMillions != null ? marketCapMillions * 1_000_000 : null;
  const evMillions = num(m.enterpriseValue);
  const sharesOutMillions = num(profile?.shareOutstanding);

  // 52-week range: Finnhub first (true intraday high/low), else compute from 1y bars.
  // Yahoo's meta.fiftyTwoWeekHigh has proven stale — never used.
  const yearHigh = first(num(m["52WeekHigh"]), highs.length ? Math.max(...highs) : null, closes.length ? Math.max(...closes) : null);
  const yearLow = first(num(m["52WeekLow"]), lows.length ? Math.min(...lows) : null, closes.length ? Math.min(...closes) : null);

  // ---- Valuation -----------------------------------------------------------
  const peTtm = first(num(m.peBasicExclExtraTTM), num(m.peTTM));
  const peNormalized = first(num(m.peNormalizedAnnual), num(m.peAnnual));
  const forwardPe = num(m.forwardPE);
  const epsTtm = first(num(m.epsBasicExclExtraItemsTTM), num(m.epsTTM));
  const epsNormalized = first(num(m.epsNormalizedAnnual), num(m.epsAnnual));
  const epsForward = price != null && forwardPe != null && forwardPe > 0 ? price / forwardPe : null;

  // ---- Growth --------------------------------------------------------------
  const revenueGrowth = pct(m.revenueGrowthTTMYoy) ?? pct(m.revenueGrowthQuarterlyYoy);
  const revenueGrowth3y = pct(m.revenueGrowth3Y);
  const epsGrowth = pct(m.epsGrowthTTMYoy);
  const epsGrowth3y = pct(m.epsGrowth3Y);
  const epsGrowthForward =
    epsForward != null && epsTtm != null && epsTtm > 0 ? epsForward / epsTtm - 1 : null;

  // GAAP distortion: revenue up strongly while GAAP EPS collapses, or Street forward EPS far above TTM.
  const gaapDistorted =
    (epsGrowth != null && epsGrowth < -0.3 && revenueGrowth != null && revenueGrowth > 0.05) ||
    (epsGrowthForward != null && epsGrowthForward > 0.6 && (epsTtm ?? 0) > 0);
  if (gaapDistorted) {
    notes.push(
      "Trailing GAAP earnings look depressed versus revenue and Street forward estimates (acquisition accounting, amortization or one-off charges). Trailing P/E is de-emphasized; forward P/E and normalized EPS carry more weight.",
    );
  }

  // ---- Financial strength --------------------------------------------------
  // Finnhub's totalDebt/totalEquity is a plain ratio; the *Annual/Quarterly variants are often empty.
  const debtToEquity = first(
    num(m["totalDebt/totalEquityQuarterly"]),
    num(m["totalDebt/totalEquityAnnual"]),
    num(m.totalDebtToEquityQuarterly),
    num(m.totalDebtToEquityAnnual),
    num(m["longTermDebt/equityQuarterly"]),
    num(m["longTermDebt/equityAnnual"]),
  );

  const companyName =
    (typeof profile?.name === "string" && profile.name) || search?.longname || search?.shortname || null;

  const returns: PeriodReturns = {
    one_week: first(num(m["5DayPriceReturnDaily"]), returnOver(closes, 5)),
    one_month: returnOver(closes, 21),
    three_month: first(num(m["13WeekPriceReturnDaily"]), returnOver(closes, 63)),
    six_month: first(num(m["26WeekPriceReturnDaily"]), returnOver(closes, 126)),
    ytd: first(num(m.yearToDatePriceReturnDaily), ytdReturn(closes, timestamps)),
    one_year: first(num(m["52WeekPriceReturnDaily"]), closes.length >= 240 ? returnOver(closes, closes.length - 1) : null),
  };

  const avgVolume30 =
    volumes.length >= 5 ? volumes.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, volumes.length) : null;
  const avgVolume10dFinnhub = num(m["10DayAverageTradingVolume"]); // Finnhub: millions
  const avgVolume = first(avgVolume10dFinnhub != null ? avgVolume10dFinnhub * 1_000_000 : null, avgVolume30);

  return {
    symbol: sym,
    company_name: companyName,
    currency: (typeof profile?.currency === "string" && profile.currency) || meta.currency || "USD",
    exchange:
      (typeof profile?.exchange === "string" && profile.exchange) || meta.fullExchangeName || meta.exchangeName || null,
    sector: (typeof profile?.finnhubIndustry === "string" && profile.finnhubIndustry) || search?.sector || null,
    industry: search?.industry ?? null,
    description: null,
    logo: typeof profile?.logo === "string" ? profile.logo : null,

    price,
    previous_close: previous,
    change,
    change_percent: changePercent,
    day_high: first(num(quote?.h), meta.regularMarketDayHigh ?? null, highs.at(-1) ?? null),
    day_low: first(num(quote?.l), meta.regularMarketDayLow ?? null, lows.at(-1) ?? null),
    open: first(num(quote?.o), opens.at(-1) ?? null),
    volume: first(meta.regularMarketVolume ?? null, volumes.at(-1) ?? null),
    avg_volume_30d: avgVolume,
    fifty_two_week_high: yearHigh,
    fifty_two_week_low: yearLow,
    fifty_two_week_high_date: typeof m["52WeekHighDate"] === "string" ? m["52WeekHighDate"] : null,
    fifty_two_week_low_date: typeof m["52WeekLowDate"] === "string" ? m["52WeekLowDate"] : null,
    market_cap: marketCap,
    enterprise_value: evMillions != null ? evMillions * 1_000_000 : null,
    shares_outstanding: sharesOutMillions != null ? sharesOutMillions * 1_000_000 : null,
    beta: num(m.beta),

    pe_ratio: peTtm,
    pe_normalized: peNormalized,
    forward_pe: forwardPe,
    peg_ratio: first(num(m.pegTTM), num(m.pegRatio)),
    ps_ratio: first(num(m.psTTM), num(m.psAnnual)),
    pb_ratio: first(num(m.pbQuarterly), num(m.pbAnnual)),
    pcf_ratio: first(num(m.pcfShareTTM), num(m.pcfShareAnnual)),
    ev_to_ebitda: null, // not exposed on Finnhub's free metric set
    dividend_yield: pct(m.dividendYieldIndicatedAnnual) ?? pct(m.currentDividendYieldTTM),

    eps: epsTtm,
    eps_normalized: epsNormalized,
    eps_forward: epsForward,
    revenue_per_share: first(num(m.revenuePerShareTTM), num(m.revenuePerShareAnnual)),
    cash_flow_per_share: first(num(m.cashFlowPerShareTTM), num(m.cashFlowPerShareAnnual)),
    free_cash_flow_per_share: first(num(m.freeCashFlowPerShareTTM), num(m.freeCashFlowPerShareAnnual)),
    book_value_per_share: first(num(m.bookValuePerShareQuarterly), num(m.bookValuePerShareAnnual)),

    gross_margin: pct(m.grossMarginTTM) ?? pct(m.grossMarginAnnual),
    operating_margin: pct(m.operatingMarginTTM) ?? pct(m.operatingMarginAnnual),
    profit_margin: pct(m.netProfitMarginTTM) ?? pct(m.netProfitMarginAnnual),
    return_on_equity: pct(m.roeTTM) ?? pct(m.roeRfy),
    return_on_assets: pct(m.roaTTM) ?? pct(m.roaRfy),

    revenue_growth: revenueGrowth,
    revenue_growth_3y: revenueGrowth3y,
    eps_growth: epsGrowth,
    eps_growth_3y: epsGrowth3y,
    eps_growth_forward: epsGrowthForward,

    current_ratio: first(num(m.currentRatioQuarterly), num(m.currentRatioAnnual)),
    quick_ratio: first(num(m.quickRatioQuarterly), num(m.quickRatioAnnual)),
    debt_to_equity: debtToEquity,
    interest_coverage: first(num(m.netInterestCoverageTTM), num(m.netInterestCoverageAnnual)),

    returns,
    analyst_target: first(num(target?.targetMean), num(target?.targetMedian)),
    gaap_distorted: gaapDistorted,
    data_notes: notes,
    provider: hasFinnhub ? "finnhub+yahoo" : "yahoo_finance",
  };
}

// ---------------------------------------------------------------------------
// Fair value engine
// ---------------------------------------------------------------------------

export type FairValueMethod = {
  name: string;
  estimate: number | null;
  weight: number;
  note: string | null;
};

export type FairValueResult = {
  current_price: number | null;
  fair_value_low: number | null;
  fair_value_mid: number | null;
  fair_value_high: number | null;
  upside_percent: number | null;
  valuation_label: "Undervalued" | "About fair" | "Overvalued" | "Insufficient data";
  methods: FairValueMethod[];
  assumptions: { growth_rate: number | null; fair_pe: number | null; discount_rate: number; terminal_pe: number | null };
  confidence: number;
  disclaimer: string;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Growth assumption for valuation: favors multi-year CAGRs over noisy TTM prints
 * (acquisitions inflate TTM revenue and crush TTM GAAP EPS at the same time).
 * Returns a fraction, clamped to a sane 0–30% band.
 */
export function growthAssumption(f: LiveFundamentals): number | null {
  const parts: { v: number; w: number }[] = [];
  if (f.revenue_growth_3y != null) parts.push({ v: f.revenue_growth_3y, w: 1.2 });
  if (f.eps_growth_3y != null) parts.push({ v: f.eps_growth_3y, w: 1.0 });
  // TTM revenue growth includes acquired revenue when GAAP is distorted → heavily de-weighted.
  if (f.revenue_growth != null) parts.push({ v: f.revenue_growth, w: f.gaap_distorted ? 0.2 : 0.8 });
  if (f.eps_growth != null && !f.gaap_distorted) parts.push({ v: f.eps_growth, w: 0.5 });
  if (f.eps_growth_forward != null && !f.gaap_distorted) parts.push({ v: f.eps_growth_forward, w: 0.6 });
  if (parts.length === 0) return null;
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  const g = parts.reduce((a, p) => a + p.v * p.w, 0) / wsum;
  return clamp(g, 0, 0.3);
}

/**
 * Multi-method relative valuation (Morningstar / Simply Wall St flavored):
 *  1. Forward earnings × growth-and-quality-adjusted fair P/E (Street EPS — least distorted input)
 *  2. 5-year discounted earnings with a terminal multiple (DCF-lite)
 *  3. Normalized trailing EPS × fair P/E
 *  4. Operating cash flow per share × fair P/CF
 *  5. Analyst mean target (when the data plan exposes it)
 * Trailing GAAP-based methods are down-weighted when `gaap_distorted` is true.
 */
export function estimateFairValue(f: LiveFundamentals): FairValueResult {
  const price = f.price;
  const methods: FairValueMethod[] = [];
  const g = growthAssumption(f);
  const gPct = g != null ? g * 100 : null;
  const discountRate = 0.09;

  // Quality premium on the multiple: high gross / operating margins deserve a richer P/E.
  let qualityBump = 0;
  if (f.gross_margin != null && f.gross_margin > 0.6) qualityBump += 3;
  if (f.operating_margin != null && f.operating_margin > 0.25) qualityBump += 2;
  if (f.return_on_equity != null && f.return_on_equity > 0.2) qualityBump += 1;

  const fairPe = gPct != null ? clamp(14 + gPct * 0.9 + qualityBump, 12, 38) : null;
  const terminalPe = fairPe != null ? clamp(fairPe * 0.75, 12, 28) : null;
  const trailingWeight = f.gaap_distorted ? 0.25 : 0.7;

  // 1) Forward earnings
  if (f.eps_forward != null && f.eps_forward > 0 && fairPe != null) {
    methods.push({
      name: "Forward earnings multiple",
      estimate: f.eps_forward * fairPe,
      weight: 1.5,
      note: `Street forward EPS ${f.eps_forward.toFixed(2)} × fair P/E ${fairPe.toFixed(1)} (growth ${gPct!.toFixed(0)}%${qualityBump ? ` + quality premium` : ""})`,
    });
  }

  // 2) Discounted earnings (5-yr)
  const baseEps = f.eps_forward != null && f.eps_forward > 0 ? f.eps_forward : f.eps_normalized;
  if (baseEps != null && baseEps > 0 && g != null && terminalPe != null) {
    let pv = 0;
    let eps = baseEps;
    for (let year = 1; year <= 5; year++) {
      if (year > 1) eps *= 1 + g * (year <= 3 ? 1 : 0.7); // growth fades after year 3
      pv += eps / (1 + discountRate) ** year;
    }
    pv += (eps * terminalPe) / (1 + discountRate) ** 5;
    methods.push({
      name: "Discounted earnings (5-yr)",
      estimate: pv,
      weight: f.eps_forward != null ? 1.0 : trailingWeight,
      note: `EPS ${baseEps.toFixed(2)} grown ${gPct!.toFixed(0)}% (fading), ${(discountRate * 100).toFixed(0)}% discount rate, exit P/E ${terminalPe.toFixed(0)}`,
    });
  }

  // 3) Normalized trailing earnings
  if (f.eps_normalized != null && f.eps_normalized > 0 && fairPe != null) {
    methods.push({
      name: "Normalized trailing earnings",
      estimate: f.eps_normalized * fairPe,
      weight: trailingWeight,
      note: `Latest fiscal-year normalized EPS ${f.eps_normalized.toFixed(2)} × fair P/E ${fairPe.toFixed(1)}${f.gaap_distorted ? " · de-weighted (GAAP distortion)" : ""}`,
    });
  }

  // 4) Cash flow multiple
  if (f.cash_flow_per_share != null && f.cash_flow_per_share > 0 && gPct != null) {
    const fairPcf = clamp(12 + gPct * 0.7 + qualityBump * 0.5, 9, 30);
    methods.push({
      name: "Cash flow multiple",
      estimate: f.cash_flow_per_share * fairPcf,
      weight: trailingWeight * 0.8,
      note: `Operating cash flow/share ${f.cash_flow_per_share.toFixed(2)} × fair P/CF ${fairPcf.toFixed(1)}${f.gaap_distorted ? " · de-weighted" : ""}`,
    });
  }

  // 5) Analyst target
  if (f.analyst_target != null && f.analyst_target > 0) {
    methods.push({
      name: "Analyst consensus target",
      estimate: f.analyst_target,
      weight: 1.5,
      note: "Mean 12-month Street price target",
    });
  }

  const usable = methods.filter((m) => m.estimate != null && m.estimate > 0);
  if (usable.length === 0 || price == null) {
    return {
      current_price: price,
      fair_value_low: null,
      fair_value_mid: null,
      fair_value_high: null,
      upside_percent: null,
      valuation_label: "Insufficient data",
      methods,
      assumptions: { growth_rate: g, fair_pe: fairPe, discount_rate: discountRate, terminal_pe: terminalPe },
      confidence: 20,
      disclaimer: "Not enough earnings or cash-flow data to build a fair-value band for this security.",
    };
  }

  const wsum = usable.reduce((a, m) => a + m.weight, 0);
  const mid = usable.reduce((a, m) => a + m.estimate! * m.weight, 0) / wsum;

  // Band width scales with dispersion between methods (more disagreement → wider band).
  const spread =
    usable.length > 1
      ? Math.sqrt(usable.reduce((a, m) => a + m.weight * (m.estimate! / mid - 1) ** 2, 0) / wsum)
      : 0.15;
  const band = clamp(0.08 + spread * 0.4, 0.08, 0.22);
  const low = mid * (1 - band);
  const high = mid * (1 + band);
  const upside = ((mid - price) / price) * 100;

  // Label threshold scales with model uncertainty (Morningstar-style star bands):
  // tight agreement → ±12% is enough; wide disagreement → need a bigger gap to call it.
  const threshold = Math.max(12, band * 100 * 0.7);
  const valuation_label =
    upside >= threshold ? "Undervalued" : upside <= -threshold ? "Overvalued" : "About fair";

  const confidence = clamp(
    35 + usable.length * 10 + (f.eps_forward != null ? 10 : 0) + (f.analyst_target != null ? 10 : 0) - spread * 60,
    20,
    85,
  );

  return {
    current_price: price,
    fair_value_low: low,
    fair_value_mid: mid,
    fair_value_high: high,
    upside_percent: upside,
    valuation_label,
    methods,
    assumptions: { growth_rate: g, fair_pe: fairPe, discount_rate: discountRate, terminal_pe: terminalPe },
    confidence: Math.round(confidence),
    disclaimer:
      "Weighted blend of forward-earnings, discounted-earnings, normalized-earnings and cash-flow multiples on live Finnhub fundamentals. Fair value is an estimate with a stated uncertainty band — not a target price or recommendation.",
  };
}
