import pytest
from src.services.chunker import chunk_document, _estimate_tokens, _split_into_sentences
from src.models.schemas import FinancialDocument, ChunkMetadata, DocumentType

def _make_doc(content: str, title: str = "Test Doc") -> FinancialDocument: 
    """Helper to create a test document quickly"""
    return FinancialDocument(
        id="test-001",
        content=content, 
        metadata=ChunkMetadata(
            source="test", 
            document_type=DocumentType.NEWS, 
            tickers=["AAPL"],
            title=title,
        ),
    )

class TestEstimateTokens:
    """Tests for token estimation."""
    def test_empty_string(self):
        assert _estimate_tokens("") == 0
    def test_short_text(self):
        # "hello" = 5 chars / 4 ≈ 1 token
        result = _estimate_tokens("hello")
        assert result == 1
    def test_longer_text(self):
        text = "Apple reported record earnings for Q4"  # 38 chars
        result = _estimate_tokens(text)
        assert result == 9  # 38 // 
        

class TestSplitIntoSentences:
    """Tests for sentence splitting."""
    def test_basic_split(self):
        text = "First sentence. Second sentence. Third one."
        sentences = _split_into_sentences(text)
        assert len(sentences) >= 2
    def test_single_sentence(self):
        text = "Just one sentence here"
        sentences = _split_into_sentences(text)
        assert len(sentences) == 1
    def test_preserves_decimals(self):
        """Ensure $1.5B doesn't get split."""
        text = "Revenue was $1.5B in Q4. That exceeded expectations."
        sentences = _split_into_sentences(text)
        # Should contain the full "$1.5B" in one sentence
        found = any("$1.5B" in s for s in sentences)
        assert found

class TestChunkDocument:
    """Tests for document chunking."""
    def test_short_doc_single_chunk(self):
        """Short documents should produce exactly one chunk."""
        doc = _make_doc("Short text about AAPL stock.")
        chunks = chunk_document(doc, chunk_size=500)
        assert len(chunks) == 1
        assert chunks[0].chunk_index == 0
        assert chunks[0].total_chunks == 1
    def test_long_doc_multiple_chunks(self):
        """Long documents should be split into multiple chunks."""
        # Create a document that's definitely longer than 50 tokens
        long_text = "Apple stock is performing well. " * 50
        doc = _make_doc(long_text)
        chunks = chunk_document(doc, chunk_size=50)
        assert len(chunks) > 1
    def test_metadata_preserved(self):
        """Each chunk should inherit the parent document's metadata."""
        doc = _make_doc("Some content about Apple earnings.")
        chunks = chunk_document(doc, chunk_size=500)
        for chunk in chunks:
            assert chunk.metadata.tickers == ["AAPL"]
            assert chunk.metadata.source == "test"
            assert chunk.metadata.document_type == DocumentType.NEWS
    def test_chunk_index_sequential(self):
        """Chunk indices should be 0, 1, 2, ..."""
        long_text = "Paragraph one about earnings.\n\n" * 20
        doc = _make_doc(long_text)
        chunks = chunk_document(doc, chunk_size=50)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i
            assert chunk.total_chunks == len(chunks)
    def test_empty_content(self):
        """Empty content should produce one empty chunk or no chunks."""
        doc = _make_doc("")
        chunks = chunk_document(doc, chunk_size=500)
        # Either 0 chunks or 1 empty chunk is acceptable
        assert len(chunks) <= 1