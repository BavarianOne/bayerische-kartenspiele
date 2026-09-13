const CACHE_NAME = 'bayerische-spiele-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './sw.js'
];

const HTML_PAGES = [
    './index.html',
    './landshut-spritpreise.html',
    './metzger-angebote.html',
    './benzinpreise.html',
    './benzinpreise-strasswalchen.html',
    './wetter.html',
    './2028.html',
    './2048.html',
    './DominoSimulator.html',
    './WallacherMobile3.html',
    './WallacherMobile4.html',
    './asteroids.html',
    './auto.html',
    './brecher.html',
    './burj-khalifa-3d.html',
    './earth-dashboard.html',
    './familienurlaub-strasswalchen.html',
    './flappy-bird.html',
    './history.html',
    './igelspiel.html',
    './kompass.html',
    './kopfrechnen-5klasse.html',
    './lebensmittel-angebote.html',
    './maibaum-kraxler-assets.html',
    './maibaum-kraxler.html',
    './malen-nach-zahlen.html',
    './maze3d.html',
    './memory.html',
    './monster-schnapp.html',
    './muehle.html',
    './neon-velocity-chrono-run-3d.html',
    './neon-velocity-chrono-run.html',
    './neonblocks.html',
    './neonshooter.html',
    './neontangram.html',
    './neonufo.html',
    './neunerln3.html',
    './planet-lander-3d.html',
    './pong-3d.html',
    './qr-code-reader.html',
    './rainbow-catch.html',
    './reaction-tester.html',
    './rhythm-quest.html',
    './schach.html',
    './schafkopf.html',
    './schafkopf2.html',
    './shapeCreate.html',
    './shapefusion.html',
    './smartphone-sensors.html',
    './snake.html',
    './solar-system-kids.html',
    './space-explorer-3d.html',
    './space3d.html',
    './sternhimmel.html',
    './subway-runner-3d.html',
    './towers-of-hanoi-2d.html',
    './towers-of-hanoi-3d.html',
    './typing-adventure.html',
    './uno.html',
    './viergewinnt.html',
    './watten.html',
    './weather.html',
    './wordament.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - cache first for static, network first for dynamic
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests (APIs, external resources)
    if (url.origin !== location.origin) {
        // For external resources (Google Fonts, etc.), use network first with cache fallback
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // HTML pages - network first with cache fallback, then cache
    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
                .then((cached) => cached || caches.match('./index.html'))
        );
        return;
    }

    // Static assets (CSS, JS, images, manifest, icons) - cache first
    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                if (cached) {
                    // Update in background (stale-while-revalidate)
                    event.waitUntil(
                        fetch(event.request)
                            .then(r => r.ok && caches.open(CACHE_NAME).then(c => c.put(event.request, r)))
                            .catch(() => {})
                    );
                    return cached;
                }
                return fetch(event.request)
                    .then(r => {
                        if (r.ok) {
                            const clone = r.clone();
                            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                        }
                        return r;
                    })
                    .catch(() => new Response('Offline', { status: 503 }));
            })
    );
});

// Handle skipWaiting message
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});