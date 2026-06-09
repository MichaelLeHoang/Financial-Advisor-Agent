import asyncio
import sys
import traceback
from src.agent.tools import predict_stock_price

def main():
    tickers = ["NVDA"] 
    for ticker in tickers:
        print(f"\nTesting {repr(ticker)}...")
        try:
            result = predict_stock_price.invoke({"ticker": ticker})
            print("Result:", result)
        except Exception as e:
            print("Exception:", e)
            traceback.print_exc()

if __name__ == "__main__":
    main()
