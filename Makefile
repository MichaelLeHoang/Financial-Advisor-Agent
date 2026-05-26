# ─────────────────────────────────────────────────────────────────────────────
#  QuanAd — Makefile
#  Run from the project root: Financial-Advisor-Agent/
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
BACKEND_PORT := 8000
FRONTEND_PORT := 3000

.PHONY: help dev backend frontend install install-backend install-frontend \
        test test-unit test-integration cli stop clean

# Default target
.DEFAULT_GOAL := help

help: ## Show available commands
	@echo ""
	@echo "  QuanAd — Development Commands"
	@echo "  ─────────────────────────────────────────────"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ─── Dev (both together) ─────────────────────────────────────────────────────

dev: ## Start backend + frontend together (Ctrl+C stops both)
	@echo ""
	@echo "  Starting QuanAd..."
	@echo "  Backend  → http://localhost:$(BACKEND_PORT)/docs"
	@echo "  Frontend → http://localhost:$(FRONTEND_PORT)"
	@echo "  Press Ctrl+C to stop both."
	@echo ""
	@trap 'kill 0' SIGINT SIGTERM; \
		( cd $(BACKEND_DIR) && uv run uvicorn src.api.app:app --reload --port $(BACKEND_PORT) ) & \
		( cd $(FRONTEND_DIR) && npm run dev -- --port $(FRONTEND_PORT) ) & \
		wait

# ─── Individual services ─────────────────────────────────────────────────────

backend: ## Start only the FastAPI backend (hot-reload)
	@echo "  Backend → http://localhost:$(BACKEND_PORT)/docs"
	cd $(BACKEND_DIR) && uv run uvicorn src.api.app:app --reload --port $(BACKEND_PORT)

frontend: ## Start only the Next.js frontend
	@echo "  Frontend → http://localhost:$(FRONTEND_PORT)"
	cd $(FRONTEND_DIR) && npm run dev -- --port $(FRONTEND_PORT)

cli: ## Run the interactive CLI agent (QuanAd 1.0)
	cd $(BACKEND_DIR) && uv run python main.py

# ─── Install ─────────────────────────────────────────────────────────────────

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install Python dependencies (uv sync)
	cd $(BACKEND_DIR) && uv sync

install-frontend: ## Install Node.js dependencies (npm install)
	cd $(FRONTEND_DIR) && npm install

# ─── Tests ───────────────────────────────────────────────────────────────────

test: ## Run all backend tests
	cd $(BACKEND_DIR) && uv run pytest -v

test-unit: ## Run fast unit tests only (no network)
	cd $(BACKEND_DIR) && uv run pytest tests/unit/ -v

test-integration: ## Run integration tests (downloads embedding model)
	cd $(BACKEND_DIR) && uv run pytest tests/integration/ -v

# ─── Utilities ───────────────────────────────────────────────────────────────

stop: ## Kill processes on backend and frontend ports
	@echo "  Stopping services on ports $(BACKEND_PORT) and $(FRONTEND_PORT)..."
	@lsof -ti :$(BACKEND_PORT) | xargs kill -9 2>/dev/null || true
	@lsof -ti :$(FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	@echo "  Done."

clean: ## Remove Python cache, build artifacts, and Next.js cache
	@echo "  Cleaning..."
	find $(BACKEND_DIR) -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -name "*.pyc" -delete 2>/dev/null || true
	rm -rf $(FRONTEND_DIR)/.next 2>/dev/null || true
	@echo "  Done."
