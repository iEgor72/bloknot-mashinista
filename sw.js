const CACHE_VERSION = 'v13';
const CACHE_NAME = `shift-tracker-shell-${CACHE_VERSION}`;
const NAVIGATION_FALLBACK_URL = '/index.html';
const NETWORK_TIMEOUT_MS = 1200;
const SHELL_URLS = [
  '/',
  '/index.html',
  '/styles/00-base.css',
  '/styles/10-navigation-and-cards.css',
  '/styles/15-bottom-nav.css',
  '/styles/20-form-and-stats.css',
  '/styles/30-shifts-and-overlays.css',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-cyrillic-ext.woff2',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-vietnamese.woff2',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext.woff2',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin.woff2',
  '/scripts/safe-area.js',
  '/scripts/nav-debug.js',
  '/scripts/instructions/normalizeText.js',
  '/scripts/instructions/tokenize.js',
  '/scripts/instructions/buildChargrams.js',
  '/scripts/instructions/fuzzy.js',
  '/scripts/instructions/parseHierarchy.js',
  '/scripts/instructions/parseInstruction.js',
  '/scripts/instructions/buildSearchEntities.js',
  '/scripts/instructions/rankResults.js',
  '/scripts/instructions/searchInstructions.js',
  '/scripts/instructions/instructionsDb.js',
  '/scripts/app.js',
  '/scripts/app-init.js',
  '/scripts/sw-register.js',
  '/assets/instructions/catalog.v2.json',
  '/assets/docs/manifest.json',
  '/assets/pdfjs/pdf.min.js',
  '/assets/pdfjs/pdf.worker.min.js',
  '/sw.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await warmShellCache();
    await self.skipWaiting();
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
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data && data.type === 'WARMUP_CACHE') {
    event.waitUntil(warmShellCache());
  }
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

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function warmShellCache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    SHELL_URLS.map(async (assetUrl) => {
      try {
        const response = await fetch(new Request(assetUrl, { cache: 'no-store' }));
        if (response && response.ok) {
          await cache.put(assetUrl, response.clone());
        }
      } catch (error) {
        // Keep install/refresh resilient: one failed asset should not block the SW lifecycle.
      }
    })
  );
}

function isStaticAssetRequest(request, url) {
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    return true;
  }

  return (
    url.pathname.startsWith('/styles/') ||
    url.pathname.startsWith('/scripts/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/sw.js'
  );
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
  });
}

async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached =
    (await cache.match(request, { ignoreSearch: true })) ||
    (await cache.match(NAVIGATION_FALLBACK_URL)) ||
    (await cache.match('/'));

  // Always update cache in background (fire-and-forget)
  const networkPromise = fetch(request, { cache: 'no-store' })
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
        cache.put(NAVIGATION_FALLBACK_URL, response.clone());
        cache.put('/', response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Serve cache immediately if available — zero latency offline
  if (cached) return cached;

  // No cache yet (first visit) — wait for network with timeout
  const fastResponse = await withTimeout(networkPromise, NETWORK_TIMEOUT_MS);
  if (fastResponse) return fastResponse;

  throw new Error('Navigation unavailable: no cache and no network');
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  const networkPromise = fetch(request, { cache: 'no-store' })
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    if (event && event.waitUntil) {
      event.waitUntil(networkPromise.then(() => undefined));
    }
    return cached;
  }

  const response = await networkPromise;
  if (response) {
    return response;
  }

  const fallback = await cache.match(request, { ignoreSearch: true });
  if (fallback) return fallback;
  throw new Error('Asset unavailable');
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cache.match(request, { ignoreSearch: true });
  }
}
