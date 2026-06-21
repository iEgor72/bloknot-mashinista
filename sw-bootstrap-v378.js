(function() {
  var version = 'v378';
  var swUrl = '/sw.js?v=' + encodeURIComponent(version);

  try {
    window.__SHIFT_TRACKER_SW_URL = swUrl;
  } catch (error) {}

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register(swUrl, { scope: '/', updateViaCache: 'none' }).then(function(registration) {
    if (registration && typeof registration.update === 'function') {
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
