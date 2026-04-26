    // ── Telegram WebApp Init ──
    try {
      if (window.Telegram && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
      }
    } catch(e) { console.warn('TG SDK init error:', e); }

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
    var APP_VERSION = '1.0.0 (1)';
    var INSTALL_PROMPT_STATE_STORAGE_KEY = 'shift_tracker_install_prompt_state_v1';
    var LEGACY_SETTINGS_STORAGE_KEY = 'shift_tracker_settings_v1';
    var SALARY_PARAMS_STORAGE_KEY = 'shift_tracker_salary_params_v1';
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
      komPerTrip: 0
    };
    var salaryParamsStore = createSalaryParamsStore();
    var appSettings = salaryParamsStore.values;
    var salaryParamsSyncInFlight = null;
    var installPromptDismissed = false;
    var installPromptInstalled = false;
    var deferredInstallPromptEvent = null;
    var installGuideCopyFeedbackTimer = null;
    var INSTALL_GUIDE_COPY = {
      subtitle: 'Открой приложение в один тап — как обычное приложение',
      warning: 'В Telegram установка может не работать — открой ссылку в браузере',
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
    var USER_STATS_CACHE_STORAGE_KEY = 'shift_tracker_user_stats_cache_v1';
    var USER_STATS_SESSION_ID_STORAGE_KEY = 'shift_tracker_device_id_v1';
    var USER_STATS_PING_INTERVAL_MS = 10 * 60 * 1000;
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
    var userStatsState = {
      onlineUsers: null,
      totalUsers: null,
      lastUpdatedAt: '',
      isLoading: false
    };
    var userStatsInFlight = null;
    var userStatsPollTimer = null;
    var userStatsTrackingStarted = false;

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

    function normalizeStatsUserId(rawUserId) {
      if (rawUserId === undefined || rawUserId === null) return '';
      var id = String(rawUserId).trim();
      if (!id || id === 'guest') return '';
      return id;
    }

    function getStatsPrimaryUserId() {
      var currentId = normalizeStatsUserId(CURRENT_USER && CURRENT_USER.id);
      if (currentId) return currentId;
      var stored = getStoredCachedUser();
      if (stored && stored.id !== undefined && stored.id !== null) {
        return normalizeStatsUserId(stored.id);
      }
      return '';
    }

    function isValidUsageSessionId(value) {
      return typeof value === 'string' && /^[a-z0-9_-]{12,64}$/i.test(value);
    }

    function createUsageSessionId() {
      var prefix = 'sess_';
      var bytes = [];
      if (window.crypto && window.crypto.getRandomValues) {
        bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
      } else {
        for (var i = 0; i < 16; i++) {
          bytes.push(Math.floor(Math.random() * 256));
        }
      }

      var hex = '';
      for (var j = 0; j < bytes.length; j++) {
        var part = Number(bytes[j]).toString(16);
        hex += part.length === 1 ? '0' + part : part;
      }
      return prefix + hex;
    }

    function getUsageSessionId() {
      try {
        var stored = localStorage.getItem(USER_STATS_SESSION_ID_STORAGE_KEY);
        if (isValidUsageSessionId(stored)) {
          return stored;
        }
        var created = createUsageSessionId();
        localStorage.setItem(USER_STATS_SESSION_ID_STORAGE_KEY, created);
        return created;
      } catch (e) {
        return '';
      }
    }

    function coerceNonNegativeInt(value) {
      var n = Number(value);
      if (!isFinite(n) || n < 0) return null;
      return Math.floor(n);
    }

    function readUserStatsCache() {
      var cached = readStoredJson(USER_STATS_CACHE_STORAGE_KEY, null);
      if (!cached || typeof cached !== 'object') return null;
      var total = coerceNonNegativeInt(cached.totalUsers);
      if (total === null) return null;
      return {
        totalUsers: total,
        updatedAt: typeof cached.updatedAt === 'string' ? cached.updatedAt : ''
      };
    }

    function writeUserStatsCache(totalUsers, updatedAt) {
      var total = coerceNonNegativeInt(totalUsers);
      if (total === null) return false;
      return writeStoredJson(USER_STATS_CACHE_STORAGE_KEY, {
        totalUsers: total,
        updatedAt: typeof updatedAt === 'string' && updatedAt ? updatedAt : new Date().toISOString()
      });
    }

    function renderUserStatsFooter() {
      var el = document.getElementById('userStatsFooter');
      if (!el) return;
      var onlineText = navigator.onLine && userStatsState.onlineUsers !== null
        ? String(userStatsState.onlineUsers)
        : '—';
      var totalText = userStatsState.totalUsers !== null
        ? String(userStatsState.totalUsers)
        : '—';
      var nextText = 'Сейчас онлайн: ' + onlineText + ' · Всего пользователей: ' + totalText;
      if (el.textContent !== nextText) {
        el.textContent = nextText;
      }
      el.setAttribute('data-state', navigator.onLine ? 'online' : 'offline');
    }

    function applyUserStatsPayload(payload) {
      var online = coerceNonNegativeInt(payload && payload.onlineUsers);
      var total = coerceNonNegativeInt(payload && payload.totalUsers);

      userStatsState.onlineUsers = online;
      if (total !== null) {
        userStatsState.totalUsers = total;
      }
      if (payload && typeof payload.updatedAt === 'string') {
        userStatsState.lastUpdatedAt = payload.updatedAt;
      }
      if (userStatsState.totalUsers !== null) {
        writeUserStatsCache(userStatsState.totalUsers, userStatsState.lastUpdatedAt);
      }
      renderUserStatsFooter();
    }

    function applyUserStatsOfflineFallback() {
      var cached = readUserStatsCache();
      userStatsState.onlineUsers = null;
      userStatsState.isLoading = false;
      if (cached && cached.totalUsers !== null) {
        userStatsState.totalUsers = cached.totalUsers;
        if (cached.updatedAt) userStatsState.lastUpdatedAt = cached.updatedAt;
      }
      renderUserStatsFooter();
    }

    function refreshUserStats(reason) {
      if (!navigator.onLine) {
        applyUserStatsOfflineFallback();
        return Promise.resolve(null);
      }
      if (userStatsInFlight) return userStatsInFlight;

      var userId = getStatsPrimaryUserId();
      if (!userId) {
        applyUserStatsOfflineFallback();
        return Promise.resolve(null);
      }

      var sessionId = getUsageSessionId();
      if (!sessionId) {
        applyUserStatsOfflineFallback();
        return Promise.resolve(null);
      }

      userStatsState.isLoading = true;
      userStatsInFlight = fetchJson(USER_STATS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ userId: userId, sessionId: sessionId, reason: reason || 'heartbeat' })
      }, 4500).then(function(result) {
        userStatsInFlight = null;
        userStatsState.isLoading = false;
        if (result.ok && result.body) {
          applyUserStatsPayload(result.body);
          return result.body;
        }
        applyUserStatsOfflineFallback();
        return null;
      }).catch(function() {
        userStatsInFlight = null;
        userStatsState.isLoading = false;
        applyUserStatsOfflineFallback();
        return null;
      });

      return userStatsInFlight;
    }

    function startUserStatsTracking() {
      if (userStatsTrackingStarted) return;
      userStatsTrackingStarted = true;

      getUsageSessionId();
      applyUserStatsOfflineFallback();

      if (navigator.onLine) {
        window.setTimeout(function() {
          if (document.hidden) return;
          refreshUserStats('startup');
        }, 700);
      }

      function scheduleNextUserStatsPing() {
        if (userStatsPollTimer) window.clearTimeout(userStatsPollTimer);
        userStatsPollTimer = window.setTimeout(function() {
          userStatsPollTimer = null;
          if (!document.hidden && navigator.onLine) {
            refreshUserStats('interval');
          }
          scheduleNextUserStatsPing();
        }, USER_STATS_PING_INTERVAL_MS);
      }
      scheduleNextUserStatsPing();
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

      if (isSyncing) {
        return {
          key: 'syncing',
          title: 'Синхронизация',
          text: 'Отправляем локальные изменения на сервер.',
          statusText: 'Синхронизация...',
          tone: 'info',
          autoHideMs: 3500
        };
      }
      if (isOffline) {
        return {
          key: hasPending ? 'offline-pending' : 'offline',
          title: 'Нет сети',
          text: hasPending ? 'Показываем последние сохранённые данные. Изменения отправятся при появлении сети.' : 'Показываем последние сохранённые данные.',
          statusText: hasPending ? 'Сохранено локально' : 'Оффлайн',
          tone: 'danger',
          autoHideMs: 6500
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
      if (hasPending) {
        return {
          key: 'pending',
          title: 'Есть несинхронизированные изменения',
          text: 'Данные сохранены локально и будут отправлены автоматически.',
          statusText: 'Сохранено локально',
          tone: 'info',
          autoHideMs: 4500
        };
      }
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
        hideOfflineBanner(false);
        return;
      }
      if (offlineBannerDismissedKey && offlineBannerDismissedKey === payload.key) {
        hideOfflineBanner(false);
        return;
      }

      titleEl.textContent = payload.title;
      textEl.textContent = payload.text;
      syncEl.textContent = payload.statusText;
      syncEl.hidden = !payload.statusText || payload.statusText === payload.title;
      bannerEl.classList.remove('is-danger', 'is-info');
      bannerEl.classList.add(payload.tone === 'danger' ? 'is-danger' : 'is-info');
      bannerEl.classList.remove('hidden');
      bannerEl.setAttribute('aria-hidden', 'false');
      if (offlineBannerVisibleKey !== payload.key) {
        offlineBannerDismissedKey = '';
      }
      offlineBannerVisibleKey = payload.key;
      window.requestAnimationFrame(function() {
        bannerEl.classList.add('is-visible');
      });
      clearOfflineBannerHideTimer();
      offlineBannerHideTimer = setTimeout(function() {
        hideOfflineBanner(true);
      }, payload.autoHideMs || 5000);
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

    function isProductionHolidayDateKey(dateKey) {
      var safeDate = normalizeDateKey(dateKey);
      if (!safeDate) return false;
      return !!PRODUCTION_NON_WORKING_DAY_MAP[safeDate];
    }

    function isProductionShortDayDateKey(dateKey) {
      var safeDate = normalizeDateKey(dateKey);
      if (!safeDate) return false;
      return !!PRODUCTION_SHORT_DAY_MAP[safeDate];
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

    function getDaysBetweenDateKeys(startDateKey, endDateKey) {
      var startTs = parseDateKeyUtc(startDateKey);
      var endTs = parseDateKeyUtc(endDateKey);
      if (!isFinite(startTs) || !isFinite(endTs)) return 0;
      return Math.round((endTs - startTs) / 86400000);
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

    // Stub — retained so any lingering references don't throw.
    // Re-implement when PRO gating is needed again (flip ACCESS_UNRESTRICTED).
    function setAccessRestricted(/*isRestricted*/) {}
    // function loadProStore() { return { isActive: false }; }

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

    function isTelegramWebView() {
      try {
        var webApp = getTelegramWebApp();
        if (webApp && typeof webApp.initData === 'string' && webApp.initData.length > 0) {
          return true;
        }
      } catch (e) {}
      return /Telegram/i.test(navigator.userAgent || '');
    }

    function hasDeferredInstallPrompt() {
      return !!(deferredInstallPromptEvent && typeof deferredInstallPromptEvent.prompt === 'function');
    }

    function updateInstallGuideContent() {
      var platform = detectInstallGuidePlatform();
      var primaryScenario = getInstallGuideScenarioKey(platform);

      var subtitleEl = document.getElementById('installGuideSubtitle');
      if (subtitleEl) subtitleEl.textContent = INSTALL_GUIDE_COPY.subtitle;

      renderInstallGuideScenarios(primaryScenario);

      var noteEl = document.getElementById('installGuideRuntimeNote');
      if (!noteEl) return;
      noteEl.textContent = INSTALL_GUIDE_COPY.warning;
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
      if (!card) return;
      card.classList.toggle('hidden', !shouldShowInstallPromptCard());
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

      var tariff = tariffEl ? parseFloat(tariffEl.value) : NaN;
      var night = nightEl ? parseFloat(nightEl.value) : NaN;
      var klass = classEl ? parseFloat(classEl.value) : NaN;
      var zone = zoneEl ? parseFloat(zoneEl.value) : NaN;
      var bam = bamEl ? parseFloat(bamEl.value) : NaN;
      var district = districtEl ? parseFloat(districtEl.value) : NaN;
      var north = northEl ? parseFloat(northEl.value) : NaN;
      var local = localEl ? parseFloat(localEl.value) : NaN;
      var kom = komEl ? parseFloat(komEl.value) : NaN;

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
      var monthlyBonusAmount = monthlyBaseAmount * 0.04;
      var overtimeAmount = overNormHours * tariffRate;
      var travelOvertimeAmount = travelOvertimeHours * tariffRate * 0.5;
      var extraOvertimeAmount = extraOvertimeHours * tariffRate;
      var classAmount = moneyFromHours(workedHours, tariffRate, appSettings.classPercent);
      var holidayAmount = holidayHours > 0 ? moneyFromHours(holidayHours, tariffRate, 100) : 0;
      var zoneAmount = monthlyBaseAmount * (appSettings.zonePercent / 100);
      var bamAmount = monthlyBaseAmount * (appSettings.bamPercent / 100);
      var komAmount = Math.max(0, Number(shiftCount) || 0) * (Number(appSettings.komPerTrip) || 0);
      var baseAmount = tariffAmount + nightAmount + monthlyBonusAmount + classAmount + holidayAmount +
        overtimeAmount + travelOvertimeAmount + extraOvertimeAmount + zoneAmount + bamAmount;
      var districtAmount = baseAmount * (appSettings.districtPercent / 100);
      var northAmount = baseAmount * (appSettings.northPercent / 100);
      var localAmount = baseAmount * (appSettings.localPercent / 100);
      var coeffTotal = districtAmount + northAmount + localAmount;
      var accruedAmount = baseAmount + coeffTotal + komAmount;
      var ndflBase = baseAmount * 0.13;
      var ndflCoeffs = coeffTotal * 0.13;
      var netAmount = accruedAmount - ndflBase - ndflCoeffs;

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
        monthlyBonusAmount: monthlyBonusAmount,
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

    function readPoekhaliShiftNumber(shift, key) {
      if (typeof getShiftPoekhaliNumber === 'function') return getShiftPoekhaliNumber(shift, key);
      var value = Number(shift && shift[key]);
      return isFinite(value) ? Math.max(0, value) : 0;
    }

    function formatPoekhaliSalaryDistance(meters) {
      if (typeof formatShiftPoekhaliDistance === 'function') {
        return formatShiftPoekhaliDistance(meters) || '—';
      }
      var value = Math.max(0, Math.round(Number(meters) || 0));
      if (!value) return '—';
      return (value / 1000).toFixed(value >= 10000 ? 1 : 2).replace('.', ',') + ' км';
    }

    function formatPoekhaliSalarySpeed(speed) {
      if (typeof formatShiftPoekhaliSpeed === 'function') {
        return formatShiftPoekhaliSpeed(speed) || '—';
      }
      var value = Number(speed);
      if (!isFinite(value) || value <= 0) return '—';
      return (Math.round(value * 10) / 10).toString().replace('.', ',') + ' км/ч';
    }

    function buildPoekhaliMonthOpsSummary(monthShifts) {
      var shifts = monthShifts || [];
      var summary = {
        runCount: 0,
        distanceMeters: 0,
        movingMs: 0,
        durationMs: 0,
        idleMs: 0,
        maxSpeedKmh: 0,
        warningsCount: 0,
        alertCount: 0,
        overspeedCount: 0,
        overspeedDurationMs: 0,
        overspeedDistanceMeters: 0
      };

      for (var i = 0; i < shifts.length; i++) {
        var shift = shifts[i];
        var distance = readPoekhaliShiftNumber(shift, 'poekhali_distance_m');
        var duration = readPoekhaliShiftNumber(shift, 'poekhali_duration_ms');
        var moving = readPoekhaliShiftNumber(shift, 'poekhali_moving_ms');
        var hasRun = !!(shift && shift.poekhali_run_id) || distance > 0 || duration > 0;
        if (hasRun) summary.runCount += 1;

        summary.distanceMeters += distance;
        summary.durationMs += duration;
        summary.movingMs += moving;
        summary.idleMs += readPoekhaliShiftNumber(shift, 'poekhali_idle_ms');
        summary.maxSpeedKmh = Math.max(summary.maxSpeedKmh, readPoekhaliShiftNumber(shift, 'poekhali_max_speed_kmh'));
        summary.warningsCount += readPoekhaliShiftNumber(shift, 'poekhali_warnings_count');
        summary.alertCount += readPoekhaliShiftNumber(shift, 'poekhali_alert_count');
        if (readPoekhaliShiftNumber(shift, 'poekhali_overspeed_max_kmh') > 0) summary.overspeedCount += 1;
        summary.overspeedDurationMs += readPoekhaliShiftNumber(shift, 'poekhali_overspeed_duration_ms');
        summary.overspeedDistanceMeters += readPoekhaliShiftNumber(shift, 'poekhali_overspeed_distance_m');

      }

      summary.technicalSpeedKmh = summary.movingMs > 0 && summary.distanceMeters > 0
        ? (summary.distanceMeters / 1000) / (summary.movingMs / 3600000)
        : 0;
      return summary;
    }

    function renderPoekhaliSalarySummary(summary) {
      var titleEl = document.getElementById('salaryPoekhaliTitle');
      var badgeEl = document.getElementById('salaryPoekhaliBadge');
      var distanceEl = document.getElementById('salaryPoekhaliDistance');
      var techSpeedEl = document.getElementById('salaryPoekhaliTechSpeed');
      var warningsEl = document.getElementById('salaryPoekhaliWarnings');
      var overspeedEl = document.getElementById('salaryPoekhaliOverspeed');
      var fuelEl = document.getElementById('salaryPoekhaliFuel');
      if (!titleEl || !badgeEl || !distanceEl || !techSpeedEl || !warningsEl || !overspeedEl) return;
      if (fuelEl) {
        fuelEl.hidden = true;
        fuelEl.textContent = '';
      }

      titleEl.textContent = summary.runCount
        ? 'Записано ' + summary.runCount + ' смен'
        : 'Нет записей';
      badgeEl.textContent = String(summary.runCount);
      distanceEl.textContent = formatPoekhaliSalaryDistance(summary.distanceMeters);
      techSpeedEl.textContent = formatPoekhaliSalarySpeed(summary.technicalSpeedKmh);
      warningsEl.textContent = summary.warningsCount || summary.alertCount
        ? (summary.warningsCount + ' ПР' + (summary.alertCount ? ' · ' + summary.alertCount + ' сигн.' : ''))
        : '—';
      overspeedEl.textContent = summary.overspeedCount
        ? (summary.overspeedCount + ' смен' + (summary.overspeedDistanceMeters ? ' · ' + formatPoekhaliSalaryDistance(summary.overspeedDistanceMeters) : ''))
        : '—';
    }

    function renderAverageShiftSummary(summary) {
      var averageEl = document.getElementById('dashboardAverageShift');
      if (!averageEl) return;
      averageEl.className = 'dashboard-average';

      if (!summary || summary.shiftCount === 0) {
        averageEl.textContent = 'Пока нет данных';
        averageEl.classList.add('is-muted');
        return;
      }

      if (summary.shiftCount < MIN_SHIFTS_FOR_AVERAGE) {
        averageEl.textContent = 'Нужно больше записей';
        averageEl.classList.add('is-muted');
        return;
      }

      var incomeText = summary.incomeCount > 0
        ? formatRub(summary.averageIncome)
        : '—';
      var durationText = summary.durationCount > 0
        ? formatHoursAndMinutes(summary.averageDurationMin)
        : '—';

      averageEl.textContent = incomeText + ' · ' + durationText;
      if (summary.incomeCount === 0 || summary.durationCount === 0) {
        averageEl.classList.add('is-muted');
      }
    }

    function renderSalaryPanel() {
      var bounds = getMonthBounds(currentYear, currentMonth);
      var monthShiftSets = buildMonthCalculationShifts(currentYear, currentMonth, bounds);
      var monthShifts = monthShiftSets.calculationShifts;

      var summary = buildSalarySummary(monthShifts, bounds);
      var poekhaliSummary = buildPoekhaliMonthOpsSummary(monthShifts);
      renderMonthHeader('salaryMonthTitle', 'salaryMonthQuarter', 'salaryMonthTabs', currentYear, currentMonth, function(targetMonth) {
        if (targetMonth === currentMonth) return;
        triggerHapticSelection();
        currentMonth = targetMonth;
        render();
      });

      var salaryNetTop = document.getElementById('salaryNetTop');
      var salaryNetBottom = document.getElementById('salaryNetBottom');
      var salaryAccrued = document.getElementById('salaryAccrued');
      var salaryNdflBase = document.getElementById('salaryNdflBase');
      var salaryNdflCoeffs = document.getElementById('salaryNdflCoeffs');
      var salaryBaseTotal = document.getElementById('salaryBaseTotal');
      var salaryKomRow = document.getElementById('salaryKomRow');
      var salaryKom = document.getElementById('salaryKom');
      if (salaryNetTop) salaryNetTop.textContent = formatRub(summary.netAmount);
      if (salaryNetBottom) salaryNetBottom.textContent = formatRub(summary.netAmount);
      if (salaryAccrued) salaryAccrued.textContent = formatRub(summary.accruedAmount);
      if (salaryNdflBase) salaryNdflBase.textContent = '-' + formatRub(summary.ndflBase);
      if (salaryNdflCoeffs) salaryNdflCoeffs.textContent = '-' + formatRub(summary.ndflCoeffs);
      if (salaryBaseTotal) salaryBaseTotal.textContent = formatRub(summary.baseAmount);
      if (salaryKomRow) salaryKomRow.classList.toggle('hidden', !(summary.komAmount > 0));
      if (salaryKom) salaryKom.textContent = formatRub(summary.komAmount);
      renderPoekhaliSalarySummary(poekhaliSummary);

      var baseRows = [];
      baseRows.push(createSalaryRowHtml(
        '004L',
        'Тариф в норме <span>(' + summary.regularHours.toFixed(2).replace('.', ',') + ' ч × ' + Number(appSettings.tariffRate).toFixed(2).replace('.', ',') + ' ₽)</span>',
        '',
        formatRub(summary.tariffAmount)
      ));
      baseRows.push(createSalaryRowHtml(
        '027L',
        'Доплата 4% <span>(' + summary.workedHours.toFixed(2).replace('.', ',') + ' ч × тариф)</span>',
        '',
        formatRub(summary.monthlyBonusAmount)
      ));
      baseRows.push(createSalaryRowHtml(
        '023L',
        'Ночные <span>(' + summary.nightHours.toFixed(2).replace('.', ',') + ' ч × ' + formatPercent(appSettings.nightPercent) + ')</span>',
        '',
        formatRub(summary.nightAmount)
      ));
      if (summary.overNormHours > 0) {
        baseRows.push(createSalaryRowHtml(
          '018L',
          'Сверх нормы <span>(' + summary.overNormHours.toFixed(2).replace('.', ',') + ' ч, норма ' + summary.normHours.toFixed(2).replace('.', ',') + ' ч)</span>',
          'По схеме из APK: час сверх нормы оплачивается тарифом, доплата за сверхурочные добавляется отдельной строкой.',
          formatRub(summary.overtimeAmount + summary.extraOvertimeAmount + summary.travelOvertimeAmount)
        ));
      }
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
      if (summary.zoneAmount > 0) {
        baseRows.push(createSalaryRowHtml(
          '029A',
          'Зональная надбавка <span>(' + formatPercent(appSettings.zonePercent) + ')</span>',
          '',
          formatRub(summary.zoneAmount)
        ));
      }
      if (summary.bamAmount > 0) {
        baseRows.push(createSalaryRowHtml(
          '030A',
          'Бамовская надбавка <span>(' + formatPercent(appSettings.bamPercent) + ')</span>',
          '',
          formatRub(summary.bamAmount)
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
    // ── Documentation & PDF Viewer — see scripts/docs-app.js ──
    var saveToastHideTimer = null;
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

    function showSaveToast(text, tone) {
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
      }

      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          toast.classList.add('is-visible');
        });
      });

      saveToastHideTimer = setTimeout(function() {
        toast.classList.remove('is-visible');
      }, 1800);
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
          subtitle: 'Материалы собраны по темам',
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
