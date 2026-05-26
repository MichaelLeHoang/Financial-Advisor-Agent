import yfinance as yf 
from datetime import datetime
import hashlib

from src.models.schemas import FinancialDocument, ChunkMetadata, DocumentType

def _generate_doc_id(title: str, source: str) -> str: 
    """
    Generate a deterministic ID from title + source.
    """

    raw = f"{source}: {title}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def fetch_yfinance_news(tickers: list[str]) -> list[FinancialDocument]:
    """
    Fetch latest news for given tickers from yfinance.
    yfinance provides news headlines and links for free.
    Each news item has: title, link, publisher, publish time.
    """
    documents = []

    for ticker_symbol in tickers: 
        try: 
            ticker = yf.Ticker(ticker_symbol)
            news_items = ticker.news or []

            for item in news_items:
                # yfinance wraps data in 'content' dict
                content_data = item.get("content", item)

                title = content_data.get("title", "")
                publisher = content_data.get("provider", {}).get("displayName", "unknown")
                publish_time_str = content_data.get("pubDate")
                # Get the URL from canonicalUrl or previewUrl
                link = content_data.get("previewUrl", "")
                if content_data.get("canonicalUrl"):
                    link = content_data["canonicalUrl"].get("url", link)

                # Skip items without title 
                if not title:
                    continue

                # Build content from title + summary
                summary = content_data.get("summary", "")
                content = title
                if summary:
                    content += f"\n{summary}"
                # Parse ISO timestamp (e.g., "2026-02-16T01:58:09Z")
                published_at = None
                if publish_time_str:
                    try:
                        published_at = datetime.fromisoformat(
                            publish_time_str.replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass
                
                doc_id = _generate_doc_id(title, publisher)

                documents.append(FinancialDocument(
                    id=doc_id,
                    content=content,
                    metadata=ChunkMetadata(
                        source="yfinance",
                        document_type=DocumentType.NEWS,
                        tickers=[ticker_symbol],
                        published_at=published_at,
                        url=link,
                        title=title,
                    )
                ))
        except Exception as e:
            print(f"Error fetching news for {ticker_symbol}: {e}")
            continue

    # Deduplicate by ID (same article might appear for multiple tickers)
    seen_ids = set()
    unique_docs = []
    for doc in documents:
        if doc.id not in seen_ids:
            seen_ids.add(doc.id)
            unique_docs.append(doc)
    print(f"Fetched {len(unique_docs)} unique news articles for {tickers}")
    return unique_docs


