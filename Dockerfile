# syntax=docker/dockerfile:1
# ============================================================================
# Stage 1: Build Frontend (TanStack Start + React + Vite)
# ============================================================================
FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ============================================================================
# Stage 2: Unified Full-Stack Production Runtime (Node 22 + Python 3.11)
# Serves Frontend + FastAPI Backend + Gemini + Payment Demo on ONE URL ($PORT)
# ============================================================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    ENVIRONMENT=production \
    ZERO_COST_MODE=true \
    DATABASE_MODE=local_sqlite \
    VOICE_MODE=browser_native \
    AUTH_MODE=local \
    INTERNAL_BACKEND_URL=http://127.0.0.1:8081

# Copy Node 22 runtime binary from builder stage
COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

# Install Python backend dependencies
COPY backend/requirements-cloudrun.txt /app/requirements-cloudrun.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements-cloudrun.txt

# Copy Backend, Payment Demo, and Built Frontend
COPY backend /app/backend
COPY payment-demo /app/payment-demo
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY --from=frontend-builder /app/frontend/node_modules /app/frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json /app/frontend/package.json
COPY frontend/server-prod.mjs /app/frontend/server-prod.mjs
COPY start-cloudrun.sh /app/start-cloudrun.sh

RUN sed -i 's/\r$//' /app/start-cloudrun.sh && \
    chmod +x /app/start-cloudrun.sh && \
    mkdir -p /app/backend/data && \
    groupadd -r neeva && useradd -r -g neeva -d /app -s /sbin/nologin neeva && \
    chown -R neeva:neeva /app

USER neeva
EXPOSE 8080

CMD ["/app/start-cloudrun.sh"]
