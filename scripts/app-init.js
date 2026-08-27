if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('app-init', 'v410');

// ── Init ──
function startShiftTrackerRuntime() {
  if (startShiftTrackerRuntime.started) return;
  startShiftTrackerRuntime.started = true;
  if (typeof bootstrapAppStartup === 'function') {
    bootstrapAppStartup();
  } else {
    if (typeof bootstrapCachedShellFromStorage === 'function') {
      bootstrapCachedShellFromStorage();
    }
    if (typeof startBackgroundBootstrap === 'function') {
      window.requestAnimationFrame(function() {
        window.setTimeout(startBackgroundBootstrap, 320);
      });
    }
  }
}

if (window.__SHIFT_TRACKER_RUNTIME_GUARD_PENDING) {
  window.addEventListener('shifttracker:runtime-ready', startShiftTrackerRuntime, { once: true });
} else {
  startShiftTrackerRuntime();
}

// Keep modal/sheet state derived from DOM classes. This prevents an invisible
// overlay/backdrop from capturing taps after a failed transition or interrupted
// navigation in standalone PWA mode.
(function bindOverlayRecovery() {
  function sync() {
    try {
      if (typeof window.__shiftTrackerSyncOverlayUiState === 'function') {
        window.__shiftTrackerSyncOverlayUiState();
      }
    } catch (e) {}
  }

  var scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function() {
      scheduled = false;
      sync();
    });
  }

  document.addEventListener('click', scheduleSync, true);
  document.addEventListener('pointerdown', scheduleSync, true);
  window.addEventListener('pageshow', scheduleSync);
  window.addEventListener('focus', scheduleSync);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) scheduleSync();
  });

  try {
    var observer = new MutationObserver(scheduleSync);
    var targets = document.querySelectorAll('.overlay, .shift-detail-overlay, .docs-viewer-overlay, #shiftActionsBackdrop');
    for (var i = 0; i < targets.length; i++) {
      observer.observe(targets[i], { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
    }
  } catch (e2) {}

  window.setInterval(sync, 2500);
  scheduleSync();
})();

// Fuel sections — show A/B/V depending on loco series (3* → A/B/V, 2* → A/B, else → A).
(function bindLocoSections() {
  var selectEl = document.getElementById('inputLocoSeries');
  // Gate on the form section (not the add panel) — the form moves into the edit
  // sheet when editing, so the panel would no longer contain the fuel section.
  var form = document.getElementById('shiftFormSection');
  if (!selectEl || !form) return;
  function sectionsFor(value) {
    var v = String(value || '').trim().toUpperCase();
    if (!v) return '';
    if (v.charAt(0) === '3') return '3';
    if (v.charAt(0) === '2') return '2';
    return '1';
  }
  function apply() {
    var s = sectionsFor(selectEl.value);
    if (s) form.setAttribute('data-loco-sections', s);
    else form.removeAttribute('data-loco-sections');
  }
  selectEl.addEventListener('change', apply);
  // Also reapply when the legacy glass-select sets the value programmatically.
  var observer = new MutationObserver(apply);
  observer.observe(selectEl, { attributes: true, attributeFilter: ['value'] });
  // Custom event from glass-select dispatches 'input' on the native select.
  selectEl.addEventListener('input', apply);
  apply();
})();

// Notifications system — backed by localStorage, surfaced via the top-bar bell.
(function bindNotifications() {
  var STORAGE_KEY = 'shift_tracker_notifications_v1';
  var READ_STORAGE_KEY = 'shift_tracker_notifications_read_v1';
  var bell = document.getElementById('appTopBarBell');
  var dotEl = bell && bell.querySelector('.app-top-bar-icon-dot');
  var overlay = document.getElementById('overlayNotifications');
  var listEl = document.getElementById('notifList');
  var btnRead = document.getElementById('btnNotifMarkRead');
  var btnClose = document.getElementById('btnNotifClose');
  var DAY_MS = 24 * 60 * 60 * 1000;
  var MAX_STORED_ITEMS = 30;
  var UNREAD_RETENTION_MS = 45 * DAY_MS;

  function load() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      var items = raw ? (JSON.parse(raw) || []) : [];
      if (!Array.isArray(items)) items = [];
      return items;
    } catch (e) { return []; }
  }
  function save(items) {
    try { window.localStorage && window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
  }
  function normalizeReadKey(value) {
    var key = String(value || '').trim();
    return key ? key.slice(0, 160) : '';
  }
  function getReadKey(item) {
    item = item || {};
    return normalizeReadKey(item.readKey || item.key || (item.id ? ('id:' + item.id) : ''));
  }
  function loadReadKeys() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(READ_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      var map = {};
      if (Array.isArray(parsed)) {
        parsed.forEach(function(key) {
          key = normalizeReadKey(key);
          if (key) map[key] = Date.now();
        });
      } else if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(function(key) {
          key = normalizeReadKey(key);
          if (key) map[key] = parsed[key] || Date.now();
        });
      }
      return map;
    } catch (e) { return {}; }
  }
  function saveReadKeys(map) {
    try { window.localStorage && window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(map || {})); } catch (e) {}
  }
  function rememberReadKey(key, map) {
    key = normalizeReadKey(key);
    if (!key) return false;
    map = map || loadReadKeys();
    if (map[key]) return false;
    map[key] = Date.now();
    return true;
  }
  function isReadRemembered(item) {
    var key = getReadKey(item);
    if (!key) return false;
    return !!loadReadKeys()[key];
  }
  function rememberReadItems(items) {
    var map = loadReadKeys();
    var changed = false;
    (items || []).forEach(function(item) {
      if (item && item.read) {
        changed = rememberReadKey(getReadKey(item), map) || changed;
      }
    });
    if (changed) saveReadKeys(map);
  }
  function fmtAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин назад';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' ч назад';
    var d = Math.floor(h / 24);
    if (d < 30) return d + ' дн назад';
    return new Date(ts).toLocaleDateString('ru-RU');
  }
  function escape(s) {
    return String(s || '').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function unreadCount(items) {
    var n = 0;
    for (var i = 0; i < items.length; i++) if (!items[i].read) n++;
    return n;
  }
  function genId() {
    return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function releaseTime(value) {
    var parsed = Date.parse(value);
    return isFinite(parsed) ? parsed : Date.now();
  }
  function optionalTime(value) {
    if (value === null || typeof value === 'undefined' || value === '') return 0;
    var parsed = typeof value === 'number' ? value : Date.parse(value);
    return isFinite(parsed) ? parsed : 0;
  }
  function sameAnnouncement(item, announcement) {
    if (!item || !announcement) return false;
    return (
      (announcement.key && item.key === announcement.key) ||
      (announcement.readKey && item.readKey === announcement.readKey) ||
      (announcement.title && normalizeAnnouncementTitle(item.title) === normalizeAnnouncementTitle(announcement.title))
    );
  }
  function normalizeAnnouncementTitle(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/ё/g, 'е')
      .replace(/Ё/g, 'Е')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function buildTitleLookup(titles) {
    var lookup = {};
    (titles || []).forEach(function(title) {
      var key = normalizeAnnouncementTitle(title);
      if (key) lookup[key] = true;
    });
    return lookup;
  }
  function isRetiredAnnouncement(item) {
    if (isKnownAnnouncement(item, RETIRED_SYSTEM_ANNOUNCEMENTS)) return true;
    return !!RETIRED_SYSTEM_ANNOUNCEMENT_TITLE_LOOKUP[normalizeAnnouncementTitle(item && item.title)];
  }
  function isKnownAnnouncement(item, announcements) {
    announcements = announcements || [];
    for (var i = 0; i < announcements.length; i++) {
      if (sameAnnouncement(item, announcements[i])) return true;
    }
    return false;
  }
  function isExpired(item, now) {
    var expiresAt = optionalTime(item && item.expiresAt);
    return !!expiresAt && expiresAt <= now;
  }
  function compactNotifications(items) {
    var now = Date.now();
    var readKeys = loadReadKeys();
    var readKeysChanged = false;
    var changed = false;
    var source = Array.isArray(items) ? items : [];
    var kept = [];

    source.forEach(function(item) {
      if (!item || typeof item !== 'object') {
        changed = true;
        return;
      }
      if (!item.id) {
        item.id = genId();
        changed = true;
      }
      var readKey = getReadKey(item);
      if (readKey && readKeys[readKey] && !item.read) {
        item.read = true;
        changed = true;
      }
      if (item.read && rememberReadKey(readKey, readKeys)) {
        readKeysChanged = true;
      }
      if (item.read) {
        changed = true;
        return;
      }
      var isActiveSystem = isKnownAnnouncement(item, SYSTEM_ANNOUNCEMENTS);
      if (isRetiredAnnouncement(item) || isExpired(item, now)) {
        changed = true;
        return;
      }
      if (!isActiveSystem) {
        var ts = optionalTime(item.ts) || now;
        var age = now - ts;
        if (!item.read && age > UNREAD_RETENTION_MS) {
          changed = true;
          return;
        }
      }
      kept.push(item);
    });

    kept.sort(function(a, b) {
      return ((b && b.ts) || 0) - ((a && a.ts) || 0);
    });
    if (kept.length > MAX_STORED_ITEMS) {
      kept = kept.slice(0, MAX_STORED_ITEMS);
      changed = true;
    }
    if (readKeysChanged) saveReadKeys(readKeys);
    return { items: kept, changed: changed };
  }
  function loadClean() {
    var items = load();
    var compacted = compactNotifications(items);
    if (compacted.changed) save(compacted.items);
    return compacted.items;
  }
  function updateBell(items) {
    if (!dotEl) return;
    var n = unreadCount(items || loadClean());
    dotEl.style.display = n > 0 ? 'block' : 'none';
    dotEl.setAttribute('data-count', String(n));
  }
  var CHEVRON = '<div class="notif-row-chevron" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
    '</div>';
  function render() {
    var items = loadClean();
    updateBell(items);
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<div class="notif-empty">Уведомлений нет</div>';
      return;
    }
    var html = '';
    items.slice().sort(function(a, b) {
      return ((b && b.ts) || 0) - ((a && a.ts) || 0);
    }).slice(0, 30).forEach(function(it) {
      var tone = it.tone || 'info';
      var hasText = !!it.text;
      html += '<div class="notif-row notif-tone-' + escape(tone) + (it.read ? ' is-read' : ' is-unread') + '"' +
          ' data-id="' + escape(it.id || '') + '" role="button" tabindex="0"' +
          (hasText ? ' aria-expanded="false"' : '') + '>' +
        '<div class="notif-row-dot" aria-hidden="true"></div>' +
        '<div class="notif-row-body">' +
          '<div class="notif-row-title">' + escape(it.title) + '</div>' +
          (hasText ? '<div class="notif-row-text">' + escape(it.text) + '</div>' : '') +
          '<div class="notif-row-time">' + escape(fmtAgo(it.ts)) + '</div>' +
        '</div>' +
        (hasText ? CHEVRON : '') +
      '</div>';
    });
    listEl.innerHTML = html;
  }
  function setRead(id) {
    if (!id) return false;
    var items = load();
    var readKeys = loadReadKeys();
    var changed = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        if (!items[i].read) { items[i].read = true; changed = true; }
        if (rememberReadKey(getReadKey(items[i]), readKeys)) changed = true;
      }
    }
    if (changed) { save(items); saveReadKeys(readKeys); updateBell(items); }
    return changed;
  }
  function activateRow(row) {
    if (!row) return;
    if (row.hasAttribute('aria-expanded')) {
      var expanded = !row.classList.contains('is-expanded');
      row.classList.toggle('is-expanded', expanded);
      row.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    if (!row.classList.contains('is-read')) {
      row.classList.add('is-read');
      row.classList.remove('is-unread');
      setRead(row.getAttribute('data-id'));
    }
    if (typeof triggerHapticTapLight === 'function') { try { triggerHapticTapLight(); } catch (e) {} }
  }
  function addNotification(title, text, tone, opts) {
    opts = opts || {};
    var items = loadClean();
    var now = Date.now();
    var readKey = normalizeReadKey(opts.readKey || opts.key || '');
    if (opts.key) {
      // Idempotent announcement: never re-add, so its read state sticks.
      for (var k = 0; k < items.length; k++) {
        if (items[k].key === opts.key) {
          items[k].readKey = readKey || items[k].readKey || null;
          if (!items[k].read && isReadRemembered(items[k])) items[k].read = true;
          if (opts.replace) {
            items[k].title = title;
            items[k].text = text || '';
            items[k].tone = tone || 'info';
            items[k].ts = opts.ts || items[k].ts || now;
            items[k].expiresAt = opts.expiresAt || null;
            save(items);
          }
          render();
          return;
        }
      }
    } else if (items.some(function(it){ return it.title === title && (now - (it.ts || 0)) < 24*3600*1000; })) {
      // Dedup transient notifications by title within last 24h.
      render();
      return;
    }
    items.unshift({
      id: genId(),
      key: opts.key || null,
      readKey: readKey || null,
      title: title,
      text: text || '',
      tone: tone || 'info',
      ts: opts.ts || now,
      expiresAt: opts.expiresAt || null,
      read: isReadRemembered({ readKey: readKey })
    });
    items = compactNotifications(items).items;
    save(items);
    render();
  }
  function open() {
    if (!overlay) return;
    if (typeof openOverlay === 'function') {
      openOverlay('overlayNotifications');
      return;
    }
    overlay.classList.add('is-open', 'visible');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof window.__shiftTrackerSyncOverlayUiState === 'function') window.__shiftTrackerSyncOverlayUiState();
    else document.body && document.body.classList.add('has-open-overlay');
  }
  function close() {
    if (!overlay) return;
    if (typeof closeOverlay === 'function') {
      closeOverlay('overlayNotifications');
    } else {
      overlay.classList.remove('is-open', 'visible');
      overlay.setAttribute('aria-hidden', 'true');
      if (typeof window.__shiftTrackerSyncOverlayUiState === 'function') window.__shiftTrackerSyncOverlayUiState();
      else document.body && document.body.classList.remove('has-open-overlay');
    }
    render();
  }
  if (bell) {
    bell.addEventListener('click', function(e) {
      e.preventDefault();
      render();
      open();
      if (typeof triggerHapticTapLight === 'function') { try { triggerHapticTapLight(); } catch (e2) {} }
    });
  }
  if (btnClose) {
    btnClose.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  }
  if (overlay) overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      e.preventDefault();
      close();
    }
  });
  if (listEl) {
    listEl.addEventListener('click', function(e) {
      var row = e.target.closest ? e.target.closest('.notif-row') : null;
      if (row) {
        e.preventDefault();
        e.stopPropagation();
        activateRow(row);
      }
    });
    listEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        var row = e.target.closest ? e.target.closest('.notif-row') : null;
        if (row) { e.preventDefault(); activateRow(row); }
      }
    });
  }
  if (btnRead) {
    btnRead.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var items = load();
      var readKeys = loadReadKeys();
      for (var i = 0; i < items.length; i++) items[i].read = true;
      for (var k = 0; k < items.length; k++) rememberReadKey(getReadKey(items[k]), readKeys);
      save(items);
      saveReadKeys(readKeys);
      render();
    });
  }

  var RETIRED_SYSTEM_ANNOUNCEMENTS = [
    {
      key: 'nav_refresh_2026_06_v1',
      readKey: 'announcement_nav_refresh_2026_06',
      title: 'Большое обновление'
    },
    {
      key: 'feedback_links_2026_06_v1',
      readKey: 'announcement_feedback_links_2026_06',
      title: 'Помощь и обратная связь'
    },
    {
      key: 'docs_bd_folders_2026_06_v1',
      readKey: 'announcement_docs_bd_folders_2026_06',
      title: 'Документы и Папки'
    },
    {
      key: 'brigade_launch_2026_06_v1',
      readKey: 'announcement_brigade_launch_2026_06',
      title: 'Бригада'
    },
    {
      key: 'poekhali_launch_2026_06_v1',
      readKey: 'announcement_poekhali_launch_2026_06',
      title: 'Поехали'
    },
    {
      key: 'offline_mode_restored_2026_06_v1',
      readKey: 'announcement_offline_mode_restored_2026_06',
      title: 'Оффлайн режим снова работает'
    }
  ];
  var RETIRED_SYSTEM_ANNOUNCEMENT_TITLE_LOOKUP = buildTitleLookup([
    'Большое обновление',
    'Помощь и обратная связь',
    'Документы и Папки',
    'Документы и папки',
    'Бригада',
    'Поехали',
    'Оффлайн режим снова работает'
  ]);

  var SYSTEM_ANNOUNCEMENTS = [
    {
      key: 'offline_mode_fixed_2026_06_v2',
      readKey: 'announcement_offline_mode_fixed_2026_06_v2',
      title: 'Оффлайн режим работает',
      tone: 'success',
      ts: releaseTime('2026-06-21T13:58:00+10:00'),
      expiresAt: releaseTime('2026-08-21T13:58:00+10:00'),
      text:
        'Блокнот снова открывается без связи после одного запуска с интернетом.\n' +
        'Сохраненные смены и данные останутся доступны оффлайн.'
    }
  ];

  function rememberReadSystemAnnouncements(items) {
    var readKeys = loadReadKeys();
    var changed = false;
    (items || []).forEach(function(stored) {
      if (!stored || !stored.read) return;
      SYSTEM_ANNOUNCEMENTS.concat(RETIRED_SYSTEM_ANNOUNCEMENTS).forEach(function(announcement) {
        if (
          stored.readKey === announcement.readKey ||
          stored.key === announcement.key ||
          stored.title === announcement.title
        ) {
          changed = rememberReadKey(announcement.readKey || announcement.key, readKeys) || changed;
        }
      });
    });
    if (changed) saveReadKeys(readKeys);
  }

  function seedSystemAnnouncements() {
    SYSTEM_ANNOUNCEMENTS.forEach(function(item) {
      addNotification(item.title, item.text, item.tone, {
        key: item.key,
        readKey: item.readKey,
        ts: item.ts,
        expiresAt: item.expiresAt,
        replace: true
      });
    });
  }

  rememberReadItems(load());
  rememberReadSystemAnnouncements(load());
  seedSystemAnnouncements();

  // Expose for other modules.
  window.appNotify = addNotification;
  render();
})();

// App top bar — title + subtitle per active tab.
(function bindAppTopBar() {
  var titleEl = document.getElementById('appTopBarTitle');
  var subEl = document.getElementById('appTopBarSub');
  var bar = document.getElementById('appTopBar');
  if (!titleEl || !subEl || !bar) return;
  var BAR_BY_TAB = {
    home:         { title: 'Блокнот машиниста', sub: '' },
    add:          { title: 'Новая смена',       sub: 'Сначала только время' },
    instructions: { title: 'Документы',         sub: 'Локальная библиотека' },
    shifts:       { title: 'Смены',             sub: 'Журнал и часы' },
    poekhali:     { title: 'Поехали',            sub: 'Поездка и подготовка' },
    profile:      { title: 'Профиль',           sub: 'Личный кабинет' }
  };
  function getUserLabel() {
    try {
      var raw = window.localStorage && window.localStorage.getItem('shift_tracker_cached_user_v1');
      if (!raw) return '';
      var u = JSON.parse(raw);
      if (!u) return '';
      var dn = (u.display_name || '').trim();
      if (dn) return dn;
      var first = (u.first_name || '').trim();
      var last = (u.last_name || '').trim();
      if (first) return first + (last ? ' ' + last.charAt(0) + '.' : '');
      return (u.username || '').toString();
    } catch (e) { return ''; }
  }
  function applyForTab(tab) {
    var cfg = BAR_BY_TAB[tab] || BAR_BY_TAB.home;
    titleEl.textContent = cfg.title;
    var sub = cfg.sub;
    if (tab === 'home') {
      var name = getUserLabel();
      var depot = (typeof window.getProfileDepot === 'function') ? window.getProfileDepot() : '';
      if (name && depot) sub = name + ' · ' + depot;
      else sub = name || depot || '';
    }
    if (sub) {
      subEl.textContent = sub;
      subEl.classList.remove('hidden');
    } else {
      subEl.textContent = '';
      subEl.classList.add('hidden');
    }
    bar.setAttribute('data-tab', tab);
    bar.classList.remove('hidden');
    var gpsEl = document.getElementById('appTopBarGps');
    var previewEl = document.getElementById('appTopBarPreview');
    var wayEl = document.getElementById('appTopBarWay');
    if (gpsEl) gpsEl.classList.toggle('hidden', tab !== 'poekhali');
    if (previewEl) previewEl.classList.toggle('hidden', tab !== 'poekhali');
    if (wayEl) wayEl.classList.toggle('hidden', tab !== 'poekhali');
  }

  (function bindWayChip() {
    var wayChip = document.getElementById('appTopBarWay');
    var wayValueEl = document.getElementById('appTopBarWayValue');
    if (!wayChip) return;
    wayChip.addEventListener('click', function() {
      var legacy = document.getElementById('btnPoekhaliWay');
      if (legacy) legacy.click();
    });
    function syncWayLabel() {
      var legacy = document.getElementById('btnPoekhaliWay');
      if (!legacy || !wayValueEl) return;
      var text = (legacy.textContent || '').trim();
      if (text) wayValueEl.textContent = text.replace(':', ' ');
    }
    syncWayLabel();
    window.setInterval(syncWayLabel, 1000);
  })();

  (function bindGpsChip() {
    var gpsChip = document.getElementById('appTopBarGps');
    if (!gpsChip) return;
    gpsChip.addEventListener('click', function() {
      var legacy = document.getElementById('btnPoekhaliLive');
      if (legacy) legacy.click();
    });
  })();

  (function bindPoekhaliPreviewChip() {
    var previewChip = document.getElementById('appTopBarPreview');
    if (!previewChip) return;
    previewChip.addEventListener('click', function() {
      var legacy = document.getElementById('btnPoekhaliPreview');
      if (legacy) legacy.click();
      else if (typeof window.setPoekhaliPositioningMode === 'function') window.setPoekhaliPositioningMode('preview');
    });
  })();

  // Profile panel identity — Telegram fallback + editable name, role, depot, avatar.
  (function bindProfileIdentity() {
    var PROFILE_KEY = 'shift_tracker_profile_v1';
    var avatarEl = document.getElementById('profileAvatar');
    var avatarIconHtml = avatarEl ? avatarEl.innerHTML : '';

    function loadExtras() {
      try {
        var raw = window.localStorage && window.localStorage.getItem(PROFILE_KEY);
        var o = raw ? JSON.parse(raw) : {};
        return (o && typeof o === 'object') ? o : {};
      } catch (e) { return {}; }
    }
    function normalizeProfileText(value, maxLen) {
      var limit = maxLen || 120;
      return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, limit);
    }
    // Merge-save so updating one profile field keeps the rest.
    function saveExtras(patch) {
      try {
        var cur = loadExtras();
        var next = {
          firstName: normalizeProfileText(cur.firstName, 80),
          lastName: normalizeProfileText(cur.lastName, 80),
          role: normalizeProfileText(cur.role),
          depot: normalizeProfileText(cur.depot),
          railwayId: normalizeProfileText(cur.railwayId, 80),
          depotId: normalizeProfileText(cur.depotId, 160),
          avatar: cur.avatar || ''
        };
        if (patch && 'firstName' in patch) next.firstName = normalizeProfileText(patch.firstName, 80);
        if (patch && 'lastName' in patch) next.lastName = normalizeProfileText(patch.lastName, 80);
        if (patch && 'role' in patch) next.role = normalizeProfileText(patch.role);
        if (patch && 'depot' in patch) next.depot = normalizeProfileText(patch.depot);
        if (patch && 'railwayId' in patch) next.railwayId = normalizeProfileText(patch.railwayId, 80);
        if (patch && 'depotId' in patch) next.depotId = normalizeProfileText(patch.depotId, 160);
        if (patch && 'avatar' in patch) next.avatar = patch.avatar || '';
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('profilecatalogchange', { detail: { railwayId: next.railwayId, depotId: next.depotId } }));
      } catch (e) {}
    }
    // Exposed so the Home top-bar subtitle can use the user's real depot.
    window.getProfileDepot = function() { return (loadExtras().depot || '').trim(); };

    // ── Cross-device profile sync ──────────────────────────────────────────
    // localStorage is per-context (the PWA and the Telegram webview keep
    // separate stores), so role/depot/avatar set in one never showed up in the
    // other. Mirror them to the server keyed by the authenticated user.
    var PROFILE_API_URL = (window.SHIFT_API_BASE_URL || '') + '/api/profile';
    var DEPOT_PROPOSAL_API_URL = (window.SHIFT_API_BASE_URL || '') + '/api/depot-pack-requests';
    var DEPOT_CATALOG_BASE_URL = '/assets/catalog/';
    var profileSyncInFlight = false;
    var profileSyncQueued = false;
    var depotCatalogPromise = null;
    var depotPackPromises = Object.create(null);

    function safeCatalogUrl(relativePath) {
      var path = String(relativePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
      if (!path || path.indexOf('..') !== -1 || path.charAt(0) === '/') return '';
      return DEPOT_CATALOG_BASE_URL + path;
    }

    function fetchCatalogDocument(relativePath) {
      var url = safeCatalogUrl(relativePath);
      if (!url) return Promise.reject(new Error('Некорректный путь каталога'));
      return fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } }).then(function(response) {
        if (!response.ok) throw new Error('Каталог недоступен: HTTP ' + response.status);
        return response.json();
      });
    }

    function loadDepotCatalog() {
      if (depotCatalogPromise) return depotCatalogPromise;
      depotCatalogPromise = fetchCatalogDocument('index.json').then(function(index) {
        var files = index && index.files ? index.files : {};
        return Promise.all([
          fetchCatalogDocument(files.railways || 'railways.json'),
          fetchCatalogDocument(files.depots || 'depots.json')
        ]).then(function(documents) {
          return {
            index: index || {},
            railways: Array.isArray(documents[0] && documents[0].railways) ? documents[0].railways : [],
            depots: Array.isArray(documents[1] && documents[1].depots) ? documents[1].depots : []
          };
        });
      }).catch(function(error) {
        depotCatalogPromise = null;
        throw error;
      });
      return depotCatalogPromise;
    }

    function findCatalogDepot(catalog, depotId) {
      var target = String(depotId || '');
      var depots = catalog && Array.isArray(catalog.depots) ? catalog.depots : [];
      for (var i = 0; i < depots.length; i++) {
        if (String(depots[i] && depots[i].id || '') === target) return depots[i];
      }
      return null;
    }

    function normalizeDepotSearch(value) {
      return String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
    }

    function inferCatalogDepot(catalog, depotText) {
      var query = normalizeDepotSearch(depotText);
      if (!query) return null;
      var depots = catalog && Array.isArray(catalog.depots) ? catalog.depots : [];
      var best = null;
      var bestScore = 0;
      for (var i = 0; i < depots.length; i++) {
        var depot = depots[i] || {};
        var code = normalizeDepotSearch(depot.code);
        var name = normalizeDepotSearch(depot.name);
        var aliases = Array.isArray(depot.aliases)
          ? normalizeDepotSearch(depot.aliases.join(' '))
          : '';
        var score = 0;
        if (code && query.indexOf(code) !== -1) score += 5;
        if (name && (query.indexOf(name) !== -1 || name.indexOf(query) !== -1)) score += 5;
        if (aliases && (query.indexOf(aliases) !== -1 || aliases.indexOf(query) !== -1)) score += 5;
        var nameParts = name.split(' ').filter(function(part) { return part.length >= 4; });
        for (var p = 0; p < nameParts.length; p++) {
          if (query.indexOf(nameParts[p]) !== -1) score += 1;
        }
        if (score > bestScore) {
          best = depot;
          bestScore = score;
        }
      }
      return bestScore >= 5 ? best : null;
    }

    function getResolvedCatalogDepot(catalog, extras) {
      extras = extras || loadExtras();
      return findCatalogDepot(catalog, extras.depotId) || inferCatalogDepot(catalog, extras.depot);
    }

    function depotDisplayLabel(depot) {
      if (!depot) return '';
      return [depot.code || '', depot.name || ''].filter(Boolean).join(' · ');
    }

    function loadDepotPackById(depotId) {
      return loadDepotCatalog().then(function(catalog) {
        var depot = findCatalogDepot(catalog, depotId);
        if (!depot || !depot.pack_file) return { catalog: catalog, depot: depot, pack: null };
        var cacheKey = String(depot.id || depotId);
        if (!depotPackPromises[cacheKey]) {
          depotPackPromises[cacheKey] = fetchCatalogDocument(depot.pack_file).catch(function(error) {
            delete depotPackPromises[cacheKey];
            throw error;
          });
        }
        return depotPackPromises[cacheKey].then(function(pack) {
          return { catalog: catalog, depot: depot, pack: pack };
        });
      });
    }

    function getProfileCatalogSelection() {
      var extras = loadExtras();
      var railwaySelect = document.getElementById('inputProfileRailwayId');
      var depotSelect = document.getElementById('inputProfileDepotId');
      var customDepot = document.getElementById('inputProfileDepot');
      var depotId = depotSelect && depotSelect.value && depotSelect.value !== '__custom__'
        ? depotSelect.value
        : (extras.depotId || '');
      var selectedDepotLabel = depotSelect && depotSelect.value && depotSelect.selectedIndex >= 0 && depotSelect.value !== '__custom__'
        ? String(depotSelect.options[depotSelect.selectedIndex].textContent || '')
        : '';
      return {
        railwayId: railwaySelect && railwaySelect.value ? railwaySelect.value : (extras.railwayId || ''),
        depotId: depotId,
        depot: customDepot && !customDepot.classList.contains('hidden')
          ? customDepot.value
          : (selectedDepotLabel || extras.depot || '')
      };
    }

    window.ProfileDepotCatalog = {
      load: loadDepotCatalog,
      getSelection: getProfileCatalogSelection,
      resolveSelectedDepot: function() {
        return loadDepotCatalog().then(function(catalog) {
          return { catalog: catalog, depot: getResolvedCatalogDepot(catalog, loadExtras()) };
        });
      },
      loadSelectedPack: function() {
        return loadDepotCatalog().then(function(catalog) {
          var depot = getResolvedCatalogDepot(catalog, loadExtras());
          if (!depot) return { catalog: catalog, depot: null, pack: null };
          return loadDepotPackById(depot.id);
        });
      },
      loadPackByDepotId: loadDepotPackById,
      depotLabel: depotDisplayLabel
    };

    function loadProfileFromServer() {
      if (!navigator.onLine || typeof fetchJson !== 'function') return;
      fetchJson(PROFILE_API_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 6000).then(function(result) {
        if (!result || !result.ok || !result.body || !result.body.profile) return;
        var p = result.body.profile;
        var serverProfile = {
          firstName: p.firstName || p.first_name || '',
          lastName: p.lastName || p.last_name || '',
          role: p.role || '',
          depot: p.depot || '',
          railwayId: p.railwayId || p.railway_id || '',
          depotId: p.depotId || p.depot_id || '',
          avatar: p.avatar || ''
        };
        var cur = loadExtras();
        // Server is the source of truth for cross-device fields. Only repaint
        // when something actually changed to avoid clobbering a local edit.
        if (serverProfile.firstName === (cur.firstName || '') &&
            serverProfile.lastName === (cur.lastName || '') &&
            serverProfile.role === (cur.role || '') &&
            serverProfile.depot === (cur.depot || '') &&
            serverProfile.railwayId === (cur.railwayId || '') &&
            serverProfile.depotId === (cur.depotId || '') &&
            serverProfile.avatar === (cur.avatar || '')) return;
        saveExtras(serverProfile);
        renderHeader();
        paintAvatar(document.getElementById('profileEditAvatarPreview'));
        updateClearPhotoBtn();
      }).catch(function() {});
    }

    function syncProfileToServer() {
      if (!navigator.onLine || typeof fetchJson !== 'function') return;
      if (profileSyncInFlight) {
        profileSyncQueued = true;
        return;
      }
      var ex = loadExtras();
      profileSyncInFlight = true;
      profileSyncQueued = false;
      function finishProfileSync() {
        profileSyncInFlight = false;
        if (profileSyncQueued) {
          syncProfileToServer();
        }
      }
      fetchJson(PROFILE_API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          profile: {
            firstName: ex.firstName || '',
            lastName: ex.lastName || '',
            role: ex.role || '',
            depot: ex.depot || '',
            railwayId: ex.railwayId || '',
            depotId: ex.depotId || '',
            avatar: ex.avatar || ''
          }
        })
      }, 9000).then(function() {
        try {
          if (window.BrigadePartners && typeof window.BrigadePartners.refresh === 'function') {
            window.BrigadePartners.refresh();
          }
        } catch (e) {}
        finishProfileSync();
      }).catch(finishProfileSync);
    }

    function getUser() {
      try {
        var cu = window.CURRENT_USER;
        if (cu && cu.id !== undefined && cu.id !== null && String(cu.id) !== 'guest') return cu;
      } catch (e) {}
      try {
        var raw = window.localStorage.getItem('shift_tracker_cached_user_v1');
        return raw ? (JSON.parse(raw) || {}) : {};
      } catch (e) { return {}; }
    }
    function resolveName(u) {
      u = u || {};
      var dn = String(u.display_name || '').trim();
      if (dn) return dn;
      var fn = (String(u.first_name || '') + ' ' + String(u.last_name || '')).trim();
      if (fn) return fn;
      if (u.username) return String(u.username);
      return 'Без имени';
    }
    function resolveProfileName(extras, u) {
      extras = extras || loadExtras();
      var manual = (normalizeProfileText(extras.firstName, 80) + ' ' + normalizeProfileText(extras.lastName, 80)).trim();
      return manual || resolveName(u || getUser());
    }
    function telegramPhoto() {
      try {
        var tg = window.Telegram && window.Telegram.WebApp;
        var user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
        return user && user.photo_url ? String(user.photo_url) : '';
      } catch (e) { return ''; }
    }
    function initials(name) {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '';
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }

    // Priority: manual photo → live Telegram photo → initials → generic icon.
    function currentAvatarSrc() {
      var manual = (loadExtras().avatar || '').trim();
      if (manual) return manual;
      return telegramPhoto();
    }
    function paintAvatar(el) {
      if (!el) return;
      el.classList.remove('has-photo', 'has-initials');
      var src = currentAvatarSrc();
      if (src) {
        el.innerHTML = '';
        var img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.className = 'profile-avatar-img';
        el.appendChild(img);
        el.classList.add('has-photo');
        return;
      }
      var name = resolveProfileName(loadExtras(), getUser());
      var ini = (name && name !== 'Без имени') ? initials(name) : '';
      if (ini) {
        el.textContent = ini;
        el.classList.add('has-initials');
      } else {
        el.innerHTML = avatarIconHtml;
      }
    }

    function renderHeader() {
      var nameEl = document.getElementById('profileName');
      var subEl2 = document.getElementById('profileSub');
      var u = getUser();
      var extras = loadExtras();
      var name = resolveProfileName(extras, u);
      if (nameEl) nameEl.textContent = name;

      var parts = [];
      if (extras.role) parts.push(extras.role);
      if (extras.depot) parts.push(extras.depot);
      if (subEl2) subEl2.textContent = parts.length ? parts.join(' · ') : 'Добавьте должность и депо';

      paintAvatar(avatarEl);
    }

    // ── Manual avatar: tap avatar → pick file → circular crop (pan + zoom) ──
    function updateClearPhotoBtn() {
      var clearBtn = document.getElementById('btnProfileClearPhoto');
      if (clearBtn) clearBtn.classList.toggle('hidden', !(loadExtras().avatar || '').trim());
    }
    function fileToDataUrl(file, cb) {
      var r = new FileReader();
      r.onload = function () { cb(r.result); };
      r.onerror = function () { cb(''); };
      r.readAsDataURL(file);
    }

    var crop = { natW: 0, natH: 0, V: 0, base: 1, z: 1, scale: 1, tx: 0, ty: 0, drag: false, lastX: 0, lastY: 0 };
    var cropImgEl = document.getElementById('avatarCropImg');
    var cropStageEl = document.getElementById('avatarCropStage');
    var cropZoomEl = document.getElementById('avatarCropZoom');

    function cropApply() {
      crop.scale = crop.base * crop.z;
      var w = crop.natW * crop.scale, h = crop.natH * crop.scale;
      var minTx = crop.V - w, minTy = crop.V - h;
      if (crop.tx > 0) crop.tx = 0;
      if (crop.tx < minTx) crop.tx = minTx;
      if (crop.ty > 0) crop.ty = 0;
      if (crop.ty < minTy) crop.ty = minTy;
      if (cropImgEl) {
        cropImgEl.style.width = w + 'px';
        cropImgEl.style.height = h + 'px';
        cropImgEl.style.left = crop.tx + 'px';
        cropImgEl.style.top = crop.ty + 'px';
      }
    }
    function openCropWith(dataUrl) {
      var probe = new Image();
      probe.onload = function () {
        crop.natW = probe.naturalWidth;
        crop.natH = probe.naturalHeight;
        if (typeof openOverlay === 'function') openOverlay('overlayAvatarCrop');
        window.requestAnimationFrame(function () {
          crop.V = (cropStageEl && cropStageEl.clientWidth) || 260;
          crop.base = crop.V / Math.max(1, Math.min(crop.natW, crop.natH));
          crop.z = 1;
          if (cropZoomEl) cropZoomEl.value = '1';
          crop.scale = crop.base;
          crop.tx = (crop.V - crop.natW * crop.scale) / 2;
          crop.ty = (crop.V - crop.natH * crop.scale) / 2;
          if (cropImgEl) cropImgEl.src = dataUrl;
          cropApply();
        });
      };
      probe.onerror = function () {};
      probe.src = dataUrl;
    }
    if (cropStageEl) {
      cropStageEl.addEventListener('pointerdown', function (e) {
        crop.drag = true; crop.lastX = e.clientX; crop.lastY = e.clientY;
        if (cropStageEl.setPointerCapture) { try { cropStageEl.setPointerCapture(e.pointerId); } catch (er) {} }
      });
      cropStageEl.addEventListener('pointermove', function (e) {
        if (!crop.drag) return;
        crop.tx += e.clientX - crop.lastX;
        crop.ty += e.clientY - crop.lastY;
        crop.lastX = e.clientX; crop.lastY = e.clientY;
        cropApply();
      });
      var endDrag = function () { crop.drag = false; };
      cropStageEl.addEventListener('pointerup', endDrag);
      cropStageEl.addEventListener('pointercancel', endDrag);
    }
    if (cropZoomEl) {
      cropZoomEl.addEventListener('input', function () {
        var newZ = parseFloat(cropZoomEl.value) || 1;
        var oldScale = crop.base * crop.z;
        var newScale = crop.base * newZ;
        var c = crop.V / 2;
        crop.tx = c - (c - crop.tx) * (newScale / oldScale);
        crop.ty = c - (c - crop.ty) * (newScale / oldScale);
        crop.z = newZ;
        cropApply();
      });
    }
    function cropToDataUrl() {
      if (!cropImgEl || !crop.scale) return '';
      var O = 320;
      var canvas = document.createElement('canvas');
      canvas.width = O; canvas.height = O;
      var ctx = canvas.getContext('2d');
      var sV = crop.V / crop.scale;
      var sx = -crop.tx / crop.scale;
      var sy = -crop.ty / crop.scale;
      try { ctx.drawImage(cropImgEl, sx, sy, sV, sV, 0, 0, O, O); }
      catch (e) { return ''; }
      return canvas.toDataURL('image/jpeg', 0.85);
    }

    var pickPhotoBtn = document.getElementById('btnProfilePickPhoto');
    var photoInput = document.getElementById('inputProfilePhoto');
    var clearPhotoBtn = document.getElementById('btnProfileClearPhoto');
    if (pickPhotoBtn && photoInput) {
      pickPhotoBtn.addEventListener('click', function () { photoInput.click(); });
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (file) fileToDataUrl(file, function (url) { if (url) openCropWith(url); });
        photoInput.value = '';
      });
    }
    var cropSaveBtn = document.getElementById('btnAvatarCropSave');
    var cropCancelBtn = document.getElementById('btnAvatarCropCancel');
    if (cropSaveBtn) {
      cropSaveBtn.addEventListener('click', function () {
        var url = cropToDataUrl();
        if (url) {
          saveExtras({ avatar: url });
          paintAvatar(avatarEl);
          paintAvatar(document.getElementById('profileEditAvatarPreview'));
          updateClearPhotoBtn();
          syncProfileToServer();
        }
        if (typeof closeOverlay === 'function') closeOverlay('overlayAvatarCrop');
      });
    }
    if (cropCancelBtn) {
      cropCancelBtn.addEventListener('click', function () {
        if (typeof closeOverlay === 'function') closeOverlay('overlayAvatarCrop');
      });
    }
    if (clearPhotoBtn) {
      clearPhotoBtn.addEventListener('click', function () {
        saveExtras({ avatar: '' });
        paintAvatar(avatarEl);
        paintAvatar(document.getElementById('profileEditAvatarPreview'));
        updateClearPhotoBtn();
        syncProfileToServer();
      });
    }

    var profileCatalogRenderToken = 0;
    var depotProposalContext = null;
    var depotProposalMode = 'demand';
    var depotProposalFiles = [];
    var depotProposalDraft = null;
    var depotProposalDuplicate = false;
    var depotProposalBusy = false;

    function refreshGlassSelect(rootId) {
      var root = document.getElementById(rootId);
      if (!root || !window.GlassSelect) return;
      if (typeof GlassSelect.refresh === 'function') GlassSelect.refresh(root);
      if (typeof GlassSelect.sync === 'function') GlassSelect.sync(root);
    }

    function replaceSelectOptions(select, options, selectedValue) {
      if (!select) return;
      while (select.firstChild) select.removeChild(select.firstChild);
      for (var i = 0; i < options.length; i++) {
        var item = options[i] || {};
        var option = document.createElement('option');
        option.value = String(item.value || '');
        option.textContent = String(item.label || '');
        select.appendChild(option);
      }
      select.value = String(selectedValue || '');
      if (select.value !== String(selectedValue || '')) select.value = '';
    }

    function setCatalogSelectDisabled(rootId, select, disabled) {
      if (select) select.disabled = !!disabled;
      var root = document.getElementById(rootId);
      var trigger = root && root.querySelector('.glass-select-trigger');
      if (trigger) trigger.disabled = !!disabled;
      if (root) root.classList.toggle('is-disabled', !!disabled);
    }

    function renderDepotCoverage(catalog, depotId, isCustom) {
      var coverage = document.getElementById('profileDepotCoverage');
      var text = document.getElementById('profileDepotCoverageText');
      var proposeBtn = document.getElementById('btnProfileProposeArm');
      var moderation = document.getElementById('profileDepotModerationNote');
      if (!coverage || !text) return;
      coverage.classList.remove('is-ready', 'is-missing');
      var depot = findCatalogDepot(catalog, depotId);
      if (depot && depot.pack_file) {
        coverage.classList.add('is-ready');
        text.textContent = 'Пакет участка доступен. Считаем плечи…';
        loadDepotPackById(depot.id).then(function(result) {
          if (!result || !result.pack || !text) return;
          var arms = Array.isArray(result.pack.service_arms) ? result.pack.service_arms.length : 0;
          text.textContent = arms
            ? (arms + ' ' + (arms === 1 ? 'плечо' : arms < 5 ? 'плеча' : 'плеч') + ' · подготовка без GPS')
            : 'Пакет участка доступен';
        }).catch(function() {
          coverage.classList.remove('is-ready');
          coverage.classList.add('is-missing');
          text.textContent = 'Не удалось загрузить пакет. Попробуйте ещё раз позже.';
        });
      } else if (depot || isCustom) {
        coverage.classList.add('is-missing');
        text.textContent = depot
          ? 'Пакет участка ещё не собран. Можно предложить плечи и материалы.'
          : 'Этого депо пока нет в каталоге. Его можно предложить.';
      } else {
        text.textContent = 'Выберите дорогу и депо, чтобы увидеть доступные участки.';
      }
      var canPropose = !!depot || !!isCustom;
      if (proposeBtn) {
        proposeBtn.classList.toggle('hidden', !canPropose);
        proposeBtn.textContent = depot && depot.pack_file ? 'Предложить другое плечо' : 'Предложить депо или плечо';
      }
      if (moderation) moderation.classList.toggle('hidden', !canPropose);
    }

    function populateProfileDepots(catalog, railwayId, selectedDepotId, customSelected) {
      var depotSelect = document.getElementById('inputProfileDepotId');
      var customInput = document.getElementById('inputProfileDepot');
      var options = [{ value: '', label: railwayId ? 'Выберите депо' : 'Сначала выберите дорогу' }];
      var depots = (catalog.depots || []).filter(function(depot) {
        return depot && depot.railway_id === railwayId && depot.status !== 'retired';
      }).sort(function(a, b) {
        return depotDisplayLabel(a).localeCompare(depotDisplayLabel(b), 'ru');
      });
      for (var i = 0; i < depots.length; i++) {
        options.push({ value: depots[i].id, label: depotDisplayLabel(depots[i]) });
      }
      if (railwayId) options.push({ value: '__custom__', label: 'Моего депо нет в списке' });
      var targetValue = customSelected ? '__custom__' : selectedDepotId;
      replaceSelectOptions(depotSelect, options, targetValue);
      var depotRoot = document.getElementById('profileDepotSelect');
      if (depotRoot) depotRoot.setAttribute('data-placeholder', railwayId ? 'Выберите депо' : 'Сначала выберите дорогу');
      setCatalogSelectDisabled('profileDepotSelect', depotSelect, !railwayId);
      if (customInput) customInput.classList.toggle('hidden', !customSelected);
      refreshGlassSelect('profileDepotSelect');
      renderDepotCoverage(catalog, selectedDepotId, customSelected);
    }

    function syncProfileCatalogUi(extras) {
      var token = ++profileCatalogRenderToken;
      var coverageText = document.getElementById('profileDepotCoverageText');
      if (coverageText) coverageText.textContent = 'Загружаем каталог депо…';
      return loadDepotCatalog().then(function(catalog) {
        if (token !== profileCatalogRenderToken) return;
        extras = extras || loadExtras();
        var resolvedDepot = getResolvedCatalogDepot(catalog, extras);
        var railwayId = extras.railwayId || (resolvedDepot && resolvedDepot.railway_id) || '';
        var selectedDepotId = extras.depotId || (resolvedDepot && resolvedDepot.id) || '';
        var isLegacyCustom = !!extras.depot && !resolvedDepot;
        var railwaySelect = document.getElementById('inputProfileRailwayId');
        var railwayOptions = [{ value: '', label: 'Выберите дорогу' }];
        for (var i = 0; i < catalog.railways.length; i++) {
          var railway = catalog.railways[i] || {};
          railwayOptions.push({ value: railway.id, label: railway.short_name || railway.name || railway.id });
        }
        replaceSelectOptions(railwaySelect, railwayOptions, railwayId);
        refreshGlassSelect('profileRailwaySelect');
        var legacyNote = document.getElementById('profileLegacyDepotNote');
        var customInput = document.getElementById('inputProfileDepot');
        if (customInput) customInput.value = extras.depot || '';
        if (legacyNote) legacyNote.classList.toggle('hidden', !isLegacyCustom);
        populateProfileDepots(catalog, railwayId, selectedDepotId, isLegacyCustom && !!railwayId);
        if (isLegacyCustom && !railwayId) {
          if (customInput) customInput.classList.remove('hidden');
          renderDepotCoverage(catalog, '', true);
        }
      }).catch(function() {
        if (token !== profileCatalogRenderToken) return;
        var customInput = document.getElementById('inputProfileDepot');
        if (customInput) {
          customInput.value = extras && extras.depot ? extras.depot : '';
          customInput.classList.remove('hidden');
        }
        if (coverageText) coverageText.textContent = 'Каталог сейчас недоступен. Название депо можно сохранить вручную.';
        var coverage = document.getElementById('profileDepotCoverage');
        if (coverage) coverage.classList.add('is-missing');
      });
    }

    var railwayCatalogSelect = document.getElementById('inputProfileRailwayId');
    var depotCatalogSelect = document.getElementById('inputProfileDepotId');
    if (railwayCatalogSelect) {
      railwayCatalogSelect.addEventListener('change', function() {
        loadDepotCatalog().then(function(catalog) {
          populateProfileDepots(catalog, railwayCatalogSelect.value, '', false);
        }).catch(function() {});
      });
    }
    if (depotCatalogSelect) {
      depotCatalogSelect.addEventListener('change', function() {
        loadDepotCatalog().then(function(catalog) {
          var custom = depotCatalogSelect.value === '__custom__';
          var customInput = document.getElementById('inputProfileDepot');
          if (customInput) {
            customInput.classList.toggle('hidden', !custom);
            if (custom) customInput.focus();
          }
          renderDepotCoverage(catalog, custom ? '' : depotCatalogSelect.value, custom);
        }).catch(function() {});
      });
    }

    function formatDepotProposalFileSize(bytes) {
      var size = Math.max(0, Number(bytes) || 0);
      if (size < 1024) return size + ' Б';
      if (size < 1024 * 1024) return Math.round(size / 1024) + ' КБ';
      return (size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0) + ' МБ';
    }

    function renderDepotProposalFiles() {
      var root = document.getElementById('depotProposalFiles');
      if (!root) return;
      while (root.firstChild) root.removeChild(root.firstChild);
      root.classList.toggle('hidden', depotProposalFiles.length === 0);
      for (var i = 0; i < depotProposalFiles.length; i++) {
        var item = depotProposalFiles[i];
        var row = document.createElement('div');
        row.className = 'depot-proposal-file';

        var kind = document.createElement('span');
        kind.className = 'depot-proposal-file-kind';
        kind.textContent = item.kind === 'electronic-map' ? 'ЭК' : (item.kind === 'regime-map' ? 'РК' : 'ДОК');

        var copy = document.createElement('span');
        copy.className = 'depot-proposal-file-copy';
        var name = document.createElement('span');
        name.className = 'depot-proposal-file-name';
        name.textContent = item.file.name || 'Материал без названия';
        var meta = document.createElement('span');
        meta.className = 'depot-proposal-file-meta';
        var statusText = '';
        if (item.status === 'uploading') statusText = ' · загружается';
        if (item.status === 'uploaded') statusText = item.automaticCheck === 'manual' ? ' · принял, проверим вручную' : ' · формат распознан';
        if (item.status === 'error') statusText = ' · не загрузился, можно повторить';
        meta.textContent = formatDepotProposalFileSize(item.file.size) + statusText;
        copy.appendChild(name);
        copy.appendChild(meta);

        var remove = document.createElement('button');
        remove.className = 'depot-proposal-file-remove';
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Убрать ' + (item.file.name || 'файл'));
        remove.dataset.fileIndex = String(i);
        remove.disabled = depotProposalBusy || item.status === 'uploaded';

        row.appendChild(kind);
        row.appendChild(copy);
        row.appendChild(remove);
        root.appendChild(row);
      }
    }

    function resetDepotProposalDraft() {
      depotProposalDraft = null;
      for (var i = 0; i < depotProposalFiles.length; i++) {
        depotProposalFiles[i].status = 'queued';
        depotProposalFiles[i].attachmentId = '';
        depotProposalFiles[i].automaticCheck = '';
      }
    }

    function setDepotProposalMode(mode) {
      var nextMode = mode === 'documents' ? 'documents' : (mode === 'materials' ? 'materials' : 'demand');
      if (nextMode !== depotProposalMode) depotProposalFiles = [];
      depotProposalMode = nextMode;
      var demandPanel = document.getElementById('depotProposalDemandPanel');
      var materialsPanel = document.getElementById('depotProposalMaterialsPanel');
      var documentsPanel = document.getElementById('depotProposalDocumentsPanel');
      var title = document.getElementById('depotProposalSheetTitle');
      var subtitle = document.getElementById('depotProposalSheetSubtitle');
      var titleLabel = document.getElementById('depotProposalTitleLabel');
      var titleInput = document.getElementById('inputDepotProposalArm');
      var notes = document.getElementById('inputDepotProposalNotes');
      var send = document.getElementById('btnDepotProposalSend');
      var modeButtons = document.querySelectorAll('[data-proposal-mode]');
      for (var i = 0; i < modeButtons.length; i++) {
        var isActive = modeButtons[i].dataset.proposalMode === depotProposalMode;
        modeButtons[i].classList.toggle('is-active', isActive);
        modeButtons[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      if (demandPanel) demandPanel.classList.toggle('hidden', depotProposalMode !== 'demand');
      if (materialsPanel) materialsPanel.classList.toggle('hidden', depotProposalMode !== 'materials');
      if (documentsPanel) documentsPanel.classList.toggle('hidden', depotProposalMode !== 'documents');
      if (title) title.textContent = depotProposalMode === 'documents' ? 'Предложить документ' : 'Добавить участок';
      if (subtitle) subtitle.textContent = depotProposalMode === 'documents'
        ? 'Материал попадёт в очередь проверки'
        : 'Запросите его или передайте материалы';
      if (titleLabel) titleLabel.textContent = depotProposalMode === 'documents' ? 'Название документа' : 'Плечо обслуживания';
      if (titleInput) titleInput.placeholder = depotProposalMode === 'documents'
        ? 'Например, Инструкция по охране труда ТЧЭ-9'
        : 'Например, Комсомольск — Высокогорная';
      if (notes) notes.placeholder = depotProposalMode === 'documents'
        ? 'Укажите дату, номер, источник и почему материал ещё актуален'
        : (depotProposalMode === 'materials'
          ? 'Например, особенности участка или приложения, из которого выгружена карта'
          : 'Например, до какой станции нужен профиль');
      if (send && !depotProposalBusy) send.textContent = depotProposalMode === 'documents' ? 'Отправить на проверку' : (depotProposalMode === 'materials' ? 'Передать материалы' : 'Отправить запрос');
      resetDepotProposalDraft();
      renderDepotProposalFiles();
    }

    function addDepotProposalFiles(fileList, kind) {
      var incoming = Array.prototype.slice.call(fileList || []);
      var tooLarge = false;
      var tooMany = false;
      var totalBytes = depotProposalFiles.reduce(function(sum, item) { return sum + item.file.size; }, 0);
      var maxFileBytes = depotProposalMode === 'documents' ? 25 * 1024 * 1024 : 50 * 1024 * 1024;
      var maxTotalBytes = depotProposalMode === 'documents' ? 60 * 1024 * 1024 : 120 * 1024 * 1024;
      var maxFiles = depotProposalMode === 'documents' ? 3 : 8;
      for (var i = 0; i < incoming.length; i++) {
        var file = incoming[i];
        if (!file || !file.size) continue;
        if (file.size > maxFileBytes || totalBytes + file.size > maxTotalBytes) {
          tooLarge = true;
          continue;
        }
        if (depotProposalFiles.length >= maxFiles) {
          tooMany = true;
          break;
        }
        var duplicate = depotProposalFiles.some(function(item) {
          return item.kind === kind && item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified;
        });
        if (duplicate) continue;
        depotProposalFiles.push({ file: file, kind: kind, status: 'queued', attachmentId: '', automaticCheck: '' });
        totalBytes += file.size;
      }
      resetDepotProposalDraft();
      renderDepotProposalFiles();
      if (tooLarge && typeof enqueueAppToast === 'function') enqueueAppToast(depotProposalMode === 'documents' ? 'До 25 МБ на файл и 60 МБ за отправку' : 'До 50 МБ на файл и 120 МБ за отправку', 'neutral', 2800);
      if (tooMany && typeof enqueueAppToast === 'function') enqueueAppToast(depotProposalMode === 'documents' ? 'К одному документу можно приложить до 3 файлов' : 'За один раз можно передать до 8 файлов', 'neutral', 2600);
    }

    function setDepotProposalBusy(busy, progressText) {
      depotProposalBusy = !!busy;
      var send = document.getElementById('btnDepotProposalSend');
      var close = document.getElementById('btnDepotProposalCancel');
      var uploadButtons = [document.getElementById('btnDepotProposalEMap'), document.getElementById('btnDepotProposalRegime'), document.getElementById('btnDepotProposalDocument')];
      var modeButtons = document.querySelectorAll('[data-proposal-mode]');
      if (send) {
        send.disabled = depotProposalBusy;
        send.textContent = depotProposalBusy ? (progressText || 'Отправляем…') : (depotProposalMode === 'documents' ? 'Отправить на проверку' : (depotProposalMode === 'materials' ? 'Передать материалы' : 'Отправить запрос'));
      }
      if (close) close.disabled = depotProposalBusy;
      for (var i = 0; i < uploadButtons.length; i++) if (uploadButtons[i]) uploadButtons[i].disabled = depotProposalBusy;
      for (var j = 0; j < modeButtons.length; j++) modeButtons[j].disabled = depotProposalBusy;
      renderDepotProposalFiles();
    }

    function setDepotProposalProgress(text) {
      var progress = document.getElementById('depotProposalProgress');
      if (!progress) return;
      progress.textContent = text || '';
      progress.classList.toggle('hidden', !text);
    }

    function openDepotProposal(context) {
      context = context || {};
      var selection = getProfileCatalogSelection();
      depotProposalContext = {
        railwayId: context.railwayId || selection.railwayId || '',
        depotId: context.depotId || selection.depotId || '',
        depotLabel: context.depotLabel || selection.depot || '',
        source: context.source || 'profile'
      };
      depotProposalFiles = [];
      depotProposalDraft = null;
      depotProposalDuplicate = false;
      var label = document.getElementById('depotProposalDepotLabel');
      var armInput = document.getElementById('inputDepotProposalArm');
      var notesInput = document.getElementById('inputDepotProposalNotes');
      var emapInput = document.getElementById('inputDepotProposalEMap');
      var regimeInput = document.getElementById('inputDepotProposalRegime');
      var documentInput = document.getElementById('inputDepotProposalDocument');
      var documentCategory = document.getElementById('inputDepotProposalDocumentCategory');
      var documentScope = document.getElementById('inputDepotProposalDocumentScope');
      var modeRoot = document.querySelector('.depot-proposal-mode');
      var documentsModeButton = document.getElementById('btnDepotProposalDocumentsMode');
      if (label) label.textContent = depotProposalContext.depotLabel || 'Укажите депо в профиле';
      if (armInput) armInput.value = context.armName || '';
      if (notesInput) notesInput.value = '';
      if (emapInput) emapInput.value = '';
      if (regimeInput) regimeInput.value = '';
      if (documentInput) documentInput.value = '';
      if (documentCategory) documentCategory.value = context.documentCategory || 'instructions';
      if (documentScope) {
        var hasDocumentDepot = !!(depotProposalContext.depotId || depotProposalContext.depotLabel);
        var hasDocumentRailway = !!depotProposalContext.railwayId;
        Array.prototype.forEach.call(documentScope.options, function(option) {
          option.disabled = (option.value === 'depot' && !hasDocumentDepot) || (option.value === 'railway' && !hasDocumentRailway);
        });
        documentScope.value = context.scopeLevel || (hasDocumentDepot ? 'depot' : (hasDocumentRailway ? 'railway' : 'network'));
      }
      if (modeRoot) modeRoot.classList.toggle('hidden', context.mode === 'documents');
      if (documentsModeButton) documentsModeButton.classList.toggle('hidden', context.mode !== 'documents');
      setDepotProposalProgress('');
      setDepotProposalMode(context.mode || 'demand');
      if (typeof openOverlay === 'function') openOverlay('overlayDepotProposal');
    }
    window.openDepotProposal = openDepotProposal;

    var proposeArmBtn = document.getElementById('btnProfileProposeArm');
    if (proposeArmBtn) proposeArmBtn.addEventListener('click', function() { openDepotProposal({ source: 'profile' }); });
    var docsContributeBtn = document.getElementById('btnDocsContribute');
    if (docsContributeBtn) docsContributeBtn.addEventListener('click', function() { openDepotProposal({ source: 'documents', mode: 'documents' }); });
    var proposalCancelBtn = document.getElementById('btnDepotProposalCancel');
    if (proposalCancelBtn) proposalCancelBtn.addEventListener('click', function() {
      if (!depotProposalBusy && typeof closeOverlay === 'function') closeOverlay('overlayDepotProposal');
    });
    var proposalModeButtons = document.querySelectorAll('[data-proposal-mode]');
    for (var proposalModeIndex = 0; proposalModeIndex < proposalModeButtons.length; proposalModeIndex++) {
      proposalModeButtons[proposalModeIndex].addEventListener('click', function() { setDepotProposalMode(this.dataset.proposalMode); });
    }
    var proposalEMapBtn = document.getElementById('btnDepotProposalEMap');
    var proposalRegimeBtn = document.getElementById('btnDepotProposalRegime');
    var proposalEMapInput = document.getElementById('inputDepotProposalEMap');
    var proposalRegimeInput = document.getElementById('inputDepotProposalRegime');
    var proposalDocumentBtn = document.getElementById('btnDepotProposalDocument');
    var proposalDocumentInput = document.getElementById('inputDepotProposalDocument');
    if (proposalEMapBtn && proposalEMapInput) proposalEMapBtn.addEventListener('click', function() { proposalEMapInput.click(); });
    if (proposalRegimeBtn && proposalRegimeInput) proposalRegimeBtn.addEventListener('click', function() { proposalRegimeInput.click(); });
    if (proposalDocumentBtn && proposalDocumentInput) proposalDocumentBtn.addEventListener('click', function() { proposalDocumentInput.click(); });
    if (proposalEMapInput) proposalEMapInput.addEventListener('change', function() {
      addDepotProposalFiles(this.files, 'electronic-map');
      this.value = '';
    });
    if (proposalRegimeInput) proposalRegimeInput.addEventListener('change', function() {
      addDepotProposalFiles(this.files, 'regime-map');
      this.value = '';
    });
    if (proposalDocumentInput) proposalDocumentInput.addEventListener('change', function() {
      addDepotProposalFiles(this.files, 'document');
      this.value = '';
    });
    var proposalFilesRoot = document.getElementById('depotProposalFiles');
    if (proposalFilesRoot) proposalFilesRoot.addEventListener('click', function(event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-file-index]') : null;
      if (!button || depotProposalBusy) return;
      var index = Number(button.dataset.fileIndex);
      if (!Number.isInteger(index) || index < 0 || index >= depotProposalFiles.length) return;
      depotProposalFiles.splice(index, 1);
      resetDepotProposalDraft();
      renderDepotProposalFiles();
    });

    var proposalSendBtn = document.getElementById('btnDepotProposalSend');
    if (proposalSendBtn) proposalSendBtn.addEventListener('click', function() {
      var armInput = document.getElementById('inputDepotProposalArm');
      var notesInput = document.getElementById('inputDepotProposalNotes');
      var armName = normalizeProfileText(armInput && armInput.value, 120);
      var notes = normalizeProfileText(notesInput && notesInput.value, 600);
      if (!armName) {
        if (typeof enqueueAppToast === 'function') enqueueAppToast(depotProposalMode === 'documents' ? 'Укажите название документа' : 'Укажите плечо обслуживания', 'neutral', 2200);
        if (armInput) armInput.focus();
        return;
      }
      if (depotProposalMode === 'materials' && depotProposalFiles.length === 0) {
        if (typeof enqueueAppToast === 'function') enqueueAppToast('Выберите электронную или режимную карту', 'neutral', 2400);
        return;
      }
      if (depotProposalMode === 'documents' && depotProposalFiles.length === 0) {
        if (typeof enqueueAppToast === 'function') enqueueAppToast('Выберите хотя бы один файл', 'neutral', 2400);
        return;
      }

      var hasUploads = depotProposalMode !== 'demand';
      setDepotProposalBusy(true, hasUploads ? 'Готовим загрузку…' : 'Отправляем…');
      setDepotProposalProgress(hasUploads ? 'Подготавливаем материалы…' : '');
      var createDraft = depotProposalDraft
        ? Promise.resolve(depotProposalDraft)
        : fetchJson(DEPOT_PROPOSAL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            railwayId: depotProposalContext && depotProposalContext.railwayId || '',
            depotId: depotProposalContext && depotProposalContext.depotId || '',
            depotLabel: depotProposalContext && depotProposalContext.depotLabel || '',
            armName: armName,
            notes: notes,
            source: depotProposalContext && depotProposalContext.source || 'profile',
            requestType: depotProposalMode,
            documentCategory: document.getElementById('inputDepotProposalDocumentCategory') && document.getElementById('inputDepotProposalDocumentCategory').value || '',
            scopeLevel: document.getElementById('inputDepotProposalDocumentScope') && document.getElementById('inputDepotProposalDocumentScope').value || '',
            attachments: depotProposalFiles.map(function(item) {
              return { kind: item.kind, name: item.file.name, mime: item.file.type || '', size: item.file.size };
            })
          })
        }, 12000).then(function(result) {
          if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось отправить');
          depotProposalDuplicate = !!(result.body && result.body.duplicate);
          depotProposalDraft = result.body.request;
          var attachments = depotProposalDraft.attachments || [];
          for (var i = 0; i < depotProposalFiles.length; i++) depotProposalFiles[i].attachmentId = attachments[i] && attachments[i].id || '';
          return depotProposalDraft;
        });

      createDraft.then(function(draft) {
        if (depotProposalMode === 'demand') return draft;
        var chain = Promise.resolve();
        depotProposalFiles.forEach(function(item, index) {
          chain = chain.then(function() {
            if (item.status === 'uploaded') return;
            item.status = 'uploading';
            setDepotProposalProgress('Загружаем ' + (index + 1) + ' из ' + depotProposalFiles.length + ': ' + item.file.name);
            setDepotProposalBusy(true, 'Загружаем ' + (index + 1) + ' из ' + depotProposalFiles.length);
            return fetchJson(DEPOT_PROPOSAL_API_URL + '/' + draft.id + '/attachments/' + item.attachmentId, {
              method: 'PUT',
              headers: { 'Content-Type': item.file.type || 'application/octet-stream', 'Accept': 'application/json' },
              body: item.file
            }, 120000).then(function(result) {
              if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось загрузить ' + item.file.name);
              item.status = 'uploaded';
              item.automaticCheck = result.body && result.body.attachment && result.body.attachment.automaticCheck || 'manual';
              renderDepotProposalFiles();
            }).catch(function(error) {
              item.status = 'error';
              renderDepotProposalFiles();
              throw error;
            });
          });
        });
        return chain.then(function() {
          setDepotProposalProgress('Завершаем отправку…');
          return fetchJson(DEPOT_PROPOSAL_API_URL + '/' + draft.id + '/complete', {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
          }, 12000).then(function(result) {
            if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось завершить отправку');
            return result.body.request;
          });
        });
      }).then(function() {
        if (typeof closeOverlay === 'function') closeOverlay('overlayDepotProposal');
        if (typeof enqueueAppToast === 'function') {
          enqueueAppToast(depotProposalMode === 'materials'
            ? 'Материалы приняты на проверку'
            : (depotProposalMode === 'documents'
              ? 'Документ принят в очередь проверки'
              : (depotProposalDuplicate ? 'Такой запрос уже есть в очереди' : 'Запрос участка отправлен')), 'success', 2800);
        }
        depotProposalDraft = null;
        depotProposalDuplicate = false;
        depotProposalFiles = [];
        setDepotProposalProgress('');
      }).catch(function(error) {
        setDepotProposalProgress(error && error.message || 'Не удалось отправить');
        if (typeof enqueueAppToast === 'function') enqueueAppToast(error && error.message || 'Не удалось отправить', 'danger', 3000);
      }).then(function() {
        setDepotProposalBusy(false);
      });
    });

    var editBtn = document.getElementById('btnProfileEdit');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        var extras = loadExtras();
        var u = getUser();
        var firstNameInp = document.getElementById('inputProfileFirstName');
        var lastNameInp = document.getElementById('inputProfileLastName');
        var roleSel = document.getElementById('inputProfileRole');
        if (firstNameInp) firstNameInp.value = extras.firstName || normalizeProfileText(u.first_name, 80);
        if (lastNameInp) lastNameInp.value = extras.lastName || normalizeProfileText(u.last_name, 80);
        if (roleSel) roleSel.value = extras.role || '';
        if (window.GlassSelect && typeof GlassSelect.sync === 'function') {
          GlassSelect.sync(document.getElementById('profileRoleSelect'));
        }
        syncProfileCatalogUi(extras);
        paintAvatar(document.getElementById('profileEditAvatarPreview'));
        updateClearPhotoBtn();
        if (typeof openOverlay === 'function') openOverlay('overlayProfileEdit');
      });
    }
    var saveBtn = document.getElementById('btnSaveProfileEdit');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var firstNameInp = document.getElementById('inputProfileFirstName');
        var lastNameInp = document.getElementById('inputProfileLastName');
        var roleSel = document.getElementById('inputProfileRole');
        var depotInp = document.getElementById('inputProfileDepot');
        var railwaySelect = document.getElementById('inputProfileRailwayId');
        var depotSelect = document.getElementById('inputProfileDepotId');
        var selectedDepotId = depotSelect && depotSelect.value !== '__custom__' ? depotSelect.value : '';
        loadDepotCatalog().catch(function() { return null; }).then(function(catalog) {
          var selectedDepot = catalog ? findCatalogDepot(catalog, selectedDepotId) : null;
          var depotText = selectedDepot
            ? [selectedDepot.code || '', selectedDepot.name || ''].filter(Boolean).join(' ')
            : (depotInp ? depotInp.value : '');
          saveExtras({
            firstName: firstNameInp ? firstNameInp.value : '',
            lastName: lastNameInp ? lastNameInp.value : '',
            role: roleSel ? roleSel.value : '',
            depot: depotText,
            railwayId: railwaySelect ? railwaySelect.value : '',
            depotId: selectedDepot ? selectedDepot.id : ''
          });
          renderHeader();
          syncProfileToServer();
          if (typeof closeOverlay === 'function') closeOverlay('overlayProfileEdit');
        });
      });
    }

    renderHeader();
    window.syncProfileIdentity = renderHeader;
    window.getProfileDisplayName = function() { return resolveProfileName(loadExtras(), getUser()); };
    // Pull profile fields saved from another device/context. Also exposed
    // so the auth flow can re-pull once the session is actually established.
    window.loadProfileFromServer = loadProfileFromServer;
    loadProfileFromServer();
  })();

  // Initial
  var initial = document.querySelector('.tab-panel.active');
  applyForTab(initial ? initial.getAttribute('data-tab') : 'home');
  window.addEventListener('app:tabchange', function(e) {
    var detail = e && e.detail ? e.detail : {};
    applyForTab(detail.tab || 'home');
  });
  // Track tab clicks (capture phase so it runs after setActiveTab)
  document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.tab-btn[data-tab]');
    if (btn) {
      var t = btn.getAttribute('data-tab');
      window.setTimeout(function() { applyForTab(t); }, 30);
      return;
    }
    // "Все смены ›" link on Home or any element marked with data-go-tab
    var link = e.target.closest && e.target.closest('#homeAllShiftsLink, [data-go-tab]');
    if (link) {
      var targetTab = link.getAttribute('data-go-tab') || 'shifts';
      window.setTimeout(function() { applyForTab(targetTab); }, 60);
    }
  });
})();

// Poekhali design layout — feed live tracker state into the DOM.
(function bindPoekhaliDesign() {
  var design = document.getElementById('trkDesign');
  if (!design) return;

  // --- Round speedometer geometry (КЛУБ-style 270° dial) ---
  var GAUGE = { cx: 110, cy: 110, r: 88, start: 135, sweep: 270, max: 120 };
  var SVGNS = 'http://www.w3.org/2000/svg';
  function gaugePolar(r, deg) {
    var a = deg * Math.PI / 180;
    return [GAUGE.cx + r * Math.cos(a), GAUGE.cy + r * Math.sin(a)];
  }
  function gaugeArc(r, a0, a1) {
    var p0 = gaugePolar(r, a0), p1 = gaugePolar(r, a1);
    var large = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
      ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  function gaugeValAngle(v) {
    var t = Math.max(0, Math.min(1, (Number(v) || 0) / GAUGE.max));
    return GAUGE.start + t * GAUGE.sweep;
  }
  function buildGaugeStatic() {
    var track = document.getElementById('trkGaugeTrack');
    if (track) track.setAttribute('d', gaugeArc(GAUGE.r, GAUGE.start, GAUGE.start + GAUGE.sweep));
    var ticks = document.getElementById('trkGaugeTicks');
    if (ticks && !ticks.childNodes.length) {
      for (var v = 0; v <= GAUGE.max; v += 10) {
        var ang = gaugeValAngle(v);
        var big = v % 20 === 0;
        var pa = gaugePolar(GAUGE.r - (big ? 12 : 7), ang);
        var pb = gaugePolar(GAUGE.r - 1, ang);
        var ln = document.createElementNS(SVGNS, 'line');
        ln.setAttribute('x1', pa[0].toFixed(2)); ln.setAttribute('y1', pa[1].toFixed(2));
        ln.setAttribute('x2', pb[0].toFixed(2)); ln.setAttribute('y2', pb[1].toFixed(2));
        ticks.appendChild(ln);
        if (big) {
          var pl = gaugePolar(GAUGE.r - 24, ang);
          var tx = document.createElementNS(SVGNS, 'text');
          tx.setAttribute('x', pl[0].toFixed(2)); tx.setAttribute('y', pl[1].toFixed(2));
          tx.textContent = String(v);
          ticks.appendChild(tx);
        }
      }
    }
  }
  function updateGauge(actual, allowed) {
    var prog = document.getElementById('trkGaugeProgress');
    if (prog) {
      if (actual > 0.5) prog.setAttribute('d', gaugeArc(GAUGE.r, GAUGE.start, gaugeValAngle(actual)));
      else prog.removeAttribute('d');
    }
    var mark = document.getElementById('trkGaugeAllowMark');
    if (mark) {
      if (isFinite(allowed) && allowed > 0) {
        var ang = gaugeValAngle(allowed);
        var a = gaugePolar(GAUGE.r - 13, ang), b = gaugePolar(GAUGE.r + 3, ang);
        mark.setAttribute('x1', a[0].toFixed(2)); mark.setAttribute('y1', a[1].toFixed(2));
        mark.setAttribute('x2', b[0].toFixed(2)); mark.setAttribute('y2', b[1].toFixed(2));
        mark.style.display = '';
      } else {
        mark.style.display = 'none';
      }
    }
  }
  buildGaugeStatic();

  function ruNum(n) { try { return Number(n).toLocaleString('ru-RU'); } catch (e) { return String(n); } }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function fmtTimer(ms) {
    if (!isFinite(ms) || ms < 0) return '—';
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(sec);
  }

  function pickRecentShift() {
    try {
      if (typeof window.getPoekhaliTrainDetails === 'function') {
        var details = window.getPoekhaliTrainDetails();
        if (details && details.hasShift && details.shift) return details.shift;
      }
    } catch (e) {}
    try {
      if (window.shifts && Array.isArray(window.shifts) && window.shifts.length) {
        return window.shifts.slice().sort(function(a, b) {
          var sa = String(a.start_msk || ''); var sb = String(b.start_msk || '');
          return sa < sb ? 1 : (sa > sb ? -1 : 0);
        })[0];
      }
    } catch (e) {}
    try {
      var keys = Object.keys(window.localStorage || {});
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('shift_tracker_shifts_cache_v1_') === 0) {
          var raw = window.localStorage.getItem(keys[i]);
          if (!raw) continue;
          var parsed = JSON.parse(raw);
          var arr = (parsed && parsed.shifts) ? parsed.shifts : ((parsed && parsed.items) ? parsed.items : (Array.isArray(parsed) ? parsed : []));
          if (!arr.length) continue;
          arr.sort(function(a, b) {
            var sa = String(a.start_msk || ''); var sb = String(b.start_msk || '');
            return sa < sb ? 1 : (sa > sb ? -1 : 0);
          });
          return arr[0];
        }
      }
    } catch (e) {}
    return null;
  }

  function updatePlate() {
    var s = pickRecentShift() || {};
    var locoStr = '';
    var locoSeries = s.locomotive_series || s.loco_series || '';
    var locoNumber = s.locomotive_number || s.loco_number || '';
    if (locoSeries && locoNumber) locoStr = locoSeries + ' № ' + locoNumber;
    else if (locoSeries) locoStr = locoSeries;
    else if (locoNumber) locoStr = '№ ' + locoNumber;
    var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('trkPlateLoco', locoStr || '—');
    set('trkPlateTrain', s.train_number ? ('поезд №' + s.train_number) : (s.id ? 'смена выбрана' : 'нет активной смены'));
    var weightEl = document.getElementById('trkPlateWeight');
    if (weightEl) weightEl.innerHTML = (s.train_weight ? ruNum(s.train_weight) : '—') + '<span class="u">т</span>';
    set('trkPlateAxles', s.train_axles ? String(s.train_axles) : '—');
    var lengthEl = document.getElementById('trkPlateLength');
    if (lengthEl) lengthEl.textContent = s.train_length ? ruNum(s.train_length) : '—';
  }

  function fmtTechSpeed(kmh) {
    // Technical speed is shown with one decimal and a comma, e.g. "32,6".
    return (Math.round(Number(kmh) * 10) / 10).toFixed(1).replace('.', ',');
  }

  function updateLive() {
    if (design.offsetParent === null) return; // hidden tab — skip
    // Live readouts are published by the tracker into window.poekhaliHud.
    var hud = window.poekhaliHud || {};
    var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };

    // Фактическая (actual) speed
    var speedKmh = isFinite(hud.speedKmh) ? Math.max(0, Number(hud.speedKmh)) : 0;
    set('trkSpeed', hud.speedMeters ? speedKmh.toFixed(1) : String(Math.round(speedKmh)));

    // Допустимая (allowed) speed — shown red in the gauge centre.
    var allowKmh = (isFinite(hud.limitKmh) && hud.limitKmh > 0) ? Math.round(hud.limitKmh) : null;
    set('trkAllow', allowKmh != null ? String(allowKmh) : '—');

    // Drive the round gauge (progress arc + allowed mark).
    updateGauge(speedKmh, allowKmh != null ? allowKmh : 0);

    // Overspeed: flip the actual-speed colour when above the allowed limit.
    var speedo = document.getElementById('trkSpeedo');
    if (speedo) {
      var over = allowKmh != null && speedKmh > allowKmh + 1;
      speedo.classList.toggle('is-over', !!over);
    }

    // Голова состава (head position) + Уклон / Далее
    set('trkHeadPos', hud.headPos || '—');
    set('trkGrade', hud.gradeText || '—');
    set('trkReach', hud.reachText || '—');
    var browseHud = document.getElementById('trkBrowseHud');
    if (browseHud) browseHud.hidden = !hud.browseActive;

    // В пути (timer)
    var timerMs = isFinite(hud.timerMs) ? hud.timerMs : 0;
    set('trkTimer', timerMs > 0 ? fmtTimer(timerMs) : '—');

    // Тех. скорость
    set('trkTechSpeed', (isFinite(hud.techSpeedKmh) && hud.techSpeedKmh > 0) ? fmtTechSpeed(hud.techSpeedKmh) : '—');

    // Clock МСК — prefer the tracker's МСК string, fall back to local compute.
    var clockEl = document.getElementById('trkClock');
    if (clockEl) {
      if (hud.msk) {
        clockEl.textContent = hud.msk;
      } else {
        try {
          clockEl.textContent = new Date().toLocaleTimeString('ru-RU', {
            timeZone: 'Europe/Moscow',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
          });
        } catch (e) {
          var now = new Date();
          var msk = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3 * 3600000));
          clockEl.textContent = pad(msk.getHours()) + ':' + pad(msk.getMinutes()) + ':' + pad(msk.getSeconds());
        }
      }
    }
    // Direction chip
    var dirBtn = document.getElementById('btnPoekhaliDirection');
    var dirChip = document.getElementById('trkChipDir');
    if (dirBtn && dirChip) {
      var v = dirChip.querySelector('.v');
      if (v) v.textContent = (dirBtn.textContent || '').trim() || 'АВТО';
    }
    // GPS status chip (top bar) — connection and local field-capture indicator.
    var gpsChip = document.getElementById('appTopBarGps');
    if (gpsChip) {
      var tone = hud.gpsTone || 'is-gps-muted';
      gpsChip.classList.remove('is-gps-ok', 'is-gps-warn', 'is-gps-muted', 'is-gps-error', 'is-on');
      gpsChip.classList.add(tone);
      gpsChip.classList.toggle('is-on', Boolean(hud.gpsCaptureActive));
      var gpsWord = gpsChip.querySelector('.app-top-bar-gps-word');
      if (gpsWord) {
        gpsWord.textContent = hud.positioningMode === 'preview'
          ? 'GPS · выкл'
          : hud.gpsCaptureError
          ? 'GPS · ПАМЯТЬ'
          : hud.gpsCaptureActive
          ? ('GPS · REC ' + String(hud.gpsRecordedSamples || 0))
          : (hud.gpsMeta && hud.gpsMeta !== '—' ? ('GPS · ' + hud.gpsMeta) : 'GPS');
      }
      gpsChip.title = hud.positioningMode === 'preview'
        ? 'Начать поездку с GPS'
        : hud.gpsCaptureError
        ? hud.gpsCaptureError
        : hud.gpsCaptureActive
          ? 'Контрольный проезд записывается локально: ' + String(hud.gpsRecordedSamples || 0) + ' точек. Нажмите, чтобы остановить'
          : hud.gpsCaptureAvailable
            ? 'Нажмите, чтобы начать локальную запись контрольного проезда'
        : 'GPS-позиционирование';
    }
    var previewChip = document.getElementById('appTopBarPreview');
    if (previewChip) {
      var previewActive = hud.positioningMode === 'preview';
      previewChip.classList.toggle('is-on', previewActive);
      previewChip.setAttribute('aria-pressed', previewActive ? 'true' : 'false');
      previewChip.title = previewActive ? 'Подготовка без GPS включена' : 'Посмотреть участок без GPS';
      previewChip.setAttribute('aria-label', previewChip.title);
    }
  }

  // Editor entry: explicit «+ Скорость» / «+ Предупреждение» buttons, plus tapping
  // the profile or the speedometer block as a shortcut.
  (function bindSpeedEditorEntry() {
    function openSpeeds() {
      if (typeof window.poekhaliOpenSpeedEditor === 'function') window.poekhaliOpenSpeedEditor();
    }
    var addSpeed = document.getElementById('trkAddSpeed');
    if (addSpeed) addSpeed.addEventListener('click', openSpeeds);
    var browseReturn = document.getElementById('trkBrowseReturn');
    if (browseReturn) {
      browseReturn.addEventListener('pointerdown', function(event) {
        event.stopPropagation();
      });
      browseReturn.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.poekhaliReturnToTrain === 'function') window.poekhaliReturnToTrain();
      });
    }
    var profileCard = design.querySelector('.trk-profile-card');
    if (profileCard) profileCard.addEventListener('click', openSpeeds);
    var speedo = design.querySelector('#trkSpeedo');
    if (speedo) {
      speedo.style.cursor = 'pointer';
      speedo.addEventListener('click', openSpeeds);
    }
  })();

  updatePlate();
  updateLive();
  // poll every 500ms while tab open
  window.setInterval(updateLive, 500);
  window.setInterval(updatePlate, 5000);
})();

// Poekhali — fill train info plate from the most recent manual shift.
(function bindPoekhaliTrainPlate() {
  var plate = document.getElementById('poekhaliTrainPlate') || document.getElementById('trkTrainPlate');
  if (!plate) return;
  function ruNum(n) { try { return Number(n).toLocaleString('ru-RU'); } catch (e) { return String(n); } }
  function pickRecentShift() {
    try {
      if (window.shifts && Array.isArray(window.shifts) && window.shifts.length) {
        return window.shifts.slice().sort(function(a, b) {
          var sa = String(a.start_msk || ''); var sb = String(b.start_msk || '');
          return sa < sb ? 1 : (sa > sb ? -1 : 0);
        })[0];
      }
    } catch (e) {}
    try {
      var keys = Object.keys(window.localStorage || {});
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('shift_tracker_shifts_cache_v1_') === 0) {
          var raw = window.localStorage.getItem(keys[i]);
          if (!raw) continue;
          var parsed = JSON.parse(raw);
          var arr = (parsed && parsed.items) ? parsed.items : (Array.isArray(parsed) ? parsed : []);
          if (!arr.length) continue;
          arr.sort(function(a, b) {
            var sa = String(a.start_msk || ''); var sb = String(b.start_msk || '');
            return sa < sb ? 1 : (sa > sb ? -1 : 0);
          });
          return arr[0];
        }
      }
    } catch (e) {}
    return null;
  }
  function fill() {
    var s = pickRecentShift();
    if (!s) { plate.hidden = true; return; }
    var locoStr = '';
    if (s.loco_series && s.loco_number) locoStr = s.loco_series + ' № ' + s.loco_number;
    else if (s.loco_series) locoStr = s.loco_series;
    else if (s.loco_number) locoStr = '№ ' + s.loco_number;
    var hasAny = locoStr || s.train_number || s.train_weight || s.train_axles || s.train_length;
    if (!hasAny) { plate.hidden = true; return; }
    plate.hidden = false;
    var locoEl = document.getElementById('poekhaliPlateLoco');
    var trainEl = document.getElementById('poekhaliPlateTrain');
    var weightEl = document.getElementById('poekhaliPlateWeight');
    var carsEl = document.getElementById('poekhaliPlateCars');
    var axlesEl = document.getElementById('poekhaliPlateAxles');
    var lengthEl = document.getElementById('poekhaliPlateLength');
    if (locoEl)  locoEl.textContent  = locoStr || '—';
    if (trainEl) trainEl.textContent = s.train_number ? ('поезд №' + s.train_number) : '—';
    if (weightEl) weightEl.innerHTML = (s.train_weight ? ruNum(s.train_weight) : '—') + '<span class="u">т</span>';
    if (carsEl)   carsEl.textContent  = s.cars ? ruNum(s.cars) : '—';
    if (axlesEl)  axlesEl.textContent  = s.train_axles ? String(s.train_axles) : '—';
    if (lengthEl) lengthEl.innerHTML  = (s.train_length ? ruNum(s.train_length) : '—') + '<span class="u">усл</span>';
  }
  // Fill on load and on storage update.
  window.addEventListener('storage', fill);
  window.setTimeout(fill, 1500);
})();

// Shifts tab: filter chips (Все / Дневные / Ночные / Праздничные) + dynamic top-bar sub.
(function bindShiftsFilters() {
  var filtersEl = document.getElementById('shiftsFilters');
  var listEl = document.getElementById('shiftsList');
  if (filtersEl && listEl) {
    filtersEl.addEventListener('click', function(e) {
      var btn = e.target.closest && e.target.closest('.shifts-filter-btn');
      if (!btn) return;
      filtersEl.querySelectorAll('.shifts-filter-btn').forEach(function(b) {
        b.classList.remove('is-on');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-on');
      btn.setAttribute('aria-selected', 'true');
      listEl.dataset.filter = btn.getAttribute('data-filter') || 'all';
    });
  }
  // Reflect "N смен · X ч Y м" in the top-bar sub when on shifts tab.
  var subEl = document.getElementById('appTopBarSub');
  var countEl = document.getElementById('shiftsOverviewCount');
  var totalEl = document.getElementById('shiftsOverviewTotal');
  function maybeUpdateSub() {
    var activePanel = document.querySelector('.tab-panel.active');
    if (!activePanel || activePanel.getAttribute('data-tab') !== 'shifts') return;
    if (!subEl || !countEl || !totalEl) return;
    var n = (countEl.textContent || '0').trim();
    var t = (totalEl.textContent || '0 ч').trim();
    subEl.textContent = n + (Number(n) === 1 ? ' смена · ' : ' смен · ') + t;
  }
  // Trigger after every render (MutationObserver on the list contents).
  if (countEl) new MutationObserver(maybeUpdateSub).observe(countEl, { childList: true, characterData: true, subtree: true });
  if (totalEl) new MutationObserver(maybeUpdateSub).observe(totalEl, { childList: true, characterData: true, subtree: true });
  document.addEventListener('click', function(e) {
    if (e.target.closest && e.target.closest('.tab-btn[data-tab="shifts"], #homeAllShiftsLink')) {
      window.setTimeout(maybeUpdateSub, 120);
    }
  });
})();

// "Все смены ›" link on Home — opens the shifts tab via the existing setActiveTab.
(function bindHomeAllShiftsLink() {
  var link = document.getElementById('homeAllShiftsLink');
  if (!link) return;
  link.addEventListener('click', function(e) {
    e.preventDefault();
    if (typeof setActiveTab === 'function') setActiveTab('shifts');
  });
})();

// Documents — favorites: star indicator on each document, separate "Избранное" panel.
(function bindDocsFavorites() {
  // v3 also stores document scope so changing depot cannot leak local files
  // through favorites saved for another profile.
  var STORAGE_KEY = 'shift_tracker_docs_favorites_v3';
  var entryCard = document.getElementById('docsEntryCard');
  var subnavCard = document.getElementById('docsSubnavCard');
  var favoritesPanel = document.getElementById('docsFavoritesPanel');
  var favoritesList = document.getElementById('docsFavoritesList');
  var favoritesTile = document.querySelector('[data-docs-entry="favorites"]');
  var allPanels = document.querySelectorAll('.docs-panel');
  if (!entryCard || !favoritesPanel || !favoritesTile) return;

  function load() {
    try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function save(items) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
  }
  function visibleItems() {
    return load().filter(function(item) {
      return typeof window.isDocScopeVisible !== 'function' || window.isDocScopeVisible(item && item.scope);
    });
  }
  function isFav(path) {
    var items = load();
    return items.some(function(it) { return it && it.path === path; });
  }
  function toggleFav(item) {
    var items = load();
    var idx = items.findIndex(function(it) { return it && it.path === item.path; });
    if (idx >= 0) items.splice(idx, 1);
    else items.unshift(item);
    save(items);
    updateCount();
    renderFavoritesList();
    return idx < 0;
  }
  function updateCount() {
    var c = visibleItems().length;
    var el = favoritesTile.querySelector('.docs-entry-count');
    if (el) el.textContent = String(c);
  }

  function buildItemDescriptor(rowEl) {
    // Real docs rows (rendered by docs-app.js) carry the file identity on data
    // attributes (URI-encoded) and show the title/footer in dedicated nodes.
    var filePath = rowEl.getAttribute('data-file-path') || '';
    var fileName = rowEl.getAttribute('data-file-name') || '';
    var mimeType = rowEl.getAttribute('data-mime-type') || '';
    var scope = { level: 'network' };
    try { scope = JSON.parse(decodeURIComponent(rowEl.getAttribute('data-doc-scope') || '')) || scope; } catch (e) {}

    var titleEl = rowEl.querySelector('.docs-item-title');
    var name = titleEl ? titleEl.textContent : '';
    if (!name) name = rowEl.textContent || '';
    name = name.trim();

    var metaEl = rowEl.querySelector('.docs-item-footer') || rowEl.querySelector('.docs-item-subtitle');
    var meta = metaEl ? (metaEl.textContent || '').trim() : '';

    // Identity for de-duplication: the file path when available, otherwise a
    // stable slug from the name (covers any non-file rows).
    var path = filePath || ('doc:' + name.toLowerCase().replace(/\s+/g, '_'));

    var ext = 'PDF';
    var low = (fileName || name).toLowerCase();
    if (low.indexOf('.docx') >= 0) ext = 'DOCX';
    else if (low.indexOf('реж') >= 0) ext = 'РЕЖ';

    // Snapshot the real icon + body markup so the favorites list renders
    // pixel-identically to the section rows (colored file icon, title,
    // subtitle, footer) instead of a stripped-down variant.
    var iconEl = rowEl.querySelector('.docs-item-icon');
    var bodyEl = rowEl.querySelector('.docs-item-body');
    var iconHTML = iconEl ? iconEl.outerHTML : '';
    var bodyHTML = bodyEl ? bodyEl.outerHTML : '';
    var stateClass = '';
    if (rowEl.classList) {
      if (rowEl.classList.contains('is-downloaded')) stateClass = 'is-downloaded';
      else if (rowEl.classList.contains('is-online-only')) stateClass = 'is-online-only';
    }

    return {
      path: path, name: name, meta: meta, ext: ext,
      filePath: filePath, fileName: fileName, mimeType: mimeType,
      iconHTML: iconHTML, bodyHTML: bodyHTML, stateClass: stateClass, scope: scope
    };
  }

  function ensureStarButton(rowEl) {
    if (!rowEl || rowEl.querySelector('.docs-fav-toggle')) return;
    if (!rowEl.classList || !rowEl.classList.contains('docs-item')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'docs-fav-toggle';
    btn.setAttribute('aria-label', 'В избранное');
    btn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="m10 3 2.2 5 5.3.5-4 3.6 1.2 5.3L10 14.4 5.3 17.4l1.2-5.3-4-3.6 5.3-.5Z"/></svg>';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var item = buildItemDescriptor(rowEl);
      var nowFav = toggleFav(item);
      btn.classList.toggle('is-on', nowFav);
      rowEl.classList.toggle('is-favorite', nowFav);
    });
    rowEl.appendChild(btn);
    rowEl.classList.add('has-fav-toggle');
    var item = buildItemDescriptor(rowEl);
    if (isFav(item.path)) {
      btn.classList.add('is-on');
      rowEl.classList.add('is-favorite');
    }
  }

  // Observe existing docs panels for newly rendered items.
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      m.addedNodes && m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('docs-item')) ensureStarButton(node);
        node.querySelectorAll && node.querySelectorAll('.docs-item').forEach(ensureStarButton);
      });
    }
  });
  allPanels.forEach(function(p) {
    observer.observe(p, { childList: true, subtree: true });
    // Initial pass for already-rendered items.
    p.querySelectorAll('.docs-item').forEach(ensureStarButton);
  });

  function renderFavoritesList() {
    if (!favoritesList) return;
    var items = visibleItems();
    if (!items.length) {
      favoritesList.innerHTML = '<div class="docs-fav-empty">Здесь пока пусто. Нажми на ⭐ у любого документа, чтобы добавить его сюда.</div>';
      return;
    }
    var removeStar =
      '<button class="docs-fav-toggle is-on" type="button" data-fav-remove="__PATH__" aria-label="Убрать из избранного">' +
        '<svg viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="m10 3 2.2 5 5.3.5-4 3.6 1.2 5.3L10 14.4 5.3 17.4l1.2-5.3-4-3.6 5.3-.5Z"/></svg>' +
      '</button>';

    var html = '';
    items.forEach(function(it) {
      // Re-emit the file identity so the shared #docsShell open handler
      // (matches `.docs-item[data-file-path]`) can open the favorite.
      var fileAttrs = it.filePath
        ? ' role="button" tabindex="0"' +
          ' data-file-path="' + escapeAttr(it.filePath) + '"' +
          ' data-file-name="' + escapeAttr(it.fileName || '') + '"' +
          ' data-mime-type="' + escapeAttr(it.mimeType || '') + '"' +
          ' data-doc-scope="' + escapeAttr(encodeURIComponent(JSON.stringify(it.scope || { level: 'network' }))) + '"'
        : '';
      var safePath = escapeAttr(it.path);
      var star = removeStar.replace('__PATH__', function() { return safePath; });

      // Preferred path: replay the captured section markup verbatim so the row
      // looks identical (file icon + title + subtitle + footer). The download
      // state is NOT taken from the snapshot — it was often stale (captured
      // before the async download check resolved) — but recomputed live below.
      if (it.iconHTML && it.bodyHTML) {
        html += '<div class="docs-item is-favorite has-fav-toggle"' + fileAttrs +
            ' data-doc-path="' + escapeAttr(it.path) + '">' +
          it.iconHTML +
          it.bodyHTML +
          star +
        '</div>';
        return;
      }

      // Fallback for entries saved before markup snapshots existed.
      html += '<div class="docs-item is-favorite has-fav-toggle"' + fileAttrs + ' data-doc-path="' + escapeAttr(it.path) + '">' +
        '<div class="docs-item-body">' +
          '<div class="docs-item-title">' + escapeHtml(it.name) + '</div>' +
          (it.meta ? '<div class="docs-item-footer">' + escapeHtml(it.meta) + '</div>' : '') +
        '</div>' +
        star +
      '</div>';
    });
    favoritesList.innerHTML = html;
    refreshFavoritesDownloadState();
  }

  // Download state is dynamic (resolved asynchronously by docs-app.js), so the
  // snapshot baked into a favorite can be stale. Recompute it live per row and
  // sync the row class + corner badge to match the section list.
  function refreshFavoritesDownloadState() {
    if (!favoritesList) return;
    if (typeof checkDocDownloaded !== 'function') return;
    var rows = favoritesList.querySelectorAll('.docs-item[data-file-path]');
    Array.prototype.forEach.call(rows, function(row) {
      var enc = row.getAttribute('data-file-path') || '';
      var docPath = '';
      try { docPath = decodeURIComponent(enc); } catch (e) { docPath = enc; }
      if (!docPath) return;
      // Drop any stale badge immediately so the wrong state never lingers.
      var iconWrap = row.querySelector('.docs-item-icon');
      var stale = iconWrap && iconWrap.querySelector('.docs-download-icon');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      row.classList.remove('is-downloaded', 'is-online-only');
      Promise.resolve(checkDocDownloaded(docPath)).then(function(isDownloaded) {
        row.classList.toggle('is-downloaded', !!isDownloaded);
        row.classList.toggle('is-online-only', !isDownloaded);
        row.setAttribute('data-doc-downloaded', isDownloaded ? '1' : '0');
        if (iconWrap && typeof buildDocDownloadStatusIcon === 'function') {
          var existing = iconWrap.querySelector('.docs-download-icon');
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
          iconWrap.insertAdjacentHTML('beforeend', buildDocDownloadStatusIcon(!!isDownloaded));
        }
      }).catch(function() {});
    });
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function escapeAttr(s){ return escapeHtml(s); }

  favoritesList && favoritesList.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('[data-fav-remove]');
    if (!btn) return;
    // The favorite row now carries data-file-path, so without this the click
    // would bubble to the #docsShell open handler and open the doc we just
    // removed.
    e.preventDefault();
    e.stopPropagation();
    var path = btn.getAttribute('data-fav-remove');
    var items = load().filter(function(it){ return it.path !== path; });
    save(items);
    updateCount();
    renderFavoritesList();
    // Also unstar in the live panels
    document.querySelectorAll('.docs-item.is-favorite').forEach(function(row) {
      var desc = buildItemDescriptor(row);
      if (desc.path === path) {
        row.classList.remove('is-favorite');
        var t = row.querySelector('.docs-fav-toggle');
        if (t) t.classList.remove('is-on');
      }
    });
  });

  // Click "Избранное" tile → show favorites panel
  favoritesTile.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    entryCard.classList.add('hidden');
    if (subnavCard) subnavCard.classList.add('hidden');
    allPanels.forEach(function(p) { p.classList.add('hidden'); });
    favoritesPanel.classList.remove('hidden');
    renderFavoritesList();
  }, true);

  // Back button on the favorites panel
  var back = document.getElementById('docsFavoritesBack');
  if (back) back.addEventListener('click', function() {
    favoritesPanel.classList.add('hidden');
    entryCard.classList.remove('hidden');
  });

  // Initial counts/render
  updateCount();
  renderFavoritesList();
  // Exposed so docs-app.js can refresh the favorites badges the moment a doc
  // finishes downloading (markDocAsDownloaded), like the section list does.
  window.renderDocsFavorites = renderFavoritesList;
  window.addEventListener('profilecatalogchange', function() {
    updateCount();
    renderFavoritesList();
  });
})();

// Documents bento: live counts from manifest.json + Recent opened from localStorage.
(function bindDocsBentoCounts() {
  var tiles = document.querySelectorAll('.docs-entry-tile[data-docs-entry]');
  tiles.forEach(function(t) {
    var key = t.getAttribute('data-docs-entry');
    var c = t.querySelector('.docs-entry-count');
    if (c) c.setAttribute('data-count-for', key);
  });
  // Map manifest folders to bento keys
  var manifestMap = { instructions: 'instructions', speeds: 'speeds', memos: 'memos', reminders: 'reminders', folders: 'folders' };
  function setCount(key, n) {
    var el = document.querySelector('.docs-entry-tile[data-docs-entry="' + key + '"] .docs-entry-count');
    if (!el) return;
    el.textContent = (n > 0 ? String(n) : '0');
  }
  function loadManifestCounts() {
    try {
      fetch('/assets/docs/manifest.json', { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(manifest) {
        if (!manifest) return;
        Object.keys(manifestMap).forEach(function(k) {
          var arr = manifest[manifestMap[k]];
          if (!Array.isArray(arr)) arr = [];
          if (typeof window.filterDocsForProfile === 'function') arr = window.filterDocsForProfile(arr);
          setCount(k, arr.length);
        });
      })
      .catch(function() { /* offline — leave dashes */ });
    } catch (e) {}
  }
  loadManifestCounts();

  // Recent docs from localStorage (key written by docs-app.js if available)
  function recentEscapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  // Recompute the corner download badge live (the snapshot can be stale), the
  // same way the section/favorites lists do.
  function refreshRecentDownloadState(rowsEl) {
    if (!rowsEl || typeof checkDocDownloaded !== 'function') return;
    var rows = rowsEl.querySelectorAll('.docs-item[data-file-path]');
    Array.prototype.forEach.call(rows, function(row) {
      var enc = row.getAttribute('data-file-path') || '';
      var docPath = '';
      try { docPath = decodeURIComponent(enc); } catch (e) { docPath = enc; }
      if (!docPath) return;
      var iconWrap = row.querySelector('.docs-item-icon');
      var stale = iconWrap && iconWrap.querySelector('.docs-download-icon');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      row.classList.remove('is-downloaded', 'is-online-only');
      Promise.resolve(checkDocDownloaded(docPath)).then(function(isDownloaded) {
        row.classList.toggle('is-downloaded', !!isDownloaded);
        row.classList.toggle('is-online-only', !isDownloaded);
        row.setAttribute('data-doc-downloaded', isDownloaded ? '1' : '0');
        if (iconWrap && typeof buildDocDownloadStatusIcon === 'function') {
          var existing = iconWrap.querySelector('.docs-download-icon');
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
          iconWrap.insertAdjacentHTML('beforeend', buildDocDownloadStatusIcon(!!isDownloaded));
        }
      }).catch(function() {});
    });
  }

  function renderRecentDocs() {
    var rowsEl = document.getElementById('docsRecentRows');
    var emptyEl = document.getElementById('docsRecentEmpty');
    if (!rowsEl) return;
    var items = [];
    try {
      var raw = window.localStorage && window.localStorage.getItem('shift_tracker_docs_recent_v2');
      if (raw) items = JSON.parse(raw) || [];
    } catch (e) { items = []; }
    if (Array.isArray(items) && typeof window.isDocScopeVisible === 'function') {
      items = items.filter(function(item) { return window.isDocScopeVisible(item && item.scope); });
    }
    if (!Array.isArray(items) || !items.length) {
      rowsEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    var html = '';
    items.slice(0, 4).forEach(function(d) {
      var name = (d && d.name) ? String(d.name) : 'Документ';
      var meta = (d && d.meta) ? String(d.meta) : '';
      // Re-emit the file identity so the shared #docsShell handler opens it.
      var fileAttrs = (d && d.filePath)
        ? ' role="button" tabindex="0"' +
          ' data-file-path="' + recentEscapeHtml(d.filePath) + '"' +
          ' data-file-name="' + recentEscapeHtml(d.fileName || '') + '"' +
          ' data-mime-type="' + recentEscapeHtml(d.mimeType || '') + '"' +
          ' data-doc-scope="' + recentEscapeHtml(encodeURIComponent(JSON.stringify(d.scope || { level: 'network' }))) + '"'
        : '';

      // Preferred: replay the captured section markup verbatim (identical card).
      if (d && d.iconHTML && d.bodyHTML) {
        html += '<div class="docs-item"' + fileAttrs + '>' + d.iconHTML + d.bodyHTML + '</div>';
        return;
      }

      // Fallback for entries saved before snapshots existed — still a real card.
      html += '<div class="docs-item"' + fileAttrs + '>' +
        '<div class="docs-item-body">' +
          '<div class="docs-item-title">' + recentEscapeHtml(name) + '</div>' +
          (meta ? '<div class="docs-item-footer">' + recentEscapeHtml(meta) + '</div>' : '') +
        '</div>' +
      '</div>';
    });
    rowsEl.innerHTML = html;
    refreshRecentDownloadState(rowsEl);
  }
  // Exposed so docs-app.js can refresh the list right after a doc is opened
  // (a synthetic 'storage' event carries no `.key` to filter on).
  window.renderRecentDocs = renderRecentDocs;
  renderRecentDocs();
  window.addEventListener('storage', function(e) {
    if (e && e.key === 'shift_tracker_docs_recent_v2') renderRecentDocs();
  });
  window.addEventListener('profilecatalogchange', function() {
    loadManifestCounts();
    renderRecentDocs();
  });
})();
