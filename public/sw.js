const CACHE_NAME = 'grandcare-shell-v18';
const SHELL_FILES = [
  '/',
  '/styles.css?v=11',
  '/app.js?v=17',
  '/i18n.js',
  '/manifest.json',
  '/icons/grandcare.svg',
  '/icons/grandcare-192.png',
  '/icons/grandcare-512.png',
  '/medication-guide-tablet.gif?v=2',
  '/medication-guide-tablet.png?v=2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('grandcare-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/vendor/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) await (await caches.open(CACHE_NAME)).put('/', response.clone());
        return response;
      } catch { return (await caches.match('/')) || Response.error(); }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    try {
      const response = await fetch(request);
      if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});
