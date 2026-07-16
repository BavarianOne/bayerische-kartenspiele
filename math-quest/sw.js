/**
 * Math Quest: Number Kingdom - Service Worker
 * Provides offline support and caching
 */

const CACHE_NAME = 'math-quest-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/main.css',
    '/css/ui.css',
    '/css/map.css',
    '/css/challenge.css',
    '/js/storage.js',
    '/js/audio.js',
    '/js/challenges.js',
    '/js/game.js',
    '/js/ui.js',
    '/js/map.js',
    '/js/main.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) return;
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    // Update cache in background
                    event.waitUntil(
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse.ok) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => cache.put(event.request, networkResponse));
                                }
                            })
                            .catch(() => {}) // Ignore network errors
                    );
                    return cachedResponse;
                }
                
                // Fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache successful responses
                        if (networkResponse.ok) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, responseClone));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Offline fallback for HTML pages
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        // Return a generic offline response for other resources
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'getVersion') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-progress') {
        event.waitUntil(syncProgress());
    }
});

async function syncProgress() {
    // This would sync any offline progress when back online
    console.log('Syncing progress...');
    // Implementation would depend on backend API
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-updates') {
        event.waitUntil(checkForUpdates());
    }
});

async function checkForUpdates() {
    try {
        const response = await fetch('/manifest.json', { cache: 'no-cache' });
        if (response.ok) {
            const manifest = await response.json();
            // Notify clients of update
            const clients = await self.clients.matchAll();
            clients.forEach((client) => {
                client.postMessage({ type: 'updateAvailable', manifest });
            });
        }
    } catch (error) {
        console.log('Update check failed:', error);
    }
}