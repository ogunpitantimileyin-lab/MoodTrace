const CACHE_NAME = 'moodtrace-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/profile.html',
  '/add-entry.html',
  '/history.html',
  '/analytics.html',
  '/monthly.html',
  '/journal.html',
  '/settings.html',
  '/insights.html',
  '/share.html',
  '/styles.css',
  '/storage.js',
  '/auth.js',
  '/firebase-config.js',
  '/app.js',
  '/manifest.json',
  '/moodtrace-logo.svg'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('Some resources failed to cache during install:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache first, network fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      
      return fetch(event.request).then(response => {
        // Don't cache non-successful responses or external APIs
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Return offline page or cached response on network failure
        return caches.match(event.request);
      });
    })
  );
});

// Handle reminders in the background
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_REMINDERS') {
    // Check and trigger reminders
  }
});
