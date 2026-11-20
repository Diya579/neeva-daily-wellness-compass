"""
Standalone Local HTTP Server for Neeva AI Payment Demonstration (`/payment-demo/`).
Completely isolated from `/frontend/` and `/backend/`.
Usage:
    python payment-demo/server.py --port 4173
"""
from __future__ import annotations

import argparse
import functools
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

DEMO_DIR = Path(__file__).resolve().parent


def run_server(host: str = "127.0.0.1", port: int = 4173) -> None:
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(DEMO_DIR))
    server = HTTPServer((host, port), handler)
    print(f"Neeva AI Isolated Payment Demo running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve Neeva AI Isolated Payment Demo")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    run_server(args.host, args.port)

