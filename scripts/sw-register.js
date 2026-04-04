    if ('serviceWorker' in navigator) {
      var swReloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (swReloaded) return;
        swReloaded = true;
        window.location.reload();
      });

      navigator.serviceWorker.register('/sw.js').then(function(registration) {
        if (registration.update) {
          registration.update().catch(function() {});
        }

        function requestWarmupCache() {
          var target = registration.active || registration.waiting || registration.installing;
          if (target) {
            target.postMessage({ type: 'WARMUP_CACHE' });
          }
        }

        function requestSkipWaiting() {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }

        requestSkipWaiting();
        requestWarmupCache();

        registration.addEventListener('updatefound', function() {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function() {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              requestSkipWaiting();
              requestWarmupCache();
            }
          });
        });
      }).catch(function (error) {
        console.warn('Service worker registration failed:', error);
      });
    }
