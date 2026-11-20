/**
 * Neeva Offline PWA Service Worker (`/sw.js`)
 * Caches the app shell, 4-7-8 breathing pacer routes, grounding exercises,
 * and crisis helpline cards (Tele-MANAS 14416 & iCall 9152987821) so they work
 * with zero internet connection or during API outages.
 */

const CACHE_NAME = "neeva-offline-v1";
const OFFLINE_CORE_ASSETS = [
  "/",
  "/today",
  "/hub",
  "/chat",
  "/journal",
  "/favicon.png",
  "/manifest.json",
];

const OFFLINE_CRISIS_FALLBACK_HTML = `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Neeva Offline Safety & 4-7-8 Breathing</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #FAF7F0; color: #1A1A1A; margin: 0; padding: 24px; }
    .card { max-width: 520px; margin: 20px auto; background: #FFF; border: 1.5px solid #1A1A1A; border-radius: 24px; padding: 24px; }
    .btn { display: inline-block; background: #C83E3B; color: #FFF; font-weight: 700; text-decoration: none; padding: 12px 18px; border-radius: 999px; margin: 6px 6px 6px 0; }
    .pacer { background: #E3EFE8; border-radius: 18px; padding: 16px; margin-top: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are not alone (Offline Safety Mode)</h1>
    <p>Even without an internet connection, immediate 24x7 Indian crisis support and 4-7-8 breathing are available right here:</p>
    <div>
      <a class="btn" href="tel:14416">Call Tele-MANAS · 14416 (24x7 Free)</a>
      <a class="btn" href="tel:9152987821">Call iCall · 9152987821</a>
      <a class="btn" href="tel:112">Emergency · 112</a>
    </div>
    <div class="pacer">
      <h2>4-7-8 Calming Breath</h2>
      <p><b>Inhale</b> quietly through your nose for <b>4 seconds</b>.</p>
      <p><b>Hold</b> your breath gently for <b>7 seconds</b>.</p>
      <p><b>Exhale</b> slowly through your mouth for <b>8 seconds</b>.</p>
    </div>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_CORE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response(OFFLINE_CRISIS_FALLBACK_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })
  );
});
