SHELL := /bin/bash
.DEFAULT_GOAL := help

PIP := .venv/bin/pip
RUFF := .venv/bin/ruff
MYPY := .venv/bin/mypy
ALEMBIC := .venv/bin/alembic
DEV_DATABASE_URL := postgresql+psycopg://automation_hub:automation_hub_dev@localhost:$${POSTGRES_PORT:-5432}/automation_hub

.PHONY: help setup install up down dev logs db-up db-down db-reset migrate migration lint format typecheck clean health

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Install dependencies, start PostgreSQL, and migrate
	@test -f .env || cp .env.example .env
	@$(MAKE) install
	@$(MAKE) db-up
	@$(MAKE) migrate

install: ## Install pinned backend and frontend dependencies
	@test -x .venv/bin/pip || virtualenv -p python3 .venv
	@$(PIP) install --upgrade pip
	@$(PIP) install -e './backend[dev]'
	@npm --prefix frontend ci

up: ## Build and start the complete stack
	docker compose up -d --build

down: ## Stop the complete stack
	docker compose down

dev: ## Run the complete stack in the foreground
	docker compose up --build

logs: ## Follow application logs
	docker compose logs -f backend frontend postgres

db-up: ## Start PostgreSQL and wait until healthy
	docker compose up -d postgres
	@until docker compose exec -T postgres pg_isready -U automation_hub -d automation_hub >/dev/null 2>&1; do sleep 1; done

db-down: ## Stop PostgreSQL
	docker compose stop postgres

db-reset: ## Recreate PostgreSQL volumes and migrate (destructive)
	docker compose down -v
	@$(MAKE) db-up
	@$(MAKE) migrate

migrate: ## Apply development database migrations
	cd backend && DATABASE_URL=$(DEV_DATABASE_URL) ../$(ALEMBIC) upgrade head

migration: ## Create migration; use NAME='description'
	@test -n "$(NAME)" || (echo "NAME is required, e.g. make migration NAME='add field'" && exit 2)
	cd backend && DATABASE_URL=$(DEV_DATABASE_URL) ../$(ALEMBIC) revision --autogenerate -m "$(NAME)"

lint: ## Check backend and frontend code quality
	$(RUFF) check backend
	$(RUFF) format --check backend
	npm --prefix frontend run lint

format: ## Format backend and frontend code
	$(RUFF) check --fix backend
	$(RUFF) format backend
	npm --prefix frontend run format

typecheck: ## Type-check backend and frontend
	$(MYPY) backend/app
	npm --prefix frontend run typecheck

clean: ## Remove generated local artifacts and caches
	rm -rf .mypy_cache .ruff_cache frontend/dist
	find backend -type d -name __pycache__ -prune -exec rm -rf {} +

health: ## Check Docker services and public endpoints
	docker compose ps
	curl --fail --silent http://localhost:$${BACKEND_PORT:-8000}/health
	@echo
	curl --fail --silent http://localhost:$${BACKEND_PORT:-8000}/api/v1/status
	@echo
	curl --fail --silent http://localhost:$${FRONTEND_PORT:-5173} >/dev/null
	@echo "Frontend is healthy"
