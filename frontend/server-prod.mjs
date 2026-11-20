/**
 * Unified Production Server for Google Cloud Run (`frontend/server-prod.mjs`)
 * Serves the complete Neeva full-stack product on ONE single public HTTPS URL:
 * - `/api/*`, `/health`, `/docs`, `/openapi.json`, `/payment-demo*` -> proxied to internal FastAPI (127.0.0.1:8081)
 * - Static client assets in `dist/client/*` -> served directly with cache headers
 * - All application routes (`/`, `/auth`, `/today`, `/chat`, `/journal`, `/hub`, `/community`, `/settings`)
 *   -> rendered by TanStack Start SSR (`dist/server/server.js`)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const BACKEND_ORIGIN = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8081";
const CLIENT_DIR = path.resolve(__dirname, "dist/client");

const { default: ssrServer } = await import("./dist/server/server.js");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

function isBackendPath(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/health" ||
    pathname === "/docs" ||
    pathname === "/openapi.json" ||
    pathname === "/payment-demo" ||
    pathname.startsWith("/payment-demo/")
  );
}

async function readNodeRequestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyToFastAPI(req, res, urlObj) {
  const targetUrl = `${BACKEND_ORIGIN}${urlObj.pathname}${urlObj.search}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v || k.toLowerCase() === "host" || k.toLowerCase() === "connection") continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }

  const body = await readNodeRequestBody(req);
  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    const outHeaders = {};
    upstream.headers.forEach((val, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      outHeaders[key] = val;
    });

    res.writeHead(upstream.status, outHeaders);
    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("[Unified Server] Backend proxy error:", err);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Backend starting up, please retry in a moment." }));
  }
}

function tryServeStatic(res, pathname) {
  const cleanRel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!cleanRel || cleanRel.includes("..")) return false;
  const fullPath = path.join(CLIENT_DIR, cleanRel);
  if (!fullPath.startsWith(CLIENT_DIR)) return false;
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return false;

  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const cacheControl = pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": cacheControl,
  });
  fs.createReadStream(fullPath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const urlObj = new URL(req.url || "/", `${proto}://${host}`);

  // 1. Proxy backend & payment-demo routes to FastAPI on 127.0.0.1:8081
  if (isBackendPath(urlObj.pathname)) {
    await proxyToFastAPI(req, res, urlObj);
    return;
  }

  // 2. Serve built static frontend assets from dist/client/
  if (req.method === "GET" || req.method === "HEAD") {
    if (tryServeStatic(res, urlObj.pathname)) return;
  }

  // 3. Render application routes via TanStack Start SSR
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    const body = await readNodeRequestBody(req);
    const webRequest = new Request(urlObj.toString(), {
      method: req.method,
      headers,
      body,
    });

    const webResponse = await ssrServer.fetch(webRequest);
    const outHeaders = {};
    webResponse.headers.forEach((val, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      outHeaders[key] = val;
    });
    res.writeHead(webResponse.status, outHeaders);

    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("[Unified Server] SSR error:", err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Neeva Full-Stack] Listening on http://0.0.0.0:${PORT} (Backend -> ${BACKEND_ORIGIN})`);
});

