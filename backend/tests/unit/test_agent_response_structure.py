def test_single_agent_prompt_requires_reader_facing_sections():
    from src.agent.agent import SYSTEM_PROMPT

    assert "Current Stock Price" in SYSTEM_PROMPT
    assert "Market Overall" in SYSTEM_PROMPT
    assert "Recent News and Sentiment" in SYSTEM_PROMPT
    assert "Stock Prediction" in SYSTEM_PROMPT
    assert "Model Performance (Validation summary)" in SYSTEM_PROMPT
    assert "Conclusion" in SYSTEM_PROMPT
    assert "Driving Catalysts" in SYSTEM_PROMPT
    assert "Current Tape" in SYSTEM_PROMPT
    assert "Practical Takeaway" in SYSTEM_PROMPT


def test_single_agent_prompt_preserves_detailed_structure():
    from src.agent.agent import SYSTEM_PROMPT

    assert "markdown bold labels" in SYSTEM_PROMPT
    assert "Always use this order for direct decision prompts" in SYSTEM_PROMPT
    assert "`**Current Stock Price:**`" in SYSTEM_PROMPT
    assert "`**Recent News and Sentiment:**`" in SYSTEM_PROMPT
    assert "`**Stock Prediction:**`" in SYSTEM_PROMPT
    assert "`**Conclusion:**`" in SYSTEM_PROMPT
    assert "do NOT replace the existing detailed stock-analysis structure" in SYSTEM_PROMPT
    assert "one long paragraph" in SYSTEM_PROMPT
    assert "Enhance it with clearer verdict/catalyst/risk formatting" in SYSTEM_PROMPT


def test_single_agent_prompt_requires_decision_section_order():
    from src.agent.agent import SYSTEM_PROMPT

    ordered_sections = [
        "First sentence: direct verdict",
        "`**Current Stock Price:**`",
        "`**Market Overall:**`",
        "`**Recent News and Sentiment:**`",
        "`**Stock Prediction:**`",
        "`**Model Performance (Validation summary):**`",
        "`**Conclusion:**`",
        "Final line: exact disclaimer from rule 8",
    ]

    positions = [SYSTEM_PROMPT.index(section) for section in ordered_sections]

    assert positions == sorted(positions)


def test_follow_up_context_resolves_prior_ticker():
    from src.agent.agent import _contextualize_follow_up

    history = [
        {"role": "user", "content": "Should I buy MU?"},
        {"role": "assistant", "content": "Quanfora 2.0 Consensus Report: MU"},
    ]

    contextualized = _contextualize_follow_up(
        "So should I buy more the stock right now?", history
    )

    assert "the stock refers to MU" in contextualized


def test_follow_up_context_does_not_override_explicit_ticker():
    from src.agent.agent import _contextualize_follow_up

    history = [{"role": "user", "content": "Should I buy MU?"}]

    assert (
        _contextualize_follow_up("Should I buy more NVDA?", history)
        == "Should I buy more NVDA?"
    )
