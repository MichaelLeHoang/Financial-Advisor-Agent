import pytest
from src.services.embedding import get_embedding_service

class TestEmbeddingService:
    """Test the embedding service with real model."""
    @pytest.fixture(autouse=True)
    def setup(self):
        """Initialize embedding service once for all tests."""
        self.service = get_embedding_service()
    def test_embed_single(self):
        """Test embedding a single text."""
        vector = self.service.embed("Apple stock is rising")
        assert isinstance(vector, list)
        assert len(vector) == 384  # all-MiniLM-L6-v2 dimension
        assert all(isinstance(v, float) for v in vector)
    def test_embed_batch(self):
        """Test embedding multiple texts."""
        texts = ["Apple stock", "Google earnings", "Market crash"]
        vectors = self.service.embed_batch(texts)
        assert len(vectors) == 3
        assert all(len(v) == 384 for v in vectors)
    def test_similar_texts_similar_vectors(self):
        """Semantically similar texts should produce similar vectors."""
        import numpy as np
        v1 = self.service.embed("Apple stock price is going up")
        v2 = self.service.embed("AAPL shares are increasing in value")
        v3 = self.service.embed("The weather is sunny today")
        # Cosine similarity between similar texts should be higher
        def cosine_sim(a, b):
            a, b = np.array(a), np.array(b)
            return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        sim_related = cosine_sim(v1, v2)
        sim_unrelated = cosine_sim(v1, v3)
        # Related texts should have higher similarity
        assert sim_related > sim_unrelated
    def test_dimension_property(self):
        assert self.service.dimension == 384