import re 
from src.config import settings
from src.models.schemas import FinancialDocument, TextChunk, ChunkMetadata

# def _split_into_sentences(text: str) -> list[str]:
#     '''
#     Split text into sentences.
    
#     Uses regex to handle financial text edge cases:
#     - Doesn't split on abbreviations (e.g., "U.S.")
#     - Doesn't split on decimals (e.g., "$1.5B")
#     - Handles common financial patterns

#     '''
#     # Split on period/question/exclamtion followed by space and capital 
#     # But NOT on common abreviations or dicimals 
#     sentence_endings = re.compile(
#         r'(?<!\b(?:Mr|Mrs|Ms|Dr|Inc|Corp|Ltd|Co|vs|etc|U\.S))'  # Not after abbreviations)
#         r'(?<!\d)'  # Not after a digit (decimals like 1.5)
#         r'[.!?]'    # Sentence ending punctuation
#         r'(?=\s+[A-Z]|\s*$)'  # Followed by space+capital or end of string
#     )

#     sentences = sentence_endings.split(text)
#     # Clean up: strip whitespace, remove empty strings
#     return [s.strip() for s in sentences if s.strip()]

def _split_into_sentences(text: str) -> list[str]:
    """
    Split text into sentences using simple punctuation rules.
    
    Handles financial text by splitting on '. ' (period-space)
    rather than just period, avoiding splits on decimals like $1.5B.
    """
    # Split on period/question/exclamation followed by a space
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in parts if s.strip()]

def _estimate_tokens(text: str) -> int:
    '''
    Estimate token count from text.
    
    A rough approximation: 1 token ≈ 4 characters for English.
    This avoids importing a tokenizer for speed.
    For production, consider using tiktoken for exact counts.
    '''
    return len(text) // 4

def chunk_document (document: FinancialDocument, 
                    chunk_size: int | None = None,
                    chunk_overlap: int | None = None    
) -> list[TextChunk]:
    """
    Split a FinancialDocument into TextChunks.
    
    Args:
        document: The document to chunk
        chunk_size: Max tokens per chunk (default from settings)
        chunk_overlap: Overlap tokens between chunks (default from settings)
    
    Returns:
        List of TextChunks ready for embedding
    """


    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap

    text = document.content.strip()

    # If text is small enough, return as single chunk
    if _estimate_tokens(text) <= chunk_size: 
        return [TextChunk(
            text=text, 
            chunk_index=0, 
            total_chunks=1, 
            metadata=document.metadata,
        )]
    
    # Split into paragraphs first (preserving financial text structure)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    # Then build chunks from paragraphs, ensuring we don't split sentences if possible
    chunks: list[str] = []
    current_chunk = ""

    for paragraph in paragraphs: 
        para_tokens = _estimate_tokens(paragraph)
        current_tokens = _estimate_tokens(current_chunk)

        # IF paragraph alone exceeds chunk_size, split it into sentences 
        if para_tokens > chunk_size: 
            # Save current chunk if it has content 
            if current_chunk: 
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # Split paragraph into sentences and build chunks 
            sentences = _split_into_sentences(paragraph)
            for sentence in sentences: 
                sent_tokens = _estimate_tokens(sentence)
                curren_tokens = _estimate_tokens(current_chunk)

                if current_tokens + sent_tokens <= chunk_size:
                    current_chunk += " " + sentence if current_chunk else sentence
                
                else:
                    if current_chunk: 
                        chunks.append(current_chunk.strip())
                    current_chunk = sentence

        # If adding paragraph fits within chunk_size, append it
        elif current_tokens + para_tokens <= chunk_size: 
            current_chunk += "\n\n" + paragraph if current_chunk else paragraph

        # Otherwise, save current chunk and start new one
        else:   
            if current_chunk: 
                chunks.append(current_chunk.strip())
            current_chunk = paragraph

    # Don't forget the last chunk 
    if current_chunk: 
        chunks.append(current_chunk.strip())

    # Add overlap tokens if needed (simple approach: just repeat last part of previous chunk)
    if chunk_overlap > 0 and len(chunks) > 1:
        chunks = _add_overlap(chunks, chunk_overlap)

    
    # Convert to TextChunk objects
    total = len(chunks)
    return [TextChunk(
        text=chunk_text, 
        chunk_index=i,
        total_chunks=total,
        metadata=document.metadata, 
    ) 
    for i, chunk_text in enumerate(chunks)
    ]

def _add_overlap(chunks: list[str], overlap_tokens: int) -> list[str]:
    """
    Add overlap between consecutive chunks.
    
    Takes the last N tokens from chunk[i] and prepends
    them to chunk[i+1]. This preserves context at boundaries.
    """
    overlap_chars = overlap_tokens * 4  # Convert tokens to approximate chars
    result = [chunks[0]]  # First chunk stays as-is
    
    for i in range(1, len(chunks)):
        # Get the tail of the previous chunk
        prev_chunk = chunks[i - 1]
        overlap_text = prev_chunk[-overlap_chars:] if len(prev_chunk) > overlap_chars else prev_chunk
        
        # Find a word boundary in the overlap to avoid cutting words
        space_idx = overlap_text.find(" ")
        if space_idx > 0:
            overlap_text = overlap_text[space_idx + 1:]
        
        # Prepend overlap to current chunk
        result.append(f"...{overlap_text} {chunks[i]}")
    
    return result

def chunk_texts(texts: list[str], metadata: ChunkMetadata,
                chunk_size: int | None = None) -> list[TextChunk]:
    """
    Convenience function: chunk a list of raw text strings. 

    Useful when you have text that isn't yet wrapped in 
    a FinancialDocument (e.g., raw API responses)
    """
    all_chunks = []
    for i, text in enumerate(texts):
        doc = FinancialDocument(
            id=str(i), 
            content=text, 
            metadata=metadata,
        )
        all_chunks.extend(chunk_document(doc, chunk_size=chunk_size))
    return all_chunks



    