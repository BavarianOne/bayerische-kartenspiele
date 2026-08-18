const CACHE = 'landshut-spritpreise-v1';
const ASSETS = [
  '/landshut-spritpreise-pwa/',
  '/landshut-spritpreise-pwa/index.html',
  '/landshut-spritpreise-pwa/manifest.json',
  '/landshut-spritpreise-pwa/css/app.css',
  '/landshut-spritpreise-pwa/js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanupOldCaches());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  
  // HTML-Seiten: Network First (für aktuelle Preise)
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req));
    return;
  }
  
  // Assets: Cache First
  event.respondWith(cacheFirst(req));
});

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS);
}

async function cleanupOldCaches() {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response('Offline - keine zwischengespeicherten Daten', { status: 503 });
  }
}