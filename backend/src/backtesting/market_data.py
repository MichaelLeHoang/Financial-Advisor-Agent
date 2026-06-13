from datetime import date
from typing import Protocol

import pandas as pd
import yfinance as yf


OHLC_COLUMNS = ["Open", "High", "Low", "Close"]


class MarketDataAdapter(Protocol):
    def fetch_prices(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        """Return adjusted close prices indexed by date for each symbol."""

    def fetch_ohlc(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.DataFrame]:
        """Return daily OHLC (and Volume when available) indexed by date for each symbol."""


class YFinanceMarketDataAdapter:
    """Development-only market data adapter.

    yfinance is useful for local iteration but should be replaced by a licensed
    market data provider before this SaaS charges for production backtests.
    """

    def fetch_prices(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        result: dict[str, pd.Series] = {}
        for symbol in symbols:
            history = self._history(symbol, start_date, end_date)
            if history.empty or "Close" not in history:
                continue
            closes = history["Close"].dropna()
            if not closes.empty:
                result[symbol] = closes
        return result

    def fetch_ohlc(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.DataFrame]:
        result: dict[str, pd.DataFrame] = {}
        for symbol in symbols:
            history = self._history(symbol, start_date, end_date)
            if history.empty or any(column not in history for column in OHLC_COLUMNS):
                continue
            columns = OHLC_COLUMNS + (["Volume"] if "Volume" in history else [])
            frame = history[columns].dropna(subset=OHLC_COLUMNS)
            if not frame.empty:
                result[symbol] = frame
        return result

    def _history(self, symbol: str, start_date: date, end_date: date) -> pd.DataFrame:
        return yf.Ticker(symbol).history(
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            auto_adjust=True,
            interval="1d",
        )


class StaticMarketDataAdapter:
    def __init__(self, prices: dict[str, pd.Series], frames: dict[str, pd.DataFrame] | None = None) -> None:
        self._prices = prices
        self._frames = frames

    def fetch_prices(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.Series]:
        return {symbol: self._prices[symbol] for symbol in symbols if symbol in self._prices}

    def fetch_ohlc(self, symbols: list[str], start_date: date, end_date: date) -> dict[str, pd.DataFrame]:
        if self._frames is not None:
            return {symbol: self._frames[symbol] for symbol in symbols if symbol in self._frames}
        result: dict[str, pd.DataFrame] = {}
        for symbol in symbols:
            if symbol not in self._prices:
                continue
            closes = self._prices[symbol]
            result[symbol] = pd.DataFrame(
                {"Open": closes, "High": closes, "Low": closes, "Close": closes},
                index=closes.index,
            )
        return result
