# CaseFlow Agent — single container serving the API and the built SPA.
# Local mode by default: the container runs with ZERO credentials and
# synthetic data only. GCP adapters activate via env, never by default.
#
#   docker build -t caseflow-agent .
#   docker run -p 8080:8080 caseflow-agent
#
# Cloud Run honors $PORT; no secrets are baked into the image.

FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /srv
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY backend/ ./backend/
RUN pip install ./backend

COPY --from=frontend /build/dist ./frontend_dist
ENV CASEFLOW_STATIC_DIR=/srv/frontend_dist

EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
