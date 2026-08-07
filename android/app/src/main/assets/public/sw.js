const CACHE_NAME = 'wetter-radar-v1';
const STATIC_ASSETS = [
    'wetter.html',
    'manifest.json'
];

// Install event
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

// Activate event
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

// Fetch event - cache first for static, network first for API
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-GET
    if (event.request.method !== 'GET') return;
    
    // API requests - network first with cache fallback
    if (url.hostname.includes('open-meteo.com') || 
        url.hostname.includes('geocoding-api.open-meteo.com') ||
        url.hostname.includes('tile.openweathermap.org') ||
        url.hostname.includes('server.arcgisonline.com') ||
        url.hostname.includes('tile.openstreetmap.org') ||
        url.hostname.includes('tile.opentopomap.org')) {
        
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
    
    // Static assets - cache first
    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                if (cached) {
                    // Update in background
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
                    .catch(() => {
                        if (event.request.headers.get('accept')?.includes('text/html')) {
                            return caches.match('wetter.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Push notifications (for future server-side alerts)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || '⚠️ Wetterwarnung', {
            body: data.body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌤️</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌤️</text></svg>',
            vibrate: [100, 50, 100],
            tag: 'wetter-alert',
            renotify: true,
            actions: [{ action: 'open', title: 'Öffnen' }]
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'open' || !event.action) {
        event.waitUntil(clients.openWindow('wetter.html'));
    }
});

// Periodic background sync for weather alerts
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-weather-alerts') {
        event.waitUntil(checkWeatherAlerts());
    }
});

async function checkWeatherAlerts() {
    // This would check for severe weather and notify
    // For now, placeholder - would need a backend or DWD API integration
    console.log('[SW] Checking weather alerts...');
}

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});