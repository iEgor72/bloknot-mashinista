// Safe-area policy:
// - keep content inset dynamic
// - bottom navigation position is handled by app shell layout
(function() {
  var root = document.documentElement;
  var probeEl = null;
  var safeSyncRaf = 0;
  var settleTimers = [];
  var isStandalone = false;
  var lastAppliedInsets = null;

  function detectStandaloneMode() {
    try {
      return (
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true
      );
    } catch (e) {
      return false;
    }
  }

  function applyDisplayModeClass() {
    isStandalone = detectStandaloneMode();
    root.classList.toggle('is-standalone-pwa', isStandalone);
  }

  function ensureProbe() {
    if (probeEl) return probeEl;
    probeEl = document.createElement('div');
    probeEl.style.cssText = [
      'position:fixed',
      'top:-9999px',
      'left:-9999px',
      'width:0',
      'height:0',
      'padding-top:env(safe-area-inset-top,0px)',
      'padding-right:env(safe-area-inset-right,0px)',
      'padding-bottom:env(safe-area-inset-bottom,0px)',
      'padding-left:env(safe-area-inset-left,0px)',
      'visibility:hidden',
      'pointer-events:none'
    ].join(';');
    root.appendChild(probeEl);
    return probeEl;
  }

  function normalizeInset(value) {
    var number = parseFloat(value);
    if (!isFinite(number) || number < 0) return 0;
    return Math.round(number * 100) / 100;
  }

  function readInsetObject(source) {
    if (!source || typeof source !== 'object') return null;
    return {
      top: normalizeInset(source.top),
      right: normalizeInset(source.right),
      bottom: normalizeInset(source.bottom),
      left: normalizeInset(source.left)
    };
  }

  function getTelegramWebApp() {
    try {
      if (window.Telegram && Telegram.WebApp) {
        return Telegram.WebApp;
      }
    } catch (e) {}
    return null;
  }

  function readTelegramInsets() {
    var webApp = getTelegramWebApp();
    if (!webApp) return null;

    var safeInsets = readInsetObject(webApp.safeAreaInset);
    var contentInsets = readInsetObject(webApp.contentSafeAreaInset);
    if (!safeInsets && !contentInsets) return null;

    return {
      top: Math.max((safeInsets && safeInsets.top) || 0, (contentInsets && contentInsets.top) || 0),
      right: Math.max((safeInsets && safeInsets.right) || 0, (contentInsets && contentInsets.right) || 0),
      bottom: Math.max((safeInsets && safeInsets.bottom) || 0, (contentInsets && contentInsets.bottom) || 0),
      left: Math.max((safeInsets && safeInsets.left) || 0, (contentInsets && contentInsets.left) || 0)
    };
  }

  function readEnvInsets() {
    var el = ensureProbe();
    var computed = window.getComputedStyle(el);
    return {
      top: normalizeInset(computed.paddingTop),
      right: normalizeInset(computed.paddingRight),
      bottom: normalizeInset(computed.paddingBottom),
      left: normalizeInset(computed.paddingLeft)
    };
  }

  function mergeInsets(baseInsets, extraInsets) {
    return {
      top: Math.max(baseInsets.top || 0, (extraInsets && extraInsets.top) || 0),
      right: Math.max(baseInsets.right || 0, (extraInsets && extraInsets.right) || 0),
      bottom: Math.max(baseInsets.bottom || 0, (extraInsets && extraInsets.bottom) || 0),
      left: Math.max(baseInsets.left || 0, (extraInsets && extraInsets.left) || 0)
    };
  }

  function insetsEqual(a, b) {
    if (!a || !b) return false;
    return (
      Math.abs(a.top - b.top) < 0.5 &&
      Math.abs(a.right - b.right) < 0.5 &&
      Math.abs(a.bottom - b.bottom) < 0.5 &&
      Math.abs(a.left - b.left) < 0.5
    );
  }

  function applySafeInsets(force) {
    var envInsets = readEnvInsets();
    var telegramInsets = readTelegramInsets();
    var insets = mergeInsets(envInsets, telegramInsets);

    if (!force && insetsEqual(lastAppliedInsets, insets)) {
      return;
    }

    lastAppliedInsets = insets;
    root.style.setProperty('--safe-top', insets.top + 'px');
    root.style.setProperty('--safe-right', insets.right + 'px');
    root.style.setProperty('--safe-bottom', insets.bottom + 'px');
    root.style.setProperty('--safe-left', insets.left + 'px');
    root.style.setProperty('--bottom-nav-safe-bottom', insets.bottom + 'px');
  }

  function syncSafeInsets(force) {
    if (safeSyncRaf) {
      window.cancelAnimationFrame(safeSyncRaf);
    }
    safeSyncRaf = window.requestAnimationFrame(function() {
      safeSyncRaf = 0;
      applySafeInsets(!!force);
    });
  }

  function settleSafeInsets() {
    for (var i = 0; i < settleTimers.length; i++) {
      window.clearTimeout(settleTimers[i]);
    }
    settleTimers = [];

    var delays = isStandalone ? [0, 180, 420] : [0, 180];
    for (var d = 0; d < delays.length; d++) {
      settleTimers.push(window.setTimeout(syncSafeInsets, delays[d]));
    }
  }

  window.__refreshSafeAreaInsets = syncSafeInsets;
  window.__settleSafeAreaInsets = settleSafeInsets;

  applyDisplayModeClass();
  applySafeInsets(true);
  settleSafeInsets();

  window.addEventListener('load', settleSafeInsets);
  window.addEventListener('pageshow', function() {
    applyDisplayModeClass();
    settleSafeInsets();
  });
  window.addEventListener('resize', syncSafeInsets);
  window.addEventListener('orientationchange', settleSafeInsets);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      applyDisplayModeClass();
      settleSafeInsets();
    }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncSafeInsets);
    window.visualViewport.addEventListener('scroll', syncSafeInsets);
  }
})();
