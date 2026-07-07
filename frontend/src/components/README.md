# Components (`src/components/`)

**Why:** Reusable UI building blocks separated by concern.

| Folder | Purpose |
|--------|---------|
| `ui/` | shadcn/ui primitives — unstyled-accessible base components |
| `charts/` | TradingView Lightweight Charts wrappers (candlestick, volume, indicators) |
| `layout/` | App shell — sidebar, top bar, mobile nav, page headers |
| `features/` | Domain-specific composites (e.g. `PortfolioSummaryCard`, `AnalysisReport`) |

**Rule:** `ui/` components know nothing about stocks. `features/` components call hooks and display domain data.
