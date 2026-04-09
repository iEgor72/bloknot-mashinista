(function() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers are not supported in this runtime.');
    return;
  }

  var swReloaded = false;
  var initialController = navigator.serviceWorker.controller;
  var SW_URL = '/sw.js';

  function scheduleSoftReload() {
    if (swReloaded) return;
    swReloaded = true;

    var reload = function() {
      window.setTimeout(function() {
        window.location.reload();
      }, 180);
    };

    if (document.visibilityState === 'hidden') {
      var onVisible = function() {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onVisible);
        reload();
      };
      document.addEventListener('visibilitychange', onVisible);
      return;
    }

    reload();
  }

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

  function requestSkipWaiting(registration) {
    var waiting = registration && registration.waiting;
    if (!waiting) return;
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      console.warn('[SW] Failed to send SKIP_WAITING message:', error);
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', function() {
    var activeController = navigator.serviceWorker.controller;
    if (!activeController) return;
    if (!initialController) {
      // First-time takeover after initial install: do not disturb startup paint.
      initialController = activeController;
      return;
    }
    scheduleSoftReload();
  });

  navigator.serviceWorker.register(SW_URL, { scope: '/' }).then(function(registration) {
    console.info('[SW] Registered:', registration.scope || SW_URL);

    if (registration.update) {
      registration.update().catch(function(error) {
        console.warn('[SW] registration.update() failed:', error);
      });
    }

    requestSkipWaiting(registration);

    navigator.serviceWorker.ready.then(function(readyRegistration) {
      console.info('[SW] Ready:', readyRegistration.scope || SW_URL);
      if (!requestWarmupCache(readyRegistration)) {
        console.warn('[SW] Ready registration has no active target for WARMUP_CACHE.');
      }
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

    window.setTimeout(function() {
      if (!navigator.serviceWorker.controller) {
        console.warn('[SW] Worker registered but page is not yet controlled. It will control next navigation.');
      }
    }, 5000);
  }).catch(function(error) {
    console.error('[SW] Service worker registration failed for ' + SW_URL + ':', error);
  });
})();
