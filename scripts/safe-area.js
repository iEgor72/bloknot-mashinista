// Safe-area policy:
// - content uses dynamic safe bottom
// - iOS Home Screen bottom-nav uses fixed value to prevent jumps
(function() {
  var root = document.documentElement;
  var probeEl = null;
  var safeSyncRaf = 0;
  var settleTimers = [];
  var ua = window.navigator.userAgent || '';
  var isiOS =
    /iP(hone|od|ad)/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  var isStandalone = false;
  try {
    isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  } catch (e) {}

  // Deterministic nav baseline for iPhone Home Screen mode.
  var FIXED_IOS_STANDALONE_NAV_SAFE_BOTTOM = 34;

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

  function resolveNavSafeBottom(currentSafeBottom) {
    if (isiOS && isStandalone) {
      return FIXED_IOS_STANDALONE_NAV_SAFE_BOTTOM;
    }
    return currentSafeBottom;
  }

  function applySafeInsets() {
    var safeBottom = readSafeBottomInset();
    root.style.setProperty('--safe-bottom', safeBottom + 'px');
    root.style.setProperty('--bottom-nav-safe-bottom', resolveNavSafeBottom(safeBottom) + 'px');
  }

  function syncSafeInsets() {
    if (safeSyncRaf) {
      window.cancelAnimationFrame(safeSyncRaf);
    }
    safeSyncRaf = window.requestAnimationFrame(function() {
      safeSyncRaf = 0;
      applySafeInsets();
    });
  }

  function settleSafeInsets() {
    for (var i = 0; i < settleTimers.length; i++) {
      window.clearTimeout(settleTimers[i]);
    }
    settleTimers = [];

    var delays = [0, 80, 220, 520];
    for (var d = 0; d < delays.length; d++) {
      settleTimers.push(window.setTimeout(syncSafeInsets, delays[d]));
    }
  }

  window.__refreshSafeAreaInsets = syncSafeInsets;
  window.__settleSafeAreaInsets = settleSafeInsets;
  window.__lockNavSafeBottom = applySafeInsets;

  applySafeInsets();
  settleSafeInsets();

  window.addEventListener('load', settleSafeInsets);
  window.addEventListener('pageshow', settleSafeInsets);
  window.addEventListener('resize', syncSafeInsets);
  window.addEventListener('orientationchange', settleSafeInsets);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) settleSafeInsets();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncSafeInsets);
    window.visualViewport.addEventListener('scroll', syncSafeInsets);
  }
})();
