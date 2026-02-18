import inngest 
from src.jobs.inngest_client import inngest_client
from src.services.ingestion import ingest_news

# Default tickers to track 
DEFAULT_TICKERS = ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "AMZN", "META", "VOO", "QQQ", "VFV"]

@inngest_client.create_function(
    fn_id = "scheduled_news_ingestion",
    trigger = inngest.TriggerCron(
        cron = "0 * * * *" # Every hour
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

    return {"status": "completed", "tickers": tickers,"stats": stats}
    
    