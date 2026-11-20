# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    ENVIRONMENT=production \
    ZERO_COST_MODE=true \
    DATABASE_MODE=local_sqlite \
    VOICE_MODE=browser_native \
    AUTH_MODE=local

WORKDIR /app

COPY backend/requirements-cloudrun.txt /app/requirements-cloudrun.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements-cloudrun.txt

COPY backend /app/backend
COPY payment-demo /app/payment-demo

RUN mkdir -p /app/backend/data && \
    groupadd -r neeva && useradd -r -g neeva -d /app -s /sbin/nologin neeva && \
    chown -R neeva:neeva /app

USER neeva
WORKDIR /app/backend

EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2"]

