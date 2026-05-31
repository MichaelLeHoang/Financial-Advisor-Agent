"""
News API — Fetch financial news from Yahoo Finance organized by category.

Categories map to sector ETFs and representative tickers so users can
follow market segments they care about (up to 3 at a time).
"""

from __future__ import annotations

import hashlib
from datetime import datetime

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["news"])

# ── Category → ticker/query mapping ────────────────────────────────────

CATEGORY_MAP: dict[str, dict] = {
    "market": {
        "label": "Market Overview",
        "queries": ["stock market today", "S&P 500", "Wall Street"],
        "tickers": ["^GSPC", "^DJI", "^IXIC", "SPY"],
    },
    "technology": {
        "label": "Technology",
        "queries": ["technology stocks"],
        "tickers": ["XLK", "AAPL", "MSFT", "GOOGL"],
    },
    "crypto": {
        "label": "Crypto",
        "queries": ["cryptocurrency", "bitcoin"],
        "tickers": ["BTC-USD", "ETH-USD"],
    },
    "energy": {
        "label": "Energy",
        "queries": ["energy stocks oil"],
        "tickers": ["XLE", "XOM", "CVX"],
    },
    "healthcare": {
        "label": "Healthcare",
        "queries": ["healthcare stocks pharma"],
        "tickers": ["XLV", "JNJ", "UNH"],
    },
    "financials": {
        "label": "Financials",
        "queries": ["financial stocks banking"],
        "tickers": ["XLF", "JPM", "BAC"],
    },
    "ai_semiconductors": {
        "label": "AI & Semiconductors",
        "queries": ["artificial intelligence semiconductors"],
        "tickers": ["NVDA", "AMD", "AVGO", "SMH"],
    },
    "consumer": {
        "label": "Consumer",
        "queries": ["consumer spending retail"],
        "tickers": ["XLY", "AMZN", "TSLA"],
    },
}


# ── Response models ─────────────────────────────────────────────────────

class NewsArticle(BaseModel):
    id: str
    title: str
    summary: str = ""
    publisher: str = "Unknown"
    published_at: str | None = None
    url: str = ""
    thumbnail: str | None = None
    tickers: list[str] = []
    category: str = ""


class NewsResponse(BaseModel):
    articles: list[NewsArticle]
    categories_fetched: list[str]
    total: int


class CategoryInfo(BaseModel):
    key: str
    label: str


# ── Helpers ──────────────────────────────────────────────────────────────

def _article_id(title: str, publisher: str) -> str:
    raw = f"{publisher}:{title}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _parse_search_news(items: list[dict], category: str) -> list[NewsArticle]:
    """Parse news items returned by yf.Search().news"""
    articles: list[NewsArticle] = []
    for item in items:
        title = item.get("title", "")
        if not title:
            continue

        publisher = item.get("publisher", "Unknown")
        link = item.get("link", "")
        pub_date = item.get("providerPublishTime")
        thumbnail = None

        # Try to extract thumbnail
        if item.get("thumbnail"):
            resolutions = item["thumbnail"].get("resolutions", [])
            if resolutions:
                thumbnail = resolutions[-1].get("url")

        published_str = None
        if pub_date:
            try:
                if isinstance(pub_date, (int, float)):
                    published_str = datetime.fromtimestamp(pub_date).isoformat()
                else:
                    published_str = str(pub_date)
            except Exception:
                pass

        related_tickers = [t.get("symbol", "") for t in item.get("relatedTickers", []) if t.get("symbol")]

        articles.append(
            NewsArticle(
                id=_article_id(title, publisher),
                title=title,
                summary="",
                publisher=publisher,
                published_at=published_str,
                url=link,
                thumbnail=thumbnail,
                tickers=related_tickers,
                category=category,
            )
        )
    return articles


def _parse_ticker_news(items: list[dict], category: str, ticker_symbol: str) -> list[NewsArticle]:
    """Parse news items returned by yf.Ticker().news"""
    articles: list[NewsArticle] = []
    for item in items:
        content = item.get("content", item)

        title = content.get("title", "")
        if not title:
            continue

        publisher = "Unknown"
        provider = content.get("provider")
        if isinstance(provider, dict):
            publisher = provider.get("displayName", "Unknown")
        elif isinstance(provider, str):
            publisher = provider

        link = content.get("previewUrl", "")
        canonical = content.get("canonicalUrl")
        if isinstance(canonical, dict):
            link = canonical.get("url", link)

        summary = content.get("summary", "")
        pub_date = content.get("pubDate")

        thumbnail = None
        thumb_data = content.get("thumbnail")
        if isinstance(thumb_data, dict):
            resolutions = thumb_data.get("resolutions", [])
            if resolutions:
                thumbnail = resolutions[-1].get("url")

        published_str = None
        if pub_date:
            try:
                published_str = datetime.fromisoformat(
                    pub_date.replace("Z", "+00:00")
                ).isoformat()
            except Exception:
                published_str = str(pub_date)

        articles.append(
            NewsArticle(
                id=_article_id(title, publisher),
                title=title,
                summary=summary,
                publisher=publisher,
                published_at=published_str,
                url=link,
                thumbnail=thumbnail,
                tickers=[ticker_symbol],
                category=category,
            )
        )
    return articles


# ── Routes ───────────────────────────────────────────────────────────────

@router.get("/news/categories", response_model=list[CategoryInfo])
async def list_categories():
    """List all available news categories."""
    return [
        CategoryInfo(key=key, label=cfg["label"])
        for key, cfg in CATEGORY_MAP.items()
    ]


@router.get("/news", response_model=NewsResponse)
async def get_news(
    categories: str = Query(
        default="market",
        description="Comma-separated category keys (e.g. 'technology,crypto'). Max 3.",
    ),
    limit: int = Query(default=20, ge=1, le=50),
):
    """
    Fetch financial news for the given categories.

    Each category maps to sector ETFs / representative tickers.  News is
    fetched via yfinance, deduplicated, and returned sorted by date.
    """
    requested = [c.strip().lower() for c in categories.split(",") if c.strip()][:3]
    valid = [c for c in requested if c in CATEGORY_MAP]

    if not valid:
        raise HTTPException(status_code=400, detail=f"No valid categories. Choose from: {list(CATEGORY_MAP.keys())}")

    all_articles: list[NewsArticle] = []
    seen_ids: set[str] = set()

    for cat_key in valid:
        cat = CATEGORY_MAP[cat_key]

        # Strategy 1: fetch news from the first 2 tickers in the category
        for ticker_symbol in cat["tickers"][:2]:
            try:
                ticker = yf.Ticker(ticker_symbol)
                raw_news = ticker.news or []
                parsed = _parse_ticker_news(raw_news, cat_key, ticker_symbol)
                for article in parsed:
                    if article.id not in seen_ids:
                        seen_ids.add(article.id)
                        all_articles.append(article)
            except Exception:
                continue

        # Strategy 2: search-based news for broader coverage
        for query in cat.get("queries", [])[:1]:
            try:
                search = yf.Search(query, news_count=8)
                raw_news = search.news or []
                parsed = _parse_search_news(raw_news, cat_key)
                for article in parsed:
                    if article.id not in seen_ids:
                        seen_ids.add(article.id)
                        all_articles.append(article)
            except Exception:
                continue

    # Sort by published_at descending (newest first), nulls last
    all_articles.sort(
        key=lambda a: a.published_at or "0000",
        reverse=True,
    )

    trimmed = all_articles[:limit]

    return NewsResponse(
        articles=trimmed,
        categories_fetched=valid,
        total=len(trimmed),
    )
