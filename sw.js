const CACHE_VERSION = 'v1';
const CACHE_NAME = `shift-tracker-shell-${CACHE_VERSION}`;
const SHELL_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('shift-tracker-shell-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match(request, { ignoreSearch: true });
  }
}

async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached =
    (await cache.match(request, { ignoreSearch: true })) ||
    (await cache.match('/index.html')) ||
    (await cache.match('/'));

  // Update cache in background without blocking the response
  const networkUpdate = fetch(request).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Serve cache immediately if available, otherwise wait for network
  if (cached) return cached;
  return networkUpdate;
}
