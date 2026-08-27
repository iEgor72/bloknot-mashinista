(function() {
  var version = 'v404';
  var swUrl = '/sw.js?v=' + encodeURIComponent(version);
  var controllerReloadFlag = 'shift_tracker_sw_controller_reload_v2';
  var initialController = navigator.serviceWorker && navigator.serviceWorker.controller;

  try {
    window.__SHIFT_TRACKER_SW_URL = swUrl;
  } catch (error) {}

  if (!('serviceWorker' in navigator)) return;
  try {
    if (window.__SHIFT_TRACKER_SW_REGISTRATION_STARTED) return;
    window.__SHIFT_TRACKER_SW_REGISTRATION_STARTED = swUrl;
  } catch (error2) {}

  navigator.serviceWorker.addEventListener('controllerchange', function() {
    var activeController = navigator.serviceWorker.controller;
    if (!activeController) return;
    if (!initialController) {
      initialController = activeController;
      return;
    }
    try {
      if (window.sessionStorage && sessionStorage.getItem(controllerReloadFlag) === '1') return;
      if (window.sessionStorage) sessionStorage.setItem(controllerReloadFlag, '1');
    } catch (error) {}
    window.location.reload();
  });

  navigator.serviceWorker.register(swUrl, { scope: '/', updateViaCache: 'none' }).then(function(registration) {
    if (registration && !registration.installing && typeof registration.update === 'function') {
      registration.update().catch(function(error) {
        console.warn('[SW] Versioned update failed:', error);
      });
    }
    var target = registration && (registration.active || registration.waiting || registration.installing);
    if (target) {
      try {
        target.postMessage({ type: 'WARMUP_CACHE' });
      } catch (error2) {}
    }
  }).catch(function(error) {
    console.warn('[SW] Versioned registration failed:', error);
  });
})();
