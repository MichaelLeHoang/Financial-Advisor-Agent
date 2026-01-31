from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):

    # api key 
    gemini_api_key: str # required
    alpha_vantage_api_key: str = ''
    finnhub_api_key: str = ''

    # qdrant vector db
    qdrant_url: str = 'http://localhost:6333'
    qdrant_api_key: str | None = None

    # embedding 
    embedding_provider: str = 'local' # 'local' / 'gemini'
    local_embedding_model: str = 'all-MiniLM-L6-v2'
    embedding_dimension: int = 384

    # RAG
    chunk_size: int = 512
    chunk_overlap: int = 50
    retrieval_top_k: int = 5

    # Collections
    news_collection: str = 'financial_news'
    stock_collection: str = 'stock_data'

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore',
    )

@lru_cache()
def get_settings() -> Settings: 
    '''
    Get caced settings instance (single pattern)
    
    :return: Description
    :rtype: Settings
    '''
    return Settings()

settings = get_settings()