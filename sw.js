const CACHE_NAME = "weapon-loan-cache-v1.1.1"; // Update version number to force new cache

const ASSETS = [
  "index.html", 
  "style.css",
  "app.js",
  "manifest.json",
  "offline.html",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/weaponlog-logo.png",
  "assets/screenshots/screenshot-desktop.png",
  "assets/screenshots/screenshot-mobile.png"
];

// Install service worker and cache all files
self.addEventListener("install", event => {
  console.log("[SW] Installing and caching files...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache files individually and skip errors
      return Promise.all(
        ASSETS.map(file =>
          cache.add(file).catch(err => {
            console.warn(`[SW] Failed to cache ${file}:`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate and clean up old cache
self.addEventListener("activate", event => {
  console.log("[SW] Activating and cleaning up old cache...");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Handle fetch – network first for HTML/JS, then cache, else offline.html
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  
  // For HTML and JS: network-first (always get newest version first)
  if (event.request.mode === "navigate" || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the new version (clone before cache)
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          console.log("[SW] Network failed, using cache:", event.request.url);
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            if (event.request.mode === "navigate") {
              return caches.match("offline.html");
            }
          });
        })
    );
  } else {
    // For images and other assets: cache first (faster)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          console.log("[SW] From cache:", event.request.url);
          return cached;
        }
        return fetch(event.request).catch(() => {
          console.warn("[SW] Offline – using offline fallback");
          return caches.match("offline.html");
        });
      })
    );
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  self.clients.matchAll({ type: "window" }).then(clients => {
    clients.forEach(client => client.postMessage({ type: "NEW_VERSION" }));
  });
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});