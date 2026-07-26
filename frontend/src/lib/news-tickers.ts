/** Ticker + company-name detection for news headlines. */

export const SYMBOL_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corp.",
  GOOGL: "Alphabet Inc.",
  GOOG: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",
  NVDA: "NVIDIA Corp.",
  META: "Meta Platforms",
  TSLA: "Tesla Inc.",
  "BRK-B": "Berkshire Hathaway",
  JPM: "JPMorgan Chase",
  V: "Visa Inc.",
  UNH: "UnitedHealth Group",
  XOM: "Exxon Mobil",
  MA: "Mastercard Inc.",
  HD: "Home Depot",
  PG: "Procter & Gamble",
  CVX: "Chevron Corp.",
  MRK: "Merck & Co.",
  ABBV: "AbbVie Inc.",
  PEP: "PepsiCo Inc.",
  KO: "Coca-Cola Co.",
  COST: "Costco Wholesale",
  AVGO: "Broadcom Inc.",
  WMT: "Walmart Inc.",
  DIS: "Walt Disney Co.",
  NFLX: "Netflix Inc.",
  AMD: "Advanced Micro Devices",
  INTC: "Intel Corp.",
  BA: "Boeing Co.",
  GS: "Goldman Sachs",
  CRM: "Salesforce Inc.",
  DELL: "Dell Technologies",
  ORCL: "Oracle Corp.",
  CSCO: "Cisco Systems",
  IBM: "IBM Corp.",
  PYPL: "PayPal Holdings",
  COIN: "Coinbase Global",
  ASML: "ASML Holding",
  RACE: "Ferrari N.V.",
  TSM: "Taiwan Semiconductor",
  SAP: "SAP SE",
  NVO: "Novo Nordisk",
  UL: "Unilever",
  SHEL: "Shell plc",
  BP: "BP plc",
  TM: "Toyota Motor",
  BABA: "Alibaba Group",
  SONY: "Sony Group",
  SHOP: "Shopify",
  MELI: "MercadoLibre",
  STLA: "Stellantis",
  BUD: "Anheuser-Busch InBev",
  DEO: "Diageo",
};

/** Lowercase keyword → ticker (for headlines that name companies, not symbols). */
const NAME_TO_SYMBOL: Record<string, string> = {
  apple: "AAPL",
  microsoft: "MSFT",
  google: "GOOGL",
  alphabet: "GOOGL",
  amazon: "AMZN",
  nvidia: "NVDA",
  meta: "META",
  facebook: "META",
  tesla: "TSLA",
  berkshire: "BRK-B",
  jpmorgan: "JPM",
  visa: "V",
  exxon: "XOM",
  chevron: "CVX",
  walmart: "WMT",
  disney: "DIS",
  netflix: "NFLX",
  intel: "INTC",
  boeing: "BA",
  goldman: "GS",
  salesforce: "CRM",
  dell: "DELL",
  oracle: "ORCL",
  cisco: "CSCO",
  ibm: "IBM",
  paypal: "PYPL",
  coinbase: "COIN",
  pepsi: "PEP",
  "coca-cola": "KO",
  "coca cola": "KO",
  costco: "COST",
  broadcom: "AVGO",
  merck: "MRK",
  abbvie: "ABBV",
  "home depot": "HD",
  "procter": "PG",
  johnson: "JNJ",
  asml: "ASML",
  ferrari: "RACE",
  "taiwan semi": "TSM",
  tsmc: "TSM",
  sap: "SAP",
  "novo nordisk": "NVO",
  unilever: "UL",
  shell: "SHEL",
  toyota: "TM",
  alibaba: "BABA",
  sony: "SONY",
  shopify: "SHOP",
  mercadolibre: "MELI",
  stellantis: "STLA",
  diageo: "DEO",
};

const TICKER_PATTERN = /\$?([A-Z]{1,5})\b/g;

export function extractTickersFromText(text: string): string[] {
  if (!text) return [];
  const upper = text.toUpperCase();
  const found = new Set<string>();

  for (const match of upper.matchAll(TICKER_PATTERN)) {
    const sym = match[1];
    if (SYMBOL_NAMES[sym]) found.add(sym);
  }

  const lower = text.toLowerCase();
  for (const [name, sym] of Object.entries(NAME_TO_SYMBOL)) {
    if (lower.includes(name)) found.add(sym);
  }

  return [...found].slice(0, 6);
}

export function companyNameFor(symbol: string): string | null {
  return SYMBOL_NAMES[symbol.toUpperCase()] ?? null;
}
