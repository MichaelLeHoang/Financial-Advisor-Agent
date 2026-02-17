from src.rag.retriever import Retriever
from src.rag.context_builder import build_context
from src.rag.generator import Generator
from src.models.schemas import RAGResponse

def ask(
    question: str,
    ticker_filter: str | None = None,
    top_k: int = 5,
) -> RAGResponse:
    """
    Ask the financial advisor a question.
    Full RAG pipeline:
    1. Retrieve relevant documents from Qdrant
    2. Build context-augmented prompt
    3. Generate response with Gemini
    Args:
        question: User's financial question
        ticker_filter: Optionally focus on specific ticker
        top_k: Number of documents to retrieve
    Usage:
        response = ask("How is Apple doing?", ticker_filter="AAPL")
        print(response.answer)
        print(response.format_with_citations())
    """
    # Retrieve
    retriever = Retriever()
    results = retriever.retrieve(question, top_k=top_k, tickers_filter=ticker_filter)
    print(f"Retrieved {len(results)} relevant documents")

    # Build context
    prompt = build_context(question, results)

    # Generate
    generator = Generator()
    response = generator.generate(question, prompt, results)
    print(f"Generated response (confidence: {response.confidence:.2f})")
    return response