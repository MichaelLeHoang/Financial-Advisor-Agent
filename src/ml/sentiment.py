from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification 

class SentimentAnalyzer: 
    """
    Sentiment analyzer for financial news and social media.
    Uses FinBERT - BERT model fine-tuned on financial text.

    Model: ProsusAI/finbert (~440MB, downloaded on first use)
    """
    _instance = None # Singleton (model is expensive to load) 

    def __new__(cls):
        if cls._instance is None: 
            cls._instance = super().__new__(cls)
            cls._instance._initialize = False
        return cls._instance

    def __init__(self):
        if self._initialize: 
            return 
        print("Loading FinBERT sentiment model...")
        self._tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        self._model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
        self._pipeline = pipeline(
            "sentiment-analysis",
            model=self._model,
            tokenizer=self._tokenizer, 
            top_k = None,
        )
        self._initialized = True 
        print("FinBERT loaded")

    def analyze(self, text: str) -> dict: 
        """
        Analyze sentiment of a single text.

        Returns:
            {
                "label": "positive" | "negative" | "neutral",
                "score": float (0-1 confidence),
                "all_scores": {"positive": 0.85, "negative": 0.10, "neutral": 0.05}
            }
        """
        # FinBERT has a 512 token limit, truncate if needed 
        truncated = text[:1500]

        results = self._pipeline(truncated)[0]
        
        # Convert to clean dict 
        scores = {r["label"]: round(r["score"], 4) for r in results}

        best = max(results, key = lambda x : x["score"])

        return {
            "label": best["label"],
            "score": best["score"],
            "all_scores": scores,
        }
    
    def analyze_batch(self, texts: list[str]) -> list[dict]: 
        """
        Analyze sentiment of multiple texts efficiently.
        Batching is faster than calling analyze() in a loop.

        """
        truncated = [t[:1500] for t in texts]
        batch_results = self._pipeline(truncated)
        
        results = []
        for item_scores in batch_results: 
            scores = {r["label"]: round(r["score"], 4) for r in item_scores}
            best = max(item_scores, key = lambda x: x["score"])
            results.append({
                "label": best["label"],
                "score": best["score"],
                "all_scores": scores,
            })
        return results
    
    def get_market_mood(self, texts: list[str]) -> dict:
        """
        Get overall market mood from a collection of news texts.
        Returns aggregate sentiment across all texts:
        - Average scores for positive/negative/neutral
        - Overall mood label
        - Bullish/bearish signal
        """

        sentiments = self.analyze_batch(texts)

        avg_positive = sum(s["all_scores"].get("positive", 0) for s in sentiments) / len(sentiments)
        avg_negative = sum(s["all_scores"].get("negative", 0) for s in sentiments) / len(sentiments)
        avg_neutral = sum(s["all_scores"].get("neutral", 0) for s in sentiments) / len(sentiments)

        # determin overall mood
        scores = {
            "positive": avg_positive,
            "negative": avg_negative,
            "neutral": avg_neutral,
        }
        mood = max(scores, key=scores.get)
        
        # Bullish/bearish signal (pos - neg)
        bullish_score = avg_positive - avg_negative
        signal = "BULLISH" if bullish_score > 0.1 else "BEARISH" if bullish_score < -0.1 else "NEUTRAL"

        return {
           "mood": mood,
            "bullish_score": round(bullish_score, 4),  # +1 = very bullish, -1 = very bearish
            "signal": signal,
            "avg_scores": {k: round(v, 4) for k, v in scores.items()},
            "num_articles": len(sentiments),
            "breakdown": {
                "positive": sum(1 for s in sentiments if s["label"] == "positive"),
                "negative": sum(1 for s in sentiments if s["label"] == "negative"),
                "neutral": sum(1 for s in sentiments if s["label"] == "neutral"),
            },
        }


        