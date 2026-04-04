// iOS PWA can report unstable safe-area values on first paints.
// Keep content safe-area responsive, but lock bottom-nav offset early.
(function() {
  var root = document.documentElement;
  var probeEl = null;
  var safeSyncRaf = 0;
  var settleTimers = [];
  var NAV_SAFE_BOTTOM_STORAGE_KEY = 'shift_tracker_nav_safe_bottom_v1';
  var navSafeBottomLocked = readStoredNavSafeBottom();

  function readStoredNavSafeBottom() {
    try {
      var raw = window.localStorage.getItem(NAV_SAFE_BOTTOM_STORAGE_KEY);
      if (!raw) return null;
      var value = parseFloat(raw);
      if (!isFinite(value) || value < 0 || value > 120) return null;
      return Math.round(value * 100) / 100;
    } catch (e) {
      return null;
    }
  }

  function storeNavSafeBottom(value) {
    if (!isFinite(value) || value <= 0) return;
    try {
      window.localStorage.setItem(NAV_SAFE_BOTTOM_STORAGE_KEY, String(value));
    } catch (e) {}
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

  function lockNavSafeBottom(value) {
    if (!isFinite(value) || value < 0) return;
    navSafeBottomLocked = Math.round(value * 100) / 100;
    root.style.setProperty('--bottom-nav-safe-bottom', navSafeBottomLocked + 'px');
    storeNavSafeBottom(navSafeBottomLocked);
  }

  function lockNavSafeBottomToCurrentInset() {
    lockNavSafeBottom(readSafeBottomInset());
  }

  function applySafeBottomInset() {
    var safeBottom = readSafeBottomInset();
    root.style.setProperty('--safe-bottom', safeBottom + 'px');
    if (navSafeBottomLocked === null) {
      lockNavSafeBottom(safeBottom);
      return;
    }
    root.style.setProperty('--bottom-nav-safe-bottom', navSafeBottomLocked + 'px');
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
      settleTimers.push(window.setTimeout(syncSafeBottomInset, delays[d]));
    }
  }

  function handleOrientationChange() {
    lockNavSafeBottomToCurrentInset();
    applySafeBottomInset();
    settleSafeBottomInset();
  }

  window.__refreshSafeAreaInsets = syncSafeBottomInset;
  window.__settleSafeAreaInsets = settleSafeBottomInset;
  window.__lockNavSafeBottom = function() {
    lockNavSafeBottomToCurrentInset();
    applySafeBottomInset();
  };

  if (navSafeBottomLocked === null) {
    lockNavSafeBottomToCurrentInset();
  } else {
    root.style.setProperty('--bottom-nav-safe-bottom', navSafeBottomLocked + 'px');
  }
  applySafeBottomInset();
  settleSafeBottomInset();

  window.addEventListener('load', settleSafeBottomInset);
  window.addEventListener('pageshow', settleSafeBottomInset);
  window.addEventListener('resize', syncSafeBottomInset);
  window.addEventListener('orientationchange', handleOrientationChange);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) settleSafeBottomInset();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncSafeBottomInset);
    window.visualViewport.addEventListener('scroll', syncSafeBottomInset);
  }
})();
