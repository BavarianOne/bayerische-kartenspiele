const CACHE_NAME = 'metzger-angebote-v1';
const STATIC_ASSETS = [
    'metzger-angebote.html',
    'metzger-manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW Metzger] Caching static assets');
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

// Fetch event - cache first for static, network first for dynamic
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-GET
    if (event.request.method !== 'GET') return;
    
    // Static assets - cache first
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) || 
        url.pathname === '/' || 
        url.pathname === '/metzger-angebote.html') {
        
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
                                return caches.match('metzger-angebote.html');
                            }
                            return new Response('Offline', { status: 503 });
                        });
                })
        );
        return;
    }
    
    // Other requests - network first with cache fallback
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
});

// Handle messages
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});