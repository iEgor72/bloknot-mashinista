(function(global) {
  'use strict';

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
      if (!global.navigator || typeof global.navigator.vibrate !== 'function') {
        return false;
      }
      return !!global.navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }

  function impactLight() {
    try {
      var haptics = getTelegramHaptics();
      if (haptics && typeof haptics.impactOccurred === 'function') {
        haptics.impactOccurred('light');
        return true;
      }
    } catch (e) {}
    return runVibrationFallback(14);
  }

  function selectionChanged() {
    try {
      var haptics = getTelegramHaptics();
      if (haptics && typeof haptics.selectionChanged === 'function') {
        haptics.selectionChanged();
        return true;
      }
    } catch (e) {}
    return runVibrationFallback(12);
  }

  function success() {
    try {
      var haptics = getTelegramHaptics();
      if (haptics && typeof haptics.notificationOccurred === 'function') {
        haptics.notificationOccurred('success');
        return true;
      }
    } catch (e) {}
    return runVibrationFallback(20);
  }

  global.BM_HAPTICS = {
    impactLight: impactLight,
    selectionChanged: selectionChanged,
    success: success
  };
})(window);
