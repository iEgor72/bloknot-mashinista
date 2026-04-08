(function(global) {
  'use strict';

  if (global.__BM_PRESS_FEEDBACK_INIT__) return;
  global.__BM_PRESS_FEEDBACK_INIT__ = true;

  var PRESS_TARGET_SCALE = 0.972;
  var PRESS_IN_DURATION_MS = 90;
  var PRESS_OUT_DURATION_MS = 110;
  var SYNTHETIC_MOUSE_GUARD_MS = 700;
  var PRESS_SELECTOR = [
    'button',
    '[role="button"]',
    '[data-action]',
    '.docs-item[data-file-path]',
    '.optional-summary'
  ].join(', ');

  var supportsIndependentScale = !!(
    global.CSS &&
    typeof global.CSS.supports === 'function' &&
    global.CSS.supports('scale', '1')
  );

  var reduceMotionQuery = null;
  try {
    if (typeof global.matchMedia === 'function') {
      reduceMotionQuery = global.matchMedia('(prefers-reduced-motion: reduce)');
    }
  } catch (e) {}

  var stateByElement = new WeakMap();
  var activePointers = new Map();
  var activeTouchTarget = null;
  var activeMouseTarget = null;
  var lastTouchAt = 0;

  function getNow() {
    return global.performance && typeof global.performance.now === 'function'
      ? global.performance.now()
      : Date.now();
  }

  function isReducedMotion() {
    return !!(reduceMotionQuery && reduceMotionQuery.matches);
  }

  function normalizeTarget(target) {
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
  }

  function findPressableTarget(target) {
    var node = normalizeTarget(target);
    if (!node || !node.closest) return null;
    var pressable = node.closest(PRESS_SELECTOR);
    if (!pressable) return null;
    if (pressable.disabled || pressable.getAttribute('aria-disabled') === 'true') {
      return null;
    }
    return pressable;
  }

  function formatScale(value) {
    var fixed = value.toFixed(4);
    return fixed.replace(/\.?0+$/, '');
  }

  function getState(el) {
    var state = stateByElement.get(el);
    if (state) return state;
    state = {
      currentScale: 1,
      rafId: 0,
      fromScale: 1,
      toScale: 1,
      startAt: 0,
      duration: 0,
      fallbackBaseTransform: '',
      fallbackInlineTransform: '',
      fallbackCaptured: false
    };
    stateByElement.set(el, state);
    return state;
  }

  function stopAnimation(state) {
    if (!state.rafId) return;
    global.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function applyScale(el, state, nextScale) {
    state.currentScale = nextScale;
    var value = formatScale(nextScale);
    if (supportsIndependentScale) {
      el.style.setProperty('scale', value);
      return;
    }

    var base = state.fallbackBaseTransform;
    if (base && base !== 'none') {
      el.style.setProperty('transform', base + ' scale(' + value + ')');
      return;
    }
    el.style.setProperty('transform', 'scale(' + value + ')');
  }

  function restoreScale(el, state) {
    state.currentScale = 1;
    if (supportsIndependentScale) {
      el.style.removeProperty('scale');
      return;
    }

    if (state.fallbackCaptured && state.fallbackInlineTransform) {
      el.style.setProperty('transform', state.fallbackInlineTransform);
    } else {
      el.style.removeProperty('transform');
    }
    state.fallbackBaseTransform = '';
    state.fallbackInlineTransform = '';
    state.fallbackCaptured = false;
  }

  function captureFallbackBase(el, state) {
    if (supportsIndependentScale || state.fallbackCaptured) return;
    var computed = global.getComputedStyle(el);
    state.fallbackBaseTransform = computed && computed.transform && computed.transform !== 'none'
      ? computed.transform
      : '';
    state.fallbackInlineTransform = el.style.transform || '';
    state.fallbackCaptured = true;
  }

  function animateScale(el, targetScale, durationMs) {
    var state = getState(el);
    stopAnimation(state);

    if (targetScale < 0.9995) {
      captureFallbackBase(el, state);
    }

    var from = state.currentScale;
    if (isReducedMotion() || durationMs <= 0 || Math.abs(from - targetScale) < 0.0008) {
      if (targetScale >= 0.9995) {
        restoreScale(el, state);
      } else {
        applyScale(el, state, targetScale);
      }
      return;
    }

    state.fromScale = from;
    state.toScale = targetScale;
    state.duration = durationMs;
    state.startAt = getNow();

    function step(now) {
      var elapsed = now - state.startAt;
      var progress = elapsed / state.duration;
      if (progress >= 1) {
        state.rafId = 0;
        if (targetScale >= 0.9995) {
          restoreScale(el, state);
        } else {
          applyScale(el, state, targetScale);
        }
        return;
      }

      var eased = easeOutCubic(Math.max(0, progress));
      var next = state.fromScale + ((state.toScale - state.fromScale) * eased);
      applyScale(el, state, next);
      state.rafId = global.requestAnimationFrame(step);
    }

    state.rafId = global.requestAnimationFrame(step);
  }

  function press(el) {
    animateScale(el, PRESS_TARGET_SCALE, PRESS_IN_DURATION_MS);
  }

  function release(el) {
    animateScale(el, 1, PRESS_OUT_DURATION_MS);
  }

  function releaseAllActive() {
    activePointers.forEach(function(el) {
      release(el);
    });
    activePointers.clear();

    if (activeTouchTarget) {
      release(activeTouchTarget);
      activeTouchTarget = null;
    }

    if (activeMouseTarget) {
      release(activeMouseTarget);
      activeMouseTarget = null;
    }
  }

  function onPointerDown(e) {
    if (e.isPrimary === false) return;
    if (typeof e.button === 'number' && e.button !== 0) return;

    var target = findPressableTarget(e.target);
    if (!target) return;

    var prev = activePointers.get(e.pointerId);
    if (prev && prev !== target) release(prev);

    activePointers.set(e.pointerId, target);
    press(target);
  }

  function onPointerEnd(e) {
    var target = activePointers.get(e.pointerId);
    if (!target) return;
    activePointers.delete(e.pointerId);
    release(target);
  }

  function onTouchStart(e) {
    var target = findPressableTarget(e.target);
    if (!target) return;
    lastTouchAt = Date.now();
    activeTouchTarget = target;
    press(target);
  }

  function onTouchEnd() {
    if (!activeTouchTarget) return;
    release(activeTouchTarget);
    activeTouchTarget = null;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    if ((Date.now() - lastTouchAt) < SYNTHETIC_MOUSE_GUARD_MS) return;

    var target = findPressableTarget(e.target);
    if (!target) return;
    activeMouseTarget = target;
    press(target);
  }

  function onMouseUp() {
    if (!activeMouseTarget) return;
    release(activeMouseTarget);
    activeMouseTarget = null;
  }

  if ('PointerEvent' in global) {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
  } else {
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      releaseAllActive();
    }
  });
  global.addEventListener('blur', releaseAllActive);
})(window);
