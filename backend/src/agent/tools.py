from langchain_core.tools import tool 
from src.data.fetch import fetch_stock_history
from src.ml.sentiment import SentimentAnalyzer 
from src.ml.preprocessing import prepare_training_data
from src.ml.models import RandomForestPredictor, evaluate_model
from src.quantum.portfolio import optimize_portfolio, quantum_optimize_portfolio

@tool 
def get_stock_info(ticker: str) -> str: 
    """Get current stock price, daily change, volume, and basic info for a stock ticker"""
    try: 
        data = fetch_stock_history([ticker], period="5d")
        if data.empty: 
            return f"No data found for ticker {ticker}"

        latest = data.iloc[-1]
        prev = data.iloc[-2] if len(data) > 1 else latest

        change = ( (latest["Close"] - prev["Close"])  / prev["Close"]) * 100

        return (
            f"Stock: {ticker}\n"
            f"Latest Close: ${latest['Close']:.2f}\n"
            f"Daily Change: {change:+.2f}%\n"
            f"Volume: {int(latest['Volume']):,}\n"
            f"High: ${latest['High']:.2f} | Low: ${latest['Low']:.2f}"
        )

    except Exception as e:
        return f"Error fetching {ticker}: {str(e)}"

@tool 
def analyze_sentiment(texts: list[str]) -> str: 
    """Analyze the financial sentiment of news headlines or articles. Returns
    positve, negative, or neural scores and overall market mood
    """
    try: 
        analyzer = SentimentAnalyzer()
        mood = analyzer.get_market_mood(texts)
        output = (
            f"Market Mood: {mood['mood'].upper()}\n"
            f"Signal: {mood['signal']}\n"
            f"Bullish Score: {mood['bullish_score']:+.4f}\n"
            f"Breakdown: {mood['breakdown']['positive']} positive, "
            f"{mood['breakdown']['negative']} negative, "
            f"{mood['breakdown']['neutral']} neutral\n"
        )
        results = analyzer.analyze_batch(texts)
        for text, result in zip(texts, results):
            emoji = {"positive": "+", "negative": "-", "neutral": "|"}[result["label"]]
            output += f"\n{emoji} {result['label']} ({result['score']:.2f}): {text[:80]}"
        return output

    except Exception as e:
        return f"Error analyzing sentiment: {str(e)}"


@tool 
def predict_stock_price(ticker: str) -> str: 
    """Predict stock price direction using Random Forest ML model. Returns model accuracy metrics and predicted direction."""
    try:
        # Normalize ticker
        ticker = ticker.upper().strip()
        if not ticker:
            return "Error: Please provide a valid stock ticker symbol (e.g. AAPL, MSFT)."

        # Fetch data first to check availability
        raw = fetch_stock_history([ticker], period="2y")
        if raw.empty:
            return f"Error: No market data found for '{ticker}'. Please check the ticker symbol is correct (e.g. AAPL for Apple, MSFT for Microsoft)."

        # Need at least ~40 trading days for feature engineering (30-day SMA + lookback)
        if len(raw) < 40:
            return (
                f"Error: {ticker} has only {len(raw)} trading days of data. "
                f"The prediction model needs at least 40 days of history to compute technical indicators. "
                f"This ticker may be a recent IPO or have limited data."
            )

        data = prepare_training_data(ticker, sequence_length=5, model_type="random_forest")

        if data["X_train"].shape[0] == 0 or data["X_test"].shape[0] == 0:
            return f"Error: Insufficient processed data for {ticker} after feature engineering. The stock may have too many missing values."

        model = RandomForestPredictor(n_estimators=200)
        model.train(data["X_train"], data["y_train"])
        metrics = evaluate_model(model, data["X_test"], data["y_test"], data["scaler"])

        last_pred = model.predict(data["X_test"][-1:])
        last_actual = data["y_test"][-1]

        direction = "UP ↑" if last_pred[0] > last_actual else "DOWN ↓"

        return (
            f"Stock: {ticker}\n"
            f"Model: Random Forest (200 trees)\n"
            f"Test MAE: ${metrics['test_mae_dollars']:.2f}\n"
            f"Test RMSE: ${metrics['test_rmse_dollars']:.2f}\n"
            f"Predicted Direction: {direction}"
        )
    except Exception as e:
        return f"Error predicting {ticker}: {str(e)}"


@tool
def search_financial_news(ticker: str) -> str:
    """Search for recent financial news headlines for a stock ticker. Returns titles, publishers, links, and dates. Use this before analyze_sentiment to get real headlines."""
    import yfinance as yf

    try:
        ticker = ticker.upper().strip()
        if not ticker:
            return "Error: Please provide a valid stock ticker symbol."

        stock = yf.Ticker(ticker)
        news = stock.news

        if not news:
            return f"No recent news found for {ticker}."

        output = f"Recent news for {ticker}:\n\n"
        headlines = []
        for i, article in enumerate(news[:10], 1):
            # yfinance now nests everything under article["content"]
            content = article.get("content", article)  # fallback to flat structure
            title = content.get("title", "No title")

            # Provider is now a dict: {"displayName": "Yahoo Finance", ...}
            provider = content.get("provider", {})
            if isinstance(provider, dict):
                publisher = provider.get("displayName", "Unknown")
            else:
                publisher = content.get("publisher", str(provider) if provider else "Unknown")

            # URL is now nested: {"url": "https://...", "site": "finance"}
            canonical = content.get("canonicalUrl", {})
            if isinstance(canonical, dict):
                link = canonical.get("url", "")
            else:
                link = content.get("link", str(canonical) if canonical else "")

            # Date is now ISO string: "2026-06-11T18:42:57Z"
            date_str = content.get("pubDate", content.get("displayTime", ""))
            if date_str and len(str(date_str)) > 10:
                date_str = str(date_str)[:19].replace("T", " ")

            if link:
                output += f"{i}. [{publisher}] [{title}]({link})\n"
            else:
                output += f"{i}. [{publisher}] {title}\n"
            
            if date_str:
                output += f"   Published: {date_str}\n"
            output += "\n"
            headlines.append(title)

        output += "\nHeadlines for sentiment analysis:\n"
        for h in headlines:
            output += f"- {h}\n"

        return output

    except Exception as e:
        return f"Error fetching news for {ticker}: {str(e)}"


@tool
def research_market() -> str:
    """Get a broad market overview by scanning major indices and ETFs. Use this for 'market pulse', 'market overview', 'how is the market today', or any broad-market question. Returns prices and changes for SPY, QQQ, DIA, IWM, and VIX."""
    try:
        indices = [
            ("SPY", "S&P 500"),
            ("QQQ", "Nasdaq 100"),
            ("DIA", "Dow Jones"),
            ("IWM", "Russell 2000"),
            ("^VIX", "VIX (Volatility)"),
        ]

        output = "Market Overview:\n\n"
        for ticker, name in indices:
            try:
                data = fetch_stock_history([ticker], period="5d")
                if data.empty:
                    output += f"{name} ({ticker}): No data available\n"
                    continue
                latest = data.iloc[-1]
                prev = data.iloc[-2] if len(data) > 1 else latest
                change = ((latest["Close"] - prev["Close"]) / prev["Close"]) * 100
                arrow = "↑" if change >= 0 else "↓"
                output += (
                    f"{name} ({ticker}): ${latest['Close']:.2f} "
                    f"{arrow} {change:+.2f}% | "
                    f"Vol: {int(latest['Volume']):,}\n"
                )
            except Exception:
                output += f"{name} ({ticker}): Error fetching data\n"

        # Also fetch market-wide news via SPY
        import yfinance as yf
        try:
            spy_news = yf.Ticker("SPY").news
            if spy_news:
                output += "\nTop Market Headlines:\n"
                headlines = []
                for article in spy_news[:5]:
                    content = article.get("content", article)
                    title = content.get("title", "No title")
                    provider = content.get("provider", {})
                    pub = provider.get("displayName", "Unknown") if isinstance(provider, dict) else str(provider)
                    canonical = content.get("canonicalUrl", {})
                    link = canonical.get("url", "") if isinstance(canonical, dict) else content.get("link", str(canonical) if canonical else "")
                    
                    if link:
                        output += f"  • [{pub}] [{title}]({link})\n"
                    else:
                        output += f"  • [{pub}] {title}\n"
                    headlines.append(title)
                output += "\nHeadlines for sentiment analysis:\n"
                for h in headlines:
                    output += f"- {h}\n"
        except Exception:
            output += "\nUnable to fetch market headlines.\n"

        return output

    except Exception as e:
        return f"Error scanning market: {str(e)}"


@tool 
def optimize_portfolio_tool(
    tickers: list[str],
    method: str = "classical",
    risk_tolerance: float = 1.0,
) -> str:
    """Optimize a portfolio of stocks. Classical gives continuous weight allocation. Quantum selects the best subset of stocks."""
    try: 
        if method == "quantum":
            result = quantum_optimize_portfolio(tickers, target_assets=min(3, len(tickers)))
            output = (
                f"Method: Quantum QAOA\n"
                f"Selected: {', '.join(result['selected_stocks'])}\n"
                f"Probability: {result['best_probability']*100:.1f}%"
            )

        else: 
            result = optimize_portfolio(tickers, risk_tolerance=risk_tolerance)
            output = (
                f"Method: Classical Markowitz\n"
                f"Expected Return: {result['expected_annual_return']*100:.1f}%\n"
                f"Volatility: {result['annual_volatility']*100:.1f}%\n"
                f"Sharpe Ratio: {result['sharpe_ratio']:.2f}\n"
                f"Allocation:\n"
            )
            for t, w in sorted(result["weights"].items(), key=lambda x: -x[1]):
                output += f"  {t}: {w*100:.1f}%\n"
        return output
    except Exception as e:
        return f"Error optimizing: {str(e)}"
    
ALL_TOOLS = [
    get_stock_info, 
    analyze_sentiment,
    search_financial_news,
    research_market,
    predict_stock_price, 
    optimize_portfolio_tool,
]