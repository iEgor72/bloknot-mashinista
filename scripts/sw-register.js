(function() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers are not supported in this runtime.');
    return;
  }

  var initialController = navigator.serviceWorker.controller;
  var SW_URL = '/sw.js';
  var STANDALONE_RELOAD_FLAG = 'shift_tracker_sw_standalone_reload_v1';

  function isStandalonePwa() {
    try {
      return (
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true ||
        document.documentElement.classList.contains('is-standalone-pwa')
      );
    } catch (error) {
      return false;
    }
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
    if (isStandalonePwa()) {
      try {
        if (window.sessionStorage && sessionStorage.getItem(STANDALONE_RELOAD_FLAG) === '1') {
          sessionStorage.removeItem(STANDALONE_RELOAD_FLAG);
          console.info('[SW] Controller updated in standalone; reload already consumed.');
          return;
        }
        if (window.sessionStorage) {
          sessionStorage.setItem(STANDALONE_RELOAD_FLAG, '1');
        }
      } catch (error) {}
      console.info('[SW] Controller updated in standalone; reloading to apply fresh shell.');
      window.location.reload();
      return;
    }
    // Keep current session stable and avoid startup flicker; new controller
    // will be naturally used on next navigation.
    console.info('[SW] Controller updated; reload deferred to next navigation.');
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

  navigator.serviceWorker.register(SW_URL, { scope: '/' }).then(function(registration) {
    console.info('[SW] Registered:', registration.scope || SW_URL);

    refreshServiceWorker(registration);

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

    function handleResumeUpdate() {
      refreshServiceWorker(registration);
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
