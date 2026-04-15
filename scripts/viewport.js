    // ── Timezone ──
    var deviceTimezone = 'Europe/Moscow';
    try {
      deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
    } catch(e) {}

    var footerEl = document.getElementById('timezoneFooter');
    var APP_CONTENT = document.querySelector('.app-content');
    var BOTTOM_NAV = document.querySelector('.bottom-nav');
    var BOTTOM_NAV_INNER = document.querySelector('.bottom-nav-inner');
    var SHIFT_DETAIL_OVERLAY = document.getElementById('shiftDetailOverlay');
    var SHIFT_DETAIL_SURFACE = document.getElementById('shiftDetailSurface');
    var SHIFT_DETAIL_HERO_SLOT = document.getElementById('shiftDetailHeroSlot');
    var SHIFT_DETAIL_CONTENT = document.getElementById('shiftDetailContent');
    var SHIFT_DETAIL_TITLE = document.getElementById('shiftDetailTitle');
    var SHIFT_DETAIL_CLOSE_BUTTON = document.getElementById('btnCloseShiftDetail');
    var ADD_TAB_PANEL = document.querySelector('.tab-panel[data-tab="add"]');
    var keyboardFocusField = null;
    var keyboardStateOpen = false;
    var keyboardSyncTimer = null;
    var keyboardRevealTimer = null;
    var navHeightSyncTimer = null;
    var viewportMetricsRaf = null;
    var telegramLayoutBindTimer = null;
    var telegramLayoutEventsBound = false;
    var telegramLayoutBindRetries = 0;
    var telegramBackButtonBound = false;
    var lastAppViewportHeightValue = '';
    var viewportStabilityLockUntil = Date.now() + 700;
    var lockedViewportHeight = 0;
    var baselineViewportHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
    var baselineVisualViewportHeight = Math.round(
      (window.visualViewport && window.visualViewport.height) ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      0
    );
    var standaloneViewportHeightValue = (window.CSS && typeof window.CSS.supports === 'function' && window.CSS.supports('height: 100lvh'))
      ? '100lvh'
      : '100vh';
    function updateFooter() {
      var userLabel = CURRENT_USER ? (' · ' + (CURRENT_USER.display_name || CURRENT_USER.username || ('ID ' + CURRENT_USER.id))) : '';
      var text = 'Часовой пояс: ' + deviceTimezone + userLabel;
      if (footerEl) footerEl.textContent = text;
    }
    updateFooter();

    function setCssVar(name, value) {
      document.documentElement.style.setProperty(name, value);
    }

    function setAppViewportHeight(value) {
      if (!value || value === lastAppViewportHeightValue) return;
      lastAppViewportHeightValue = value;
      setCssVar('--app-viewport-height', value);
    }

    function syncBottomNavHeight() {
      if (!BOTTOM_NAV || !BOTTOM_NAV.getBoundingClientRect) return;
      var rect = BOTTOM_NAV.getBoundingClientRect();
      var navHeight = Math.round(rect.height || 0);
      if (navHeight > 0) {
        setCssVar('--bottom-nav-height', navHeight + 'px');
      }
    }

    function scheduleBottomNavHeightSync() {
      if (navHeightSyncTimer) {
        window.cancelAnimationFrame(navHeightSyncTimer);
      }
      navHeightSyncTimer = window.requestAnimationFrame(function() {
        navHeightSyncTimer = null;
        syncBottomNavHeight();
      });
    }

    function refreshSafeAreaInsets() {
      if (typeof window.__refreshSafeAreaInsets === 'function') {
        window.__refreshSafeAreaInsets();
      }
    }

    function settleSafeAreaInsets() {
      if (typeof window.__settleSafeAreaInsets === 'function') {
        window.__settleSafeAreaInsets();
      } else {
        refreshSafeAreaInsets();
      }
    }

    function isStandalonePwa() {
      if (document.documentElement.classList.contains('is-standalone-pwa')) {
        return true;
      }
      try {
        return (
          (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          window.navigator.standalone === true
        );
      } catch (e) {
        return false;
      }
    }

    function getTelegramWebApp() {
      try {
        if (window.Telegram && Telegram.WebApp) {
          return Telegram.WebApp;
        }
      } catch (e) {}
      return null;
    }

    function runHaptic(methodName) {
      try {
        var haptics = window.BM_HAPTICS;
        var fn = haptics && haptics[methodName];
        if (typeof fn === 'function') {
          fn();
        }
      } catch (e) {}
    }

    function triggerHapticSelection() {
      runHaptic('hapticSelection');
    }

    function triggerHapticTapLight() {
      runHaptic('hapticTapLight');
    }

    function triggerHapticTapSoft() {
      runHaptic('hapticTapSoft');
    }

    function triggerHapticActionMedium() {
      runHaptic('hapticActionMedium');
    }

    function triggerHapticSuccess() {
      runHaptic('hapticSuccess');
    }

    function triggerHapticWarning() {
      runHaptic('hapticWarning');
    }

    function triggerHapticError() {
      runHaptic('hapticError');
    }

    function toPositivePx(value) {
      var number = Number(value);
      if (!isFinite(number) || number <= 0) return 0;
      return Math.round(number);
    }

    function readTelegramViewportMetrics() {
      var webApp = getTelegramWebApp();
      if (!webApp) {
        return {
          viewportHeight: 0,
          stableHeight: 0
        };
      }

      return {
        viewportHeight: toPositivePx(webApp.viewportHeight),
        stableHeight: toPositivePx(webApp.viewportStableHeight)
      };
    }

    function requestTelegramLayoutMetrics() {
      var webApp = getTelegramWebApp();
      if (!webApp) return false;

      var didRequest = false;
      try {
        if (typeof webApp.requestViewport === 'function') {
          webApp.requestViewport();
          didRequest = true;
        }
      } catch (e) {}
      try {
        if (typeof webApp.requestSafeArea === 'function') {
          webApp.requestSafeArea();
          didRequest = true;
        }
      } catch (e) {}
      try {
        if (typeof webApp.requestContentSafeArea === 'function') {
          webApp.requestContentSafeArea();
          didRequest = true;
        }
      } catch (e) {}

      return didRequest;
    }

    function handleTelegramViewportChanged() {
      scheduleViewportMetricsUpdate();
      scheduleBottomNavHeightSync();
      settleSafeAreaInsets();
      scheduleKeyboardSync();
    }

    function handleTelegramSafeAreaChanged() {
      settleSafeAreaInsets();
      scheduleBottomNavHeightSync();
      scheduleViewportMetricsUpdate();
    }

    function bindTelegramLayoutEvents() {
      if (telegramLayoutEventsBound) return true;

      var webApp = getTelegramWebApp();
      if (!webApp || typeof webApp.onEvent !== 'function') {
        return false;
      }

      try {
        if (typeof webApp.ready === 'function') {
          webApp.ready();
        }
      } catch (e) {}
      try {
        if (typeof webApp.expand === 'function') {
          webApp.expand();
        }
      } catch (e) {}

      try {
        webApp.onEvent('viewportChanged', handleTelegramViewportChanged);
      } catch (e) {}
      try {
        webApp.onEvent('safeAreaChanged', handleTelegramSafeAreaChanged);
      } catch (e) {}
      try {
        webApp.onEvent('contentSafeAreaChanged', handleTelegramSafeAreaChanged);
      } catch (e) {}

      telegramLayoutEventsBound = true;
      telegramLayoutBindRetries = 0;
      requestTelegramLayoutMetrics();
      handleTelegramSafeAreaChanged();
      handleTelegramViewportChanged();
      return true;
    }

    function scheduleTelegramLayoutBinding() {
      if (telegramLayoutEventsBound) return;
      if (bindTelegramLayoutEvents()) return;
      if (telegramLayoutBindTimer) return;
      if (telegramLayoutBindRetries >= 40) return;
      telegramLayoutBindRetries += 1;

      telegramLayoutBindTimer = window.setTimeout(function() {
        telegramLayoutBindTimer = null;
        if (!telegramLayoutEventsBound) {
          scheduleTelegramLayoutBinding();
        }
      }, 220);
    }

    function getViewportHeight() {
      var telegramViewport = readTelegramViewportMetrics();
      if (telegramViewport.viewportHeight > 0) {
        return telegramViewport.viewportHeight;
      }

      var vv = window.visualViewport;
      if (vv && typeof vv.height === 'number' && vv.height > 0) {
        return Math.round(vv.height);
      }
      return Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
    }

    function isKeyboardInputElement(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.closest && el.closest('[contenteditable="true"]')) return true;
      if (!el.matches) return false;
      return el.matches('input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select');
    }

    function isKeyboardFieldEligible(el) {
      if (!el || el.nodeType !== 1 || !el.isConnected) return false;
      if (typeof el.disabled === 'boolean' && el.disabled) return false;
      if (typeof el.readOnly === 'boolean' && el.readOnly) return false;
      if (el.matches && el.matches('input[type="hidden"]')) return false;
      if (el.closest && el.closest('.hidden')) return false;

      var panel = el.closest ? el.closest('.tab-panel') : null;
      if (panel && !panel.classList.contains('active')) return false;

      var authGate = el.closest ? el.closest('.auth-gate') : null;
      if (authGate && authGate.classList.contains('hidden')) return false;

      var appShell = el.closest ? el.closest('#appShell') : null;
      if (appShell && appShell.classList.contains('hidden')) return false;

      if (window.getComputedStyle) {
        var style = window.getComputedStyle(el);
        if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
      }

      if (el.getClientRects && !el.getClientRects().length) return false;
      var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (rect && (rect.width < 1 || rect.height < 1)) return false;
      return true;
    }

    function resetViewportBaselines() {
      var telegramViewport = readTelegramViewportMetrics();
      if (telegramViewport.stableHeight > 0 || telegramViewport.viewportHeight > 0) {
        baselineViewportHeight = telegramViewport.stableHeight || telegramViewport.viewportHeight;
        baselineVisualViewportHeight = telegramViewport.viewportHeight || baselineViewportHeight;
      } else {
        baselineViewportHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
        baselineVisualViewportHeight = Math.round(
          (window.visualViewport && window.visualViewport.height) ||
          baselineViewportHeight ||
          0
        );
      }
      viewportStabilityLockUntil = Date.now() + 420;
      if (!lockedViewportHeight || baselineViewportHeight > lockedViewportHeight) {
        lockedViewportHeight = baselineViewportHeight;
      }
    }

    function updateViewportMetrics() {
      var height = getViewportHeight();
      if (height <= 0) return;

      var telegramViewport = readTelegramViewportMetrics();
      if (telegramViewport.stableHeight > 0 || telegramViewport.viewportHeight > 0) {
        // Telegram Mini Apps open in a BottomSheet, so plain 100vh is unreliable:
        // viewport height can change during half-screen/fullscreen transitions.
        var telegramHeight = keyboardStateOpen
          ? (telegramViewport.viewportHeight || telegramViewport.stableHeight)
          : (telegramViewport.stableHeight || telegramViewport.viewportHeight);
        if (telegramHeight > 0) {
          setAppViewportHeight(telegramHeight + 'px');
          return;
        }
      }

      if (!keyboardStateOpen && isStandalonePwa()) {
        // In iOS standalone mode keep shell height stable during edge gestures.
        setAppViewportHeight(standaloneViewportHeightValue);
        return;
      }

      if (!keyboardStateOpen) {
        var innerHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
        if (innerHeight > baselineViewportHeight) {
          baselineViewportHeight = innerHeight;
        }
        var vv = window.visualViewport;
        var vvHeight = vv && vv.height ? Math.round(vv.height) : 0;
        if (vvHeight > baselineVisualViewportHeight) {
          baselineVisualViewportHeight = vvHeight;
        }

        // Outside keyboard mode, keep app shell height at the largest stable viewport
        // to prevent iOS standalone visualViewport oscillations from lifting bottom nav.
        height = Math.max(
          height,
          innerHeight,
          baselineViewportHeight || 0,
          baselineVisualViewportHeight || 0
        );

        // During the first startup frames ignore tiny viewport oscillations.
        if (Date.now() < viewportStabilityLockUntil) {
          if (!lockedViewportHeight) {
            lockedViewportHeight = height;
          } else if (Math.abs(height - lockedViewportHeight) < 24) {
            height = lockedViewportHeight;
          } else {
            lockedViewportHeight = height;
          }
        } else if (!lockedViewportHeight || height > lockedViewportHeight) {
          lockedViewportHeight = height;
        }
      }

      setAppViewportHeight(height + 'px');
    }

    function scheduleViewportMetricsUpdate() {
      if (viewportMetricsRaf) return;
      viewportMetricsRaf = window.requestAnimationFrame(function() {
        viewportMetricsRaf = null;
        updateViewportMetrics();
      });
    }

    function getKeyboardInset() {
      var vv = window.visualViewport;
      if (vv) {
        var vvHeight = Math.round(vv.height || 0);
        if (vvHeight <= 0) return 0;
        if (!baselineVisualViewportHeight) {
          baselineVisualViewportHeight = vvHeight;
        }
        var visualShrink = Math.max(0, baselineVisualViewportHeight - vvHeight);

        var innerHeight = Math.round(window.innerHeight || 0);
        if (!baselineViewportHeight) {
          baselineViewportHeight = innerHeight;
        }
        var innerShrink = Math.max(0, baselineViewportHeight - innerHeight);
        return Math.max(visualShrink, innerShrink);
      }

      var currentHeight = Math.round(window.innerHeight || 0);
      if (!baselineViewportHeight) {
        baselineViewportHeight = currentHeight;
      }
      return Math.max(0, baselineViewportHeight - currentHeight);
    }

    function getScrollableAppContentForField(el) {
      if (!el || !el.closest) return null;
      var scoped = el.closest('.app-content');
      if (scoped) return scoped;
      if (APP_CONTENT && APP_CONTENT.contains(el)) return APP_CONTENT;
      return null;
    }

    function revealActiveField() {
      var el = document.activeElement;
      if (!isKeyboardInputElement(el) || !isKeyboardFieldEligible(el)) return;

      var viewportHeight = getViewportHeight();
      var keyboardInset = getKeyboardInset();
      var rect = el.getBoundingClientRect();
      var topGap = 16;
      var bottomGap = keyboardInset > 0 ? Math.max(96, keyboardInset + 20) : 24;
      var scrollContainer = getScrollableAppContentForField(el);

      if (scrollContainer) {
        var containerRect = scrollContainer.getBoundingClientRect();
        var currentScrollTop = scrollContainer.scrollTop;
        var fieldTop = rect.top - containerRect.top + currentScrollTop;
        var fieldBottom = rect.bottom - containerRect.top + currentScrollTop;
        var visibleTop = currentScrollTop;
        var visibleBottom = currentScrollTop + scrollContainer.clientHeight;
        var shouldScrollContainer = fieldTop < visibleTop + topGap || fieldBottom > visibleBottom - bottomGap;
        if (!shouldScrollContainer) return;

        var targetScrollTop = fieldTop - 24;
        if (fieldBottom > visibleBottom - bottomGap) {
          targetScrollTop = fieldBottom - (scrollContainer.clientHeight - bottomGap) + 24;
        }

        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
        return;
      }

      var shouldScroll = rect.top < topGap || rect.bottom > viewportHeight - bottomGap;
      if (!shouldScroll) return;

      var targetTop = window.pageYOffset + rect.top - 24;
      if (rect.bottom > viewportHeight - bottomGap) {
        targetTop = window.pageYOffset + rect.bottom - (viewportHeight - bottomGap) + 24;
      }

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
    }

    function scheduleRevealActiveField() {
      if (keyboardRevealTimer) {
        window.clearTimeout(keyboardRevealTimer);
      }
      keyboardRevealTimer = window.setTimeout(revealActiveField, 60);
    }

    function syncKeyboardLayout() {
      var el = document.activeElement;
      var focusRelevant = isKeyboardInputElement(el) && isKeyboardFieldEligible(el);
      keyboardFocusField = focusRelevant ? el : null;

      var keyboardInset = getKeyboardInset();
      var open = !!keyboardFocusField && keyboardInset > 120;
      var keyboardStateChanged = open !== keyboardStateOpen;

      if (keyboardStateChanged) {
        keyboardStateOpen = open;
        document.body.classList.toggle('is-keyboard-open', open);
      } else if (!open) {
        document.body.classList.remove('is-keyboard-open');
      }

      setCssVar('--keyboard-focus-scroll-bottom', open ? '280px' : '160px');
      if (keyboardStateChanged || open || !!keyboardFocusField) {
        updateViewportMetrics();
      }

      if (BOTTOM_NAV) {
        BOTTOM_NAV.setAttribute('aria-hidden', open ? 'true' : 'false');
      }

      if (open) {
        scheduleRevealActiveField();
      }
    }

    function scheduleKeyboardSync() {
      if (keyboardSyncTimer) {
        window.cancelAnimationFrame(keyboardSyncTimer);
      }
      keyboardSyncTimer = window.requestAnimationFrame(syncKeyboardLayout);
    }

