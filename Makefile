# ─────────────────────────────────────────────────────────────────────────────
#  QuanAd — Makefile
#  Run from the project root: Financial-Advisor-Agent/
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
BACKEND_PORT := 8000
FRONTEND_PORT := 3000

.PHONY: help dev backend frontend install install-backend install-frontend \
        test test-unit test-integration cli stop clean ngrok ngrok-static \
        docker-up docker-up-d docker-down docker-build docker-logs docker-shell docker-ps

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

# ─── Ngrok Tunnel ────────────────────────────────────────────────────────────

ngrok: ## Start ngrok tunnel for the backend (random URL)
	@echo ""
	@echo "  Starting ngrok tunnel → localhost:$(BACKEND_PORT)"
	@echo "  Copy the Forwarding URL and set it as NEXT_PUBLIC_API_URL in Vercel."
	@echo ""
	ngrok http $(BACKEND_PORT)

ngrok-static: ## Start ngrok tunnel with a static domain (set NGROK_DOMAIN env var)
	@if [ -z "$(NGROK_DOMAIN)" ]; then \
		echo "  Error: Set NGROK_DOMAIN first."; \
		echo "  Usage: make ngrok-static NGROK_DOMAIN=your-domain.ngrok-free.app"; \
		exit 1; \
	fi
	@echo ""
	@echo "  Starting ngrok tunnel → localhost:$(BACKEND_PORT)"
	@echo "  Static domain: https://$(NGROK_DOMAIN)"
	@echo ""
	ngrok http $(BACKEND_PORT) --url=$(NGROK_DOMAIN)

# ─── Docker ──────────────────────────────────────────────────────────────────

docker-up: ## Build images and start backend + Qdrant (foreground)
	docker compose up --build

docker-up-d: ## Build images and start backend + Qdrant (detached)
	@echo "  Starting QuanAd via Docker..."
	docker compose up --build -d
	@echo ""
	@echo "  Backend  → http://localhost:$(BACKEND_PORT)/docs"
	@echo "  Qdrant   → http://localhost:6333"
	@echo "  Run 'make docker-logs' to stream logs."

docker-down: ## Stop and remove containers (keeps volumes)
	docker compose down

docker-build: ## Rebuild the backend image without starting
	docker compose build backend

docker-logs: ## Stream logs from all Docker services
	docker compose logs -f

docker-shell: ## Open a shell inside the running backend container
	docker compose exec backend bash

docker-ps: ## Show status of all Docker services
	docker compose ps
