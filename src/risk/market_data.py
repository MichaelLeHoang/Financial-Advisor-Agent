from datetime import date
from typing import Protocol

import pandas as pd
import yfinance as yf


class RiskMarketDataProvider(Protocol):
    def fetch_history(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        ...


class YFinanceRiskDataProvider:
    def fetch_history(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        history: dict[str, pd.Series] = {}
        for symbol in symbols:
            ticker = yf.Ticker(symbol)
            frame = ticker.history(start=start_date.isoformat(), end=end_date.isoformat(), interval="1d")
            if frame.empty or "Close" not in frame:
                continue
            close = frame["Close"].dropna()
            if not close.empty:
                history[symbol.upper()] = close
        return history
