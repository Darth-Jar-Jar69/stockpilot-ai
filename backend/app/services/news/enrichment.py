import re

from app.services.market_data.service import market_data_service
from app.services.scanner.symbol_names import KNOWN_TICKERS, SYMBOL_NAMES

_TICKER_RE = re.compile(r"\$?([A-Z]{1,5})\b")

_NAME_TO_SYMBOL: dict[str, str] = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "nvidia": "NVDA",
    "meta": "META",
    "tesla": "TSLA",
    "dell": "DELL",
    "netflix": "NFLX",
    "intel": "INTC",
    "disney": "DIS",
    "walmart": "WMT",
    "asml": "ASML",
    "ferrari": "RACE",
    "toyota": "TM",
    "alibaba": "BABA",
    "novo nordisk": "NVO",
    "unilever": "UL",
    "shopify": "SHOP",
    "stellantis": "STLA",
}


def extract_tickers(text: str) -> list[str]:
    if not text:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for match in _TICKER_RE.finditer(text.upper()):
        sym = match.group(1)
        if sym in KNOWN_TICKERS and sym not in seen:
            seen.add(sym)
            found.append(sym)
    lower = text.lower()
    for name, sym in _NAME_TO_SYMBOL.items():
        if name in lower and sym not in seen:
            seen.add(sym)
            found.append(sym)
    return found[:6]


async def enrich_article_stocks(symbols: list[str]) -> list[dict]:
    mentions: list[dict] = []
    for sym in symbols:
        price = None
        change_percent = None
        try:
            quote = await market_data_service.get_quote(sym)
            price = quote.price
            change_percent = quote.change_percent
        except Exception:
            pass
        mentions.append(
            {
                "symbol": sym,
                "company_name": SYMBOL_NAMES.get(sym),
                "price": price,
                "change_percent": change_percent,
            }
        )
    return mentions
