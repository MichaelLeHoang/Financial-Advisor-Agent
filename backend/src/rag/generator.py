import google.generativeai as genai
from src.config import settings
from src.models.schemas import RAGResponse, RetrievalResult

class Generator: 
    """
    Generates responses using Gemini LLM.
    Usage:
        generator = Generator()
        response = generator.generate(query, context_prompt, sources)
    """

    def __init__(self):
        api_key = settings.secret_value("gemini_api_key")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is required for RAG generation")

        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel("gemini-2.0-flash")
    def generate(
        self,
        query: str,
        prompt: str,
        sources: list[RetrievalResult],
    ) -> RAGResponse:
        """
        Generate a response from the LLM.
        Args:
            query: Original user question
            prompt: Full prompt with context (from context_builder)
            sources: Retrieved documents (for citation tracking)
        Returns:
            RAGResponse with answer and source citations
        """
        try:
            response = self._model.generate_content(prompt)
            answer = response.text
            # Estimate confidence based on retrieval scores
            if sources:
                avg_score = sum(s.score for s in sources) / len(sources)
                confidence = min(avg_score, 1.0)
            else:
                confidence = 0.3  # Low confidence without sources
            return RAGResponse(
                answer=answer,
                sources=sources,
                query=query,
                confidence=confidence,
            )
        except Exception as e:
            return RAGResponse(
                answer=f"I encountered an error generating a response: {str(e)}",
                sources=sources,
                query=query,
                confidence=0.0,
            )
