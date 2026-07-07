export type ScoreBlock = {
  score: number | null;
  label: string;
  reasons: string[];
  risks: string[];
};

export type StockPilotScores = {
  financial_health: ScoreBlock;
  growth: ScoreBlock;
  value: ScoreBlock;
  quality: ScoreBlock;
  momentum: ScoreBlock;
  risk: ScoreBlock;
  overall: ScoreBlock;
};

export type FairValueEstimate = {
  current_price: number | null;
  fair_value_low: number | null;
  fair_value_mid: number | null;
  fair_value_high: number | null;
  upside_percent: number | null;
  methods: { name: string; estimate: number | null; note: string | null }[];
  confidence: number;
  disclaimer: string;
};

export type EquityAnalystReport = {
  bull_case: string[];
  bear_case: string[];
  investment_thesis: string;
  growth_opportunities: string[];
  competitive_advantages: string[];
  main_risks: string[];
  catalysts: string[];
  concerns: string[];
  stockpilot_rating: number | null;
  moat_assessment: string | null;
};

export type CompanyResearch = {
  symbol: string;
  company_name: string | null;
  quote: import("@/types/market").SymbolAnalysis["quote"];
  fundamentals: Record<string, unknown> | null;
  technical: import("@/types/market").SymbolAnalysis["technical"];
  scores: import("@/types/market").SymbolAnalysis["scores"];
  stockpilot_scores: StockPilotScores | null;
  fair_value: FairValueEstimate | null;
  equity_report: EquityAnalystReport | null;
  explanation: import("@/types/market").SymbolAnalysis["explanation"];
  data_warnings: string[];
  disclaimer: string;
};

export type ComparisonResponse = {
  symbols: string[];
  metrics: {
    symbol: string;
    company_name: string | null;
    growth_score: number | null;
    profitability_score: number | null;
    valuation_score: number | null;
    risk_score: number | null;
    quality_score: number | null;
    overall_score: number | null;
    pe_ratio: number | null;
    revenue_growth: number | null;
    profit_margin: number | null;
  }[];
  ai_conclusion: string;
  disclaimer: string;
};

export type MarketIntelligence = {
  indices: { symbol: string; name: string; price: number | null; change_percent: number | null }[];
  sector_performance: { sector: string; avg_change_percent: number | null; symbol_count: number }[];
  briefing: { headline: string; summary: string; sentiment: string; key_points: string[] };
  disclaimer: string;
};

export type PortfolioAnalysis = {
  holdings_count: number;
  total_value: number | null;
  health_score: number | null;
  diversification_score: number | null;
  risk_exposure: number | null;
  sector_concentration: Record<string, number>;
  weak_positions: string[];
  insights: string[];
  disclaimer: string;
};
