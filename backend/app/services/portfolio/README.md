# Portfolio Optimizer (`services/portfolio/`)

**Why:** Given user goals (capital, target, timeframe, risk tolerance, markets), ranks opportunities and proposes an allocation with expected return ranges — not guaranteed outcomes.

## Inputs

- Starting capital (e.g. £900)
- Target amount (e.g. £1000)
- Timeframe (e.g. 90 days)
- Risk tolerance (conservative / moderate / aggressive)
- Country and preferred markets

## Outputs

- Suggested allocation per symbol (%)
- Expected return range (low / mid / high)
- Downside risk estimate
- Confidence estimate
- Probability of reaching target (Monte Carlo or bootstrap)
- Rebalancing suggestions

## Constraints

- Max single-position weight (e.g. 25%)
- Sector diversification minimum
- Liquidity filter (min avg volume)
- Respects user risk tolerance via volatility caps
