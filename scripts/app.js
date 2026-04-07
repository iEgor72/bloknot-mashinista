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
    var LEGACY_SETTINGS_STORAGE_KEY = 'shift_tracker_settings_v1';
    var SALARY_PARAMS_STORAGE_KEY = 'shift_tracker_salary_params_v1';
    var DEFAULT_SALARY_PARAMS = {
      tariffRate: 380,
      nightPercent: 40,
      classPercent: 5,
      districtPercent: 30,
      northPercent: 50,
      localPercent: 20
    };
    var salaryParamsStore = createSalaryParamsStore();
    var appSettings = salaryParamsStore.values;
    var installPromptDismissed = false;
    var PRO_STORAGE_KEY = 'shift_tracker_pro_v1';
    var proStore = loadProStore();
    var INSTRUCTIONS_DATA_URL = '/assets/instructions/catalog.v2.json';
    var INSTRUCTIONS_CORE = window.InstructionsCore || {};
    var instructionsStore = createInstructionsStore();
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

    function createSalaryParamsStore() {
      return {
        values: loadSalaryParams(),
        update: function(patch) {
          var keys = Object.keys(patch || {});
          if (!keys.length) return;
          for (var i = 0; i < keys.length; i++) {
            this.values[keys[i]] = patch[keys[i]];
          }
          this.values = normalizeSalaryParams(this.values);
          saveSalaryParams(this.values);
        },
        reset: function() {
          this.values = normalizeSalaryParams(DEFAULT_SALARY_PARAMS);
          saveSalaryParams(this.values);
        }
      };
    }

    function normalizeSalaryParams(raw) {
      var settings = raw || {};
      var merged = {};
      var keys = Object.keys(DEFAULT_SALARY_PARAMS);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        merged[key] = settings[key] !== undefined && settings[key] !== null && settings[key] !== '' ? settings[key] : DEFAULT_SALARY_PARAMS[key];
      }

      merged.tariffRate = parseFloat(merged.tariffRate);
      merged.nightPercent = parseFloat(merged.nightPercent);
      merged.classPercent = parseFloat(merged.classPercent);
      merged.districtPercent = parseFloat(merged.districtPercent);
      merged.northPercent = parseFloat(merged.northPercent);
      merged.localPercent = parseFloat(merged.localPercent);

      if (isNaN(merged.tariffRate)) merged.tariffRate = DEFAULT_SALARY_PARAMS.tariffRate;
      if (isNaN(merged.nightPercent)) merged.nightPercent = DEFAULT_SALARY_PARAMS.nightPercent;
      if (isNaN(merged.classPercent)) merged.classPercent = DEFAULT_SALARY_PARAMS.classPercent;
      if (isNaN(merged.districtPercent)) merged.districtPercent = DEFAULT_SALARY_PARAMS.districtPercent;
      if (isNaN(merged.northPercent)) merged.northPercent = DEFAULT_SALARY_PARAMS.northPercent;
      if (isNaN(merged.localPercent)) merged.localPercent = DEFAULT_SALARY_PARAMS.localPercent;
      return merged;
    }

    function loadSalaryParams() {
      var settings = {};
      try {
        settings = JSON.parse(localStorage.getItem(SALARY_PARAMS_STORAGE_KEY) || '{}') || {};
      } catch (e) {
        settings = {};
      }

      // Backward compatibility: migrate older settings key used in previous versions.
      if (!settings || !Object.keys(settings).length) {
        try {
          settings = JSON.parse(localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY) || '{}') || {};
        } catch (legacyError) {
          settings = {};
        }
      }

      var normalized = normalizeSalaryParams(settings);
      saveSalaryParams(normalized);
      return normalized;
    }

    function saveSalaryParams(params) {
      try {
        localStorage.setItem(SALARY_PARAMS_STORAGE_KEY, JSON.stringify(normalizeSalaryParams(params)));
      } catch (e) {}
    }

    function loadProStore() {
      // Demo paywall should reset on every app entry.
      // Keep state only in memory for current runtime.
      try {
        localStorage.removeItem(PRO_STORAGE_KEY);
      } catch (e) {
        // ignore storage issues
      }
      return {
        isActive: false
      };
    }

    function saveProStore() {
      try {
        localStorage.removeItem(PRO_STORAGE_KEY);
      } catch (e) {}
    }

    function createInstructionsStore() {
      return {
        status: 'idle',
        instructions: [],
        searchDocs: [],
        preparedSearchDocs: [],
        preparedSearchDocsKey: '',
        searchResults: [],
        searchAnswer: null,
        searchQuery: '',
        errorMessage: '',
        lastUpdated: '',
        hasCache: false,
        dataSource: 'none',
        view: 'list',
        selectedInstructionId: '',
        selectedSectionId: '',
        loadPromise: null,
        searchTimer: null
      };
    }

    function formatRub(value) {
      var rounded = Math.round(value || 0);
      return rounded.toLocaleString('ru-RU') + ' ₽';
    }

    function formatMonthIncomeLabel(month0) {
      var monthName = MONTH_NAMES[month0];
      if (!monthName) return 'За месяц:';
      return 'За ' + monthName.toLowerCase() + ':';
    }

    function formatPercent(value) {
      var rounded = Math.round((value || 0) * 10) / 10;
      return String(rounded).replace(/\.0$/, '') + '%';
    }

    function shouldShowInstallPromptCard() {
      return !isStandalonePwa() && !installPromptDismissed;
    }

    function renderInstallPromptCard() {
      var card = document.getElementById('installPromptCard');
      if (!card) return;
      card.classList.toggle('hidden', !shouldShowInstallPromptCard());
    }

    function dismissInstallPromptCard() {
      installPromptDismissed = true;
      renderInstallPromptCard();
    }

    function setProActive(isActive) {
      proStore.isActive = !!isActive;
      saveProStore();
      if (proStore.isActive) {
        ensureInstructionsReady(false, false);
      }
      renderInstructionsScreen();
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

      appSettings.tariffRate = isNaN(tariff) ? DEFAULT_SALARY_PARAMS.tariffRate : tariff;
      appSettings.nightPercent = isNaN(night) ? DEFAULT_SALARY_PARAMS.nightPercent : night;
      appSettings.classPercent = isNaN(klass) ? DEFAULT_SALARY_PARAMS.classPercent : klass;
      appSettings.districtPercent = isNaN(district) ? DEFAULT_SALARY_PARAMS.districtPercent : district;
      appSettings.northPercent = isNaN(north) ? DEFAULT_SALARY_PARAMS.northPercent : north;
      appSettings.localPercent = isNaN(local) ? DEFAULT_SALARY_PARAMS.localPercent : local;

      salaryParamsStore.update(appSettings);
      appSettings = salaryParamsStore.values;
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
      var averageEl = document.getElementById('dashboardAverageShift');
      if (!averageEl) return;
      averageEl.className = 'dashboard-average';

      if (!summary || summary.shiftCount === 0) {
        averageEl.textContent = 'ср. смена: нет данных';
        averageEl.classList.add('is-muted');
        return;
      }

      if (summary.shiftCount < MIN_SHIFTS_FOR_AVERAGE) {
        averageEl.textContent = 'ср. смена: нужно больше смен';
        averageEl.classList.add('is-muted');
        return;
      }

      var incomeText = summary.incomeCount > 0
        ? formatRub(summary.averageIncome)
        : '—';
      var durationText = summary.durationCount > 0
        ? formatHoursAndMinutes(summary.averageDurationMin)
        : '—';

      averageEl.textContent = 'ср. смена: ' + incomeText + ' · ' + durationText;
      if (summary.incomeCount === 0 || summary.durationCount === 0) {
        averageEl.classList.add('is-muted');
      }
    }

    function renderSalaryPanel() {
      var bounds = getMonthBounds(currentYear, currentMonth);
      var monthShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (shiftMinutesInRange(allShifts[i], bounds.start, bounds.end) > 0) {
          monthShifts.push(allShifts[i]);
        }
      }
      monthShifts.sort(compareShiftsByStartDesc);

      var summary = buildSalarySummary(monthShifts, bounds);
      renderMonthHeader('salaryMonthTitle', 'salaryMonthQuarter', 'salaryMonthTabs', currentYear, currentMonth, function(targetMonth) {
        currentMonth = targetMonth;
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

    function stripHtmlToText(content) {
      var temp = document.createElement('div');
      temp.innerHTML = String(content || '');
      return String(temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeInstructionTextBlock(value) {
      return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    var SEARCH_STOP_WORDS = {
      'и': 1, 'в': 1, 'во': 1, 'на': 1, 'по': 1, 'к': 1, 'ко': 1, 'о': 1, 'об': 1, 'обо': 1,
      'с': 1, 'со': 1, 'у': 1, 'за': 1, 'из': 1, 'от': 1, 'до': 1, 'для': 1, 'при': 1, 'под': 1,
      'над': 1, 'не': 1, 'ни': 1, 'а': 1, 'но': 1, 'или': 1, 'ли': 1, 'же': 1, 'бы': 1, 'что': 1,
      'как': 1, 'где': 1, 'когда': 1, 'какой': 1, 'какая': 1, 'какие': 1, 'какое': 1
    };

    var RU_PERFECTIVEGROUND_1 = /(ив|ивши|ившись|ыв|ывши|ывшись)$/;
    var RU_PERFECTIVEGROUND_2 = /([ая])(в|вши|вшись)$/;
    var RU_REFLEXIVE = /(с[яь])$/;
    var RU_ADJECTIVE = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
    var RU_PARTICIPLE_1 = /([ая])(ем|нн|вш|ющ|щ)$/;
    var RU_PARTICIPLE_2 = /(ивш|ывш|ующ)$/;
    var RU_VERB_1 = /([ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)$/;
    var RU_VERB_2 = /(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)$/;
    var RU_NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ию|ью|ю|ия|ья|я)$/;
    var RU_DERIVATIONAL = /[^аеиоуыэюя]+[аеиоуыэюя].*ость?$/;
    var RU_SUPERLATIVE = /(ейш|ейше)$/;
    var RU_VOWELS = 'аеёиоуыэюя';

    function normalizeSearchText(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/[«»"“”„`']/g, ' ')
        .replace(/[_.,;:!?(){}\[\]|<>]+/g, ' ')
        .replace(/[^a-zа-я0-9%№\/+\-\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function splitSearchTerms(query, options) {
      var opts = options || {};
      var normalized = normalizeSearchText(query);
      if (!normalized) return [];
      var parts = normalized.split(' ');
      var terms = [];
      var minLength = Math.max(1, parseInt(opts.minLength, 10) || 1);
      var keepStopWords = opts.keepStopWords !== false;
      for (var i = 0; i < parts.length; i++) {
        var token = String(parts[i] || '').replace(/^[^a-zа-я0-9]+|[^a-zа-я0-9]+$/gi, '');
        if (!token) continue;
        var isNumeric = /^\d+$/.test(token);
        if (!isNumeric && token.length < minLength) continue;
        if (!keepStopWords && !isNumeric && SEARCH_STOP_WORDS[token]) continue;
        terms.push(token);
      }
      return terms;
    }

    function uniqueArray(values) {
      var seen = {};
      var result = [];
      for (var i = 0; i < (values || []).length; i++) {
        var item = values[i];
        if (!item || seen[item]) continue;
        seen[item] = true;
        result.push(item);
      }
      return result;
    }

    function isCyrillicToken(token) {
      return /[а-я]/i.test(String(token || ''));
    }

    function getRussianRvIndex(word) {
      var value = String(word || '');
      for (var i = 0; i < value.length; i++) {
        if (RU_VOWELS.indexOf(value.charAt(i)) !== -1) {
          return i + 1;
        }
      }
      return -1;
    }

    function stemRussianToken(token) {
      var value = String(token || '').toLowerCase().replace(/ё/g, 'е').trim();
      if (!value || value.length <= 3 || !isCyrillicToken(value)) {
        return value;
      }

      var rvIndex = getRussianRvIndex(value);
      if (rvIndex < 0 || rvIndex >= value.length) return value;
      var start = value.slice(0, rvIndex);
      var rv = value.slice(rvIndex);

      var replaced = rv.replace(RU_PERFECTIVEGROUND_1, '');
      if (replaced === rv) replaced = rv.replace(RU_PERFECTIVEGROUND_2, '$1');
      if (replaced !== rv) {
        rv = replaced;
      } else {
        rv = rv.replace(RU_REFLEXIVE, '');
        var adjectiveRemoved = rv.replace(RU_ADJECTIVE, '');
        if (adjectiveRemoved !== rv) {
          rv = adjectiveRemoved.replace(RU_PARTICIPLE_1, '$1').replace(RU_PARTICIPLE_2, '');
        } else {
          var verbRemoved = rv.replace(RU_VERB_1, '$1');
          if (verbRemoved === rv) verbRemoved = rv.replace(RU_VERB_2, '');
          if (verbRemoved !== rv) rv = verbRemoved;
          else rv = rv.replace(RU_NOUN, '');
        }
      }

      rv = rv.replace(/и$/, '');
      if (RU_DERIVATIONAL.test(rv)) {
        rv = rv.replace(/ость?$/, '');
      }
      if (/ь$/.test(rv)) {
        rv = rv.replace(/ь$/, '');
      } else {
        rv = rv.replace(RU_SUPERLATIVE, '').replace(/нн$/, 'н');
      }

      var stem = (start + rv).trim();
      return stem.length >= 3 ? stem : value;
    }

    function normalizeStemToken(token) {
      var normalized = normalizeSearchText(token);
      if (!normalized) return '';
      var stem = stemRussianToken(normalized);
      if (!stem) return normalized;
      if (stem.length >= 3) return stem;
      return normalized;
    }

    function buildTokenStems(tokens) {
      var stems = [];
      for (var i = 0; i < (tokens || []).length; i++) {
        var stem = normalizeStemToken(tokens[i]);
        if (!stem) continue;
        stems.push(stem);
      }
      return uniqueArray(stems);
    }

    function buildTokenChargrams(token) {
      var value = String(token || '').trim();
      if (!value) return [];
      if (value.length <= 2) return [value];
      var grams = [];
      var minGram = value.length >= 5 ? 3 : 2;
      var maxGram = Math.min(4, value.length);
      for (var n = minGram; n <= maxGram; n++) {
        for (var i = 0; i <= value.length - n; i++) {
          grams.push(value.slice(i, i + n));
        }
      }
      return uniqueArray(grams);
    }

    function buildTextChargramSet(tokens, maxSize) {
      var set = {};
      var limit = Math.max(32, parseInt(maxSize, 10) || 320);
      var added = 0;
      for (var i = 0; i < (tokens || []).length; i++) {
        var grams = buildTokenChargrams(tokens[i]);
        for (var g = 0; g < grams.length; g++) {
          var gram = grams[g];
          if (!gram || set[gram]) continue;
          set[gram] = 1;
          added += 1;
          if (added >= limit) return set;
        }
      }
      return set;
    }

    function computeChargramOverlapScore(queryGrams, targetGramSet) {
      if (!queryGrams || !queryGrams.length || !targetGramSet) return 0;
      var hits = 0;
      for (var i = 0; i < queryGrams.length; i++) {
        if (targetGramSet[queryGrams[i]]) hits += 1;
      }
      if (!hits) return 0;
      return hits / queryGrams.length;
    }

    function hasPrefixMatch(stems, queryStem) {
      var source = String(queryStem || '');
      if (!source || source.length < 2) return false;
      for (var i = 0; i < (stems || []).length; i++) {
        var candidate = stems[i];
        if (!candidate) continue;
        if (candidate.indexOf(source) === 0 || source.indexOf(candidate) === 0) return true;
      }
      return false;
    }

    function boundedLevenshteinDistance(a, b, maxDistance) {
      var left = String(a || '');
      var right = String(b || '');
      var threshold = Math.max(0, parseInt(maxDistance, 10) || 0);
      if (left === right) return 0;
      if (!left.length) return right.length;
      if (!right.length) return left.length;
      if (Math.abs(left.length - right.length) > threshold) return threshold + 1;

      var prev = [];
      var curr = [];
      for (var j = 0; j <= right.length; j++) {
        prev[j] = j;
      }
      for (var i = 1; i <= left.length; i++) {
        curr[0] = i;
        var rowMin = curr[0];
        for (var k = 1; k <= right.length; k++) {
          var cost = left.charAt(i - 1) === right.charAt(k - 1) ? 0 : 1;
          curr[k] = Math.min(
            prev[k] + 1,
            curr[k - 1] + 1,
            prev[k - 1] + cost
          );
          if (curr[k] < rowMin) rowMin = curr[k];
        }
        if (rowMin > threshold) return threshold + 1;
        var swap = prev;
        prev = curr;
        curr = swap;
      }
      return prev[right.length];
    }

    function bestFuzzyStemDistance(queryStem, candidates, maxDistance) {
      var token = String(queryStem || '');
      if (!token || token.length < 3) return maxDistance + 1;
      var threshold = Math.max(1, parseInt(maxDistance, 10) || 1);
      var best = threshold + 1;
      var firstChar = token.charAt(0);
      for (var i = 0; i < (candidates || []).length; i++) {
        var candidate = candidates[i];
        if (!candidate) continue;
        if (candidate.charAt(0) !== firstChar && token.length >= 4) continue;
        var dist = boundedLevenshteinDistance(token, candidate, threshold);
        if (dist < best) best = dist;
        if (best === 1) break;
      }
      return best;
    }

    function inferSearchEntityType(nodeType, title, body) {
      var sectionType = String(nodeType || '').toLowerCase();
      var source = normalizeSearchText((title || '') + ' ' + (body || ''));
      if (/(определен|термин|под\s+.*\s+понима|называется)/.test(source)) return 'definition';
      if (/(порядок|действи|выполня|производ|следует|необходимо|разрешается|запрещается)/.test(source)) {
        return 'procedure';
      }
      if (sectionType === 'point' || sectionType === 'subpoint' || sectionType === 'item') return 'rule';
      if (sectionType === 'chapter' || sectionType === 'section' || sectionType === 'subsection') return sectionType;
      return 'section';
    }

    function buildSearchQueryProfile(query) {
      var normalized = normalizeSearchText(query);
      var allTokens = splitSearchTerms(normalized, { minLength: 1, keepStopWords: true });
      var meaningfulTokens = splitSearchTerms(normalized, { minLength: 2, keepStopWords: false });
      var tokens = meaningfulTokens.length ? meaningfulTokens : allTokens;
      tokens = tokens.slice(0, 8);
      var stems = buildTokenStems(tokens);
      var tokenProfiles = [];
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        var stem = normalizeStemToken(token) || token;
        tokenProfiles.push({
          token: token,
          stem: stem,
          grams: buildTokenChargrams(stem || token)
        });
      }
      var wantsSpeedNorm = /(скорост|км\/?ч|кмч)/.test(normalized);
      var wantsDefinition = /(что такое|определен|термин|что значит)/.test(normalized);
      var wantsProcedure = /(что делать|как|порядок|действия|при\s)/.test(normalized);
      var wantsRule = wantsProcedure || /(должен|обязан|запрещ|разреш|можно|нельзя)/.test(normalized);
      var wantsNumericNorm = wantsSpeedNorm || /(норма|огранич|не более|не менее|максимум|минимум)/.test(normalized);

      var chargramSet = buildTextChargramSet(stems.length ? stems : tokens, 196);

      return {
        normalized: normalized,
        allTokens: allTokens,
        tokens: tokens,
        stems: stems,
        tokenProfiles: tokenProfiles,
        chargramSet: chargramSet,
        chargrams: Object.keys(chargramSet),
        wantsSpeedNorm: wantsSpeedNorm,
        wantsDefinition: wantsDefinition,
        wantsProcedure: wantsProcedure,
        wantsRule: wantsRule,
        wantsNumericNorm: wantsNumericNorm
      };
    }

    function escapeRegExpText(value) {
      return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function formatIsoDateLabel(isoString) {
      if (!isoString) return '';
      var date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function getInstructionsPreviewSeed() {
      return [
        {
          id: 'pte',
          title: 'ПТЭ',
          shortDescription: 'Правила технической эксплуатации железных дорог Российской Федерации',
          sortOrder: 0,
          nodes: []
        },
        {
          id: 'isi',
          title: 'ИСИ',
          shortDescription: 'Инструкция по сигнализации на железнодорожном транспорте',
          sortOrder: 1,
          nodes: []
        },
        {
          id: 'idp',
          title: 'ИДП',
          shortDescription: 'Инструкция по организации движения поездов и маневровой работы',
          sortOrder: 2,
          nodes: []
        }
      ];
    }

    function getInstructionOrderWeight(instruction) {
      var item = instruction || {};
      var explicitOrder = parseInt(item.sortOrder, 10);
      if (!isNaN(explicitOrder) && explicitOrder >= 0) return explicitOrder;

      var id = normalizeSearchText(item.id || '');
      if (id === 'pte') return 0;
      if (id === 'isi') return 1;
      if (id === 'idp') return 2;

      var title = normalizeSearchText(item.title || '');
      if (title === 'птэ') return 0;
      if (title === 'иси') return 1;
      if (title === 'идп') return 2;

      return 1000;
    }

    function sortInstructionsForDisplay(instructions) {
      var source = Array.isArray(instructions) ? instructions : [];
      if (!source.length) return [];
      var ordered = source.slice();
      ordered.sort(function(a, b) {
        var aWeight = getInstructionOrderWeight(a);
        var bWeight = getInstructionOrderWeight(b);
        if (aWeight !== bWeight) return aWeight - bWeight;
        if ((a.title || '') !== (b.title || '')) {
          return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
        }
        return String(a.id || '').localeCompare(String(b.id || ''), 'ru');
      });
      return ordered;
    }

    function normalizeInstructionNode(rawNode, instructionId, index) {
      var safe = rawNode || {};
      var nodeId = String(safe.id || (instructionId + '-node-' + (index + 1)));
      var rawContent = safe.content !== undefined && safe.content !== null
        ? String(safe.content)
        : String(safe.plainText || '');
      var plainText = safe.plainText !== undefined && safe.plainText !== null
        ? String(safe.plainText)
        : stripHtmlToText(rawContent);
      var normalizedType = String(safe.type || '').toLowerCase();
      if (
        normalizedType !== 'document' &&
        normalizedType !== 'chapter' &&
        normalizedType !== 'section' &&
        normalizedType !== 'subsection' &&
        normalizedType !== 'point' &&
        normalizedType !== 'subpoint' &&
        normalizedType !== 'item'
      ) {
        normalizedType = 'section';
      }
      var source = safe.source && typeof safe.source === 'object' ? safe.source : {};
      return {
        id: nodeId,
        instructionId: instructionId,
        parentId: safe.parentId !== undefined && safe.parentId !== null && String(safe.parentId)
          ? String(safe.parentId)
          : null,
        type: normalizedType,
        order: Math.max(0, parseInt(safe.order, 10) || 0),
        number: safe.number !== undefined && safe.number !== null ? String(safe.number) : '',
        title: String(safe.title || ('Раздел ' + (index + 1))),
        content: rawContent,
        plainText: String(plainText || '').replace(/\r\n/g, '\n').trim(),
        source: {
          url: source.url ? String(source.url) : (safe.sourceUrl ? String(safe.sourceUrl) : ''),
          path: source.path ? String(source.path) : '',
          fetchedAt: source.fetchedAt ? String(source.fetchedAt) : ''
        }
      };
    }

    function compareInstructionNodeOrder(a, b) {
      var aOrder = parseInt(a.order, 10) || 0;
      var bOrder = parseInt(b.order, 10) || 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if ((a.number || '') !== (b.number || '')) {
        return String(a.number || '').localeCompare(String(b.number || ''), 'ru');
      }
      return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
    }

    function flattenRawInstructionNodes(rawNodes, instructionId) {
      var source = Array.isArray(rawNodes) ? rawNodes : [];
      if (!source.length) return [];
      var out = [];
      var autoId = 0;

      function ensureRawNodeId(node, parentId, index) {
        if (node && node.id !== undefined && node.id !== null && String(node.id).trim()) {
          return String(node.id);
        }
        autoId += 1;
        var parentPart = parentId ? String(parentId) : (instructionId + '-document');
        return parentPart + '-auto-' + index + '-' + autoId;
      }

      function visit(list, parentId) {
        if (!Array.isArray(list)) return;
        for (var i = 0; i < list.length; i++) {
          var rawNode = list[i];
          if (!rawNode || typeof rawNode !== 'object') continue;
          var nodeId = ensureRawNodeId(rawNode, parentId, i + 1);
          var clone = {};
          var keys = Object.keys(rawNode);
          for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (key === 'children') continue;
            clone[key] = rawNode[key];
          }
          clone.id = nodeId;
          if (
            (clone.parentId === undefined || clone.parentId === null || clone.parentId === '') &&
            parentId
          ) {
            clone.parentId = parentId;
          }
          if (clone.order === undefined || clone.order === null || isNaN(parseInt(clone.order, 10))) {
            clone.order = i + 1;
          }
          out.push(clone);
          if (Array.isArray(rawNode.children) && rawNode.children.length) {
            visit(rawNode.children, nodeId);
          }
        }
      }

      visit(source, null);
      return out;
    }

    function normalizeInstructionsPayload(payload) {
      if (INSTRUCTIONS_CORE && typeof INSTRUCTIONS_CORE.parseCatalogPayload === 'function') {
        return INSTRUCTIONS_CORE.parseCatalogPayload(payload || {});
      }

      return {
        updatedAt: payload && payload.updatedAt ? String(payload.updatedAt) : new Date().toISOString(),
        version: payload && payload.version ? String(payload.version) : '1',
        instructions: []
      };
    }

    function getInstructionStructure(instruction) {
      var emptyStructure = {
        root: null,
        nodeById: {},
        childrenByParent: {},
        traversal: [],
        depthById: {}
      };
      if (!instruction || !Array.isArray(instruction.nodes) || !instruction.nodes.length) {
        return emptyStructure;
      }

      var cacheKey = instruction.nodes.length + '::' + (instruction.nodes[0].id || '') + '::' + (instruction.nodes[instruction.nodes.length - 1].id || '');
      if (instruction._nodeStructureCache && instruction._nodeStructureCache.key === cacheKey) {
        return instruction._nodeStructureCache.value;
      }

      var nodeById = {};
      for (var i = 0; i < instruction.nodes.length; i++) {
        nodeById[instruction.nodes[i].id] = instruction.nodes[i];
      }

      var root = null;
      for (var r = 0; r < instruction.nodes.length; r++) {
        if (instruction.nodes[r].type === 'document' && !instruction.nodes[r].parentId) {
          root = instruction.nodes[r];
          break;
        }
      }
      if (!root) {
        for (var rr = 0; rr < instruction.nodes.length; rr++) {
          if (!instruction.nodes[rr].parentId) {
            root = instruction.nodes[rr];
            break;
          }
        }
      }
      if (!root) root = instruction.nodes[0];

      var childrenByParent = {};
      for (var c = 0; c < instruction.nodes.length; c++) {
        var current = instruction.nodes[c];
        if (current.id === root.id) continue;
        var parentId = current.parentId && nodeById[current.parentId] ? current.parentId : root.id;
        if (!childrenByParent[parentId]) {
          childrenByParent[parentId] = [];
        }
        childrenByParent[parentId].push(current);
      }

      var parentKeys = Object.keys(childrenByParent);
      for (var pk = 0; pk < parentKeys.length; pk++) {
        childrenByParent[parentKeys[pk]].sort(compareInstructionNodeOrder);
      }

      var traversal = [];
      var depthById = {};
      function walk(node, depth, seen) {
        if (!node || seen[node.id]) return;
        seen[node.id] = true;
        depthById[node.id] = depth;
        traversal.push({
          node: node,
          depth: depth
        });
        var children = childrenByParent[node.id] || [];
        for (var j = 0; j < children.length; j++) {
          walk(children[j], depth + 1, seen);
        }
      }
      walk(root, 0, {});

      var result = {
        root: root,
        nodeById: nodeById,
        childrenByParent: childrenByParent,
        traversal: traversal,
        depthById: depthById
      };
      instruction._nodeStructureCache = {
        key: cacheKey,
        value: result
      };
      return result;
    }

    function getNodeSearchText(node) {
      if (!node) return '';
      var raw = node.plainText || '';
      if (!raw) raw = stripHtmlToText(node.content || '');
      return normalizeInstructionTextBlock(raw);
    }

    function buildPointAnswerText(node, structure) {
      if (!node) return '';
      var parts = [];

      function appendPointBlock(current, isRoot) {
        if (!current) return;
        var heading = formatInstructionNodeLabel(current, '').trim();
        var content = normalizeInstructionTextBlock(
          normalizeNodeContentForDisplay(current, { suppressDuplicateHeading: true }) || getNodeSearchText(current)
        );
        var block = '';
        if (isRoot) {
          if (heading) block = heading;
          if (content) {
            block += (block ? '\n' : '') + content;
          }
        } else {
          if (heading && content) block = heading + ' ' + content;
          else block = heading || content;
        }
        if (block) parts.push(block.trim());
        var children = (structure && structure.childrenByParent && structure.childrenByParent[current.id]) || [];
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (!child || (child.type !== 'point' && child.type !== 'subpoint' && child.type !== 'item')) continue;
          appendPointBlock(child, false);
        }
      }

      appendPointBlock(node, true);
      return normalizeInstructionTextBlock(parts.join('\n'));
    }

    function buildNodeAnswerText(node, structure) {
      if (!node) return '';
      var isPointLike = node.type === 'point' || node.type === 'subpoint' || node.type === 'item';
      if (isPointLike) {
        return buildPointAnswerText(node, structure);
      }

      var content = normalizeInstructionTextBlock(
        normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true }) || getNodeSearchText(node)
      );
      if (content) return content;
      return formatInstructionNodeLabel(node, '').trim();
    }

    function formatSearchNodeReference(sectionType, sectionNumber) {
      var number = String(sectionNumber || '').trim();
      if (!number) return '';
      var clean = number.replace(/\s+/g, ' ').replace(/\.$/, '');
      if (!clean) return '';
      if (sectionType === 'point' || sectionType === 'subpoint' || sectionType === 'item') {
        return 'п. ' + clean;
      }
      return clean;
    }

    function buildInstructionNodePath(instruction, node, structure) {
      if (!instruction || !node || !structure) return '';
      var path = [];
      var rootId = structure.root ? structure.root.id : '';
      var current = node;
      var guard = 0;
      while (current && guard < 28 && current.id !== rootId) {
        path.push(formatInstructionNodeLabel(current, current.title || 'Раздел'));
        if (!current.parentId || !structure.nodeById[current.parentId]) break;
        current = structure.nodeById[current.parentId];
        guard += 1;
      }
      path.reverse();
      return path.join(' > ');
    }

    function buildInstructionsSearchIndex(instructions) {
      if (INSTRUCTIONS_CORE && typeof INSTRUCTIONS_CORE.buildSearchEntities === 'function') {
        return INSTRUCTIONS_CORE.buildSearchEntities(instructions || []);
      }
      return [];
    }

    function readInstructionsCache() {
      var dbApi = INSTRUCTIONS_CORE && INSTRUCTIONS_CORE.instructionsDb;
      if (!dbApi || typeof dbApi.readDataset !== 'function') {
        return Promise.resolve({
          meta: {},
          instructions: [],
          searchDocs: []
        });
      }
      return dbApi.readDataset().then(function(payload) {
        return {
          meta: payload.meta || {},
          instructions: payload.instructions || [],
          searchDocs: payload.searchEntities || []
        };
      }).catch(function() {
        return {
          meta: {},
          instructions: [],
          searchDocs: []
        };
      });
    }

    function saveInstructionsCache(payload) {
      var dbApi = INSTRUCTIONS_CORE && INSTRUCTIONS_CORE.instructionsDb;
      if (!dbApi || typeof dbApi.writeDataset !== 'function') {
        return Promise.resolve(false);
      }
      return dbApi.writeDataset({
        meta: payload.meta || {},
        instructions: payload.instructions || [],
        searchEntities: payload.searchDocs || []
      }).then(function(result) {
        return !!result;
      }).catch(function() {
        return false;
      });
    }

    function processInstructionsDataset(payload) {
      var source = payload || {};
      var meta = source.meta || {};
      var instructions = sortInstructionsForDisplay(source.instructions || []);
      var rawSearchDocs = Array.isArray(source.searchDocs) ? source.searchDocs : [];
      var searchDocs = rawSearchDocs.length
        ? rawSearchDocs.slice()
        : buildInstructionsSearchIndex(instructions);

      return {
        meta: meta,
        instructions: instructions,
        searchDocs: searchDocs
      };
    }

    function hydrateInstructionsState(payload, sourceLabel) {
      var processed = processInstructionsDataset(payload);
      var instructions = processed.instructions;
      var searchDocs = processed.searchDocs;
      var meta = processed.meta;
      instructionsStore.instructions = instructions;
      instructionsStore.searchDocs = searchDocs;
      instructionsStore.preparedSearchDocs = [];
      instructionsStore.preparedSearchDocsKey = '';
      instructionsStore.searchAnswer = null;
      if (INSTRUCTIONS_CORE && typeof INSTRUCTIONS_CORE.resetPreparedSearchEntitiesCache === 'function') {
        INSTRUCTIONS_CORE.resetPreparedSearchEntitiesCache();
      }
      instructionsStore.hasCache = instructions.length > 0;
      instructionsStore.dataSource = sourceLabel || 'cache';
      instructionsStore.lastUpdated = meta.updatedAt || '';
      if (normalizeSearchText(instructionsStore.searchQuery)) {
        instructionsStore.searchResults = performInstructionsSearch(instructionsStore.searchQuery);
        instructionsStore.searchAnswer = instructionsStore.searchResults.length ? instructionsStore.searchResults[0] : null;
      } else {
        instructionsStore.searchResults = [];
        instructionsStore.searchAnswer = null;
      }
      if (instructionsStore.status !== 'error') {
        instructionsStore.status = instructions.length ? 'ready' : instructionsStore.status;
      }
      if (!findInstructionById(instructionsStore.selectedInstructionId)) {
        instructionsStore.selectedInstructionId = '';
        instructionsStore.selectedSectionId = '';
        if (instructionsStore.view !== 'list') {
          instructionsStore.view = 'list';
        }
      }
    }

    function fetchInstructionsFromNetwork() {
      return fetch(INSTRUCTIONS_DATA_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      }).then(function(response) {
        if (!response.ok) {
          throw new Error('Не удалось загрузить инструкции');
        }
        return response.json();
      }).then(function(payload) {
        return normalizeInstructionsPayload(payload);
      });
    }

    function ensureInstructionsReady(forceRefresh, silent) {
      if (instructionsStore.loadPromise) return instructionsStore.loadPromise;

      var shouldForce = !!forceRefresh;
      if (!silent && (!instructionsStore.instructions.length || shouldForce)) {
        instructionsStore.status = 'loading';
        instructionsStore.errorMessage = '';
        renderInstructionsScreen();
      }

      instructionsStore.loadPromise = readInstructionsCache()
        .then(function(cachePayload) {
          if (cachePayload && Array.isArray(cachePayload.instructions) && cachePayload.instructions.length) {
            hydrateInstructionsState(cachePayload, 'cache');
            if (!silent) renderInstructionsScreen();
          }

          if (!navigator.onLine) {
            if (!instructionsStore.instructions.length) {
              instructionsStore.status = 'offline';
              instructionsStore.errorMessage = 'Нет сети и локальная база ещё не загружена.';
            }
            return null;
          }

          return fetchInstructionsFromNetwork()
            .then(function(networkPayload) {
              var instructions = networkPayload.instructions || [];
              var searchDocs = buildInstructionsSearchIndex(instructions);
              var meta = {
                updatedAt: networkPayload.updatedAt || new Date().toISOString(),
                version: networkPayload.version || '1'
              };
              instructionsStore.status = instructions.length ? 'ready' : 'error';
              instructionsStore.errorMessage = instructions.length ? '' : 'Не удалось подготовить инструкции.';
              hydrateInstructionsState({
                meta: meta,
                instructions: instructions,
                searchDocs: searchDocs
              }, 'network');
              saveInstructionsCache({
                meta: meta,
                instructions: instructions,
                searchDocs: searchDocs
              });
            })
            .catch(function(err) {
              if (!instructionsStore.instructions.length) {
                instructionsStore.status = navigator.onLine ? 'error' : 'offline';
                instructionsStore.errorMessage = err && err.message ? err.message : 'Не удалось загрузить инструкции.';
              } else {
                instructionsStore.status = 'ready';
              }
            });
        })
        .catch(function(err) {
          if (!instructionsStore.instructions.length) {
            instructionsStore.status = 'error';
            instructionsStore.errorMessage = err && err.message ? err.message : 'Ошибка чтения локальной базы.';
          }
        })
        .finally(function() {
          instructionsStore.loadPromise = null;
          renderInstructionsScreen();
        });

      return instructionsStore.loadPromise;
    }

    function findInstructionById(instructionId) {
      if (!instructionId) return null;
      for (var i = 0; i < instructionsStore.instructions.length; i++) {
        if (instructionsStore.instructions[i].id === instructionId) {
          return instructionsStore.instructions[i];
        }
      }
      return null;
    }

    function normalizeInstructionAlias(value) {
  var raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'pte' || raw === 'птэ') return 'pte';
  if (raw === 'isi' || raw === 'иси') return 'isi';
  if (raw === 'idp' || raw === 'идп') return 'idp';
  return raw;
}

function normalizeInstructionNodeNumber(value) {
  return String(value || '')
    .trim()
    .replace(/[.)]+$/g, '')
    .replace(/\s+/g, '');
}

function findInstructionByAlias(alias) {
  var normalized = normalizeInstructionAlias(alias);
  if (!normalized) return null;

  for (var i = 0; i < instructionsStore.instructions.length; i++) {
    var instruction = instructionsStore.instructions[i];
    if (!instruction) continue;

    var byId = normalizeInstructionAlias(instruction.id);
    var byTitle = normalizeInstructionAlias(instruction.title);

    if (byId === normalized || byTitle === normalized) {
      return instruction;
    }
  }

  return null;
}

function findInstructionNodeByNumber(instruction, targetNumber) {
  if (!instruction || !targetNumber) return null;
  var structure = getInstructionStructure(instruction);
  var wanted = normalizeInstructionNodeNumber(targetNumber);
  if (!wanted) return null;

  for (var i = 0; i < instruction.nodes.length; i++) {
    var node = instruction.nodes[i];
    if (!node) continue;
    var nodeNumber = normalizeInstructionNodeNumber(node.number);
    if (nodeNumber === wanted) {
      return node;
    }
  }

  return null;
}

function buildInstructionRefButtonHtml(label, instructionAlias, targetNumber) {
  return '<button class="instruction-inline-link" type="button" data-action="open-ref" data-instruction-id="' +
    escapeHtml(String(instructionAlias || '')) +
    '" data-target-number="' +
    escapeHtml(String(targetNumber || '')) +
    '">' +
    escapeHtml(String(label || '')) +
    '</button>';
}

function linkifyInstructionReferences(text) {
  var source = String(text || '');
  if (!source) return '';

  var re = /\b((?:п\.|пункт)\s*)(\d+(?:\.\d+)*)(\.?)(\s+)(ПТЭ|ИСИ|ИДП)\b/gi;
  var html = '';
  var lastIndex = 0;
  var match;

  while ((match = re.exec(source))) {
    html += escapeHtml(source.slice(lastIndex, match.index));

    var label = match[0];
    var targetNumber = match[2];
    var instructionAlias = normalizeInstructionAlias(match[5]);

    html += buildInstructionRefButtonHtml(label, instructionAlias, targetNumber);
    lastIndex = re.lastIndex;
  }

  html += escapeHtml(source.slice(lastIndex));
  return html.replace(/\n/g, '<br />');
}

function formatInstructionNodeContentHtml(node, options) {
  var opts = options || {};
  if (!node) {
    return '<p class="instruction-paragraph instruction-paragraph--muted">Текст раздела пока недоступен.</p>';
  }

  var blocks = Array.isArray(node.contentBlocks) ? node.contentBlocks : [];
  if (!blocks.length) {
    return formatInstructionContentHtml(node.content || node.plainText || '', opts);
  }

  var isTruncated = false;
  if (opts.maxParagraphs && blocks.length > opts.maxParagraphs) {
    blocks = blocks.slice(0, opts.maxParagraphs);
    isTruncated = true;
  }

  var html = [];
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (!block) continue;

    if (block.type === 'point') {
      html.push(
        '<p class="instruction-paragraph instruction-paragraph--point">' +
          '<span class="instruction-point-number">' + escapeHtml(String(block.number || '')) + '</span> ' +
          '<span class="instruction-point-text">' + linkifyInstructionReferences(String(block.text || '')) + '</span>' +
        '</p>'
      );
      continue;
    }

    html.push(
      '<p class="instruction-paragraph">' +
        linkifyInstructionReferences(String(block.text || '')) +
      '</p>'
    );
  }

  if (isTruncated || opts.forceHint) {
    html.push('<p class="instruction-paragraph instruction-paragraph--hint">Откройте нужный пункт ниже, чтобы увидеть полный текст без перегруза.</p>');
  }

  return html.join('');
}

function openInstructionReference(instructionAlias, targetNumber) {
  var instruction = findInstructionByAlias(instructionAlias);
  if (!instruction) return;

  var targetNode = findInstructionNodeByNumber(instruction, targetNumber);
  if (targetNode) {
    openInstructionSection(instruction.id, targetNode.id);
    return;
  }

  openInstructionDetail(instruction.id);
}
    function findInstructionNodeById(instruction, nodeId) {
      if (!instruction || !nodeId) return null;
      var structure = getInstructionStructure(instruction);
      return structure.nodeById[nodeId] || null;
    }

    // ── Presentation Layer Helpers ────────────────────────────────────────────

    // Renders a list of previewLines as an emoji-annotated norm list.
    // query is optional — used for highlight, pass '' when not in search context.
    function buildNormListHtml(previewLines, query) {
      if (!previewLines || !previewLines.length) return '';
      var html = '<ul class="instruction-norm-list">';
      for (var i = 0; i < previewLines.length; i++) {
        var line = previewLines[i];
        var markerHtml = escapeHtml(String(line.marker || ''));
        var textHtml = query
          ? highlightSearchText(String(line.text || ''), query)
          : escapeHtml(String(line.text || ''));
        html += '<li class="instruction-norm-item">' +
          '<span class="instruction-norm-marker">' + markerHtml + '</span>' +
          '<span class="instruction-norm-text">' + textHtml + '</span>' +
          '</li>';
      }
      html += '</ul>';
      return html;
    }

    // Renders extracted footnotes as a "Примечания" block.
    function buildFootnotesHtml(footnotes) {
      if (!footnotes || !footnotes.length) return '';
      var html = '<div class="instruction-footnotes">' +
        '<div class="instruction-footnotes-label">Примечания</div>' +
        '<ul class="instruction-footnotes-list">';
      for (var i = 0; i < footnotes.length; i++) {
        var fn = footnotes[i];
        html += '<li class="instruction-footnote-item">' +
          '<span class="instruction-footnote-marker">' + escapeHtml(String(fn.marker || '')) + '</span>' +
          '<span class="instruction-footnote-text">' + escapeHtml(String(fn.text || '')) + '</span>' +
          '</li>';
      }
      html += '</ul></div>';
      return html;
    }

    // ── End Presentation Layer Helpers ────────────────────────────────────────

    function formatInstructionNodeLabel(node, fallbackTitle) {
      var title = String((node && node.title) || fallbackTitle || '').trim();
      var number = String((node && node.number) || '').trim();
      if (!number) return title;
      if (!title) return number;
      if (/^приложение/i.test(number) || /^[ivxlcdm]+$/i.test(number) || /^\d+(\.\d+)*$/.test(number)) {
        return number + '. ' + title;
      }
      return number + ' ' + title;
    }

    function getInstructionNodeTypeLabel(type) {
      if (type === 'document') return 'документ';
      if (type === 'chapter') return 'глава';
      if (type === 'section') return 'раздел';
      if (type === 'subsection') return 'раздел';
      if (type === 'point') return 'пункт';
      if (type === 'subpoint') return 'подпункт';
      if (type === 'item') return 'элемент';
      return '';
    }

    function splitTextIntoSearchLines(text) {
      var source = normalizeInstructionTextBlock(text);
      if (!source) return [];
      var rawLines = source.split('\n');
      var lines = [];
      for (var i = 0; i < rawLines.length; i++) {
        var line = String(rawLines[i] || '').replace(/\s+/g, ' ').trim();
        if (!line) continue;
        lines.push(line);
      }
      return lines;
    }

    function buildSearchSnippet(text, queryTerms, options) {
      var opts = options || {};
      var minLines = Math.max(2, Math.min(5, parseInt(opts.minLines, 10) || 2));
      var maxLines = Math.max(minLines, Math.min(8, parseInt(opts.maxLines, 10) || 5));
      var lines = splitTextIntoSearchLines(text);
      if (!lines.length) return '';
      if (lines.length <= maxLines) {
        return lines.join('\n');
      }

      var matchLineIndex = -1;
      for (var i = 0; i < lines.length; i++) {
        var lineNorm = normalizeSearchText(lines[i]);
        for (var t = 0; t < queryTerms.length; t++) {
          if (lineNorm.indexOf(queryTerms[t]) !== -1) {
            matchLineIndex = i;
            break;
          }
        }
        if (matchLineIndex !== -1) break;
      }

      var start = 0;
      if (matchLineIndex > 0) {
        start = Math.max(0, matchLineIndex - 1);
      }
      var end = Math.min(lines.length, start + maxLines);
      if ((end - start) < minLines) {
        start = Math.max(0, end - minLines);
      }
      return lines.slice(start, end).join('\n');
    }

    function highlightSearchText(text, query) {
      var terms = splitSearchTerms(query);
      if (!terms.length) return escapeHtml(text);
      var html = escapeHtml(text);
      for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        if (term.length < 2) continue;
        var rx = new RegExp('(' + escapeRegExpText(term) + ')', 'gi');
        html = html.replace(rx, '<mark class="search-highlight">$1</mark>');
      }
      return html;
    }

    function createTokenLookup(tokens) {
      var lookup = {};
      for (var i = 0; i < (tokens || []).length; i++) {
        var token = tokens[i];
        if (!token) continue;
        lookup[token] = 1;
      }
      return lookup;
    }

    function mergeTokenLookups(target, source) {
      var out = target || {};
      var keys = Object.keys(source || {});
      for (var i = 0; i < keys.length; i++) {
        out[keys[i]] = 1;
      }
      return out;
    }

    function getPreparedSearchDocsKey(searchDocs) {
      if (!searchDocs || !searchDocs.length) return 'empty';
      var first = searchDocs[0];
      var last = searchDocs[searchDocs.length - 1];
      return [
        searchDocs.length,
        first ? (first.id || '') : '',
        last ? (last.id || '') : '',
        first ? (first.searchVersion || '0') : '0'
      ].join('::');
    }

    function prepareSearchDoc(doc) {
      var titleText = normalizeInstructionTextBlock(
        [
          doc.instructionTitle || '',
          doc.sectionTitle || '',
          doc.sectionRef || ''
        ].join(' ')
      );
      var pathText = normalizeInstructionTextBlock(doc.path || '');
      var bodyText = normalizeInstructionTextBlock(doc.body || doc.answerText || doc.text || '');
      var titleTokens = splitSearchTerms(titleText, { minLength: 1, keepStopWords: true });
      var pathTokens = splitSearchTerms(pathText, { minLength: 1, keepStopWords: true });
      var bodyTokens = splitSearchTerms(bodyText, { minLength: 1, keepStopWords: true });
      var titleStems = buildTokenStems(titleTokens);
      var pathStems = buildTokenStems(pathTokens);
      var bodyStems = buildTokenStems(bodyTokens);
      var allTokens = uniqueArray(titleTokens.concat(pathTokens, bodyTokens));
      var allStems = uniqueArray(titleStems.concat(pathStems, bodyStems));
      var titleTokenLookup = createTokenLookup(titleTokens);
      var bodyTokenLookup = createTokenLookup(bodyTokens);
      var pathTokenLookup = createTokenLookup(pathTokens);
      var titleStemLookup = createTokenLookup(titleStems);
      var bodyStemLookup = createTokenLookup(bodyStems);
      var pathStemLookup = createTokenLookup(pathStems);

      return {
        raw: doc,
        instructionId: doc.instructionId,
        instructionTitle: doc.instructionTitle || '',
        sectionId: doc.sectionId,
        sectionTitle: doc.sectionTitle || '',
        sectionRef: doc.sectionRef || '',
        sectionType: doc.sectionType || '',
        entityType: doc.entityType || inferSearchEntityType(doc.sectionType, doc.sectionTitle, bodyText),
        isPointLike: !!doc.isPointLike,
        depth: parseInt(doc.depth, 10) || 0,
        path: pathText,
        titleText: titleText,
        bodyText: bodyText,
        answerText: normalizeInstructionTextBlock(doc.answerText || bodyText),
        titleNormalized: normalizeSearchText(titleText),
        pathNormalized: normalizeSearchText(pathText),
        bodyNormalized: normalizeSearchText(bodyText),
        normalized: normalizeSearchText([titleText, pathText, bodyText].join(' ')),
        titleTokens: titleTokens,
        pathTokens: pathTokens,
        bodyTokens: bodyTokens,
        titleStems: titleStems,
        pathStems: pathStems,
        bodyStems: bodyStems,
        allTokens: allTokens,
        allStems: allStems,
        titleTokenLookup: titleTokenLookup,
        bodyTokenLookup: bodyTokenLookup,
        pathTokenLookup: pathTokenLookup,
        titleStemLookup: titleStemLookup,
        bodyStemLookup: bodyStemLookup,
        pathStemLookup: pathStemLookup,
        allTokenLookup: mergeTokenLookups(mergeTokenLookups({}, createTokenLookup(allTokens)), createTokenLookup(allStems)),
        titleGramSet: buildTextChargramSet(uniqueArray(titleStems.concat(titleTokens)), 220),
        pathGramSet: buildTextChargramSet(uniqueArray(pathStems.concat(pathTokens)), 180),
        bodyGramSet: buildTextChargramSet(uniqueArray(bodyStems.concat(bodyTokens)), 380),
        allGramSet: buildTextChargramSet(uniqueArray(allStems.concat(allTokens)), 520),
        fuzzyStemCandidates: uniqueArray(titleStems.concat(pathStems, bodyStems)).slice(0, 240),
        hasNumericNorm: !!doc.hasNumericNorm || /\b\d{1,3}\s*(?:км\/ч|кмч|км ч|процент|%|мм|м|ч)\b/.test(normalizeSearchText(bodyText)),
        hasSpeedNorm: !!doc.hasSpeedNorm || /\b\d{1,3}\s*(?:км\/ч|кмч|км ч)\b/.test(normalizeSearchText(bodyText))
      };
    }

    function ensurePreparedSearchDocs() {
      var key = getPreparedSearchDocsKey(instructionsStore.searchDocs);
      if (
        instructionsStore.preparedSearchDocsKey === key &&
        instructionsStore.preparedSearchDocs &&
        instructionsStore.preparedSearchDocs.length === instructionsStore.searchDocs.length
      ) {
        return instructionsStore.preparedSearchDocs;
      }

      var prepared = [];
      for (var i = 0; i < instructionsStore.searchDocs.length; i++) {
        prepared.push(prepareSearchDoc(instructionsStore.searchDocs[i]));
      }
      instructionsStore.preparedSearchDocs = prepared;
      instructionsStore.preparedSearchDocsKey = key;
      return prepared;
    }

    function scoreQueryTokenAgainstDoc(doc, tokenProfile) {
      var token = tokenProfile.token;
      var stem = tokenProfile.stem || token;
      var grams = tokenProfile.grams || [];
      var isNumeric = /^\d+$/.test(token);

      if (doc.titleTokenLookup[token] || doc.titleStemLookup[stem]) {
        return { matched: true, score: 320, bucket: 'title_exact', strong: true, title: true };
      }
      if (doc.pathTokenLookup[token] || doc.pathStemLookup[stem]) {
        return { matched: true, score: 260, bucket: 'path_exact', strong: true, title: true };
      }
      if (doc.bodyTokenLookup[token] || doc.bodyStemLookup[stem]) {
        return { matched: true, score: 190, bucket: 'body_exact', strong: true, title: false };
      }

      if (!isNumeric && stem.length >= 2) {
        if (hasPrefixMatch(doc.titleStems, stem) || hasPrefixMatch(doc.pathStems, stem)) {
          return { matched: true, score: 180, bucket: 'title_prefix', strong: true, title: true };
        }
        if (hasPrefixMatch(doc.bodyStems, stem)) {
          return { matched: true, score: 130, bucket: 'body_prefix', strong: false, title: false };
        }
      }

      if (grams.length) {
        var titleGramScore = Math.max(
          computeChargramOverlapScore(grams, doc.titleGramSet),
          computeChargramOverlapScore(grams, doc.pathGramSet)
        );
        var bodyGramScore = computeChargramOverlapScore(grams, doc.bodyGramSet);
        if (titleGramScore >= 0.62) {
          return { matched: true, score: Math.round(120 + titleGramScore * 90), bucket: 'title_fuzzy', strong: false, title: true };
        }
        if (bodyGramScore >= 0.62) {
          return { matched: true, score: Math.round(90 + bodyGramScore * 70), bucket: 'body_fuzzy', strong: false, title: false };
        }
      }

      if (!isNumeric && stem.length >= 4) {
        var maxDistance = stem.length >= 7 ? 2 : 1;
        var bestDist = bestFuzzyStemDistance(stem, doc.fuzzyStemCandidates, maxDistance);
        if (bestDist <= maxDistance) {
          return {
            matched: true,
            score: bestDist === 1 ? 95 : 70,
            bucket: 'edit_fuzzy',
            strong: false,
            title: false
          };
        }
      }

      return { matched: false, score: 0, bucket: 'none', strong: false, title: false };
    }

    function getQueryProximityScore(doc, queryProfile) {
      var stems = queryProfile.stems || [];
      if (stems.length < 2) return 0;
      var body = doc.bodyNormalized || '';
      if (!body) return 0;
      var positions = [];
      for (var i = 0; i < stems.length && i < 5; i++) {
        var idx = body.indexOf(stems[i]);
        if (idx >= 0) positions.push(idx);
      }
      if (positions.length < 2) return 0;
      positions.sort(function(a, b) { return a - b; });
      var span = positions[positions.length - 1] - positions[0];
      if (span <= 100) return 160;
      if (span <= 220) return 110;
      if (span <= 360) return 55;
      return 20;
    }

    function evaluatePreparedSearchDoc(doc, queryProfile) {
      var tokenProfiles = queryProfile.tokenProfiles || [];
      if (!tokenProfiles.length) return null;

      var score = 0;
      var matchedTokens = 0;
      var strongMatches = 0;
      var titleMatches = 0;
      var fuzzyMatches = 0;

      for (var i = 0; i < tokenProfiles.length; i++) {
        var tokenResult = scoreQueryTokenAgainstDoc(doc, tokenProfiles[i]);
        if (!tokenResult.matched) continue;
        matchedTokens += 1;
        score += tokenResult.score;
        if (tokenResult.strong) strongMatches += 1;
        if (tokenResult.title) titleMatches += 1;
        if (tokenResult.bucket.indexOf('fuzzy') !== -1) fuzzyMatches += 1;
      }

      var coverage = matchedTokens / tokenProfiles.length;
      if (tokenProfiles.length <= 2 && matchedTokens === 0) return null;
      if (tokenProfiles.length >= 3 && coverage < 0.45 && strongMatches === 0) {
        var gramCoverage = computeChargramOverlapScore(queryProfile.chargrams || [], doc.allGramSet);
        if (gramCoverage < 0.4) return null;
        score += Math.round(gramCoverage * 120);
      }

      var normalizedQuery = queryProfile.normalized || '';
      var phraseInTitle = normalizedQuery.length >= 3 && doc.titleNormalized.indexOf(normalizedQuery) !== -1;
      var phraseInPath = normalizedQuery.length >= 3 && doc.pathNormalized.indexOf(normalizedQuery) !== -1;
      var phraseInBodyIndex = normalizedQuery.length >= 3 ? doc.bodyNormalized.indexOf(normalizedQuery) : -1;

      if (phraseInTitle) score += 520;
      if (phraseInPath) score += 360;
      if (phraseInBodyIndex === 0) score += 330;
      else if (phraseInBodyIndex > 0) score += Math.max(130, 290 - Math.min(phraseInBodyIndex, 320));

      score += Math.round(coverage * 380);
      score += strongMatches * 70;
      score += titleMatches * 95;
      score -= fuzzyMatches * 6;
      score += getQueryProximityScore(doc, queryProfile);

      if (queryProfile.wantsSpeedNorm && doc.hasSpeedNorm) score += 230;
      if (queryProfile.wantsNumericNorm && doc.hasNumericNorm) score += 150;
      if (queryProfile.wantsDefinition && doc.entityType === 'definition') score += 190;
      if (queryProfile.wantsProcedure && doc.entityType === 'procedure') score += 140;
      if (queryProfile.wantsRule && (doc.entityType === 'rule' || doc.entityType === 'procedure')) score += 120;
      if (doc.isPointLike) score += 55;

      var headingTokenCoverage = tokenProfiles.length
        ? (titleMatches / tokenProfiles.length)
        : 0;
      var confidence = Math.max(0, Math.min(1,
        coverage * 0.52 +
        Math.min(0.3, strongMatches * 0.1) +
        Math.min(0.18, headingTokenCoverage * 0.3) +
        (phraseInTitle ? 0.2 : 0) +
        (phraseInBodyIndex >= 0 ? 0.08 : 0)
      ));
      var shouldShowFullByHeading = !!(doc.isPointLike && (phraseInTitle || titleMatches >= Math.max(1, Math.ceil(tokenProfiles.length * 0.5))));
      var snippet = buildSearchSnippet(doc.answerText || doc.bodyText || '', queryProfile.tokens, { minLines: 2, maxLines: 5 });

      return {
        instructionId: doc.instructionId,
        instructionTitle: doc.instructionTitle,
        sectionId: doc.sectionId,
        sectionTitle: doc.sectionTitle,
        sectionRef: doc.sectionRef || formatSearchNodeReference(doc.sectionType || '', ''),
        sectionType: doc.sectionType || '',
        entityType: doc.entityType || '',
        isPointLike: doc.isPointLike,
        path: doc.path || '',
        answerText: doc.answerText || doc.bodyText || '',
        answerIncludesHeading: doc.isPointLike,
        snippet: snippet,
        score: score,
        confidence: confidence,
        shouldShowFullByHeading: shouldShowFullByHeading,
        matchedTokens: matchedTokens,
        coverage: coverage,
        depth: doc.depth || 0,
        textIndex: phraseInBodyIndex < 0 ? 9999 : phraseInBodyIndex
      };
    }

    function markExpandedAnswerResults(results) {
      var expandedCount = 0;
      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        var isStrongAnswer = !!(
          item.shouldShowFullByHeading ||
          item.confidence >= 0.67 ||
          (item.coverage >= 0.72 && item.score >= 900)
        );
        var isExpandedAnswer = false;
        if (item.shouldShowFullByHeading) {
          isExpandedAnswer = true;
        } else if (expandedCount < 3 && isStrongAnswer) {
          isExpandedAnswer = true;
        } else if (expandedCount === 0 && i === 0) {
          isExpandedAnswer = true;
        }
        if (isExpandedAnswer) expandedCount += 1;
        item.isExpandedAnswer = isExpandedAnswer;
        item.displayText = isExpandedAnswer
          ? (item.answerText || item.snippet || item.sectionTitle || '')
          : (item.snippet || item.answerText || item.sectionTitle || '');
      }
      return results;
    }

    function performInstructionsSearch(query) {
      if (!INSTRUCTIONS_CORE || typeof INSTRUCTIONS_CORE.searchInstructions !== 'function') {
        return [];
      }
      var results = INSTRUCTIONS_CORE.searchInstructions(
        query,
        instructionsStore.searchDocs || [],
        { limit: 40 }
      );
      return Array.isArray(results) ? results : [];
    }

    function setInstructionsSearchQuery(query) {
      instructionsStore.searchQuery = String(query || '');
      instructionsStore.view = 'list';
      if (instructionsStore.searchTimer) {
        window.clearTimeout(instructionsStore.searchTimer);
      }

      var normalizedQuery = normalizeSearchText(instructionsStore.searchQuery);
      if (!normalizedQuery) {
        instructionsStore.searchResults = [];
        instructionsStore.searchAnswer = null;
        renderInstructionsScreen();
        return;
      }

      instructionsStore.searchTimer = window.setTimeout(function() {
        instructionsStore.searchResults = performInstructionsSearch(instructionsStore.searchQuery);
        instructionsStore.searchAnswer = instructionsStore.searchResults.length ? instructionsStore.searchResults[0] : null;
        renderInstructionsScreen();
      }, 190);
    }

    function toDomSafeId(value) {
      return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    function normalizeInstructionParagraphs(content) {
      var text = String(content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      if (!text) return [];

      var chunks = text.split(/\n{2,}/);
      var paragraphs = [];
      for (var i = 0; i < chunks.length; i++) {
        var paragraph = String(chunks[i] || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
        if (!paragraph) continue;
        if (/^[-=_—–]{6,}$/.test(paragraph)) continue;
        paragraphs.push(paragraph);
      }
      return paragraphs;
    }

    function formatInstructionContentHtml(content, options) {
      var opts = options || {};
      var paragraphs = normalizeInstructionParagraphs(content);
      if (!paragraphs.length) {
        return '<p class="instruction-paragraph instruction-paragraph--muted">Текст раздела пока недоступен.</p>';
      }

      var isTruncated = false;
      if (opts.maxParagraphs && paragraphs.length > opts.maxParagraphs) {
        paragraphs = paragraphs.slice(0, opts.maxParagraphs);
        isTruncated = true;
      }

      var html = [];
      for (var i = 0; i < paragraphs.length; i++) {
        var paragraph = paragraphs[i];
        var classes = ['instruction-paragraph'];
        var pointMatch = paragraph.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.*)$/);

        if (pointMatch) {
          classes.push('instruction-paragraph--point');
          var numberLabel = escapeHtml(pointMatch[1] + '.');
          var pointBody = escapeHtml(pointMatch[2]).replace(/\n/g, '<br />');
          html.push(
            '<p class="' + classes.join(' ') + '">' +
              '<span class="instruction-point-number">' + numberLabel + '</span> ' +
              '<span class="instruction-point-text">' + pointBody + '</span>' +
            '</p>'
          );
          continue;
        }

        if (/^(?:Приложение\s+N\s*\d+|[IVXLCDM]+\.)/i.test(paragraph)) {
          classes.push('instruction-paragraph--heading');
        }
        html.push('<p class="' + classes.join(' ') + '">' + escapeHtml(paragraph).replace(/\n/g, '<br />') + '</p>');
      }

      if (isTruncated || opts.forceHint) {
        html.push('<p class="instruction-paragraph instruction-paragraph--hint">Откройте нужный пункт ниже, чтобы увидеть полный текст без перегруза.</p>');
      }

      return html.join('');
    }

    function scrollToInstructionNodeAnchor(sectionId) {
      var targetId = 'instruction-anchor-' + toDomSafeId(sectionId);
      var target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function normalizeNodeContentForDisplay(node, options) {
      var opts = options || {};
      if (!node) return '';
      var text = String(node.content || node.plainText || '').trim();
      if (!text) return '';

      var headingLabel = formatInstructionNodeLabel(node, '').trim();
      var titleOnly = String(node.title || '').trim();
      var textNorm = normalizeSearchText(text);
      var headingNorm = normalizeSearchText(headingLabel);
      var titleNorm = normalizeSearchText(titleOnly);

      if (opts.suppressDuplicateHeading) {
        if (titleNorm && textNorm === titleNorm) return '';
        if (headingNorm && textNorm === headingNorm) return '';
      }
      return text;
    }

    function buildPointLineText(node) {
      if (!node) return '';
      var number = String(node.number || '').trim();
      var body = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
      var fallback = String(node.title || '').trim();
      if (!body) body = fallback;
      if (!body && number) return number;
      if (!body) return '';
      var bodyNorm = normalizeSearchText(body);
      var numberNorm = normalizeSearchText(number);
      if (!number) return body;
      if (bodyNorm === numberNorm || bodyNorm.indexOf(numberNorm + ' ') === 0) {
        return body;
      }
      return number + ' ' + body;
    }

    function appendInlineChildPointLines(node, structure, out, includeSelfHeading) {
      if (!node || !structure || !out) return;

      if (includeSelfHeading) {
        var heading = formatInstructionNodeLabel(node, '').trim();
        var ownContent = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
        if (ownContent) {
          var ownNorm = normalizeSearchText(ownContent);
          var headingNorm = normalizeSearchText(heading);
          if (headingNorm && ownNorm.indexOf(headingNorm) === 0) {
            out.push(ownContent);
          } else if (heading) {
            out.push(heading + '\n' + ownContent);
          } else {
            out.push(ownContent);
          }
        } else if (heading) {
          out.push(heading);
        }
      } else {
        var pointLine = buildPointLineText(node);
        if (pointLine) out.push(pointLine);
      }

      var children = (structure.childrenByParent && structure.childrenByParent[node.id]) || [];
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (!child || !isInlineChildNode(child)) continue;
        appendInlineChildPointLines(child, structure, out, false);
      }
    }

    function buildPointContentWithInlineChildren(node, structure) {
      if (!node || !structure || !isPointLikeNode(node)) return '';
      var lines = [];
      appendInlineChildPointLines(node, structure, lines, true);
      return normalizeInstructionTextBlock(lines.join('\n'));
    }

    function isNodeContentSameAsHeading(node) {
      if (!node) return false;
      var text = String(node.content || node.plainText || '').trim();
      if (!text) return false;
      var headingLabel = formatInstructionNodeLabel(node, '').trim();
      var titleOnly = String(node.title || '').trim();
      var textNorm = normalizeSearchText(text);
      if (!textNorm) return false;
      if (titleOnly && textNorm === normalizeSearchText(titleOnly)) return true;
      if (headingLabel && textNorm === normalizeSearchText(headingLabel)) return true;
      return false;
    }

    function getInstructionNodeParent(structure, node) {
      if (!structure || !node || !node.parentId) return null;
      return structure.nodeById[node.parentId] || null;
    }

    function getInstructionNodePathNodes(structure, node, options) {
      var opts = options || {};
      if (!structure || !node) return [];
      var rootId = structure.root ? structure.root.id : '';
      var path = [];
      var current = node;
      var guard = 0;
      while (current && guard < 32) {
        if (current.id === rootId) {
          if (opts.includeRoot) path.push(current);
          break;
        }
        path.push(current);
        current = getInstructionNodeParent(structure, current);
        guard += 1;
      }
      path.reverse();
      return path;
    }

    function truncateInstructionLabel(text, maxLength) {
      var limit = Math.max(4, parseInt(maxLength, 10) || 28);
      var value = String(text || '').replace(/\s+/g, ' ').trim();
      if (!value) return '';
      if (value.length <= limit) return value;
      return value.slice(0, Math.max(1, limit - 1)).trim() + '…';
    }

    function buildCompactNodeNavLabel(node, maxLength) {
      if (!node) return '';
      var number = String(node.number || '').trim();
      var title = String(node.title || '').replace(/\s+/g, ' ').trim();
      var heading = formatInstructionNodeLabel(node, '').trim();
      var content = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
      var fallback = '';
      if (content) {
        fallback = String(content).replace(/\s+/g, ' ').trim();
      }

      if (title && number && normalizeSearchText(title) === normalizeSearchText(number)) {
        title = '';
      }
      if (!title && fallback) title = fallback;
      if (!title) title = heading;
      title = truncateInstructionLabel(title, maxLength || 24);

      if (!number) return title || 'Раздел';
      if (!title || normalizeSearchText(title) === normalizeSearchText(number)) return number;
      if (normalizeSearchText(title).indexOf(normalizeSearchText(number)) === 0) return title;
      return number + ' ' + title;
    }

    function buildInstructionSectionBreadcrumbHtml(instruction, structure, displayNode, focusedNode) {
      var parts = [];
      if (instruction && instruction.title) {
        parts.push({
          text: instruction.title,
          isCurrent: false
        });
      }

      var path = getInstructionNodePathNodes(structure, displayNode);
      for (var i = 0; i < path.length; i++) {
        parts.push({
          text: truncateInstructionLabel(formatInstructionNodeLabel(path[i], 'Раздел'), 44),
          isCurrent: false
        });
      }

      if (focusedNode && (!displayNode || focusedNode.id !== displayNode.id)) {
        parts.push({
          text: truncateInstructionLabel(buildCompactNodeNavLabel(focusedNode, 44), 44),
          isCurrent: true
        });
      } else if (parts.length) {
        parts[parts.length - 1].isCurrent = true;
      }

      var html = '';
      for (var p = 0; p < parts.length; p++) {
        if (p > 0) html += '<span class="instruction-breadcrumb-sep">→</span>';
        html += '<span class="instruction-breadcrumb-item' + (parts[p].isCurrent ? ' is-current' : '') + '">' + escapeHtml(parts[p].text) + '</span>';
      }
      return html;
    }

    function isPointLikeNode(node) {
      if (!node) return false;
      return node.type === 'point' || node.type === 'subpoint' || node.type === 'item';
    }

    function isInlineChildNode(node) {
      if (!node) return false;
      return node.type === 'subpoint' || node.type === 'item';
    }

    function shouldRenderSubpointInline(node, structure) {
      if (!isInlineChildNode(node)) return false;
      var parent = getInstructionNodeParent(structure, node);
      if (!parent) return true;
      if (isPointLikeNode(parent)) return true;
      return true;
    }

    function buildFocusedSubpointCalloutHtml(node) {
      if (!node) return '';
      var heading = String(node.number || '').trim();
      if (!heading) heading = buildCompactNodeNavLabel(node, 72);
      var content = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
      var merged = heading;
      if (content) {
        var contentNorm = normalizeSearchText(content);
        var headingNorm = normalizeSearchText(heading);
        if (!merged) {
          merged = content;
        } else if (contentNorm && contentNorm !== headingNorm && contentNorm.indexOf(headingNorm) !== 0) {
          merged += ' ' + content;
        }
      }
      return '<div class="instruction-focus-callout">' +
        '<div class="instruction-focus-kicker">' + (node.type === 'item' ? 'Текущий элемент' : 'Текущий подпункт') + '</div>' +
        '<div class="instruction-focus-text">' + escapeHtml(merged).replace(/\n/g, '<br />') + '</div>' +
      '</div>';
    }

    function openInstructionDetail(instructionId) {
      if (!findInstructionById(instructionId)) return;
      instructionsStore.selectedInstructionId = instructionId;
      instructionsStore.selectedSectionId = '';
      instructionsStore.view = 'detail';
      renderInstructionsScreen();
    }

    function openInstructionSection(instructionId, sectionId) {
      var instruction = findInstructionById(instructionId);
      if (!instruction) return;
      var section = findInstructionNodeById(instruction, sectionId);
      if (!section) return;
      instructionsStore.selectedInstructionId = instructionId;
      instructionsStore.selectedSectionId = sectionId;
      instructionsStore.view = 'section';
      renderInstructionsScreen();
    }

    function getInstructionNodeCounters(instruction) {
      var structure = getInstructionStructure(instruction);
      var counters = {
        structural: 0,
        points: 0
      };
      for (var i = 0; i < structure.traversal.length; i++) {
        var node = structure.traversal[i].node;
        if (!node || node.type === 'document') continue;
        if (isPointLikeNode(node)) counters.points += 1;
        else counters.structural += 1;
      }
      return counters;
    }

    function renderInstructionsCards(isPaywalled) {
      var listEl = document.getElementById('instructionsCards');
      if (!listEl) return;
      var items = instructionsStore.instructions.length
        ? instructionsStore.instructions
        : getInstructionsPreviewSeed();
      if (!items.length) {
        listEl.innerHTML = '';
        return;
      }

      var html = '';
      for (var i = 0; i < items.length; i++) {
        var instruction = items[i];
        var counters = getInstructionNodeCounters(instruction);
        var metaText = 'Содержание внутри';
        if (counters.structural || counters.points) {
          metaText = counters.structural + ' разделов';
          if (counters.points) {
            metaText += ' · ' + counters.points + ' пунктов';
          }
        }
        html += '<button class="instruction-card" type="button" data-action="open-instruction" data-instruction-id="' + escapeHtml(instruction.id) + '">' +
          '<div class="instruction-card-title">' + escapeHtml(instruction.title) + '</div>' +
          '<div class="instruction-card-description">' + escapeHtml(instruction.shortDescription || '') + '</div>' +
          '<div class="instruction-card-meta">' + escapeHtml(metaText) + '</div>' +
        '</button>';
      }
      listEl.innerHTML = html;

      if (isPaywalled) {
        var query = document.getElementById('instructionsSearchInput');
        if (query) query.value = '';
      }
    }

    function renderInstructionsSearchResults() {
      var resultsEl = document.getElementById('instructionsSearchResults');
      var answerEl = document.getElementById('instructionsAnswerCard');
      if (!resultsEl || !answerEl) return;
      if (!instructionsStore.searchResults.length) {
        resultsEl.innerHTML = '';
        answerEl.innerHTML = '';
        answerEl.classList.add('hidden');
        return;
      }

      var topAnswer = instructionsStore.searchResults[0] || null;
      if (topAnswer) {
        var topPreview = topAnswer.previewText || topAnswer.snippet || topAnswer.displayText || '';
        var answerSection = topAnswer.sectionTitle
          ? '<div class="search-result-section">' + highlightSearchText(topAnswer.sectionTitle, instructionsStore.searchQuery) + '</div>'
          : '';
        // Use previewLines when available — they give the answer at a glance
        var answerBodyHtml;
        if (topAnswer.previewLines && topAnswer.previewLines.length >= 2) {
          answerBodyHtml = '<div class="search-answer-norms">' +
            buildNormListHtml(topAnswer.previewLines.slice(0, 6), instructionsStore.searchQuery) +
            '</div>';
        } else {
          answerBodyHtml = '<div class="search-answer-preview">' +
            highlightSearchText(topPreview, instructionsStore.searchQuery) +
            '</div>';
        }
        answerEl.innerHTML =
          '<button class="search-answer-card" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(topAnswer.instructionId) + '" data-section-id="' + escapeHtml(topAnswer.sectionId) + '">' +
            '<div class="search-answer-kicker">Наиболее вероятный ответ</div>' +
            '<div class="search-result-top">' +
              '<span class="search-result-instruction">' + escapeHtml(topAnswer.instructionTitle) + '</span>' +
              (topAnswer.sectionRef ? '<span class="search-result-point">' + escapeHtml(topAnswer.sectionRef) + '</span>' : '') +
            '</div>' +
            answerSection +
            answerBodyHtml +
            '<div class="search-answer-actions">' +
              '<span class="search-answer-action-btn">Открыть пункт</span>' +
            '</div>' +
          '</button>';
        answerEl.classList.remove('hidden');
      } else {
        answerEl.innerHTML = '';
        answerEl.classList.add('hidden');
      }

      var html = '';
      for (var i = 1; i < instructionsStore.searchResults.length; i++) {
        var item = instructionsStore.searchResults[i];
        var cardClass = 'search-result-card' + (item.isExpandedAnswer ? ' is-answer' : '');
        var showSectionTitle = !!item.sectionTitle && !(item.isExpandedAnswer && item.answerIncludesHeading);
        // For secondary results: show previewLines (compact, 3 items) or snippet
        var snippetHtml;
        if (item.previewLines && item.previewLines.length >= 2) {
          snippetHtml = '<div class="search-result-norms">' +
            buildNormListHtml(item.previewLines.slice(0, 3), instructionsStore.searchQuery) +
            '</div>';
        } else {
          snippetHtml = '<div class="search-result-snippet' + (item.isExpandedAnswer ? ' is-expanded' : '') + '">' +
            highlightSearchText(item.displayText || item.snippet || '', instructionsStore.searchQuery) +
            '</div>';
        }
        html += '<button class="' + cardClass + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(item.instructionId) + '" data-section-id="' + escapeHtml(item.sectionId) + '">' +
          '<div class="search-result-top">' +
            '<span class="search-result-instruction">' + escapeHtml(item.instructionTitle) + '</span>' +
            (item.sectionRef ? '<span class="search-result-point">' + escapeHtml(item.sectionRef) + '</span>' : '') +
          '</div>' +
          (showSectionTitle
            ? '<div class="search-result-section">' + highlightSearchText(item.sectionTitle, instructionsStore.searchQuery) + '</div>'
            : '') +
          snippetHtml +
        '</button>';
      }
      resultsEl.innerHTML = html;
    }

    function renderInstructionDetailScreen() {
      var titleEl = document.getElementById('instructionDetailTitle');
      var descriptionEl = document.getElementById('instructionDetailDescription');
      var sectionsEl = document.getElementById('instructionSectionsList');
      var quickNavEl = document.getElementById('instructionDetailQuickNav');
      if (!titleEl || !descriptionEl || !sectionsEl || !quickNavEl) return;

      var instruction = findInstructionById(instructionsStore.selectedInstructionId);
      if (!instruction) {
        instructionsStore.view = 'list';
        return;
      }

      titleEl.textContent = instruction.title || '';
      descriptionEl.textContent = instruction.shortDescription || '';

      var structure = getInstructionStructure(instruction);
      var rootId = structure.root ? structure.root.id : '';
      var html = '';
      for (var i = 0; i < structure.traversal.length; i++) {
        var entry = structure.traversal[i];
        var section = entry.node;
        if (!section || section.id === rootId || isPointLikeNode(section)) continue;
        var depthClass = ' instruction-section-depth-' + Math.min(6, Math.max(1, entry.depth));
        var label = formatInstructionNodeLabel(section, 'Раздел');
        var childCount = (structure.childrenByParent[section.id] || []).length;
        var metaParts = [];
        if (section.type) metaParts.push(getInstructionNodeTypeLabel(section.type));
        if (childCount) metaParts.push(childCount + ' подпунктов');
        html += '<button class="instruction-section-item' + depthClass + '" id="instruction-anchor-' + escapeHtml(toDomSafeId(section.id)) + '" data-node-anchor="' + escapeHtml(section.id) + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(instruction.id) + '" data-section-id="' + escapeHtml(section.id) + '">' +
          '<span class="instruction-section-item-title">' + escapeHtml(label) + '</span>' +
          '<span class="instruction-section-item-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>' +
        '</button>';
      }

      sectionsEl.innerHTML = html || '<div class="instructions-state">Разделы пока не загружены.</div>';

      var topNodes = structure.childrenByParent[rootId] || [];
      var quickNavHtml = '';
      for (var q = 0; q < topNodes.length; q++) {
        var node = topNodes[q];
        if (!node || isPointLikeNode(node)) continue;
        var fullLabel = formatInstructionNodeLabel(node, 'Раздел');
        var chipLabel = buildCompactNodeNavLabel(node, 26) || ('Раздел ' + (q + 1));
        quickNavHtml += '<button class="instruction-detail-jump-btn" type="button" data-action="scroll-node" data-section-id="' + escapeHtml(node.id) + '" title="' + escapeHtml(fullLabel) + '">' + escapeHtml(chipLabel) + '</button>';
      }
      quickNavEl.innerHTML = quickNavHtml;
      quickNavEl.classList.toggle('hidden', !quickNavHtml);
    }

    function renderInstructionSectionScreen() {
      var breadcrumbEl = document.getElementById('instructionSectionBreadcrumb');
      var sectionTitleEl = document.getElementById('instructionSectionTitle');
      var sectionMetaEl = document.getElementById('instructionSectionMeta');
      var quickJumpEl = document.getElementById('instructionQuickJump');
      var contentEl = document.getElementById('instructionSectionContent');
      var childNodesEl = document.getElementById('instructionChildNodes');
      if (!sectionTitleEl || !sectionMetaEl || !quickJumpEl || !contentEl) return;

      var instruction = findInstructionById(instructionsStore.selectedInstructionId);
      if (!instruction) {
        instructionsStore.view = 'list';
        return;
      }
      var structure = getInstructionStructure(instruction);
      var requestedSection = findInstructionNodeById(instruction, instructionsStore.selectedSectionId);
      if (!requestedSection) {
        instructionsStore.view = 'detail';
        return;
      }

      var displaySection = requestedSection;
      var focusedSubpoint = null;
      var requestedParent = getInstructionNodeParent(structure, requestedSection);
      if (isInlineChildNode(requestedSection) && requestedParent) {
        focusedSubpoint = requestedSection;
        if (shouldRenderSubpointInline(requestedSection, structure)) {
          displaySection = requestedParent;
          while (displaySection && isInlineChildNode(displaySection)) {
            var upperParent = getInstructionNodeParent(structure, displaySection);
            if (!upperParent) break;
            displaySection = upperParent;
          }
          if (isPointLikeNode(displaySection)) {
            focusedSubpoint = null;
          }
        }
      }

      var children = structure.childrenByParent[displaySection.id] || [];
      var hasChildren = !!children.length;
      var isHeadingDuplicate = isNodeContentSameAsHeading(displaySection);
      var headingLabel = formatInstructionNodeLabel(displaySection, instruction.title || '');
      if (
        isHeadingDuplicate &&
        !hasChildren &&
        displaySection.type === 'point' &&
        displaySection.number
      ) {
        sectionTitleEl.textContent = String(displaySection.number).trim();
      } else {
        sectionTitleEl.textContent = headingLabel;
      }

      var metaParts = [instruction.title];
      if (displaySection.type) metaParts.push(getInstructionNodeTypeLabel(displaySection.type));
      if (focusedSubpoint) metaParts.push(focusedSubpoint.type === 'item' ? 'контекст элемента' : 'контекст подпункта');
      if (instruction.version) metaParts.push(instruction.version);
      sectionMetaEl.textContent = metaParts.join(' · ');

      var breadcrumbHtml = buildInstructionSectionBreadcrumbHtml(
        instruction,
        structure,
        displaySection,
        focusedSubpoint
      );
      if (breadcrumbEl) {
        breadcrumbEl.innerHTML = breadcrumbHtml;
        breadcrumbEl.classList.toggle('hidden', !breadcrumbHtml);
      }

      var jumpNodes = [];
      var activeJumpId = requestedSection.id;
      if (focusedSubpoint && displaySection.id !== requestedSection.id) {
        for (var c = 0; c < children.length; c++) {
          var childNode = children[c];
          if (!childNode || !isPointLikeNode(childNode)) continue;
          jumpNodes.push(childNode);
        }
      } else {
        var parentId = displaySection.parentId && structure.nodeById[displaySection.parentId]
          ? displaySection.parentId
          : (structure.root ? structure.root.id : '');
        var siblings = structure.childrenByParent[parentId] || [];
        for (var i = 0; i < siblings.length; i++) {
          var jumpSection = siblings[i];
          if (!jumpSection) continue;
          var currentIsPointLike = isPointLikeNode(displaySection);
          var siblingIsPointLike = isPointLikeNode(jumpSection);
          if (!currentIsPointLike && siblingIsPointLike) continue;
          jumpNodes.push(jumpSection);
        }
        activeJumpId = displaySection.id;
      }

      var jumpHtml = '';
      for (var j = 0; j < jumpNodes.length; j++) {
        var navNode = jumpNodes[j];
        var activeClass = navNode.id === activeJumpId ? ' is-active' : '';
        var fullLabel = formatInstructionNodeLabel(navNode, 'Раздел');
        var compactLabel = buildCompactNodeNavLabel(
          navNode,
          isInlineChildNode(navNode) ? 18 : 24
        );
        jumpHtml += '<button class="instruction-jump-btn' + activeClass + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(instruction.id) + '" data-section-id="' + escapeHtml(navNode.id) + '" title="' + escapeHtml(fullLabel) + '">' + escapeHtml(compactLabel) + '</button>';
      }
      quickJumpEl.innerHTML = jumpHtml;
      quickJumpEl.classList.toggle('hidden', !jumpHtml);

      var shouldInlinePointChildren = isPointLikeNode(displaySection);
      if (childNodesEl) {
        if (!children.length || shouldInlinePointChildren) {
          childNodesEl.innerHTML = '';
          childNodesEl.classList.add('hidden');
        } else {
          var showSubpoints = isPointLikeNode(displaySection) || (focusedSubpoint && requestedParent && isPointLikeNode(requestedParent));
          var childHeader = showSubpoints ? 'Подпункты и элементы' : 'Подразделы и пункты';
          var childHtml = '<div class="section-header">' + childHeader + '</div>';
          for (var ch = 0; ch < children.length; ch++) {
            var child = children[ch];
            var isActiveChild = !!(focusedSubpoint && child.id === focusedSubpoint.id);
            var fullChildLabel = formatInstructionNodeLabel(child, 'Пункт');
            var compactChildLabel = buildCompactNodeNavLabel(child, isInlineChildNode(child) ? 64 : 84);
            childHtml += '<button class="instruction-child-item' + (isActiveChild ? ' is-active' : '') + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(instruction.id) + '" data-section-id="' + escapeHtml(child.id) + '" title="' + escapeHtml(fullChildLabel) + '">' +
              '<span class="instruction-child-title">' + escapeHtml(compactChildLabel) + '</span>' +
              '<span class="instruction-child-meta">' + escapeHtml(getInstructionNodeTypeLabel(child.type)) + '</span>' +
            '</button>';
          }
          childNodesEl.innerHTML = childHtml;
          childNodesEl.classList.remove('hidden');
        }
      }

      var hasVisibleChildren = childNodesEl && !childNodesEl.classList.contains('hidden');
      var shouldCompactText = hasChildren && !isPointLikeNode(displaySection);
      if (focusedSubpoint) shouldCompactText = false;
      var contentText = shouldInlinePointChildren
        ? buildPointContentWithInlineChildren(displaySection, structure)
        : normalizeNodeContentForDisplay(displaySection, {
            suppressDuplicateHeading: hasVisibleChildren
          });
var contentHtml = formatInstructionNodeContentHtml(
  displaySection,
  shouldCompactText ? { maxParagraphs: 2, forceHint: true } : {}
);

      var contextHtml = '';
      if (focusedSubpoint) {
        if (displaySection.id === requestedSection.id && requestedParent) {
          var parentLabel = formatInstructionNodeLabel(requestedParent, 'Пункт');
          contextHtml += '<div class="instruction-parent-context">' +
            '<div class="instruction-parent-context-label">Родительский пункт</div>' +
            '<div class="instruction-parent-context-value">' + escapeHtml(truncateInstructionLabel(parentLabel, 140)) + '</div>' +
          '</div>';
        }
        contextHtml += buildFocusedSubpointCalloutHtml(focusedSubpoint);
      }

      // Presentation layer: previewLines block + footnotes
      // Use the assembled body (includes child node text) for point-type nodes
      // so that enumerated items stored as child nodes are visible to the parser.
      var presentationHtml = '';
      var footnotesHtml = '';
      if (INSTRUCTIONS_CORE && typeof INSTRUCTIONS_CORE.buildPresentation === 'function') {
        var assembledBodyForPres = isPointLikeNode(displaySection)
          ? buildPointAnswerText(displaySection, structure)
          : getNodeSearchText(displaySection);
        var pres = INSTRUCTIONS_CORE.buildPresentation(displaySection, assembledBodyForPres);
        if (pres && pres.previewLines && pres.previewLines.length >= 2 && !focusedSubpoint) {
          presentationHtml = '<div class="instruction-presentation">' +
            buildNormListHtml(pres.previewLines, '') +
            '</div>';
        }
        if (pres && pres.footnotes && pres.footnotes.length) {
          footnotesHtml = buildFootnotesHtml(pres.footnotes);
        }
      }

      contentEl.innerHTML = contextHtml + presentationHtml + contentHtml + footnotesHtml;
    }

    function renderInstructionsScreen() {
      var shell = document.getElementById('instructionsShell');
      if (!shell) return;
      var contentLayer = document.getElementById('instructionsContentLayer');
      var paywallOverlay = document.getElementById('instructionsPaywallOverlay');
      var listView = document.getElementById('instructionsListView');
      var detailView = document.getElementById('instructionDetailView');
      var sectionView = document.getElementById('instructionSectionView');
      var loadingStateEl = document.getElementById('instructionsLoadingState');
      var offlineStateEl = document.getElementById('instructionsOfflineState');
      var noResultsStateEl = document.getElementById('instructionsNoResultsState');
      var metaRowEl = document.getElementById('instructionsMetaRow');
      var cardsEl = document.getElementById('instructionsCards');
      var answerEl = document.getElementById('instructionsAnswerCard');
      var searchResultsEl = document.getElementById('instructionsSearchResults');
      var searchInputEl = document.getElementById('instructionsSearchInput');
      if (!contentLayer || !paywallOverlay || !listView || !detailView || !sectionView || !loadingStateEl || !offlineStateEl || !noResultsStateEl || !metaRowEl || !cardsEl || !answerEl || !searchResultsEl) {
        return;
      }

      var isPaywalled = !proStore.isActive;
      contentLayer.classList.toggle('is-paywalled', isPaywalled);
      paywallOverlay.classList.toggle('hidden', !isPaywalled);
      if (isPaywalled) {
        instructionsStore.view = 'list';
      }

      listView.classList.toggle('hidden', instructionsStore.view !== 'list');
      detailView.classList.toggle('hidden', instructionsStore.view !== 'detail');
      sectionView.classList.toggle('hidden', instructionsStore.view !== 'section');

      var queryValue = normalizeSearchText(instructionsStore.searchQuery);
      var hasQuery = !!queryValue;
      var canShowSearch = !isPaywalled && hasQuery;
      var showLoading = instructionsStore.status === 'loading' && !instructionsStore.instructions.length;
      var showOffline = (instructionsStore.status === 'offline' || instructionsStore.status === 'error') && !instructionsStore.instructions.length;
      var showNoResults = canShowSearch && instructionsStore.searchResults.length === 0 && !showLoading;

      loadingStateEl.classList.toggle('hidden', !showLoading);
      offlineStateEl.classList.toggle('hidden', !showOffline);
      noResultsStateEl.classList.toggle('hidden', !showNoResults);
      if (showOffline) {
        offlineStateEl.textContent = instructionsStore.errorMessage || 'Нет сети и нет локальной базы инструкций.';
      }

      if (metaRowEl) {
        if (isPaywalled) {
          metaRowEl.textContent = 'ПТЭ · ИСИ · ИДП доступны в PRO';
        } else if (instructionsStore.lastUpdated) {
          var dateLabel = formatIsoDateLabel(instructionsStore.lastUpdated);
          var sourceLabel = instructionsStore.dataSource === 'network' ? 'обновлено' : 'кэш';
          metaRowEl.textContent = sourceLabel + ': ' + (dateLabel || 'сейчас');
        } else if (instructionsStore.status === 'loading') {
          metaRowEl.textContent = 'Обновляем локальную базу...';
        } else {
          metaRowEl.textContent = 'Работает без интернета после первой загрузки';
        }
      }

      if (searchInputEl && searchInputEl.value !== instructionsStore.searchQuery) {
        searchInputEl.value = instructionsStore.searchQuery;
      }

      renderInstructionsCards(isPaywalled);
      renderInstructionsSearchResults();
      cardsEl.classList.toggle('hidden', canShowSearch);
      answerEl.classList.toggle('hidden', !canShowSearch || !instructionsStore.searchResults.length);
      searchResultsEl.classList.toggle('hidden', !canShowSearch);

      if (instructionsStore.view === 'detail') {
        renderInstructionDetailScreen();
      } else if (instructionsStore.view === 'section') {
        renderInstructionSectionScreen();
      }
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
      renderInstallPromptCard();
      renderInstructionsScreen();
    }

    function handleTabActivated(tab) {
      if (tab === 'instructions') {
        ensureInstructionsReady(false, false);
      }
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
      renderInstallPromptCard();
      handleTabActivated(activeTab);
      renderInstructionsScreen();
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

      var instructionsPageTitle = document.querySelector('.instructions-page-title');
      if (instructionsPageTitle) instructionsPageTitle.textContent = 'Инструкции';
      var appVersionValue = document.getElementById('appVersionValue');
      if (appVersionValue) appVersionValue.textContent = APP_VERSION;

      var addScreenBtn = document.getElementById('btnShowInstallGuide');
      if (addScreenBtn) addScreenBtn.textContent = 'Показать инструкцию';

      var overlays = document.querySelectorAll('.overlay');
      for (var oi = 0; oi < overlays.length; oi++) {
        var title = overlays[oi].querySelector('.sheet-title');
        if (!title) continue;
        if (overlays[oi].id === 'overlayAddScreen') title.textContent = 'Добавить на главный экран';
        if (overlays[oi].id === 'overlaySalarySettings') title.textContent = 'Параметры расчёта';
        if (overlays[oi].id === 'overlayConfirm') title.textContent = 'Удалить смену';
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

    function getShiftIncomeViewModel(shift, shiftIncomeMap) {
      var incomeData = shiftIncomeMap ? shiftIncomeMap[String(shift.id)] : null;
      if (!incomeData) {
        return {
          hasValue: false,
          level: 'none',
          amountText: '—'
        };
      }
      var incomeLevel = incomeData.level === 'low' || incomeData.level === 'high'
        ? incomeData.level
        : 'medium';
      var incomeAmount = Number(incomeData.amount);
      var hasAmount = isFinite(incomeAmount);
      return {
        hasValue: hasAmount,
        level: hasAmount ? incomeLevel : 'none',
        amountText: hasAmount ? formatRub(incomeAmount) : '—'
      };
    }

    function getShiftIncomeChipHtml(incomeViewModel) {
      var vm = incomeViewModel || { hasValue: false, level: 'none', amountText: '—' };
      var chipClass = vm.hasValue ? ('shift-income-chip--' + vm.level) : 'shift-income-chip--empty';
      return '<div class="shift-income-chip ' + chipClass + '">' + escapeHtml(vm.amountText) + '</div>';
    }

    function getShiftDateTimeLineLabel(displayParts) {
      if (!displayParts) return '—';
      var start = (displayParts.startDate || '—') + ', ' + (displayParts.startTime || '--:--');
      var end = (displayParts.endDate || '—') + ', ' + (displayParts.endTime || '--:--');
      return start + ' → ' + end;
    }

    function getShiftInlineIconSvg(iconName) {
      var common = 'class="shift-inline-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
      if (iconName === 'calendar') {
        return '<svg ' + common + '><rect x="3.5" y="5" width="13" height="11" rx="2"></rect><path d="M7 3.8v2.4"></path><path d="M13 3.8v2.4"></path><path d="M3.5 8.5h13"></path></svg>';
      }
      if (iconName === 'depot') {
        return '<svg ' + common + '><path d="M3.5 16.5h13"></path><path d="M5 16.5V7.8L10 5l5 2.8v8.7"></path><path d="M8 16.5v-3h4v3"></path></svg>';
      }
      if (iconName === 'route') {
        return '<svg ' + common + '><path d="M7 16s4-3.4 4-6.5A4 4 0 1 0 3 9.5C3 12.6 7 16 7 16Z"></path><circle cx="7" cy="9" r="1.3"></circle><path d="M12 13h4"></path><path d="M14.5 11.5 16 13l-1.5 1.5"></path></svg>';
      }
      if (iconName === 'duration') {
        return '<svg ' + common + '><circle cx="10" cy="10" r="6"></circle><path d="M10 7.2v3.2l2.1 1.2"></path></svg>';
      }
      if (iconName === 'locomotive') {
        return '<svg ' + common + '><path d="M4 13V6.5A2.5 2.5 0 0 1 6.5 4h6A2.5 2.5 0 0 1 15 6.5V13"></path><path d="M4 11h11"></path><path d="M7 8h3"></path><circle cx="6.5" cy="14.5" r="1"></circle><circle cx="12.5" cy="14.5" r="1"></circle></svg>';
      }
      if (iconName === 'train') {
        return '<svg ' + common + '><rect x="3.5" y="6" width="13" height="7" rx="2"></rect><path d="M6.5 8.5h2"></path><path d="M11.5 8.5h2"></path><path d="M6.5 13v2"></path><path d="M13.5 13v2"></path></svg>';
      }
      if (iconName === 'wagon') {
        return '<svg ' + common + '><rect x="4" y="6.5" width="12" height="6.5" rx="1.8"></rect><path d="M8 6.5v6.5"></path><path d="M12 6.5v6.5"></path><circle cx="7" cy="14.5" r="0.9"></circle><circle cx="13" cy="14.5" r="0.9"></circle></svg>';
      }
      if (iconName === 'axles') {
        return '<svg ' + common + '><circle cx="10" cy="10" r="2.7"></circle><path d="M10 4.2v1.6"></path><path d="M10 14.2v1.6"></path><path d="M4.2 10h1.6"></path><path d="M14.2 10h1.6"></path><path d="M5.8 5.8 7 7"></path><path d="M13 13l1.2 1.2"></path><path d="M14.2 5.8 13 7"></path><path d="M7 13l-1.2 1.2"></path></svg>';
      }
      if (iconName === 'income') {
        return '<svg ' + common + '><path d="M4 7.5h12a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5Z"></path><circle cx="10" cy="11" r="1.7"></circle><path d="M5.2 11h.1"></path><path d="M14.7 11h.1"></path></svg>';
      }
      return '<svg ' + common + '><rect x="3.5" y="4.5" width="13" height="12" rx="2.2"></rect><path d="M7 3.5v2"></path><path d="M13 3.5v2"></path><path d="M3.5 8h13"></path></svg>';
    }

    function getShiftTypeLabel(shift) {
      if (!shift) return 'Смена';
      if (shift.route_kind === 'trip') return 'Поездка';
      if (shift.route_kind === 'depot') return 'Под депо';
      return 'Смена';
    }

    function getShiftTypeIconName(shift) {
      if (shift && shift.route_kind === 'trip') return 'train';
      if (shift && shift.route_kind === 'depot') return 'depot';
      return 'shift';
    }

    function getShiftDirectionLineText(shift) {
      if (!shift) return '';
      var from = shift.route_from ? String(shift.route_from).trim() : '';
      var to = shift.route_to ? String(shift.route_to).trim() : '';
      if (!from || !to) return '';
      return from + ' → ' + to;
    }

    function getShiftDurationLabelText(rawDuration) {
      var text = rawDuration ? String(rawDuration) : '—';
      return text
        .replace(/(\d)\s+д/g, '$1д')
        .replace(/(\d)\s+ч/g, '$1ч')
        .replace(/(\d)\s+мин/g, '$1м');
    }

    function buildShiftTypeHtml(shift, typeLabel) {
      return '' +
        '<div class="shift-type">' +
          '<span class="shift-type-content">' +
            '<span class="shift-type-icon" aria-hidden="true">' + getShiftInlineIconSvg(getShiftTypeIconName(shift)) + '</span>' +
            '<span class="shift-type-text">' + escapeHtml(typeLabel) + '</span>' +
          '</span>' +
        '</div>';
    }

    function buildShiftDirectionHtml(directionText) {
      if (!directionText) return '';
      return '' +
        '<div class="shift-direction-row">' +
          '<span class="shift-direction-icon" aria-hidden="true">' + getShiftInlineIconSvg('route') + '</span>' +
          '<span class="shift-direction-text">' + escapeHtml(directionText) + '</span>' +
        '</div>';
    }

    function buildShiftDurationHtml(durationText) {
      return '' +
        '<div class="shift-duration">' +
          '<span class="shift-duration-icon" aria-hidden="true">' + getShiftInlineIconSvg('duration') + '</span>' +
          '<span class="shift-duration-text">' + escapeHtml(durationText || '—') + '</span>' +
        '</div>';
    }

    function buildShiftDateTimeHtml(dateTimeText) {
      return '' +
        '<div class="shift-datetime-line">' +
          '<span class="shift-datetime-icon" aria-hidden="true">' + getShiftInlineIconSvg('calendar') + '</span>' +
          '<span class="shift-datetime-text">' + escapeHtml(dateTimeText || '—') + '</span>' +
        '</div>';
    }

    function buildShiftIncomeLabelHtml() {
      return '' +
        '<span class="shift-income-row-label">' +
          '<span class="shift-income-row-label-content">' +
            '<span class="shift-income-row-label-icon" aria-hidden="true">' + getShiftInlineIconSvg('income') + '</span>' +
            '<span class="shift-income-row-label-text">Доход за смену</span>' +
          '</span>' +
        '</span>';
    }

    function getShiftTechnicalItems(shift) {
      var items = [];
      if (!shift) return items;
      var loco = getLocoSummary(shift);
      if (loco) items.push({ icon: 'locomotive', text: loco.replace('№ ', '№') });
      if (shift.train_number) items.push({ icon: 'train', text: '№' + shift.train_number });
      if (shift.train_length) items.push({ icon: 'wagon', text: shift.train_length + ' ваг' });
      if (shift.train_axles) items.push({ icon: 'axles', text: shift.train_axles + ' оси' });
      return items;
    }

    function buildShiftTechnicalHtml(shift) {
      var items = getShiftTechnicalItems(shift);
      if (!items.length) return '';

      var html = '<div class="shift-tech-line">';
      for (var i = 0; i < items.length; i++) {
        if (i > 0) html += '<span class="shift-tech-sep" aria-hidden="true">·</span>';
        html += '' +
          '<span class="shift-tech-part">' +
            '<span class="shift-tech-part-icon" aria-hidden="true">' + getShiftInlineIconSvg(items[i].icon) + '</span>' +
            '<span class="shift-tech-part-text">' + escapeHtml(items[i].text) + '</span>' +
          '</span>';
      }
      html += '</div>';
      return html;
    }

    function buildConfirmShiftCardHtml(shift, shiftIncomeMap) {
      if (!shift) return '';
      var f = fmtShift(shift);
      var p = getShiftDisplayParts(shift);
      var typeLabel = getShiftTypeLabel(shift);
      var directionText = getShiftDirectionLineText(shift);
      var dateTimeText = getShiftDateTimeLineLabel(p);
      var durationText = getShiftDurationLabelText(f.dur);
      var typeHtml = buildShiftTypeHtml(shift, typeLabel);
      var directionHtml = buildShiftDirectionHtml(directionText);
      var dateTimeHtml = buildShiftDateTimeHtml(dateTimeText);
      var durationHtml = buildShiftDurationHtml(durationText);
      var technicalHtml = buildShiftTechnicalHtml(shift);
      var incomeLabelHtml = buildShiftIncomeLabelHtml();
      var incomeVm = getShiftIncomeViewModel(shift, shiftIncomeMap);
      var incomeHtml = getShiftIncomeChipHtml(incomeVm);
      var itemClass = 'shift-item compact-shift shift-item-confirm';
      if (shift.route_kind === 'trip') itemClass += ' has-trip';
      itemClass += ' income-' + incomeVm.level;

      return '' +
        '<div class="' + itemClass + '" data-shift-id="' + shift.id + '">' +
          '<div class="shift-card-top">' +
            typeHtml +
          '</div>' +
          directionHtml +
          '<div class="shift-card-body">' +
            '<div class="shift-main-row">' +
              dateTimeHtml +
              durationHtml +
            '</div>' +
            technicalHtml +
            '<div class="shift-income-row">' +
              incomeLabelHtml +
              incomeHtml +
            '</div>' +
          '</div>' +
        '</div>';
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
      var typeLabel = getShiftTypeLabel(sh);
      var directionText = getShiftDirectionLineText(sh);
      var dateTimeText = getShiftDateTimeLineLabel(p);
      var durationText = getShiftDurationLabelText(f.dur);
      var typeHtml = buildShiftTypeHtml(sh, typeLabel);
      var directionHtml = buildShiftDirectionHtml(directionText);
      var dateTimeHtml = buildShiftDateTimeHtml(dateTimeText);
      var durationHtml = buildShiftDurationHtml(durationText);
      var technicalHtml = buildShiftTechnicalHtml(sh);
      var incomeLabelHtml = buildShiftIncomeLabelHtml();
      if (sh.route_kind === 'trip') itemClass += ' has-trip';
      if (sh.id === editingShiftId) itemClass += ' is-edit-target';
      if (sh.id === pendingDeleteId) itemClass += ' is-delete-target';
      if (sh.id === recentAddedShiftId) itemClass += ' is-adding-target';
      var shiftIsPending = pendingMap ? !!pendingMap[String(sh.id)] : isShiftPending(sh);
      if (shiftIsPending) itemClass += ' is-pending';
      var incomeVm = getShiftIncomeViewModel(sh, shiftIncomeMap);
      var incomeHtml = getShiftIncomeChipHtml(incomeVm);
      itemClass += ' income-' + incomeVm.level;

      var html = '<div class="' + itemClass + '" data-shift-id="' + sh.id + '" data-pending="' + (shiftIsPending ? '1' : '0') + '">' +
        '<div class="shift-card-top">' +
          typeHtml +
          '<div class="shift-top-right">' +
            '<div class="shift-actions-wrap">' +
              '<button class="shift-actions-trigger" type="button" data-id="' + sh.id + '" aria-label="Действия" aria-haspopup="menu" aria-expanded="' + (activeShiftMenuId === sh.id ? 'true' : 'false') + '">⋯</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (shiftIsPending ? '<div class="shift-pending-line">Не синхронизировано</div>' : '') +
        directionHtml +
        '<div class="shift-card-body">' +
          '<div class="shift-main-row">' +
            dateTimeHtml +
            durationHtml +
          '</div>' +
          technicalHtml +
          '<div class="shift-income-row">' +
            incomeLabelHtml +
            incomeHtml +
          '</div>' +
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

    function renderDeleteConfirmCard(shiftIncomeMap) {
      var cardEl = document.getElementById('confirmShiftCard');
      if (!cardEl) return;
      if (!pendingDeleteId) {
        cardEl.innerHTML = '';
        return;
      }
      cardEl.innerHTML = buildConfirmShiftCardHtml(findShiftById(pendingDeleteId), shiftIncomeMap);
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
      renderMonthHeader('shiftsMonthTitle', 'shiftsMonthQuarter', 'shiftsMonthTabs', currentYear, currentMonth, function(targetMonth) {
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
      var monthSalarySummary = calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin);
      renderDeleteConfirmCard(shiftIncomeMap);

      // Norm
      var monthKey = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
      var norm = WORK_NORMS[monthKey];

      // Update stats
      var statWorkedEl = document.getElementById('statWorked');
      if (statWorkedEl) statWorkedEl.textContent = fmtMin(totalMin);
      var monthIncomeLabelEl = document.getElementById('dashboardMonthIncomeLabel');
      var monthIncomeValueEl = document.getElementById('dashboardMonthIncomeValue');
      if (monthIncomeLabelEl) monthIncomeLabelEl.textContent = formatMonthIncomeLabel(currentMonth);
      if (monthIncomeValueEl) {
        monthIncomeValueEl.textContent = monthShifts.length > 0
          ? formatRub(monthSalarySummary.netAmount)
          : 'Нет смен';
      }
      setQuickMetricText('statNight', fmtMin(nightMin));
      setQuickMetricText('statHoliday', fmtMin(holidayMin));
      setQuickMetricText('statShifts', String(monthShifts.length));
      renderAverageShiftSummary(buildAverageShiftSummary(monthShifts, bounds, shiftIncomeMap));

      var normEl = document.getElementById('statNorm');
      var diffEl = document.getElementById('statDiff');
      var progressFillEl = document.getElementById('dashboardProgressFill');

      if (norm !== undefined) {
        normEl.textContent = norm + ' ч';
        var normMin = norm  * 60;
        var diffMin = totalMin - normMin;
        var diffAbs = Math.abs(diffMin);
        var progressPct = normMin > 0 ? Math.max(0, Math.min(100, Math.round((totalMin / normMin) * 100))) : 0;

        diffEl.className = 'dashboard-sub';
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
      renderInstallPromptCard();
      renderInstructionsScreen();

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
        closeShiftActionsMenu(true);
        render();
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

    function shiftCurrentMonthBy(delta) {
      if (delta === 0) return;
      if (delta > 0) {
        if (currentMonth === 11) { currentMonth = 0; currentYear++; }
        else currentMonth++;
        return;
      }
      if (currentMonth === 0) { currentMonth = 11; currentYear--; }
      else currentMonth--;
    }

    function bindCurrentMonthNavButton(buttonId, delta) {
      var button = document.getElementById(buttonId);
      if (!button) return;
      button.addEventListener('click', function() {
        shiftCurrentMonthBy(delta);
        render();
      });
    }

    // ── Month navigation ──
    bindCurrentMonthNavButton('btnPrevMonth', -1);
    bindCurrentMonthNavButton('btnNextMonth', 1);
    bindCurrentMonthNavButton('btnPrevShiftsMonth', -1);
    bindCurrentMonthNavButton('btnNextShiftsMonth', 1);
    bindCurrentMonthNavButton('btnPrevSalaryMonth', -1);
    bindCurrentMonthNavButton('btnNextSalaryMonth', 1);

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
      ensureInstructionsReady(true, true);
      renderInstructionsScreen();
    });
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        settleSafeAreaInsets();
        updateOfflineUiState({ isOffline: !navigator.onLine, hasPending: !!readPendingSnapshot() });
        if (navigator.onLine) flushPendingSnapshot();
        renderInstallPromptCard();
        renderInstructionsScreen();
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

    function openInstallGuideSheet() {
      document.getElementById('appUrl').textContent = getAppUrl();
      openOverlay('overlayAddScreen');
    }

    // ── Add to Screen ──
    var showInstallGuideBtn = document.getElementById('btnShowInstallGuide');
    if (showInstallGuideBtn) {
      showInstallGuideBtn.addEventListener('click', function() {
        openInstallGuideSheet();
      });
    }
    var dismissInstallCardBtn = document.getElementById('btnDismissInstallCard');
    if (dismissInstallCardBtn) {
      dismissInstallCardBtn.addEventListener('click', function() {
        dismissInstallPromptCard();
      });
    }

    var openSalarySettingsBtn = document.getElementById('btnOpenSalarySettings');
    if (openSalarySettingsBtn) {
      openSalarySettingsBtn.addEventListener('click', function() {
        updateSettingsControls();
        openOverlay('overlaySalarySettings');
      });
    }
    var closeSalarySettingsBtn = document.getElementById('btnCloseSalarySettings');
    if (closeSalarySettingsBtn) {
      closeSalarySettingsBtn.addEventListener('click', function() {
        closeOverlay('overlaySalarySettings');
      });
    }

    var instructionsShellEl = document.getElementById('instructionsShell');
    if (instructionsShellEl) {
      instructionsShellEl.addEventListener('click', function(e) {
        var trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        var action = trigger.getAttribute('data-action');
        if (action === 'open-instruction') {
  openInstructionDetail(trigger.getAttribute('data-instruction-id'));
  return;
}
if (action === 'open-section') {
  openInstructionSection(
    trigger.getAttribute('data-instruction-id'),
    trigger.getAttribute('data-section-id')
  );
  return;
}
if (action === 'open-ref') {
  openInstructionReference(
    trigger.getAttribute('data-instruction-id'),
    trigger.getAttribute('data-target-number')
  );
  return;
}
if (action === 'scroll-node') {
  scrollToInstructionNodeAnchor(trigger.getAttribute('data-section-id'));
}
      });
    }

    var instructionsSearchInputEl = document.getElementById('instructionsSearchInput');
    if (instructionsSearchInputEl) {
      instructionsSearchInputEl.addEventListener('input', function(e) {
        setInstructionsSearchQuery(e.currentTarget.value);
      });
      instructionsSearchInputEl.addEventListener('focus', function() {
        if (!instructionsStore.searchDocs.length) {
          ensureInstructionsReady(false, true);
        }
      });
    }

    var backToInstructionsListBtn = document.getElementById('btnBackToInstructionsList');
    if (backToInstructionsListBtn) {
      backToInstructionsListBtn.addEventListener('click', function() {
        instructionsStore.view = 'list';
        instructionsStore.selectedInstructionId = '';
        instructionsStore.selectedSectionId = '';
        renderInstructionsScreen();
      });
    }

    var backToInstructionDetailBtn = document.getElementById('btnBackToInstructionDetail');
    if (backToInstructionDetailBtn) {
      backToInstructionDetailBtn.addEventListener('click', function() {
        instructionsStore.view = 'detail';
        instructionsStore.selectedSectionId = '';
        renderInstructionsScreen();
      });
    }

    var unlockProBtn = document.getElementById('btnUnlockPro');
    if (unlockProBtn) {
      unlockProBtn.addEventListener('click', function() {
        setProActive(true);
      });
    }

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
    renderInstallPromptCard();
    renderInstructionsScreen();
    ensureInstructionsReady(false, true);

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
