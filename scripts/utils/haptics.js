(function(global) {
  'use strict';

  var DEFAULT_HAPTICS_CONFIG = {
    // Single point to disable all haptics quickly.
    enabled: true,
    allowFallbackVibrate: true,
    dedupeWindowMs: 80
  };

  var hapticsState = {
    lastKey: '',
    lastAt: 0
  };

  function readConfig() {
    var external = global.BM_HAPTICS_CONFIG || {};
    return {
      enabled: external.enabled !== undefined ? !!external.enabled : DEFAULT_HAPTICS_CONFIG.enabled,
      allowFallbackVibrate: external.allowFallbackVibrate !== undefined
        ? !!external.allowFallbackVibrate
        : DEFAULT_HAPTICS_CONFIG.allowFallbackVibrate,
      dedupeWindowMs: typeof external.dedupeWindowMs === 'number'
        ? Math.max(0, Math.round(external.dedupeWindowMs))
        : DEFAULT_HAPTICS_CONFIG.dedupeWindowMs
    };
  }

  function canEmit(key) {
    var cfg = readConfig();
    if (!cfg.enabled) return false;
    if (!key || cfg.dedupeWindowMs <= 0) return true;

    var now = Date.now();
    if (hapticsState.lastKey === key && (now - hapticsState.lastAt) < cfg.dedupeWindowMs) {
      return false;
    }

    hapticsState.lastKey = key;
    hapticsState.lastAt = now;
    return true;
  }

  function getTelegramHaptics() {
    try {
      if (
        global.Telegram &&
        global.Telegram.WebApp &&
        global.Telegram.WebApp.HapticFeedback
      ) {
        return global.Telegram.WebApp.HapticFeedback;
      }
    } catch (e) {}
    return null;
  }

  function runVibrationFallback(pattern) {
    try {
      var cfg = readConfig();
      if (!cfg.allowFallbackVibrate) return false;
      if (!global.navigator || typeof global.navigator.vibrate !== 'function') {
        return false;
      }
      return !!global.navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }

  function fireSelection() {
    var haptics = getTelegramHaptics();
    if (!haptics || typeof haptics.selectionChanged !== 'function') return false;
    haptics.selectionChanged();
    return true;
  }

  function fireImpact(style) {
    var haptics = getTelegramHaptics();
    if (!haptics || typeof haptics.impactOccurred !== 'function') return false;
    haptics.impactOccurred(style);
    return true;
  }

  function fireNotification(type) {
    var haptics = getTelegramHaptics();
    if (!haptics || typeof haptics.notificationOccurred !== 'function') return false;
    haptics.notificationOccurred(type);
    return true;
  }

  function emitHaptic(key, nativeFire, fallbackPattern) {
    if (!canEmit(key)) return false;
    try {
      if (nativeFire()) return true;
    } catch (e) {}
    return runVibrationFallback(fallbackPattern);
  }

  function hapticSelection() {
    return emitHaptic('selection', fireSelection, 10);
  }

  function hapticTapLight() {
    return emitHaptic('tap-light', function() {
      return fireImpact('light');
    }, 12);
  }

  function hapticTapSoft() {
    return emitHaptic('tap-soft', function() {
      return fireImpact('soft');
    }, 10);
  }

  function hapticActionMedium() {
    return emitHaptic('action-medium', function() {
      return fireImpact('medium');
    }, 16);
  }

  function hapticSuccess() {
    return emitHaptic('notification-success', function() {
      return fireNotification('success');
    }, [14, 20, 12]);
  }

  function hapticWarning() {
    return emitHaptic('notification-warning', function() {
      return fireNotification('warning');
    }, [18, 24, 10]);
  }

  function hapticError() {
    return emitHaptic('notification-error', function() {
      return fireNotification('error');
    }, [20, 26, 16]);
  }

  global.BM_HAPTICS = {
    hapticSelection: hapticSelection,
    hapticTapLight: hapticTapLight,
    hapticTapSoft: hapticTapSoft,
    hapticActionMedium: hapticActionMedium,
    hapticSuccess: hapticSuccess,
    hapticWarning: hapticWarning,
    hapticError: hapticError,
    // Backward-compatible aliases.
    selectionChanged: hapticSelection,
    impactLight: hapticTapLight,
    success: hapticSuccess
  };
})(window);
