const CACHE = "nimanto-shell-v3";
const SHELL = [
  "./",
  "./workspace/",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/emblem-animated.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

// An offline navigation falls back to the shell for the route that was asked
// for, not to the site root. Serving the landing page in place of /workspace/
// would make "the workbench is offline" look like "you are on the marketing
// site", which is precisely the state the connection banner exists to report.
function offlineShell(request) {
  const shell = new URL(request.url).pathname.includes("/workspace") ? "./workspace/" : "./";
  return caches.match(shell);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || offlineShell(event.request))));
});
