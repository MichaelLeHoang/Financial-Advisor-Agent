# RAG Module

## Purpose
Implements retrieval-augmented generation over financial documents stored in Qdrant.

## Responsibilities
- Embed queries and retrieve filtered document chunks.
- Build bounded, source-labeled context.
- Generate cited responses through the configured LLM.
- Expose a simple pipeline entry point.

## Key Files
- `retriever.py`: embeddings and Qdrant retrieval.
- `context_builder.py`: context assembly and size limits.
- `generator.py`: Gemini response generation.
- `pipeline.py`: end-to-end `ask` workflow.

## Boundaries
Embedding and ingestion implementations live in `services/`; vector persistence lives in `data/vector_db.py`; shared schemas live in `models/`.

## Testing
Mock embeddings, Qdrant, and LLM generation. Cover empty retrieval, ticker filters, context limits, citations, and provider failures.

## Latest Change
- Updated generation to the current Google GenAI SDK while retaining the existing retrieval and context pipeline.
