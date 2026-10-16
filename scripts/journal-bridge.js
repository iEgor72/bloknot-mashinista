if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('journal-bridge', 'v421');
// Compatibility boundary: the journal itself is an isolated ES module.
(function () {
  'use strict';
  var engines = new Map(), preparing = new Map(), modules;
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('shift-journal-v2') : null;
  var events = [];
  var publishedUser = '';
  function account() { return String(getOfflineStorageUserId()); }
  function diagnostic(stage) {
    events.push({ stage: stage, at: new Date().toISOString(), release: window.APP_RELEASE && window.APP_RELEASE.shell });
    if (events.length > 30) events.shift();
  }
  function current() { var engine = engines.get(account()); return engine && engine.state; }
  function publish(state) {
    if (state.userId !== account()) return;
    if (publishedUser && publishedUser !== state.userId && typeof closeOverlay === 'function') closeOverlay('journalConflictOverlay');
    if (publishedUser !== state.userId) lastConflictKey = '';
    publishedUser = state.userId;
    var engine = engines.get(state.userId);
    allShifts = applyPendingFlags(state.shifts, engine.pendingIds());
    pendingMutationIds = [];
    updateOfflineUiState({ isOffline: !navigator.onLine, isSyncing: state.status === 'syncing', hasPending: state.pending,
      lastSyncStatus: state.status, lastError: state.error, lastSyncAt: state.lastSyncAt });
    renderStatus(state);
    if (typeof render === 'function' && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) render();
  }
  var lastConflictKey = '';
  function renderStatus(state) {
    if (!state.conflicts.length) { lastConflictKey = ''; return; }
    var key = state.userId + ':' + state.revision;
    if (lastConflictKey === key) return;
    lastConflictKey = key;
    var lines = ['Записи изменены на двух устройствах. Выберите версию только для спорных смен. Остальные изменения объединены.'];
    state.conflicts.forEach(function(conflict) {
      if (conflict.id === '__legacy_journal__') { lines.push('Найдена очередь из старой версии. Резервная копия сохранена.'); return; }
      function describe(value) { return value ? value.start_msk.replace('T', ' ') + ' → ' + value.end_msk.replace('T', ' ') + (value.notes ? '. ' + value.notes : '') : 'смена удалена'; }
      lines.push('Мои: ' + describe(conflict.local) + '. Сервер: ' + describe(conflict.remote));
    });
    document.getElementById('journalConflictText').textContent = lines.join('\n');
    if (typeof openOverlay === 'function') openOverlay('journalConflictOverlay');
  }
  function prepare(userId) {
    userId = String(userId || account());
    if (preparing.has(userId)) return preparing.get(userId);
    if (!modules) modules = Promise.all([import('./journal/store.mjs'), import('./journal/engine.mjs')]).catch(function(error) { modules = null; throw error; });
    var task = modules.then(async function(parts) {
      var engine = engines.get(userId);
      if (!engine) {
        engine = new parts[1].JournalEngine({ userId: userId, store: new parts[0].JournalStore(),
          request: async function(method, body) {
            // Both ends check identity. Cookies may change in another window.
            if (account() !== userId) throw new Error('Аккаунт изменился. Откройте нужный журнал.');
            var token = CURRENT_SESSION_TOKEN;
            var controller = new AbortController();
            var timer = setTimeout(function() { controller.abort(); }, 10000);
            try {
              var headers = { Accept: 'application/json', 'X-Journal-User': userId };
              if (token) headers.Authorization = 'Bearer ' + token;
              if (body) headers['Content-Type'] = 'application/json';
              var response = await fetch(SHIFTS_API_URL, { method: method, credentials: 'include', headers: headers,
                body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
              return { ok: response.ok, status: response.status, body: await response.json() };
            } finally { clearTimeout(timer); }
          }, onChange: publish });
        engines.set(userId, engine);
      }
      await engine.initialize();
      diagnostic('journal-ready');
      return engine;
    }).catch(function(error) { preparing.delete(userId); diagnostic('storage-open-error'); throw error; });
    preparing.set(userId, task);
    return task;
  }
  function storageError(error) {
    diagnostic('storage-write-error');
    if (typeof enqueueAppToast === 'function') enqueueAppToast('Не удалось сохранить на устройстве. Запись не подтверждена.', 'danger', 6000);
  }
  async function save(shifts) {
    var userId = account();
    try {
      var engine = await prepare(userId);
      if (account() !== userId) throw new Error('Аккаунт изменился');
      lastConflictKey = '';
      await engine.save(shifts);
      if (channel) channel.postMessage({ userId: userId });
      engine.sync();
    } catch (error) { storageError(error); throw error; }
  }
  async function sync() { var engine = await prepare(account()); return engine.sync(); }
  function bind() {
    document.getElementById('journalConflictClose').onclick = function() { closeOverlay('journalConflictOverlay'); };
    ['local', 'remote'].forEach(function(choice) {
      document.getElementById(choice === 'local' ? 'journalUseLocal' : 'journalUseRemote').onclick = async function() {
        try { var engine = await prepare(account()); await engine.resolveConflicts(choice); closeOverlay('journalConflictOverlay'); }
        catch (error) { storageError(error); }
      };
    });
  }
  if (channel) channel.onmessage = function(event) {
    var engine = engines.get(String(event.data && event.data.userId));
    if (engine) engine.refresh().then(function() { if (account() === engine.userId) engine.sync(); }).catch(storageError);
  };
  window.addEventListener('online', function() { sync().catch(storageError); });
  window.addEventListener('offline', function() { if (current()) renderStatus(current()); });
  document.addEventListener('visibilitychange', function() { if (!document.hidden && typeof CURRENT_USER !== 'undefined' && CURRENT_USER) sync().catch(storageError); });
  window.addEventListener('storage', function(event) {
    if (event.newValue && event.key === 'shift_tracker_shifts_pending_v1_' + account()) {
      prepare(account()).then(function(engine) { return engine.initialize().then(function() { return engine.sync(); }); }).catch(storageError);
    }
  });
  window.JournalBridge = { prepare: prepare, current: current, save: save, sync: sync, storageError: storageError,
    pendingIds: function() { var engine = engines.get(account()); return engine ? engine.pendingIds() : []; },
    diagnostics: function() { return events.slice(); } };
  bind();
})();
