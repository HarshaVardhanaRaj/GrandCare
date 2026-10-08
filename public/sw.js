/**
 * sw.js — Service Worker for DoseDial Offline PWA Support
 * Caches static shell files for Wear OS offline execution.
 */

const CACHE_NAME = 'dosedial-v1';
const STATIC_ASSETS = [
  '/',
  '/watch.html',
  '/watch.css',
  '/watch.js',
  '/setup.html',
  '/setup.css',
  '/setup.js',
  '/dashboard.html',
  '/dashboard.css',
  '/dashboard.js',
  '/style.css',
  '/demo-dock.css',
  '/demo-dock.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for static assets, bypass API calls to live server
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/watch.html');
          }
        })
      );
    })
  );
});
