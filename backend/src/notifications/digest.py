import json
from datetime import date, datetime, time, timedelta, timezone
from html import escape
from typing import Any
from urllib.request import Request, urlopen
from uuid import UUID
from zoneinfo import ZoneInfo

from src.config import settings
from src.services.news_fetcher import fetch_yfinance_news


def next_digest_run(timezone_name: str, local_time: str, now: datetime | None = None) -> datetime:
    current = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo(timezone_name))
    hour, minute = (int(part) for part in local_time.split(":"))
    candidate = datetime.combine(current.date(), time(hour, minute), tzinfo=current.tzinfo)
    if candidate <= current:
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc)


def local_digest_date(timezone_name: str, now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(ZoneInfo(timezone_name)).date()


def collect_digest_articles(store: Any, user_id: UUID, max_symbols: int) -> dict[str, Any]:
    watchlist_symbols = store.list_user_watchlist_symbols(user_id, limit=min(max_symbols, 20))
    source_symbols = watchlist_symbols or settings.default_news_tickers[:8]
    documents = fetch_yfinance_news(source_symbols)
    articles = [
        {
            "title": document.metadata.title or document.content.splitlines()[0],
            "summary": "\n".join(document.content.splitlines()[1:]).strip(),
            "url": document.metadata.url,
            "source": document.metadata.source,
            "symbols": document.metadata.tickers,
            "published_at": document.metadata.published_at.isoformat() if document.metadata.published_at else None,
        }
        for document in documents[:12]
    ]
    return {
        "articles": articles,
        "source_symbols": source_symbols,
        "is_personalized": bool(watchlist_symbols),
    }


def deterministic_digest_summary(payload: dict[str, Any]) -> dict[str, Any]:
    articles = payload.get("articles", [])
    lead = (
        "Here are the developments most closely connected to your watchlists."
        if payload.get("is_personalized")
        else "Your watchlists are empty, so today’s edition covers the broader market."
    )
    return {
        "headline": "Your daily market brief",
        "overview": lead,
        "items": [
            {
                "title": article["title"],
                "takeaway": article.get("summary") or "Open the source for the latest details.",
                "url": article.get("url"),
                "symbols": article.get("symbols", []),
            }
            for article in articles[:6]
        ],
    }


def ai_digest_prompt(payload: dict[str, Any]) -> str:
    return (
        "Create a concise daily financial-news digest from the JSON below. Return valid JSON only with "
        "headline, overview, and items. Each item must have title, takeaway, url, and symbols. Keep at most "
        "6 items, retain the supplied URLs, avoid investment advice, and clearly distinguish facts from "
        f"interpretation. Source JSON: {json.dumps(payload, default=str)}"
    )


def parse_ai_digest(response: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    candidates: list[Any] = [response]
    candidates.extend(response.get(key) for key in ("output", "content", "text") if response.get(key) is not None)
    for candidate in response.get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            if part.get("text"):
                candidates.append(part["text"])
    for candidate in candidates:
        if isinstance(candidate, dict) and isinstance(candidate.get("items"), list):
            return candidate
        if isinstance(candidate, str):
            cleaned = candidate.strip().removeprefix("```json").removesuffix("```").strip()
            try:
                decoded = json.loads(cleaned)
            except json.JSONDecodeError:
                continue
            if isinstance(decoded, dict) and isinstance(decoded.get("items"), list):
                return decoded
    return fallback


def render_digest_html(summary: dict[str, Any], *, settings_url: str) -> str:
    item_markup = "".join(
        f'''<li style="margin:0 0 18px"><strong>{escape(str(item.get("title", "Market update")))}</strong>
        <p style="margin:6px 0;color:#4b5563;line-height:1.55">{escape(str(item.get("takeaway", "")))}</p>
        {f'<a href="{escape(str(item["url"]), quote=True)}" style="color:#4f46e5">Read source</a>' if item.get("url") else ''}</li>'''
        for item in summary.get("items", [])[:6]
    )
    return f'''<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <main style="max-width:640px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:28px">
    <p style="margin:0 0 8px;color:#6366f1;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Quanfora Daily</p>
    <h1 style="margin:0 0 12px;font-size:28px">{escape(str(summary.get("headline", "Your daily market brief")))}</h1>
    <p style="color:#52525b;line-height:1.6">{escape(str(summary.get("overview", "")))}</p><ul style="padding-left:20px">{item_markup}</ul>
    <p style="margin-top:28px;border-top:1px solid #e4e4e7;padding-top:18px;color:#71717a;font-size:12px;line-height:1.5">News summaries are informational, may be delayed, and are not investment advice. <a href="{escape(settings_url, quote=True)}" style="color:#4f46e5">Manage email preferences</a>.</p>
    </div></main></body></html>'''


def send_resend_email(*, to_email: str, subject: str, html: str, idempotency_key: str) -> str:
    api_key = settings.secret_value("resend_api_key")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")
    body = json.dumps({
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
        "headers": {"List-Unsubscribe": f"<{settings.frontend_url}/settings>"},
    }).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency_key,
        },
    )
    with urlopen(request, timeout=20) as response:
        result = json.loads(response.read().decode("utf-8"))
    return str(result.get("id", ""))
