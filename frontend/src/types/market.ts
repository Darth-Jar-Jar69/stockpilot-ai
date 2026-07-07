export type Quote = {
  symbol: string;
  price: number;
  change: number | null;
  change_percent: number | null;
  currency: string;
  market_cap: number | null;
  volume: number | null;
  previous_close: number | null;
  provider: string;
  freshness: string;
  as_of: string;
};

export type OHLCVBar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OHLCVResponse = {
  symbol: string;
  interval: string;
  bars: OHLCVBar[];
  provider: string;
  freshness: string;
};

export type TechnicalIndicators = {
  symbol: string;
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  ema_12: number | null;
  ema_26: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  atr_14: number | null;
  vwap: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  adx_14: number | null;
  provider: string;
  computed_at: string;
  data_points: number;
};

export type Fundamentals = {
  symbol: string;
  pe_ratio: number | null;
  forward_pe: number | null;
  peg_ratio: number | null;
  eps: number | null;
  dividend_yield: number | null;
  beta: number | null;
  profit_margin: number | null;
  revenue_growth: number | null;
  sector: string | null;
  industry: string | null;
  provider: string;
  as_of: string;
};

export type AnalysisExplanation = {
  overall_rating: string;
  investment_thesis: string;
  reasons: string[];
  potential_risks: string[];
  confidence: number;
};

export type SymbolAnalysis = {
  symbol: string;
  quote: Quote | null;
  fundamentals: Fundamentals | null;
  technical: TechnicalIndicators | null;
  scores: {
    technical_score: number | null;
    momentum_score: number | null;
    risk_score: number | null;
  } | null;
  explanation: AnalysisExplanation | null;
  data_warnings: string[];
  disclaimer: string;
};
