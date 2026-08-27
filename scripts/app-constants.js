    // ── Constants ──
    // Держите в синхроне с CACHE_VERSION в sw.js — показывается на главной рядом со статистикой пользователей.
    var SHELL_CACHE_VERSION = 'v402';

    var SHIFT_TRACKER_REQUIRED_RUNTIME_MODULES = [
      'auth',
      'poekhali-station-names',
      'time-utils',
      'app',
      'poekhali-utils',
      'poekhali-map-parser',
      'poekhali-warnings',
      'poekhali-backup',
      'poekhali-tracker',
      'render',
      'shift-form',
      'app-init'
    ];

    window.__SHIFT_TRACKER_RUNTIME_MODULES = window.__SHIFT_TRACKER_RUNTIME_MODULES || {};
    window.__SHIFT_TRACKER_RUNTIME_LOAD_FAILURES = window.__SHIFT_TRACKER_RUNTIME_LOAD_FAILURES || {};
    window.__SHIFT_TRACKER_RUNTIME_GUARD_PENDING = true;

    window.addEventListener('error', function(event) {
      var target = event && event.target;
      if (!target || String(target.tagName || '').toUpperCase() !== 'SCRIPT' || !target.src) return;
      try {
        window.__SHIFT_TRACKER_RUNTIME_LOAD_FAILURES[new URL(target.src, window.location.href).pathname] = true;
      } catch (error) {}
    }, true);

    function registerShiftTrackerRuntimeModule(moduleName, version) {
      var name = String(moduleName || '').trim();
      if (!name) return;
      window.__SHIFT_TRACKER_RUNTIME_MODULES[name] = String(version || '');
    }

    registerShiftTrackerRuntimeModule('app-constants', SHELL_CACHE_VERSION);

    (function installRuntimeIntegrityGuard() {
      var REPAIR_STATE_KEY = 'shift_tracker_runtime_repair_v1';
      var readyDispatched = false;
      var repairStarted = false;
      var deferredRepairScheduled = false;

      function readRepairState() {
        try {
          var raw = window.sessionStorage && sessionStorage.getItem(REPAIR_STATE_KEY);
          var parsed = raw ? JSON.parse(raw) : null;
          return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
          return {};
        }
      }

      function writeRepairState(state) {
        try {
          if (window.sessionStorage) sessionStorage.setItem(REPAIR_STATE_KEY, JSON.stringify(state || {}));
        } catch (error) {}
      }

      function clearRepairState() {
        try {
          if (window.sessionStorage) sessionStorage.removeItem(REPAIR_STATE_KEY);
        } catch (error) {}
      }

      function dispatchRuntimeReady() {
        window.__SHIFT_TRACKER_RUNTIME_GUARD_PENDING = false;
        if (readyDispatched) return;
        readyDispatched = true;
        var readyEvent;
        try {
          readyEvent = new CustomEvent('shifttracker:runtime-ready');
        } catch (error) {
          readyEvent = document.createEvent('Event');
          readyEvent.initEvent('shifttracker:runtime-ready', false, false);
        }
        window.dispatchEvent(readyEvent);
      }

      function canStartCachedRuntime() {
        try {
          return (
            typeof hasCachedBootstrapData === 'function' &&
            hasCachedBootstrapData() &&
            typeof bootstrapAppStartup === 'function' &&
            typeof render === 'function'
          );
        } catch (error) {
          return false;
        }
      }

      function scheduleRuntimeRepairWhenReachable(mismatches) {
        if (deferredRepairScheduled || repairStarted) return;
        deferredRepairScheduled = true;

        var retryOnOnline = function() {
          window.removeEventListener('online', retryOnOnline);
          deferredRepairScheduled = false;
          scheduleRuntimeRepairWhenReachable(mismatches);
        };
        if (navigator.onLine === false || typeof window.fetch !== 'function') {
          window.addEventListener('online', retryOnOnline);
          return;
        }

        window.setTimeout(function() {
          var timeoutId;
          var timeoutPromise = new Promise(function(resolve, reject) {
            timeoutId = window.setTimeout(function() { reject(new Error('runtime repair probe timeout')); }, 4500);
          });
          var probeUrl = '/api/stats?runtime_repair_probe=1&ts=' + Date.now();
          Promise.race([
            window.fetch(probeUrl, { cache: 'no-store', credentials: 'same-origin' }),
            timeoutPromise
          ]).then(function() {
            window.clearTimeout(timeoutId);
            deferredRepairScheduled = false;
            reloadWithoutRuntimeCaches(mismatches);
          }).catch(function() {
            window.clearTimeout(timeoutId);
            deferredRepairScheduled = false;
            if (navigator.onLine === false) {
              window.addEventListener('online', retryOnOnline);
            }
          });
        }, 600);
      }

      function collectRuntimeMismatches() {
        var modules = window.__SHIFT_TRACKER_RUNTIME_MODULES || {};
        var mismatches = [];
        for (var i = 0; i < SHIFT_TRACKER_REQUIRED_RUNTIME_MODULES.length; i++) {
          var moduleName = SHIFT_TRACKER_REQUIRED_RUNTIME_MODULES[i];
          var actualVersion = String(modules[moduleName] || '');
          if (actualVersion !== SHELL_CACHE_VERSION) {
            var scriptPath = '/scripts/' + SHELL_CACHE_VERSION + '/' + moduleName + '.js';
            mismatches.push({
              module: moduleName,
              expected: SHELL_CACHE_VERSION,
              actual: actualVersion || 'missing',
              loadFailed: !!window.__SHIFT_TRACKER_RUNTIME_LOAD_FAILURES[scriptPath]
            });
          }
        }
        return mismatches;
      }

      function reloadWithoutRuntimeCaches(mismatches) {
        if (repairStarted) return;
        if (navigator.onLine === false) {
          window.__SHIFT_TRACKER_RUNTIME_INTEGRITY = {
            ok: false,
            status: 'waiting-online',
            expected: SHELL_CACHE_VERSION,
            mismatches: mismatches
          };
          var retryOnline = function() {
            window.removeEventListener('online', retryOnline);
            reloadWithoutRuntimeCaches(mismatches);
          };
          window.addEventListener('online', retryOnline);
          return;
        }

        var previous = readRepairState();
        var now = Date.now();
        var sameVersion = previous.version === SHELL_CACHE_VERSION && (now - Number(previous.at || 0)) < 120000;
        var attempt = sameVersion ? (Number(previous.attempt || 0) + 1) : 1;
        if (attempt > 2) {
          window.__SHIFT_TRACKER_RUNTIME_INTEGRITY = {
            ok: false,
            status: 'repair-failed',
            expected: SHELL_CACHE_VERSION,
            mismatches: mismatches
          };
          console.warn('[runtime] Mixed application modules remain after two safe repair attempts.', mismatches);
          return;
        }

        repairStarted = true;
        writeRepairState({ version: SHELL_CACHE_VERSION, attempt: attempt, at: now });
        window.__SHIFT_TRACKER_RUNTIME_INTEGRITY = {
          ok: false,
          status: 'repairing',
          expected: SHELL_CACHE_VERSION,
          attempt: attempt,
          mismatches: mismatches
        };

        var unregisterPromise = Promise.resolve();
        if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
          unregisterPromise = navigator.serviceWorker.getRegistrations().then(function(registrations) {
            return Promise.all((registrations || []).map(function(registration) {
              return registration.unregister().catch(function() { return false; });
            }));
          }).catch(function() {});
        }

        var purgeCaches = function() {
          if (!window.caches || typeof caches.keys !== 'function') return Promise.resolve();
          return caches.keys().then(function(cacheNames) {
            return Promise.all((cacheNames || [])
              .filter(function(cacheName) { return String(cacheName || '').indexOf('shift-tracker-shell-') === 0; })
              .map(function(cacheName) { return caches.delete(cacheName).catch(function() { return false; }); }));
          }).catch(function() {});
        };

        unregisterPromise.then(purgeCaches).then(function() {
          var target;
          try {
            target = new URL(window.location.href);
            target.searchParams.set('runtime_repair', SHELL_CACHE_VERSION);
            target.searchParams.set('repair_nonce', String(Date.now()));
          } catch (error) {
            target = '/?runtime_repair=' + encodeURIComponent(SHELL_CACHE_VERSION) + '&repair_nonce=' + Date.now();
          }
          window.location.replace(String(target));
        });
      }

      function verifyRuntimeIntegrity() {
        var mismatches = collectRuntimeMismatches();
        if (mismatches.length) {
          window.__SHIFT_TRACKER_RUNTIME_GUARD_PENDING = true;
          // Offline data is more important than enforcing a perfectly uniform
          // optional runtime. If the core cached app is usable, paint it now and
          // repair the shell only after a real network probe succeeds.
          if (!readyDispatched && canStartCachedRuntime()) {
            window.__SHIFT_TRACKER_RUNTIME_INTEGRITY = {
              ok: false,
              status: navigator.onLine === false ? 'degraded-offline' : 'degraded-cache',
              expected: SHELL_CACHE_VERSION,
              mismatches: mismatches
            };
            dispatchRuntimeReady();
            scheduleRuntimeRepairWhenReachable(mismatches);
            return window.__SHIFT_TRACKER_RUNTIME_INTEGRITY;
          }
          if (mismatches.some(function(mismatch) { return mismatch.loadFailed; })) {
            window.__SHIFT_TRACKER_RUNTIME_INTEGRITY = {
              ok: false,
              status: 'load-failed',
              expected: SHELL_CACHE_VERSION,
              mismatches: mismatches
            };
            return { ok: false, expected: SHELL_CACHE_VERSION, mismatches: mismatches };
          }
          reloadWithoutRuntimeCaches(mismatches);
          return { ok: false, expected: SHELL_CACHE_VERSION, mismatches: mismatches };
        }

        clearRepairState();
        window.__SHIFT_TRACKER_RUNTIME_INTEGRITY = {
          ok: true,
          status: 'ready',
          expected: SHELL_CACHE_VERSION,
          modules: Object.assign({}, window.__SHIFT_TRACKER_RUNTIME_MODULES || {})
        };
        dispatchRuntimeReady();
        return window.__SHIFT_TRACKER_RUNTIME_INTEGRITY;
      }

      window.__SHIFT_TRACKER_VERIFY_RUNTIME = verifyRuntimeIntegrity;
      document.addEventListener('DOMContentLoaded', verifyRuntimeIntegrity, { once: true });
    })();

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

    // Производственный календарь (переносы + сокращенные дни) для точного расчета нормы.
    // Источник: holidays-calendar-ru (данные за 2025-2026).
    var PRODUCTION_NON_WORKING_DAY_KEYS = [
      '2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07', '2025-01-08',
      '2025-02-22', '2025-02-23', '2025-03-08', '2025-03-09',
      '2025-05-01', '2025-05-02', '2025-05-08', '2025-05-09',
      '2025-06-12', '2025-06-13',
      '2025-11-03', '2025-11-04',
      '2025-12-31',
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
      '2026-02-23', '2026-03-09',
      '2026-05-01', '2026-05-11',
      '2026-06-12',
      '2026-11-04',
      '2026-12-31'
    ];

    var PRODUCTION_SHORT_DAY_KEYS = [
      '2025-03-07', '2025-04-30', '2025-06-11', '2025-11-01',
      '2026-04-30', '2026-05-08', '2026-06-11', '2026-11-03'
    ];

    var PRODUCTION_WORKING_DAY_KEYS = [
      '2025-11-01'
    ];

    function buildDateKeyLookup(keys) {
      var out = Object.create(null);
      var list = keys || [];
      for (var i = 0; i < list.length; i++) {
        out[list[i]] = true;
      }
      return out;
    }

    function buildYearLookupFromDateKeys(keys) {
      var out = Object.create(null);
      var list = keys || [];
      for (var i = 0; i < list.length; i++) {
        var year = String(list[i]).slice(0, 4);
        if (year.length === 4) out[year] = true;
      }
      return out;
    }

    var PRODUCTION_NON_WORKING_DAY_MAP = buildDateKeyLookup(PRODUCTION_NON_WORKING_DAY_KEYS);
    var PRODUCTION_SHORT_DAY_MAP = buildDateKeyLookup(PRODUCTION_SHORT_DAY_KEYS);
    var PRODUCTION_WORKING_DAY_MAP = buildDateKeyLookup(PRODUCTION_WORKING_DAY_KEYS);
    var PRODUCTION_CALENDAR_YEAR_MAP = buildYearLookupFromDateKeys(
      PRODUCTION_NON_WORKING_DAY_KEYS.concat(PRODUCTION_SHORT_DAY_KEYS, PRODUCTION_WORKING_DAY_KEYS)
    );

    function getLocalDateKey(date) {
      if (!(date instanceof Date) || !isFinite(date.getTime())) return '';
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function getNormDayMinutesLocal(date) {
      if (!(date instanceof Date) || !isFinite(date.getTime())) return 0;
      var dayOfWeek = date.getDay();
      var key = getLocalDateKey(date);
      var hasProductionYear = !!PRODUCTION_CALENDAR_YEAR_MAP[String(date.getFullYear())];

      if (PRODUCTION_WORKING_DAY_MAP[key]) {
        return PRODUCTION_SHORT_DAY_MAP[key] ? (7 * 60) : (8 * 60);
      }

      if (hasProductionYear) {
        if (PRODUCTION_NON_WORKING_DAY_MAP[key]) return 0;
        if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
        return PRODUCTION_SHORT_DAY_MAP[key] ? (7 * 60) : (8 * 60);
      }

      if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
      if (isNonWorkingHolidayLocalDate(date)) return 0;
      return 8 * 60;
    }

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
