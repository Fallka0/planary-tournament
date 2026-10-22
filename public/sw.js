// Planary Tournament: keeps the beamer working without internet. Pages and scripts are cached as
// they load; when the network is gone, the last copy answers. The tournament data itself lives in
// the page (localStorage), so the beamer shows the last state it saw.
const CACHE = "tournament-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Built assets never change under the same name: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(?:woff2|svg|png|ico)$/)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }
  // Pages: network first, the last copy when offline. Only the public pages and the beamer.
  if (req.mode === "navigate" && !url.pathname.endsWith("/verwalten")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
  }
});
