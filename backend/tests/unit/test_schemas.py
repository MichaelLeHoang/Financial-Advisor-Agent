import pytest
from datetime import datetime 
from src.models.schemas import (
    DocumentType,
    ChunkMetadata,
    FinancialDocument,
    RAGQuery,
    RAGResponse,
    RetrievalResult,
)

class TestDocumentType:
    """Tests for DocumentType enum."""
    def test_valid_types(self):
        assert DocumentType.NEWS == "news"
        assert DocumentType.STOCK_DATA == "stock_data"
        assert DocumentType.REPORT == "report"
    def test_invalid_type_raises(self):
        with pytest.raises(ValueError):
            DocumentType("invalid_type")
class TestChunkMetadata:
    """Tests for ChunkMetadata model."""
    def test_required_fields(self):
        """source and document_type are required."""
        meta = ChunkMetadata(
            source="yahoo_finance",
            document_type=DocumentType.NEWS,
        )
        assert meta.source == "yahoo_finance"
        assert meta.tickers == []  # default empty list
    def test_optional_fields_default_none(self):
        meta = ChunkMetadata(
            source="test",
            document_type=DocumentType.NEWS,
        )
        assert meta.url is None
        assert meta.title is None
        assert meta.published_at is None
    def test_tickers_list(self):
        meta = ChunkMetadata(
            source="test",
            document_type=DocumentType.NEWS,
            tickers=["AAPL", "MSFT", "GOOGL"],
        )
        assert len(meta.tickers) == 3
        assert "AAPL" in meta.tickers
class TestFinancialDocument:
    """Tests for FinancialDocument model."""
    def test_creation(self):
        doc = FinancialDocument(
            id="doc-123",
            content="Apple earnings report content",
            metadata=ChunkMetadata(
                source="test",
                document_type=DocumentType.NEWS,
            ),
        )
        assert doc.id == "doc-123"
        assert "Apple" in doc.content
    def test_missing_required_field_raises(self):
        with pytest.raises(Exception):
            FinancialDocument(
                id="doc-123",
                # missing content and metadata
            )
class TestRAGResponse:
    """Tests for RAGResponse model."""
    def test_format_with_citations(self):
        response = RAGResponse(
            answer="Apple is doing well [1].",
            sources=[
                RetrievalResult(
                    text="Apple Q4 report",
                    score=0.85,
                    metadata=ChunkMetadata(
                        source="yahoo_finance",
                        document_type=DocumentType.NEWS,
                        title="Apple Earnings",
                    ),
                )
            ],
            query="How is Apple doing?",
            confidence=0.85,
        )
        formatted = response.format_with_citations()
        assert "Sources:" in formatted
        assert "[1]" in formatted
        assert "yahoo_finance" in formatted
