from abc import ABC, abstractmethod
import numpy as np 
from src.config import settings

class EmbeddingProvider(ABC): 
    """
     Abstract base class for embedding providers.
    """

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        """
        Generate an embedding vector for the given text.

        :param text: The input text to embed.
        :return: A list of floats representing the embedding vector.
        """
        pass

    @abstractmethod
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embedding vectors for a batch of texts efficently.

        :param texts: A list of input texts to embed.
        :return: A list of embedding vectors, where each vector is a list of floats.
        """
        pass

class LocalEmbeddingProvider(EmbeddingProvider):
    """
    Local embedding provider Uses SentenceTransformers for local embeddings
    
    Note: 
        Pros:   - Free (no API costs)
                - No rate limits
                - Works offline 
                - Fast for small batches
        
        Cons:   - Requires local resources (CPU/GPU)
                - May not be as powerful as cloud models
    """

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name or settings.local_embedding_model
        print(f"Loading embedding model: {self.model_name}...")
       
        self._model = SentenceTransformer(self.model_name)
        self._dimension = self._model.get_sentence_embedding_dimension()
        print(f"Model loaded. Dimension: {self._dimension}")

    def embed(self, text: str) -> list[float]:
        """Embed a single text."""
        embedding = self._model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings = self._model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

@property
def dimension(self) -> int:
    return self._dimension

class GeminiEmbeddingProvider(EmbeddingProvider):
    """
    Gemini embedding provider Uses Google Gemini API for embeddings
    
    Note: 
        Pros:   - State-of-the-art embeddings
                - No local resource requirements
                - Easy to use
        
        Cons:   - API costs (pay per request)
                - Rate limits
                - Requires internet connection
    """

    def __init__(self, api_key: str):
        import google.generativeai as genai

        genai.configure(api_key=settings.api_key)

        self.model = 'models/embedding-001' # or latest embedding model
        self.dimension = 768 # check model docs for dimension

    def embed(self, text: str) -> list[float]:
        import google.generativeai as genai
        

        result = genai.embed_content(
            model = self.model, 
            content=text, 
            task_type='retrieval_document',
        )
        return result['embedding']
    
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # In production, you'd add rate limiting here and batch the requests if supported by the API
        return [self.embed(text) for text in texts]
    
    @property
    def dimension(self) -> int:
        return self._dimension
    
class EmbeddingService:
    """
    Main embedding service - facade for providers.
    
    FACADE PATTERN:
    Provides a simple interface that hides the complexity
    of choosing and initializing providers.
    
    Usage:
        service = EmbeddingService()
        vector = service.embed("Some text about stocks")
    """

    _instance = None # Singleton instance

    def __new__(cls):
        if cls._instance is None: 
            cls._instance = super().__new__(cls) 
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized: 
            return 
        
        # Choose provider based on config
        if settings.embedding_provider == 'gemini':
            self._provider = GeminiEmbeddingProvider()
        else: 
            self._provider = LocalEmbeddingProvider()

        self._initialized = True
    
    def embed(self, text: str) -> list[float]:
        return self._provider.embed(text)
    
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return self._provider.embed_batch(texts)
    
    @property
    def dimension(self) -> int:
        """Get embedding dimension (needed for Qdrant collection setup)."""
        return self._provider.dimension
    
def get_embedding_service() -> EmbeddingService:
    """
    Get the singleton instance of the embedding service.
    
    :return: An instance of EmbeddingService.
    :rtype: EmbeddingService
    """
    return EmbeddingService()

        