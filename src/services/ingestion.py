from src.data.vector_db import (
    get_qdrant_client,
    create_collection_if_not_exists,
    upsert_batch,
    get_collection_info,
)
from src.services.embedding import get_embedding_service
from src.services.chunker import chunk_document
from src.services.news_fetcher import fetch_yfinance_news
from src.models.schemas import FinancialDocument, TextChunk
from src.config import settings

def ingest_documents(
    documents: list[FinancialDocument],
    collection_name: str | None = None,
) -> dict:
    """
    Ingest a list of FinancialDocuments into Qdrant.
    Full pipeline:
    1. Chunk each document into smaller pieces
    2. Embed each chunk into a vector
    3. Batch upsert all vectors + metadata into Qdrant
    Returns:
        Stats dict with counts of processed items
    """

    collection_name = collection_name or settings.news_collection

    # Initialize services
    client = get_qdrant_client()
    embedding_service = get_embedding_service()
    create_collection_if_not_exists(
        client, collection_name=collection_name, vector_size=embedding_service.dimension
    )

    # Chunk all documents
    print(f"\n Chunking {len(documents)} documents...")
    all_chunks: list[TextChunk] = []
    for doc in documents:
        chunks = chunk_document(doc)
        all_chunks.extend(chunks)
    print(f"   → {len(all_chunks)} chunks created")

    if not all_chunks:
        print("No chunks to ingest.")
        return {"documents": len(documents), "chunks": 0, "embedded": 0}

    # Embed all chunks 
    print(f"\n Embedding {len(all_chunks)} chunks...")
    texts = [chunk.text for chunk in all_chunks]
    vectors = embedding_service.embed_batch(texts)
    print(f"   → {len(vectors)} embeddings generated")

    # Prepare meta data for Qdrant 
    metadatas = []
    for chunk in all_chunks:
        meta = {
            "source": chunk.metadata.source,
            "document_type": chunk.metadata.document_type.value,
            "tickers": chunk.metadata.tickers,
            "title": chunk.metadata.title or "",
            "url": chunk.metadata.url or "",
            "chunk_index": chunk.chunk_index,
            "total_chunks": chunk.total_chunks,
        }
        if chunk.metadata.published_at:
            meta["published_at"] = chunk.metadata.published_at.isoformat()
        metadatas.append(meta)

    # Batch upsert to Qdrant 
    print(f"\n Upserting to Qdrant collection '{collection_name}'...")
    ids = upsert_batch(client, collection_name, texts, vectors, metadatas)
    # Report stats
    info = get_collection_info(client, collection_name)
    print(f"\n Ingestion complete!")
    print(f"   Collection '{collection_name}' now has {info['points_count']} points")
    return {
        "documents": len(documents),
        "chunks": len(all_chunks),
        "embedded": len(vectors),
        "point_ids": len(ids),
        "collection_total": info["points_count"],
    }

def ingest_news(tickers: list[str], collection_name: str | None = None) -> dict:
    """
    Full pipeline: Fetch news for tickers and ingest into Qdrant.
    This is the main entry point you'll call from the API or Inngest jobs.
    Usage:
        stats = ingest_news(['AAPL', 'MSFT', 'GOOGL'])
        print(f"Ingested {stats['chunks']} chunks")
    """
    print(f" Fetching news for: {tickers}")

    # Fetch
    documents = fetch_yfinance_news(tickers)
    if not documents:
        print("No news found.")
        return {"documents": 0, "chunks": 0, "embedded": 0}
    
    # Ingest
    return ingest_documents(documents, collection_name=collection_name)

    