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
      nightPercent: 40,
      classPercent: 5,
      districtPercent: 30,
      northPercent: 50,
      localPercent: 20
    };
    var salaryParamsStore = createSalaryParamsStore();
    var appSettings = salaryParamsStore.values;
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
    // ── Documentation store ──
    // ACCESS_UNRESTRICTED = true disables docs gate completely.
    var ACCESS_UNRESTRICTED = false;
    var docsProUnlockedThisSession = ACCESS_UNRESTRICTED === true;
    var stopwatchProUnlockedThisSession = ACCESS_UNRESTRICTED === true;
    var documentationStore = {
      activeTab: 'speeds'
    };
    // Future document model (populate when remote files are added):
    // { id, title, category: 'folders'|'instructions'|'memos'|'regimki',
    //   remoteUrl, fileName, isDownloaded }
    var documentationItems = {
      folders:      [],
      instructions: [],
      memos:        [],
      regimki:      [],
      speeds:       []
    };
    var instructionsStore = { status: 'idle', instructions: [], searchDocs: [],
      preparedSearchDocs: [], preparedSearchDocsKey: '', searchResults: [],
      searchAnswer: null, searchQuery: '', view: 'list',
      selectedInstructionId: '', selectedSectionId: '', loadPromise: null };
    var SHIFTS_CACHE_STORAGE_KEY = 'shift_tracker_shifts_cache_v1';
    var SHIFTS_PENDING_STORAGE_KEY = 'shift_tracker_shifts_pending_v1';
    var SHIFTS_META_STORAGE_KEY = 'shift_tracker_shifts_meta_v1';
    var USER_STATS_CACHE_STORAGE_KEY = 'shift_tracker_user_stats_cache_v1';
    var USER_STATS_SESSION_ID_STORAGE_KEY = 'shift_tracker_device_id_v1';
    var USER_STATS_PING_INTERVAL_MS = 45000;
    var pendingMutationIds = [];
    var offlineUiState = {
      isOffline: false,
      isSyncing: false,
      hasPending: false,
      lastSyncStatus: 'idle',
      lastError: ''
    };
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
          refreshUserStats('startup');
        }, 700);
      }

      userStatsPollTimer = window.setInterval(function() {
        if (document.hidden || !navigator.onLine) return;
        refreshUserStats('interval');
      }, USER_STATS_PING_INTERVAL_MS);
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
      // Settings are applied explicitly via the "Сохранить" button.
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
      var monthShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (shiftMinutesInRange(allShifts[i], bounds.start, bounds.end) > 0) {
          monthShifts.push(allShifts[i]);
        }
      }
      monthShifts.sort(compareShiftsByStartDesc);

      var summary = buildSalarySummary(monthShifts, bounds);
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
    // ── Instructions — see scripts/instructions-app.js ──
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

    function isStopwatchProLocked() {
      return stopwatchProUnlockedThisSession !== true;
    }

    function renderSharedProGate() {
      var gate = document.getElementById('sharedProGate');
      var unlockBtn = document.getElementById('btnUnlockSharedPro');
      var showGate = (isStopwatchProLocked() && activeTab === 'stopwatch') || (isDocsProLocked() && activeTab === 'instructions');
      var isLocked = isStopwatchProLocked() || isDocsProLocked();

      if (gate) {
        gate.classList.toggle('hidden', !showGate);
        gate.setAttribute('aria-hidden', showGate ? 'false' : 'true');
      }
      if (unlockBtn) {
        unlockBtn.disabled = !isLocked;
      }
    }

    function renderStopwatchProGate() {
      var wrap = document.getElementById('timerProWrap');
      var locked = isStopwatchProLocked();

      if (wrap) {
        wrap.classList.toggle('is-locked', locked);
      }
      renderSharedProGate();
    }

    function unlockStopwatchProForSession() {
      docsProUnlockedThisSession = true;
      stopwatchProUnlockedThisSession = true;
      renderDocsProGate();
      renderStopwatchProGate();
      renderDocumentationScreen();
      if (typeof renderStopwatchScreen === 'function') renderStopwatchScreen();
    }

    function renderDocsProGate() {
      var wrap = document.getElementById('docsProWrap');
      var locked = isDocsProLocked();

      if (wrap) {
        wrap.classList.toggle('is-locked', locked);
      }
      renderSharedProGate();
    }

    function unlockDocsProForSession() {
      docsProUnlockedThisSession = true;
      stopwatchProUnlockedThisSession = true;
      renderDocsProGate();
      renderStopwatchProGate();
      renderDocumentationScreen();
      if (typeof renderStopwatchScreen === 'function') renderStopwatchScreen();
    }

    function renderDocumentationScreen() {
      var shell = document.getElementById('docsShell');
      if (!shell) return;
      renderDocsProGate();
      renderStopwatchProGate();

      // Sync active tab button state
      var tabBtns = shell.querySelectorAll('.docs-tab-btn[data-docs-tab]');
      for (var i = 0; i < tabBtns.length; i++) {
        tabBtns[i].classList.toggle('active', tabBtns[i].getAttribute('data-docs-tab') === documentationStore.activeTab);
      }

      // Show only the active panel
      var panels = shell.querySelectorAll('.docs-panel[data-docs-panel]');
      for (var j = 0; j < panels.length; j++) {
        panels[j].classList.toggle('hidden', panels[j].getAttribute('data-docs-panel') !== documentationStore.activeTab);
      }

      if (isDocsProLocked()) {
        return;
      }

      // Load files for the active tab
      loadDocFiles(documentationStore.activeTab);
    }

    // Alias so any leftover internal calls still resolve without throwing.
    function renderInstructionsScreen() { renderDocumentationScreen(); }

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
