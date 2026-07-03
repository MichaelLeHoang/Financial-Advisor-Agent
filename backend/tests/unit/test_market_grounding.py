from types import MethodType, SimpleNamespace


def _snapshot(
    *,
    ticker: str = "SPCX",
    company_name: str = "SpaceX",
    price: float | None = 185.0,
    latest_trade: str = "Jun 19, 2026",
):
    return SimpleNamespace(
        ticker=ticker,
        company_name=company_name,
        latest_price=price,
        currency="USD",
        exchange="NASDAQ",
        daily_change=1.25,
        data_sources=["mock_market_quote"],
        history=[SimpleNamespace(label=latest_trade, price=price or 0)],
        history_frame=None,
    )


def test_space_x_stock_today_resolves_to_spcx_when_market_search_returns_spcx(monkeypatch):
    import src.agent.market_grounding as market_grounding

    search_calls = []
    quote_calls = []

    def fake_search(query, limit):
        search_calls.append((query, limit))
        return [
            {
                "ticker": "SPCX",
                "name": "SpaceX",
                "exchange": "NASDAQ",
                "quote_type": "Equity",
            }
        ]

    def fake_snapshot(ticker, *args, **kwargs):
        quote_calls.append((ticker, kwargs))
        return _snapshot(ticker=ticker)

    monkeypatch.setattr(market_grounding.market_data_service, "search_symbols", fake_search)
    monkeypatch.setattr(market_grounding.market_data_service, "fetch_snapshot", fake_snapshot)

    result = market_grounding.ground_market_query("what is space x stock today")

    assert result.handled is True
    assert result.quote is not None
    assert result.quote.ticker == "SPCX"
    assert "SpaceX appears to trade as SPCX" in result.response
    assert "Latest available quote: $185.00 USD" in result.response
    assert "Latest trade: Jun 19, 2026" in result.response
    assert search_calls == [("SpaceX", 8)]
    assert quote_calls[0][0] == "SPCX"


def test_spacex_stock_today_calls_market_tools_before_final_answer(monkeypatch):
    import src.agent.market_grounding as market_grounding
    from src.agent.agent import FinancialAdvisorAgent

    events = []
    monkeypatch.setattr(
        market_grounding.market_data_service,
        "search_symbols",
        lambda query, limit: [{"ticker": "SPCX", "name": "SpaceX", "exchange": "NASDAQ", "quote_type": "Equity"}],
    )
    monkeypatch.setattr(
        market_grounding.market_data_service,
        "fetch_snapshot",
        lambda ticker, *args, **kwargs: _snapshot(ticker=ticker),
    )

    agent = FinancialAdvisorAgent.__new__(FinancialAdvisorAgent)
    agent._history = []

    def fail_single(self, *args, **kwargs):
        raise AssertionError("single LLM path should not run for simple quote query")

    agent._chat_single = MethodType(fail_single, agent)

    response = agent.chat("SpaceX stock today", progress_callback=events.append)

    assert "SPCX" in response
    assert [event["active_tool"] for event in events[:2]] == ["market_search", "market_quote"]
    assert "Source/tool used: market_search, market_quote" in response


def test_no_public_symbol_response_only_after_market_search_returns_empty(monkeypatch):
    import src.agent.market_grounding as market_grounding

    monkeypatch.setattr(market_grounding.market_data_service, "search_symbols", lambda query, limit: [])

    result = market_grounding.ground_market_query("is Space Exploration Technologies public")

    assert result.handled is True
    assert "could not find a public market quote for SpaceX" in result.response
    assert "may be private" in result.response
    assert "Source/tool used: market_search" in result.response


def test_quote_questions_use_fast_quote_flow_even_when_consensus_mode_requested(monkeypatch):
    import src.agent.market_grounding as market_grounding
    from src.agent.agent import FinancialAdvisorAgent

    monkeypatch.setattr(
        market_grounding.market_data_service,
        "search_symbols",
        lambda query, limit: [{"ticker": "SPCX", "name": "SpaceX", "exchange": "NASDAQ", "quote_type": "Equity"}],
    )
    monkeypatch.setattr(
        market_grounding.market_data_service,
        "fetch_snapshot",
        lambda ticker, *args, **kwargs: _snapshot(ticker=ticker),
    )

    agent = FinancialAdvisorAgent.__new__(FinancialAdvisorAgent)
    agent._history = []

    def fail_consensus(self, *args, **kwargs):
        raise AssertionError("consensus path should not run for simple quote query")

    agent._chat_consensus = MethodType(fail_consensus, agent)

    response = agent.chat("what is space x stock today", mode="consensus")

    assert "Latest available quote" in response
    assert "SPCX" in response


def test_deep_questions_still_use_quanad_consensus():
    from src.agent.agent import FinancialAdvisorAgent

    agent = FinancialAdvisorAgent.__new__(FinancialAdvisorAgent)
    agent._history = []

    def fake_consensus(self, message, remember, progress_callback=None):
        return "Quanfora 2.0 consensus response"

    def fail_single(self, *args, **kwargs):
        raise AssertionError("single path should not run for auto consensus query")

    agent._chat_consensus = MethodType(fake_consensus, agent)
    agent._chat_single = MethodType(fail_single, agent)

    assert agent.chat("Should I invest in SpaceX?", mode="auto") == "Quanfora 2.0 consensus response"
