from datetime import datetime, timezone
from uuid import UUID

import inngest
from inngest.experimental.ai.gemini import Adapter as GeminiAdapter
from src.jobs.inngest_client import inngest_client
from src.notifications.evaluator import evaluate_active_alerts
from src.notifications.digest import (
    ai_digest_prompt,
    collect_digest_articles,
    deterministic_digest_summary,
    local_digest_date,
    next_digest_run,
    parse_ai_digest,
    render_digest_html,
    send_resend_email,
)
from src.saas.repository import get_store
from src.services.ingestion import ingest_news
from src.config import settings

# Default tickers to track 
DEFAULT_TICKERS = settings.default_news_tickers

@inngest_client.create_function(
    fn_id = "scheduled_news_ingestion",
    trigger = inngest.TriggerCron(
        cron = settings.news_ingestion_cron
    ),    
)

async def scheduled_new_ingestion(
    ctx: inngest.Context, 
    step: inngest.Step,
) -> dict:
    """
    Scheduled job to fetch and index news articles for a list of tickers. Fetch and ingest news 
    for all tracked tickers every hour.

    """
    # Inngest news
    stats = await step.run(
        "ingest-news", 
        lambda: ingest_news(DEFAULT_TICKERS),
    )

    return{ "status": "completed", "stats": stats}

@inngest_client.create_function(
    fn_id = "on_demand_news_ingestion",
    trigger = inngest.TriggerEvent(event="news/ingest.requested"),
)

async def on_demand_news_ingestion(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    """
    Ingest news for specific tickers when requested.
    Triggered by sending an event:
        inngest_client.send(inngest.Event(
            name="news/ingest.requested",
            data={"tickers": ["AAPL", "TSLA"]}
        ))

    Note: 
         - User adds a new stock to track
         - Manual refresh from the API
    """

    tickers = ctx.event.data.get("tickers", DEFAULT_TICKERS)

    stats = await step.run(
        "ingest-news",
        lambda: ingest_news(tickers),
    )

    return {"status": "completed", "tickers": tickers, "stats": stats}


@inngest_client.create_function(
    fn_id="scheduled_alert_evaluation",
    trigger=inngest.TriggerCron(cron="*/15 * * * *"),
)
async def scheduled_alert_evaluation(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    stats = await step.run("evaluate-alerts", evaluate_active_alerts)
    return {"status": "completed", "stats": stats}


@inngest_client.create_function(
    fn_id="scheduled_news_digest_dispatch",
    trigger=inngest.TriggerCron(cron=settings.news_digest_dispatch_cron),
)
async def scheduled_news_digest_dispatch(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    now = datetime.now(timezone.utc)
    recipients = await step.run(
        "load-due-digest-recipients",
        lambda: [preference.model_dump(mode="json") for preference in get_store().list_due_news_digest_preferences(now)],
    )
    if not recipients:
        return {"status": "completed", "dispatched": 0}
    events = [
        inngest.Event(
            name="news/digest.requested",
            data={
                **recipient,
                "digest_date": local_digest_date(recipient["timezone"], now).isoformat(),
            },
        )
        for recipient in recipients
    ]
    await step.send_event("fan-out-news-digests", events)
    return {"status": "completed", "dispatched": len(events)}


@inngest_client.create_function(
    fn_id="send_daily_news_digest",
    trigger=inngest.TriggerEvent(event="news/digest.requested"),
    retries=4,
    concurrency=[inngest.Concurrency(limit=4)],
)
async def send_daily_news_digest(
    ctx: inngest.Context,
    step: inngest.Step,
) -> dict:
    data = ctx.event.data
    user_id = UUID(str(data["user_id"]))
    digest_date = datetime.fromisoformat(str(data["digest_date"])).date()
    store = get_store()
    claimed = await step.run(
        "claim-digest-delivery",
        lambda: (
            delivery.model_dump(mode="json")
            if (delivery := store.claim_news_digest_delivery(user_id, digest_date))
            else None
        ),
    )
    if claimed is None:
        return {"status": "duplicate", "digest_date": digest_date.isoformat()}

    payload = await step.run(
        "fetch-watchlist-news",
        lambda: collect_digest_articles(store, user_id, int(data.get("max_symbols", 20))),
    )
    fallback = deterministic_digest_summary(payload)
    summary = fallback
    api_key = settings.secret_value("gemini_api_key")
    if api_key and payload["articles"]:
        try:
            response = await step.ai.infer(
                "summarize-digest-news",
                adapter=GeminiAdapter(auth_key=api_key, model="gemini-2.5-flash"),
                body={
                    "contents": [{"role": "user", "parts": [{"text": ai_digest_prompt(payload)}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
                },
            )
            summary = parse_ai_digest(response, fallback)
        except Exception:
            summary = fallback

    subject = f"Quanfora Daily · {digest_date.strftime('%b %d')}"
    html = render_digest_html(summary, settings_url=f"{settings.frontend_url}/settings")
    provider_message_id = await step.run(
        "send-digest-email",
        lambda: send_resend_email(
            to_email=str(data["email"]),
            subject=subject,
            html=html,
            idempotency_key=f"news-digest/{user_id}/{digest_date.isoformat()}",
        ),
    )
    await step.run(
        "record-digest-delivery",
        lambda: store.finish_news_digest_delivery(
            UUID(str(claimed["id"])),
            status="sent",
            source_symbols=payload["source_symbols"],
            article_count=len(payload["articles"]),
            subject=subject,
            provider_message_id=provider_message_id,
        ).model_dump(mode="json"),
    )
    await step.run(
        "advance-digest-schedule",
        lambda: store.advance_news_digest_schedule(
            user_id,
            next_digest_run(str(data["timezone"]), str(data["local_time"]), datetime.now(timezone.utc)),
        ),
    )
    return {"status": "sent", "article_count": len(payload["articles"]), "personalized": payload["is_personalized"]}
