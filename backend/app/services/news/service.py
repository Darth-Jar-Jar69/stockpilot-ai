import httpx

from app.core.config import settings
from app.core.exceptions import MarketDataError
from app.schemas.research import NewsArticle, NewsStockMention
from app.services.news.enrichment import enrich_article_stocks, extract_tickers
from datetime import datetime


async def fetch_market_news(symbol: str | None = None, limit: int = 15) -> list[NewsArticle]:
    if not settings.news_api_key:
        raise MarketDataError(
            "News API not configured. Set NEWS_API_KEY in backend/.env.",
            code="missing_key",
        )

    params: dict[str, str | int] = {
        "apiKey": settings.news_api_key,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": limit,
    }
    if symbol:
        params["q"] = f"{symbol.upper()} stock"
        url = "https://newsapi.org/v2/everything"
    else:
        params["category"] = "business"
        params["country"] = "us"
        url = "https://newsapi.org/v2/top-headlines"

    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
            res = await client.get(url, params=params)
            res.raise_for_status()
            data = res.json()
    except Exception as exc:
        raise MarketDataError(f"News fetch failed: {exc}", code="unavailable") from exc

    raw_items = data.get("articles", [])[:limit]
    articles: list[NewsArticle] = []

    for item in raw_items:
        published = None
        if item.get("publishedAt"):
            try:
                published = datetime.fromisoformat(item["publishedAt"].replace("Z", "+00:00"))
            except ValueError:
                published = None

        title = item.get("title") or "Untitled"
        summary = item.get("description") or item.get("content", "")[:280]
        text_blob = f"{title} {summary or ''}"
        symbols = extract_tickers(text_blob)
        if symbol and symbol.upper() not in symbols:
            symbols = [symbol.upper(), *symbols]

        stock_data = await enrich_article_stocks(symbols)
        related = [NewsStockMention(**s) for s in stock_data]

        articles.append(
            NewsArticle(
                title=title,
                source=(item.get("source") or {}).get("name"),
                url=item.get("url"),
                published_at=published,
                summary=summary,
                image_url=item.get("urlToImage"),
                symbols=symbols,
                related_stocks=related,
            )
        )

    return articles
