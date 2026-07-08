/* PAD//LINK service worker — offline app shell.
   Lets the installed PWA launch instantly from the home screen even before
   the server is reachable; the page then auto-connects over WebSocket. */
const CACHE = "padlink-v1";
const CORE = ["/", "/manifest.json", "/mapping.json", "/icon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network-first: a live server always wins (fresh UI + mapping); the cache
// only steps in when the server is down or the phone kept an old IP
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname === "/qr") return; // one-off profile QRs — nothing to cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || (e.request.mode === "navigate" ? caches.match("/") : undefined))
      )
  );
});
