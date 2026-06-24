import pytest


def test_valuation_target_and_upside_are_calculated():
    from src.ml.valuation import calculate_valuation_target

    result = calculate_valuation_target(current_price=100, forward_eps=6, fair_pe_multiple=20)

    assert result["valuation_status"] == "available"
    assert result["valuation_target"] == pytest.approx(120)
    assert result["target_price"] == pytest.approx(120)
    assert result["implied_upside"] == pytest.approx(0.2)
    assert result["valuation_signal"] == "Undervalued"


@pytest.mark.parametrize(
    ("current_price", "forward_eps", "fair_pe_multiple"),
    [
        (0, 6, 20),
        (-100, 6, 20),
        (100, 0, 20),
        (100, 6, -20),
        (float("nan"), 6, 20),
        (100, float("inf"), 20),
        ("not-a-number", 6, 20),
    ],
)
def test_valuation_target_rejects_non_positive_or_non_finite_inputs(
    current_price,
    forward_eps,
    fair_pe_multiple,
):
    from src.ml.valuation import calculate_valuation_target

    result = calculate_valuation_target(
        current_price=current_price,
        forward_eps=forward_eps,
        fair_pe_multiple=fair_pe_multiple,
    )

    assert result == {
        "valuation_status": "unavailable",
        "valuation_target": None,
        "target_price": None,
        "implied_upside": None,
        "valuation_signal": None,
    }


@pytest.mark.parametrize(
    ("implied_upside", "signal"),
    [
        (0.151, "Undervalued"),
        (0.15, "Fairly Valued"),
        (-0.10, "Fairly Valued"),
        (-0.101, "Overvalued"),
    ],
)
def test_valuation_signal_thresholds(implied_upside, signal):
    from src.ml.valuation import classify_valuation_signal

    assert classify_valuation_signal(implied_upside) == signal


@pytest.mark.parametrize(
    "fundamentals",
    [
        {},
        {"forward_eps": None, "fair_pe_multiple": 18},
        {"forward_eps": 5, "fair_pe_multiple": None},
        {"forward_eps": 5, "fair_pe_multiple": 18},
    ],
)
def test_valuation_payload_handles_missing_or_derivable_inputs(fundamentals):
    from src.ml.valuation import build_valuation_payload

    result = build_valuation_payload(current_price=100, fundamentals=fundamentals)

    if fundamentals.get("forward_eps") and fundamentals.get("fair_pe_multiple"):
        assert result["valuation_status"] == "available"
    else:
        assert result["valuation_status"] == "unavailable"
        assert result["valuation_target"] is None
        assert result["implied_upside"] is None
        assert result["valuation_signal"] is None


def test_valuation_payload_derives_forward_eps_from_forward_pe():
    from src.ml.valuation import build_valuation_payload

    result = build_valuation_payload(current_price=100, fundamentals={"forward_pe": 20})

    assert result["valuation_status"] == "available"
    assert result["valuation_target"] == pytest.approx(100)
    assert result["implied_upside"] == pytest.approx(0)
    assert result["valuation_signal"] == "Fairly Valued"


@pytest.mark.parametrize(
    ("ml_direction", "valuation_signal", "final_signal"),
    [
        ("UP", "Undervalued", "Strong Bullish"),
        ("UP", "Fairly Valued", "Bullish"),
        ("DOWN", "Overvalued", "Bearish"),
        ("DOWN", "Undervalued", "Mixed / Hold"),
        ("NEUTRAL", "Undervalued", "Neutral"),
        ("DOWN", "Fairly Valued", "Neutral"),
    ],
)
def test_final_signal_combinations(ml_direction, valuation_signal, final_signal):
    from src.ml.valuation import combine_ml_and_valuation_signal

    assert combine_ml_and_valuation_signal(ml_direction, valuation_signal) == final_signal


def test_final_signal_normalizes_ml_direction_case():
    from src.ml.valuation import combine_ml_and_valuation_signal

    assert combine_ml_and_valuation_signal(" up ", "Undervalued") == "Strong Bullish"
