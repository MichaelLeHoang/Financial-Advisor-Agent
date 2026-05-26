import pytest
import numpy as np


class TestRandomForest:
    """Test Random Forest model."""

    def test_train_and_predict(self):
        from src.ml.models import RandomForestPredictor

        # Create dummy data (100 samples, 10 features)
        X_train = np.random.rand(100, 10)
        y_train = np.random.rand(100)

        model = RandomForestPredictor(n_estimators=10)
        metrics = model.train(X_train, y_train)

        assert "train_mae" in metrics
        assert metrics["train_mae"] >= 0

        # Test prediction
        predictions = model.predict(X_train[:5])
        assert len(predictions) == 5

    def test_predict_without_training_raises(self):
        from src.ml.models import RandomForestPredictor

        model = RandomForestPredictor()
        with pytest.raises(RuntimeError, match="not trained"):
            model.predict(np.array([[1, 2, 3]]))

    def test_feature_importances(self):
        from src.ml.models import RandomForestPredictor

        X = np.random.rand(50, 6)
        y = np.random.rand(50)
        names = ["f1", "f2", "f3", "f4", "f5", "f6"]

        model = RandomForestPredictor(n_estimators=10)
        model.train(X, y)
        importance = model.get_feature_importances(names)

        assert len(importance) == 6
        assert sum(importance.values()) == pytest.approx(1.0, abs=0.01)


class TestSentimentAnalyzer:
    """Test FinBERT sentiment analysis."""

    @pytest.fixture(autouse=True)
    def setup(self):
        from src.ml.sentiment import SentimentAnalyzer
        self.analyzer = SentimentAnalyzer()

    def test_analyze_positive(self):
        result = self.analyzer.analyze("NVIDIA stock surges 15% on strong demand")
        assert result["label"] in ["positive", "negative", "neutral"]
        assert 0 <= result["score"] <= 1
        assert "all_scores" in result

    def test_analyze_negative(self):
        result = self.analyzer.analyze("Company declares bankruptcy and lays off all employees")
        assert result["label"] == "negative"

    def test_analyze_batch(self):
        texts = ["Stock goes up", "Stock crashes", "Market is flat"]
        results = self.analyzer.analyze_batch(texts)
        assert len(results) == 3

    def test_market_mood(self):
        texts = ["Great earnings", "Stock plunges", "Flat trading day"]
        mood = self.analyzer.get_market_mood(texts)
        assert mood["mood"] in ["positive", "negative", "neutral"]
        assert "breakdown" in mood
        assert mood["num_articles"] == 3
        assert "signal" in mood