from types import MethodType

from src.data.market_data_service import (
    EvidenceItem,
    NormalizedMarketSnapshot,
    NormalizedNewsItem,
)


def test_freshness_policy_targets_market_questions_not_platform_help():
    from src.agent.current_market_context import requires_fresh_evidence

    assert requires_fresh_evidence("What happened to Sandisk recently?")[0] is True
    assert requires_fresh_evidence("Should I buy NVDA?")[0] is True
    assert requires_fresh_evidence("What is the latest market news?")[0] is True
    assert requires_fresh_evidence("How do I use the research mode?")[0] is False


def test_sandisk_is_resolved_at_runtime_to_current_sndk_identity(monkeypatch):
    from src.agent import current_market_context

    monkeypatch.setattr(
        current_market_context.market_data_service,
        "search_symbols",
        lambda query, limit: [
            {
                "ticker": "SNDK",
                "name": "Sandisk Corporation",
                "exchange": "NASDAQ",
                "quote_type": "Common Stock",
            }
        ],
    )

    def fake_snapshot(ticker, *args, **kwargs):
        assert ticker == "SNDK"
        return NormalizedMarketSnapshot(
            ticker="SNDK",
            company_name="Sandisk Corporation",
            exchange="NASDAQ",
            currency="USD",
            latest_price=54.25,
            quote_timestamp="2026-07-21T19:45:00+00:00",
            daily_change=1.4,
            data_sources=["finnhub_quote", "sec_edgar_submissions"],
            filing_context={
                "recent_filings": [
                    {"form": "8-K", "filing_date": "2026-07-18", "accession": "test"}
                ]
            },
            news_items=[
                NormalizedNewsItem(
                    title="Sandisk announces current company update",
                    publisher="Sandisk",
                    url="https://example.com/sandisk-update",
                    published_at="2026-07-18T12:00:00+00:00",
                    source="Issuer",
                )
            ],
            evidence_items=[
                EvidenceItem(
                    label="SEC filing history",
                    source="SEC EDGAR",
                    url="https://data.sec.gov/submissions/CIK0000200406.json",
                    timestamp="2026-07-18",
                )
            ],
            source_quality={"generated_at": "2026-07-21T19:45:01+00:00", "limitations": []},
        )

    monkeypatch.setattr(current_market_context.market_data_service, "fetch_snapshot", fake_snapshot)

    context = current_market_context.build_current_market_context(
        "What happened to Sandisk recently?"
    )

    assert context.status == "grounded"
    assert context.entity == "Sandisk"
    assert context.ticker == "SNDK"
    assert context.company_name == "Sandisk Corporation"
    assert context.as_of == "2026-07-21T19:45:00+00:00"
    assert context.metadata()["grounding"]["sources"][0]["source"] == "SEC EDGAR"
    prompt_block = context.prompt_block()
    assert "takes precedence over model memory" in prompt_block
    assert "Ticker: SNDK" in prompt_block
    assert "https://example.com/sandisk-update" in prompt_block


def test_current_context_fails_closed_when_entity_cannot_be_verified(monkeypatch):
    from src.agent import current_market_context

    monkeypatch.setattr(
        current_market_context.market_data_service, "search_symbols", lambda query, limit: []
    )

    context = current_market_context.build_current_market_context(
        "What happened to Unknown Devices recently?"
    )

    assert context.status == "unavailable"
    assert "Do not answer current market" in context.prompt_block()
    assert "No current public-market identity" in context.limitations[0]


def test_non_market_prompt_does_not_call_providers(monkeypatch):
    from src.agent import current_market_context

    monkeypatch.setattr(
        current_market_context.market_data_service,
        "fetch_snapshot",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("provider should not be called")
        ),
    )

    context = current_market_context.build_current_market_context(
        "Explain percentage compounding"
    )

    assert context.status == "not_required"


def test_agent_injects_grounding_before_reasoning_and_returns_metadata():
    from src.agent.agent import FinancialAdvisorAgent
    from src.agent.current_market_context import CurrentMarketContext, GroundingSource

    context = CurrentMarketContext(
        required=True,
        status="grounded",
        retrieved_at="2026-07-21T19:45:01+00:00",
        entity="Sandisk",
        ticker="SNDK",
        company_name="Sandisk Corporation",
        as_of="2026-07-21T19:45:00+00:00",
        facts={"latest_price": 54.25},
        sources=[GroundingSource("SEC filing history", "SEC EDGAR", "https://example.com/sec")],
    )
    agent = FinancialAdvisorAgent.__new__(FinancialAdvisorAgent)
    agent._market_context_builder = lambda message: context
    seen = {}

    def fake_chat_single(self, message, remember, progress_callback=None, market_context=None):
        seen["message"] = message
        seen["market_context"] = market_context
        return "Sandisk currently trades as SNDK."

    agent._chat_single = MethodType(fake_chat_single, agent)

    response = agent.chat("What happened to Sandisk recently?", remember=False, mode="single")

    assert response == "Sandisk currently trades as SNDK."
    assert seen["market_context"] is context
    assert agent.last_response_metadata["grounding"]["ticker"] == "SNDK"
    assert agent.last_response_metadata["grounding"]["status"] == "grounded"
