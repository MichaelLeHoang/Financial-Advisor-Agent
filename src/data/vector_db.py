from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct 
from qdrant_client.models import Filter, FieldCondition, MatchValue
import uuid

def get_qdrant_client()-> QdrantClient: 
    """
    Initialize and return a Qdrant client using environment variables.

    Returns:
        QdrantClient: An instance of QdrantClient connected to the specified host and port.
    """
    return QdrantClient(
        url='http://localhost:6333',
        # api_key = API_KEY
        timeout=60,
    )

def create_collection_if_not_exists(client: QdrantClient, collection_name: str = 'financial_news',
                                    vector_size: int = 384, # e.g. all-MiniLM-l6-v2 dimension
):
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

def upsert_news_embedding(client: QdrantClient, collectio_name: str, text: str, 
                          metadata: dict, # e.g. {"ticker": "AAPL", "date": "...", "link": "..."}
                          vector: list[float], # the embedding
):
    point_id = str(uuid.uuid4()) # or use deterministic hash
    client.upsert(
        collection_name=collectio_name, 
        points=[
            PointStruct(
                id=point_id, vector=vector, 
                payload={
                    'text': text,
                    **metadata,
                },
            )
        ],
    )

def search_similar_news(client: QdrantClient, collection_name: str, 
                        query_vector: list[float], limit: int = 5, 
                        ticker_filter: str | None = None):
    must_conditions = []
    if ticker_filter: 
        must_conditions.append(
            Filter(
                must=[
                    FieldCondition(
                        key='ticker',
                        match=MatchValue(value = ticker_filter),
                    )
                ]
            )
        )
    hits = client.query_points(
        collection_name = collection_name,
        query = query_vector,
        query_filter = Filter(must=must_conditions) if must_conditions else None,
        limit = limit
    )
    return hits

# Quick Test
if __name__ == '__main__':
    client = get_qdrant_client()
    create_collection_if_not_exists(client)

    # Dummy example (replace with real embedding later)
    dummy_vector = [0.1] * 384
    upsert_news_embedding(
        client, 
        'financial_news',
        text='AAPL reports record earnings amid AI boom',
        metadata={"ticker": "AAPL", "source": "Yahoo Finance"},
        vector=dummy_vector,
    )

    results = search_similar_news(client, 'financial_news', dummy_vector, ticker_filter='APPL')
    print(results)