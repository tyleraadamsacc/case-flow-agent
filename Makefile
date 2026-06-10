# CaseFlow Agent — local developer commands.
# Everything runs locally with zero GCP credentials.

# Prefer the newest available Python (>=3.11 required by backend/pyproject.toml).
PYTHON ?= $(shell command -v python3.13 || command -v python3.12 || command -v python3.11 || command -v python3)
VENV := backend/.venv

.PHONY: install install-backend install-frontend dev-backend dev-frontend \
        test test-unit test-api test-golden lint build-frontend \
        demo-scenario-a demo-reset

install: install-backend install-frontend

install-backend:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install -e "./backend[dev]"

install-frontend:
	cd frontend && npm install

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/pytest

test-unit:
	cd backend && .venv/bin/pytest tests/unit

test-api:
	cd backend && .venv/bin/pytest tests/api

test-golden:
	cd backend && .venv/bin/pytest tests/golden

lint:
	cd backend && .venv/bin/ruff check app tests scripts

# Scenario A end to end against a fresh in-process backend (zero credentials).
demo-scenario-a:
	cd backend && .venv/bin/python scripts/demo_scenario_a.py

# Local state is in-process only; a fresh run reseeds everything.
demo-reset:
	@echo "Local mock state is in-process only — every run starts fresh."
	@echo "Re-seed happens automatically on startup (CASEFLOW_SEED_ON_STARTUP=true)."

build-frontend:
	cd frontend && npm run build
