const CACHE_NAME = 'metzger-angebote-v2';
const STATIC_ASSETS = [
    'metzger-angebote.html',
    'manifest.json'
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
    
    // Skip cross-origin requests (but allow GitHub raw for JSON)
    const url = new URL(event.request.url);
    const isGitHubRaw = url.hostname === 'raw.githubusercontent.com';
    if (!event.request.url.startsWith(self.location.origin) && !isGitHubRaw) return;
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Serve from cache, update in background
                    event.waitUntil(
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse.ok) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => cache.put(event.request, networkResponse));
                                }
                            })
                            .catch(() => {})
                    );
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse.ok) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, responseClone));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Offline fallback for HTML pages
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('metzger-angebote.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Handle messages from client
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'getVersion') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body || 'Neue Metzger-Angebote verfügbar!',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🥩</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🥩</text></svg>',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || 'metzger-angebote.html'
        },
        actions: [
            { action: 'open', title: 'Öffnen' },
            { action: 'close', title: 'Schließen' }
        ],
        tag: 'metzger-angebote',
        renotify: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || '🥩 Metzger-Angebote', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'close') return;
    
    const url = event.notification.data?.url || 'metzger-angebote.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if already open
                for (const client of clientList) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// Background sync for checking new offers
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-new-offers') {
        event.waitUntil(checkNewOffers());
    }
});

async function checkNewOffers() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/BavarianOne/bayerische-kartenspiele/master/data/metzger/all.json');
        if (!response.ok) return;
        
        const data = await response.json();
        const lastCheck = await getLastCheck();
        const currentScraped = data.scraped_at;
        
        if (currentScraped && currentScraped !== lastCheck) {
            await setLastCheck(currentScraped);
            
            // Send notification to all clients
            const clients_list = await self.clients.matchAll({ includeUncontrolled: true });
            clients_list.forEach(client => {
                client.postMessage({
                    type: 'new-offers',
                    scraped_at: currentScraped
                });
            });
            
            // Also show push notification
            await self.registration.showNotification('🥩 Neue Metzger-Angebote!', {
                body: `Aktualisiert am ${new Date(currentScraped).toLocaleString('de-DE')}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🥩</text></svg>',
                tag: 'metzger-angebote-new',
                renotify: true
            });
        }
    } catch (err) {
        console.error('[SW] Error checking new offers:', err);
    }
}

async function getLastCheck() {
    const cache = await caches.open('metzger-meta');
    const response = await cache.match('last-check');
    if (response) {
        const text = await response.text();
        return text;
    }
    return null;
}

async function setLastCheck(value) {
    const cache = await caches.open('metzger-meta');
    await cache.put('last-check', new Response(value));
}

// Periodic background sync (requires periodic-background-sync permission)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-offers-periodic') {
        event.waitUntil(checkNewOffers());
    }
});

// Handle messages from client for subscription
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'getVersion') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    // Register for periodic sync
    if (event.data?.type === 'registerPeriodicSync') {
        event.waitUntil(
            self.registration.periodicSync?.register('check-offers-periodic', {
                minInterval: 24 * 60 * 60 * 1000 // 24 hours
            }).catch(err => console.log('[SW] Periodic sync not available:', err))
        );
    }
});