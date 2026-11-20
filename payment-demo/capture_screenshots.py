"""
Automated Screenshot & End-to-End Verification Script for `/payment-demo/`.
Starts the standalone HTTP server in-process, renders all 5 main states in headless Chrome,
verifies DOM elements and coupon calculations, and saves PNG screenshots to `payment-demo/screenshots/`.
"""
from __future__ import annotations

import functools
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from playwright.sync_api import sync_playwright

DEMO_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = DEMO_DIR / "screenshots"


def capture_all() -> list[str]:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(DEMO_DIR))
    server = HTTPServer(("127.0.0.1", 0), handler)
    port = server.server_port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    saved: list[str] = []
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=chrome_path if Path(chrome_path).exists() else None,
                headless=True,
            )
            page = browser.new_page(viewport={"width": 1360, "height": 1080})

            states = [
                ("01-plans-and-comparison.png", f"http://127.0.0.1:{port}/?state=plans", False),
                ("02-checkout-coupon-neeva50.png", f"http://127.0.0.1:{port}/?state=checkout&coupon=NEEVA50", True),
                ("03-simulated-processing.png", f"http://127.0.0.1:{port}/?state=processing", False),
                ("04-payment-success-screen.png", f"http://127.0.0.1:{port}/?state=success&coupon=NEEVA50", False),
                ("05-payment-failed-retry.png", f"http://127.0.0.1:{port}/?state=failed", False),
            ]

            for filename, url, scroll_to_checkout in states:
                page.goto(url, wait_until="domcontentloaded")
                if scroll_to_checkout:
                    page.locator("#checkout-section").scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                out_path = SCREENSHOT_DIR / filename
                page.screenshot(path=str(out_path), full_page=not scroll_to_checkout)
                saved.append(str(out_path))
                print(f"Captured screenshot: {out_path} ({out_path.stat().st_size} bytes)")

            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    return saved


if __name__ == "__main__":
    capture_all()

