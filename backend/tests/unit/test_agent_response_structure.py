def test_single_agent_prompt_requires_reader_facing_sections():
    from src.agent.agent import SYSTEM_PROMPT

    assert "Current Snapshot" in SYSTEM_PROMPT
    assert "Driving Catalysts" in SYSTEM_PROMPT
    assert "Current Tape" in SYSTEM_PROMPT
    assert "Practical Takeaway" in SYSTEM_PROMPT


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
