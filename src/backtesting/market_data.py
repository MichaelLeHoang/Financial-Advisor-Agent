from datetime import date
from typing import Protocol

import pandas as pd
import yfinance as yf


class MarketDataAdapter(Protocol):
    def fetch_prices(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        """Return adjusted close prices indexed by date for each symbol."""


class YFinanceMarketDataAdapter:
    """Development-only market data adapter.

    yfinance is useful for local iteration but should be replaced by a licensed
    market data provider before this SaaS charges for production backtests.
    """

    def fetch_prices(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        result: dict[str, pd.Series] = {}
        for symbol in symbols:
            history = yf.Ticker(symbol).history(
                start=start_date.isoformat(),
                end=end_date.isoformat(),
                auto_adjust=True,
                interval="1d",
            )
            if history.empty or "Close" not in history:
                continue
            closes = history["Close"].dropna()
            if not closes.empty:
                result[symbol] = closes
        return result


class StaticMarketDataAdapter:
    def __init__(self, prices: dict[str, pd.Series]) -> None:
        self._prices = prices

    def fetch_prices(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        return {symbol: self._prices[symbol] for symbol in symbols if symbol in self._prices}
