# ─────────────────────────────────────────────────────────────────────────────
#  QuanAd Backend — Dockerfile
#  Multi-stage build: uv installs deps → slim runtime image
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies with uv ────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

WORKDIR /app

# Cache-efficient: copy lock files first so this layer is reused when only
# source code changes.
COPY pyproject.toml uv.lock ./

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install all production dependencies (no dev extras, no editable project).
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Copy application source and install the project itself.
COPY src/ ./src/
COPY main.py ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ── Stage 2: Slim runtime image ──────────────────────────────────────────────
FROM python:3.13-slim-bookworm AS runtime

WORKDIR /app

# Copy the pre-built virtual environment and source from the builder.
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src   /app/src
COPY --from=builder /app/main.py /app/main.py

# Ensure the venv is on PATH.
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Non-root user for security.
RUN useradd --create-home --shell /bin/bash quanad
USER quanad

EXPOSE 8000

# Health check — FastAPI exposes /health by default.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
