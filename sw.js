const CACHE_VERSION = 'v22';
const CACHE_NAME = `shift-tracker-shell-${CACHE_VERSION}`;
const NAVIGATION_FALLBACK_URL = '/index.html';
const NETWORK_TIMEOUT_MS = 1200;
const ASSET_NETWORK_TIMEOUT_MS = 1200;
const INDEX_ASSET_PATTERN = /(?:href|src)=["'](\/(?:styles|scripts|assets)\/[^"'?#]+(?:\?[^"']*)?)["']/g;
const INSTALL_SHELL_URLS = [
  '/',
  '/index.html',
  '/styles/00-base.css',
  '/styles/10-navigation-and-cards.css',
  '/styles/15-bottom-nav.css',
  '/styles/16-press-feedback.css',
  '/styles/20-form-and-stats.css',
  '/styles/30-shifts-and-overlays.css',
  '/styles/40-premium-refresh.css',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-cyrillic-ext.woff2',
  '/scripts/safe-area.js',
  '/scripts/nav-debug.js',
  '/scripts/utils/haptics.js',
  '/scripts/press-feedback.js',
  '/scripts/app.js',
  '/scripts/app-init.js',
  '/scripts/sw-register.js',
  '/sw.js'
];
const CRITICAL_INSTALL_URLS = [
  '/',
  '/index.html',
  '/styles/00-base.css',
  '/styles/10-navigation-and-cards.css',
  '/styles/15-bottom-nav.css',
  '/styles/20-form-and-stats.css',
  '/styles/30-shifts-and-overlays.css',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-cyrillic-ext.woff2',
  '/scripts/safe-area.js',
  '/scripts/app.js',
  '/scripts/app-init.js',
  '/scripts/sw-register.js'
];
const EXTENDED_SHELL_URLS = [
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-cyrillic-ext.woff2',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-vietnamese.woff2',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext.woff2',
  '/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin.woff2',
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
  '/assets/instructions/catalog.v2.json',
  '/assets/docs/manifest.json',
  '/assets/pdfjs/pdf.min.js',
  '/assets/pdfjs/pdf.worker.min.js'
];
const INSTALL_SHELL_SET = new Set(INSTALL_SHELL_URLS.map((url) => normalizeShellUrl(url)).filter(Boolean));
const CRITICAL_INSTALL_SET = new Set(CRITICAL_INSTALL_URLS.map((url) => normalizeShellUrl(url)).filter(Boolean));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await warmShellCache({ mode: 'install' });
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
    event.waitUntil(warmShellCache({ mode: 'full' }));
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

async function warmShellCache(options) {
  const mode = options && options.mode === 'install' ? 'install' : 'full';
  const cache = await caches.open(CACHE_NAME);
  const shellUrls = await resolveShellUrls(mode);
  let cachedCount = 0;

  if (mode === 'install') {
    cachedCount += await precacheCriticalInstallShell(cache);
  }

  await Promise.all(
    shellUrls.map(async (assetUrl) => {
      if (mode === 'install' && CRITICAL_INSTALL_SET.has(assetUrl)) {
        return;
      }
      try {
        const response = await fetch(new Request(assetUrl, { cache: 'no-store' }));
        if (response && response.ok) {
          await cache.put(assetUrl, response.clone());
          cachedCount += 1;
        } else if (INSTALL_SHELL_SET.has(assetUrl)) {
          console.warn('[SW] Failed to precache install shell asset:', assetUrl, response ? response.status : 'no-response');
        }
      } catch (error) {
        // Keep install/refresh resilient: one failed asset should not block the SW lifecycle.
        if (INSTALL_SHELL_SET.has(assetUrl)) {
          console.warn('[SW] Error while precaching install shell asset:', assetUrl, error && error.message ? error.message : error);
        }
      }
    })
  );

  if (mode === 'install') {
    console.info('[SW] Install shell cache ready:', `${cachedCount}/${shellUrls.length}`);
    return;
  }
  console.info('[SW] Extended warmup cache updated:', `${cachedCount}/${shellUrls.length}`);
}

async function precacheCriticalInstallShell(cache) {
  const criticalUrls = uniqueShellUrls(CRITICAL_INSTALL_URLS);
  try {
    await cache.addAll(criticalUrls);
    console.info('[SW] Critical install shell precached:', criticalUrls.length);
    return criticalUrls.length;
  } catch (error) {
    console.error('[SW] Critical install shell precache failed:', error && error.message ? error.message : error);
    throw error;
  }
}

async function resolveShellUrls(mode) {
  if (mode === 'install') {
    return uniqueShellUrls([
      NAVIGATION_FALLBACK_URL,
      '/',
      ...INSTALL_SHELL_URLS
    ]);
  }

  const discoveredAssets = await discoverIndexAssets();
  return uniqueShellUrls([
    NAVIGATION_FALLBACK_URL,
    '/',
    ...INSTALL_SHELL_URLS,
    ...EXTENDED_SHELL_URLS,
    ...discoveredAssets
  ]);
}

async function discoverIndexAssets() {
  try {
    const response = await fetch(new Request(NAVIGATION_FALLBACK_URL, { cache: 'no-store' }));
    if (!response || !response.ok) return [];

    const html = await response.text();
    const assets = [];
    INDEX_ASSET_PATTERN.lastIndex = 0;

    let match;
    while ((match = INDEX_ASSET_PATTERN.exec(html))) {
      const normalized = normalizeShellUrl(match[1]);
      if (normalized) assets.push(normalized);
    }

    return assets;
  } catch (error) {
    return [];
  }
}

function uniqueShellUrls(urls) {
  const seen = new Set();
  const result = [];

  for (const rawUrl of urls) {
    const normalized = normalizeShellUrl(rawUrl);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeShellUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.origin !== self.location.origin) return null;
    return parsed.pathname;
  } catch (error) {
    return null;
  }
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

function isStyleRequest(request) {
  if (!request) return false;
  if (request.destination === 'style') return true;

  try {
    return new URL(request.url).pathname.endsWith('.css');
  } catch (error) {
    return false;
  }
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

  // Serve cache immediately if available (zero-latency offline).
  if (cached) return cached;

  // No cache yet (first visit): wait for network with timeout.
  const fastResponse = await withTimeout(networkPromise, NETWORK_TIMEOUT_MS);
  if (fastResponse) return fastResponse;

  const fallback =
    (await cache.match(NAVIGATION_FALLBACK_URL)) ||
    (await cache.match('/'));

  if (fallback) {
    console.warn('[SW] Navigation fallback served from cache for:', new URL(request.url).pathname);
    return fallback;
  }

  console.warn('[SW] Navigation fallback page served (no cache, no network).');
  return createOfflineDocumentFallback();
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

  const response = await withTimeout(networkPromise, ASSET_NETWORK_TIMEOUT_MS);
  if (response) {
    return response;
  }

  const fallback = await cache.match(request, { ignoreSearch: true });
  if (fallback) return fallback;

  if (isStyleRequest(request)) {
    console.warn('[SW] Serving empty CSS fallback for missing asset:', new URL(request.url).pathname);
    return new Response('', {
      status: 200,
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }

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

function createOfflineDocumentFallback() {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0c0c10;color:#f5f5f7;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;"><main><h1 style="margin:0 0 12px;font-size:22px;">App is offline</h1><p style="margin:0;max-width:420px;line-height:1.45;color:#b9bac7;">Connect to the internet and open the app once to refresh the offline cache.</p></main></body></html>',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    }
  );
}
