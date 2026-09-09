import { NextResponse } from "next/server";

import {
  companyNameFor,
  extractTickersFromText,
} from "@/lib/news-tickers";
import type { NewsArticle, NewsStockMention } from "@/types/scanner";

import { fetchBackendJson } from "@/lib/backend";
import { yahooNewsFallback, yahooQuoteFallback } from "@/lib/market/yahoo-fallback";

type QuoteSnapshot = {
  price: number | null;
  change_percent: number | null;
};

async function fetchQuote(symbol: string): Promise<QuoteSnapshot> {
  try {
    const { ok, data } = await fetchBackendJson<Record<string, unknown>>({
      path: `/api/v1/quotes/${encodeURIComponent(symbol)}`,
      revalidate: false,
    });
    if (ok) {
      return {
        price: typeof data.price === "number" ? data.price : null,
        change_percent: typeof data.change_percent === "number" ? data.change_percent : null,
      };
    }
  } catch {
    // Yahoo below
  }
  try {
    const q = await yahooQuoteFallback(symbol);
    return { price: q.price, change_percent: q.change_percent };
  } catch {
    return { price: null, change_percent: null };
  }
}

async function buildQuoteMap(symbols: string[]): Promise<Map<string, QuoteSnapshot>> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(0, 12);
  const entries = await Promise.all(
    unique.map(async (symbol) => [symbol, await fetchQuote(symbol)] as const),
  );
  return new Map(entries);
}

function buildRelatedStocks(
  symbols: string[],
  quotes: Map<string, QuoteSnapshot>,
): NewsStockMention[] {
  return [...new Set(symbols.map((s) => s.toUpperCase()))]
    .slice(0, 6)
    .map((symbol) => {
      const quote = quotes.get(symbol) ?? { price: null, change_percent: null };
      return {
        symbol,
        company_name: companyNameFor(symbol),
        price: quote.price,
        change_percent: quote.change_percent,
      };
    });
}

function normalizeArticle(
  raw: Record<string, unknown>,
  quotes: Map<string, QuoteSnapshot>,
): NewsArticle {
  const title = String(raw.title ?? "Untitled");
  const summary = raw.summary != null ? String(raw.summary) : null;
  const text = `${title} ${summary ?? ""}`;

  const symbolsFromApi = Array.isArray(raw.symbols)
    ? (raw.symbols as string[]).map((s) => s.toUpperCase())
    : [];
  const detected = extractTickersFromText(text);
  const symbols = [...new Set([...symbolsFromApi, ...detected])];

  const relatedRaw = Array.isArray(raw.related_stocks) ? raw.related_stocks : [];
  const relatedSymbols =
    symbols.length > 0
      ? symbols
      : relatedRaw.map((s) => String((s as Record<string, unknown>).symbol ?? "").toUpperCase());

  const related = buildRelatedStocks(relatedSymbols, quotes);

  return {
    title,
    source: raw.source != null ? String(raw.source) : null,
    url: raw.url != null ? String(raw.url) : null,
    published_at: raw.published_at != null ? String(raw.published_at) : null,
    summary,
    image_url: raw.image_url != null ? String(raw.image_url) : null,
    symbols: related.map((r) => r.symbol),
    related_stocks: related.filter((r) => r.symbol),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const limit = searchParams.get("limit") ?? "15";
  const q = new URLSearchParams({ limit });
  if (symbol) q.set("symbol", symbol);

  try {
    const { ok, data } = await fetchBackendJson<unknown>({
      path: "/api/v1/news",
      searchParams: q,
      revalidate: false,
    });
    if (ok) {
      const rawList = Array.isArray(data) ? data : [];
      const allSymbols = rawList.flatMap((item) => {
        const raw = item as Record<string, unknown>;
        const title = String(raw.title ?? "");
        const summary = raw.summary != null ? String(raw.summary) : "";
        const fromApi = Array.isArray(raw.symbols) ? (raw.symbols as string[]) : [];
        const fromRelated = Array.isArray(raw.related_stocks)
          ? raw.related_stocks.map((s) => String((s as Record<string, unknown>).symbol ?? ""))
          : [];
        return [...fromApi, ...fromRelated, ...extractTickersFromText(`${title} ${summary}`)];
      });

      const quotes = await buildQuoteMap(allSymbols);
      const articles = rawList.map((item) =>
        normalizeArticle(item as Record<string, unknown>, quotes),
      );
      return NextResponse.json(articles);
    }
  } catch {
    // Yahoo fallback below
  }

  try {
    const articles = await yahooNewsFallback(Number(limit) || 15, symbol);
    return NextResponse.json(articles);
  } catch {
    return NextResponse.json({ error: "News temporarily unavailable." }, { status: 503 });
  }
}
