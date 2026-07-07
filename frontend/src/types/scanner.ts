export type ScanResult = {
  symbol: string;
  company_name: string | null;
  price: number | null;
  change_percent: number | null;
  predicted_price: number | null;
  predicted_change_percent: number | null;
  stockpilot_score: number | null;
  volume: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  rsi_14: number | null;
  technical_score: number | null;
  momentum_score: number | null;
  risk_score: number | null;
  overall_rating: string | null;
  recommendation: string | null;
  analyst_sentiment: string | null;
  ai_reasoning: string | null;
  confidence_score: number | null;
  sector: string | null;
  provider: string | null;
};

export type ScannerResponse = {
  results: ScanResult[];
  scanned_at: string;
  universe_size: number;
  filters_applied: Record<string, string | number | boolean>;
  disclaimer: string;
};

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

export type NewsStockMention = {
  symbol: string;
  company_name: string | null;
  price: number | null;
  change_percent: number | null;
};

export type NewsArticle = {
  title: string;
  source: string | null;
  url: string | null;
  published_at: string | null;
  summary: string | null;
  image_url: string | null;
  symbols: string[];
  related_stocks: NewsStockMention[];
};
