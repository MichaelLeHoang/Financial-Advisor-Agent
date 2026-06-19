from langchain_core.tools import tool 
from src.data.fetch import fetch_stock_history
from src.ml.sentiment import SentimentAnalyzer 
from src.ml.preprocessing import prepare_training_data
from src.ml.models import LSTMPredictor, RandomForestPredictor, evaluate_model
from src.ml.ensemble import EnsemblePredictionService, PredictionDataError
from src.quantum.portfolio import optimize_portfolio, quantum_optimize_portfolio
from src.core.cache import cached_value
from src.data.market_data_service import market_data_service

@tool 
def get_stock_info(ticker: str) -> str: 
    """Get current stock price, daily change, volume, and basic info for a stock ticker"""
    ticker = ticker.upper().strip()

    def compute() -> str:
        snapshot = market_data_service.fetch_snapshot(ticker, period="5d", interval="1d", include_news=False, include_sec=False)
        if snapshot.latest_price is None and not snapshot.history:
            return f"No data found for ticker {ticker}"

        lines = [
            f"Stock: {ticker}",
            f"Company: {snapshot.company_name or 'Unavailable'}",
            f"Latest Price: ${snapshot.latest_price or snapshot.history[-1].price:.2f}",
            f"Daily Change: {(snapshot.daily_change or 0):+.2f}%",
            f"Volume: {int(snapshot.volume or 0):,}",
        ]
        if snapshot.day_high and snapshot.day_low:
            lines.append(f"High: ${snapshot.day_high:.2f} | Low: ${snapshot.day_low:.2f}")
        lines.append(f"Data Sources: {', '.join(snapshot.data_sources) or 'Unavailable'}")
        lines.append(f"Source Notes: {'; '.join(snapshot.source_quality.get('limitations', [])) or 'Primary configured sources available.'}")
        return "\n".join(lines)

    try:
        return cached_value("stock_info", {"ticker": ticker}, 60, compute)

    except Exception as e:
        return f"Error fetching {ticker}: {str(e)}"

@tool 
def analyze_sentiment(texts: list[str]) -> str: 
    """Analyze the financial sentiment of news headlines or articles. Returns
    positve, negative, or neural scores and overall market mood
    """
    clean_texts = [str(text) for text in texts]

    def compute() -> str:
        analyzer = SentimentAnalyzer()
        mood = analyzer.get_market_mood(clean_texts)
        output = (
            f"Market Mood: {mood['mood'].upper()}\n"
            f"Signal: {mood['signal']}\n"
            f"Bullish Score: {mood['bullish_score']:+.4f}\n"
            f"Breakdown: {mood['breakdown']['positive']} positive, "
            f"{mood['breakdown']['negative']} negative, "
            f"{mood['breakdown']['neutral']} neutral\n"
        )
        results = analyzer.analyze_batch(clean_texts)
        for text, result in zip(clean_texts, results):
            emoji = {"positive": "+", "negative": "-", "neutral": "|"}[result["label"]]
            output += f"\n{emoji} {result['label']} ({result['score']:.2f}): {text[:80]}"
        return output

    try:
        return cached_value("sentiment", clean_texts, 1800, compute)

    except Exception as e:
        return f"Error analyzing sentiment: {str(e)}"


@tool
def predict_stock_price(ticker: str, model: str = "ensemble") -> str:
    """Predict stock movement using Random Forest, LSTM, or ensemble mode. Defaults to ensemble unless a single model is explicitly requested. Returns only computed metrics and caveats."""
    try:
        # Normalize ticker
        ticker = ticker.upper().strip()
        if not ticker:
            return "Error: Please provide a valid stock ticker symbol (e.g. AAPL, MSFT)."
        selected_model = (model or "ensemble").strip().lower()
        if selected_model not in {"random_forest", "lstm", "ensemble"}:
            return "Error: model must be one of random_forest, lstm, or ensemble."

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

        if selected_model == "ensemble":
            try:
                result = EnsemblePredictionService().predict_with_models(
                    ticker,
                    horizon_days=1,
                    lookback_period="2y",
                    target="return",
                    include_validation=True,
                    include_backtest=True,
                    sequence_length=30,
                )
            except PredictionDataError as exc:
                return f"Error: {exc}"
            return _format_ensemble_prediction_for_agent(result)

        data = prepare_training_data(ticker, sequence_length=5, model_type=selected_model)

        if data["X_train"].shape[0] == 0 or data["X_test"].shape[0] == 0:
            return f"Error: Insufficient processed data for {ticker} after feature engineering. The stock may have too many missing values."

        predictor = RandomForestPredictor(n_estimators=200) if selected_model == "random_forest" else LSTMPredictor(epochs=20)
        predictor.train(data["X_train"], data["y_train"])
        metrics = evaluate_model(predictor, data["X_test"], data["y_test"], data["scaler"])

        last_pred = predictor.predict(data["X_test"][-1:])
        last_actual = data["y_test"][-1]

        direction = "UP ↑" if last_pred[0] > last_actual else "DOWN ↓"
        display_name = "Random Forest (200 trees)" if selected_model == "random_forest" else "LSTM"

        return (
            f"Stock: {ticker}\n"
            f"Model: {display_name}\n"
            f"Test MAE: ${metrics['test_mae_dollars']:.2f}\n"
            f"Test RMSE: ${metrics['test_rmse_dollars']:.2f}\n"
            f"Predicted Direction: {direction}\n"
            f"Caveat: This is educational analysis, not financial advice."
        )
    except Exception as e:
        return f"Error predicting {ticker}: {str(e)}"


def _format_ensemble_prediction_for_agent(result: dict) -> str:
    predictions = result.get("predictions", {})
    validation = result.get("validation", {})
    weights = result.get("weights", {})
    agreement = result.get("agreement", {})
    final_prediction = predictions.get("weighted_ensemble") or result.get("finalPrediction") or {}
    current_price = float(result.get("current_price") or result.get("currentPrice") or 0)
    predicted_price = _prediction_value(final_prediction, "predicted_price", "predictedPrice")
    predicted_return = _prediction_value(final_prediction, "predicted_return", "predictedReturn")

    lines = [
        result.get("summary") or f"The ensemble model generated a prediction for {result.get('ticker')}.",
        "",
        f"Current price: ${current_price:.2f}",
    ]
    if predicted_price is not None and predicted_return is not None:
        lines.extend([
            f"Weighted ensemble prediction: ${predicted_price:.2f}",
            f"Expected move: {predicted_return:+.2%}",
        ])

    labels = {
        "random_forest": "Random Forest",
        "lstm": "LSTM",
        "simple_average": "Simple Average",
        "weighted_ensemble": "Weighted Ensemble",
    }
    lines.extend(["", "Model breakdown:"])
    for key in ["random_forest", "lstm", "simple_average", "weighted_ensemble"]:
        item = predictions.get(key)
        if not item:
            continue
        item_return = float(item["predicted_return"])
        lines.append(
            f"- {labels[key]}: ${float(item['predicted_price']):.2f}, "
            f"{_direction_label(item_return)}, return {item_return:+.2%}"
        )

    if "random_forest" in weights and "lstm" in weights:
        lines.extend([
            "",
            "The weighted ensemble uses validation-based model weights:",
            f"- Random Forest weight: {float(weights.get('random_forest', 0)):.0%}",
            f"- LSTM weight: {float(weights.get('lstm', 0)):.0%}",
        ])

    validation_lines: list[str] = []
    for key in ["random_forest", "lstm", "simple_average", "weighted_ensemble"]:
        metric = validation.get(key)
        if not metric:
            continue
        validation_lines.append(
            f"- {labels[key]}: MAE {float(metric['mae']):.2%}, "
            f"RMSE {float(metric['rmse']):.2%}, "
            f"Directional Accuracy {float(metric['directional_accuracy']):.0%}"
        )
    if validation_lines:
        lines.extend(["", "Validation summary:"])
        lines.extend(validation_lines)

    if agreement:
        display_agreement = result.get("agreementDisplay") or {}
        status = display_agreement.get("status") or str(agreement.get("status", "weak")).replace("_agreement", "")
        explanation = display_agreement.get("explanation") or agreement.get("message", "")
        lines.extend(["", f"Model agreement: {str(status).title()}. {explanation}"])
    lines.append(f"Confidence: {str(result.get('confidence', 'low')).title()}.")

    warnings = result.get("warnings") or []
    if warnings:
        lines.append("Warnings: " + "; ".join(warnings))
    lines.append(result.get("caveat") or "This is educational analysis, not financial advice.")
    return "\n".join(lines)


def _prediction_value(prediction: dict, snake_key: str, camel_key: str) -> float | None:
    value = prediction.get(snake_key, prediction.get(camel_key))
    return float(value) if isinstance(value, (int, float)) else None


def _direction_label(predicted_return: float) -> str:
    if abs(predicted_return) < 0.0005:
        return "NEUTRAL →"
    if predicted_return > 0:
        return "UP ↑"
    return "DOWN ↓"


@tool
def search_financial_news(ticker: str) -> str:
    """Search for recent financial news headlines for a stock ticker. Returns titles, publishers, links, and dates. Use this before analyze_sentiment to get real headlines."""
    ticker = ticker.upper().strip()

    def compute() -> str:
        if not ticker:
            return "Error: Please provide a valid stock ticker symbol."

        snapshot = market_data_service.fetch_snapshot(ticker, period="1mo", interval="1d", include_news=True, include_sec=False)
        news = snapshot.news_items

        if not news:
            return f"No recent news found for {ticker}."

        output = f"Recent news for {ticker}:\n\n"
        headlines = []
        for i, article in enumerate(news[:10], 1):
            title = article.title
            publisher = article.publisher or article.source
            link = article.url or ""
            date_str = article.published_at or ""

            if link:
                output += f"{i}. [{publisher}] [{title}]({link})\n"
            else:
                output += f"{i}. [{publisher}] {title}\n"
            
            if date_str:
                output += f"   Published: {date_str}\n"
            output += "\n"
            headlines.append(title)

        source_quality = snapshot.source_quality or {}
        primary_sources = source_quality.get("primary_sources") or []
        enrichment_sources = source_quality.get("enrichment_sources") or []
        limitations = source_quality.get("limitations") or []
        output += f"\nData Sources: {', '.join(snapshot.data_sources)}\n"
        output += f"Primary Sources: {', '.join(primary_sources) if primary_sources else 'Unavailable'}\n"
        output += f"Enrichment Sources: {', '.join(enrichment_sources) if enrichment_sources else 'None configured or available'}\n"
        if limitations:
            output += f"Source Notes: {'; '.join(str(item) for item in limitations)}\n"
        output += f"Sentiment Signal: {snapshot.sentiment_summary.get('signal', 'limited')} ({snapshot.sentiment_summary.get('score', 0)})\n"
        output += "\nHeadlines for sentiment analysis:\n"
        for h in headlines:
            output += f"- {h}\n"

        return output

    try:
        return cached_value("financial_news", {"ticker": ticker}, 600, compute)

    except Exception as e:
        return f"Error fetching news for {ticker}: {str(e)}"


@tool
def research_market() -> str:
    """Get a broad market overview by scanning major indices and ETFs. Use this for 'market pulse', 'market overview', 'how is the market today', or any broad-market question. Returns prices and changes for SPY, QQQ, DIA, IWM, and VIX."""
    def compute() -> str:
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
                snapshot = market_data_service.fetch_snapshot(ticker, period="5d", interval="1d", include_news=False, include_sec=False)
                if snapshot.latest_price is None:
                    output += f"{name} ({ticker}): No data available\n"
                    continue
                change = snapshot.daily_change or 0
                arrow = "↑" if change >= 0 else "↓"
                output += (
                    f"{name} ({ticker}): ${snapshot.latest_price:.2f} "
                    f"{arrow} {change:+.2f}% | "
                    f"Sources: {', '.join(snapshot.data_sources[:2])}\n"
                )
            except Exception:
                output += f"{name} ({ticker}): Error fetching data\n"

        # Also fetch market-wide news via SPY
        try:
            spy_snapshot = market_data_service.fetch_snapshot("SPY", period="1mo", interval="1d", include_news=True, include_sec=False)
            if spy_snapshot.news_items:
                output += "\nTop Market Headlines:\n"
                headlines = []
                for article in spy_snapshot.news_items[:5]:
                    title = article.title
                    pub = article.publisher or article.source
                    link = article.url or ""
                    
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

    try:
        return cached_value("market_research", {"scope": "major_indices"}, 60, compute)

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
