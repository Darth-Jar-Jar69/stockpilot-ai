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

export type FallenGiantSource = {
  title: string;
  source: string | null;
  url: string | null;
  published_at: string | null;
};

export type FallenGiantCandidate = {
  symbol: string;
  company_name: string | null;
  market_cap: number | null;
  current_price: number | null;
  pre_catalyst_price: number | null;
  lowest_price_after_catalyst: number | null;
  decline_percent: number | null;
  recovered_percent: number | null;
  catalyst: string | null;
  catalyst_type: string;
  catalyst_date: string | null;
  fundamental_health_score: number | null;
  valuation_score: number | null;
  recovery_score: number | null;
  risk_score: number | null;
  catalyst_clarity_score: number | null;
  price_dislocation_score: number | null;
  fallen_giants_score: number | null;
  why_it_fell: string | null;
  why_it_could_recover: string | null;
  why_it_might_not_recover: string | null;
  recovery_confirmations: string[];
  sources: FallenGiantSource[];
  sector: string | null;
  relative_to_spy_decline: number | null;
  days_since_catalyst: number | null;
  selloff_days: number | null;
  provider: string | null;
  data_warnings: string[];
};

export type FallenGiantsResponse = {
  results: FallenGiantCandidate[];
  scanned_at: string;
  universe_size: number;
  filters_applied: Record<string, string | number | boolean>;
  disclaimer: string;
};
