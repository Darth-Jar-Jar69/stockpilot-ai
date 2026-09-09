/**
 * StockPilot research scoring — transparent, rubric-based 0–100 scores.
 *
 * Every dimension is a weighted blend of individually scored metrics via piecewise-linear
 * interpolation over anchor points, and every score ships with the concrete numbers that
 * produced it. Missing metrics simply drop out of the blend (they never default to 50 silently).
 */

import type { FairValueResult, LiveFundamentals } from "@/lib/market/live-fundamentals";
import type { ScoreBlock, StockPilotScores } from "@/types/research";

export type TechnicalContext = {
  rsi_14: number | null;
  sma_50: number | null;
  sma_200: number | null;
  volatility_annualized: number | null;
  price: number | null;
};

type Part = { v: number; w: number };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function interp(x: number, points: [number, number][]): number {
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    if (x <= x1) {
      const [x0, y0] = points[i - 1]!;
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1]![1];
}

function blend(parts: Part[]): number | null {
  if (parts.length === 0) return null;
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  return clamp(Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) / wsum), 0, 100);
}

const pctStr = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;

function block(label: string, score: number | null, reasons: string[], risks: string[]): ScoreBlock {
  return { label, score, reasons, risks };
}

// ---------------------------------------------------------------------------

export function scoreFinancialHealth(f: LiveFundamentals): ScoreBlock {
  const parts: Part[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];

  if (f.current_ratio != null) {
    parts.push({ v: interp(f.current_ratio, [[0.6, 10], [0.8, 25], [1.0, 45], [1.5, 75], [2.5, 95]]), w: 1 });
    reasons.push(`Current ratio ${f.current_ratio.toFixed(2)} (short-term assets vs liabilities)`);
    if (f.current_ratio < 1) risks.push("Current liabilities exceed current assets — liquidity is tight");
  }
  if (f.quick_ratio != null && f.quick_ratio < 0.8) {
    risks.push(`Quick ratio ${f.quick_ratio.toFixed(2)} — limited cash-like cover for near-term obligations`);
  }
  if (f.debt_to_equity != null) {
    parts.push({ v: interp(f.debt_to_equity, [[0, 95], [0.3, 85], [0.6, 72], [1.0, 58], [2.0, 35], [4.0, 10]]), w: 1.2 });
    reasons.push(`Debt/equity ${f.debt_to_equity.toFixed(2)}×`);
    if (f.debt_to_equity > 1.5) risks.push("Leverage is high — interest costs and refinancing become material risks");
  }
  if (f.interest_coverage != null) {
    parts.push({ v: interp(f.interest_coverage, [[0, 5], [1, 20], [3, 50], [6, 72], [12, 88], [25, 97]]), w: 1 });
    reasons.push(`Interest coverage ${f.interest_coverage.toFixed(1)}× (operating income ÷ interest expense)`);
    if (f.interest_coverage < 3) risks.push("Interest coverage below 3× leaves little cushion if earnings dip");
  }
  if (f.profit_margin != null) {
    parts.push({ v: interp(f.profit_margin, [[-0.2, 10], [0, 35], [0.08, 58], [0.15, 72], [0.25, 88], [0.35, 95]]), w: 0.8 });
    reasons.push(`Net margin ${pctStr(f.profit_margin)}`);
    if (f.profit_margin < 0) risks.push("Company is loss-making on a trailing basis");
  }
  if (f.return_on_equity != null) {
    parts.push({ v: interp(f.return_on_equity, [[-0.1, 10], [0, 35], [0.08, 55], [0.15, 72], [0.25, 87], [0.4, 95]]), w: 0.8 });
    reasons.push(`Return on equity ${pctStr(f.return_on_equity)}`);
    if (f.return_on_equity < 0.08 && f.gaap_distorted) {
      reasons.push("ROE is depressed by acquisition accounting / one-offs rather than core operations");
    } else if (f.return_on_equity < 0.08) {
      risks.push("Low ROE — capital is not compounding quickly");
    }
  }
  if (parts.length === 0) risks.push("No balance-sheet data in the live feed for this security");

  return block("Financial Health", blend(parts), reasons, risks);
}

export function scoreGrowth(f: LiveFundamentals): ScoreBlock {
  const parts: Part[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];
  const revScale: [number, number][] = [[-0.1, 5], [-0.03, 20], [0, 32], [0.05, 50], [0.1, 65], [0.2, 85], [0.35, 96]];
  const epsScale: [number, number][] = [[-0.3, 5], [-0.1, 20], [0, 38], [0.08, 55], [0.15, 72], [0.3, 90], [0.5, 97]];

  if (f.revenue_growth_3y != null) {
    parts.push({ v: interp(f.revenue_growth_3y, revScale), w: 1.2 });
    reasons.push(`Revenue 3-yr CAGR ${pctStr(f.revenue_growth_3y)}`);
  }
  if (f.revenue_growth != null) {
    parts.push({ v: interp(f.revenue_growth, revScale), w: f.gaap_distorted ? 0.6 : 1.0 });
    reasons.push(
      `Revenue growth (TTM YoY) ${pctStr(f.revenue_growth)}${f.gaap_distorted ? " — includes acquired revenue" : ""}`,
    );
    if (f.revenue_growth < 0) risks.push("Top line is shrinking year over year");
  }
  if (f.eps_growth_3y != null) {
    parts.push({ v: interp(f.eps_growth_3y, epsScale), w: 1.0 });
    reasons.push(`EPS 3-yr CAGR ${pctStr(f.eps_growth_3y)}`);
  }
  if (f.eps_growth != null) {
    parts.push({ v: interp(f.eps_growth, epsScale), w: f.gaap_distorted ? 0.25 : 0.6 });
    reasons.push(`GAAP EPS growth (TTM YoY) ${pctStr(f.eps_growth)}${f.gaap_distorted ? " — distorted by one-offs" : ""}`);
    if (f.eps_growth < -0.2 && !f.gaap_distorted) risks.push("Earnings are contracting sharply");
  }
  if (f.eps_growth_forward != null) {
    parts.push({ v: interp(f.eps_growth_forward, [[-0.2, 15], [0, 40], [0.1, 60], [0.25, 78], [0.5, 90], [1.0, 95]]), w: 0.8 });
    reasons.push(`Street forward EPS implies ${signed(f.eps_growth_forward * 100, 0)} vs trailing GAAP EPS`);
  }
  if (parts.length === 0) risks.push("Growth metrics not available in the live feed — verify in filings");
  if (f.gaap_distorted) {
    risks.push("Reported growth mixes organic and acquired results — check organic growth in the 10-Q");
  }

  return block("Growth", blend(parts), reasons, risks);
}

export function scoreValue(f: LiveFundamentals, fair: FairValueResult): ScoreBlock {
  const parts: Part[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];

  if (f.forward_pe != null && f.forward_pe > 0) {
    parts.push({ v: interp(f.forward_pe, [[8, 95], [12, 88], [18, 72], [25, 55], [35, 38], [50, 20], [80, 8]]), w: 1.4 });
    reasons.push(`Forward P/E ${f.forward_pe.toFixed(1)}×`);
  }
  if (f.pe_ratio != null && f.pe_ratio > 0) {
    parts.push({ v: interp(f.pe_ratio, [[8, 92], [15, 80], [25, 60], [40, 40], [60, 25], [100, 10]]), w: f.gaap_distorted ? 0.3 : 0.7 });
    reasons.push(`Trailing P/E (GAAP) ${f.pe_ratio.toFixed(1)}×${f.gaap_distorted ? " — inflated by depressed GAAP EPS" : ""}`);
  } else if (f.pe_ratio != null) {
    risks.push("Negative trailing earnings — P/E not meaningful");
    parts.push({ v: 25, w: 0.5 });
  }
  if (f.pe_normalized != null && f.pe_normalized > 0) {
    reasons.push(`P/E (normalized, last FY) ${f.pe_normalized.toFixed(1)}×`);
  }
  if (f.peg_ratio != null && f.peg_ratio > 0) {
    // PEG is built on trailing GAAP P/E — unreliable when GAAP earnings are distorted.
    parts.push({ v: interp(f.peg_ratio, [[0.5, 92], [1, 75], [1.5, 62], [2, 50], [3, 32], [5, 15]]), w: f.gaap_distorted ? 0.3 : 0.8 });
    reasons.push(`PEG ${f.peg_ratio.toFixed(2)}${f.gaap_distorted ? " (on depressed GAAP EPS)" : ""}`);
    if (f.peg_ratio > 2.5 && !f.gaap_distorted) risks.push("PEG above 2.5 — paying a full price for expected growth");
  }
  if (f.ps_ratio != null && f.ps_ratio > 0) {
    // Sales multiples only mean something with margin context: scale the anchor by gross margin.
    const marginAdj = f.gross_margin != null ? clamp(f.gross_margin / 0.5, 0.6, 1.6) : 1;
    parts.push({ v: interp(f.ps_ratio / marginAdj, [[1, 90], [3, 72], [6, 55], [10, 40], [20, 20]]), w: 0.5 });
    reasons.push(`Price/sales ${f.ps_ratio.toFixed(2)}×`);
  }
  if (f.pb_ratio != null && f.pb_ratio > 0) {
    parts.push({ v: interp(f.pb_ratio, [[1, 85], [3, 65], [6, 50], [15, 30], [40, 15]]), w: 0.3 });
    reasons.push(`Price/book ${f.pb_ratio.toFixed(2)}×`);
  }
  if (f.pcf_ratio != null && f.pcf_ratio > 0) {
    parts.push({ v: interp(f.pcf_ratio, [[8, 90], [15, 70], [25, 50], [40, 30], [70, 12]]), w: 0.6 });
    reasons.push(`Price/cash flow ${f.pcf_ratio.toFixed(1)}×`);
  }
  if (fair.upside_percent != null) {
    parts.push({ v: interp(fair.upside_percent, [[-40, 5], [-20, 25], [-8, 42], [0, 52], [10, 65], [25, 82], [45, 95]]), w: 1.5 });
    reasons.push(`Fair-value gap ${signed(fair.upside_percent)} (${fair.valuation_label})`);
    if (fair.upside_percent < -15) risks.push("Trading well above our fair-value band");
  }
  if (parts.length === 0) risks.push("Valuation multiples not available for this security");

  return block("Value", blend(parts), reasons, risks);
}

export function scoreQuality(f: LiveFundamentals): ScoreBlock {
  const parts: Part[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];

  if (f.gross_margin != null) {
    parts.push({ v: interp(f.gross_margin, [[0.1, 15], [0.25, 35], [0.4, 55], [0.55, 70], [0.7, 88], [0.85, 96]]), w: 1.0 });
    reasons.push(`Gross margin ${pctStr(f.gross_margin)}`);
  }
  if (f.operating_margin != null) {
    parts.push({ v: interp(f.operating_margin, [[-0.1, 8], [0, 30], [0.1, 55], [0.2, 72], [0.3, 88], [0.45, 96]]), w: 1.2 });
    reasons.push(`Operating margin ${pctStr(f.operating_margin)}`);
    if (f.operating_margin < 0.05) risks.push("Thin operating margin leaves little room for cost shocks");
  }
  if (f.return_on_equity != null) {
    parts.push({ v: interp(f.return_on_equity, [[-0.1, 10], [0, 35], [0.08, 55], [0.15, 72], [0.25, 87], [0.4, 95]]), w: f.gaap_distorted ? 0.4 : 0.8 });
  }
  if (f.return_on_assets != null) {
    parts.push({ v: interp(f.return_on_assets, [[-0.05, 10], [0, 30], [0.04, 52], [0.08, 68], [0.15, 85], [0.25, 95]]), w: f.gaap_distorted ? 0.4 : 0.8 });
    reasons.push(`Return on assets ${pctStr(f.return_on_assets)}`);
  }
  if (f.profit_margin != null && f.gross_margin != null && f.gross_margin > 0) {
    const conversion = f.profit_margin / f.gross_margin;
    parts.push({ v: interp(conversion, [[0, 25], [0.15, 50], [0.3, 70], [0.5, 90]]), w: 0.5 });
    reasons.push(`${pctStr(conversion, 0)} of gross profit reaches the bottom line`);
  }
  if (f.free_cash_flow_per_share != null && f.eps != null && f.eps > 0) {
    const fcfConv = f.free_cash_flow_per_share / f.eps;
    parts.push({ v: interp(fcfConv, [[0.3, 25], [0.7, 50], [1.0, 75], [1.5, 92]]), w: 0.6 });
    reasons.push(`Free cash flow is ${fcfConv.toFixed(2)}× reported EPS (earnings quality)`);
  }
  if (parts.length === 0) risks.push("Profitability metrics unavailable — quality not scored on fundamentals");
  risks.push("Moat durability (switching costs, pricing power) still needs qualitative review");

  return block("Quality", blend(parts), reasons, risks);
}

export function scoreMomentum(f: LiveFundamentals, t: TechnicalContext): ScoreBlock {
  const parts: Part[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];
  const r = f.returns;

  if (r.one_month != null) {
    parts.push({ v: interp(r.one_month, [[-15, 15], [-5, 35], [0, 50], [5, 65], [15, 85]]), w: 0.8 });
    reasons.push(`1-month return ${signed(r.one_month)}`);
  }
  if (r.three_month != null) {
    parts.push({ v: interp(r.three_month, [[-25, 10], [-10, 30], [0, 50], [10, 70], [25, 90]]), w: 1.2 });
    reasons.push(`3-month return ${signed(r.three_month)}`);
  }
  if (r.six_month != null) {
    parts.push({ v: interp(r.six_month, [[-35, 10], [-15, 30], [0, 50], [15, 70], [40, 90]]), w: 1.0 });
    reasons.push(`6-month return ${signed(r.six_month)}`);
  }
  if (r.one_year != null) {
    parts.push({ v: interp(r.one_year, [[-45, 10], [-15, 30], [0, 50], [20, 70], [60, 90]]), w: 0.8 });
    reasons.push(`1-year return ${signed(r.one_year)}`);
  }
  if (t.price != null && t.sma_50 != null) {
    const gap = ((t.price - t.sma_50) / t.sma_50) * 100;
    parts.push({ v: interp(gap, [[-20, 15], [-8, 35], [0, 50], [5, 68], [15, 80]]), w: 0.8 });
    reasons.push(`${gap >= 0 ? "Above" : "Below"} 50-day average by ${Math.abs(gap).toFixed(1)}%`);
  }
  if (t.price != null && t.sma_200 != null) {
    const gap = ((t.price - t.sma_200) / t.sma_200) * 100;
    parts.push({ v: interp(gap, [[-30, 10], [-10, 35], [0, 55], [10, 72], [30, 85]]), w: 1.0 });
    reasons.push(`${gap >= 0 ? "Above" : "Below"} 200-day average by ${Math.abs(gap).toFixed(1)}%`);
    if (gap < 0) risks.push("Below the 200-day average — long-term trend is down until reclaimed");
  }
  if (t.rsi_14 != null) {
    parts.push({ v: interp(t.rsi_14, [[20, 40], [30, 48], [50, 60], [65, 62], [75, 45], [85, 30]]), w: 0.5 });
    reasons.push(`RSI(14) ${t.rsi_14.toFixed(0)}`);
    if (t.rsi_14 > 70) risks.push("RSI overbought — short-term pullback risk");
    if (t.rsi_14 < 30) reasons.push("RSI oversold — selling pressure may be exhausting");
  }
  if (parts.length === 0) risks.push("Not enough price history to score momentum");
  risks.push("Momentum reverses fastest around earnings and macro prints");

  return block("Momentum", blend(parts), reasons, risks);
}

/** Higher = riskier. */
export function scoreRisk(f: LiveFundamentals, t: TechnicalContext): ScoreBlock {
  const parts: Part[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];

  if (f.beta != null) {
    parts.push({ v: interp(f.beta, [[0.4, 20], [0.8, 38], [1.0, 45], [1.3, 60], [1.7, 75], [2.2, 88], [3, 97]]), w: 1.0 });
    reasons.push(`Beta ${f.beta.toFixed(2)} vs market`);
    if (f.beta > 1.4) risks.push("High beta amplifies market drawdowns");
  }
  if (t.volatility_annualized != null) {
    parts.push({ v: interp(t.volatility_annualized, [[0.12, 15], [0.2, 30], [0.3, 50], [0.45, 70], [0.7, 88], [1, 97]]), w: 1.2 });
    reasons.push(`Realized volatility ${pctStr(t.volatility_annualized, 0)} annualized (3-mo)`);
  }
  if (f.fifty_two_week_high != null && f.price != null && f.fifty_two_week_high > 0) {
    const dd = ((f.fifty_two_week_high - f.price) / f.fifty_two_week_high) * 100;
    parts.push({ v: interp(dd, [[0, 20], [10, 35], [25, 55], [40, 72], [60, 90]]), w: 1.0 });
    reasons.push(`${dd.toFixed(0)}% below the 52-week high`);
    if (dd > 30) risks.push("Deep drawdown — the market has repriced the story materially");
  }
  if (f.debt_to_equity != null) {
    parts.push({ v: interp(f.debt_to_equity, [[0, 20], [0.5, 35], [1, 48], [2, 68], [4, 88]]), w: 0.6 });
  }
  if (f.profit_margin != null && f.profit_margin < 0) {
    parts.push({ v: 80, w: 0.6 });
    risks.push("Unprofitable on a trailing basis — funding and dilution risk");
  }
  if (f.market_cap != null && f.market_cap < 2e9) {
    parts.push({ v: 70, w: 0.5 });
    risks.push("Small-cap — thinner liquidity and wider swings");
  }
  if (parts.length === 0) risks.push("Risk inputs unavailable");

  return block("Risk", blend(parts), reasons, risks);
}

export function buildStockPilotScores(
  f: LiveFundamentals,
  fair: FairValueResult,
  t: TechnicalContext,
): StockPilotScores {
  const health = scoreFinancialHealth(f);
  const growth = scoreGrowth(f);
  const value = scoreValue(f, fair);
  const quality = scoreQuality(f);
  const momentum = scoreMomentum(f, t);
  const risk = scoreRisk(f, t);

  const weighted: Part[] = [];
  if (health.score != null) weighted.push({ v: health.score, w: 0.2 });
  if (growth.score != null) weighted.push({ v: growth.score, w: 0.2 });
  if (value.score != null) weighted.push({ v: value.score, w: 0.2 });
  if (quality.score != null) weighted.push({ v: quality.score, w: 0.15 });
  if (momentum.score != null) weighted.push({ v: momentum.score, w: 0.15 });
  if (risk.score != null) weighted.push({ v: 100 - risk.score, w: 0.1 });
  const overallScore = blend(weighted);

  const scored = [health, growth, value, quality, momentum].filter((b) => b.score != null);
  const strongest = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const weakest = [...scored].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  const overall = block(
    "Overall",
    overallScore,
    [
      "Weights: health 20 · growth 20 · value 20 · quality 15 · momentum 15 · (100 − risk) 10",
      strongest ? `Strongest factor: ${strongest.label} ${strongest.score}/100` : "",
      weakest && weakest !== strongest ? `Weakest factor: ${weakest.label} ${weakest.score}/100` : "",
      `Live data via ${f.provider}`,
    ].filter(Boolean),
    ["Scores are research aids built from reported metrics — not buy/sell recommendations"],
  );

  return { overall, financial_health: health, growth, value, quality, momentum, risk };
}

export function ratingFromScore(score: number | null): string {
  if (score == null) return "Hold";
  if (score >= 78) return "Strong Buy";
  if (score >= 64) return "Buy";
  if (score >= 45) return "Hold";
  if (score >= 32) return "Sell";
  return "Strong Sell";
}
