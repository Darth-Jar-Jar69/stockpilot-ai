"""Generate frontend SYMBOL_NAMES from backend scanner symbol_names.py."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / "backend/app/services/scanner/symbol_names.py").read_text(encoding="utf-8")
ns: dict = {}
exec(src.split("KNOWN_TICKERS")[0], ns)
names: dict[str, str] = dict(ns["SYMBOL_NAMES"])

# Prefer full legal-style names for common misses
names.update(
    {
        "SNPS": "Synopsys Inc.",
        "CDNS": "Cadence Design Systems",
        "NOW": "ServiceNow Inc.",
        "TEAM": "Atlassian Corp.",
        "FTNT": "Fortinet Inc.",
        "ZS": "Zscaler Inc.",
    }
)

STOP = {
    "inc",
    "corp",
    "co",
    "plc",
    "ltd",
    "group",
    "the",
    "and",
    "n.v",
    "s.a",
    "holdings",
    "holding",
    "company",
    "companies",
    "international",
    "technologies",
    "technology",
    "systems",
    "corp.",
    "inc.",
}

GENERIC = {
    "bank",
    "american",
    "united",
    "general",
    "southern",
    "global",
    "public",
    "first",
    "royal",
    "canadian",
}

extra = {
    "synopsys": "SNPS",
    "cadence": "CDNS",
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "nvidia": "NVDA",
    "meta": "META",
    "facebook": "META",
    "tesla": "TSLA",
    "berkshire": "BRK-B",
    "oracle": "ORCL",
    "ferrari": "RACE",
    "asml": "ASML",
    "tsmc": "TSM",
    "servicenow": "NOW",
    "atlassian": "TEAM",
    "fortinet": "FTNT",
    "zscaler": "ZS",
    "palantir": "PLTR",
    "crowdstrike": "CRWD",
    "snowflake": "SNOW",
}

lines: list[str] = [
    "/** Ticker + company-name map synced from scanner universe. Auto-generated — do not hand-edit. */",
    "",
    "export const SYMBOL_NAMES: Record<string, string> = {",
]
for k, v in sorted(names.items(), key=lambda kv: kv[0]):
    lines.append(f"  {json.dumps(k)}: {json.dumps(v)},")
lines.append("};")
lines.append("")
lines.append("/** Lowercase company keyword → ticker for news/search. */")
lines.append("const NAME_TO_SYMBOL: Record<string, string> = {")

seen: set[str] = set()
for k, v in sorted(extra.items()):
    lines.append(f"  {json.dumps(k)}: {json.dumps(v)},")
    seen.add(k)

for sym, name in names.items():
    cleaned = re.sub(r"[^a-z0-9\s\-]", "", name.lower()).replace("&", " and ")
    parts = [p for p in cleaned.split() if p not in STOP]
    if not parts:
        continue
    candidates = [parts[0]]
    if len(parts) >= 2:
        candidates.append(" ".join(parts[:2]))
    for key in candidates:
        if len(key) < 3 or key in seen:
            continue
        if key in GENERIC and " " not in key:
            continue
        seen.add(key)
        lines.append(f"  {json.dumps(key)}: {json.dumps(sym)},")

lines.append("};")
lines.append("")
lines.append("const TICKER_PATTERN = /\\$?([A-Z]{1,5})\\b/g;")
lines.append("")
lines.append("export function extractTickersFromText(text: string): string[] {")
lines.append("  if (!text) return [];")
lines.append("  const upper = text.toUpperCase();")
lines.append("  const found = new Set<string>();")
lines.append("")
lines.append("  for (const match of upper.matchAll(TICKER_PATTERN)) {")
lines.append("    const sym = match[1];")
lines.append("    if (sym && SYMBOL_NAMES[sym]) found.add(sym);")
lines.append("  }")
lines.append("")
lines.append("  const lower = text.toLowerCase();")
lines.append("  for (const [name, sym] of Object.entries(NAME_TO_SYMBOL)) {")
lines.append("    if (lower.includes(name)) found.add(sym);")
lines.append("  }")
lines.append("")
lines.append("  return [...found].slice(0, 6);")
lines.append("}")
lines.append("")
lines.append("export function companyNameFor(symbol: string): string | null {")
lines.append("  return SYMBOL_NAMES[symbol.toUpperCase()] ?? null;")
lines.append("}")
lines.append("")
lines.append("/** Resolve a ticker from a company name or symbol query. */")
lines.append("export function resolveSymbolQuery(query: string): string | null {")
lines.append("  const q = query.trim();")
lines.append("  if (!q) return null;")
lines.append("  const upper = q.toUpperCase();")
lines.append("  if (SYMBOL_NAMES[upper]) return upper;")
lines.append("  const lower = q.toLowerCase();")
lines.append("  if (NAME_TO_SYMBOL[lower]) return NAME_TO_SYMBOL[lower];")
lines.append("  for (const [name, sym] of Object.entries(NAME_TO_SYMBOL)) {")
lines.append("    if (name.includes(lower) || lower.includes(name)) return sym;")
lines.append("  }")
lines.append("  for (const [sym, name] of Object.entries(SYMBOL_NAMES)) {")
lines.append("    if (name.toLowerCase().includes(lower)) return sym;")
lines.append("  }")
lines.append("  // Allow any plausible ticker even if not in the static map")
lines.append("  if (/^[A-Z][A-Z0-9.\\-]{0,6}$/.test(upper)) return upper;")
lines.append("  return null;")
lines.append("}")
lines.append("")

out = ROOT / "frontend/src/lib/news-tickers.ts"
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {out} with {len(names)} symbols and {len(seen)} name keys")
