/** Site branding — company name is always StockPilot; AI is a capability tagline. */
export const SITE_NAME = "StockPilot";
export const SITE_TAGLINE = "AI-Powered Market Analysis";
export const SITE_DESCRIPTION =
  "StockPilot analyzes live financial data with AI-powered research tools. Probabilistic analysis — not financial advice.";
export const AI_ASSISTANT_LABEL = "Your AI Investing Assistant";
export const POWERED_BY_AI = "Powered by AI";

export function pageTitle(segment?: string): string {
  return segment ? `${segment} | ${SITE_NAME}` : SITE_NAME;
}
