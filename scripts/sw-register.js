    if ('serviceWorker' in navigator) {
      var swReloaded = false;
      var initialController = navigator.serviceWorker.controller;

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
