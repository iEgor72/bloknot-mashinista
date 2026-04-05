    // ── Telegram WebApp Init ──
    try {
      if (window.Telegram && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
      }
    } catch(e) { console.warn('TG SDK init error:', e); }

    // ── Constants ──
    var MONTH_NAMES = [
      'Январь','Февраль','Март','Апрель','Май','Июнь',
      'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
    ];

    // Производственный календарь РФ, 40-часовая неделя
    // 2025: КонсультантПлюс, 2026: Минтруд утвержденный
    // 2027: предварительный (переносы не утверждены)
    var WORK_NORMS = {
      '2025-01': 136, '2025-02': 160, '2025-03': 167,
      '2025-04': 175, '2025-05': 144, '2025-06': 151,
      '2025-07': 184, '2025-08': 168, '2025-09': 176,
      '2025-10': 184, '2025-11': 151, '2025-12': 176,

      '2026-01': 120, '2026-02': 152, '2026-03': 168,
      '2026-04': 175, '2026-05': 151, '2026-06': 167,
      '2026-07': 184, '2026-08': 168, '2026-09': 176,
      '2026-10': 176, '2026-11': 159, '2026-12': 176
    };

    function isNonWorkingHolidayLocalDate(date) {
      var month = date.getMonth();
      var day = date.getDate();

      if (month === 0) return day >= 1 && day <= 8;
      if (month === 1) return day === 23;
      if (month === 2) return day === 8;
      if (month === 4) return day === 1 || day === 9;
      if (month === 5) return day === 12;
      if (month === 10) return day === 4;
      return false;
    }

    var STORAGE_KEY = 'shifts';
    var MSK_OFFSET = 3; // Moscow = UTC+3
    var SHORT_REST_THRESHOLD_MIN = 8 * 60;
    var MIN_SHIFTS_FOR_AVERAGE = 2;

    // ── State ──
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth(); // 0-indexed
    var salaryYear = now.getFullYear();
    var salaryMonth = now.getMonth();
    var allShifts = [];
    var pendingDeleteId = null;
    var editingShiftId = null;
    var recentAddedShiftId = null;
    var recentAddTimer = null;
    var activeTab = 'home';
    var activeShiftMenuId = null;
    var activeShiftMenuScope = null;

    // ── Timezone ──
    var deviceTimezone = 'Europe/Moscow';
    try {
      deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
    } catch(e) {}

    var footerEl = document.getElementById('timezoneFooter');
    var SHIFT_ACTIONS_BACKDROP = document.getElementById('shiftActionsBackdrop');
    var APP_SHELL = document.querySelector('.app');
    var APP_CONTENT = document.querySelector('.app-content');
    var BOTTOM_NAV = document.querySelector('.bottom-nav');
    var keyboardFocusField = null;
    var keyboardStateOpen = false;
    var keyboardSyncTimer = null;
    var keyboardRevealTimer = null;
    var navHeightSyncTimer = null;
    var baselineViewportHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
    var baselineVisualViewportHeight = Math.round(
      (window.visualViewport && window.visualViewport.height) ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      0
    );
    function updateFooter() {
      var userLabel = CURRENT_USER ? (' · ' + (CURRENT_USER.display_name || CURRENT_USER.username || ('ID ' + CURRENT_USER.id))) : '';
      var text = 'Часовой пояс: ' + deviceTimezone + userLabel;
      if (footerEl) footerEl.textContent = text;
    }
    updateFooter();

    function setCssVar(name, value) {
      document.documentElement.style.setProperty(name, value);
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

    function getViewportHeight() {
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
      baselineViewportHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
      baselineVisualViewportHeight = Math.round(
        (window.visualViewport && window.visualViewport.height) ||
        baselineViewportHeight ||
        0
      );
    }

    function updateViewportMetrics() {
      var height = getViewportHeight();
      if (height > 0) {
        if (!keyboardStateOpen && isStandalonePwa()) {
          // In iOS standalone mode rely on native dynamic viewport height.
          // Manual px measurements may temporarily under-report height and create bottom black bars.
          setCssVar('--app-viewport-height', '100dvh');
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
        }

        setCssVar('--app-viewport-height', height + 'px');
      }
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

      if (open !== keyboardStateOpen) {
        keyboardStateOpen = open;
        document.body.classList.toggle('is-keyboard-open', open);
      } else if (!open) {
        document.body.classList.remove('is-keyboard-open');
      }

      setCssVar('--keyboard-focus-scroll-bottom', open ? '280px' : '160px');
      updateViewportMetrics();

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

    var APP_VERSION = '1.0.0 (1)';
    var SETTINGS_STORAGE_KEY = 'shift_tracker_settings_v1';
    var DEFAULT_APP_SETTINGS = {
      tariffRate: 380,
      nightPercent: 40,
      classPercent: 5,
      districtPercent: 30,
      northPercent: 50,
      localPercent: 20
    };
    var appSettings = loadAppSettings();
    var SHIFTS_CACHE_STORAGE_KEY = 'shift_tracker_shifts_cache_v1';
    var SHIFTS_PENDING_STORAGE_KEY = 'shift_tracker_shifts_pending_v1';
    var SHIFTS_META_STORAGE_KEY = 'shift_tracker_shifts_meta_v1';
    var pendingMutationIds = [];
    var offlineUiState = {
      isOffline: false,
      isSyncing: false,
      hasPending: false,
      lastSyncStatus: 'idle',
      lastError: ''
    };

    function getOfflineStorageUserId() {
      // Prefer CURRENT_USER, then fall back to the persisted cached user so
      // storage keys stay consistent even while auth is in progress or has
      // temporarily reset CURRENT_USER to null (e.g. silent background auth).
      if (CURRENT_USER && CURRENT_USER.id !== undefined && CURRENT_USER.id !== null) {
        return String(CURRENT_USER.id);
      }
      var stored = getStoredCachedUser();
      if (stored && stored.id !== undefined && stored.id !== null) {
        return String(stored.id);
      }
      return 'guest';
    }

    function getOfflineStorageKey(baseKey) {
      return baseKey + '_' + getOfflineStorageUserId();
    }

    function readStoredJson(key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return fallback;
        var parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (e) {
        return fallback;
      }
    }

    function writeStoredJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    }

    function readOfflineMeta() {
      return readStoredJson(getOfflineStorageKey(SHIFTS_META_STORAGE_KEY), {});
    }

    function writeOfflineMeta(patch) {
      var meta = readOfflineMeta();
      var keys = Object.keys(patch || {});
      for (var i = 0; i < keys.length; i++) {
        meta[keys[i]] = patch[keys[i]];
      }
      meta.version = 1;
      meta.userId = getOfflineStorageUserId();
      offlineUiState = meta;
      return writeStoredJson(getOfflineStorageKey(SHIFTS_META_STORAGE_KEY), meta);
    }

    function cloneShiftForCache(shift) {
      var copy = {};
      var keys = Object.keys(shift || {});
      for (var i = 0; i < keys.length; i++) {
        copy[keys[i]] = shift[keys[i]];
      }
      copy.pending = !!shift.pending;
      return copy;
    }

    function cloneShiftsForCache(shifts) {
      var list = [];
      for (var i = 0; i < (shifts || []).length; i++) {
        list.push(cloneShiftForCache(shifts[i]));
      }
      return list;
    }

    function cloneShiftsForServer(shifts) {
      var list = [];
      for (var i = 0; i < (shifts || []).length; i++) {
        var shift = shifts[i] || {};
        var copy = {};
        var keys = Object.keys(shift);
        for (var j = 0; j < keys.length; j++) {
          if (keys[j] === 'pending') continue;
          copy[keys[j]] = shift[keys[j]];
        }
        list.push(copy);
      }
      return list;
    }

    function normalizePendingIds(pendingIds) {
      var result = [];
      var seen = {};
      for (var i = 0; i < (pendingIds || []).length; i++) {
        var id = String(pendingIds[i] || '');
        if (!id || seen[id]) continue;
        seen[id] = true;
        result.push(id);
      }
      return result;
    }

    function applyPendingFlags(shifts, pendingIds) {
      var map = {};
      for (var i = 0; i < (pendingIds || []).length; i++) {
        map[String(pendingIds[i])] = true;
      }
      var list = [];
      for (var j = 0; j < (shifts || []).length; j++) {
        var shift = cloneShiftForCache(shifts[j]);
        shift.pending = !!shift.pending || !!map[String(shift.id)];
        list.push(shift);
      }
      return list;
    }

    function clearPendingFlags(shifts) {
      var list = [];
      for (var i = 0; i < (shifts || []).length; i++) {
        var shift = cloneShiftForCache(shifts[i]);
        shift.pending = false;
        list.push(shift);
      }
      return list;
    }

    function normalizeShiftsForDisplay(shifts) {
      var normalized = clearPendingFlags(shifts);
      var pendingMap = getPendingShiftIdMap();
      var pendingIds = Object.keys(pendingMap);
      return pendingIds.length ? applyPendingFlags(normalized, pendingIds) : normalized;
    }

    function getPendingShiftIdMap() {
      var pending = readPendingSnapshot();
      var map = {};
      if (pending && Array.isArray(pending.pendingIds)) {
        for (var i = 0; i < pending.pendingIds.length; i++) {
          map[String(pending.pendingIds[i])] = true;
        }
      }
      if (pending && Array.isArray(pending.shifts)) {
        for (var j = 0; j < pending.shifts.length; j++) {
          var pendingShift = pending.shifts[j];
          if (pendingShift && pendingShift.pending && pendingShift.id !== undefined && pendingShift.id !== null) {
            map[String(pendingShift.id)] = true;
          }
        }
      }
      return map;
    }

    function isShiftPending(shift) {
      return !!(shift && shift.pending);
    }

    function readShiftsCache() {
      return readStoredJson(getOfflineStorageKey(SHIFTS_CACHE_STORAGE_KEY), null);
    }

    function writeShiftsCache(shifts, metaPatch) {
      var payload = {
        version: 1,
        userId: getOfflineStorageUserId(),
        updatedAt: new Date().toISOString(),
        shifts: cloneShiftsForCache(shifts)
      };
      writeStoredJson(getOfflineStorageKey(SHIFTS_CACHE_STORAGE_KEY), payload);
      writeOfflineMeta({
        isOffline: metaPatch && metaPatch.isOffline !== undefined ? !!metaPatch.isOffline : !navigator.onLine,
        isSyncing: metaPatch && metaPatch.isSyncing !== undefined ? !!metaPatch.isSyncing : false,
        hasPending: metaPatch && metaPatch.hasPending !== undefined ? !!metaPatch.hasPending : !!readPendingSnapshot(),
        lastSyncStatus: metaPatch && metaPatch.lastSyncStatus !== undefined ? metaPatch.lastSyncStatus : 'synced',
        lastError: metaPatch && metaPatch.lastError !== undefined ? metaPatch.lastError : '',
        lastSyncAt: metaPatch && metaPatch.lastSyncAt !== undefined ? metaPatch.lastSyncAt : payload.updatedAt
      });
      return payload;
    }

    function readPendingSnapshot() {
      return readStoredJson(getOfflineStorageKey(SHIFTS_PENDING_STORAGE_KEY), null);
    }

    function writePendingSnapshot(shifts, pendingIds) {
      // Collect IDs from both the explicit list and any shift already flagged pending=true
      // (pending=true flags come from previous offline sessions loaded via cache)
      var fromParam = pendingIds || pendingMutationIds || [];
      var fromShifts = [];
      for (var psi = 0; psi < (shifts || []).length; psi++) {
        if (shifts[psi] && shifts[psi].pending) fromShifts.push(String(shifts[psi].id));
      }
      var normalizedIds = normalizePendingIds(fromParam.concat(fromShifts));
      var payload = {
        version: 1,
        userId: getOfflineStorageUserId(),
        savedAt: new Date().toISOString(),
        reason: 'offline-save',
        pendingIds: normalizedIds,
        shifts: applyPendingFlags(shifts, normalizedIds)
      };
      writeStoredJson(getOfflineStorageKey(SHIFTS_PENDING_STORAGE_KEY), payload);
      writeOfflineMeta({
        isOffline: !navigator.onLine,
        isSyncing: false,
        hasPending: true,
        lastSyncStatus: 'pending',
        lastError: ''
      });
      return payload;
    }

    function clearPendingSnapshot() {
      // Remove ALL keys matching the pending pattern (any userId suffix),
      // so stale keys written under a different userId never linger.
      try {
        var toRemove = [];
        for (var ki = 0; ki < localStorage.length; ki++) {
          var k = localStorage.key(ki);
          if (k && k.indexOf(SHIFTS_PENDING_STORAGE_KEY) === 0) toRemove.push(k);
        }
        console.log('[clearPending] removing keys:', toRemove);
        for (var ri = 0; ri < toRemove.length; ri++) localStorage.removeItem(toRemove[ri]);
      } catch (e) {}
      writeOfflineMeta({
        isOffline: !navigator.onLine,
        isSyncing: false,
        hasPending: false,
        lastSyncStatus: 'synced',
        lastError: ''
      });
      pendingMutationIds = [];
      if (Array.isArray(allShifts)) {
        allShifts = clearPendingFlags(allShifts);
      }
    }

    function updateOfflineUiState(state) {
      if (state) {
        offlineUiState = {
          isOffline: state.isOffline !== undefined ? !!state.isOffline : !!offlineUiState.isOffline,
          isSyncing: state.isSyncing !== undefined ? !!state.isSyncing : !!offlineUiState.isSyncing,
          hasPending: state.hasPending !== undefined ? !!state.hasPending : !!offlineUiState.hasPending,
          lastSyncStatus: state.lastSyncStatus !== undefined ? state.lastSyncStatus : offlineUiState.lastSyncStatus,
          lastError: state.lastError !== undefined ? state.lastError : offlineUiState.lastError,
          lastSyncAt: state.lastSyncAt !== undefined ? state.lastSyncAt : offlineUiState.lastSyncAt
        };
        writeOfflineMeta(offlineUiState);
      } else {
        var meta = readOfflineMeta();
        var pending = readPendingSnapshot();
        offlineUiState = {
          isOffline: !navigator.onLine || !!meta.isOffline,
          isSyncing: !!meta.isSyncing,
          hasPending: !!pending || !!meta.hasPending,
          lastSyncStatus: meta.lastSyncStatus || 'idle',
          lastError: meta.lastError || '',
          lastSyncAt: meta.lastSyncAt || ''
        };
      }

      var bannerEl = document.getElementById('offlineBanner');
      var titleEl = document.getElementById('offlineBannerTitle');
      var textEl = document.getElementById('offlineBannerText');
      var syncEl = document.getElementById('offlineSyncStatus');
      if (!bannerEl || !titleEl || !textEl || !syncEl) return;

      var isOffline = !!offlineUiState.isOffline || !navigator.onLine;
      var hasPending = !!offlineUiState.hasPending || !!readPendingSnapshot();
      var isSyncing = !!offlineUiState.isSyncing;
      var status = offlineUiState.lastSyncStatus || 'idle';

      if (isSyncing) {
        titleEl.textContent = 'Синхронизация';
        textEl.textContent = 'Отправляем локальные изменения на сервер.';
        syncEl.textContent = 'Синхронизация...';
      } else if (isOffline) {
        titleEl.textContent = 'Нет сети';
        textEl.textContent = hasPending ? 'Показываем последние сохранённые данные. Изменения отправятся при появлении сети.' : 'Показываем последние сохранённые данные.';
        syncEl.textContent = hasPending ? 'Сохранено локально' : 'Оффлайн';
      } else if (status === 'error') {
        titleEl.textContent = 'Ошибка синхронизации';
        textEl.textContent = 'Локальная копия сохранена. Повторим отправку автоматически.';
        syncEl.textContent = 'Ошибка синхронизации';
      } else if (hasPending) {
        titleEl.textContent = 'Есть несинхронизированные изменения';
        textEl.textContent = 'Данные сохранены локально и будут отправлены при появлении сети.';
        syncEl.textContent = 'Сохранено локально';
      } else {
        titleEl.textContent = 'Данные актуальны';
        textEl.textContent = 'Локальный кэш и сервер синхронизированы.';
        syncEl.textContent = 'Синхронизировано';
      }

      var shouldShowBanner = status === 'error';
      bannerEl.classList.toggle('hidden', !shouldShowBanner);
      bannerEl.setAttribute('aria-hidden', bannerEl.classList.contains('hidden') ? 'true' : 'false');
    }

    function flushPendingSnapshot(source, callback, shouldRender) {
      if (typeof source === 'function') {
        callback = source;
        source = 'save';
      }
      if (shouldRender === undefined) shouldRender = true;
      var pending = readPendingSnapshot();
      if (!pending || !pending.shifts) {
        updateOfflineUiState({ isSyncing: false, hasPending: false, lastSyncStatus: 'synced', lastError: '' });
        if (callback) callback(null);
        return;
      }

      if (!navigator.onLine) {
        updateOfflineUiState({ isOffline: true, isSyncing: false, hasPending: true, lastSyncStatus: 'pending', lastError: '' });
        if (callback) callback(null);
        return;
      }

      updateOfflineUiState({ isSyncing: true, lastSyncStatus: 'syncing', lastError: '' });

      fetchJson(SHIFTS_API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ shifts: cloneShiftsForServer(pending.shifts) })
      }).then(function(result) {
        if (result.ok) {
          var committedShifts = clearPendingFlags(pending.shifts);
          clearPendingSnapshot();
          allShifts = committedShifts;
          writeShiftsCache(committedShifts, {
            isOffline: false,
            isSyncing: false,
            hasPending: false,
            lastSyncStatus: 'synced',
            lastError: '',
            lastSyncAt: new Date().toISOString()
          });
          updateOfflineUiState({ isOffline: false, isSyncing: false, hasPending: false, lastSyncStatus: 'synced', lastError: '' });
          if (callback) callback(null);
          if (shouldRender) render();
          return;
        }

        if (result.status === 401) {
          updateOfflineUiState({ isSyncing: false, lastSyncStatus: 'error', lastError: 'Unauthorized' });
          handleAuthUnauthorized(source === 'load' ? 'load' : 'save');
          if (callback) callback(new Error('Unauthorized'));
          return;
        }

        updateOfflineUiState({ isOffline: !navigator.onLine, isSyncing: false, hasPending: true, lastSyncStatus: 'error', lastError: (result.body && result.body.error) || 'API save failed' });
        if (callback) callback(new Error((result.body && result.body.error) || 'API save failed'));
      }).catch(function(err) {
        updateOfflineUiState({ isOffline: true, isSyncing: false, hasPending: true, lastSyncStatus: 'error', lastError: err && err.message ? err.message : 'Network error' });
        if (callback) callback(err || new Error('Network error'));
      });
    }

    function loadAppSettings() {
      var settings = {};
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}') || {};
      } catch (e) {
        settings = {};
      }

      var merged = {};
      var keys = Object.keys(DEFAULT_APP_SETTINGS);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        merged[key] = settings[key] !== undefined && settings[key] !== null && settings[key] !== '' ? settings[key] : DEFAULT_APP_SETTINGS[key];
      }

      merged.tariffRate = parseFloat(merged.tariffRate);
      merged.nightPercent = parseFloat(merged.nightPercent);
      merged.classPercent = parseFloat(merged.classPercent);
      merged.districtPercent = parseFloat(merged.districtPercent);
      merged.northPercent = parseFloat(merged.northPercent);
      merged.localPercent = parseFloat(merged.localPercent);

      if (isNaN(merged.tariffRate)) merged.tariffRate = DEFAULT_APP_SETTINGS.tariffRate;
      if (isNaN(merged.nightPercent)) merged.nightPercent = DEFAULT_APP_SETTINGS.nightPercent;
      if (isNaN(merged.classPercent)) merged.classPercent = DEFAULT_APP_SETTINGS.classPercent;
      if (isNaN(merged.districtPercent)) merged.districtPercent = DEFAULT_APP_SETTINGS.districtPercent;
      if (isNaN(merged.northPercent)) merged.northPercent = DEFAULT_APP_SETTINGS.northPercent;
      if (isNaN(merged.localPercent)) merged.localPercent = DEFAULT_APP_SETTINGS.localPercent;
      return merged;
    }

    function saveAppSettings() {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
      } catch (e) {}
    }

    function formatRub(value) {
      var rounded = Math.round(value || 0);
      return rounded.toLocaleString('ru-RU') + ' ₽';
    }

    function formatPercent(value) {
      var rounded = Math.round((value || 0) * 10) / 10;
      return String(rounded).replace(/\.0$/, '') + '%';
    }

    function setQuickMetricText(id, value) {
      var el = document.getElementById(id);
      if (!el) return;
      var next = String(value);
      if (el.textContent === next) return;
      el.textContent = next;
      el.classList.remove('is-updated');
      void el.offsetWidth;
      el.classList.add('is-updated');
      window.setTimeout(function() {
        el.classList.remove('is-updated');
      }, 480);
    }

    function setSettingsInputValue(id, value) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.value !== String(value)) {
        el.value = String(value);
      }
    }

    function updateSettingsControls() {
      setSettingsInputValue('settingTariff', appSettings.tariffRate);
      setSettingsInputValue('settingNightPercent', appSettings.nightPercent);
      setSettingsInputValue('settingClassPercent', appSettings.classPercent);
      setSettingsInputValue('settingDistrictPercent', appSettings.districtPercent);
      setSettingsInputValue('settingNorthPercent', appSettings.northPercent);
      setSettingsInputValue('settingLocalPercent', appSettings.localPercent);

      var versionValue = document.getElementById('appVersionValue');
      if (versionValue) versionValue.textContent = APP_VERSION;
      updateFooter();
    }

    function syncSettingsFromInputs() {
      var tariffEl = document.getElementById('settingTariff');
      var nightEl = document.getElementById('settingNightPercent');
      var classEl = document.getElementById('settingClassPercent');
      var districtEl = document.getElementById('settingDistrictPercent');
      var northEl = document.getElementById('settingNorthPercent');
      var localEl = document.getElementById('settingLocalPercent');

      var tariff = tariffEl ? parseFloat(tariffEl.value) : NaN;
      var night = nightEl ? parseFloat(nightEl.value) : NaN;
      var klass = classEl ? parseFloat(classEl.value) : NaN;
      var district = districtEl ? parseFloat(districtEl.value) : NaN;
      var north = northEl ? parseFloat(northEl.value) : NaN;
      var local = localEl ? parseFloat(localEl.value) : NaN;

      appSettings.tariffRate = isNaN(tariff) ? DEFAULT_APP_SETTINGS.tariffRate : tariff;
      appSettings.nightPercent = isNaN(night) ? DEFAULT_APP_SETTINGS.nightPercent : night;
      appSettings.classPercent = isNaN(klass) ? DEFAULT_APP_SETTINGS.classPercent : klass;
      appSettings.districtPercent = isNaN(district) ? DEFAULT_APP_SETTINGS.districtPercent : district;
      appSettings.northPercent = isNaN(north) ? DEFAULT_APP_SETTINGS.northPercent : north;
      appSettings.localPercent = isNaN(local) ? DEFAULT_APP_SETTINGS.localPercent : local;

      saveAppSettings();
      render();
    }

    function bindSettingsControls() {
      var settingsInputIds = [
        'settingTariff',
        'settingNightPercent',
        'settingClassPercent',
        'settingDistrictPercent',
        'settingNorthPercent',
        'settingLocalPercent'
      ];

      for (var i = 0; i < settingsInputIds.length; i++) {
        var el = document.getElementById(settingsInputIds[i]);
        if (!el) continue;
        el.addEventListener('change', syncSettingsFromInputs);
        el.addEventListener('blur', syncSettingsFromInputs);
      }

    }

    function moneyFromHours(hours, rate, percent) {
      return (hours || 0) * (rate || 0) * ((percent || 0) / 100);
    }

    function calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin) {
      var workedHours = totalMin / 60;
      var nightHours = nightMin / 60;
      var holidayHours = holidayMin / 60;
      var tariffRate = appSettings.tariffRate;
      var tariffAmount = workedHours * tariffRate;
      var nightAmount = moneyFromHours(nightHours, tariffRate, appSettings.nightPercent);
      var classAmount = moneyFromHours(workedHours, tariffRate, appSettings.classPercent);
      var holidayAmount = holidayHours > 0 ? moneyFromHours(holidayHours, tariffRate, 100) : 0;
      var baseAmount = tariffAmount + nightAmount + classAmount + holidayAmount;
      var districtAmount = baseAmount * (appSettings.districtPercent / 100);
      var northAmount = baseAmount * (appSettings.northPercent / 100);
      var localAmount = baseAmount * (appSettings.localPercent / 100);
      var coeffTotal = districtAmount + northAmount + localAmount;
      var accruedAmount = baseAmount + coeffTotal;
      var ndflBase = baseAmount * 0.13;
      var ndflCoeffs = coeffTotal * 0.13;
      var netAmount = accruedAmount - ndflBase - ndflCoeffs;

      return {
        workedHours: workedHours,
        nightHours: nightHours,
        holidayHours: holidayHours,
        tariffAmount: tariffAmount,
        nightAmount: nightAmount,
        classAmount: classAmount,
        holidayAmount: holidayAmount,
        baseAmount: baseAmount,
        districtAmount: districtAmount,
        northAmount: northAmount,
        localAmount: localAmount,
        coeffTotal: coeffTotal,
        accruedAmount: accruedAmount,
        ndflBase: ndflBase,
        ndflCoeffs: ndflCoeffs,
        netAmount: netAmount
      };
    }

    function createSalaryRowHtml(code, title, detail, value) {
      var detailHtml = detail ? '<div class="salary-note">' + detail + '</div>' : '';
      return '<div class="salary-row">' +
        '<div class="salary-code">' + code + '</div>' +
        '<div class="salary-main">' +
          '<div class="salary-name">' + title + '</div>' +
          detailHtml +
        '</div>' +
        '<div class="salary-value">' + value + '</div>' +
      '</div>';
    }

    function buildSalarySummary(monthShifts, bounds) {
      var totalMin = 0;
      var nightMin = 0;
      var holidayMin = 0;
      for (var i = 0; i < monthShifts.length; i++) {
        totalMin += shiftMinutesInRange(monthShifts[i], bounds.start, bounds.end);
        nightMin += shiftNightMinutesInRange(monthShifts[i], bounds.start, bounds.end);
        holidayMin += shiftHolidayMinutesInRange(monthShifts[i], bounds.start, bounds.end);
      }

      return calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin);
    }

    function buildShiftIncomeLevelStats(incomeValues) {
      var values = [];
      for (var i = 0; i < incomeValues.length; i++) {
        var value = Number(incomeValues[i]);
        if (!isFinite(value) || value < 0) continue;
        values.push(value);
      }

      if (!values.length) {
        return {
          count: 0,
          average: 0,
          spread: 0,
          lowThreshold: 0,
          highThreshold: 0,
          stableSpread: 0
        };
      }

      var min = values[0];
      var max = values[0];
      var sum = 0;
      for (var v = 0; v < values.length; v++) {
        var current = values[v];
        sum += current;
        if (current < min) min = current;
        if (current > max) max = current;
      }

      var average = sum / values.length;
      return {
        count: values.length,
        average: average,
        spread: max - min,
        lowThreshold: average * 0.85,
        highThreshold: average * 1.15,
        stableSpread: Math.max(350, average * 0.08)
      };
    }

    function getShiftIncomeLevel(amount, stats) {
      if (!stats || stats.count < 3) return 'medium';
      if (stats.spread < stats.stableSpread) return 'medium';
      if (amount <= stats.lowThreshold) return 'low';
      if (amount >= stats.highThreshold) return 'high';
      return 'medium';
    }

    function buildMonthShiftIncomeMap(monthShifts, bounds) {
      var incomeMap = {};
      if (!monthShifts || !monthShifts.length || !bounds) return incomeMap;

      var incomeValues = [];
      for (var i = 0; i < monthShifts.length; i++) {
        var shift = monthShifts[i];
        var totalMin = shiftMinutesInRange(shift, bounds.start, bounds.end);
        var nightMin = shiftNightMinutesInRange(shift, bounds.start, bounds.end);
        var holidayMin = shiftHolidayMinutesInRange(shift, bounds.start, bounds.end);
        var summary = calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin);
        var amount = summary.netAmount;
        var shiftId = String(shift.id);
        incomeMap[shiftId] = {
          amount: amount,
          level: 'medium'
        };
        incomeValues.push(amount);
      }

      var stats = buildShiftIncomeLevelStats(incomeValues);
      var incomeKeys = Object.keys(incomeMap);
      for (var k = 0; k < incomeKeys.length; k++) {
        var key = incomeKeys[k];
        incomeMap[key].level = getShiftIncomeLevel(incomeMap[key].amount, stats);
      }

      return incomeMap;
    }

    function buildAverageShiftSummary(monthShifts, bounds, shiftIncomeMap) {
      var shifts = monthShifts || [];
      var totalDurationMin = 0;
      var durationCount = 0;
      var totalIncome = 0;
      var incomeCount = 0;

      for (var i = 0; i < shifts.length; i++) {
        var shift = shifts[i];
        var durationMin = shiftMinutesInRange(shift, bounds.start, bounds.end);
        if (durationMin > 0) {
          totalDurationMin += durationMin;
          durationCount++;
        }

        var incomeData = shiftIncomeMap ? shiftIncomeMap[String(shift.id)] : null;
        var incomeAmount = incomeData ? Number(incomeData.amount) : NaN;
        if (isFinite(incomeAmount) && incomeAmount >= 0) {
          totalIncome += incomeAmount;
          incomeCount++;
        }
      }

      return {
        shiftCount: shifts.length,
        durationCount: durationCount,
        incomeCount: incomeCount,
        averageDurationMin: durationCount ? (totalDurationMin / durationCount) : 0,
        averageIncome: incomeCount ? (totalIncome / incomeCount) : 0
      };
    }

    function renderAverageShiftSummary(summary) {
      var incomeEl = document.getElementById('avgShiftIncome');
      var durationEl = document.getElementById('avgShiftDuration');
      var metaEl = document.getElementById('avgShiftMeta');
      if (!incomeEl || !durationEl || !metaEl) return;

      if (!summary || summary.shiftCount < MIN_SHIFTS_FOR_AVERAGE) {
        incomeEl.textContent = 'Недостаточно данных';
        durationEl.textContent = 'Недостаточно данных';
        metaEl.textContent = summary && summary.shiftCount === 0
          ? 'Нет смен за месяц'
          : 'Добавьте минимум 2 смены';
        return;
      }

      incomeEl.textContent = summary.incomeCount > 0
        ? formatRub(summary.averageIncome)
        : 'Недостаточно данных';
      durationEl.textContent = summary.durationCount > 0
        ? formatHoursAndMinutes(summary.averageDurationMin)
        : 'Недостаточно данных';

      metaEl.textContent = (summary.incomeCount > 0 && summary.durationCount > 0)
        ? ('По ' + summary.shiftCount + ' сменам за месяц')
        : 'Данные за месяц неполные';
    }

    function renderSalaryPanel() {
      var bounds = getMonthBounds(salaryYear, salaryMonth);
      var monthShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (shiftMinutesInRange(allShifts[i], bounds.start, bounds.end) > 0) {
          monthShifts.push(allShifts[i]);
        }
      }
      monthShifts.sort(compareShiftsByStartDesc);

      var summary = buildSalarySummary(monthShifts, bounds);
      renderMonthHeader('salaryMonthTitle', 'salaryMonthQuarter', 'salaryMonthTabs', salaryYear, salaryMonth, function(targetMonth) {
        salaryMonth = targetMonth;
        render();
      });

      var salaryNetTop = document.getElementById('salaryNetTop');
      var salaryNetBottom = document.getElementById('salaryNetBottom');
      var salaryAccrued = document.getElementById('salaryAccrued');
      var salaryNdflBase = document.getElementById('salaryNdflBase');
      var salaryNdflCoeffs = document.getElementById('salaryNdflCoeffs');
      var salaryBaseTotal = document.getElementById('salaryBaseTotal');
      if (salaryNetTop) salaryNetTop.textContent = formatRub(summary.netAmount);
      if (salaryNetBottom) salaryNetBottom.textContent = formatRub(summary.netAmount);
      if (salaryAccrued) salaryAccrued.textContent = formatRub(summary.accruedAmount);
      if (salaryNdflBase) salaryNdflBase.textContent = '-' + formatRub(summary.ndflBase);
      if (salaryNdflCoeffs) salaryNdflCoeffs.textContent = '-' + formatRub(summary.ndflCoeffs);
      if (salaryBaseTotal) salaryBaseTotal.textContent = formatRub(summary.baseAmount);

      var baseRows = [];
      baseRows.push(createSalaryRowHtml(
        '004L',
        'Тариф <span>(' + summary.workedHours.toFixed(2).replace('.', ',') + ' ч × ' + Number(appSettings.tariffRate).toFixed(2).replace('.', ',') + ' ₽)</span>',
        '',
        formatRub(summary.tariffAmount)
      ));
      baseRows.push(createSalaryRowHtml(
        '023L',
        'Ночные <span>(' + summary.nightHours.toFixed(2).replace('.', ',') + ' ч × ' + formatPercent(appSettings.nightPercent) + ')</span>',
        '',
        formatRub(summary.nightAmount)
      ));
      baseRows.push(createSalaryRowHtml(
        '025L',
        'Классная квалификация <span>(' + formatPercent(appSettings.classPercent) + ')</span>',
        '',
        formatRub(summary.classAmount)
      ));
      if (summary.holidayHours > 0) {
        baseRows.push(createSalaryRowHtml(
          '024L',
          'Праздничные <span>(' + summary.holidayHours.toFixed(2).replace('.', ',') + ' ч × 100%)</span>',
          '',
          formatRub(summary.holidayAmount)
        ));
      }

      var coeffRows = [
        createSalaryRowHtml('026A', 'Районный коэфф. РФ <span>(' + formatPercent(appSettings.districtPercent) + ')</span>', '', formatRub(summary.districtAmount)),
        createSalaryRowHtml('027A', 'Северная надбавка <span>(' + formatPercent(appSettings.northPercent) + ')</span>', '', formatRub(summary.northAmount)),
        createSalaryRowHtml('028A', 'Местный коэфф. <span>(' + formatPercent(appSettings.localPercent) + ')</span>', '', formatRub(summary.localAmount))
      ];

      var baseList = document.getElementById('salaryBaseList');
      var coeffList = document.getElementById('salaryCoeffList');
      if (baseList) baseList.innerHTML = baseRows.join('');
      if (coeffList) coeffList.innerHTML = coeffRows.join('');
    }

    var API_BASE_URL = window.SHIFT_API_BASE_URL || '';
    var AUTH_API_URL = API_BASE_URL + '/api/auth';
    var SHIFTS_API_URL = API_BASE_URL + '/api/shifts';
    var TELEGRAM_BOT_USERNAME = 'bloknot_mashinista_bot';
    var CURRENT_USER = null;
    var AUTH_GATE = document.getElementById('authGate');
    var AUTH_CARD = document.getElementById('authCard');
    var AUTH_MODE_CHIP = document.getElementById('authModeChip');
    var AUTH_TITLE = document.getElementById('authTitle');
    var AUTH_MESSAGE = document.getElementById('authMessage');
    var AUTH_STATUS = document.getElementById('authStatus');
    var AUTH_BANNER = document.getElementById('authBanner');
    var AUTH_BANNER_ICON = document.getElementById('authBannerIcon');
    var AUTH_BANNER_TITLE = document.getElementById('authBannerTitle');
    var AUTH_BANNER_TEXT = document.getElementById('authBannerText');
    var AUTH_PRIMARY_ACTION = document.getElementById('authPrimaryAction');
    var AUTH_PRIMARY_HINT = document.getElementById('authPrimaryHint');
    var AUTH_ERROR = document.getElementById('authError');
    var AUTH_NOTE = document.getElementById('authNote');
    var AUTH_WIDGET = document.getElementById('telegramLoginWidget');
    var AUTH_WIDGET_SHELL = document.getElementById('authWidgetShell');
    var APP_SHELL = document.getElementById('appShell');
    var UI_OVERLAY_ROOT = document.getElementById('uiOverlayRoot');
    var SHIFT_ACTIONS_MENU = document.getElementById('shiftActionsMenu');
    var AUTH_WIDGET_READY = false;
    var authBootstrapPromise = null;
    var SESSION_STORAGE_KEY = 'shift_tracker_session_token';
    var AUTH_ENV_STATE = isLocalAuthEnvironment() ? 'dev' : 'prod';
    var AUTH_STATE = 'guest';
    var AUTH_VIEWS = {
      dev: {
        guest: {
          badge: 'DEV / LOCAL',
          title: 'Вход недоступен в локальной версии',
          message: 'Telegram не разрешает авторизацию с localhost. Открой приложение через бота или используй прод-домен.',
          primary: 'Открыть через Telegram',
          primaryHint: 'Telegram Login работает только на опубликованном домене.',
          status: '',
          note: 'Вход появится здесь только после публикации на прод-домене.',
          bannerTitle: 'Вход недоступен в локальной версии',
          bannerText: 'Telegram не разрешает авторизацию с localhost. Открой приложение через бота или используй прод-домен.',
          bannerIcon: 'i',
          showBanner: true,
          showWidget: false,
          showRetry: false,
          primaryBusy: false
        },
        authenticated: {
          showBanner: false,
          showWidget: false,
          showRetry: false,
          primaryBusy: false
        }
      },
      prod: {
        guest: {
          badge: 'Telegram login',
          title: 'Войди, чтобы увидеть свои смены',
          message: 'Открой приложение через Telegram или браузер и подтверди вход один раз. После этого данные будут синхронизироваться автоматически.',
          primary: 'Войти через Telegram',
          primaryHint: '',
          status: '',
          note: '',
          bannerTitle: '',
          bannerText: '',
          bannerIcon: 'i',
          showBanner: false,
          showWidget: true,
          showPrimary: false,
          showRetry: false,
          primaryBusy: false
        },
        pending: {
          badge: 'Telegram login',
          title: 'Подтверждаем вход',
          message: 'Проверяем твою сессию и готовим вход.',
          primary: 'Войти через Telegram',
          primaryHint: 'Проверяем доступ и готовим вход.',
          status: 'Проверяем вход...',
          note: 'Немного подожди, это займёт секунду.',
          bannerTitle: 'Подтверждаем вход',
          bannerText: 'Секунду, ищем сохранённую сессию и готовим форму входа.',
          bannerIcon: '…',
          showBanner: true,
          showWidget: false,
          showRetry: false,
          primaryBusy: true
        },
        error: {
          badge: 'Telegram login',
          title: 'Не удалось выполнить вход',
          message: 'Попробуй ещё раз или открой приложение через Telegram.',
          primary: 'Повторить',
          primaryHint: 'Попробуй снова или открой приложение через Telegram.',
          status: '',
          note: 'Нажми "Повторить" или открой приложение через Telegram.',
          bannerTitle: 'Не удалось выполнить вход',
          bannerText: 'Попробуй ещё раз или открой приложение через Telegram.',
          bannerIcon: '!',
          showBanner: true,
          showWidget: true,
          showRetry: false,
          primaryBusy: false
        },
        authenticated: {
          showBanner: false,
          showWidget: false,
          showRetry: false,
          primaryBusy: false
        }
      }
    };

    function getStoredSessionToken() {
      try {
        return localStorage.getItem(SESSION_STORAGE_KEY) || '';
      } catch(e) {
        return '';
      }
    }

    function setStoredSessionToken(token) {
      try {
        if (token) localStorage.setItem(SESSION_STORAGE_KEY, token);
        else localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch(e) {}
    }

    var CACHED_USER_STORAGE_KEY = 'shift_tracker_cached_user_v1';
    var CURRENT_SESSION_TOKEN = getStoredSessionToken();
    var STARTED_FROM_CACHED_STATE = false;

    function getStoredCachedUser() {
      try {
        var raw = localStorage.getItem(CACHED_USER_STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch(e) {
        return null;
      }
    }

    function setStoredCachedUser(user) {
      try {
        if (user && typeof user === 'object') {
          localStorage.setItem(CACHED_USER_STORAGE_KEY, JSON.stringify({
            id: user.id,
            display_name: user.display_name || '',
            username: user.username || ''
          }));
        } else {
          localStorage.removeItem(CACHED_USER_STORAGE_KEY);
        }
      } catch(e) {}
    }

    function findStoredJsonByPrefix(prefix) {
      try {
        var matches = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (!key || key.indexOf(prefix) !== 0) continue;
          var value = readStoredJson(key, null);
          if (value) matches.push({ key: key, value: value });
        }
        return matches;
      } catch(e) {
        return [];
      }
    }

    function readAnyShiftsCache() {
      var matches = findStoredJsonByPrefix(SHIFTS_CACHE_STORAGE_KEY + '_');
      if (!matches.length) return null;
      matches.sort(function(a, b) {
        var aTime = a.value && a.value.updatedAt ? Date.parse(a.value.updatedAt) : 0;
        var bTime = b.value && b.value.updatedAt ? Date.parse(b.value.updatedAt) : 0;
        return bTime - aTime;
      });
      return matches[0] ? matches[0].value : null;
    }

    function readAnyOfflineMeta() {
      var matches = findStoredJsonByPrefix(SHIFTS_META_STORAGE_KEY + '_');
      if (!matches.length) return null;
      matches.sort(function(a, b) {
        var aTime = a.value && a.value.lastSyncAt ? Date.parse(a.value.lastSyncAt) : 0;
        var bTime = b.value && b.value.lastSyncAt ? Date.parse(b.value.lastSyncAt) : 0;
        return bTime - aTime;
      });
      return matches[0] ? matches[0].value : null;
    }

    function getAppUrl() {
      return window.location.origin + window.location.pathname;
    }

    function isLocalAuthEnvironment() {
      var hostname = String(window.location.hostname || '').toLowerCase();
      return window.location.protocol === 'file:' ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1';
    }

    function getTelegramBotUrl() {
      return 'https://t.me/' + TELEGRAM_BOT_USERNAME;
    }

    function getAuthView(envState, authState) {
      var envKey = envState === 'dev' ? 'dev' : 'prod';
      var authKey = AUTH_VIEWS[envKey] && AUTH_VIEWS[envKey][authState] ? authState : 'guest';
      return {
        env: envKey,
        state: authKey,
        copy: AUTH_VIEWS[envKey][authKey] || AUTH_VIEWS.prod.guest
      };
    }

    function applyAuthView(view) {
      var copy = view.copy || AUTH_VIEWS.prod.guest;

      if (AUTH_CARD) AUTH_CARD.setAttribute('data-auth-mode', view.env === 'dev' ? 'local' : 'prod');
      if (AUTH_MODE_CHIP) AUTH_MODE_CHIP.textContent = copy.badge || 'Telegram login';
      if (AUTH_TITLE) AUTH_TITLE.textContent = copy.title || '';
      if (AUTH_MESSAGE) AUTH_MESSAGE.textContent = copy.message || '';
      if (AUTH_STATUS) AUTH_STATUS.textContent = copy.status || '';
      if (AUTH_BANNER) {
        AUTH_BANNER.classList.toggle('hidden', !copy.showBanner);
        AUTH_BANNER.classList.toggle('is-local', view.env === 'dev');
        AUTH_BANNER.classList.toggle('is-error', view.state === 'error');
      }
      if (AUTH_BANNER_ICON) AUTH_BANNER_ICON.textContent = copy.bannerIcon || '';
      if (AUTH_BANNER_TITLE) AUTH_BANNER_TITLE.textContent = copy.bannerTitle || '';
      if (AUTH_BANNER_TEXT) AUTH_BANNER_TEXT.textContent = copy.bannerText || '';
      if (AUTH_PRIMARY_ACTION) {
        AUTH_PRIMARY_ACTION.textContent = copy.primary || 'Войти через Telegram';
        AUTH_PRIMARY_ACTION.disabled = !!copy.primaryBusy;
        AUTH_PRIMARY_ACTION.setAttribute('aria-busy', copy.primaryBusy ? 'true' : 'false');
        AUTH_PRIMARY_ACTION.classList.toggle('hidden', copy.showPrimary === false);
      }
      if (AUTH_PRIMARY_HINT) AUTH_PRIMARY_HINT.textContent = copy.primaryHint || '';
      if (AUTH_ERROR) AUTH_ERROR.textContent = '';
      if (AUTH_NOTE) AUTH_NOTE.textContent = copy.note || '';
      if (AUTH_WIDGET_SHELL) AUTH_WIDGET_SHELL.classList.toggle('hidden', !copy.showWidget);
      if (document.getElementById('btnAuthRetry')) {
        document.getElementById('btnAuthRetry').classList.toggle('visible', !!copy.showRetry);
        document.getElementById('btnAuthRetry').textContent = 'Повторить';
      }
      AUTH_ENV_STATE = view.env;
      AUTH_STATE = view.state;
    }

    function showAuthGate(envState, authState) {
      if (AUTH_GATE) AUTH_GATE.classList.remove('hidden');
      if (APP_SHELL) APP_SHELL.classList.add('hidden');
      var view = getAuthView(envState, authState);
      if (AUTH_GATE) {
        AUTH_GATE.setAttribute('data-auth-env', view.env);
        AUTH_GATE.setAttribute('data-auth-state', view.state);
      }
      applyAuthView(view);
    }

    function handleAuthUnauthorized() {
      var hasSession = !!CURRENT_USER || !!CURRENT_SESSION_TOKEN || !!getStoredSessionToken();
      var nextState = AUTH_ENV_STATE === 'dev' ? 'guest' : (hasSession ? 'error' : 'guest');
      showAuthGate(AUTH_ENV_STATE, nextState);
      if (nextState !== 'error') {
        renderTelegramLoginWidget();
      }
      return nextState;
    }

    function restartAuthFlow() {
      authBootstrapPromise = null;
      AUTH_WIDGET_READY = false;
      if (AUTH_WIDGET) AUTH_WIDGET.innerHTML = '';
      if (AUTH_ENV_STATE === 'dev') {
        showAuthGate('dev', 'guest');
        return;
      }

      showAuthGate('prod', 'pending');
      renderTelegramLoginWidget();
      ensureAuthenticated().then(function(user) {
        if (user) {
          loadShifts(function() {
            render();
          });
        }
      });
    }

    function showAppShell() {
      AUTH_STATE = 'authenticated';
      if (AUTH_GATE) AUTH_GATE.classList.add('hidden');
      if (APP_SHELL) APP_SHELL.classList.remove('hidden');
      settleSafeAreaInsets();
      repairUiText();
      updateSettingsControls();
      updateOfflineUiState();
      setActiveTab(activeTab || 'home');
      scheduleBottomNavHeightSync();
      updateFooter();
    }

    function setActiveTab(tab) {
      closeShiftActionsMenu(true);
      closeLocoSeriesMenu();
      activeTab = tab || 'home';

      var panels = document.querySelectorAll('.tab-panel');
      for (var i = 0; i < panels.length; i++) {
        var panel = panels[i];
        panel.classList.toggle('active', panel.getAttribute('data-tab') === activeTab);
      }

      var navButtons = document.querySelectorAll('.tab-btn[data-tab]');
      for (var j = 0; j < navButtons.length; j++) {
        var btn = navButtons[j];
        btn.classList.toggle('active', btn.getAttribute('data-tab') === activeTab);
      }

      scheduleBottomNavHeightSync();
      updateFooter();
    }

    function openAddTabAndFocusForm() {
      if (editingShiftId) {
        exitEditMode('add');
      } else {
        setFormMode('add');
      }
      setActiveTab('add');
      setTimeout(function() {
        var section = document.getElementById('shiftFormSection');
        if (section && section.scrollIntoView) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var startDate = document.getElementById('inputStartDate');
        if (startDate && startDate.focus) {
          startDate.focus();
        }
      }, 40);
    }

    var SHORT_MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    var QUARTER_LABELS = ['I квартал', 'II квартал', 'III квартал', 'IV квартал'];

    function getQuarterIndex(month0) {
      return Math.floor(month0 / 3);
    }

    function getQuarterLabel(month0) {
      return QUARTER_LABELS[getQuarterIndex(month0)] || '';
    }

    function getQuarterMonths(month0) {
      var q = getQuarterIndex(month0);
      var start = q * 3;
      return [start, start + 1, start + 2];
    }

    function renderQuarterMonthTabs(containerId, year, month0, onSelect) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var months = getQuarterMonths(month0);
      var html = '';
      for (var i = 0; i < months.length; i++) {
        var m = months[i];
        var active = m === month0 ? ' active' : '';
        html += '<button type="button" class="month-tab' + active + '" data-month="' + m + '">' + SHORT_MONTH_NAMES[m] + '</button>';
      }
      container.innerHTML = html;

      var buttons = container.querySelectorAll('.month-tab');
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].addEventListener('click', function(e) {
          var targetMonth = parseInt(e.currentTarget.getAttribute('data-month'), 10);
          if (typeof onSelect === 'function') onSelect(targetMonth);
        });
      }
    }

    function renderMonthHeader(titleId, quarterId, tabsId, year, month0, onSelect) {
      var monthTitle = document.getElementById(titleId);
      var monthQuarter = document.getElementById(quarterId);
      if (monthTitle) monthTitle.textContent = MONTH_NAMES[month0] + ' ' + year;
      if (monthQuarter) monthQuarter.textContent = getQuarterLabel(month0);
      renderQuarterMonthTabs(tabsId, year, month0, onSelect);
    }

    function repairUiText() {
      document.title = 'Учёт смен';

      var monthPrev = document.getElementById('btnPrevMonth');
      if (monthPrev) {
        monthPrev.textContent = '‹';
        monthPrev.setAttribute('aria-label', 'Предыдущий месяц');
      }
      var monthNext = document.getElementById('btnNextMonth');
      if (monthNext) {
        monthNext.textContent = '›';
        monthNext.setAttribute('aria-label', 'Следующий месяц');
      }

      var topLabels = document.querySelectorAll('.stats-grid .stat-card .stat-label');
      var topLabelText = ['Праздничные', 'Ночные', 'Отработано', 'Смен', 'Норма', 'Осталось'];
      for (var i = 0; i < topLabels.length && i < topLabelText.length; i++) {
        topLabels[i].textContent = topLabelText[i];
      }

      var quickLabels = document.querySelectorAll('.quick-stats-grid .quick-stat .stat-label');
      var quickLabelText = ['Ночные', 'Праздничные', 'Смены'];
      for (var q = 0; q < quickLabels.length && q < quickLabelText.length; q++) {
        quickLabels[q].textContent = quickLabelText[q];
      }

      var btnGoToShifts = document.getElementById('btnGoToShifts');
      if (btnGoToShifts) btnGoToShifts.textContent = 'Все';

      var shiftsHeader = document.getElementById('shiftsHeader');
      if (shiftsHeader) shiftsHeader.textContent = 'Смены';

      var settingsPageTitle = document.querySelector('.settings-page-title');
      if (settingsPageTitle) settingsPageTitle.textContent = 'Настройки';
      var appVersionValue = document.getElementById('appVersionValue');
      if (appVersionValue) appVersionValue.textContent = APP_VERSION;

      var addScreenBtn = document.getElementById('btnAddToScreen');
      if (addScreenBtn) addScreenBtn.textContent = '📲 Добавить на экран';

      var overlays = document.querySelectorAll('.overlay');
      for (var oi = 0; oi < overlays.length; oi++) {
        var title = overlays[oi].querySelector('.sheet-title');
        if (!title) continue;
        if (overlays[oi].id === 'overlayAddScreen') title.textContent = 'Добавить на экран';
        if (overlays[oi].id === 'overlayConfirm') title.textContent = 'Удалить смену?';
      }
    }

    function getLoginReturnUrl() {
      return window.location.pathname + window.location.search + window.location.hash;
    }

    function renderTelegramLoginWidget() {
      if (!AUTH_WIDGET || AUTH_WIDGET_READY || AUTH_ENV_STATE === 'dev') return;
      AUTH_WIDGET_READY = true;
      AUTH_WIDGET.innerHTML = '';

      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-auth-url', window.location.origin + '/api/auth?mode=telegram-login&return=' + encodeURIComponent(getLoginReturnUrl()));
      script.onerror = function() {
        AUTH_WIDGET_READY = false;
        showAuthGate('prod', 'error');
      };
      AUTH_WIDGET.appendChild(script);
    }

    function fetchJson(url, options, timeoutMs) {
      var reqOptions = options || {};
      reqOptions.credentials = 'include';
      reqOptions.headers = reqOptions.headers || {};
      if (CURRENT_SESSION_TOKEN) {
        reqOptions.headers['Authorization'] = 'Bearer ' + CURRENT_SESSION_TOKEN;
      }
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) reqOptions.signal = controller.signal;
      var timeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 8000;
      var timeoutId = controller ? setTimeout(function() { controller.abort(); }, timeout) : null;
      return fetch(url, reqOptions).then(function(res) {
        if (timeoutId) clearTimeout(timeoutId);
        return res.json().catch(function() { return {}; }).then(function(body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      }).catch(function(err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
      });
    }

    function authenticateWithTelegramWebApp(timeoutMs) {
      if (!(window.Telegram && Telegram.WebApp && Telegram.WebApp.initData)) {
        return Promise.resolve(null);
      }

      showAuthGate(AUTH_ENV_STATE, 'pending');

      return fetchJson(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: Telegram.WebApp.initData })
      }, timeoutMs).then(function(result) {
        if (result.ok && result.body && result.body.user) {
          CURRENT_SESSION_TOKEN = result.body.sessionToken || '';
          setStoredSessionToken(CURRENT_SESSION_TOKEN);
          setStoredCachedUser(result.body.user);
          return result.body.user;
        }
        throw new Error((result.body && result.body.error) || 'Не удалось войти через Telegram');
      });
    }

    function restoreSession(timeoutMs) {
      return fetchJson(AUTH_API_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, timeoutMs).then(function(result) {
        if (result.ok && result.body && result.body.user) {
          CURRENT_SESSION_TOKEN = result.body.sessionToken || CURRENT_SESSION_TOKEN || '';
          setStoredSessionToken(CURRENT_SESSION_TOKEN);
          setStoredCachedUser(result.body.user);
          return result.body.user;
        }
        return null;
      });
    }

    function logout() {
      return fetchJson(AUTH_API_URL, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      }).then(function() {
        CURRENT_USER = null;
        CURRENT_SESSION_TOKEN = '';
        setStoredSessionToken('');
        setStoredCachedUser(null);
        allShifts = [];
        authBootstrapPromise = null;
        AUTH_WIDGET_READY = false;
        if (AUTH_WIDGET) AUTH_WIDGET.innerHTML = '';
        updateFooter();
        showAuthGate(AUTH_ENV_STATE, 'guest');
        renderTelegramLoginWidget();
      });
    }

    function ensureAuthenticated(timeoutMs, options) {
      var silent = !!(options && options.silent);
      if (AUTH_ENV_STATE === 'dev') {
        if (!authBootstrapPromise) {
          authBootstrapPromise = Promise.resolve(null).then(function() {
            CURRENT_USER = null;
            if (!silent) showAuthGate('dev', 'guest');
            return null;
          });
        }
        return authBootstrapPromise;
      }

      if (!authBootstrapPromise) {
        if (!silent) showAuthGate('prod', 'pending');
        authBootstrapPromise = authenticateWithTelegramWebApp(timeoutMs)
          .then(function(user) {
            if (user) return user;
            return restoreSession(timeoutMs);
          })
          .then(function(user) {
            if (user) {
              CURRENT_USER = user;
              showAppShell();
              return user;
            }

            CURRENT_USER = null;
            if (!silent) {
              showAuthGate('prod', 'guest');
              renderTelegramLoginWidget();
            }
            return null;
          })
          .catch(function(err) {
            CURRENT_USER = null;
            if (!silent) {
              showAuthGate('prod', 'error');
              renderTelegramLoginWidget();
            }
            return null;
          });
      }

      return authBootstrapPromise;
    }

    function bootstrapCachedShellFromStorage() {
      var cachedUser = getStoredCachedUser();
      var cachedShifts = readShiftsCache() || readAnyShiftsCache();
      var cachedMeta = readOfflineMeta() || readAnyOfflineMeta();
      if (cachedUser && cachedUser.id !== undefined && cachedUser.id !== null) {
        CURRENT_USER = cachedUser;
      } else if (cachedShifts && cachedShifts.userId !== undefined && cachedShifts.userId !== null) {
        CURRENT_USER = { id: String(cachedShifts.userId) };
      } else if (cachedShifts || readPendingSnapshot() || cachedMeta) {
        CURRENT_USER = { id: 'guest' };
      } else {
        CURRENT_USER = { id: 'guest' };
      }

      STARTED_FROM_CACHED_STATE = true;
      showAppShell();
      if (cachedShifts && Array.isArray(cachedShifts.shifts)) {
        allShifts = normalizeShiftsForDisplay(cachedShifts.shifts);
      }
      updateOfflineUiState({
        isOffline: !navigator.onLine,
        isSyncing: false,
        hasPending: !!readPendingSnapshot(),
        lastSyncStatus: cachedShifts ? 'cached' : 'offline',
        lastError: ''
      });
      render();
      return true;
    }

    function startBackgroundBootstrap() {
      if (!navigator.onLine) return;

      ensureAuthenticated(1200, { silent: true }).then(function(user) {
        if (user) {
          loadShifts(function() {
            render();
          });
          return;
        }

        if (!readShiftsCache() && !readAnyShiftsCache()) {
          showAuthGate(AUTH_ENV_STATE, 'guest');
          renderTelegramLoginWidget();
        }
      });
    }

    // ── Load / Save shifts ──
    function loadShifts(callback) {
      var cached = readShiftsCache();
      var servedFromCache = false;
      if (cached && Array.isArray(cached.shifts)) {
        allShifts = normalizeShiftsForDisplay(cached.shifts);
        updateOfflineUiState({ isOffline: !navigator.onLine, hasPending: !!readPendingSnapshot() });
        servedFromCache = true;
        if (callback) callback();
      }

      if (!navigator.onLine) {
        if (!cached) allShifts = [];
        updateOfflineUiState({ isOffline: true, isSyncing: false, hasPending: !!readPendingSnapshot(), lastSyncStatus: cached ? 'cached' : 'offline', lastError: '' });
        if (!cached && callback) callback();
        return;
      }

      var pending = readPendingSnapshot();
      var startLoad = function() {
        fetchJson(SHIFTS_API_URL, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }).then(function(result) {
          if (result.ok) {
            allShifts = clearPendingFlags(Array.isArray(result.body && result.body.shifts) ? result.body.shifts : []);
            writeShiftsCache(allShifts, {
              isOffline: false,
              isSyncing: false,
              hasPending: !!readPendingSnapshot(),
              lastSyncStatus: 'synced',
              lastError: '',
              lastSyncAt: new Date().toISOString()
            });
            updateOfflineUiState({ isOffline: false, isSyncing: false, hasPending: !!readPendingSnapshot(), lastSyncStatus: 'synced', lastError: '' });
            if (!servedFromCache && callback) callback();
            else render();
            return;
          }

          if (result.status === 401) {
            updateOfflineUiState({
              isOffline: !navigator.onLine,
              isSyncing: false,
              hasPending: !!readPendingSnapshot(),
              lastSyncStatus: servedFromCache || STARTED_FROM_CACHED_STATE ? 'cached' : 'error',
              lastError: 'Unauthorized'
            });
            if (STARTED_FROM_CACHED_STATE || servedFromCache) {
              if (!servedFromCache && callback) callback();
              return;
            }
            handleAuthUnauthorized('load');
            return;
          }

          updateOfflineUiState({ isOffline: true, isSyncing: false, hasPending: !!readPendingSnapshot(), lastSyncStatus: cached ? 'cached' : 'error', lastError: (result.body && result.body.error) || 'API load failed' });
          if (!cached) allShifts = [];
          if (!cached && callback) callback();
        }).catch(function() {
          updateOfflineUiState({ isOffline: true, isSyncing: false, hasPending: !!readPendingSnapshot(), lastSyncStatus: cached ? 'cached' : 'error', lastError: 'Network error' });
          if (!cached) allShifts = [];
          if (!cached && callback) callback();
        });
      };

      if (pending && pending.shifts && pending.shifts.length) {
        flushPendingSnapshot('load', function(err) {
          if (!err) {
            startLoad();
          }
        }, false);
        return;
      }

      startLoad();
    }

      function saveShifts(callback) {
        var snapshot = cloneShiftsForCache(allShifts);
        var pendingSnapshot = applyPendingFlags(snapshot, pendingMutationIds);

        // Always persist locally first — synchronous, instant, never fails
        allShifts = writePendingSnapshot(pendingSnapshot, pendingMutationIds).shifts;
        writeShiftsCache(allShifts, {
          isOffline: !navigator.onLine,
          isSyncing: false,
          hasPending: true,
          lastSyncStatus: 'pending',
          lastError: ''
        });
        updateOfflineUiState({ isOffline: !navigator.onLine, isSyncing: false, hasPending: true, lastSyncStatus: 'pending', lastError: '' });

        // Unblock UI immediately — background sync handles the rest
        if (callback) callback(null);

        if (!navigator.onLine) return;

        // Background sync — does not block the UI
        updateOfflineUiState({ isSyncing: true, lastSyncStatus: 'syncing', lastError: '' });
        fetchJson(SHIFTS_API_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ shifts: cloneShiftsForServer(snapshot) })
        }, 4000).then(function(result) {
          if (result.ok) {
            allShifts = clearPendingFlags(snapshot);
            clearPendingSnapshot();
            writeShiftsCache(allShifts, {
              isOffline: false,
              isSyncing: false,
              hasPending: false,
              lastSyncStatus: 'synced',
              lastError: '',
              lastSyncAt: new Date().toISOString()
            });
            updateOfflineUiState({ isOffline: false, isSyncing: false, hasPending: false, lastSyncStatus: 'synced', lastError: '' });
            render();
            return;
          }
          if (result.status === 401) {
            updateOfflineUiState({ isOffline: !navigator.onLine, isSyncing: false, hasPending: true, lastSyncStatus: 'error', lastError: 'Unauthorized' });
            if (!STARTED_FROM_CACHED_STATE) handleAuthUnauthorized('save');
            return;
          }
          updateOfflineUiState({ isOffline: !navigator.onLine, isSyncing: false, hasPending: true, lastSyncStatus: 'error', lastError: (result.body && result.body.error) || 'API save failed' });
        }).catch(function(err) {
          updateOfflineUiState({ isOffline: true, isSyncing: false, hasPending: true, lastSyncStatus: 'error', lastError: err && err.message ? err.message : 'Network error' });
        });
      }

    // ── Time helpers ──

    // Parse "YYYY-MM-DDTHH:MM" as MSK → returns UTC Date
    function parseMsk(dtStr) {
      var raw = typeof dtStr === 'string' ? dtStr.trim() : '';
      if (!raw) return null;

      var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      if (!match) return null;

      var year = parseInt(match[1], 10);
      var month = parseInt(match[2], 10);
      var day = parseInt(match[3], 10);
      var hour = parseInt(match[4], 10);
      var min = parseInt(match[5], 10);
      if (
        !isFinite(year) ||
        !isFinite(month) ||
        !isFinite(day) ||
        !isFinite(hour) ||
        !isFinite(min) ||
        month < 1 || month > 12 ||
        day < 1 || day > 31 ||
        hour < 0 || hour > 23 ||
        min < 0 || min > 59
      ) {
        return null;
      }

      var utcTs = Date.UTC(year, month - 1, day, hour - MSK_OFFSET, min, 0, 0);
      if (!isFinite(utcTs)) return null;

      // Reject impossible dates like 2026-02-30.
      var check = new Date(utcTs + MSK_OFFSET * 60 * 60 * 1000);
      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() + 1 !== month ||
        check.getUTCDate() !== day ||
        check.getUTCHours() !== hour ||
        check.getUTCMinutes() !== min
      ) {
        return null;
      }

      return new Date(utcTs);
    }

    function getShiftStartTimestamp(shift) {
      var start = parseMsk(shift && shift.start_msk);
      return start ? start.getTime() : NaN;
    }

    function compareShiftsByStartDesc(a, b) {
      var aStartTs = getShiftStartTimestamp(a);
      var bStartTs = getShiftStartTimestamp(b);
      var aValid = isFinite(aStartTs);
      var bValid = isFinite(bStartTs);

      if (aValid && bValid) {
        if (aStartTs > bStartTs) return -1;
        if (aStartTs < bStartTs) return 1;
      } else if (aValid) {
        return -1;
      } else if (bValid) {
        return 1;
      }

      var aRaw = a && a.start_msk ? String(a.start_msk) : '';
      var bRaw = b && b.start_msk ? String(b.start_msk) : '';
      if (aRaw > bRaw) return -1;
      if (aRaw < bRaw) return 1;
      return 0;
    }

    function formatMskDatePart(date) {
      var msk = new Date(date.getTime() + MSK_OFFSET * 60 * 60 * 1000);
      var year = msk.getUTCFullYear();
      var month = String(msk.getUTCMonth() + 1).padStart(2, '0');
      var day = String(msk.getUTCDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }

    function formatMskTimePart(date) {
      var msk = new Date(date.getTime() + MSK_OFFSET * 60 * 60 * 1000);
      var hour = String(msk.getUTCHours()).padStart(2, '0');
      var min = String(msk.getUTCMinutes()).padStart(2, '0');
      return hour + ':' + min;
    }

    function composeMskDateTime(dateValue, timeValue) {
      if (!dateValue || !timeValue) return null;
      return dateValue + 'T' + timeValue;
    }

    function setDefaultShiftTimeInputs() {
      if (editingShiftId) return;

      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');

      if (!startDateEl.value) {
        var now = new Date();
        startDateEl.value = formatMskDatePart(now);
        startDateEl.defaultValue = startDateEl.value;
        startTimeEl.value = formatMskTimePart(now);
        startTimeEl.defaultValue = startTimeEl.value;
      }

      if (!endDateEl.value || !endTimeEl.value) {
        syncEndFromStart();
      }

      renderDraftShiftSummary();
    }

    function syncEndFromStart() {
      if (editingShiftId) return;

      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');
      var startDate = parseMsk(composeMskDateTime(startDateEl.value, startTimeEl.value));
      if (!startDate) return;

      var endDate = new Date(startDate.getTime() + 12 * 60 * 60 * 1000);
      endDateEl.value = formatMskDatePart(endDate);
      endDateEl.defaultValue = endDateEl.value;
      endTimeEl.value = formatMskTimePart(endDate);
      endTimeEl.defaultValue = endTimeEl.value;
    }

    // Get UTC timestamp for start of a day in device timezone
    function getLocalDayStartUTC(year, month0, day) {
      // Create a date string and parse it in device timezone
      var m = String(month0 + 1).padStart(2, '0');
      var dd = String(day).padStart(2, '0');
      var str = year + '-' + m + '-' + dd + 'T00:00:00';

      // Use the device's local timezone to interpret this
      // We need to find what UTC time corresponds to midnight local time
      // Strategy: create Date from components (local timezone)
      var local = new Date(year, month0, day, 0, 0, 0);
      return local.getTime();
    }

    // Get UTC timestamps for start/end of a month in device timezone
    function getMonthBounds(year, month0) {
      var start = getLocalDayStartUTC(year, month0, 1);
      var nextMonth = month0 + 1;
      var nextYear = year;
      if (nextMonth > 11) { nextMonth = 0; nextYear++; }
      var end = getLocalDayStartUTC(nextYear, nextMonth, 1);
      return { start: start, end: end };
    }

    // How many minutes of a shift fall within [boundsStart, boundsEnd)
    function shiftMinutesInRange(shift, boundsStart, boundsEnd) {
      var s = parseMsk(shift.start_msk);
      var e = parseMsk(shift.end_msk);
      if (!s || !e) return 0;
      var st = s.getTime();
      var et = e.getTime();
      var effStart = Math.max(st, boundsStart);
      var effEnd = Math.min(et, boundsEnd);
      if (effEnd <= effStart) return 0;
      return Math.round((effEnd - effStart) / 60000);
    }

    function minutesInOverlap(startTs, endTs, boundsStart, boundsEnd) {
      var effStart = Math.max(startTs, boundsStart);
      var effEnd = Math.min(endTs, boundsEnd);
      if (effEnd <= effStart) return 0;
      return Math.round((effEnd - effStart) / 60000);
    }

    // Night hours are counted in the user's local timezone, 22:00-06:00
    function shiftNightMinutesInRange(shift, boundsStart, boundsEnd) {
      var s = parseMsk(shift.start_msk);
      var e = parseMsk(shift.end_msk);
      if (!s || !e) return 0;

      var st = s.getTime();
      var et = e.getTime();
      if (et <= st) return 0;

      // Start one local day earlier so shifts that begin before 06:00 are counted correctly.
      var cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1, 0, 0, 0);
      var lastDay = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0, 0, 0);
      var total = 0;

      while (cursor.getTime() <= lastDay.getTime()) {
        var nightStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 22, 0, 0).getTime();
        var nightEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 6, 0, 0).getTime();
        total += minutesInOverlap(st, et, Math.max(boundsStart, nightStart), Math.min(boundsEnd, nightEnd));
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0);
      }

      return total;
    }

    function shiftHolidayMinutesInRange(shift, boundsStart, boundsEnd) {
      var s = parseMsk(shift.start_msk);
      var e = parseMsk(shift.end_msk);
      if (!s || !e) return 0;

      var st = s.getTime();
      var et = e.getTime();
      if (et <= st) return 0;

      var cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0);
      var lastDay = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0, 0, 0);
      var total = 0;

      while (cursor.getTime() <= lastDay.getTime()) {
        if (isNonWorkingHolidayLocalDate(cursor)) {
          var dayStart = cursor.getTime();
          var dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0).getTime();
          total += minutesInOverlap(st, et, Math.max(boundsStart, dayStart), Math.min(boundsEnd, dayEnd));
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0);
      }

      return total;
    }

    // Total duration of a shift in minutes
    function shiftTotalMinutes(shift) {
      var s = parseMsk(shift && shift.start_msk);
      var e = parseMsk(shift && shift.end_msk);
      if (!s || !e) return 0;
      var diff = Math.round((e.getTime() - s.getTime()) / 60000);
      return diff > 0 ? diff : 0;
    }

    // Format minutes → "X ч" or "X ч Y м"
    function fmtMin(totalMin) {
      if (totalMin <= 0) return '0ч';
      var h = Math.floor(totalMin / 60);
      var m = totalMin % 60;
      if (h === 0) return m + 'м';
      if (m === 0) return h + 'ч';
      return h + 'ч ' + m + 'м';
    }

    function formatDurationReadable(totalMin) {
      var minutes = Math.max(0, Math.round(totalMin || 0));
      if (minutes === 0) return '0 мин';

      var days = Math.floor(minutes / 1440);
      var dayRemainder = minutes % 1440;
      var hours = Math.floor(dayRemainder / 60);
      var mins = dayRemainder % 60;
      var parts = [];

      if (days > 0) parts.push(days + ' д');
      if (hours > 0) parts.push(hours + ' ч');
      if (mins > 0 && (days === 0 || parts.length < 2)) parts.push(mins + ' мин');
      return parts.join(' ');
    }

    function formatHoursAndMinutes(totalMin) {
      var minutes = Math.max(0, Math.round(totalMin || 0));
      if (minutes === 0) return '0 мин';

      var hours = Math.floor(minutes / 60);
      var mins = minutes % 60;
      if (hours === 0) return mins + ' мин';
      if (mins === 0) return hours + ' ч';
      return hours + ' ч ' + mins + ' мин';
    }

    function getShiftRangeState(shift) {
      var rawStart = shift && shift.start_msk ? String(shift.start_msk) : '';
      var rawEnd = shift && shift.end_msk ? String(shift.end_msk) : '';
      var start = parseMsk(rawStart);
      var end = parseMsk(rawEnd);
      var startMs = start ? start.getTime() : NaN;
      var endMs = end ? end.getTime() : NaN;
      var hasStart = isFinite(startMs);
      var hasEnd = isFinite(endMs);

      return {
        hasStartValue: !!rawStart,
        hasEndValue: !!rawEnd,
        hasStart: hasStart,
        hasEnd: hasEnd,
        startMs: hasStart ? startMs : 0,
        endMs: hasEnd ? endMs : 0,
        hasValidInterval: hasStart && hasEnd && endMs > startMs
      };
    }

    function getRestGapInfo(newerShift, olderShift) {
      if (!newerShift || !olderShift) return null;

      var newer = getShiftRangeState(newerShift);
      var older = getShiftRangeState(olderShift);

      if (
        (newer.hasStartValue && !newer.hasStart) ||
        (newer.hasEndValue && !newer.hasEnd) ||
        (older.hasStartValue && !older.hasStart) ||
        (older.hasEndValue && !older.hasEnd)
      ) {
        return {
          kind: 'invalid',
          label: 'Отдых: ошибка времени'
        };
      }

      if ((newer.hasStart && newer.hasEnd && !newer.hasValidInterval) || (older.hasStart && older.hasEnd && !older.hasValidInterval)) {
        return {
          kind: 'invalid',
          label: 'Отдых: ошибка времени'
        };
      }

      if (!older.hasEndValue) {
        return {
          kind: 'unavailable',
          label: 'Отдых: нет конца смены'
        };
      }

      if (!newer.hasStartValue) {
        return {
          kind: 'unavailable',
          label: 'Отдых: нет начала смены'
        };
      }

      var restMin = Math.round((newer.startMs - older.endMs) / 60000);
      if (!isFinite(restMin)) {
        return {
          kind: 'unavailable',
          label: 'Отдых: нет данных'
        };
      }

      if (restMin < 0) {
        return {
          kind: 'overlap',
          label: 'Пересечение ' + formatDurationReadable(Math.abs(restMin))
        };
      }

      return {
        kind: 'ok',
        isShort: restMin < SHORT_REST_THRESHOLD_MIN,
        label: 'Отдых ' + formatDurationReadable(restMin)
      };
    }

    // Format shift for display
    function fmtShift(shift) {
      var s = shift && shift.start_msk ? String(shift.start_msk) : '';
      var e = shift && shift.end_msk ? String(shift.end_msk) : '';
      var sd = s.length >= 10 ? s.substring(0, 10) : '';
      var st = s.length >= 16 ? s.substring(11, 16) : '--:--';
      var ed = e.length >= 10 ? e.substring(0, 10) : '';
      var et = e.length >= 16 ? e.substring(11, 16) : '--:--';

      // Format dates as DD.MM.YYYY
      var startDate = sd ? (sd.substring(8,10) + '.' + sd.substring(5,7) + '.' + sd.substring(0,4)) : '—';
      var endDate = ed ? (ed.substring(8,10) + '.' + ed.substring(5,7) + '.' + ed.substring(0,4)) : '—';

      var range = getShiftRangeState(shift);
      var dur = range.hasValidInterval ? fmtMin(shiftTotalMinutes(shift)) : '—';

      if (sd && ed && sd === ed) {
        return { text: startDate + ', ' + st + ' → ' + et, dur: dur };
      } else if (sd && ed) {
        return { text: startDate + ', ' + st + ' → ' + endDate + ', ' + et, dur: dur };
      }
      return { text: startDate + ', ' + st + ' → ' + et, dur: dur };
    }

    function formatMskShortDate(dateStr) {
      if (!dateStr || dateStr.length < 10) return '';
      var monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      var day = dateStr.substring(8, 10);
      var monthIndex = parseInt(dateStr.substring(5, 7), 10) - 1;
      var month = monthNames[monthIndex] || '';
      return day + ' ' + month;
    }

    function getShiftDisplayParts(shift) {
      var s = shift && shift.start_msk ? shift.start_msk : '';
      var e = shift && shift.end_msk ? shift.end_msk : '';
      var startTime = s.length >= 16 ? s.substring(11, 16) : '--:--';
      var endTime = e.length >= 16 ? e.substring(11, 16) : '--:--';
      var startDate = formatMskShortDate(s.substring(0, 10)) || '—';
      var endDate = formatMskShortDate(e.substring(0, 10)) || '—';
      return {
        startTime: startTime,
        endTime: endTime,
        startDate: startDate,
        endDate: endDate
      };
    }

    function buildRestGapHtml(restInfo, compact) {
      if (!restInfo) return '';
      var classes = 'shift-rest-gap' + (compact ? ' is-compact' : '');
      if (restInfo.kind === 'ok' && restInfo.isShort) classes += ' is-short';
      if (restInfo.kind === 'overlap' || restInfo.kind === 'invalid') classes += ' is-problem';
      if (restInfo.kind === 'unavailable') classes += ' is-muted';

      return '' +
        '<div class="' + classes + '" aria-label="' + escapeHtml(restInfo.label) + '">' +
          '<span class="shift-rest-gap-line" aria-hidden="true"></span>' +
          '<span class="shift-rest-gap-label">' + escapeHtml(restInfo.label) + '</span>' +
          '<span class="shift-rest-gap-line" aria-hidden="true"></span>' +
        '</div>';
    }

    // ── Render ──
      function buildShiftItemHtml(sh, compact, pendingMap, shiftIncomeMap) {
        var f = fmtShift(sh);
        var p = getShiftDisplayParts(sh);
        var itemClass = 'shift-item' + (compact ? ' compact-shift' : '');
        var title = getShiftTitle(sh);
      var kindLabel = getShiftKindLabel(sh);
      var details = getShiftDetailLines(sh);
      if (details.length) itemClass += ' has-details';
      if (sh.route_kind === 'trip') itemClass += ' has-trip';
      if (sh.id === editingShiftId) itemClass += ' is-edit-target';
        if (sh.id === pendingDeleteId) itemClass += ' is-delete-target';
        if (sh.id === recentAddedShiftId) itemClass += ' is-adding-target';
        var shiftIsPending = pendingMap ? !!pendingMap[String(sh.id)] : isShiftPending(sh);
        if (shiftIsPending) itemClass += ' is-pending';
      var incomeData = shiftIncomeMap ? shiftIncomeMap[String(sh.id)] : null;
      var incomeLevel = incomeData && (incomeData.level === 'low' || incomeData.level === 'high') ? incomeData.level : 'medium';
      var incomeHtml = incomeData ? '<div class="shift-income-chip shift-income-chip--' + incomeLevel + '">' + escapeHtml(formatRub(incomeData.amount)) + '</div>' : '';

      var metaHtml = '';
      if (details.length) {
        metaHtml = '<div class="shift-meta">';
        for (var d = 0; d < details.length; d++) {
          metaHtml += '<div class="shift-pill">' + escapeHtml(details[d]) + '</div>';
        }
        metaHtml += '</div>';
      }

      var html = '<div class="' + itemClass + '" data-shift-id="' + sh.id + '" data-pending="' + (shiftIsPending ? '1' : '0') + '">' +
        '<div class="shift-card-top">' +
          '<div class="shift-title-col">' +
            '<div class="shift-title-row">' +
                '<div class="shift-title"><span class="shift-title-icon">' + (sh.route_kind === 'trip' ? '↔' : '→') + '</span><span class="shift-title-text">' + escapeHtml(title) + '</span></div>' +
              '</div>' +
              (kindLabel ? '<div class="shift-kind-line"><span class="shift-kind-badge">' + escapeHtml(kindLabel) + '</span></div>' : '') +
              (shiftIsPending ? '<div class="shift-kind-line"><span class="shift-pending-badge">&#8987; Не синхронизировано</span></div>' : '') +
            '</div>' +
          '<div class="shift-status-stack">' +
            '<div class="shift-duration-wrap"><div class="shift-duration">' + escapeHtml(f.dur) + '</div></div>' +
            (incomeHtml ? '<div class="shift-income-wrap">' + incomeHtml + '</div>' : '') +
            '<div class="shift-actions-wrap">' +
              '<button class="shift-actions-trigger" type="button" data-id="' + sh.id + '" aria-label="Действия" aria-haspopup="menu" aria-expanded="' + (activeShiftMenuId === sh.id ? 'true' : 'false') + '">⋯</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="shift-card-body">' +
          '<div class="shift-schedule">' +
            '<div class="shift-schedule-row">' +
              '<span class="shift-schedule-time">' + escapeHtml(p.startTime) + '</span>' +
              '<span class="shift-schedule-arrow">→</span>' +
              '<span class="shift-schedule-time">' + escapeHtml(p.endTime) + '</span>' +
            '</div>' +
            '<div class="shift-schedule-row shift-schedule-date">' +
              '<span class="shift-schedule-date-value">' + escapeHtml(p.startDate) + '</span>' +
              '<span class="shift-schedule-arrow">→</span>' +
              '<span class="shift-schedule-date-value">' + escapeHtml(p.endDate) + '</span>' +
            '</div>' +
          '</div>' +
          metaHtml +
        '</div>';

      html += '</div>';
      return html;
    }

    function renderShiftList(listEl, headerEl, shifts, compact, emptyText, headerBase, pendingMap, shiftIncomeMap) {
      if (headerEl) headerEl.textContent = headerBase || 'Смены';

      if (!compact) {
        var overviewCountEl = document.getElementById('shiftsOverviewCount');
        var overviewTotalEl = document.getElementById('shiftsOverviewTotal');
        if (overviewCountEl) overviewCountEl.textContent = String(shifts.length);
        if (overviewTotalEl) {
          var overviewMinutes = 0;
          for (var om = 0; om < shifts.length; om++) overviewMinutes += shiftTotalMinutes(shifts[om]);
          overviewTotalEl.textContent = fmtMin(overviewMinutes);
        }
      }

      if (!shifts.length) {
        listEl.innerHTML = '<div class="shifts-empty">' + emptyText + '</div>';
        return;
      }

      if (headerEl && headerBase !== false) {
        headerEl.textContent = (headerBase || 'Смены') + (compact ? '' : ' · ' + shifts.length);
      }

      var html = '';
      for (var i = 0; i < shifts.length; i++) {
        html += buildShiftItemHtml(shifts[i], compact, pendingMap, shiftIncomeMap);
        if (i < shifts.length - 1) {
          html += buildRestGapHtml(getRestGapInfo(shifts[i], shifts[i + 1]), compact);
        }
      }
      listEl.innerHTML = html;

      var actionTriggers = listEl.querySelectorAll('.shift-actions-trigger');
      for (var a = 0; a < actionTriggers.length; a++) {
        actionTriggers[a].addEventListener('pointerdown', handleShiftActionsTriggerPointerDown);
        actionTriggers[a].addEventListener('click', handleShiftActionsTriggerClick);
      }
    }

    function render() {
      syncShiftActionsMenuLifecycle();
      updateOfflineUiState();
      var _renderPendingMap = getPendingShiftIdMap();

      // Month title
      renderMonthHeader('monthTitle', 'monthQuarter', 'homeMonthTabs', currentYear, currentMonth, function(targetMonth) {
        currentMonth = targetMonth;
        render();
      });

      var bounds = getMonthBounds(currentYear, currentMonth);

      // Filter shifts that have at least 1 minute in this month
      var monthShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (shiftMinutesInRange(allShifts[i], bounds.start, bounds.end) > 0) {
          monthShifts.push(allShifts[i]);
        }
      }

      // Sort newest first
      monthShifts.sort(compareShiftsByStartDesc);

      // Calculate total worked minutes in this month
      var totalMin = 0;
      var nightMin = 0;
      var holidayMin = 0;
      var shiftIncomeMap = buildMonthShiftIncomeMap(monthShifts, bounds);
      for (var j = 0; j < monthShifts.length; j++) {
        totalMin += shiftMinutesInRange(monthShifts[j], bounds.start, bounds.end);
        nightMin += shiftNightMinutesInRange(monthShifts[j], bounds.start, bounds.end);
        holidayMin += shiftHolidayMinutesInRange(monthShifts[j], bounds.start, bounds.end);
      }

      // Norm
      var monthKey = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
      var norm = WORK_NORMS[monthKey];

      // Update stats
      var statWorkedEl = document.getElementById('statWorked');
      if (statWorkedEl) statWorkedEl.textContent = fmtMin(totalMin);
      setQuickMetricText('statNight', fmtMin(nightMin));
      setQuickMetricText('statHoliday', fmtMin(holidayMin));
      setQuickMetricText('statShifts', String(monthShifts.length));
      renderAverageShiftSummary(buildAverageShiftSummary(monthShifts, bounds, shiftIncomeMap));

      var normEl = document.getElementById('statNorm');
      var diffEl = document.getElementById('statDiff');
      var progressBadgeEl = document.getElementById('progressBadge');
      var progressFillEl = document.getElementById('dashboardProgressFill');

      if (norm !== undefined) {
        normEl.textContent = norm + ' ч';
        var normMin = norm  * 60;
        var diffMin = totalMin - normMin;
        var diffAbs = Math.abs(diffMin);
        var progressPct = normMin > 0 ? Math.max(0, Math.min(100, Math.round((totalMin / normMin) * 100))) : 0;

        diffEl.className = 'dashboard-sub';
        if (progressBadgeEl) progressBadgeEl.textContent = progressPct + '%';
        if (progressFillEl) progressFillEl.style.width = progressPct + '%';

        if (diffMin === 0 && totalMin > 0) {
          diffEl.textContent = 'В норме';
          diffEl.classList.add('ok');
        } else if (diffMin > 0) {
          diffEl.textContent = 'Переработка +' + fmtMin(diffAbs);
          diffEl.classList.add('overtime');
        } else {
          diffEl.textContent = 'Осталось ' + fmtMin(diffAbs) + ' до нормы';
          diffEl.classList.add('remaining');
        }
      } else {
        normEl.textContent = '—';
        if (progressBadgeEl) progressBadgeEl.textContent = '—';
        if (progressFillEl) progressFillEl.style.width = '0%';
        diffEl.className = 'dashboard-sub';
        diffEl.textContent = 'Норма не задана';
      }

      renderShiftList(
        document.getElementById('homeShiftsList'),
        null,
        monthShifts.slice(0, 3),
        true,
        'Нет смен за этот месяц',
        false,
        _renderPendingMap,
        shiftIncomeMap
      );

      renderShiftList(
        document.getElementById('shiftsList'),
        document.getElementById('shiftsHeader'),
        monthShifts,
        false,
        'Нет смен за этот месяц',
        'Смены',
        _renderPendingMap,
        shiftIncomeMap
      );

      renderSalaryPanel();

      if (activeShiftMenuId !== null && SHIFT_ACTIONS_MENU) {
        renderShiftActionsMenu(activeShiftMenuId);
      } else if (SHIFT_ACTIONS_MENU) {
        hideShiftActionsMenuOnly();
      }
    }
    function clearRecentAddHighlight() {
      recentAddedShiftId = null;
      if (recentAddTimer) {
        clearTimeout(recentAddTimer);
        recentAddTimer = null;
      }
    }

    function setFormMode(mode) {
      var section = document.getElementById('shiftFormSection');
      if (!section) return;
      section.classList.remove('is-adding', 'is-editing', 'add-pulse');
      if (mode === 'edit') {
        section.classList.add('is-editing');
      } else {
        section.classList.add('is-adding');
      }
    }

    function escapeHtml(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function cleanDigits(value, maxLen) {
      return String(value || '').replace(/\D+/g, '').slice(0, maxLen);
    }

    function getRouteType() {
      var active = document.querySelector('#routeTypeSegmented .segmented-btn.active');
      return active ? active.getAttribute('data-value') : 'depot';
    }

    function setRouteType(routeType) {
      var buttons = document.querySelectorAll('#routeTypeSegmented .segmented-btn');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('active', buttons[i].getAttribute('data-value') === routeType);
      }
      updateRouteFieldsVisibility();
    }

    function updateRouteFieldsVisibility() {
      var routeFields = document.getElementById('routeFields');
      if (!routeFields) return;
      routeFields.classList.toggle('hidden', getRouteType() !== 'trip');
    }

    function setOptionalCardOpen(cardId, open) {
      var card = document.getElementById(cardId);
      if (card) card.open = !!open;
    }

    function getFieldValue(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }

    function setFieldValue(id, value) {
      var el = document.getElementById(id);
      if (el && el.value !== String(value || '')) {
        el.value = String(value || '');
      }
      updateSelectPlaceholderState(el);
      if (id === 'inputLocoSeries') syncLocoSeriesTrigger();
    }

    function updateSelectPlaceholderState(elOrId) {
      var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
      if (!el || el.tagName !== 'SELECT') return;
      el.classList.toggle('is-placeholder', !el.value);
      if (el.id === 'inputLocoSeries') syncLocoSeriesTrigger();
    }

    var LOCO_SERIES_MENU_OPEN = false;

    function getLocoSeriesMenuEls() {
      return {
        selectEl: document.getElementById('inputLocoSeries'),
        valueEl: document.getElementById('locoSeriesValue'),
        triggerEl: document.getElementById('locoSeriesTrigger'),
        menuEl: document.getElementById('locoSeriesMenu')
      };
    }

    function portalLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      if (!els.menuEl || !UI_OVERLAY_ROOT) return;
      if (els.menuEl.parentNode !== UI_OVERLAY_ROOT) {
        UI_OVERLAY_ROOT.appendChild(els.menuEl);
      }
    }

    function updateLocoSeriesMenuPosition() {
      if (!LOCO_SERIES_MENU_OPEN) return;
      var els = getLocoSeriesMenuEls();
      if (!els.triggerEl || !els.menuEl) return;

      var rect = els.triggerEl.getBoundingClientRect();
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var gap = 10;
      var horizontalPadding = 12;
      var verticalPadding = 12;
      var availableWidth = Math.max(0, viewportWidth - horizontalPadding * 2);
      var menuWidth = Math.max(rect.width, 180);
      if (menuWidth > availableWidth) menuWidth = availableWidth;
      var left = Math.min(Math.max(rect.left, horizontalPadding), Math.max(horizontalPadding, viewportWidth - menuWidth - horizontalPadding));

      var spaceBelow = viewportHeight - rect.bottom - gap - verticalPadding;
      var spaceAbove = rect.top - gap - verticalPadding;
      var openDown = spaceBelow >= 160 || spaceBelow >= spaceAbove;
      var maxHeight = Math.max(140, Math.min(256, openDown ? spaceBelow : spaceAbove));
      var top = openDown ? rect.bottom + gap : Math.max(verticalPadding, rect.top - gap - maxHeight);

      els.menuEl.style.setProperty('--select-left', left + 'px');
      els.menuEl.style.setProperty('--select-top', top + 'px');
      els.menuEl.style.setProperty('--select-width', menuWidth + 'px');
      els.menuEl.style.setProperty('--select-max-height', maxHeight + 'px');
      els.menuEl.dataset.placement = openDown ? 'bottom' : 'top';
    }

    function syncLocoSeriesTrigger() {
      var els = getLocoSeriesMenuEls();
      var selectEl = els.selectEl;
      var valueEl = els.valueEl;
      var triggerEl = els.triggerEl;
      var menuEl = els.menuEl;
      if (!selectEl || !valueEl) return;
      var selected = selectEl.options[selectEl.selectedIndex];
      var hasValue = !!selectEl.value;
      valueEl.textContent = hasValue && selected ? selected.textContent : 'Выберите серию';
      valueEl.classList.toggle('is-placeholder', !hasValue);
      if (triggerEl) triggerEl.classList.toggle('is-placeholder', !hasValue);
      if (menuEl) {
        var buttons = menuEl.querySelectorAll('.glass-select-option');
        for (var i = 0; i < buttons.length; i++) {
          var active = buttons[i].getAttribute('data-value') === selectEl.value;
          buttons[i].classList.toggle('is-active', active);
          buttons[i].setAttribute('aria-selected', active ? 'true' : 'false');
        }
      }
    }

    function buildLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      var selectEl = els.selectEl;
      var menuEl = els.menuEl;
      if (!selectEl || !menuEl) return;
      var html = '';
      for (var i = 0; i < selectEl.options.length; i++) {
        var opt = selectEl.options[i];
        if (!opt.value) continue;
        html += '<button type="button" class="glass-select-option" role="option" aria-selected="false" data-value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.textContent) + '</button>';
      }
      menuEl.innerHTML = html;
      portalLocoSeriesMenu();
      syncLocoSeriesTrigger();
    }

    function closeLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      LOCO_SERIES_MENU_OPEN = false;
      if (els.menuEl) els.menuEl.classList.add('hidden');
      if (els.triggerEl) {
        els.triggerEl.classList.remove('is-open');
        els.triggerEl.setAttribute('aria-expanded', 'false');
      }
    }

    function openLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      if (!els.menuEl || !els.triggerEl) return;
      portalLocoSeriesMenu();
      LOCO_SERIES_MENU_OPEN = true;
      els.menuEl.classList.remove('hidden');
      els.triggerEl.classList.add('is-open');
      els.triggerEl.setAttribute('aria-expanded', 'true');
      updateLocoSeriesMenuPosition();
    }

    function toggleLocoSeriesMenu() {
      var menuEl = document.getElementById('locoSeriesMenu');
      if (!menuEl) return;
      if (menuEl.classList.contains('hidden')) openLocoSeriesMenu();
      else closeLocoSeriesMenu();
    }

    function setLocoSeriesValue(value) {
      var selectEl = document.getElementById('inputLocoSeries');
      if (!selectEl) return;
      if (selectEl.value === String(value || '')) {
        closeLocoSeriesMenu();
        return;
      }
      selectEl.value = String(value || '');
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      syncLocoSeriesTrigger();
      closeLocoSeriesMenu();
      renderDraftShiftSummary();
    }

    function renderDraftShiftSummary() {
      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');
      var totalEl = document.getElementById('draftTotal');
      var nightEl = document.getElementById('draftNight');
      var holidayEl = document.getElementById('draftHoliday');

      var startVal = composeMskDateTime(startDateEl ? startDateEl.value : '', startTimeEl ? startTimeEl.value : '');
      var endVal = composeMskDateTime(endDateEl ? endDateEl.value : '', endTimeEl ? endTimeEl.value : '');
      if (!startVal || !endVal) {
        if (totalEl) totalEl.textContent = '0 ч';
        if (nightEl) nightEl.textContent = '0 ч';
        if (holidayEl) holidayEl.textContent = '0 ч';
        return;
      }

      var draftShift = { start_msk: startVal, end_msk: endVal };
      var totalMin = shiftTotalMinutes(draftShift);
      var nightMin = shiftNightMinutesInRange(draftShift, -8640000000000000, 8640000000000000);
      var holidayMin = shiftHolidayMinutesInRange(draftShift, -8640000000000000, 8640000000000000);
      if (totalEl) totalEl.textContent = fmtMin(totalMin);
      if (nightEl) nightEl.textContent = fmtMin(nightMin);
      if (holidayEl) holidayEl.textContent = fmtMin(holidayMin);
    }

    function wireNumericInput(id, maxLen) {
      var el = document.getElementById(id);
      if (!el) return;
      var handler = function() {
        var cleaned = cleanDigits(el.value, maxLen);
        if (el.value !== cleaned) el.value = cleaned;
      };
      el.addEventListener('input', handler);
      el.addEventListener('blur', handler);
    }

    function collectOptionalShiftData() {
      var routeKind = getRouteType() === 'trip' ? 'trip' : 'depot';
      return {
        locomotive_series: getFieldValue('inputLocoSeries'),
        locomotive_number: cleanDigits(getFieldValue('inputLocoNumber'), 4),
        train_number: cleanDigits(getFieldValue('inputTrainNumber'), 4),
        train_weight: cleanDigits(getFieldValue('inputTrainWeight'), 4),
        train_axles: cleanDigits(getFieldValue('inputTrainAxles'), 3),
        train_length: cleanDigits(getFieldValue('inputTrainLength'), 3),
        route_kind: routeKind,
        route_from: routeKind === 'trip' ? getFieldValue('inputRouteFrom') : '',
        route_to: routeKind === 'trip' ? getFieldValue('inputRouteTo') : ''
      };
    }

    function applyOptionalShiftData(shift) {
      shift = shift || {};
      setFieldValue('inputLocoSeries', shift.locomotive_series || '');
      setFieldValue('inputLocoNumber', shift.locomotive_number || '');
      setFieldValue('inputTrainNumber', shift.train_number || '');
      setFieldValue('inputTrainWeight', shift.train_weight || '');
      setFieldValue('inputTrainAxles', shift.train_axles || '');
      setFieldValue('inputTrainLength', shift.train_length || '');
      setFieldValue('inputRouteFrom', shift.route_from || '');
      setFieldValue('inputRouteTo', shift.route_to || '');
      setRouteType(shift.route_kind === 'trip' ? 'trip' : 'depot');
      setOptionalCardOpen('optionalLocoCard', !!(shift.locomotive_series || shift.locomotive_number));
      setOptionalCardOpen('optionalTrainCard', !!(shift.train_number || shift.train_weight || shift.train_axles || shift.train_length));
      setOptionalCardOpen('optionalRouteCard', !!(shift.route_kind === 'trip' || shift.route_from || shift.route_to));
      renderDraftShiftSummary();
    }

    function clearOptionalShiftData() {
      applyOptionalShiftData({
        locomotive_series: '',
        locomotive_number: '',
        train_number: '',
        train_weight: '',
        train_axles: '',
        train_length: '',
        route_kind: 'depot',
        route_from: '',
        route_to: ''
      });
    }

    function getLocoSummary(shift) {
      var parts = [];
      if (shift.locomotive_series) parts.push(shift.locomotive_series);
      if (shift.locomotive_number) parts.push('№ ' + shift.locomotive_number);
      return parts.join(' ');
    }

    function getTrainSummary(shift) {
      var parts = [];
      if (shift.train_number) parts.push('№ ' + shift.train_number);
      if (shift.train_weight) parts.push(shift.train_weight + ' т');
      if (shift.train_axles) parts.push(shift.train_axles + ' осей');
      if (shift.train_length) parts.push(shift.train_length + ' уд.');
      return parts.join(' · ');
    }

    function getShiftTitle(shift) {
      var from = shift.route_from ? shift.route_from : '';
      var to = shift.route_to ? shift.route_to : '';
      if (shift.route_kind === 'trip' && (from || to)) {
        return (from || 'Пункт A') + ' → ' + (to || 'Пункт B');
      }
      if (shift.route_kind === 'trip') {
        return 'Поездка';
      }
      if (shift.route_kind === 'depot') {
        return 'Под депо';
      }
      var loco = getLocoSummary(shift);
      if (loco) return 'Локомотив ' + loco;
      var train = getTrainSummary(shift);
      if (train) return 'Поезд ' + train;
      return 'Смена';
    }

    function getShiftDetailLines(shift) {
      var lines = [];
      var loco = getLocoSummary(shift);
      if (loco) lines.push(loco);
      var train = getTrainSummary(shift);
      if (train) lines.push('Поезд ' + train);
      return lines;
    }

    function getShiftKindLabel(shift) {
      if (!shift) return '';
      if (shift.route_kind === 'trip') return 'Поездка';
      if (shift.route_kind === 'depot') return 'Под депо';
      if (getLocoSummary(shift)) return 'Локомотив';
      if (getTrainSummary(shift)) return 'Поезд';
      return '';
    }

    function getShiftActionsMenuEls() {
      var scopeSelector = activeShiftMenuScope ? ('#' + activeShiftMenuScope + ' ') : '';
      return {
        triggerEl: activeShiftMenuId ? document.querySelector(scopeSelector + '.shift-actions-trigger[data-id="' + activeShiftMenuId + '"]') : null,
        menuEl: SHIFT_ACTIONS_MENU,
        shiftEl: activeShiftMenuId ? document.querySelector(scopeSelector + '.shift-item[data-shift-id="' + activeShiftMenuId + '"]') : null
      };
    }

    function hideShiftActionsMenuOnly() {
      if (SHIFT_ACTIONS_MENU) {
        SHIFT_ACTIONS_MENU.classList.remove('is-entering');
        SHIFT_ACTIONS_MENU.setAttribute('aria-hidden', 'true');
        if (!SHIFT_ACTIONS_MENU.classList.contains('hidden') && !SHIFT_ACTIONS_MENU.classList.contains('is-leaving')) {
          SHIFT_ACTIONS_MENU.classList.add('is-leaving');
          var _menu = SHIFT_ACTIONS_MENU;
          function _onLeaveEnd() {
            _menu.removeEventListener('animationend', _onLeaveEnd);
            _menu.classList.remove('is-leaving');
            _menu.classList.add('hidden');
          }
          SHIFT_ACTIONS_MENU.addEventListener('animationend', _onLeaveEnd);
        }
      }
      if (SHIFT_ACTIONS_BACKDROP) {
        SHIFT_ACTIONS_BACKDROP.classList.add('hidden');
        SHIFT_ACTIONS_BACKDROP.setAttribute('aria-hidden', 'true');
      }
    }

    function syncShiftActionsMenuLifecycle() {
      if (activeShiftMenuId === null) {
        hideShiftActionsMenuOnly();
        return;
      }

      var els = getShiftActionsMenuEls();
      if (editingShiftId || !els.shiftEl || !els.triggerEl) {
        activeShiftMenuId = null;
        activeShiftMenuScope = null;
        hideShiftActionsMenuOnly();
      }
    }

    function portalShiftActionsMenu() {
      if (!SHIFT_ACTIONS_MENU || !UI_OVERLAY_ROOT) return;
      if (SHIFT_ACTIONS_BACKDROP && SHIFT_ACTIONS_BACKDROP.parentNode !== UI_OVERLAY_ROOT) {
        UI_OVERLAY_ROOT.appendChild(SHIFT_ACTIONS_BACKDROP);
      }
      if (SHIFT_ACTIONS_MENU.parentNode !== UI_OVERLAY_ROOT) {
        UI_OVERLAY_ROOT.appendChild(SHIFT_ACTIONS_MENU);
      }
    }

    function updateShiftActionsMenuPosition() {
      var els = getShiftActionsMenuEls();
      if (!els.triggerEl || !els.menuEl || els.menuEl.classList.contains('hidden')) return;

      var triggerRect = els.triggerEl.getBoundingClientRect();
      var menuRect = els.menuEl.getBoundingClientRect();
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var gutter = 14;
      var gap = 12;
      var menuWidth = Math.max(156, menuRect.width || 0);
      var menuHeight = Math.max(72, menuRect.height || 0);
      var left = Math.min(triggerRect.right - menuWidth, viewportWidth - menuWidth - gutter);
      if (left < gutter) left = gutter;

      var spaceAbove = triggerRect.top - gap - gutter;
      var spaceBelow = viewportHeight - triggerRect.bottom - gap - gutter;
      var openAbove = spaceAbove >= menuHeight || spaceAbove >= spaceBelow;
      var top = openAbove ? Math.max(gutter, triggerRect.top - gap - menuHeight) : Math.min(viewportHeight - menuHeight - gutter, triggerRect.bottom + gap);
      if (top < gutter) top = gutter;

      els.menuEl.style.setProperty('--shift-menu-left', left + 'px');
      els.menuEl.style.setProperty('--shift-menu-top', top + 'px');
      els.menuEl.dataset.placement = openAbove ? 'top' : 'bottom';
    }

    function renderShiftActionsMenu(shiftId) {
      if (!SHIFT_ACTIONS_MENU) return;
      SHIFT_ACTIONS_MENU.innerHTML =
        '<button class="shift-actions-item" type="button" data-action="edit" data-id="' + shiftId + '" role="menuitem">Редактировать</button>' +
        '<button class="shift-actions-item is-danger" type="button" data-action="delete" data-id="' + shiftId + '" role="menuitem">Удалить</button>';
      portalShiftActionsMenu();
      if (SHIFT_ACTIONS_BACKDROP) {
        SHIFT_ACTIONS_BACKDROP.classList.remove('hidden');
        SHIFT_ACTIONS_BACKDROP.setAttribute('aria-hidden', 'false');
      }
      SHIFT_ACTIONS_MENU.classList.remove('is-leaving', 'is-entering', 'hidden');
      SHIFT_ACTIONS_MENU.setAttribute('aria-hidden', 'false');
      void SHIFT_ACTIONS_MENU.offsetWidth;
      SHIFT_ACTIONS_MENU.classList.add('is-entering');
      updateShiftActionsMenuPosition();
    }

    function closeShiftActionsMenu(skipRender) {
      if (activeShiftMenuId === null) return;
      hideShiftActionsMenuOnly();
      activeShiftMenuId = null;
      activeShiftMenuScope = null;
      if (!skipRender) render();
    }

    function toggleShiftActionsMenu(id) {
      if (activeShiftMenuId === id) {
        activeShiftMenuId = null;
        activeShiftMenuScope = null;
      } else {
        activeShiftMenuId = id;
      }
      render();
    }

    function handleShiftActionsTriggerClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget.dataset.shiftTriggerPressed === '1' && e.type === 'click') return;
      var host = e.currentTarget.closest('#homeShiftsList, #shiftsList');
      activeShiftMenuScope = host ? host.id : 'shiftsList';
      toggleShiftActionsMenu(e.currentTarget.getAttribute('data-id'));
    }

    function handleShiftActionsTriggerPointerDown(e) {
      e.preventDefault();
      e.stopPropagation();
      var trigger = e.currentTarget;
      if (trigger.dataset.shiftTriggerPressed === '1') return;
      trigger.dataset.shiftTriggerPressed = '1';
      window.setTimeout(function() {
        delete trigger.dataset.shiftTriggerPressed;
      }, 350);
      handleShiftActionsTriggerClick(e);
    }

    function handleShiftActionsItemClick(item, e) {
      if (!item) return;
      if (item.dataset.shiftActionHandled === '1') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      item.dataset.shiftActionHandled = '1';
      window.setTimeout(function() {
        delete item.dataset.shiftActionHandled;
      }, 600);

      e.preventDefault();
      e.stopPropagation();

      var action = item.getAttribute('data-action');
      var id = item.getAttribute('data-id');
      var shift = findShiftById(id);
      if (!shift) {
        closeShiftActionsMenu(true);
        return;
      }

      if (action === 'edit') {
        enterEditMode(shift);
        closeShiftActionsMenu(true);
        return;
      }

      if (action === 'delete') {
        pendingDeleteId = id;
        var f = fmtShift(shift);
        document.getElementById('confirmShiftInfo').textContent = f.text + ' · ' + f.dur;
        closeShiftActionsMenu(true);
        openOverlay('overlayConfirm');
      }
    }

    function handleShiftActionsBackdropPointerDown(e) {
      e.preventDefault();
      e.stopPropagation();
      closeShiftActionsMenu(true);
    }

    // ── Delete handler ──
    function handleDeleteClick(e) {
      var id = e.currentTarget.getAttribute('data-id');
      var shift = null;
      for (var i = 0; i < allShifts.length; i++) {
        if (allShifts[i].id === id) { shift = allShifts[i]; break; }
      }
      if (!shift) return;

      pendingDeleteId = id;
      var f = fmtShift(shift);
      document.getElementById('confirmShiftInfo').textContent = f.text + ' · ' + f.dur;
      render();
      openOverlay('overlayConfirm');
    }

    function findShiftById(id) {
      for (var i = 0; i < allShifts.length; i++) {
        if (allShifts[i].id === id) return allShifts[i];
      }
      return null;
    }

    function enterEditMode(shift) {
      if (!shift) return;

      editingShiftId = shift.id;
      clearRecentAddHighlight();
      setActiveTab('add');
      setFormMode('edit');
      document.getElementById('formTitle').textContent = 'Редактировать смену';
      document.getElementById('editBadge').classList.add('visible');
      document.getElementById('inputStartDate').value = shift.start_msk.substring(0, 10);
      document.getElementById('inputStartTime').value = shift.start_msk.substring(11, 16);
      document.getElementById('inputEndDate').value = shift.end_msk.substring(0, 10);
      document.getElementById('inputEndTime').value = shift.end_msk.substring(11, 16);
      applyOptionalShiftData(shift);
      document.getElementById('btnAdd').textContent = 'Сохранить изменения';
      document.getElementById('btnCancelEdit').classList.remove('hidden');
      clearErrors();
      renderDraftShiftSummary();
      render();
    }

    function exitEditMode(nextTab) {
      editingShiftId = null;
      setFormMode('add');
      document.getElementById('formTitle').textContent = 'Добавить смену';
      document.getElementById('editBadge').classList.remove('visible');
      document.getElementById('btnAdd').textContent = 'Добавить смену';
      document.getElementById('btnCancelEdit').classList.add('hidden');
      clearErrors();
      document.getElementById('inputStartDate').value = '';
      document.getElementById('inputStartTime').value = '';
      document.getElementById('inputEndDate').value = '';
      document.getElementById('inputEndTime').value = '';
      clearOptionalShiftData();
      setDefaultShiftTimeInputs();
      renderDraftShiftSummary();
      setActiveTab(nextTab || 'add');
      render();
    }

    function handleEditClick(e) {
      var id = e.currentTarget.getAttribute('data-id');
      var shift = findShiftById(id);
      if (!shift) return;
      enterEditMode(shift);
    }

    document.getElementById('btnConfirmDelete').addEventListener('click', function() {
      if (!pendingDeleteId) return;
      var newShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (allShifts[i].id !== pendingDeleteId) newShifts.push(allShifts[i]);
      }
      allShifts = newShifts;
      pendingMutationIds = [];
      if (editingShiftId === pendingDeleteId) {
        exitEditMode('shifts');
      }
      pendingDeleteId = null;
      closeOverlay('overlayConfirm');

      // Optimistic render — remove shift from UI immediately, before network
      render();

      saveShifts(function(err) {
        if (err) {
          loadShifts(function() {
            render();
          });
          return;
        }
        render();
      });
    });

    document.getElementById('btnCancelDelete').addEventListener('click', function() {
      pendingDeleteId = null;
      closeOverlay('overlayConfirm');
      render();
    });

    // ── Month navigation ──
    document.getElementById('btnPrevMonth').addEventListener('click', function() {
      if (currentMonth === 0) { currentMonth = 11; currentYear--; }
      else currentMonth--;
      render();
    });

    document.getElementById('btnNextMonth').addEventListener('click', function() {
      if (currentMonth === 11) { currentMonth = 0; currentYear++; }
      else currentMonth++;
      render();
    });

    document.getElementById('btnPrevSalaryMonth').addEventListener('click', function() {
      if (salaryMonth === 0) { salaryMonth = 11; salaryYear--; }
      else salaryMonth--;
      render();
    });

    document.getElementById('btnNextSalaryMonth').addEventListener('click', function() {
      if (salaryMonth === 11) { salaryMonth = 0; salaryYear++; }
      else salaryMonth++;
      render();
    });

    // ── Add shift form ──
    function clearErrors() {
      document.getElementById('errStart').textContent = '';
      document.getElementById('errEnd').textContent = '';
      document.getElementById('inputStartDate').classList.remove('input-error');
      document.getElementById('inputStartTime').classList.remove('input-error');
      document.getElementById('inputEndDate').classList.remove('input-error');
      document.getElementById('inputEndTime').classList.remove('input-error');
      document.getElementById('formSuccess').textContent = '';
    }

    var inputStartDateEl = document.getElementById('inputStartDate');
    var inputStartTimeEl = document.getElementById('inputStartTime');
    var inputEndDateEl = document.getElementById('inputEndDate');
    var inputEndTimeEl = document.getElementById('inputEndTime');
    var routeTypeButtons = document.querySelectorAll('#routeTypeSegmented .segmented-btn');
    setFormMode('add');
    clearOptionalShiftData();

    setDefaultShiftTimeInputs();
    renderDraftShiftSummary();
    updateViewportMetrics();
    scheduleBottomNavHeightSync();
    settleSafeAreaInsets();


    resetViewportBaselines();
    scheduleKeyboardSync();
    window.addEventListener('load', setDefaultShiftTimeInputs);
    setTimeout(setDefaultShiftTimeInputs, 0);
    setTimeout(setDefaultShiftTimeInputs, 250);

    window.addEventListener('resize', function() {
      updateViewportMetrics();
      scheduleBottomNavHeightSync();
      scheduleKeyboardSync();
    });
    window.addEventListener('orientationchange', function() {
      resetViewportBaselines();
      settleSafeAreaInsets();
      scheduleBottomNavHeightSync();
      scheduleKeyboardSync();
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        updateViewportMetrics();
        scheduleBottomNavHeightSync();
        scheduleKeyboardSync();
      });
      window.visualViewport.addEventListener('scroll', scheduleKeyboardSync);
    }
    document.addEventListener('focusin', function(e) {
      if (!isKeyboardInputElement(e.target) || !isKeyboardFieldEligible(e.target)) return;
      scheduleKeyboardSync();
    });
    document.addEventListener('focusout', function(e) {
      if (!isKeyboardInputElement(e.target) || !isKeyboardFieldEligible(e.target)) return;
      window.setTimeout(scheduleKeyboardSync, 80);
    });

    inputStartDateEl.addEventListener('pointerdown', setDefaultShiftTimeInputs);
    inputStartTimeEl.addEventListener('pointerdown', setDefaultShiftTimeInputs);
    inputStartDateEl.addEventListener('touchstart', setDefaultShiftTimeInputs, { passive: true });
    inputStartTimeEl.addEventListener('touchstart', setDefaultShiftTimeInputs, { passive: true });
    inputStartDateEl.addEventListener('focus', setDefaultShiftTimeInputs);
    inputStartTimeEl.addEventListener('focus', setDefaultShiftTimeInputs);
    inputStartDateEl.addEventListener('click', setDefaultShiftTimeInputs);
    inputStartTimeEl.addEventListener('click', setDefaultShiftTimeInputs);
    inputStartDateEl.addEventListener('input', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputStartTimeEl.addEventListener('input', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputStartDateEl.addEventListener('change', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputStartTimeEl.addEventListener('change', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputEndDateEl.addEventListener('input', renderDraftShiftSummary);
    inputEndTimeEl.addEventListener('input', renderDraftShiftSummary);
    inputEndDateEl.addEventListener('change', renderDraftShiftSummary);
    inputEndTimeEl.addEventListener('change', renderDraftShiftSummary);

    wireNumericInput('inputLocoNumber', 4);
    wireNumericInput('inputTrainNumber', 4);
    wireNumericInput('inputTrainWeight', 4);
    wireNumericInput('inputTrainAxles', 3);
    wireNumericInput('inputTrainLength', 3);

    document.getElementById('inputLocoSeries').addEventListener('change', function(e) {
      updateSelectPlaceholderState(e.currentTarget);
      renderDraftShiftSummary();
    });
    buildLocoSeriesMenu();
    syncLocoSeriesTrigger();
    var locoSeriesTriggerEl = document.getElementById('locoSeriesTrigger');
    var locoSeriesMenuEl = document.getElementById('locoSeriesMenu');
    if (locoSeriesTriggerEl) {
      locoSeriesTriggerEl.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleLocoSeriesMenu();
      });
    }
    if (locoSeriesMenuEl) {
      locoSeriesMenuEl.addEventListener('click', function(e) {
        var option = e.target.closest('.glass-select-option');
        if (!option) return;
        setLocoSeriesValue(option.getAttribute('data-value'));
      });
    }
    if (SHIFT_ACTIONS_MENU) {
      SHIFT_ACTIONS_MENU.addEventListener('pointerup', function(e) {
        var item = e.target.closest('.shift-actions-item');
        if (!item) return;
        handleShiftActionsItemClick(item, e);
      });
      SHIFT_ACTIONS_MENU.addEventListener('click', function(e) {
        var item = e.target.closest('.shift-actions-item');
        if (!item) return;
        handleShiftActionsItemClick(item, e);
      });
      SHIFT_ACTIONS_MENU.addEventListener('touchend', function(e) {
        var item = e.target.closest('.shift-actions-item');
        if (!item) return;
        handleShiftActionsItemClick(item, e);
      }, { passive: false });
    }
    if (SHIFT_ACTIONS_BACKDROP) {
      SHIFT_ACTIONS_BACKDROP.addEventListener('pointerdown', handleShiftActionsBackdropPointerDown);
      SHIFT_ACTIONS_BACKDROP.addEventListener('click', handleShiftActionsBackdropPointerDown);
    }
    document.addEventListener('pointerdown', function(e) {
      var els = getLocoSeriesMenuEls();
      if (!els.menuEl || els.menuEl.classList.contains('hidden')) return;
      var clickedTrigger = !!(els.triggerEl && els.triggerEl.contains(e.target));
      var clickedMenu = !!els.menuEl.contains(e.target);
      if (!clickedTrigger && !clickedMenu) closeLocoSeriesMenu();
    });
    document.addEventListener('pointerdown', function(e) {
      if (activeShiftMenuId === null) return;
      var clickedTrigger = !!e.target.closest('.shift-actions-trigger');
      var clickedMenu = !!(SHIFT_ACTIONS_MENU && SHIFT_ACTIONS_MENU.contains(e.target));
      if (!clickedTrigger && !clickedMenu) closeShiftActionsMenu(true);
    });
    document.addEventListener('scroll', function() {
      if (LOCO_SERIES_MENU_OPEN) updateLocoSeriesMenuPosition();
      if (activeShiftMenuId !== null) closeShiftActionsMenu(true);
    }, true);
    window.addEventListener('resize', function() {
      if (LOCO_SERIES_MENU_OPEN) updateLocoSeriesMenuPosition();
      if (activeShiftMenuId !== null) closeShiftActionsMenu(true);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLocoSeriesMenu();
      if (e.key === 'Escape') closeShiftActionsMenu(true);
    });
    window.addEventListener('online', function() {
      updateOfflineUiState({ isOffline: false, lastSyncStatus: readPendingSnapshot() ? 'pending' : 'synced' });
      flushPendingSnapshot();
    });
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        settleSafeAreaInsets();
        updateOfflineUiState({ isOffline: !navigator.onLine, hasPending: !!readPendingSnapshot() });
        if (navigator.onLine) flushPendingSnapshot();
      }
    });

    // Auto-retry pending sync every 30s — catches cases where the 'online' event
    // fired but sync failed (e.g. flaky network), without requiring user action.
    setInterval(function() {
      if (navigator.onLine && readPendingSnapshot() && !offlineUiState.isSyncing) {
        flushPendingSnapshot();
      }
    }, 30000);
    document.getElementById('inputRouteFrom').addEventListener('input', renderDraftShiftSummary);
    document.getElementById('inputRouteTo').addEventListener('input', renderDraftShiftSummary);
    for (var rt = 0; rt < routeTypeButtons.length; rt++) {
      routeTypeButtons[rt].addEventListener('click', function(e) {
        setRouteType(e.currentTarget.getAttribute('data-value'));
        renderDraftShiftSummary();
      });
    }

    document.getElementById('btnAdd').addEventListener('click', function() {
      clearErrors();

      var startVal = composeMskDateTime(inputStartDateEl.value, inputStartTimeEl.value);
      var endVal = composeMskDateTime(inputEndDateEl.value, inputEndTimeEl.value);
      var valid = true;

      if (!startVal) {
        document.getElementById('errStart').textContent = 'Заполни дату и время начала';
        inputStartDateEl.classList.add('input-error');
        inputStartTimeEl.classList.add('input-error');
        valid = false;
      }

      if (!endVal) {
        document.getElementById('errEnd').textContent = 'Заполни дату и время окончания';
        inputEndDateEl.classList.add('input-error');
        inputEndTimeEl.classList.add('input-error');
        valid = false;
      }

      if (!valid) return;

      var startDate = parseMsk(startVal);
      var endDate = parseMsk(endVal);

      if (!startDate || !endDate) {
        document.getElementById('errStart').textContent = 'Неверный формат даты';
        return;
      }

      if (endDate.getTime() <= startDate.getTime()) {
        document.getElementById('errEnd').textContent = 'Конец смены не может быть раньше начала';
        inputEndDateEl.classList.add('input-error');
        inputEndTimeEl.classList.add('input-error');
        return;
      }

      var previousShifts = allShifts.slice();
      var isEditing = !!editingShiftId;
      var shiftId = isEditing ? editingShiftId : (Date.now().toString(36) + Math.random().toString(36).substring(2, 7));
      var existingShift = isEditing ? findShiftById(shiftId) : null;
      var optionalData = collectOptionalShiftData();
      var shift = {
        id: shiftId,
        start_msk: startVal,
        end_msk: endVal,
        created_at: existingShift && existingShift.created_at ? existingShift.created_at : new Date().toISOString(),
        locomotive_series: optionalData.locomotive_series,
        locomotive_number: optionalData.locomotive_number,
        train_number: optionalData.train_number,
        train_weight: optionalData.train_weight,
        train_axles: optionalData.train_axles,
        train_length: optionalData.train_length,
        route_kind: optionalData.route_kind,
        route_from: optionalData.route_from,
        route_to: optionalData.route_to
      };

      if (isEditing) {
        var replaced = false;
        for (var i = 0; i < allShifts.length; i++) {
          if (allShifts[i].id === shiftId) {
            allShifts[i] = shift;
            replaced = true;
            break;
          }
        }
        if (!replaced) {
          allShifts.push(shift);
        }
      } else {
        allShifts.push(shift);
      }
      pendingMutationIds = [shiftId];

      // Disable button during save
      var btn = document.getElementById('btnAdd');
      btn.disabled = true;

      // Optimistic render — show change in UI immediately, before network
      render();

      saveShifts(function(err) {
        if (err) {
          allShifts = previousShifts;
          btn.disabled = false;
          document.getElementById('formSuccess').textContent = 'Не удалось сохранить смену';
          render();
          return;
        }

        if (isEditing) {
          exitEditMode('shifts');
          clearRecentAddHighlight();
        } else {
          inputStartDateEl.value = '';
          inputStartTimeEl.value = '';
          inputEndDateEl.value = '';
          inputEndTimeEl.value = '';
          clearOptionalShiftData();
          setFormMode('add');
          clearRecentAddHighlight();
          recentAddedShiftId = shiftId;
          if (recentAddTimer) clearTimeout(recentAddTimer);
          recentAddTimer = setTimeout(function() {
            recentAddedShiftId = null;
            recentAddTimer = null;
            render();
          }, 1600);
        }
        document.getElementById('formSuccess').textContent = isEditing ? '✓ Смена обновлена' : '✓ Смена добавлена';
        btn.disabled = false;
        if (!isEditing) {
          var section = document.getElementById('shiftFormSection');
          section.classList.remove('add-pulse');
          void section.offsetWidth;
          section.classList.add('add-pulse');
          setTimeout(function() {
            section.classList.remove('add-pulse');
          }, 750);
        }
        render();

        // Clear success message after 2s
        setTimeout(function() {
          document.getElementById('formSuccess').textContent = '';
        }, 2000);
      });
    });

    // ── Overlays ──
    function openOverlay(id) {
      closeShiftActionsMenu(true);
      closeLocoSeriesMenu();
      document.getElementById(id).classList.add('visible');
    }

    function closeOverlay(id) {
      document.getElementById(id).classList.remove('visible');
      if (id === 'overlayConfirm' && pendingDeleteId) {
        pendingDeleteId = null;
        render();
      }
    }

    // Close on backdrop click
    var overlays = document.querySelectorAll('.overlay');
    for (var oi = 0; oi < overlays.length; oi++) {
      overlays[oi].addEventListener('click', function(e) {
        if (e.target === e.currentTarget) {
          closeOverlay(e.currentTarget.id);
        }
      });
    }

    // ── Add to Screen ──
    document.getElementById('btnAddToScreen').addEventListener('click', function() {
      document.getElementById('appUrl').textContent = getAppUrl();
      openOverlay('overlayAddScreen');
    });

    var tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
    for (var tb = 0; tb < tabButtons.length; tb++) {
      tabButtons[tb].addEventListener('click', function(e) {
        var tab = e.currentTarget.getAttribute('data-tab');
        if (tab === 'add') {
          openAddTabAndFocusForm();
          return;
        }
        setActiveTab(tab);
      });
    }

    var goToShiftsBtn = document.getElementById('btnGoToShifts');
    if (goToShiftsBtn) {
      goToShiftsBtn.addEventListener('click', function() {
        setActiveTab('shifts');
      });
    }

    document.getElementById('btnCancelEdit').addEventListener('click', function() {
      exitEditMode('shifts');
    });

    document.getElementById('btnCloseAddScreen').addEventListener('click', function() {
      closeOverlay('overlayAddScreen');
    });

    document.getElementById('btnCopyUrl').addEventListener('click', function() {
      var url = getAppUrl();
      var btn = document.getElementById('btnCopyUrl');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
          btn.textContent = '✓';
          setTimeout(function() { btn.textContent = 'Копировать'; }, 1500);
        }).catch(function() {
          fallbackCopy(url, btn);
        });
      } else {
        fallbackCopy(url, btn);
      }
    });

    repairUiText();
    bindSettingsControls();
    updateSettingsControls();

    (function initOptionalCardAnimations() {
      var cards = document.querySelectorAll('.optional-card');
      for (var i = 0; i < cards.length; i++) {
        (function(card) {
          var summary = card.querySelector('.optional-summary');
          if (!summary) return;
          summary.addEventListener('click', function(e) {
            e.preventDefault();
            if (card.open) {
              card.classList.add('is-closing');
              setTimeout(function() {
                card.removeAttribute('open');
                card.classList.remove('is-closing');
              }, 180);
            } else {
              card.setAttribute('open', '');
            }
          });
        })(cards[i]);
      }
    }());

    var authPrimaryAction = document.getElementById('authPrimaryAction');
    if (authPrimaryAction) {
      authPrimaryAction.addEventListener('click', function() {
        if (AUTH_STATE === 'error') {
          restartAuthFlow();
          return;
        }

        if (AUTH_ENV_STATE === 'dev') {
          window.open(getTelegramBotUrl(), '_blank', 'noopener');
          return;
        }

        if (AUTH_STATE === 'guest' || AUTH_STATE === 'pending') {
          if (AUTH_WIDGET_SHELL && AUTH_WIDGET_SHELL.scrollIntoView) {
            AUTH_WIDGET_SHELL.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          renderTelegramLoginWidget();
        }
      });
    }

    document.getElementById('btnAuthRetry').addEventListener('click', function() {
      restartAuthFlow();
    });

    function fallbackCopy(text, btn) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        btn.textContent = '✓';
        setTimeout(function() { btn.textContent = 'Копировать'; }, 1500);
      } catch(e) {
        btn.textContent = '✗';
        setTimeout(function() { btn.textContent = 'Копировать'; }, 1500);
      }
      document.body.removeChild(ta);
    }
