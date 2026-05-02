from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance, VectorParams, PointStruct, 
    Filter, FieldCondition, MatchValue, DatetimeRange,
)
from src.config import settings
from qdrant_client.models import Filter, FieldCondition, MatchValue
import uuid

def get_qdrant_client()-> QdrantClient: 
    """
    Initialize and return a Qdrant client using environment variables.

    Returns:
        QdrantClient: An instance of QdrantClient connected to the specified host and port.
    """
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.secret_value("qdrant_api_key"),
        timeout=60,
    )

def create_collection_if_not_exists(client: QdrantClient, 
                                    collection_name: str = 'financial_news',
                                    vector_size: int = 384, # e.g. all-MiniLM-l6-v2 dimension
):
    vector_size = vector_size or settings.embedding_dimension

    if not client.collection_exists(collection_name):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE,
            ),
        )
        print(f'Created collection: {collection_name}')
    else:
        print(f'Collection {collection_name} already exists')

# def upsert_news_embedding(client: QdrantClient, collectio_name: str, text: str, 
#                           metadata: dict, # e.g. {"ticker": "AAPL", "date": "...", "link": "..."}
#                           vector: list[float], # the embedding
# ):
#     point_id = str(uuid.uuid4()) # or use deterministic hash
#     client.upsert(
#         collection_name=collectio_name, 
#         points=[
#             PointStruct(
#                 id=point_id, vector=vector, 
#                 payload={
#                     'text': text,
#                     **metadata,
#                 },
#             )
#         ],
#     )

def upsert_single(
    client: QdrantClient,
    collection_name: str,
    text: str,
    vector: list[float],
    metadata: dict,
) -> str:
    """
    Insert or update a single point in Qdrant.
    'Upsert' = Insert if new, Update if exists.
    Each point has: ID, vector (embedding), payload (metadata + text).
    """
    point_id = str(uuid.uuid4())
    client.upsert(
        collection_name=collection_name,
        points=[
            PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "text": text,
                    **metadata,
                },
            )
        ],
    )
    return point_id

def upsert_batch(
    client: QdrantClient,
    collection_name: str,
    texts: list[str],
    vectors: list[list[float]],
    metadatas: list[dict],
    batch_size: int = 100,
) -> list[str]:
    """
    Insert multiple points at once.
    
    Args:
        batch_size: How many points per API call (100 is default)
    """
    all_ids = []

    # Process in batches to avoid overwhelming Qdrant
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]
        batch_vectors = vectors[i : i + batch_size]
        batch_metas = metadatas[i : i + batch_size]

        points = []
        for text, vector, meta in zip(batch_texts, batch_vectors, batch_metas):
            point_id = str(uuid.uuid4())
            all_ids.append(point_id)
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={"text": text, **meta},
                )
            )
        client.upsert(collection_name=collection_name, points=points)
        print(f"  Upserted batch {i // batch_size + 1} ({len(points)} points)")

    return all_ids

def search_similar(
    client: QdrantClient,
    collection_name: str,
    query_vector: list[float],
    limit: int = 5,
    ticker_filter: str | None = None,
    source_filter: str | None = None,
) -> list[dict]:
    """
    Search for similar documents by vector.
    
    Measures the angle between two vectors.
    - Score 1.0 = identical meaning
    - Score 0.0 = completely unrelated
    - Score 0.5 = somewhat related
    Filters narrow results BEFORE similarity calculation,
    making searches faster and more relevant.
    """
    must_conditions = []
    if ticker_filter:
        must_conditions.append(
            FieldCondition(
                key="tickers",
                match=MatchValue(value=ticker_filter),
            )
        )
    if source_filter:
        must_conditions.append(
            FieldCondition(
                key="source",
                match=MatchValue(value=source_filter),
            )
        )
    search_filter = Filter(must=must_conditions) if must_conditions else None
    results = client.query_points(
        collection_name=collection_name,
        query=query_vector,
        query_filter=search_filter,
        limit=limit,
    )
    # Convert to a clean list of dicts
    return [
        {
            "id": str(point.id),
            "score": point.score,
            "text": point.payload.get("text", ""),
            "metadata": {
                k: v for k, v in point.payload.items() if k != "text"
            },
        }
        for point in results.points
    ]


def get_collection_info(client: QdrantClient, collection_name: str) -> dict:
    """Get stats about a collection (point count, etc)."""
    info = client.get_collection(collection_name)

    return {
        "name": collection_name,
        "points_count": info.points_count,
        "status": info.status.value,
}

def delete_collection(client: QdrantClient, collection_name: str):
    """Delete a collection and all its data."""
    client.delete_collection(collection_name)
    print(f"Deleted collection: {collection_name}")
