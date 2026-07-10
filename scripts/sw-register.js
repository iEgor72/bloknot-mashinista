(function() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers are not supported in this runtime.');
    return;
  }

  function isLikelyTelegramEmbeddedWebView() {
    try {
      return /Telegram/i.test(navigator.userAgent || '');
    } catch (error) {
      return false;
    }
  }

  var isTelegramEmbeddedWebView = isLikelyTelegramEmbeddedWebView();
  if (isTelegramEmbeddedWebView) {
    console.info('[SW] Telegram WebView detected; attempting registration for offline shell cache.');
  }

  var initialController = navigator.serviceWorker.controller;
  function getServiceWorkerUrl() {
    try {
      if (window.__SHIFT_TRACKER_SW_URL) return String(window.__SHIFT_TRACKER_SW_URL);
    } catch (error) {}
    var version = 'v0';
    try {
      if (typeof SHELL_CACHE_VERSION === 'string' && SHELL_CACHE_VERSION) {
        version = SHELL_CACHE_VERSION;
      }
    } catch (error2) {}
    return '/sw.js?v=' + encodeURIComponent(version);
  }
  var SW_URL = getServiceWorkerUrl();
  var CONTROLLER_RELOAD_FLAG = 'shift_tracker_sw_controller_reload_v2';
  var LIVE_VERSION_RELOAD_KEY = 'shift_tracker_live_version_reload_v1';
  var liveVersionCheckInFlight = false;
  var lastLiveVersionCheckAt = 0;

  try {
    if (window.sessionStorage && sessionStorage.getItem(CONTROLLER_RELOAD_FLAG) === '1') {
      window.setTimeout(function() {
        try {
          sessionStorage.removeItem(CONTROLLER_RELOAD_FLAG);
        } catch (error) {}
      }, 5000);
    }
  } catch (error) {}

  function postToWorker(registration, payload) {
    var target = registration && (registration.active || registration.waiting || registration.installing);
    if (!target) return false;
    try {
      target.postMessage(payload);
      return true;
    } catch (error) {
      console.warn('[SW] Failed to post message to worker:', payload && payload.type ? payload.type : 'unknown', error);
      return false;
    }
  }

  function requestWarmupCache(registration) {
    return postToWorker(registration, { type: 'WARMUP_CACHE' });
  }

  function requestStaleCachePurge(registration) {
    return postToWorker(registration, { type: 'PURGE_STALE_SHELL_CACHES' });
  }

  function requestSkipWaiting(registration) {
    var waiting = registration && registration.waiting;
    if (!waiting) return;
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      console.warn('[SW] Failed to send SKIP_WAITING message:', error);
    }
  }

  function getLocalShellVersion() {
    try {
      return (typeof window.SHELL_CACHE_VERSION === 'string' && window.SHELL_CACHE_VERSION) ? window.SHELL_CACHE_VERSION : '';
    } catch (error) {
      return '';
    }
  }

  function extractLiveShellVersion(source) {
    var match = String(source || '').match(/SHELL_CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
    return match ? match[1] : '';
  }

  function getRecentReloadVersion() {
    try {
      var raw = sessionStorage.getItem(LIVE_VERSION_RELOAD_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || !parsed.version || !parsed.at) return '';
      if ((Date.now() - Number(parsed.at)) > 60000) return '';
      return String(parsed.version || '');
    } catch (error) {
      return '';
    }
  }

  function rememberLiveVersionReload(version) {
    try {
      sessionStorage.setItem(LIVE_VERSION_RELOAD_KEY, JSON.stringify({
        version: String(version || ''),
        at: Date.now()
      }));
    } catch (error) {}
  }

  function refreshForLiveVersion(registration, liveVersion) {
    if (!liveVersion || getRecentReloadVersion() === liveVersion) return;
    rememberLiveVersionReload(liveVersion);
    rememberControllerReload();
    requestSkipWaiting(registration);
    requestStaleCachePurge(registration);
    try {
      if (registration && typeof registration.update === 'function') {
        registration.update().catch(function() {});
      }
    } catch (error) {}
    window.setTimeout(function() {
      try {
        window.location.reload();
      } catch (error2) {}
    }, 120);
  }

  function checkLiveShellVersion(registration) {
    var now = Date.now();
    if (liveVersionCheckInFlight || (now - lastLiveVersionCheckAt) < 15000) return;
    lastLiveVersionCheckAt = now;
    liveVersionCheckInFlight = true;
    fetch('/scripts/app-constants.js?live=' + encodeURIComponent(String(now)), {
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(function(response) {
      if (!response || !response.ok) throw new Error('live version unavailable');
      return response.text();
    }).then(function(source) {
      var liveVersion = extractLiveShellVersion(source);
      var localVersion = getLocalShellVersion();
      if (liveVersion && localVersion && liveVersion !== localVersion) {
        console.info('[SW] Live shell version differs from cached shell:', localVersion, '->', liveVersion);
        refreshForLiveVersion(registration, liveVersion);
      }
    }).catch(function() {
      // Offline or captive network: keep the cached shell usable.
    }).finally(function() {
      liveVersionCheckInFlight = false;
    });
  }

  function rememberControllerReload() {
    try {
      if (window.sessionStorage) {
        sessionStorage.setItem(CONTROLLER_RELOAD_FLAG, '1');
      }
    } catch (error) {}
  }

  navigator.serviceWorker.addEventListener('controllerchange', function() {
    var activeController = navigator.serviceWorker.controller;
    if (!activeController) return;
    if (!initialController) {
      // First-time takeover after initial install: do not disturb startup paint.
      initialController = activeController;
      return;
    }
    try {
      if (window.sessionStorage && sessionStorage.getItem(CONTROLLER_RELOAD_FLAG) === '1') {
        return;
      }
    } catch (error) {}
    // Reload only this startup tab once after a real controller upgrade. The
    // worker itself must never navigate every controlled client: that can tear
    // down an active tracker or form in another tab.
    rememberControllerReload();
    window.location.reload();
  });

  function refreshServiceWorker(registration) {
    if (!registration) return;
    if (registration.update) {
      registration.update().catch(function(error) {
        console.warn('[SW] registration.update() failed:', error);
      });
    }
    requestSkipWaiting(registration);
  }

  navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' }).then(function(registration) {
    if (!registration) {
      console.warn('[SW] Registration resolved without a registration object.');
      return;
    }
    console.info('[SW] Registered:', registration.scope || SW_URL);

    refreshServiceWorker(registration);
    checkLiveShellVersion(registration);

    navigator.serviceWorker.ready.then(function(readyRegistration) {
      if (!readyRegistration) {
        console.warn('[SW] Ready resolved without a registration object.');
        return;
      }
      console.info('[SW] Ready:', readyRegistration.scope || SW_URL);
      if (!requestWarmupCache(readyRegistration)) {
        console.warn('[SW] Ready registration has no active target for WARMUP_CACHE.');
      }
      checkLiveShellVersion(readyRegistration);
    }).catch(function(error) {
      console.warn('[SW] navigator.serviceWorker.ready failed:', error);
    });

    registration.addEventListener('updatefound', function() {
      var installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', function() {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          requestSkipWaiting(registration);
          navigator.serviceWorker.ready.then(function(readyRegistration) {
            requestWarmupCache(readyRegistration);
          }).catch(function() {});
        }
      });
    });

    function handleResumeUpdate() {
      refreshServiceWorker(registration);
      checkLiveShellVersion(registration);
    }

    window.addEventListener('pageshow', handleResumeUpdate);
    window.addEventListener('focus', handleResumeUpdate);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) handleResumeUpdate();
    });
    window.addEventListener('online', handleResumeUpdate);

    window.setTimeout(function() {
      if (!navigator.serviceWorker.controller) {
        console.warn('[SW] Worker registered but page is not yet controlled. It will control next navigation.');
      }
    }, 5000);
  }).catch(function(error) {
    console.error('[SW] Service worker registration failed for ' + SW_URL + ':', error);
  });
})();
