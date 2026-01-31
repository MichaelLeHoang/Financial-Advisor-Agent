import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

def fetch_stock_history(tickers: list[str], period: str = '1y', interval: str = '1d') -> pd.DataFrame:
    """
    Fetch historical OHCLV for given tickers using yfinance.

    Args:
        tickers (list[str]): List of stock tickers/symbols (e.g., ['AAPL', 'MSFT'])
        period (str): Period for which to fetch data (default is '1y') (e.g., '1y', '6mo', 'max')
        interval (str): Data interval (default is '1d') ('1d', '1h', '15m', etc.)

    Returns:
        pd.DataFrame: DataFrame containing historical stock data with MultiIndex (ticker, date).
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365*2) # Default to last 2 years if not specified and for safety


    data = yf.download(
        tickers=tickers,
        start=start_date,
        end=end_date,
        interval=interval,
        group_by='ticker',
        auto_adjust=True,
        threads=True
    )

    # clean up and flatten if single ticker
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

