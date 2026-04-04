// Safe-area policy:
// - keep content inset dynamic
// - bottom navigation position is handled by app shell layout
(function() {
  var root = document.documentElement;
  var probeEl = null;
  var safeSyncRaf = 0;
  var settleTimers = [];

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

  function applySafeInsets() {
    var safeBottom = readSafeBottomInset();
    root.style.setProperty('--safe-bottom', safeBottom + 'px');
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
