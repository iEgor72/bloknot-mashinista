const CACHE_VERSION = 'v391';
const CACHE_NAME = `shift-tracker-shell-${CACHE_VERSION}`;
const NAVIGATION_FALLBACK_URL = '/index.html';
const NETWORK_TIMEOUT_MS = 4500;
const ASSET_NETWORK_TIMEOUT_MS = 8000;
const DOCS_ASSET_NETWORK_TIMEOUT_MS = 8000;
const APP_SHELL_PATHS = new Set(['/', '/index.html']);
const SEO_PAGE_PATHS = new Set([
  '/uchet-marshrutov',
  '/zarplata-mashinista',
  '/zhurnal-smen-mashinista',
  '/kalkulyator-zarplaty-mashinista',
  '/grafik-smen-mashinista',
  '/prilozhenie-dlya-mashinista',
  '/robots.txt',
  '/sitemap.xml'
]);
const INDEX_ASSET_PATTERN = /(?:href|src)=["'](\/(?:styles|scripts|assets)\/[^"'?#]+(?:\?[^"']*)?)["']/g;
const INSTALL_SHELL_URLS = [
  '/',
  '/index.html',
  '/styles/00-base.css',
  '/styles/10-navigation-and-cards.css',
  '/styles/10-shell-navigation.css',
  '/styles/11-poekhali-entry.css',
  '/styles/12-cards.css',
  '/styles/13-dashboard-cards.css',
  '/styles/14-stats-and-salary.css',
  '/styles/15-settings-and-docs.css',
  '/styles/16-overlays-and-actions.css',
  '/styles/15-bottom-nav.css',
  '/styles/16-press-feedback.css',
  '/styles/20-form-and-stats.css',
  '/styles/30-shifts-and-overlays.css',
  '/styles/40-premium-refresh.css',
  '/styles/50-design-refresh.css',
  '/styles/50-theme-shell.css',
  '/styles/51-shifts.css',
  '/styles/52-poekhali.css',
  '/styles/53-salary.css',
  '/styles/54-docs.css',
  '/styles/55-forms.css',
  '/styles/56-overlays.css',
  '/styles/55-partners.css',
  '/styles/56-profile.css',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/fonts/golos-text/GolosText-Regular.woff2',
  '/assets/fonts/golos-text/GolosText-Medium.woff2',
  '/assets/fonts/golos-text/GolosText-SemiBold.woff2',
  '/assets/fonts/golos-text/GolosText-Bold.woff2',
  '/assets/fonts/golos-text/GolosText-ExtraBold.woff2',
  '/assets/fonts/golos-text/GolosText-Black.woff2',
  '/scripts/safe-area.js',
  '/scripts/nav-debug.js',
  '/scripts/utils/haptics.js',
  '/scripts/press-feedback.js',
  '/scripts/app-constants.js',
  '/scripts/glass-select.js',
  '/scripts/viewport.js',
  '/scripts/time-utils.js',
  '/scripts/docs-app.js',
  '/scripts/telegram-sdk-loader.js',
  '/scripts/app.js',
  '/scripts/poekhali-utils.js',
  '/scripts/poekhali-map-parser.js',
  '/scripts/poekhali-warnings.js',
  '/scripts/poekhali-backup.js',
  '/scripts/poekhali-tracker.js',
  '/scripts/auth.js',
  '/scripts/analytics.js',
  '/scripts/render.js',
  '/scripts/shift-form.js',
  '/scripts/partners.js',
  '/scripts/app-init.js',
  '/scripts/sw-register.js',
  '/assets/tracker/sections/index.json',
  '/assets/tracker/sections/dvost-volochaevka-ii-dzemgi.json',
  '/assets/tracker/sections/dvost-postyshevo-komsomolsk.json',
  '/assets/tracker/sections/dvost-postyshevo-novyi-urgal-odd.json',
  '/assets/tracker/sections/dvost-vysokogornaya-oune-via-sollu.json',
  '/assets/tracker/sections/dvost-vysokogornaya-oune-via-muli.json',
  '/assets/tracker/sections/dvost-oune-pivan.json',
  '/assets/tracker/sections/dvost-pivan-novyi-mir.json',
  '/sw-bootstrap-v391.js'
];
const CRITICAL_INSTALL_URLS = [
  '/',
  '/index.html',
  '/styles/00-base.css',
  '/styles/10-navigation-and-cards.css',
  '/styles/10-shell-navigation.css',
  '/styles/11-poekhali-entry.css',
  '/styles/12-cards.css',
  '/styles/13-dashboard-cards.css',
  '/styles/14-stats-and-salary.css',
  '/styles/15-settings-and-docs.css',
  '/styles/16-overlays-and-actions.css',
  '/styles/15-bottom-nav.css',
  '/styles/16-press-feedback.css',
  '/styles/20-form-and-stats.css',
  '/styles/30-shifts-and-overlays.css',
  '/styles/40-premium-refresh.css',
  '/styles/50-design-refresh.css',
  '/styles/50-theme-shell.css',
  '/styles/51-shifts.css',
  '/styles/52-poekhali.css',
  '/styles/53-salary.css',
  '/styles/54-docs.css',
  '/styles/55-forms.css',
  '/styles/56-overlays.css',
  '/styles/55-partners.css',
  '/styles/56-profile.css',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/fonts/golos-text/GolosText-Regular.woff2',
  '/assets/fonts/golos-text/GolosText-Medium.woff2',
  '/assets/fonts/golos-text/GolosText-SemiBold.woff2',
  '/assets/fonts/golos-text/GolosText-Bold.woff2',
  '/assets/fonts/golos-text/GolosText-ExtraBold.woff2',
  '/assets/fonts/golos-text/GolosText-Black.woff2',
  '/scripts/safe-area.js',
  '/scripts/nav-debug.js',
  '/scripts/utils/haptics.js',
  '/scripts/press-feedback.js',
  '/scripts/app-constants.js',
  '/scripts/glass-select.js',
  '/scripts/viewport.js',
  '/scripts/time-utils.js',
  '/scripts/docs-app.js',
  '/scripts/telegram-sdk-loader.js',
  '/scripts/app.js',
  '/scripts/poekhali-utils.js',
  '/scripts/poekhali-map-parser.js',
  '/scripts/poekhali-warnings.js',
  '/scripts/poekhali-backup.js',
  '/scripts/poekhali-tracker.js',
  '/scripts/auth.js',
  '/scripts/analytics.js',
  '/scripts/render.js',
  '/scripts/shift-form.js',
  '/scripts/partners.js',
  '/scripts/app-init.js',
  '/scripts/sw-register.js',
  '/sw-bootstrap-v391.js'
];
const EXTENDED_SHELL_URLS = [
  '/assets/docs/manifest.json',
  '/assets/docs/vendor/jszip.min.js',
  '/assets/pdfjs/pdf.min.js',
  '/assets/pdfjs/pdf.worker.min.js',
  '/assets/tracker/data.xml',
  '/assets/tracker/profile.xml',
  '/assets/tracker/maps/komsomol-sk-tche-9/data.xml',
  '/assets/tracker/maps/komsomol-sk-tche-9/profile.xml',
  '/assets/tracker/maps/komsomol-sk-tche-9/speed.xml',
  '/assets/tracker/maps/komsomol-sk-tche-9/1.xml',
  '/assets/tracker/maps/komsomol-sk-tche-9/1n.xml',
  '/assets/tracker/maps/komsomol-sk-tche-9/2.xml',
  '/assets/tracker/maps/komsomol-sk-tche-9/2n.xml',
  '/assets/tracker/maps-manifest.json',
  '/assets/tracker/tch9-reference.json',
  '/assets/tracker/speed-docs.json',
  '/assets/tracker/regime-maps.json'
];
const INSTALL_SHELL_SET = new Set(INSTALL_SHELL_URLS.map((url) => normalizeShellUrl(url)).filter(Boolean));
const CRITICAL_INSTALL_SET = new Set(CRITICAL_INSTALL_URLS.map((url) => normalizeShellUrl(url)).filter(Boolean));
const COHERENT_RUNTIME_URLS = uniqueShellUrls([
  '/',
  NAVIGATION_FALLBACK_URL,
  ...CRITICAL_INSTALL_URLS.filter((url) => (
    url.startsWith('/scripts/') ||
    url.startsWith('/styles/') ||
    /^\/sw-bootstrap-v\d+\.js$/.test(url)
  )),
]);
const UPDATE_CONTROL_PATHS = new Set([
  '/scripts/app-constants.js',
  '/scripts/app-init.js',
  '/scripts/app.js',
  '/scripts/auth.js',
  '/scripts/poekhali-backup.js',
  '/scripts/poekhali-tracker.js',
  '/scripts/shift-form.js',
  '/scripts/sw-register.js',
  '/sw.js'
]);
const UPDATE_CONTROL_FAST_TIMEOUT_MS = 1400;

// Many users reach prod only through an anti-censorship VPN whose tunnel drops a
// noticeable fraction of requests (random "Failed to fetch"). A few retries on a
// channel with ~10% independent loss cut the effective failure rate to ~0.1%,
// which is the difference between a populated cache and a broken/gray shell.
const NETWORK_RETRY_ATTEMPTS = 2; // extra attempts after the first (3 tries total)
const NETWORK_RETRY_BASE_DELAY_MS = 250;
const NETWORK_RETRY_ATTEMPT_TIMEOUT_MS = 5000; // abort a single hung attempt so the retry can fire

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input, options) {
  const opts = Object.assign({ cache: 'no-store' }, options || {});
  let lastError = null;
  for (let attempt = 0; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => { try { controller.abort(); } catch (e) {} }, NETWORK_RETRY_ATTEMPT_TIMEOUT_MS)
      : null;
    try {
      const request = typeof input === 'string' ? new Request(input, opts) : input;
      const attemptOpts = controller ? Object.assign({}, opts, { signal: controller.signal }) : opts;
      const response = await fetch(request, attemptOpts);
      if (timer) clearTimeout(timer);
      if (response && response.ok) return response;
      // A definitive 4xx (e.g. a real 404) won't change on retry — return it as-is.
      if (response && response.status >= 400 && response.status < 500) return response;
      lastError = new Error('Unexpected response status: ' + (response ? response.status : 'none'));
    } catch (error) {
      if (timer) clearTimeout(timer);
      lastError = error;
    }
    if (attempt < NETWORK_RETRY_ATTEMPTS) {
      await delay(NETWORK_RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }
  if (lastError) throw lastError;
  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await warmShellCache({ mode: 'install' });
    const cache = await caches.open(CACHE_NAME);
    const coherence = await auditCachedShellUrls(cache, COHERENT_RUNTIME_URLS);
    if (!coherence.ok) {
      throw new Error('Refusing to activate an incomplete runtime cache: ' + coherence.missing.join(', '));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const cache = await caches.open(CACHE_NAME);
    const audit = await auditCachedShellUrls(cache, COHERENT_RUNTIME_URLS);
    const staleShellCaches = cacheNames.filter((name) => name.startsWith('shift-tracker-shell-') && name !== CACHE_NAME);
    if (audit.ok) {
      await Promise.all(staleShellCaches.map((name) => caches.delete(name)));
    } else if (staleShellCaches.length) {
      console.warn('[SW] Current shell cache is partial; keeping previous shell caches as fallback:', audit.missing.join(', '));
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data && data.type === 'WARMUP_CACHE') {
    event.waitUntil(
      warmShellCache({ mode: 'shell' })
        .then(() => cleanupStaleShellCachesIfSafe())
    );
  }
  if (data && data.type === 'PURGE_STALE_SHELL_CACHES') {
    event.waitUntil(cleanupStaleShellCachesIfSafe());
  }
  if (data && data.type === 'GET_CACHE_VERSION' && event.source && typeof event.source.postMessage === 'function') {
    event.source.postMessage({ type: 'CACHE_VERSION', version: CACHE_VERSION });
  }
  if (data && data.type === 'WARMUP_EXTENDED_CACHE') {
    event.waitUntil(warmShellCache({ mode: 'full' }));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname === '/assets/docs/manifest.json') {
    event.respondWith(networkOnlyNoStore(request));
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDocument(request, event));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    if (isUpdateControlRequest(url)) {
      event.respondWith(networkFirstFastFallbackStatic(request, event, { currentVersionOnly: true }));
      return;
    }
    if (isTrackerDataRequest(url)) {
      event.respondWith(networkFirstFastFallbackStatic(request, event));
      return;
    }
    if (isShellCodeRequest(request, url)) {
      event.respondWith(staleWhileRevalidate(request, event, { currentVersionOnly: true }));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function warmShellCache(options) {
  const mode = options && options.mode === 'install' ? 'install' : (options && options.mode === 'shell' ? 'shell' : 'full');
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
        const response = await fetchWithRetry(assetUrl);
        if (response && response.ok) {
          await putShellCacheResponse(cache, assetUrl, response.clone());
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
  if (mode === 'shell') {
    console.info('[SW] App shell cache updated:', `${cachedCount}/${shellUrls.length}`);
    return;
  }
  console.info('[SW] Extended warmup cache updated:', `${cachedCount}/${shellUrls.length}`);
}

async function precacheCriticalInstallShell(cache) {
  const criticalUrls = uniqueShellUrls(CRITICAL_INSTALL_URLS);
  // Fetch each asset individually instead of cache.addAll(): addAll is atomic, so a
  // single failed fetch (flaky VPN / RU throttling) would reject the whole batch.
  // Fetch independently, then let the coherent-runtime audit decide whether this
  // worker is safe to activate. Optional assets may fail; mixed JS/CSS may not.
  let cachedCount = 0;
  await Promise.all(
    criticalUrls.map(async (assetUrl) => {
      try {
        const response = await fetchWithRetry(assetUrl);
        if (response && response.ok) {
          await putShellCacheResponse(cache, assetUrl, response.clone());
          cachedCount += 1;
        } else {
          console.warn('[SW] Critical install asset skipped (bad response):', assetUrl, response ? response.status : 'no-response');
        }
      } catch (error) {
        console.warn('[SW] Critical install asset fetch failed (will retry later):', assetUrl, error && error.message ? error.message : error);
      }
    })
  );
  console.info('[SW] Critical install shell precached:', `${cachedCount}/${criticalUrls.length}`);
  return cachedCount;
}

async function auditCachedShellUrls(cache, urls) {
  const missing = [];
  await Promise.all(
    urls.map(async (assetUrl) => {
      try {
        const cached = await cache.match(assetUrl);
        if (!cached) missing.push(assetUrl);
      } catch (error) {
        missing.push(assetUrl);
      }
    })
  );
  missing.sort();
  return { ok: missing.length === 0, missing };
}

async function cleanupStaleShellCachesIfSafe() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const audit = await auditCachedShellUrls(cache, COHERENT_RUNTIME_URLS);
    if (!audit.ok) {
      console.warn('[SW] Current shell cache is still partial; stale shell caches retained:', audit.missing.join(', '));
      return;
    }
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('shift-tracker-shell-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
  } catch (error) {
    console.warn('[SW] Failed to cleanup stale shell caches:', error && error.message ? error.message : error);
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
  if (mode === 'shell') {
    return uniqueShellUrls([
      NAVIGATION_FALLBACK_URL,
      '/',
      ...INSTALL_SHELL_URLS,
      ...discoveredAssets
    ]);
  }

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
    const response = await fetchWithRetry(NAVIGATION_FALLBACK_URL);
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

function isShellCodeRequest(request, url) {
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') return true;
  return url.pathname.startsWith('/scripts/') ||
    url.pathname.startsWith('/styles/') ||
    url.pathname === '/sw.js';
}

function isUpdateControlRequest(url) {
  if (!url) return false;
  return UPDATE_CONTROL_PATHS.has(url.pathname) ||
    /^\/sw-bootstrap-v\d+\.js$/.test(url.pathname);
}

function isTrackerDataRequest(url) {
  return url.pathname.startsWith('/assets/tracker/sections/') ||
    url.pathname === '/assets/tracker/maps-manifest.json' ||
    url.pathname === '/assets/tracker/tch9-reference.json' ||
    url.pathname === '/assets/tracker/speed-docs.json' ||
    url.pathname === '/assets/tracker/regime-maps.json';
}

function isDocsAssetRequest(request) {
  if (!request) return false;

  try {
    const url = new URL(request.url);
    return url.pathname.startsWith('/assets/docs/');
  } catch (error) {
    return false;
  }
}

function isAppShellPath(pathname) {
  return APP_SHELL_PATHS.has(pathname);
}

function shouldBypassNavigationFallback(pathname) {
  return SEO_PAGE_PATHS.has(pathname);
}

async function networkOnlyNoStore(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response) return response;
  } catch (error) {
    // Must not fall back to a stale cached copy — always go to network.
  }

  return new Response('Сейчас недоступно. Проверьте интернет и обновите страницу.', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
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

async function networkFirstDocument(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const requestUrl = new URL(request.url);
  const pathname = requestUrl.pathname;
  const allowAppShellFallback = !shouldBypassNavigationFallback(pathname);
  const isShellPath = isAppShellPath(pathname);

  let cached = await matchShellCache(request, { ignoreSearch: true });
  if (!cached && allowAppShellFallback) {
    cached =
      (await matchShellCache(NAVIGATION_FALLBACK_URL)) ||
      (await matchShellCache('/'));
  }

  const networkPromise = fetchWithRetry(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
        if (isShellPath) {
          cache.put(NAVIGATION_FALLBACK_URL, response.clone());
          cache.put('/', response.clone());
        }
      }
      return response;
    })
    .catch(() => null);

  const timeoutMs = cached && allowAppShellFallback ? 1600 : NETWORK_TIMEOUT_MS;
  const fastResponse = await withTimeout(networkPromise, timeoutMs);
  if (fastResponse) return fastResponse;

  if (cached) return cached;

  if (allowAppShellFallback) {
    const fallback =
      (await matchShellCache(NAVIGATION_FALLBACK_URL)) ||
      (await matchShellCache('/'));

    if (fallback) {
      console.warn('[SW] Navigation fallback served from cache for:', pathname);
      return fallback;
    }
  }

  const lateDocument = await networkPromise;
  if (lateDocument && lateDocument.ok) return lateDocument;

  console.warn('[SW] Navigation fallback page served (no cache, no network).');
  return createOfflineDocumentFallback();
}

async function staleWhileRevalidate(request, event, options) {
  const cache = await caches.open(CACHE_NAME);
  const currentVersionOnly = !!(options && options.currentVersionOnly);
  const cached = currentVersionOnly
    ? await matchCurrentShellCache(request, { ignoreSearch: true })
    : await matchShellCache(request, { ignoreSearch: true });

  const networkPromise = fetchWithRetry(request)
    .then(async (response) => {
      if (response && response.ok) {
        await putShellCacheResponse(cache, request, response.clone());
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

  const timeoutMs = isDocsAssetRequest(request) ? DOCS_ASSET_NETWORK_TIMEOUT_MS : ASSET_NETWORK_TIMEOUT_MS;
  const response = await withTimeout(networkPromise, timeoutMs);
  if (response) {
    return response;
  }

  const fallback = currentVersionOnly
    ? await matchCurrentShellCache(request, { ignoreSearch: true })
    : await matchShellCache(request, { ignoreSearch: true });
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

  const lateSwr = await networkPromise;
  if (lateSwr && lateSwr.ok) return lateSwr;

  throw new Error('Asset unavailable');
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await matchShellCache(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      await putShellCacheResponse(cache, request, response.clone());
    }
    return response;
  } catch (error) {
    return matchShellCache(request, { ignoreSearch: true });
  }
}

async function networkFirstFastFallbackStatic(request, event, options) {
  const cache = await caches.open(CACHE_NAME);
  const currentVersionOnly = !!(options && options.currentVersionOnly);
  const cached = currentVersionOnly
    ? await matchCurrentShellCache(request, { ignoreSearch: true })
    : await matchShellCache(request, { ignoreSearch: true });
  const networkPromise = fetchWithRetry(request)
    .then(async (response) => {
      if (response && response.ok) {
        await putShellCacheResponse(cache, request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  const response = await withTimeout(
    networkPromise,
    cached ? UPDATE_CONTROL_FAST_TIMEOUT_MS : ASSET_NETWORK_TIMEOUT_MS
  );
  if (response) return response;

  if (cached) {
    if (event && event.waitUntil) {
      event.waitUntil(networkPromise.then(() => undefined));
    }
    return cached;
  }

  const lateStatic = await networkPromise;
  if (lateStatic && lateStatic.ok) return lateStatic;

  throw new Error('Update-control asset unavailable');
}

async function putShellCacheResponse(cache, request, response) {
  if (!cache || !response) return;

  let url = null;
  try {
    const rawUrl = typeof request === 'string' ? request : request.url;
    url = new URL(rawUrl, self.location.origin);
  } catch (error) {}

  if (url && url.origin === self.location.origin) {
    const normalized = normalizeShellUrl(url.href);
    if (normalized) {
      try {
        await cache.delete(normalized, { ignoreSearch: true });
      } catch (error) {}
      await cache.put(normalized, response.clone());
      return;
    }
  }

  await cache.put(request, response.clone());
}

async function matchShellCache(request, options) {
  const currentMatch = await matchCurrentShellCache(request, options);
  if (currentMatch) return currentMatch;

  try {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (!name.startsWith('shift-tracker-shell-') || name === CACHE_NAME) continue;
      const cache = await caches.open(name);
      const cached = await cache.match(request, options);
      if (cached) return cached;
    }
  } catch (error) {}

  return null;
}

async function matchCurrentShellCache(request, options) {
  const currentCache = await caches.open(CACHE_NAME);
  return currentCache.match(request, options);
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
