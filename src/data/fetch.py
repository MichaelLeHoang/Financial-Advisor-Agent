import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Mapping from period strings to timedeltas
_PERIOD_TO_DAYS: dict[str, int] = {
    "1d": 1,
    "5d": 5,
    "7d": 7,
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    "10y": 3650,
    "ytd": (datetime.now() - datetime(datetime.now().year, 1, 1)).days,
    "max": 7300,
}

def fetch_stock_history(tickers: list[str], period: str = '1y', interval: str = '1d') -> pd.DataFrame:
    """
    Fetch historical OHLCV for given tickers using yfinance.

    Args:
        tickers (list[str]): List of stock tickers/symbols (e.g., ['AAPL', 'MSFT'])
        period (str): Period for which to fetch data. Supported values:
                      '1d', '5d', '7d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'
        interval (str): Data interval ('1d', '1h', '15m', etc.)

    Returns:
        pd.DataFrame: DataFrame containing historical stock data.
    """
    end_date = datetime.now()

    days = _PERIOD_TO_DAYS.get(period, 365)  # default to 1 year if unrecognized
    start_date = end_date - timedelta(days=days)

    data = yf.download(
        tickers=tickers,
        start=start_date,
        end=end_date,
        interval=interval,
        group_by='ticker',
        auto_adjust=True,
        threads=True,
    )

    # Flatten MultiIndex columns if only one ticker was requested
    if len(tickers) == 1:
        data = data.droplevel('Ticker', axis=1) if isinstance(data.columns, pd.MultiIndex) else data

    return data

def fetch_current_info(tickers: list[str]) -> pd.DataFrame:
    """
    Fetch current stock information for given tickers using yfinance to 
    get details like market cap, PE ratio, current price, sector, etc.

    Args:
        tickers (list[str]): List of stock tickers/symbols (e.g., ['AAPL', 'MSFT'])
    """

    results = {}
    for ticker in tickers: 
        stock = yf.Ticker(ticker)
        info = stock.info 
        results[ticker]= {
            'currentPrice': info.get('currentPrice'),
            'marketCap': info.get('marketCap'),
            'trailingPE': info.get('trailingPE'),
            'forwardPE': info.get('forwardPE'),
            'sector': info.get('sector'),
            'trailingPE': info.get('trailingPE'),
            'industry': info.get('industry'),
            'dividendYield': info.get('dividendYield'),
            'beta': info.get('beta'),
        }
    return results

# Quick test
# if __name__ == "__main__":
#     tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"]
#     hist = fetch_stock_history(tickers, period='1y')
#     print(hist.tail())

#     info = fetch_current_info(tickers[:3])
#     print(info)

