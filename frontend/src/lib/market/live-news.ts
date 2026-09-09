/** Live market news aggregator — Finnhub general + Yahoo multi-desk search. */

import { companyNameFor, extractTickersFromText } from "@/lib/news-tickers";
import { yahooQuoteFallback } from "@/lib/market/yahoo-fallback";

export type NewsSentiment = "bullish" | "bearish" | "neutral";
export type NewsDesk =
  | "markets"
  | "tech"
  | "macro"
  | "earnings"
  | "energy"
  | "deals"
  | "general";

export type EnrichedNewsArticle = {
  id: string;
  title: string;
  source: string | null;
  url: string | null;
  published_at: string | null;
  summary: string | null;
  image_url: string | null;
  symbols: string[];
  related_stocks: {
    symbol: string;
    company_name: string | null;
    price: number | null;
    change_percent: number | null;
  }[];
  sentiment: NewsSentiment;
  desk: NewsDesk;
  importance: number;
  why_it_matters: string;
  provider: string;
};

const YAHOO_UA = "Mozilla/5.0 (compatible; StockPilot/1.0)";

const DESK_QUERIES: { desk: NewsDesk; q: string }[] = [
  { desk: "markets", q: "stock market" },
  { desk: "tech", q: "technology stocks nvidia apple" },
  { desk: "macro", q: "federal reserve inflation rates" },
  { desk: "earnings", q: "earnings results guidance" },
  { desk: "energy", q: "oil energy stocks" },
  { desk: "deals", q: "merger acquisition IPO" },
];

const BULLISH = [
  "surge",
  "soar",
  "rally",
  "beat",
  "beats",
  "record",
  "upgrade",
  "growth",
  "profit",
  "gains",
  "jump",
  "rises",
  "bull",
  "outperform",
  "strong",
];
const BEARISH = [
  "plunge",
  "crash",
  "fall",
  "falls",
  "drop",
  "miss",
  "misses",
  "cut",
  "downgrade",
  "loss",
  "lawsuit",
  "probe",
  "recession",
  "layoff",
  "slump",
  "weak",
  "bear",
];

function classifySentiment(text: string): NewsSentiment {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of BULLISH) if (lower.includes(w)) score += 1;
  for (const w of BEARISH) if (lower.includes(w)) score -= 1;
  if (score >= 2) return "bullish";
  if (score <= -2) return "bearish";
  return "neutral";
}

function classifyDesk(text: string, fallback: NewsDesk = "general"): NewsDesk {
  const lower = text.toLowerCase();
  if (/earning|guidance|eps|revenue|quarter/.test(lower)) return "earnings";
  if (/fed|inflation|rate|treasury|cpi|jobs|gdp|macro/.test(lower)) return "macro";
  if (/oil|energy|gas|opec|crude/.test(lower)) return "energy";
  if (/merge|acqui|deal|ipo|buyout|takeover/.test(lower)) return "deals";
  if (/tech|ai|chip|semiconductor|software|cloud|nvidia|apple|microsoft/.test(lower))
    return "tech";
  if (/stock|market|s&p|nasdaq|dow|equity/.test(lower)) return "markets";
  return fallback;
}

function importanceScore(input: {
  title: string;
  published_at: string | null;
  symbols: string[];
  source: string | null;
  hasImage: boolean;
}): number {
  let score = 40;
  const ageH = input.published_at
    ? (Date.now() - new Date(input.published_at).getTime()) / 3_600_000
    : 48;
  if (ageH < 2) score += 25;
  else if (ageH < 6) score += 18;
  else if (ageH < 24) score += 10;
  else if (ageH > 72) score -= 15;

  score += Math.min(20, input.symbols.length * 6);
  if (input.hasImage) score += 6;

  const src = (input.source ?? "").toLowerCase();
  if (/reuters|bloomberg|wsj|financial times|cnbc|ap /.test(src)) score += 12;
  if (/zacks|motley|seeking alpha/.test(src)) score += 4;

  const title = input.title.toLowerCase();
  if (/breaking|exclusive|fed|earnings|crash|rally|war|rate/.test(title)) score += 10;

  return Math.max(0, Math.min(100, score));
}

function whyItMatters(
  title: string,
  symbols: string[],
  sentiment: NewsSentiment,
  desk: NewsDesk,
): string {
  const tickers = symbols.slice(0, 3).join(", ");
  const tone =
    sentiment === "bullish"
      ? "reads constructive for near-term risk appetite"
      : sentiment === "bearish"
        ? "leans cautious for risk assets"
        : "is mixed for risk assets";

  if (tickers) {
    return `StockPilot desk: this ${desk} story ${tone}, with direct read-through to ${tickers}. Cross-check live quotes and levels before acting.`;
  }
  if (desk === "macro") {
    return `Macro tape ${tone}. Watch index futures, rates, and high-beta growth for second-order moves.`;
  }
  return `Market desk note: ${tone}. Scan related sectors and confirm with price action.`;
}

async function fetchYahooDesk(
  desk: NewsDesk,
  q: string,
  count: number,
): Promise<EnrichedNewsArticle[]> {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", q);
  url.searchParams.set("quotesCount", "0");
  url.searchParams.set("newsCount", String(count));

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    next: { revalidate: 90 },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    news?: Array<{
      uuid?: string;
      title?: string;
      publisher?: string;
      link?: string;
      providerPublishTime?: number;
      summary?: string;
      thumbnail?: { resolutions?: Array<{ url?: string }> };
      relatedTickers?: string[];
    }>;
  };

  return (json.news ?? []).map((item, idx) => {
    const title = item.title ?? "Untitled";
    const summary = item.summary ?? null;
    const text = `${title} ${summary ?? ""}`;
    const related = (item.relatedTickers ?? []).map((s) => s.toUpperCase());
    const detected = extractTickersFromText(text);
    const symbols = [...new Set([...related, ...detected])].slice(0, 6);
    const sentiment = classifySentiment(text);
    const resolvedDesk = classifyDesk(text, desk);
    const published_at =
      item.providerPublishTime != null
        ? new Date(item.providerPublishTime * 1000).toISOString()
        : null;
    const image =
      item.thumbnail?.resolutions?.sort((a, b) => (b.url?.length ?? 0) - (a.url?.length ?? 0))[0]
        ?.url ?? null;

    return {
      id: item.uuid ?? `yahoo-${desk}-${idx}-${title.slice(0, 24)}`,
      title,
      source: item.publisher ?? "Yahoo Finance",
      url: item.link ?? null,
      published_at,
      summary,
      image_url: image,
      symbols,
      related_stocks: symbols.map((symbol) => ({
        symbol,
        company_name: companyNameFor(symbol),
        price: null,
        change_percent: null,
      })),
      sentiment,
      desk: resolvedDesk,
      importance: importanceScore({
        title,
        published_at,
        symbols,
        source: item.publisher ?? null,
        hasImage: Boolean(image),
      }),
      why_it_matters: whyItMatters(title, symbols, sentiment, resolvedDesk),
      provider: "yahoo",
    };
  });
}

async function fetchFinnhubGeneral(limit: number): Promise<EnrichedNewsArticle[]> {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) return [];

  const url = new URL("https://finnhub.io/api/v1/news");
  url.searchParams.set("category", "general");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 90 },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as Array<{
    id?: number;
    headline?: string;
    summary?: string;
    source?: string;
    url?: string;
    image?: string;
    datetime?: number;
    related?: string;
    category?: string;
  }>;

  return (json ?? []).slice(0, limit).map((item, idx) => {
    const title = item.headline ?? "Untitled";
    const summary = item.summary ?? null;
    const text = `${title} ${summary ?? ""}`;
    const related = (item.related ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const detected = extractTickersFromText(text);
    const symbols = [...new Set([...related, ...detected])].slice(0, 6);
    const sentiment = classifySentiment(text);
    const desk = classifyDesk(text, "markets");
    const published_at =
      item.datetime != null ? new Date(item.datetime * 1000).toISOString() : null;

    return {
      id: `finnhub-${item.id ?? idx}`,
      title,
      source: item.source ?? "Finnhub",
      url: item.url ?? null,
      published_at,
      summary,
      image_url: item.image || null,
      symbols,
      related_stocks: symbols.map((symbol) => ({
        symbol,
        company_name: companyNameFor(symbol),
        price: null,
        change_percent: null,
      })),
      sentiment,
      desk,
      importance: importanceScore({
        title,
        published_at,
        symbols,
        source: item.source ?? null,
        hasImage: Boolean(item.image),
      }) + 8,
      why_it_matters: whyItMatters(title, symbols, sentiment, desk),
      provider: "finnhub",
    };
  });
}

async function enrichQuotes(articles: EnrichedNewsArticle[]): Promise<EnrichedNewsArticle[]> {
  const symbols = [
    ...new Set(articles.flatMap((a) => a.symbols.map((s) => s.toUpperCase()))),
  ].slice(0, 24);

  type QuoteSnap = { price: number | null; change_percent: number | null };
  const quotes = new Map<string, QuoteSnap>();
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const q = await yahooQuoteFallback(symbol);
        quotes.set(symbol, { price: q.price, change_percent: q.change_percent });
      } catch {
        quotes.set(symbol, { price: null, change_percent: null });
      }
    }),
  );

  return articles.map((a) => ({
    ...a,
    related_stocks: a.symbols.slice(0, 5).map((symbol) => {
      const q = quotes.get(symbol) ?? { price: null, change_percent: null };
      return {
        symbol,
        company_name: companyNameFor(symbol),
        price: q.price,
        change_percent: q.change_percent,
      };
    }),
  }));
}

function dedupe(articles: EnrichedNewsArticle[]): EnrichedNewsArticle[] {
  const seen = new Set<string>();
  const out: EnrichedNewsArticle[] = [];
  for (const a of articles) {
    const key = (a.url || a.title).toLowerCase().replace(/\W+/g, "").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

export async function fetchMarketNewsDesk(options?: {
  limit?: number;
  symbol?: string | null;
  desk?: NewsDesk | "all";
}): Promise<{
  as_of: string;
  lead: EnrichedNewsArticle | null;
  articles: EnrichedNewsArticle[];
  pulse: { desk: NewsDesk; count: number; sentiment: NewsSentiment }[];
  movers: { symbol: string; company_name: string | null; change_percent: number | null; price: number | null }[];
}> {
  const limit = Math.min(Math.max(options?.limit ?? 28, 8), 40);
  const symbolFilter = options?.symbol?.trim().toUpperCase() || null;
  const deskFilter = options?.desk && options.desk !== "all" ? options.desk : null;

  const [finnhub, ...yahooDesks] = await Promise.all([
    fetchFinnhubGeneral(20),
    ...DESK_QUERIES.map((d) => fetchYahooDesk(d.desk, d.q, 8)),
  ]);

  let merged = dedupe([...finnhub, ...yahooDesks.flat()]);

  if (symbolFilter) {
    merged = merged.filter(
      (a) =>
        a.symbols.includes(symbolFilter) ||
        a.title.toUpperCase().includes(symbolFilter) ||
        (a.summary ?? "").toUpperCase().includes(symbolFilter),
    );
    // Also pull symbol-specific Yahoo search
    const focused = await fetchYahooDesk("markets", symbolFilter, 12);
    merged = dedupe([...focused, ...merged]);
  }

  if (deskFilter) {
    merged = merged.filter((a) => a.desk === deskFilter);
  }

  merged.sort((a, b) => b.importance - a.importance || (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const top = merged.slice(0, limit);
  const enriched = await enrichQuotes(top);

  const deskCounts = new Map<NewsDesk, { bull: number; bear: number; n: number }>();
  for (const a of enriched) {
    const cur = deskCounts.get(a.desk) ?? { bull: 0, bear: 0, n: 0 };
    cur.n += 1;
    if (a.sentiment === "bullish") cur.bull += 1;
    if (a.sentiment === "bearish") cur.bear += 1;
    deskCounts.set(a.desk, cur);
  }

  const pulse = [...deskCounts.entries()]
    .map(([desk, v]) => ({
      desk,
      count: v.n,
      sentiment: (v.bull === v.bear ? "neutral" : v.bull > v.bear ? "bullish" : "bearish") as NewsSentiment,
    }))
    .sort((a, b) => b.count - a.count);

  const moverMap = new Map<
    string,
    { symbol: string; company_name: string | null; change_percent: number | null; price: number | null }
  >();
  for (const a of enriched) {
    for (const s of a.related_stocks) {
      if (s.change_percent == null) continue;
      const prev = moverMap.get(s.symbol);
      if (!prev || Math.abs(s.change_percent) > Math.abs(prev.change_percent ?? 0)) {
        moverMap.set(s.symbol, s);
      }
    }
  }
  const movers = [...moverMap.values()]
    .sort((a, b) => Math.abs(b.change_percent ?? 0) - Math.abs(a.change_percent ?? 0))
    .slice(0, 8);

  return {
    as_of: new Date().toISOString(),
    lead: enriched[0] ?? null,
    articles: enriched,
    pulse,
    movers,
  };
}
