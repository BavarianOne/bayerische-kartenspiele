const CACHE = 'spritalarm-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/idb.js',
  '/js/clever-tanken.js',
  '/js/app.js',
  '/js/sw-register.js',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
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
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'fuel-prices') {
    event.waitUntil(refreshFuelPrices());
  }
});

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS);
}

async function cleanupOldCaches() {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
}

async function refreshFuelPrices() {
  try {
    const clients = await self.clients.matchAll();
    await clients.forEach((c) => c.postMessage({ type: 'FUEL_REFRESH' }));
  } catch (err) {
    console.warn('Background refresh failed', err);
  }
}