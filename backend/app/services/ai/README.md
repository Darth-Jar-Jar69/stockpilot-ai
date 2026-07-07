# AI Reasoning Service (`services/ai/`)

**Why:** Aggregates quantitative sub-scores into structured, explainable reports. Never outputs "buy" without scores, risks, and probability ranges.

## Outputs

- Overall rating (qualitative band, not a guarantee)
- Sub-scores: technical, fundamental, momentum, risk
- News sentiment + analyst consensus summary
- Estimated upside/downside ranges (low / mid / high)
- Confidence score (0–1)
- Investment thesis, reasons, potential risks
- Suggested allocation percentage

## Design

1. **Deterministic scoring first** — all numbers from `technical/`, `fundamentals/`, `risk/`, `news/`
2. **LLM synthesis second (optional)** — turns structured data into prose; constrained JSON schema
3. **Disclaimer injection** — every response includes probabilistic language
