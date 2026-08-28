    // ── Telegram WebApp chrome (не блокировать bootstrap: SDK подключается последним defer в index.html)
    if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('app', 'v411');

    function applyTelegramWebAppChrome() {
      try {
        if (typeof window.__telegramMarkShellReady === 'function') {
          window.__telegramMarkShellReady();
        }
      } catch (earlyReadyError) {}
      try {
        if (window.Telegram && Telegram.WebApp) {
          Telegram.WebApp.ready();
          Telegram.WebApp.expand();
        }
      } catch (e) {
        console.warn('TG SDK init error:', e);
      }
      try {
        if (typeof window.__settleSafeAreaInsets === 'function') {
          window.__settleSafeAreaInsets();
        }
      } catch (e2) {}
    }

    applyTelegramWebAppChrome();

    (function hookTelegramSdkLoad() {
      function bindElement(el) {
        if (!el || el.dataset.shellHook === '1') return;
        el.dataset.shellHook = '1';
        el.addEventListener('load', applyTelegramWebAppChrome);
        el.addEventListener('error', applyTelegramWebAppChrome);
      }
      bindElement(document.getElementById('telegram-webapp-sdk'));
      window.addEventListener('telegram-webapp-sdk-ready', applyTelegramWebAppChrome);
      window.addEventListener('telegram-webapp-sdk-error', applyTelegramWebAppChrome);
    })();

    // ── Constants — see scripts/app-constants.js ──
    // ── State ──
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth(); // 0-indexed
    var allShifts = [];
    var pendingDeleteId = null;
    var editingShiftId = null;
    var editReturnTab = 'shifts';
    var recentAddedShiftId = null;
    var recentAddTimer = null;
    var journalFocusShiftId = null;
    var journalFocusTimer = null;
    var selectedHomeCalendarDateKey = '';
    var activeTab = 'home';
    var hasRenderedInitialTab = false;
    var activeShiftMenuId = null;
    var activeShiftMenuScope = null;
    var SHIFT_LIST_REVEAL_DURATION_MS = 220;
    var SHIFT_LIST_REVEAL_DELAY_STEP_MS = 30;
    var suppressInitialListReveal = true;
    var shiftListRevealRegistry = Object.create(null);
    var shiftListRevealAutoId = 0;
    var SHIFT_SHARED_TRANSITION_MS = 300;
    var SHIFT_SHARED_TRANSITION_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
    var currentMonthShiftIncomeMap = Object.create(null);
    var shiftDetailState = {
      isOpen: false,
      isAnimating: false,
      shiftId: '',
      sourceShiftId: '',
      sourceListId: '',
      sourceTab: '',
      sourceCardEl: null,
      sourceScrollTop: 0,
      transitionToken: 0,
      shouldPopOnClose: false,
      skipNextPopstateClose: false,
      tapLockUntil: 0
    };
    // ── Viewport / Keyboard / Haptic — see scripts/viewport.js ──
    var APP_VERSION = '1.2.17';
    var INSTALL_PROMPT_STATE_STORAGE_KEY = 'shift_tracker_install_prompt_state_v1';
    var LEGACY_SETTINGS_STORAGE_KEY = 'shift_tracker_settings_v1';
    var SALARY_PARAMS_STORAGE_KEY = 'shift_tracker_salary_params_v1';
    var PROFILE_USER_COUNT_CACHE_STORAGE_KEY = 'shift_tracker_user_stats_cache_v1';
    var DEFAULT_SALARY_PARAMS = {
      tariffRate: 380,
      monthlyNormHours: 0,
      nightPercent: 40,
      classPercent: 5,
      zonePercent: 0,
      bamPercent: 0,
      districtPercent: 30,
      northPercent: 50,
      localPercent: 20,
      komPerTrip: 0,
      unionPercent: 0,
      welfarePercent: 0,
      alimonyPercent: 0
    };
    var salaryParamsStore = createSalaryParamsStore();
    var appSettings = salaryParamsStore.values;
    var salaryParamsSyncInFlight = null;
    var installPromptDismissed = false;
    var installPromptInstalled = false;
    var deferredInstallPromptEvent = null;
    var installGuideCopyFeedbackTimer = null;
    var telegramHomeScreenStatus = 'unchecked';
    var telegramHomeScreenBoundWebApp = null;
    var telegramHomeScreenAddedHandler = null;
    var telegramHomeScreenCheckedHandler = null;
    var INSTALL_GUIDE_COPY = {
      subtitle: 'Добавь приложение на домашний экран для быстрого запуска',
      warning: 'Если автоматическая установка недоступна, используй инструкцию ниже',
      telegramUnsupported: 'Этот Telegram-клиент не поддерживает добавление на главный экран — используй инструкцию ниже',
      telegramUnknown: 'Telegram не может проверить ярлык. Нажми ещё раз или используй инструкцию ниже',
      buttons: {
        open: 'Открыть в браузере',
        copy: 'Копировать',
        copied: 'Скопировано',
        error: 'Ошибка'
      },
      scenarios: {
        ios: {
          title: 'iPhone (Safari)',
          steps: [
            'Открой ссылку в <svg class="ig-browser-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="#1a73e8" stroke-width="1.5"/><path d="M10 1c0 0 3.5 3.5 3.5 9S10 19 10 19M10 1C10 1 6.5 4.5 6.5 10S10 19 10 19M1 10h18" stroke="#1a73e8" stroke-width="1.2"/></svg>&nbsp;Safari',
            'Нажми <svg class="ig-share-icon" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="8" width="14" height="12" rx="2" stroke="#1a73e8" stroke-width="1.5"/><path d="M10 1v12M7 4l3-3 3 3" stroke="#1a73e8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>&nbsp;Поделиться',
            'Выбери <svg class="ig-add-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="17" height="17" rx="3.5" stroke="#1a73e8" stroke-width="1.5"/><path d="M10 6v8M6 10h8" stroke="#1a73e8" stroke-width="1.5" stroke-linecap="round"/></svg>&nbsp;На экран Домой',
            'Нажми «Добавить»'
          ]
        },
        android: {
          title: 'Android (Chrome)',
          steps: [
            'Открой ссылку в <svg class="ig-browser-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 1A9 9 0 0 1 17.8 14.5L14.8 12.75A5.5 5.5 0 0 0 10 4.5Z" fill="#EA4335"/><path d="M17.8 14.5A9 9 0 0 1 2.2 14.5L5.2 12.75A5.5 5.5 0 0 0 14.8 12.75Z" fill="#FBBC05"/><path d="M2.2 14.5A9 9 0 0 1 10 1L10 4.5A5.5 5.5 0 0 0 5.2 12.75Z" fill="#34A853"/><circle cx="10" cy="10" r="5" fill="white"/><circle cx="10" cy="10" r="3.8" fill="#4285F4"/></svg>&nbsp;Chrome',
            'Нажми <svg class="ig-dots-icon" viewBox="0 0 6 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="3" cy="3" r="2" fill="#1a73e8"/><circle cx="3" cy="10" r="2" fill="#1a73e8"/><circle cx="3" cy="17" r="2" fill="#1a73e8"/></svg>',
            'Выбери «Установить приложение» или «Добавить на главный экран»',
            'Подтверди установку'
          ]
        }
      }
    };
    // ── Feature flags ──
    var PRO_MODE_ENABLED = false;
    var ACCESS_UNRESTRICTED = PRO_MODE_ENABLED !== true;
    var docsProUnlockedThisSession = ACCESS_UNRESTRICTED === true;
    var documentationStore = {
      activeTab: 'instructions',
      activeEntry: ''
    };
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
    var offlineBannerHideTimer = null;
    var offlineBannerDismissedKey = '';
    var offlineBannerVisibleKey = '';
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

    // Shared by offline subsystems that keep privacy-sensitive data in
    // per-account browser storage (for example field GPS captures).
    window.getOfflineStorageUserId = getOfflineStorageUserId;

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

    function isLegacyGeneratedShift(shift) {
      return !!(shift && (shift.schedule_generated || shift.isScheduleDerived || shift.schedule_period_id));
    }

    function stripLegacyPlannerFieldsFromShift(rawShift) {
      var source = cloneShiftForCache(rawShift) || {};
      delete source.schedule_generated;
      delete source.isScheduleDerived;
      delete source.schedule_period_id;
      delete source.schedule_origin_date_key;
      delete source.schedule_origin_period_id;
      delete source.schedule_code;
      delete source.scheduleDateKey;
      return source;
    }

    function normalizeShiftsForDisplay(shifts) {
      var sanitized = [];
      for (var i = 0; i < (shifts || []).length; i++) {
        if (isLegacyGeneratedShift(shifts[i])) continue;
        sanitized.push(stripLegacyPlannerFieldsFromShift(shifts[i]));
      }
      var normalized = clearPendingFlags(sanitized);
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

    function clearOfflineBannerHideTimer() {
      if (!offlineBannerHideTimer) return;
      clearTimeout(offlineBannerHideTimer);
      offlineBannerHideTimer = null;
    }

    function hideOfflineBanner(markDismissed) {
      var bannerEl = document.getElementById('offlineBanner');
      if (!bannerEl) return;
      clearOfflineBannerHideTimer();
      if (markDismissed && offlineBannerVisibleKey) {
        offlineBannerDismissedKey = offlineBannerVisibleKey;
      }
      offlineBannerVisibleKey = '';
      bannerEl.classList.remove('is-visible', 'is-danger', 'is-info');
      bannerEl.setAttribute('aria-hidden', 'true');
      window.setTimeout(function() {
        if (!bannerEl.classList.contains('is-visible')) {
          bannerEl.classList.add('hidden');
        }
      }, 230);
    }

    function bindOfflineBannerControls() {
      var bannerEl = document.getElementById('offlineBanner');
      var closeEl = document.getElementById('btnOfflineBannerClose');
      if (!bannerEl || !closeEl || bannerEl.dataset.bound === '1') return;
      bannerEl.dataset.bound = '1';
      closeEl.addEventListener('click', function() {
        hideOfflineBanner(true);
      });
    }

    function getOfflineBannerPayload() {
      var isOffline = !!offlineUiState.isOffline || !navigator.onLine;
      var hasPending = !!offlineUiState.hasPending || !!readPendingSnapshot();
      var isSyncing = !!offlineUiState.isSyncing;
      var status = offlineUiState.lastSyncStatus || 'idle';

      if (isSyncing) return null;
      if (isOffline) {
        return {
          key: 'offline',
          title: 'Нет сети',
          text: 'Работаем по сохранённым данным.',
          statusText: '',
          tone: 'danger',
          autoHideMs: 2800
        };
      }
      if (status === 'error') {
        return {
          key: 'error-' + String(offlineUiState.lastError || ''),
          title: 'Ошибка синхронизации',
          text: 'Сохранено локально, отправим автоматически.',
          statusText: 'Повторим',
          tone: 'danger',
          autoHideMs: 6500
        };
      }
      if (hasPending) return null;
      return null;
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

      bindOfflineBannerControls();
      var bannerEl = document.getElementById('offlineBanner');
      var titleEl = document.getElementById('offlineBannerTitle');
      var textEl = document.getElementById('offlineBannerText');
      var syncEl = document.getElementById('offlineSyncStatus');
      if (!bannerEl || !titleEl || !textEl || !syncEl) return;

      var payload = getOfflineBannerPayload();
      if (!payload) {
        offlineBannerDismissedKey = '';
        lastOfflineToastKey = '';
        hideOfflineBanner(false);
        return;
      }
      titleEl.textContent = payload.title;
      textEl.textContent = payload.text;
      syncEl.textContent = payload.statusText;
      syncEl.hidden = !payload.statusText || payload.statusText === payload.title;

      hideOfflineBanner(false);

      if (payload.key !== lastOfflineToastKey && (payload.key === 'offline' || String(payload.key || '').indexOf('error') === 0)) {
        lastOfflineToastKey = payload.key;
        var brief = payload.key === 'offline' ? 'Нет сети' : 'Не удалось сохранить';
        enqueueAppToast(brief, 'danger', Math.min(payload.autoHideMs || 2400, 2800));
      }
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
      merged.monthlyNormHours = parseFloat(merged.monthlyNormHours);
      merged.nightPercent = parseFloat(merged.nightPercent);
      merged.classPercent = parseFloat(merged.classPercent);
      merged.zonePercent = parseFloat(merged.zonePercent);
      merged.bamPercent = parseFloat(merged.bamPercent);
      merged.districtPercent = parseFloat(merged.districtPercent);
      merged.northPercent = parseFloat(merged.northPercent);
      merged.localPercent = parseFloat(merged.localPercent);
      merged.komPerTrip = parseFloat(merged.komPerTrip);
      merged.unionPercent = parseFloat(merged.unionPercent);
      merged.welfarePercent = parseFloat(merged.welfarePercent);
      merged.alimonyPercent = parseFloat(merged.alimonyPercent);

      if (isNaN(merged.tariffRate)) merged.tariffRate = DEFAULT_SALARY_PARAMS.tariffRate;
      if (isNaN(merged.monthlyNormHours)) merged.monthlyNormHours = DEFAULT_SALARY_PARAMS.monthlyNormHours;
      merged.monthlyNormHours = 0;
      if (isNaN(merged.nightPercent)) merged.nightPercent = DEFAULT_SALARY_PARAMS.nightPercent;
      if (isNaN(merged.classPercent)) merged.classPercent = DEFAULT_SALARY_PARAMS.classPercent;
      if (isNaN(merged.zonePercent)) merged.zonePercent = DEFAULT_SALARY_PARAMS.zonePercent;
      if (isNaN(merged.bamPercent)) merged.bamPercent = DEFAULT_SALARY_PARAMS.bamPercent;
      if (isNaN(merged.districtPercent)) merged.districtPercent = DEFAULT_SALARY_PARAMS.districtPercent;
      if (isNaN(merged.northPercent)) merged.northPercent = DEFAULT_SALARY_PARAMS.northPercent;
      if (isNaN(merged.localPercent)) merged.localPercent = DEFAULT_SALARY_PARAMS.localPercent;
      if (isNaN(merged.komPerTrip)) merged.komPerTrip = DEFAULT_SALARY_PARAMS.komPerTrip;
      if (isNaN(merged.unionPercent)) merged.unionPercent = DEFAULT_SALARY_PARAMS.unionPercent;
      if (isNaN(merged.welfarePercent)) merged.welfarePercent = DEFAULT_SALARY_PARAMS.welfarePercent;
      if (isNaN(merged.alimonyPercent)) merged.alimonyPercent = DEFAULT_SALARY_PARAMS.alimonyPercent;
      merged.unionPercent = Math.max(0, Math.min(100, merged.unionPercent));
      merged.welfarePercent = Math.max(0, Math.min(100, merged.welfarePercent));
      merged.alimonyPercent = Math.max(0, Math.min(100, merged.alimonyPercent));
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

    function applySalaryParamsFromServer(payload, shouldRender) {
      var normalized = normalizeSalaryParams(payload || {});
      salaryParamsStore.values = normalized;
      saveSalaryParams(normalized);
      appSettings = salaryParamsStore.values;
      updateSettingsControls();
      if (shouldRender !== false && typeof render === 'function') render();
      return normalized;
    }

    function loadSalaryParamsFromServer() {
      if (!navigator.onLine || typeof fetchJson !== 'function' || !SALARY_PARAMS_API_URL) {
        return Promise.resolve(null);
      }
      return fetchJson(SALARY_PARAMS_API_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 4500).then(function(result) {
        if (result.ok && result.body && result.body.salaryParams) {
          return applySalaryParamsFromServer(result.body.salaryParams, true);
        }
        return null;
      }).catch(function() {
        return null;
      });
    }

    function syncSalaryParamsToServer(params) {
      var normalized = normalizeSalaryParams(params || appSettings || DEFAULT_SALARY_PARAMS);
      if (!navigator.onLine || typeof fetchJson !== 'function' || !SALARY_PARAMS_API_URL) {
        return Promise.resolve(null);
      }
      if (salaryParamsSyncInFlight) return salaryParamsSyncInFlight;
      salaryParamsSyncInFlight = fetchJson(SALARY_PARAMS_API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ salaryParams: normalized })
      }, 4500).then(function(result) {
        salaryParamsSyncInFlight = null;
        if (result.ok && result.body && result.body.salaryParams) {
          return applySalaryParamsFromServer(result.body.salaryParams, false);
        }
        return null;
      }).catch(function() {
        salaryParamsSyncInFlight = null;
        return null;
      });
      return salaryParamsSyncInFlight;
    }

    function normalizeDateKey(dateKey) {
      if (typeof dateKey !== 'string') return '';
      var safe = dateKey.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return '';
      var year = parseInt(safe.substring(0, 4), 10);
      var month = parseInt(safe.substring(5, 7), 10);
      var day = parseInt(safe.substring(8, 10), 10);
      var probe = new Date(Date.UTC(year, month - 1, day));
      if (!isFinite(probe.getTime())) return '';
      if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return '';
      return safe;
    }

    function normalizeTimeValue(timeValue, fallback) {
      var raw = typeof timeValue === 'string' ? timeValue.trim() : '';
      if (!/^\d{2}:\d{2}$/.test(raw)) return typeof fallback === 'string' ? fallback : '';
      var hours = parseInt(raw.substring(0, 2), 10);
      var minutes = parseInt(raw.substring(3, 5), 10);
      if (!isFinite(hours) || !isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return typeof fallback === 'string' ? fallback : '';
      }
      return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    function getTodayDateKey() {
      return formatMskDatePart(new Date());
    }

    function parseDateKeyUtc(dateKey) {
      var safe = normalizeDateKey(dateKey);
      if (!safe) return NaN;
      return Date.UTC(parseInt(safe.substring(0, 4), 10), parseInt(safe.substring(5, 7), 10) - 1, parseInt(safe.substring(8, 10), 10));
    }

    function formatUtcDateKey(date) {
      if (!(date instanceof Date) || !isFinite(date.getTime())) return '';
      var year = date.getUTCFullYear();
      var month = String(date.getUTCMonth() + 1).padStart(2, '0');
      var day = String(date.getUTCDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }

    function getDateKeyByOffset(dateKey, offsetDays) {
      var baseTs = parseDateKeyUtc(dateKey);
      if (!isFinite(baseTs)) return '';
      return formatUtcDateKey(new Date(baseTs + (Number(offsetDays) || 0) * 86400000));
    }

    function compareDateKeys(a, b) {
      var left = normalizeDateKey(a);
      var right = normalizeDateKey(b);
      if (!left && !right) return 0;
      if (!left) return -1;
      if (!right) return 1;
      if (left > right) return 1;
      if (left < right) return -1;
      return 0;
    }

    function getShiftsForDate(dateKey) {
      var safeDate = normalizeDateKey(dateKey);
      if (!safeDate) return [];
      var result = [];
      for (var i = 0; i < allShifts.length; i++) {
        var shift = allShifts[i];
        var startDate = normalizeDateKey(shift && shift.start_msk ? shift.start_msk.substring(0, 10) : '');
        var endDate = normalizeDateKey(shift && shift.end_msk ? shift.end_msk.substring(0, 10) : '') || startDate;
        if (!startDate) continue;
        if (compareDateKeys(startDate, safeDate) <= 0 && compareDateKeys(endDate, safeDate) >= 0) {
          result.push(shift);
        }
      }
      result.sort(compareShiftsByStartDesc);
      return result;
    }

    function buildMonthCalculationShifts(year, month0, bounds) {
      var actualShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (isLegacyGeneratedShift(allShifts[i])) continue;
        if (shiftMinutesInRange(allShifts[i], bounds.start, bounds.end) <= 0) continue;
        actualShifts.push(allShifts[i]);
      }

      actualShifts.sort(compareShiftsByStartDesc);
      return {
        actualShifts: actualShifts,
        calculationShifts: actualShifts.slice()
      };
    }

    function buildPresetShiftEndDate(dateKey, startTime, endTime) {
      var safeDate = normalizeDateKey(dateKey) || getTodayDateKey();
      var safeStart = normalizeTimeValue(startTime, '01:00');
      var safeEnd = normalizeTimeValue(endTime, '13:00');
      if (!safeStart || !safeEnd) return safeDate;
      return safeEnd > safeStart ? safeDate : getDateKeyByOffset(safeDate, 1);
    }

    function openAddShiftForDate(dateKey, options) {
      var safeDate = normalizeDateKey(dateKey) || getTodayDateKey();
      var opts = options || {};
      if (editingShiftId) {
        exitEditMode('home');
      } else {
        setFormMode('add');
      }
      clearErrors();
      clearOptionalShiftData();
      document.getElementById('inputStartDate').value = safeDate;
      document.getElementById('inputStartTime').value = normalizeTimeValue(opts.startTime, '01:00');
      document.getElementById('inputEndDate').value = buildPresetShiftEndDate(safeDate, document.getElementById('inputStartTime').value, normalizeTimeValue(opts.endTime, '13:00'));
      document.getElementById('inputEndTime').value = normalizeTimeValue(opts.endTime, '13:00');
      setRouteType(opts.routeKind === 'trip' ? 'trip' : 'depot');
      renderDraftShiftSummary();
      setActiveTab('add');
      window.setTimeout(function() {
        var formSection = document.getElementById('shiftFormSection');
        if (formSection && formSection.scrollIntoView) {
          formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 40);
    }

    function openShiftsForDate(dateKey, preferredShiftId) {
      var safeDate = normalizeDateKey(dateKey) || getTodayDateKey();
      var targetId = preferredShiftId || '';
      if (!targetId) {
        var dayShifts = getShiftsForDate(safeDate);
        targetId = dayShifts[0] && dayShifts[0].id ? dayShifts[0].id : '';
      }
      var targetYear = parseInt(safeDate.substring(0, 4), 10);
      var targetMonth = parseInt(safeDate.substring(5, 7), 10) - 1;
      if (isFinite(targetYear) && isFinite(targetMonth) && targetMonth >= 0 && targetMonth <= 11) {
        currentYear = targetYear;
        currentMonth = targetMonth;
      }
      journalFocusShiftId = targetId || null;
      if (journalFocusTimer) {
        clearTimeout(journalFocusTimer);
        journalFocusTimer = null;
      }
      if (typeof render === 'function') {
        render();
      }
      setActiveTab('shifts');
      window.setTimeout(function() {
        var listEl = document.getElementById('shiftsList');
        if (!listEl) return;
        var selector = targetId
          ? '.shift-item[data-shift-id="' + String(targetId).replace(/"/g, '\\"') + '"]'
          : '.shift-item';
        var targetCard = listEl.querySelector(selector);
        if (targetCard && targetCard.scrollIntoView) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (journalFocusShiftId) {
          journalFocusTimer = window.setTimeout(function() {
            journalFocusShiftId = null;
            journalFocusTimer = null;
            if (typeof render === 'function') render();
          }, 2200);
        }
      }, 80);
    }

    function formatRub(value) {
      var rounded = Math.round(value || 0);
      return rounded.toLocaleString('ru-RU') + ' ₽';
    }

    function formatMonthIncomeLabel(month0) {
      var monthName = MONTH_NAMES[month0];
      if (!monthName) return 'Примерно за месяц';
      return 'Примерно за ' + monthName.toLowerCase();
    }

    function logInstallDebug(message, payload) {
      if (!window.console || typeof console.debug !== 'function') return;
      if (payload === undefined) {
        console.debug('[PWA install]', message);
        return;
      }
      console.debug('[PWA install]', message, payload);
    }

    function loadInstallPromptState() {
      try {
        var raw = localStorage.getItem(INSTALL_PROMPT_STATE_STORAGE_KEY);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        installPromptInstalled = parsed.installed === true;
      } catch (e) {
        console.warn('[PWA install] Failed to load install state', e);
      }
    }

    function saveInstallPromptState() {
      try {
        localStorage.setItem(INSTALL_PROMPT_STATE_STORAGE_KEY, JSON.stringify({
          installed: installPromptInstalled === true
        }));
      } catch (e) {}
    }

    function detectInstallGuidePlatform() {
      var ua = navigator.userAgent || '';
      var platform = (navigator.platform || '').toLowerCase();
      var iosByUa = /iPad|iPhone|iPod/i.test(ua);
      var iosByTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      if (iosByUa || iosByTouchMac) return 'ios';
      if (/Android/i.test(ua)) return 'android';
      if (/Windows|Macintosh|Linux|CrOS/i.test(ua) || /win|mac|linux/.test(platform)) return 'desktop';
      return 'unknown';
    }

    function getInstallGuideScenarioKey(platform) {
      if (platform === 'ios' || platform === 'android') {
        return platform;
      }
      return 'ios';
    }

    function getInstallGuideScenario(scenarioKey) {
      return INSTALL_GUIDE_COPY.scenarios[scenarioKey] || INSTALL_GUIDE_COPY.scenarios.ios;
    }

    function formatInstallGuideUrlDisplay(url) {
      if (!url) return '';
      try {
        var parsed = new URL(url);
        var host = parsed.host || '';
        var path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') : '';
        var compact = host + path;
        if (!compact) compact = url;
        return compact.length > 52 ? (compact.slice(0, 49) + '...') : compact;
      } catch (e) {
        return url.length > 52 ? (url.slice(0, 49) + '...') : url;
      }
    }

    function setInstallGuideUrl(url) {
      var appUrlEl = document.getElementById('appUrl');
      if (!appUrlEl) return;
      appUrlEl.textContent = formatInstallGuideUrlDisplay(url);
      appUrlEl.setAttribute('title', url);
      appUrlEl.dataset.fullUrl = url;
    }

    function renderInstallGuideScenarios(primaryScenarioKey) {
      var platformsEl = document.getElementById('installGuidePlatforms');
      if (!platformsEl) return;

      var secondaryScenarioKey = primaryScenarioKey === 'android' ? 'ios' : 'android';
      var orderedScenarios = [primaryScenarioKey, secondaryScenarioKey];

      platformsEl.innerHTML = '';

      for (var i = 0; i < orderedScenarios.length; i++) {
        var scenario = getInstallGuideScenario(orderedScenarios[i]);
        var card = document.createElement('div');
        card.className = 'install-guide-card ' + (i === 0 ? 'is-primary' : 'is-secondary');

        var titleEl = document.createElement('div');
        titleEl.className = 'install-guide-card-title';
        titleEl.textContent = scenario.title;
        card.appendChild(titleEl);

        var stepsEl = document.createElement('ol');
        stepsEl.className = 'install-guide-steps';
        for (var j = 0; j < scenario.steps.length; j++) {
          var item = document.createElement('li');
          item.innerHTML = scenario.steps[j];
          stepsEl.appendChild(item);
        }
        card.appendChild(stepsEl);

        platformsEl.appendChild(card);
      }
    }

    function setInstallGuideCopyFeedback(isSuccess) {
      var btn = document.getElementById('btnCopyUrl');
      if (!btn) return;
      resetInstallGuideCopyFeedback();

      btn.classList.remove('is-success', 'is-error');
      if (isSuccess) {
        btn.textContent = INSTALL_GUIDE_COPY.buttons.copied;
        btn.classList.add('is-success');
      } else {
        btn.textContent = INSTALL_GUIDE_COPY.buttons.error;
        btn.classList.add('is-error');
      }

      installGuideCopyFeedbackTimer = window.setTimeout(function() {
        btn.textContent = INSTALL_GUIDE_COPY.buttons.copy;
        btn.classList.remove('is-success', 'is-error');
        installGuideCopyFeedbackTimer = null;
      }, 1400);
    }

    function resetInstallGuideCopyFeedback() {
      if (installGuideCopyFeedbackTimer) {
        window.clearTimeout(installGuideCopyFeedbackTimer);
        installGuideCopyFeedbackTimer = null;
      }
      var btn = document.getElementById('btnCopyUrl');
      if (!btn) return;
      btn.textContent = INSTALL_GUIDE_COPY.buttons.copy;
      btn.classList.remove('is-success', 'is-error');
    }

    function hasDeferredInstallPrompt() {
      return !!(deferredInstallPromptEvent && typeof deferredInstallPromptEvent.prompt === 'function');
    }

    function getTelegramWebApp() {
      try {
        return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
      } catch (e) {
        return null;
      }
    }

    function normalizeTelegramHomeScreenStatus(value) {
      var status = value && typeof value === 'object' ? value.status : value;
      status = String(status || '').toLowerCase();
      if (status === 'unsupported' || status === 'unknown' || status === 'added' || status === 'missed') {
        return status;
      }
      return 'unchecked';
    }

    function setTelegramHomeScreenStatus(value) {
      var status = normalizeTelegramHomeScreenStatus(value);
      if (status === 'unchecked') return;
      telegramHomeScreenStatus = status;
      if (status === 'added') {
        installPromptInstalled = true;
        installPromptDismissed = true;
        deferredInstallPromptEvent = null;
        saveInstallPromptState();
      } else if (status === 'missed') {
        installPromptInstalled = false;
        saveInstallPromptState();
      }
      renderInstallPromptCard();
      updateInstallGuideContent();
    }

    function supportsTelegramHomeScreenApi(webApp) {
      var tg = webApp || getTelegramWebApp();
      if (!tg || typeof tg.addToHomeScreen !== 'function') return false;
      try {
        if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('8.0')) return false;
      } catch (e) {
        return false;
      }
      return true;
    }

    function checkTelegramHomeScreenStatus() {
      var tg = getTelegramWebApp();
      if (!supportsTelegramHomeScreenApi(tg) || typeof tg.checkHomeScreenStatus !== 'function') return false;
      try {
        tg.checkHomeScreenStatus(function(status) {
          setTelegramHomeScreenStatus(status);
        });
        return true;
      } catch (error) {
        console.warn('[Telegram home screen] Status check failed', error);
        return false;
      }
    }

    function setupTelegramHomeScreenIntegration() {
      var tg = getTelegramWebApp();
      if (!tg) return false;

      if (telegramHomeScreenBoundWebApp !== tg) {
        if (telegramHomeScreenBoundWebApp && typeof telegramHomeScreenBoundWebApp.offEvent === 'function') {
          try {
            if (telegramHomeScreenAddedHandler) telegramHomeScreenBoundWebApp.offEvent('homeScreenAdded', telegramHomeScreenAddedHandler);
            if (telegramHomeScreenCheckedHandler) telegramHomeScreenBoundWebApp.offEvent('homeScreenChecked', telegramHomeScreenCheckedHandler);
          } catch (unbindError) {}
        }

        telegramHomeScreenAddedHandler = function() {
          logInstallDebug('Telegram homeScreenAdded event received');
          setTelegramHomeScreenStatus('added');
          if (typeof closeOverlay === 'function') closeOverlay('overlayAddScreen');
          if (typeof showSaveToast === 'function') showSaveToast('Добавлено на главный экран', 'success');
        };
        telegramHomeScreenCheckedHandler = function(event) {
          setTelegramHomeScreenStatus(event);
        };
        telegramHomeScreenBoundWebApp = tg;

        if (typeof tg.onEvent === 'function') {
          try {
            tg.onEvent('homeScreenAdded', telegramHomeScreenAddedHandler);
            tg.onEvent('homeScreenChecked', telegramHomeScreenCheckedHandler);
          } catch (bindError) {
            console.warn('[Telegram home screen] Event binding failed', bindError);
          }
        }
      }

      checkTelegramHomeScreenStatus();
      return supportsTelegramHomeScreenApi(tg);
    }

    function requestTelegramHomeScreenInstall() {
      var tg = getTelegramWebApp();
      if (!supportsTelegramHomeScreenApi(tg) || telegramHomeScreenStatus === 'unsupported') {
        return { handled: false, outcome: 'unavailable' };
      }
      if (telegramHomeScreenStatus === 'added') {
        setTelegramHomeScreenStatus('added');
        return { handled: true, outcome: 'already-added' };
      }
      try {
        tg.addToHomeScreen();
        logInstallDebug('Telegram addToHomeScreen requested', telegramHomeScreenStatus);
        return { handled: true, outcome: 'requested' };
      } catch (error) {
        console.warn('[Telegram home screen] Add request failed', error);
        return { handled: false, outcome: 'error', error: error };
      }
    }

    function updateInstallGuideContent() {
      var platform = detectInstallGuidePlatform();
      var primaryScenario = getInstallGuideScenarioKey(platform);

      var subtitleEl = document.getElementById('installGuideSubtitle');
      if (subtitleEl) subtitleEl.textContent = INSTALL_GUIDE_COPY.subtitle;

      renderInstallGuideScenarios(primaryScenario);

      var noteEl = document.getElementById('installGuideRuntimeNote');
      if (!noteEl) return;
      if (telegramHomeScreenStatus === 'unsupported') {
        noteEl.textContent = INSTALL_GUIDE_COPY.telegramUnsupported;
      } else if (telegramHomeScreenStatus === 'unknown') {
        noteEl.textContent = INSTALL_GUIDE_COPY.telegramUnknown;
      } else {
        noteEl.textContent = INSTALL_GUIDE_COPY.warning;
      }
      noteEl.classList.remove('hidden');
    }

    function maybeShowNativeInstallPrompt() {
      if (!hasDeferredInstallPrompt()) {
        logInstallDebug('Native install prompt unavailable. Falling back to guide.');
        return Promise.resolve({ outcome: 'unavailable' });
      }

      var promptEvent = deferredInstallPromptEvent;
      deferredInstallPromptEvent = null;
      renderInstallPromptCard();

      return Promise.resolve()
        .then(function() {
          return promptEvent.prompt();
        })
        .then(function() {
          if (promptEvent.userChoice && typeof promptEvent.userChoice.then === 'function') {
            return promptEvent.userChoice;
          }
          return { outcome: 'unknown' };
        })
        .then(function(choice) {
          var outcome = choice && choice.outcome ? choice.outcome : 'unknown';
          logInstallDebug('Native prompt outcome', outcome);
          if (outcome === 'accepted') {
            installPromptInstalled = true;
            installPromptDismissed = true;
            saveInstallPromptState();
            renderInstallPromptCard();
          }
          return { outcome: outcome };
        })
        .catch(function(error) {
          console.warn('[PWA install] Native install prompt failed', error);
          return { outcome: 'error', error: error };
        });
    }

    function shouldShowInstallPromptCard() {
      return !isStandalonePwa() && !installPromptDismissed && !installPromptInstalled;
    }

    function renderInstallPromptCard() {
      var card = document.getElementById('installPromptCard');
      if (card) card.classList.toggle('hidden', !shouldShowInstallPromptCard());
      // Profile install entry: a permanent menu item, shown unless the app is
      // already installed (standalone). Unlike the popup, it ignores "dismissed".
      var profileInstall = document.getElementById('profileInstallSection');
      if (profileInstall) profileInstall.classList.toggle('hidden', isStandalonePwa() || installPromptInstalled || telegramHomeScreenStatus === 'added');
    }

    function dismissInstallPromptCard() {
      installPromptDismissed = true;
      renderInstallPromptCard();
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
      setSettingsInputValue('settingZonePercent', appSettings.zonePercent);
      setSettingsInputValue('settingBamPercent', appSettings.bamPercent);
      setSettingsInputValue('settingDistrictPercent', appSettings.districtPercent);
      setSettingsInputValue('settingNorthPercent', appSettings.northPercent);
      setSettingsInputValue('settingLocalPercent', appSettings.localPercent);
      setSettingsInputValue('settingKomPerTrip', appSettings.komPerTrip);
      setSettingsInputValue('settingUnionPercent', appSettings.unionPercent);
      setSettingsInputValue('settingWelfarePercent', appSettings.welfarePercent);
      setSettingsInputValue('settingAlimonyPercent', appSettings.alimonyPercent);

      var versionValue = document.getElementById('appVersionValue');
      if (versionValue) versionValue.textContent = APP_VERSION;
      updateFooter();
    }

    function syncSettingsFromInputs() {
      var tariffEl = document.getElementById('settingTariff');
      var nightEl = document.getElementById('settingNightPercent');
      var classEl = document.getElementById('settingClassPercent');
      var zoneEl = document.getElementById('settingZonePercent');
      var bamEl = document.getElementById('settingBamPercent');
      var districtEl = document.getElementById('settingDistrictPercent');
      var northEl = document.getElementById('settingNorthPercent');
      var localEl = document.getElementById('settingLocalPercent');
      var komEl = document.getElementById('settingKomPerTrip');
      var unionEl = document.getElementById('settingUnionPercent');
      var welfareEl = document.getElementById('settingWelfarePercent');
      var alimonyEl = document.getElementById('settingAlimonyPercent');

      var tariff = tariffEl ? parseFloat(tariffEl.value) : NaN;
      var night = nightEl ? parseFloat(nightEl.value) : NaN;
      var klass = classEl ? parseFloat(classEl.value) : NaN;
      var zone = zoneEl ? parseFloat(zoneEl.value) : NaN;
      var bam = bamEl ? parseFloat(bamEl.value) : NaN;
      var district = districtEl ? parseFloat(districtEl.value) : NaN;
      var north = northEl ? parseFloat(northEl.value) : NaN;
      var local = localEl ? parseFloat(localEl.value) : NaN;
      var kom = komEl ? parseFloat(komEl.value) : NaN;
      var union = unionEl ? parseFloat(unionEl.value) : NaN;
      var welfare = welfareEl ? parseFloat(welfareEl.value) : NaN;
      var alimony = alimonyEl ? parseFloat(alimonyEl.value) : NaN;

      appSettings.tariffRate = isNaN(tariff) ? DEFAULT_SALARY_PARAMS.tariffRate : tariff;
      appSettings.monthlyNormHours = 0;
      appSettings.nightPercent = isNaN(night) ? DEFAULT_SALARY_PARAMS.nightPercent : night;
      appSettings.classPercent = isNaN(klass) ? DEFAULT_SALARY_PARAMS.classPercent : klass;
      appSettings.zonePercent = isNaN(zone) ? DEFAULT_SALARY_PARAMS.zonePercent : zone;
      appSettings.bamPercent = isNaN(bam) ? DEFAULT_SALARY_PARAMS.bamPercent : bam;
      appSettings.districtPercent = isNaN(district) ? DEFAULT_SALARY_PARAMS.districtPercent : district;
      appSettings.northPercent = isNaN(north) ? DEFAULT_SALARY_PARAMS.northPercent : north;
      appSettings.localPercent = isNaN(local) ? DEFAULT_SALARY_PARAMS.localPercent : local;
      appSettings.komPerTrip = isNaN(kom) ? DEFAULT_SALARY_PARAMS.komPerTrip : kom;
      appSettings.unionPercent = isNaN(union) ? DEFAULT_SALARY_PARAMS.unionPercent : Math.max(0, Math.min(100, union));
      appSettings.welfarePercent = isNaN(welfare) ? DEFAULT_SALARY_PARAMS.welfarePercent : Math.max(0, Math.min(100, welfare));
      appSettings.alimonyPercent = isNaN(alimony) ? DEFAULT_SALARY_PARAMS.alimonyPercent : Math.max(0, Math.min(100, alimony));

      salaryParamsStore.update(appSettings);
      appSettings = salaryParamsStore.values;
      syncSalaryParamsToServer(appSettings);
      render();
    }

    function bindSettingsControls() {
      // Settings are applied explicitly via the "Сохранить" button.
    }

    function moneyFromHours(hours, rate, percent) {
      return (hours || 0) * (rate || 0) * ((percent || 0) / 100);
    }

    function roundSalaryHours(hours) {
      var value = Number(hours) || 0;
      return Math.round(value * 100) / 100;
    }

    function getSalaryMonthlyNormHours(year, month0) {
      var override = Number(appSettings.monthlyNormHours) || 0;
      if (override > 0) return override;
      var monthKey = year + '-' + String(month0 + 1).padStart(2, '0');
      var normFromTableHours = typeof WORK_NORMS !== 'undefined' ? WORK_NORMS[monthKey] : 0;
      var baseNormMin = normFromTableHours !== undefined ? (normFromTableHours * 60) : 0;
      if (typeof getMonthNormSnapshot === 'function') {
        return roundSalaryHours(getMonthNormSnapshot(year, month0, baseNormMin).monthNormMin / 60);
      }
      return roundSalaryHours(baseNormMin / 60);
    }

    function calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin, normHours, shiftCount) {
      var workedHours = totalMin / 60;
      var nightHours = nightMin / 60;
      var holidayHours = holidayMin / 60;
      var tariffRate = appSettings.tariffRate;
      var safeNormHours = Math.max(0, Number(normHours) || 0);
      var overNormHours = safeNormHours > 0 && workedHours > safeNormHours
        ? roundSalaryHours(workedHours - safeNormHours)
        : 0;
      var travelOvertimeHours = 0;
      var extraOvertimeHours = overNormHours;
      var regularHours = Math.max(0, workedHours - overNormHours);
      var monthlyBaseAmount = workedHours * tariffRate;
      var tariffAmount = regularHours * tariffRate;
      var nightAmount = moneyFromHours(nightHours, tariffRate, appSettings.nightPercent);
      var harmfulConditionsAmount = monthlyBaseAmount * 0.04;
      var overtimeAmount = overNormHours * tariffRate;
      var travelOvertimeAmount = travelOvertimeHours * tariffRate * 0.5;
      var extraOvertimeAmount = extraOvertimeHours * tariffRate;
      var classAmount = moneyFromHours(workedHours, tariffRate, appSettings.classPercent);
      var holidayAmount = holidayHours > 0 ? moneyFromHours(holidayHours, tariffRate, 100) : 0;
      var zoneAmount = monthlyBaseAmount * (appSettings.zonePercent / 100);
      var bamAmount = monthlyBaseAmount * (appSettings.bamPercent / 100);
      var komAmount = Math.max(0, Number(shiftCount) || 0) * (Number(appSettings.komPerTrip) || 0);
      var baseAmount = tariffAmount + nightAmount + harmfulConditionsAmount + classAmount + holidayAmount +
        overtimeAmount + travelOvertimeAmount + extraOvertimeAmount + zoneAmount + bamAmount;
      var districtAmount = baseAmount * (appSettings.districtPercent / 100);
      var northAmount = baseAmount * (appSettings.northPercent / 100);
      var localAmount = baseAmount * (appSettings.localPercent / 100);
      var coeffTotal = districtAmount + northAmount + localAmount;
      var accruedAmount = baseAmount + coeffTotal + komAmount;
      var ndflBase = baseAmount * 0.13;
      var ndflCoeffs = coeffTotal * 0.13;
      var netBeforeAlimonyAmount = accruedAmount - ndflBase - ndflCoeffs;
      var alimonyAmount = netBeforeAlimonyAmount * (appSettings.alimonyPercent / 100);
      var contributionBaseAmount = baseAmount + coeffTotal;
      var unionAmount = contributionBaseAmount * (appSettings.unionPercent / 100);
      var welfareAmount = contributionBaseAmount * (appSettings.welfarePercent / 100);
      var netAmount = netBeforeAlimonyAmount - alimonyAmount - unionAmount - welfareAmount;

      return {
        workedHours: workedHours,
        normHours: safeNormHours,
        regularHours: regularHours,
        overNormHours: overNormHours,
        travelOvertimeHours: travelOvertimeHours,
        extraOvertimeHours: extraOvertimeHours,
        nightHours: nightHours,
        holidayHours: holidayHours,
        tariffAmount: tariffAmount,
        nightAmount: nightAmount,
        harmfulConditionsAmount: harmfulConditionsAmount,
        overtimeAmount: overtimeAmount,
        travelOvertimeAmount: travelOvertimeAmount,
        extraOvertimeAmount: extraOvertimeAmount,
        classAmount: classAmount,
        holidayAmount: holidayAmount,
        zoneAmount: zoneAmount,
        bamAmount: bamAmount,
        komAmount: komAmount,
        baseAmount: baseAmount,
        districtAmount: districtAmount,
        northAmount: northAmount,
        localAmount: localAmount,
        coeffTotal: coeffTotal,
        accruedAmount: accruedAmount,
        ndflBase: ndflBase,
        ndflCoeffs: ndflCoeffs,
        netBeforeAlimonyAmount: netBeforeAlimonyAmount,
        alimonyAmount: alimonyAmount,
        contributionBaseAmount: contributionBaseAmount,
        unionAmount: unionAmount,
        welfareAmount: welfareAmount,
        netAmount: netAmount
      };
    }

    function formatProfileUserCount(totalUsers) {
      var value = Math.max(0, Math.floor(Number(totalUsers) || 0));
      try {
        return value.toLocaleString('ru-RU');
      } catch (error) {
        return String(value);
      }
    }

    function readProfileUserCountCache() {
      try {
        var cached = JSON.parse(localStorage.getItem(PROFILE_USER_COUNT_CACHE_STORAGE_KEY) || 'null');
        var total = cached && Number(cached.totalUsers);
        return isFinite(total) && total >= 0 ? Math.floor(total) : null;
      } catch (error) {
        return null;
      }
    }

    function renderProfileUserCount(totalUsers) {
      var el = document.getElementById('profileUserCount');
      if (!el) return;
      if (totalUsers !== null && totalUsers !== undefined) {
        el.textContent = formatProfileUserCount(totalUsers);
        return;
      }
      el.textContent = '—';
    }

    function refreshProfileUserCount() {
      var cachedTotal = readProfileUserCountCache();
      if (cachedTotal !== null) renderProfileUserCount(cachedTotal);
      if (!navigator.onLine || typeof fetchJson !== 'function') {
        if (cachedTotal === null) renderProfileUserCount(null);
        return Promise.resolve(null);
      }
      return fetchJson(API_BASE_URL + '/api/stats', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 4500).then(function(result) {
        var total = result && result.ok && result.body ? Number(result.body.totalUsers) : NaN;
        if (!isFinite(total) || total < 0) {
          if (cachedTotal === null) renderProfileUserCount(null);
          return null;
        }
        total = Math.floor(total);
        try {
          localStorage.setItem(PROFILE_USER_COUNT_CACHE_STORAGE_KEY, JSON.stringify({
            totalUsers: total,
            updatedAt: result.body.updatedAt || new Date().toISOString()
          }));
        } catch (error) {}
        renderProfileUserCount(total);
        return total;
      }).catch(function() {
        if (cachedTotal === null) renderProfileUserCount(null);
        return null;
      });
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

      return calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin, getSalaryMonthlyNormHours(currentYear, currentMonth), monthShifts.length);
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

    function buildMonthShiftDurationLevelMap(monthShifts, bounds) {
      var durationMap = {};
      if (!monthShifts || !monthShifts.length || !bounds) return durationMap;
      var bestId = '';
      var worstId = '';
      var bestMinutes = -1;
      var worstMinutes = Number.POSITIVE_INFINITY;
      var validCount = 0;

      for (var i = 0; i < monthShifts.length; i++) {
        var shift = monthShifts[i];
        var durationMin = shiftMinutesInRange(shift, bounds.start, bounds.end);
        var shiftId = String(shift.id);
        durationMap[shiftId] = {
          minutes: durationMin,
          level: 'medium'
        };
        if (durationMin <= 0) continue;
        validCount += 1;
        if (durationMin > bestMinutes) {
          bestMinutes = durationMin;
          bestId = shiftId;
        }
        if (durationMin < worstMinutes) {
          worstMinutes = durationMin;
          worstId = shiftId;
        }
      }

      if (validCount < 2) return durationMap;
      if (!bestId || !worstId) return durationMap;
      if (bestMinutes === worstMinutes) return durationMap;

      durationMap[bestId].level = 'high';
      durationMap[worstId].level = 'low';

      if (bestId === worstId) {
        durationMap[bestId].level = 'medium';
      }

      return durationMap;
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

    // ── Documentation & PDF Viewer — see scripts/docs-app.js ──
    var saveToastHideTimer = null;
    var saveToastDoneTimer = null;
    var appToastQueue = [];
    var appToastBusy = false;
    var lastOfflineToastKey = '';
    var ACTION_TOAST_CONFIG = {
      added: { text: 'Добавлено', tone: 'success' },
      saved: { text: 'Сохранено', tone: 'info' },
      canceled: { text: 'Отменено', tone: 'neutral' },
      deleted: { text: 'Удалено', tone: 'danger' }
    };

    function normalizeToastTone(tone) {
      var value = String(tone || '').toLowerCase();
      if (value === 'success' || value === 'info' || value === 'neutral' || value === 'danger') return value;
      return 'success';
    }

    function getToastIconByTone(tone) {
      if (tone === 'info') return 'i';
      if (tone === 'neutral') return '~';
      if (tone === 'danger') return '!';
      return '✓';
    }

    function tryPumpAppToastQueue() {
      if (appToastBusy) return;
      if (!appToastQueue.length) return;
      appToastBusy = true;
      var item = appToastQueue.shift();
      showSaveToastImmediate(item.text, item.tone, item.duration, function() {
        appToastBusy = false;
        tryPumpAppToastQueue();
      });
    }

    function enqueueAppToast(text, tone, durationMs) {
      var normalizedTone = normalizeToastTone(tone);
      var dur = durationMs;
      if (!isFinite(dur) || dur <= 0) dur = 1800;
      dur = Math.max(900, Math.min(dur, 6200));
      var brief = String(text || '').trim();
      if (brief.length > 96) brief = brief.slice(0, 93) + '…';
      appToastQueue.push({ text: brief || 'Готово', tone: normalizedTone, duration: dur });
      tryPumpAppToastQueue();
    }

    if (typeof window !== 'undefined') {
      window.enqueueAppToast = enqueueAppToast;
    }

    function showSaveToastImmediate(text, tone, durationMs, onDone) {
      var normalizedTone = normalizeToastTone(tone);
      var toast = document.getElementById('saveToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'saveToast';
        toast.className = 'app-toast app-toast-save app-toast-tone-success';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = '<span class="app-toast-icon" aria-hidden="true">✓</span><span class="app-toast-text"></span>';
        document.body.appendChild(toast);
      }

      var textEl = toast.querySelector('.app-toast-text');
      if (textEl) {
        textEl.textContent = text || 'Сохранено';
      }
      var iconEl = toast.querySelector('.app-toast-icon');
      if (iconEl) {
        iconEl.textContent = getToastIconByTone(normalizedTone);
      }
      toast.classList.remove('app-toast-tone-success', 'app-toast-tone-info', 'app-toast-tone-neutral', 'app-toast-tone-danger');
      toast.classList.add('app-toast-tone-' + normalizedTone);

      toast.classList.remove('is-visible');
      if (saveToastHideTimer) {
        clearTimeout(saveToastHideTimer);
        saveToastHideTimer = null;
      }
      if (saveToastDoneTimer) {
        clearTimeout(saveToastDoneTimer);
        saveToastDoneTimer = null;
      }

      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          toast.classList.add('is-visible');
        });
      });

      var hideAfter = Math.max(600, durationMs || 1800);
      saveToastHideTimer = setTimeout(function() {
        saveToastHideTimer = null;
        toast.classList.remove('is-visible');
        saveToastDoneTimer = setTimeout(function() {
          saveToastDoneTimer = null;
          if (typeof onDone === 'function') onDone();
        }, 260);
      }, hideAfter);
    }

    function showSaveToast(text, tone) {
      enqueueAppToast(text, tone, 1800);
    }

    function showActionToast(actionKey) {
      var key = String(actionKey || '').toLowerCase();
      var config = ACTION_TOAST_CONFIG[key];
      if (!config) {
        showSaveToast('Готово', 'info');
        return;
      }
      showSaveToast(config.text, config.tone);
    }

    function isDocsProLocked() {
      return docsProUnlockedThisSession !== true;
    }

    function renderDocsProGate() {
      var wrap = document.getElementById('docsProWrap');
      var gate = document.getElementById('docsProGate');
      var unlockBtn = document.getElementById('btnUnlockDocsPro');
      var locked = isDocsProLocked();
      var showGate = locked && activeTab === 'instructions';

      if (wrap) {
        wrap.classList.toggle('is-locked', locked);
      }
      if (gate) {
        gate.classList.toggle('hidden', !showGate);
        gate.setAttribute('aria-hidden', showGate ? 'false' : 'true');
      }
      if (unlockBtn) {
        unlockBtn.disabled = !locked;
      }
    }

    function unlockDocsProForSession() {
      docsProUnlockedThisSession = true;
      renderDocsProGate();
      renderDocumentationScreen();
    }

    function getDocsEntryMeta(entry) {
      if (entry === 'instructions') {
        return {
          title: 'Инструкции',
          subtitle: 'Полные документы и приказы',
          tabs: ['instructions']
        };
      }
      if (entry === 'speeds') {
        return {
          title: 'Скорости',
          subtitle: 'Скорости по участкам',
          tabs: ['speeds']
        };
      }
      if (entry === 'memos') {
        return {
          title: 'Режимки',
          subtitle: 'Режимные карты по участкам',
          tabs: ['memos']
        };
      }
      if (entry === 'reminders') {
        return {
          title: 'Памятки',
          subtitle: 'Небольшие рабочие шпаргалки',
          tabs: ['reminders']
        };
      }
      if (entry === 'folders') {
        return {
          title: 'Папки',
          subtitle: 'Материалы по нарушениям БД',
          tabs: ['folders']
        };
      }
      return {
        title: 'Документы',
        subtitle: 'Выберите нужный раздел',
        tabs: []
      };
    }

    function renderDocumentationScreen() {
      var shell = document.getElementById('docsShell');
      if (!shell) return;
      renderDocsProGate();

      var entryCard = document.getElementById('docsEntryCard');
      var subnavCard = document.getElementById('docsSubnavCard');
      var currentEntryTitle = document.getElementById('docsCurrentEntryTitle');
      var currentEntrySubtitle = document.getElementById('docsCurrentEntrySubtitle');
      var secondaryTabs = document.getElementById('docsSecondaryTabs');
      var entryMeta = getDocsEntryMeta(documentationStore.activeEntry);
      var hasEntry = !!(documentationStore.activeEntry && entryMeta.tabs.length);

      if (entryCard) {
        entryCard.classList.toggle('hidden', hasEntry);
      }
      if (subnavCard) {
        subnavCard.classList.toggle('hidden', !hasEntry);
      }
      if (currentEntryTitle) {
        currentEntryTitle.textContent = entryMeta.title;
      }
      if (currentEntrySubtitle) {
        currentEntrySubtitle.textContent = entryMeta.subtitle;
      }
      if (secondaryTabs) {
        secondaryTabs.classList.toggle('hidden', !(hasEntry && entryMeta.tabs.length > 1));
      }

      var entryButtons = shell.querySelectorAll('.docs-entry-tile[data-docs-entry]');
      for (var e = 0; e < entryButtons.length; e++) {
        entryButtons[e].classList.toggle('active', entryButtons[e].getAttribute('data-docs-entry') === documentationStore.activeEntry);
      }

      var tabBtns = shell.querySelectorAll('.docs-tab-btn[data-docs-tab]');
      for (var i = 0; i < tabBtns.length; i++) {
        var tabName = tabBtns[i].getAttribute('data-docs-tab');
        var isAllowed = entryMeta.tabs.indexOf(tabName) !== -1;
        tabBtns[i].classList.toggle('hidden', !isAllowed || !hasEntry || entryMeta.tabs.length <= 1);
        tabBtns[i].classList.toggle('active', hasEntry && tabName === documentationStore.activeTab);
      }

      var panels = shell.querySelectorAll('.docs-panel[data-docs-panel]');
      for (var j = 0; j < panels.length; j++) {
        var panelName = panels[j].getAttribute('data-docs-panel');
        var isVisible = hasEntry && panelName === documentationStore.activeTab;
        panels[j].classList.toggle('hidden', !isVisible);
      }

      if (isDocsProLocked() || !hasEntry) {
        return;
      }

      loadDocFiles(documentationStore.activeTab);
    }

    // ── Auth / Session — see scripts/auth.js ──
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
            if (!servedFromCache && callback) callback();
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
            handleAuthUnauthorized('save');
            return;
          }
          updateOfflineUiState({ isOffline: !navigator.onLine, isSyncing: false, hasPending: true, lastSyncStatus: 'error', lastError: (result.body && result.body.error) || 'API save failed' });
        }).catch(function(err) {
          updateOfflineUiState({ isOffline: true, isSyncing: false, hasPending: true, lastSyncStatus: 'error', lastError: err && err.message ? err.message : 'Network error' });
        });
      }

    // ── Time helpers — see scripts/time-utils.js ──
    // ── Render ──
    // ── Render — see scripts/render.js ──
    // ── Shift Form / Delete / Overlays — see scripts/shift-form.js ──
