from __future__ import annotations

from math import isfinite
from typing import Mapping


UNAVAILABLE_VALUATION = {
    "valuation_status": "unavailable",
    "valuation_target": None,
    "target_price": None,
    "implied_upside": None,
    "valuation_signal": None,
}


def calculate_valuation_target(
    *,
    current_price: object,
    forward_eps: object,
    fair_pe_multiple: object,
) -> dict[str, float | str | None]:
    price = _positive_float(current_price)
    eps = _positive_float(forward_eps)
    pe = _positive_float(fair_pe_multiple)
    if price is None or eps is None or pe is None:
        return dict(UNAVAILABLE_VALUATION)

    target_price = round(eps * pe, 4)
    implied_upside = round((target_price - price) / price, 6)
    return {
        "valuation_status": "available",
        "valuation_target": target_price,
        "target_price": target_price,
        "implied_upside": implied_upside,
        "valuation_signal": classify_valuation_signal(implied_upside),
    }


def build_valuation_payload(
    *,
    current_price: object,
    fundamentals: Mapping[str, object] | None,
) -> dict[str, float | str | None]:
    data = fundamentals or {}
    forward_pe = _first_present(data, "forward_pe", "forwardPE")
    fair_pe_multiple = _first_present(
        data,
        "fair_pe_multiple",
        "fairPeMultiple",
    )
    if fair_pe_multiple is None:
        fair_pe_multiple = forward_pe
    forward_eps = _first_present(
        data,
        "forward_eps",
        "forwardEps",
        "forwardEPS",
    )

    if _positive_float(forward_eps) is None:
        price = _positive_float(current_price)
        pe = _positive_float(forward_pe)
        if price is not None and pe is not None:
            forward_eps = price / pe

    return calculate_valuation_target(
        current_price=current_price,
        forward_eps=forward_eps,
        fair_pe_multiple=fair_pe_multiple,
    )


def classify_valuation_signal(implied_upside: object) -> str | None:
    upside = _float(implied_upside)
    if upside is None:
        return None
    if upside > 0.15:
        return "Undervalued"
    if upside < -0.10:
        return "Overvalued"
    return "Fairly Valued"


def combine_ml_and_valuation_signal(ml_direction: object, valuation_signal: object) -> str:
    direction = str(ml_direction or "").upper()
    signal = str(valuation_signal or "")
    if direction == "UP" and signal == "Undervalued":
        return "Strong Bullish"
    if direction == "UP" and signal == "Fairly Valued":
        return "Bullish"
    if direction == "DOWN" and signal == "Overvalued":
        return "Bearish"
    if direction == "DOWN" and signal == "Undervalued":
        return "Mixed / Hold"
    return "Neutral"


def _first_present(data: Mapping[str, object], *keys: str) -> object | None:
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return None


def _positive_float(value: object) -> float | None:
    number = _float(value)
    if number is None or number <= 0:
        return None
    return number


def _float(value: object) -> float | None:
    if isinstance(value, str):
        value = value.strip()
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if isfinite(number) else None
