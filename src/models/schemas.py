from pydantic import BaseModel, Field 
from datetime import datetime
from enum import Enum 

class DocumentType(str, Enum):
    '''
    Categories of financial documents we process
    '''
    NEWS = 'news'
    STOCK_DATA = 'stock_data'
    REPORT = 'report'
    USER_NOTE = 'user_note'

class ChunkMetadata(BaseModel):
    '''
    Metadata attached to each text chunk in Qdrant
    '''
    source: str = Field(..., description="Origin (e.g., 'yahoo_finance')")
    document_type : DocumentType
    tickers: list[str] = Field(default_factory=list)
    published_at: datetime | None = None
    indexed_at: datetime | None = None
    url: str | None = None
    title: str | None = None

class FinancialDocument(BaseModel):
    '''
    Normalized representation of any financial content.
    '''
    id: str
    content: str
    metadata: ChunkMetadata

class TextChunk(BaseModel):
    '''
    A single chunk ready for embedding
    '''
    text: str
    chunk_index: int
    total_chunks: int
    metadata: ChunkMetadata

class RetrievalResult(BaseModel):
    '''
    A result from Qdrant similarity search
    '''
    text: str
    score: float # 0-1, higher = more similiar
    metadata: ChunkMetadata

class RAGQuery(BaseModel):
    '''
    User's question to the RAG system
    '''
    question: str
    tickers: list[str] = Field(default_factory=list)
    max_results: int = 5

class RAGResponse(BaseModel):
    '''
    The RAG system's response
    '''
    answer: str 
    sources: list[RetrievalResult]
    query: str
    confidence: float
    generated_at: datetime = Field(default_factory=datetime.now)

    def format_with_citations(self) -> str:
        '''
        Format answer with numbered source citations
        '''
        citations = [
            f"[{i + 1}] {s.metadata.source} - {s.metadata.title or 'Untitled'}" 
            for i, s in enumerate(self.sources)
        ]
        return f"{self.answer}\n\nSources:\n" + "\n".join(citations)