#!/usr/bin/env sh
set -eu

# 1. Start internal FastAPI backend (SQLite WAL + Gemini + Payment Demo) on 127.0.0.1:8081
cd /app/backend
uvicorn main:app --host 127.0.0.1 --port 8081 --workers 2 &

# 2. Wait briefly for FastAPI socket readiness (up to 10s)
i=0
while [ "$i" -lt 20 ]; do
  if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/health', timeout=1)" 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 0.5
done

# 3. Start unified Node SSR + reverse-proxy server on Cloud Run $PORT (8080)
cd /app/frontend
export INTERNAL_BACKEND_URL="http://127.0.0.1:8081"
exec node /app/frontend/server-prod.mjs

