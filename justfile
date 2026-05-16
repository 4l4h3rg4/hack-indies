_default:
    @just --list

# ==== DEVELOPMENT ====

dev:
    docker compose up --build

dev-detached:
    docker compose up --build -d

down:
    docker compose down

# ==== FRONTEND ====

fe-install:
    cd frontend && pnpm install

fe-dev:
    cd frontend/apps/web && pnpm dev

fe-build:
    cd frontend/apps/web && pnpm build

fe-lint:
    cd frontend && pnpm lint

# ==== BACKEND ====

be-install:
    cd backend/services/api && pip install -e ".[dev]"

be-dev:
    cd backend/services/api && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

be-lint:
    ruff check backend/
    ruff format --check backend/

be-format:
    ruff format backend/

# ==== DOCKER ====

docker-build:
    docker compose build

docker-up:
    docker compose up

docker-logs:
    docker compose logs -f

docker-shell-api:
    docker compose exec api bash

# ==== CLEAN ====

clean:
    docker compose down -v --rmi local
    find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
    find . -type d -name .next -exec rm -rf {} + 2>/dev/null || true
    find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
