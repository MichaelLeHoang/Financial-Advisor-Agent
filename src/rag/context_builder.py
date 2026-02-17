
def build_context(
    query: str,
    retrieval_results: list,
    max_context_chars: int = 6000,
) -> str:
    """
    Build a structured context string from retrieved documents.
    Args:
        query: The user's original question
        retrieval_results: List of RetrievalResult from retriever
        max_context_chars: Maximum characters for context section
    Returns:
        Formatted context string ready for LLM prompt
    """
    if not retrieval_results:
        return _build_no_context_prompt(query)
    
    # Build numbered source sections 
    context_parts = []
    total_chars = 0

    for i, result in enumerate(retrieval_results): 
        source_label = result.metadata.source or "Unknown" 
        title = result.metadata.title or "Untitled"
        tickers = ", ".join(result.metadata.tickers) if result.metadata.tickers else "N/A"
        score = f"{result.score:.3f}"

        section = (
            f"[Source {i + 1}] ({source_label}) - {title}\n"
            f"Tickers: {tickers} | Relevance: {score}\n"
            f"{result.text}\n"
        )
    
    # Check if adding this section exceeds limit
        if total_chars + len(section) > max_context_chars:
            break
        context_parts.append(section)
        total_chars += len(section)
    context_block = "\n---\n".join(context_parts)
    prompt = f"""You are a professional financial advisor AI assistant. You provide helpful, 
accurate financial analysis based on real market data and news.
IMPORTANT RULES:
- Base your answer on the provided context below
- Cite sources using [1], [2], etc. notation
- If the context doesn't contain enough info, say so honestly
- Include relevant financial metrics when available
- Always end with a disclaimer that this is not professional financial advice
=== RETRIEVED CONTEXT ===
{context_block}
=== END CONTEXT ===
USER QUESTION: {query}
Please provide a thorough, well-cited analysis:"""
    return prompt


def _build_no_context_prompt(query: str) -> str:
    """Fallback prompt when no context is retrieved."""
    
    return f"""You are a professional financial advisor AI assistant.
Note: No relevant documents were found in the knowledge base for this query.
Please answer based on your general knowledge, and clearly state that your 
response is not based on current market data.
USER QUESTION: {query}
Please provide your best analysis, noting the limitation:"""