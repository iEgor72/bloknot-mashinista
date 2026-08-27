if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('poekhali-warnings', 'v406');

(function(global) {
  'use strict';

  function createPoekhaliWarnings(deps) {
    deps = deps || {};
    var state = deps.state;
    var config = deps.config || {};
    if (!state || !state.warningSync) throw new Error('Poekhali warnings state is required');

    function getWarningStorageScope() {
      return deps.getStorageScope();
    }

    function normalizeDateValue(value) {
      var text = String(value || '').trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) return text.slice(0, 16);
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      return '';
    }

    function getMoscowDateTimeString() {
      var now = new Date();
      var moscow = new Date(now.getTime() + (3 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
      var pad = function(n) { return String(n).padStart(2, '0'); };
      return moscow.getFullYear() + '-' + pad(moscow.getMonth() + 1) + '-' + pad(moscow.getDate()) +
        'T' + pad(moscow.getHours()) + ':' + pad(moscow.getMinutes());
    }

    function getMoscowDateString() {
      return getMoscowDateTimeString().slice(0, 10);
    }

    function formatDateLabel(value) {
      var date = normalizeDateValue(value);
      if (!date) return '';
      if (date.indexOf('T') >= 0) {
        var parts = date.split('T');
        var d = parts[0].split('-');
        return d[2] + '.' + d[1] + '.' + d[0] + ' ' + parts[1];
      }
      var p = date.split('-');
      return p[2] + '.' + p[1] + '.' + p[0];
    }

    function normalizeWarning(item) {
      if (!item || typeof item !== 'object') return null;
      var mapId = String(item.mapId || getWarningStorageScope());
      var sector = Number(item.sector);
      var start = deps.normalizeOrdinate(item.start);
      var end = deps.normalizeOrdinate(item.end);
      var speed = deps.parseNumber(item.speed);
      if (!deps.isRealNumber(sector) || !isFinite(start) || !isFinite(end) || !isFinite(speed)) return null;
      var left = Math.min(start, end);
      var right = Math.max(start, end);
      if (left === right) right = left + 100;
      return {
        id: String(item.id || ('warning-' + Date.now() + '-' + Math.round(Math.random() * 10000))),
        mapId: mapId,
        shiftId: String(item.shiftId || ''),
        sector: sector,
        coordinate: left,
        start: left,
        end: right,
        length: Math.max(0, right - left),
        speed: Math.round(speed),
        name: String(item.name || item.note || '').trim(),
        note: String(item.note || item.name || '').trim(),
        enabled: item.enabled !== false,
        validUntil: normalizeDateValue(item.validUntil || item.until || item.dateTo),
        createdAt: String(item.createdAt || new Date().toISOString()),
        updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
        deletedAt: String(item.deletedAt || ''),
        source: 'warning'
      };
    }

    function normalizeWarningsList(raw) {
      var items = Array.isArray(raw) ? raw : [];
      return items.map(normalizeWarning).filter(Boolean);
    }

    function normalizeWarningSyncMeta(raw) {
      var meta = raw && typeof raw === 'object' ? raw : {};
      return {
        pending: !!meta.pending,
        lastSyncAt: Math.max(0, Number(meta.lastSyncAt) || 0),
        error: String(meta.error || '').slice(0, 240)
      };
    }

    function loadWarningSyncState() {
      var meta = normalizeWarningSyncMeta(deps.readJsonStorage(config.syncStorageKey, null));
      state.warningSync.pending = meta.pending;
      state.warningSync.lastSyncAt = meta.lastSyncAt;
      state.warningSync.error = meta.error;
      state.warningSync.state = meta.pending ? 'pending' : meta.lastSyncAt ? 'synced' : 'idle';
    }

    function saveWarningSyncState() {
      deps.writeJsonStorage(config.syncStorageKey, {
        pending: !!state.warningSync.pending,
        lastSyncAt: state.warningSync.lastSyncAt || 0,
        error: state.warningSync.error || ''
      });
    }

    function setWarningSyncState(patch) {
      var next = patch || {};
      if (next.state !== undefined) state.warningSync.state = String(next.state || 'idle');
      if (next.pending !== undefined) state.warningSync.pending = !!next.pending;
      if (next.lastSyncAt !== undefined) state.warningSync.lastSyncAt = Math.max(0, Number(next.lastSyncAt) || 0);
      if (next.error !== undefined) state.warningSync.error = String(next.error || '').slice(0, 240);
      saveWarningSyncState();
      deps.onSyncStateChanged();
    }

    function getWarningApiUrl() {
      return deps.getApiUrl();
    }

    function isWarningSyncAvailable() {
      return typeof deps.fetchJson === 'function' && typeof navigator !== 'undefined';
    }

    function createWarningSyncError(message, code) {
      var error = new Error(message || 'Warnings sync failed');
      error.code = code || '';
      return error;
    }

    function getWarningRevisionTime(item) {
      if (!item) return 0;
      var candidates = [item.deletedAt, item.updatedAt, item.createdAt];
      for (var i = 0; i < candidates.length; i++) {
        var ts = Date.parse(candidates[i] || '');
        if (isFinite(ts)) return ts;
      }
      return 0;
    }

    function mergeWarningsLists(baseWarnings, incomingWarnings) {
      var base = normalizeWarningsList(baseWarnings);
      var incoming = normalizeWarningsList(incomingWarnings);
      var byId = {};

      function put(item, preferExistingOnTie) {
        if (!item || !item.id) return;
        var existing = byId[item.id];
        if (!existing) {
          byId[item.id] = item;
          return;
        }
        var existingTime = getWarningRevisionTime(existing);
        var nextTime = getWarningRevisionTime(item);
        if (nextTime > existingTime || (nextTime === existingTime && !preferExistingOnTie)) {
          byId[item.id] = item;
        }
      }

      for (var i = 0; i < incoming.length; i++) put(incoming[i], false);
      for (var j = 0; j < base.length; j++) put(base[j], true);

      return Object.keys(byId).map(function(id) {
        return byId[id];
      }).sort(function(a, b) {
        if (a.mapId !== b.mapId) return a.mapId < b.mapId ? -1 : 1;
        if (a.shiftId !== b.shiftId) return a.shiftId < b.shiftId ? -1 : 1;
        if (a.sector !== b.sector) return a.sector - b.sector;
        if (a.start !== b.start) return a.start - b.start;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    }

    function hasWarningsData(warnings) {
      return normalizeWarningsList(warnings).length > 0;
    }

    function loadWarnings() {
      loadWarningSyncState();
      var raw = deps.readJsonStorage(config.storageKey, []);
      state.warnings = normalizeWarningsList(raw);
    }

    function saveWarnings(options) {
      state.warnings = normalizeWarningsList(state.warnings);
      deps.writeJsonStorage(config.storageKey, state.warnings);
      if (!(options && options.skipSync)) {
        setWarningSyncState({
          state: typeof navigator !== 'undefined' && navigator.onLine ? 'pending' : 'offline',
          pending: true,
          error: ''
        });
        scheduleWarningSync();
      }
      deps.onWarningsSaved();
    }

    function scheduleWarningSync(delayMs) {
      if (!isWarningSyncAvailable()) return;
      if (state.warningSync.timer) {
        clearTimeout(state.warningSync.timer);
        state.warningSync.timer = null;
      }
      if (deps.isPageHidden()) return;
      var delay = Number(delayMs);
      if (!isFinite(delay) || delay < 0) delay = config.syncDebounceMs;
      state.warningSync.timer = setTimeout(function() {
        state.warningSync.timer = null;
        syncWarningsWithServer('scheduled');
      }, delay);
    }

    function syncWarningsWithServer(reason) {
      if (!isWarningSyncAvailable()) return Promise.resolve(false);
      if (state.warningSync.inFlight) {
        scheduleWarningSync(config.syncDebounceMs);
        return Promise.resolve(false);
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (hasWarningsData(state.warnings) || state.warningSync.pending) {
          setWarningSyncState({ state: 'offline', pending: true, error: '' });
        }
        return Promise.resolve(false);
      }

      var apiUrl = getWarningApiUrl();
      var localBefore = normalizeWarningsList(state.warnings);
      state.warningSync.inFlight = true;
      setWarningSyncState({ state: reason === 'load' ? 'loading' : 'syncing', error: '' });

      return deps.fetchJson(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 7000).then(function(result) {
        if (!result.ok) {
          if (result.status === 401) throw createWarningSyncError('Unauthorized', 'unauthorized');
          if (result.status === 404) throw createWarningSyncError('Warnings sync unavailable', 'unavailable');
          throw new Error((result.body && result.body.error) || 'Warnings load failed');
        }

        var remoteWarnings = normalizeWarningsList(result.body && result.body.warnings);
        var mergedWarnings = mergeWarningsLists(localBefore, remoteWarnings);
        var mergedJson = JSON.stringify(mergedWarnings);
        var remoteJson = JSON.stringify(remoteWarnings);
        var localJson = JSON.stringify(localBefore);
        var localChanged = mergedJson !== localJson;
        var shouldPush = state.warningSync.pending || mergedJson !== remoteJson;

        if (localChanged) {
          state.warnings = mergedWarnings;
          saveWarnings({ skipSync: true });
        }

        if (!shouldPush) {
          state.warningSync.inFlight = false;
          setWarningSyncState({
            state: 'synced',
            pending: false,
            lastSyncAt: Date.now(),
            error: ''
          });
          return true;
        }

        return deps.fetchJson(apiUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ warnings: mergedWarnings })
        }, 9000).then(function(saveResult) {
          if (!saveResult.ok) {
            if (saveResult.status === 401) throw createWarningSyncError('Unauthorized', 'unauthorized');
            if (saveResult.status === 404) throw createWarningSyncError('Warnings sync unavailable', 'unavailable');
            throw new Error((saveResult.body && saveResult.body.error) || 'Warnings save failed');
          }
          state.warnings = normalizeWarningsList(saveResult.body && saveResult.body.warnings ? saveResult.body.warnings : mergedWarnings);
          saveWarnings({ skipSync: true });
          state.warningSync.inFlight = false;
          setWarningSyncState({
            state: 'synced',
            pending: false,
            lastSyncAt: Date.now(),
            error: ''
          });
          return true;
        });
      }).catch(function(error) {
        state.warningSync.inFlight = false;
        var unavailable = error && error.code === 'unavailable';
        setWarningSyncState({
          state: unavailable ? 'local' : 'error',
          pending: hasWarningsData(state.warnings) || state.warningSync.pending,
          error: unavailable ? '' : (error && error.message ? error.message : 'Warnings sync failed')
        });
        return false;
      });
    }

    function bindWarningSyncEvents() {
      if (typeof window === 'undefined' || !window.addEventListener) return;
      window.addEventListener('online', function() {
        if (state.warningSync.pending || hasWarningsData(state.warnings)) {
          scheduleWarningSync(250);
        }
      });
    }

    function isWarningExpired(item) {
      if (!item || !item.validUntil) return false;
      if (String(item.validUntil).indexOf('T') >= 0) {
        return item.validUntil < getMoscowDateTimeString();
      }
      return item.validUntil < getMoscowDateString();
    }

    function isWarningUsable(item) {
      return !!(item && item.enabled !== false && !isWarningExpired(item));
    }

    function getScopedWarnings(includeInactive) {
      var scope = getWarningStorageScope();
      // Warnings are track data scoped to the MAP and bounded by validUntil — NOT to
      // a single shift. They stay visible on every trip over the same map.
      return state.warnings.filter(function(item) {
        if (!item || item.mapId !== scope) return false;
        if (item.deletedAt) return false;
        if (!includeInactive && !isWarningUsable(item)) return false;
        return true;
      });
    }

    function getCurrentWarnings() {
      return getScopedWarnings(false);
    }

    function getWarningRuntimeStatus(item, projection) {
      if (!item) return 'ready';
      if (item.enabled === false) return 'disabled';
      if (isWarningExpired(item)) return 'expired';
      var current = projection || deps.getCurrentProjection();
      if (!current || deps.getSectorKey(current.sector) !== deps.getSectorKey(item.sector) || !deps.isRealNumber(current.lineCoordinate)) {
        return 'ready';
      }
      var coordinate = current.lineCoordinate;
      if (coordinate >= item.start && coordinate <= item.end) return 'active';
      if (deps.getDirection() > 0) return item.start > coordinate ? 'ahead' : 'passed';
      return item.end < coordinate ? 'ahead' : 'passed';
    }

    function getWarningsForSector(sector, left, right) {
      var sectorKey = deps.getSectorKey(sector);
      return getCurrentWarnings().filter(function(item) {
        if (deps.getSectorKey(item.sector) !== sectorKey) return false;
        if (isFinite(left) && isFinite(right) && !deps.isObjectInRange(item, left, right)) return false;
        return true;
      });
    }

    return {
      getWarningStorageScope: getWarningStorageScope,
      normalizeDateValue: normalizeDateValue,
      getMoscowDateTimeString: getMoscowDateTimeString,
      getMoscowDateString: getMoscowDateString,
      formatDateLabel: formatDateLabel,
      normalizeWarning: normalizeWarning,
      normalizeWarningsList: normalizeWarningsList,
      normalizeWarningSyncMeta: normalizeWarningSyncMeta,
      loadWarningSyncState: loadWarningSyncState,
      saveWarningSyncState: saveWarningSyncState,
      setWarningSyncState: setWarningSyncState,
      getWarningApiUrl: getWarningApiUrl,
      isWarningSyncAvailable: isWarningSyncAvailable,
      createWarningSyncError: createWarningSyncError,
      getWarningRevisionTime: getWarningRevisionTime,
      mergeWarningsLists: mergeWarningsLists,
      hasWarningsData: hasWarningsData,
      loadWarnings: loadWarnings,
      saveWarnings: saveWarnings,
      scheduleWarningSync: scheduleWarningSync,
      syncWarningsWithServer: syncWarningsWithServer,
      bindWarningSyncEvents: bindWarningSyncEvents,
      isWarningExpired: isWarningExpired,
      isWarningUsable: isWarningUsable,
      getScopedWarnings: getScopedWarnings,
      getCurrentWarnings: getCurrentWarnings,
      getWarningRuntimeStatus: getWarningRuntimeStatus,
      getWarningsForSector: getWarningsForSector
    };
  }

  global.createPoekhaliWarnings = createPoekhaliWarnings;
})(window);
