    // iOS PWA can report unstable safe-area values on the very first frame.
    // Keep --safe-bottom in sync during startup and viewport changes.
    (function() {
      var root = document.documentElement;
      var probeEl = null;
      var safeSyncRaf = 0;
      var settleTimers = [];
      var navSafeBottomLocked = null;
      var navReadyMarked = false;
      var ua = window.navigator.userAgent || '';
      var isiOS =
        /iP(hone|od|ad)/.test(ua) ||
        (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

      function markNavReady() {
        if (navReadyMarked) return;
        navReadyMarked = true;
        root.classList.add('nav-ready');
      }

      function unlockNavSafeBottom() {
        navSafeBottomLocked = null;
      }

      function ensureProbe() {
        if (probeEl) return probeEl;
        probeEl = document.createElement('div');
        probeEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;';
        root.appendChild(probeEl);
        return probeEl;
      }

      function readSafeBottomInset() {
        var el = ensureProbe();
        var value = parseFloat(window.getComputedStyle(el).paddingBottom) || 0;
        if (!isFinite(value) || value < 0) return 0;
        return Math.round(value * 100) / 100;
      }

      function applySafeBottomInset() {
        var safeBottom = readSafeBottomInset();
        root.style.setProperty('--safe-bottom', safeBottom + 'px');
        var navSafeBottom = navSafeBottomLocked === null ? safeBottom : navSafeBottomLocked;
        root.style.setProperty('--bottom-nav-safe-bottom', navSafeBottom + 'px');
      }

      function lockNavSafeBottomToCurrentInset() {
        navSafeBottomLocked = readSafeBottomInset();
        root.style.setProperty('--bottom-nav-safe-bottom', navSafeBottomLocked + 'px');
        markNavReady();
      }

      function syncSafeBottomInset() {
        if (safeSyncRaf) {
          window.cancelAnimationFrame(safeSyncRaf);
        }
        safeSyncRaf = window.requestAnimationFrame(function() {
          safeSyncRaf = 0;
          applySafeBottomInset();
        });
      }

      function settleSafeBottomInset() {
        for (var i = 0; i < settleTimers.length; i++) {
          window.clearTimeout(settleTimers[i]);
        }
        settleTimers = [];

        var delays = [0, 80, 220, 520];
        for (var d = 0; d < delays.length; d++) {
          (function(idx) {
            settleTimers.push(window.setTimeout(function() {
              syncSafeBottomInset();
              if (idx === delays.length - 1) {
                window.requestAnimationFrame(lockNavSafeBottomToCurrentInset);
              }
            }, delays[idx]));
          })(d);
        }
      }

      function handleFirstInteraction() {
        settleSafeBottomInset();
        window.removeEventListener('pointerdown', handleFirstInteraction, true);
        window.removeEventListener('touchstart', handleFirstInteraction, true);
      }

      window.__refreshSafeAreaInsets = syncSafeBottomInset;
      window.__settleSafeAreaInsets = settleSafeBottomInset;
      window.__resetSafeAreaNavLock = unlockNavSafeBottom;

      applySafeBottomInset();
      if (!isiOS) {
        lockNavSafeBottomToCurrentInset();
      }
      settleSafeBottomInset();

      window.addEventListener('load', settleSafeBottomInset);
      window.addEventListener('pageshow', settleSafeBottomInset);
      window.addEventListener('resize', syncSafeBottomInset);
      window.addEventListener('orientationchange', function() {
        unlockNavSafeBottom();
        settleSafeBottomInset();
      });
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden) settleSafeBottomInset();
      });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncSafeBottomInset);
        window.visualViewport.addEventListener('scroll', syncSafeBottomInset);
      }
      window.addEventListener('pointerdown', handleFirstInteraction, true);
      window.addEventListener('touchstart', handleFirstInteraction, true);
    })();
