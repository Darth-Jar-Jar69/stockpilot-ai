/**
 * Correlate company headlines with significant daily price moves.
 *
 * For each session that moved more than the adaptive threshold, we look for Finnhub
 * company-news published from the prior evening through the next session. Matching
 * headlines become "catalysts" that back Buy / Sell / Hold narratives with real events.
 */

const YAHOO_UA = "Mozilla/5.0 (compatible; StockPilot/1.0)";

export type PriceCatalyst = {
  date: string;
  price_change_percent: number;
  close: number;
  direction: "up" | "down";
  headline: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  category: CatalystCategory;
  relevance: number;
  /** One-line causal claim used in the thesis. */
  attribution: string;
};

export type CatalystCategory =
  | "earnings"
  | "guidance"
  | "analyst"
  | "product"
  | "deal"
  | "legal"
  | "macro"
  | "management"
  | "other";

export type CatalystInsight = {
  catalysts: PriceCatalyst[];
  /** Actionable narrative tied to the latest catalysts + overall rating. */
  action_rationale: {
    rating: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
    headline: string;
    reasons: string[];
  };
  bull_from_news: string[];
  bear_from_news: string[];
  lookback_days: number;
  move_threshold_percent: number;
  news_count: number;
  moves_found: number;
  matched_moves: number;
};

type RawNews = {
  headline: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  datetime: number;
};

type Bar = { date: string; close: number; change_percent: number; ts: number };

const newsCache = new Map<string, { at: number; data: RawNews[] }>();
const NEWS_CACHE_MS = 5 * 60_000;

const CATEGORY_PATTERNS: { cat: CatalystCategory; re: RegExp; weight: number }[] = [
  { cat: "earnings", re: /\b(earnings|eps|revenue|beats?|misses?|profit|quarterly results|q[1-4]\s*results)\b/i, weight: 12 },
  { cat: "guidance", re: /\b(guidance|outlook|forecast|raises?|cuts?|lowers?|raises outlook|guidance cut)\b/i, weight: 11 },
  { cat: "analyst", re: /\b(upgrade|downgrade|price target|initiates?|overweight|underweight|outperform|underperform|buy rating|sell rating)\b/i, weight: 8 },
  { cat: "deal", re: /\b(acqui|merger|takeover|buyout|deal|partnership|investment|ipo)\b/i, weight: 9 },
  { cat: "product", re: /\b(launch|unveil|product|chip|model|device|software|ai |cloud|aws|azure|gpu)\b/i, weight: 6 },
  { cat: "legal", re: /\b(lawsuit|probe|investigation|antitrust|sec |ftc |fine|settlement|ban)\b/i, weight: 8 },
  { cat: "management", re: /\b(ceo|cfo|resign|appoint|executive|board)\b/i, weight: 7 },
  { cat: "macro", re: /\b(fed|inflation|tariff|recession|rate cut|rate hike|jobs report)\b/i, weight: 5 },
];

function classifyCategory(text: string): { cat: CatalystCategory; boost: number } {
  for (const p of CATEGORY_PATTERNS) {
    if (p.re.test(text)) return { cat: p.cat, boost: p.weight };
  }
  return { cat: "other", boost: 0 };
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchCompanyNewsRaw(symbol: string, days: number): Promise<RawNews[]> {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) return [];

  const cacheKey = `${symbol.toUpperCase()}:${days}`;
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < NEWS_CACHE_MS) return cached.data;

  // Finnhub caps company-news responses (~250). Mega-caps fill that in days, so
  // we pull overlapping windows so older catalyst dates still have headlines.
  const windowDays = 12;
  const windows: { from: string; to: string }[] = [];
  for (let endOffset = 0; endOffset < days; endOffset += windowDays - 1) {
    const to = new Date(Date.now() - endOffset * 86_400_000);
    const from = new Date(Date.now() - Math.min(days, endOffset + windowDays) * 86_400_000);
    windows.push({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  }

  // Sequential windows — parallel bursts trip Finnhub rate limits on mega-caps.
  const chunks: RawNews[][] = [];
  for (const { from, to } of windows) {
    const url = new URL("https://finnhub.io/api/v1/company-news");
    url.searchParams.set("symbol", symbol.toUpperCase());
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("token", token);
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        chunks.push([]);
        continue;
      }
      const json = (await res.json()) as Array<{
        headline?: string;
        summary?: string;
        source?: string;
        url?: string;
        datetime?: number;
      }>;
      chunks.push(
        (json ?? [])
          .filter((n) => n.headline && n.datetime)
          .map((n) => ({
            headline: n.headline!,
            summary: n.summary ?? null,
            source: n.source ?? null,
            url: n.url ?? null,
            published_at: new Date(n.datetime! * 1000).toISOString(),
            datetime: n.datetime!,
          })),
      );
    } catch {
      chunks.push([]);
    }
  }

  const seen = new Set<string>();
  const out: RawNews[] = [];
  for (const n of chunks.flat()) {
    const key = n.headline.toLowerCase().replace(/\W+/g, "").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  newsCache.set(cacheKey, { at: Date.now(), data: out });
  return out;
}

async function fetchDailyBars(symbol: string, range = "3mo"): Promise<Bar[]> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", range);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    next: { revalidate: 120 },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = closes[i];
    const prev = i > 0 ? closes[i - 1] : null;
    if (typeof close !== "number" || typeof prev !== "number" || prev === 0) continue;
    bars.push({
      date: dayKey(ts[i]! * 1000),
      close,
      change_percent: ((close - prev) / prev) * 100,
      ts: ts[i]!,
    });
  }
  return bars;
}

function scoreHeadlineForMove(
  news: RawNews,
  movePct: number,
  symbol: string,
  company: string,
): number {
  const text = `${news.headline} ${news.summary ?? ""}`;
  const headlineLower = news.headline.toLowerCase();
  const { boost } = classifyCategory(text);

  const ticker = symbol.toUpperCase();
  const companyWords = company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["inc", "corp", "ltd", "plc", "holdings", "group", "the"].includes(w));
  // Require the company/ticker in the HEADLINE — summaries of roundups name everyone and create false links.
  const mentions =
    headlineLower.includes(ticker.toLowerCase()) ||
    companyWords.some((w) => headlineLower.includes(w)) ||
    (ticker === "AMZN" && /\bamazon\b/i.test(news.headline)) ||
    (ticker === "GOOGL" && /\b(alphabet|google)\b/i.test(news.headline)) ||
    (ticker === "META" && /\b(meta|facebook)\b/i.test(news.headline)) ||
    (ticker === "BRK.B" && /\bberkshire\b/i.test(news.headline));

  if (!mentions) return -1;

  let score = 25 + boost;
  const bullish =
    /\b(surge|soar|rally|beat|beats|record|upgrade|growth|raises?|outperform|strong|jump|gain|trillion|hits?\s+high)\b/i.test(
      text,
    );
  const bearish =
    /\b(plunge|crash|fall|falls|drop|miss|misses|cut|downgrade|loss|lawsuit|probe|slump|weak|warning|layoff|slower)\b/i.test(
      text,
    );
  if (movePct > 0 && bullish) score += 12;
  if (movePct < 0 && bearish) score += 12;
  if (movePct > 0 && bearish) score -= 5;
  if (movePct < 0 && bullish) score -= 5;

  if (text.length < 140) score += 3;
  if (/\b(stock market today|wall street|s&p 500|these are the|etfs that hold)\b/i.test(text)) score -= 10;

  return score;
}

function attributionLine(c: PriceCatalyst, company: string): string {
  const move = `${c.price_change_percent >= 0 ? "+" : ""}${c.price_change_percent.toFixed(1)}%`;
  const verb =
    c.category === "earnings"
      ? c.direction === "up"
        ? "rallied"
        : "sold off"
      : c.direction === "up"
        ? "jumped"
        : "dropped";
  const why =
    c.category === "earnings"
      ? "after earnings"
      : c.category === "guidance"
        ? "on guidance"
        : c.category === "analyst"
          ? "after analyst action"
          : c.category === "deal"
            ? "on deal news"
            : c.category === "legal"
              ? "on legal/regulatory headlines"
              : c.category === "product"
                ? "on product/tech headlines"
                : c.category === "management"
                  ? "on management news"
                  : "as headlines hit";
  const short = c.headline.length > 110 ? `${c.headline.slice(0, 107)}…` : c.headline;
  return `${company} ${verb} ${move} on ${c.date} ${why}: “${short}”${c.source ? ` (${c.source})` : ""}.`;
}

function buildActionRationale(
  rating: CatalystInsight["action_rationale"]["rating"],
  catalysts: PriceCatalyst[],
  company: string,
): CatalystInsight["action_rationale"] {
  const ups = catalysts.filter((c) => c.direction === "up");
  const downs = catalysts.filter((c) => c.direction === "down");
  const latest = catalysts[0];
  const reasons: string[] = [];

  if (latest) {
    reasons.push(latest.attribution);
  }
  for (const c of ups.slice(0, 2)) {
    if (c !== latest) reasons.push(c.attribution);
  }
  for (const c of downs.slice(0, 2)) {
    if (c !== latest && !reasons.includes(c.attribution)) reasons.push(c.attribution);
  }

  // Rating-specific framing — still grounded in the matched events.
  let headline: string;
  if (rating === "Strong Buy" || rating === "Buy") {
    headline =
      ups.length >= downs.length
        ? `Buy case leans on news-backed rebounds — ${company} has printed ${ups.length} catalyst-driven up-session${ups.length === 1 ? "" : "s"} in the lookback.`
        : `Buy case needs the next catalyst to stick — recent tape has more downside news days (${downs.length}) than upside (${ups.length}).`;
    if (downs[0]) {
      reasons.push(
        `Risk to the buy: the ${downs[0].price_change_percent.toFixed(1)}% session on ${downs[0].date} shows how fast the story can reverse when headlines turn.`,
      );
    }
  } else if (rating === "Sell" || rating === "Strong Sell") {
    headline =
      downs.length > 0
        ? `Sell case is backed by news-driven drawdowns — ${company} dropped on catalysts like ${downs[0]!.category} coverage.`
        : `Sell case is valuation/momentum-led; few large news-driven dumps in the recent window.`;
    if (ups[0]) {
      reasons.push(
        `Counterpoint: ${company} still staged a ${ups[0].price_change_percent.toFixed(1)}% news-day rally on ${ups[0].date} — short-covering / relief moves can hurt a sell.`,
      );
    }
  } else {
    headline =
      catalysts.length > 0
        ? `Hold: wait for the next verified catalyst. Recent moves (${catalysts.length} matched) cut both ways for ${company}.`
        : `Hold: no large news-tied sessions in the lookback — size only after the next clear catalyst.`;
    if (latest) {
      reasons.push(
        `Most recent news-day was ${latest.direction === "up" ? "constructive" : "cautious"} (${latest.price_change_percent >= 0 ? "+" : ""}${latest.price_change_percent.toFixed(1)}% on ${latest.date}).`,
      );
    }
  }

  // Deduplicate while preserving order.
  const unique = [...new Set(reasons)].slice(0, 5);
  return { rating, headline, reasons: unique };
}

/**
 * Build price↔news catalysts for a symbol and fold them into a Buy/Sell/Hold rationale.
 */
export async function buildPriceCatalysts(
  symbol: string,
  options?: {
    companyName?: string | null;
    rating?: CatalystInsight["action_rationale"]["rating"];
    lookbackDays?: number;
    maxCatalysts?: number;
  },
): Promise<CatalystInsight> {
  const lookback = options?.lookbackDays ?? 90;
  const maxCatalysts = options?.maxCatalysts ?? 6;
  const company = options?.companyName?.trim() || symbol.toUpperCase();
  const rating = options?.rating ?? "Hold";

  const [news, bars] = await Promise.all([
    fetchCompanyNewsRaw(symbol, lookback + 5),
    fetchDailyBars(symbol, lookback <= 45 ? "3mo" : "6mo"),
  ]);

  // Adaptive threshold: at least 2.5%, or ~1.5× median absolute daily move.
  const absMoves = bars.map((b) => Math.abs(b.change_percent)).sort((a, b) => a - b);
  const median = absMoves.length ? absMoves[Math.floor(absMoves.length / 2)]! : 1.5;
  const threshold = Math.max(2.5, Math.min(5.5, median * 1.6));

  const bigMoves = bars
    .filter((b) => Math.abs(b.change_percent) >= threshold)
    .sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));

  const catalysts: PriceCatalyst[] = [];
  const usedHeadlines = new Set<string>();

  for (const move of bigMoves) {
    if (catalysts.length >= maxCatalysts) break;
    // After-hours earnings often print the evening before the big next-day session.
    // Window: 2 calendar days before open → end of next session.
    const sessionStart = move.ts - 48 * 3600;
    const sessionEnd = move.ts + 36 * 3600;
    const minScore = Math.abs(move.change_percent) >= 5 ? 12 : 18;
    const candidates = news
      .filter((n) => n.datetime >= sessionStart && n.datetime <= sessionEnd)
      .map((n) => ({ n, score: scoreHeadlineForMove(n, move.change_percent, symbol, company) }))
      .filter((x) => x.score >= minScore)
      .sort((a, b) => b.score - a.score);

    const best = candidates.find((c) => !usedHeadlines.has(c.n.headline.toLowerCase()));
    if (!best) continue;
    usedHeadlines.add(best.n.headline.toLowerCase());

    const { cat } = classifyCategory(`${best.n.headline} ${best.n.summary ?? ""}`);
    const direction: "up" | "down" = move.change_percent >= 0 ? "up" : "down";
    const catalyst: PriceCatalyst = {
      date: move.date,
      price_change_percent: Number(move.change_percent.toFixed(2)),
      close: Number(move.close.toFixed(2)),
      direction,
      headline: best.n.headline,
      summary: best.n.summary,
      source: best.n.source,
      url: best.n.url,
      published_at: best.n.published_at,
      category: cat,
      relevance: best.score,
      attribution: "",
    };
    catalyst.attribution = attributionLine(catalyst, company);
    catalysts.push(catalyst);
  }

  // Chronological for display (newest first), but we already limited by size.
  catalysts.sort((a, b) => b.date.localeCompare(a.date));

  const bull_from_news = catalysts
    .filter((c) => c.direction === "up")
    .slice(0, 3)
    .map((c) => c.attribution);
  const bear_from_news = catalysts
    .filter((c) => c.direction === "down")
    .slice(0, 3)
    .map((c) => c.attribution);

  return {
    catalysts,
    action_rationale: buildActionRationale(rating, catalysts, company),
    bull_from_news,
    bear_from_news,
    lookback_days: lookback,
    move_threshold_percent: Number(threshold.toFixed(2)),
    news_count: news.length,
    moves_found: bigMoves.length,
    matched_moves: catalysts.length,
  };
}
