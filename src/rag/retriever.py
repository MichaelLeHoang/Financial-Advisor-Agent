from src.services.embedding import get_embedding_service
from src.data.vector_db import get_qdrant_client, search_similar
from src.models.schemas import RetrievalResult, ChunkMetadata, DocumentType
from src.config import settings

class Retriever: 
    """
    Retrieves relevant documents from Qdrant for a given query.
    Usage:
        retriever = Retriever()
        results = retriever.retrieve("How is Apple doing?")
        for r in results:
            print(r.score, r.text[:100])
    """

    def __init__(self):
        self._client = get_qdrant_client()
        self._embedding_service = get_embedding_service()
        self._collection_name = settings.resolved_news_collection

    def retrieve(
                self, 
                query: str, 
                tickers_filter: list[str] = None, 
                top_k: int | None = None
            ) -> list[RetrievalResult]:
        
        top_k = top_k or settings.retrieval_top_k

        
        # Embed the query
        query_vector = self._embedding_service.embed(query)

        # Search Qdrant for similar documents
        raw_results = search_similar(
            client=self._client,
            collection_name=self._collection_name,
            query_vector=query_vector,
            limit=top_k,
            ticker_filter=tickers_filter,
        )

        # Convert raw results to RetrievalResult objects
        results = []
        for hit in raw_results:
            meta = hit["metadata"]
            results.append(
                RetrievalResult(
                    text=hit["text"],
                    score=hit["score"],
                    metadata=ChunkMetadata(
                        source=meta.get("source", "unknown"),
                        document_type=DocumentType(
                            meta.get("document_type", "news")
                        ),
                        tickers=meta.get("tickers", []),
                        title=meta.get("title"),
                        url=meta.get("url"),
                    ),
                )
            )
        return results
    
def retrieve(query: str, **kwargs) -> list[RetrievalResult]:
    """Convenience function for quick retrieval."""
    return Retriever().retrieve(query, **kwargs)
