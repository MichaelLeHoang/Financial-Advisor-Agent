from datetime import datetime, timedelta, timezone
from typing import Protocol

import yfinance as yf

from src.saas.models import AlertEventCreate, AlertRead
from src.saas.repository import get_store


class PriceProvider(Protocol):
    def latest_price(self, symbol: str) -> float:
        """Return the latest known market price for a symbol."""


class YFinancePriceProvider:
    def latest_price(self, symbol: str) -> float:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        price = info.get("regularMarketPrice") or info.get("currentPrice")
        if price is not None:
            return float(price)
        history = ticker.history(period="5d", interval="1d", auto_adjust=True)
        if history.empty or "Close" not in history:
            raise ValueError(f"No price data returned for {symbol}")
        return float(history["Close"].dropna().iloc[-1])


def evaluate_active_alerts(provider: PriceProvider | None = None) -> dict[str, int]:
    provider = provider or YFinancePriceProvider()
    store = get_store()
    evaluated = 0
    triggered = 0
    for alert in store.list_active_alerts():
        evaluated += 1
        event = evaluate_alert(alert, provider)
        if event is None:
            continue
        store.create_alert_event(event)
        store.update_alert_triggered_at(alert.id, datetime.now(timezone.utc))
        triggered += 1
    return {"evaluated": evaluated, "triggered": triggered}


def evaluate_alert(alert: AlertRead, provider: PriceProvider) -> AlertEventCreate | None:
    if alert.alert_type != "price" or not alert.symbol:
        return None
    if _recently_triggered(alert):
        return None

    value = provider.latest_price(alert.symbol)
    operator = str(alert.condition.get("operator") or "above")
    target = float(alert.condition.get("price"))

    triggered = (operator == "above" and value >= target) or (operator == "below" and value <= target)
    if not triggered:
        return None

    direction = "above" if operator == "above" else "below"
    return AlertEventCreate(
        alert_id=alert.id,
        user_id=alert.user_id,
        alert_type=alert.alert_type,
        symbol=alert.symbol,
        message=f"{alert.symbol} price condition triggered: {value:.2f} is {direction} {target:.2f}.",
        value=value,
        metadata={"operator": operator, "target": target, "channels": [str(channel) for channel in alert.channels]},
    )


def _recently_triggered(alert: AlertRead) -> bool:
    if alert.last_triggered_at is None:
        return False
    return alert.last_triggered_at > datetime.now(timezone.utc) - timedelta(hours=6)
