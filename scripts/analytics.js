(function() {
  'use strict';
  if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('analytics', 'v390');

  var POLICY_VERSION = '2026-07-23';
  var API_BASE = window.SHIFT_API_BASE_URL || '';
  var EVENTS_URL = API_BASE + '/api/events';
  var CONSENT_URL = API_BASE + '/api/analytics/consent';
  var QUEUE_PREFIX = 'shift_tracker_analytics_queue_v1_';
  var CONSENT_PREFIX = 'shift_tracker_analytics_consent_v1_';
  var SESSION_KEY = 'shift_tracker_analytics_session_v1';
  var MAX_QUEUE = 500;
  var FLUSH_INTERVAL_MS = 15000;
  var initialized = false;
  var flushTimer = null;
  var heartbeatTimer = null;
  var flushing = false;
  var consentStatus = '';
  var sessionId = '';
  var lastTrackedTab = '';
  var formStartedAt = 0;
  var usedFormFields = {};

  function currentUserId() {
    try {
      if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.id !== undefined) {
        var id = String(CURRENT_USER.id || '').trim();
        if (id && id !== 'guest') return id;
      }
      var cached = JSON.parse(localStorage.getItem('shift_tracker_cached_user_v1') || 'null');
      var cachedId = cached && cached.id !== undefined ? String(cached.id || '').trim() : '';
      return cachedId && cachedId !== 'guest' ? cachedId : '';
    } catch (error) {
      return '';
    }
  }

  function safeUserKey() {
    return currentUserId().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  }

  function queueKey() { return QUEUE_PREFIX + safeUserKey(); }
  function consentKey() { return CONSENT_PREFIX + safeUserKey(); }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
  }

  function randomId(prefix) {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + ':' + window.crypto.randomUUID();
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return prefix + ':' + Array.prototype.map.call(bytes, function(value) { return value.toString(16).padStart(2, '0'); }).join('');
    } catch (error) {
      return prefix + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 14);
    }
  }

  function getSessionId() {
    if (sessionId) return sessionId;
    try { sessionId = sessionStorage.getItem(SESSION_KEY) || ''; } catch (error) {}
    if (!sessionId) {
      sessionId = randomId('session');
      try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch (error) {}
    }
    return sessionId;
  }

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    try {
      var token = typeof CURRENT_SESSION_TOKEN !== 'undefined' ? CURRENT_SESSION_TOKEN : localStorage.getItem('shift_tracker_session_token');
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch (error) {}
    return headers;
  }

  function platform() {
    var text = String(navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(text)) return 'ios';
    if (/android/.test(text)) return 'android';
    return 'desktop';
  }

  function appVersion() {
    try {
      if (typeof SHELL_CACHE_VERSION !== 'undefined') return String(SHELL_CACHE_VERSION || '');
    } catch (error) {}
    return '';
  }

  function localConsent() {
    if (!safeUserKey()) return '';
    var row = readJson(consentKey(), null);
    if (!row || row.policyVersion !== POLICY_VERSION) return '';
    return row.status === 'granted' || row.status === 'denied' ? row.status : '';
  }

  function saveLocalConsent(status) {
    consentStatus = status;
    if (safeUserKey()) writeJson(consentKey(), { status: status, policyVersion: POLICY_VERSION, updatedAt: new Date().toISOString() });
  }

  function readQueue() {
    if (!safeUserKey()) return [];
    var queue = readJson(queueKey(), []);
    return Array.isArray(queue) ? queue.slice(-MAX_QUEUE) : [];
  }

  function writeQueue(queue) {
    if (!safeUserKey()) return;
    writeJson(queueKey(), (queue || []).slice(-MAX_QUEUE));
  }

  function track(eventName, properties) {
    if (consentStatus !== 'granted' || !currentUserId()) return false;
    var queue = readQueue();
    queue.push({
      eventId: randomId('event'),
      sessionId: getSessionId(),
      eventName: String(eventName || ''),
      occurredAt: new Date().toISOString(),
      platform: platform(),
      appVersion: appVersion(),
      properties: properties && typeof properties === 'object' ? properties : {}
    });
    writeQueue(queue);
    if (queue.length >= 10 && navigator.onLine !== false) flush();
    return true;
  }

  function flush(options) {
    if (flushing || consentStatus !== 'granted' || navigator.onLine === false || !currentUserId()) return Promise.resolve(false);
    var queue = readQueue();
    if (!queue.length) return Promise.resolve(true);
    var batch = queue.slice(0, 50);
    flushing = true;
    return fetch(EVENTS_URL, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: !!(options && options.keepalive),
      headers: authHeaders(),
      body: JSON.stringify({ events: batch })
    }).then(function(response) {
      flushing = false;
      if (response.ok) {
        var latest = readQueue();
        var sent = {};
        batch.forEach(function(item) { sent[item.eventId] = true; });
        writeQueue(latest.filter(function(item) { return !sent[item.eventId]; }));
        if (readQueue().length) window.setTimeout(flush, 50);
        return true;
      }
      if (response.status === 401 || response.status === 403) {
        writeQueue([]);
        if (response.status === 403) saveLocalConsent('');
      }
      return false;
    }).catch(function() { flushing = false; return false; });
  }

  function hashedDocumentId(value) {
    var input = String(value || '');
    var hash = 2166136261;
    for (var i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'doc_' + (hash >>> 0).toString(36);
  }

  function ensureStyles() {
    if (document.getElementById('analyticsConsentStyles')) return;
    var style = document.createElement('style');
    style.id = 'analyticsConsentStyles';
    style.textContent = '.analytics-consent{position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-end;justify-content:center;background:rgba(3,10,20,.58);padding:16px}.analytics-consent.hidden{display:none}.analytics-consent-card{width:min(100%,520px);background:#102136;color:#f5f8fc;border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:22px;box-shadow:0 28px 80px rgba(0,0,0,.45)}.analytics-consent-title{font-size:20px;font-weight:800}.analytics-consent-text{font-size:14px;line-height:1.5;color:#b9c7d7;margin:10px 0}.analytics-consent-note{font-size:12px;color:#8fa2b7;margin-bottom:16px}.analytics-consent-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.analytics-consent-actions button{min-height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.14);font-weight:750}.analytics-consent-allow{background:#5dd5ff;color:#06111d}.analytics-consent-deny{background:#172b43;color:#e8eff7}.analytics-profile-row{width:100%;background:none;border:0;color:inherit;text-align:left;cursor:pointer}';
    document.head.appendChild(style);
  }

  function closeConsentDialog() {
    var root = document.getElementById('analyticsConsentDialog');
    if (root) root.classList.add('hidden');
  }

  function saveConsent(status) {
    return fetch(CONSENT_URL, {
      method: 'PUT', credentials: 'same-origin', headers: authHeaders(),
      body: JSON.stringify({ status: status, policyVersion: POLICY_VERSION })
    }).then(function(response) {
      if (!response.ok) throw new Error('consent save failed');
      saveLocalConsent(status);
      if (status === 'denied') writeQueue([]);
      closeConsentDialog();
      updateProfileRow();
      if (status === 'granted') startTracking();
      return true;
    }).catch(function() { return false; });
  }

  function showConsentDialog() {
    ensureStyles();
    var root = document.getElementById('analyticsConsentDialog');
    if (!root) {
      root = document.createElement('div');
      root.id = 'analyticsConsentDialog';
      root.className = 'analytics-consent';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'Настройка аналитики');
      root.innerHTML = '<div class="analytics-consent-card"><div class="analytics-consent-title">Помочь улучшать Блокнот</div><div class="analytics-consent-text">Можно собирать статистику действий, связанную с внутренним ID аккаунта: открытые разделы, сохранение смен, использование расчёта и технические ошибки.</div><div class="analytics-consent-note">Тексты заметок, номера поездов и локомотивов, названия маршрутов и точные GPS-координаты в аналитику не передаются. При отключении ранее собранные события удаляются. Выбор можно изменить в профиле.</div><div class="analytics-consent-actions"><button class="analytics-consent-deny" type="button">Не отправлять</button><button class="analytics-consent-allow" type="button">Разрешить</button></div></div>';
      document.body.appendChild(root);
      root.querySelector('.analytics-consent-deny').addEventListener('click', function() { saveConsent('denied'); });
      root.querySelector('.analytics-consent-allow').addEventListener('click', function() { saveConsent('granted'); });
    }
    root.classList.remove('hidden');
  }

  function updateProfileRow() {
    var row = document.getElementById('analyticsProfileRow');
    if (!row) return;
    var note = row.querySelector('.profile-row-note');
    if (note) note.textContent = consentStatus === 'granted' ? 'Разрешена · нажмите, чтобы изменить' : consentStatus === 'denied' ? 'Отключена · нажмите, чтобы изменить' : 'Не настроена';
  }

  function installProfileRow() {
    if (document.getElementById('analyticsProfileRow')) return;
    var version = document.getElementById('profileVersion');
    var card = version && version.closest ? version.closest('.profile-card') : null;
    if (!card) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'analyticsProfileRow';
    button.className = 'profile-row analytics-profile-row';
    button.innerHTML = '<span class="profile-row-body"><span class="profile-row-title">Статистика использования</span><span class="profile-row-note">Не настроена</span></span><span class="profile-row-chevron" aria-hidden="true">›</span>';
    button.addEventListener('click', showConsentDialog);
    card.appendChild(button);
    updateProfileRow();
  }

  function startTracking() {
    if (initialized || consentStatus !== 'granted') return;
    initialized = true;
    getSessionId();
    track('session_started', { source: document.referrer ? 'referrer' : 'direct' });
    track('app_opened', { source: window.Telegram && window.Telegram.WebApp ? 'telegram' : 'web', offline: navigator.onLine === false });
    var initialPanel = document.querySelector('.tab-panel.active');
    if (initialPanel) trackScreen(initialPanel.getAttribute('data-tab') || 'home');
    flush();
    flushTimer = window.setInterval(function() { if (!document.hidden) flush(); }, FLUSH_INTERVAL_MS);
    heartbeatTimer = window.setInterval(function() {
      if (document.hidden) return;
      track('session_heartbeat', {});
      flush();
    }, 60000);
  }

  function trackScreen(tab) {
    var name = String(tab || 'home').slice(0, 48);
    if (name === lastTrackedTab) return;
    if (lastTrackedTab === 'add' && name !== 'add' && formStartedAt) noteFormAbandoned('tab_changed');
    lastTrackedTab = name;
    track('screen_viewed', { tab: name });
    if (name === 'poekhali') track('poekhali_opened', { source: 'tab' });
    if (name === 'instructions') track('docs_opened', { category: 'landing' });
  }

  function noteFormStarted() {
    if (formStartedAt) return;
    formStartedAt = Date.now();
    track('shift_form_started', { source: 'form' });
  }

  function analyticsFieldName(element) {
    var id = String(element && element.id || '');
    if (/StartDate|StartTime/.test(id)) return 'start';
    if (/EndDate|EndTime/.test(id)) return 'end';
    if (/Route|route/.test(id)) return 'route';
    if (/Loco|Locomotive|loco/.test(id)) return 'locomotive';
    if (/Train|train/.test(id)) return 'train';
    if (/Fuel|fuel/.test(id)) return 'fuel';
    if (/Notes|notes/.test(id)) return 'note';
    return 'other';
  }

  function noteFormFieldUsed(element) {
    var field = analyticsFieldName(element);
    if (usedFormFields[field]) return;
    usedFormFields[field] = true;
    track('shift_form_field_used', { field: field });
  }

  function noteFormAbandoned(reason) {
    if (!formStartedAt) return;
    track('shift_form_abandoned', {
      reason: reason || 'unknown',
      filledFields: Object.keys(usedFormFields),
      fieldCount: Object.keys(usedFormFields).length,
      entryDurationMs: Date.now() - formStartedAt
    });
    formStartedAt = 0;
    usedFormFields = {};
  }

  function noteShiftSaved(shift, options) {
    var fields = [];
    var row = shift || {};
    if (row.route_from || row.route_to) fields.push('route');
    if (row.locomotive_series || row.locomotive_number) fields.push('locomotive');
    if (row.train_number || row.train_weight || row.train_axles) fields.push('train');
    if (row.notes) fields.push('note');
    if (row.fuel_receive_liters_a || row.fuel_receive_liters_b || row.fuel_receive_liters_v || row.fuel_handover_liters_a || row.fuel_handover_liters_b || row.fuel_handover_liters_v) fields.push('fuel');
    var count = options && Number(options.shiftCount) || 0;
    var props = {
      filledFields: fields,
      fieldCount: fields.length,
      shiftCount: count,
      isEditing: !!(options && options.isEditing),
      entryDurationMs: formStartedAt ? Date.now() - formStartedAt : 0,
      hasRoute: fields.indexOf('route') >= 0,
      hasLocomotive: fields.indexOf('locomotive') >= 0,
      hasTrain: fields.indexOf('train') >= 0,
      hasFuel: fields.indexOf('fuel') >= 0,
      hasNote: fields.indexOf('note') >= 0,
      offline: navigator.onLine === false
    };
    track(options && options.isEditing ? 'shift_edited' : 'shift_saved', props);
    if (!(options && options.isEditing) && count === 1) track('first_shift_saved', { shiftCount: count });
    if (!(options && options.isEditing) && count === 3) track('third_shift_saved', { shiftCount: count });
    formStartedAt = 0;
    usedFormFields = {};
  }

  function installInteractionTracking() {
    document.addEventListener('focusin', function(event) {
      if (event.target && event.target.closest && event.target.closest('#shiftFormSection')) noteFormStarted();
    });
    document.addEventListener('change', function(event) {
      if (event.target && event.target.closest && event.target.closest('#shiftFormSection')) noteFormFieldUsed(event.target);
    });
    document.addEventListener('click', function(event) {
      var target = event.target && event.target.closest ? event.target : null;
      if (!target) return;
      var salary = target.closest('#btnProfileSalarySettings, #btnOpenSalarySettings');
      if (salary) track('salary_opened', { source: salary.id || 'button' });
      var docEntry = target.closest('[data-docs-entry]');
      if (docEntry) track('docs_opened', { category: docEntry.getAttribute('data-docs-entry') || 'unknown' });
      var doc = target.closest('.docs-item[data-file-path]');
      if (doc) track('docs_opened', { category: 'file', documentId: hashedDocumentId(doc.getAttribute('data-file-path') || '') });
    }, true);
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', function() { if (document.hidden) flush({ keepalive: true }); else flush(); });
    window.addEventListener('pagehide', function() { noteFormAbandoned('pagehide'); track('session_ended', { reason: 'pagehide' }); flush({ keepalive: true }); });
  }

  function initializeForUser() {
    var userId = currentUserId();
    if (!userId) return false;
    installProfileRow();
    consentStatus = localConsent();
    updateProfileRow();
    fetch(CONSENT_URL, { method: 'GET', credentials: 'same-origin', headers: authHeaders() })
      .then(function(response) { return response.ok ? response.json() : null; })
      .then(function(payload) {
        var serverConsent = payload && payload.consent;
        if (serverConsent && serverConsent.policyVersion === POLICY_VERSION) saveLocalConsent(serverConsent.status);
        else {
          saveLocalConsent('');
          showConsentDialog();
        }
        updateProfileRow();
        if (consentStatus === 'granted') startTracking();
      }).catch(function() {
        if (consentStatus === 'granted') startTracking();
      });
    return true;
  }

  window.ProductAnalytics = {
    track: track,
    flush: flush,
    trackScreen: trackScreen,
    noteFormStarted: noteFormStarted,
    noteShiftSaved: noteShiftSaved,
    showConsentDialog: showConsentDialog,
    getConsentStatus: function() { return consentStatus; }
  };

  function boot() {
    ensureStyles();
    installInteractionTracking();
    var attempts = 0;
    var timer = window.setInterval(function() {
      attempts += 1;
      if (initializeForUser() || attempts > 120) window.clearInterval(timer);
    }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
