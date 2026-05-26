from langchain_core.tools import tool 
from src.data.fetch import fetch_stock_history
from src.ml.sentiment import SentimentAnalyzer 
from src.ml.preprocessing import prepare_training_data
from src.ml.models import RandomForestPredictor, LSTMPredictor, evaluate_model
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
        data = prepare_training_data(ticker, sequence_length=5, model_type="random_forest")
        model = RandomForestPredictor(n_estimators=200)
        model.train(data["X_train"], data["y_train"])
        metrics = evaluate_model(model, data["X_test"], data["y_test"], data["scaler"])

        last_pred = model.predict(data["X_test"][-1:])
        last_actual = data["y_test"][-1]

        direction = "UP " if last_pred[0] > last_actual else "DOWN "


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
    predict_stock_price, 
    optimize_portfolio_tool,
]