// ── Init ──
if (typeof bootstrapAppStartup === 'function') {
  bootstrapAppStartup();
} else {
  bootstrapCachedShellFromStorage();
  window.requestAnimationFrame(function() {
    window.setTimeout(startBackgroundBootstrap, 320);
  });
}

// Quick-add bottom sheet removed — FAB now opens the form directly.
(function dropQuickAddSheet(){ var o = document.getElementById("overlayQuickAdd"); if (o && o.parentNode) o.parentNode.removeChild(o); })();

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

// Install-app banner — slides from top; dismissed for the rest of the session.
(function bindInstallBanner() {
  var banner = document.getElementById('installBanner');
  if (!banner) return;
  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function dismissed() {
    try { return sessionStorage.getItem('shift_tracker_install_dismissed_v1') === '1'; } catch (e) { return false; }
  }
  function markDismissed() {
    try { sessionStorage.setItem('shift_tracker_install_dismissed_v1', '1'); } catch (e) {}
  }
  function open() {
    banner.classList.add('is-open');
    banner.setAttribute('aria-hidden', 'false');
  }
  function close() {
    banner.classList.remove('is-open');
    banner.setAttribute('aria-hidden', 'true');
  }
  var legacy = document.getElementById('installPromptCard');
  if (legacy) legacy.classList.add('hidden');
  // Install invitation now lives in Профиль (a permanent, non-intrusive entry).
  // The auto-popup is intentionally disabled; the banner stays only as the
  // fallback target some code may still click.
  var later = document.getElementById('btnInstallPopupLater');
  if (later) later.addEventListener('click', function(e) {
    e.stopPropagation();
    markDismissed();
    close();
  });
  // Whole banner is clickable: opens the existing "Как установить" guide.
  banner.addEventListener('click', function(e) {
    if (e.target && e.target.closest && e.target.closest('#btnInstallPopupLater')) return;
    markDismissed();
    close();
    var openGuide = document.getElementById('btnShowInstallGuide');
    if (openGuide) openGuide.click();
  });
  banner.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      banner.click();
    }
  });
})();

// Community links — one place that connects the PWA, bot, news channel and discussion group.
(function bindCommunitySheet() {
  var btn = document.getElementById('btnProfileCommunity');
  var closeBtn = document.getElementById('btnCloseCommunity');
  var overlay = document.getElementById('overlayCommunity');
  var linksLoaded = false;
  var fallbackLinks = {
    appUrl: window.location && window.location.origin ? window.location.origin : 'https://bloknot-mashinista-bot.ru',
    siteUrl: 'https://bloknot-mashinista-bot.ru',
    botUrl: 'https://t.me/bloknot_mashinista_bot',
    newsChannelUrl: '',
    discussionChatUrl: ''
  };

  function setLink(kind, url) {
    var el = document.querySelector('[data-community-link="' + kind + '"]');
    if (!el) return;
    if (!url) {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('tabindex', '-1');
      return;
    }
    el.href = url;
    el.classList.remove('hidden');
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
  }

  function applyLinks(data) {
    var links = data || fallbackLinks;
    setLink('bot', links.botUrl || fallbackLinks.botUrl);
    setLink('news', links.newsChannelUrl || '');
    setLink('discussion', links.discussionChatUrl || '');
    setLink('site', links.siteUrl || links.appUrl || fallbackLinks.siteUrl);
  }

  function loadLinks() {
    if (linksLoaded) return Promise.resolve();
    linksLoaded = true;
    applyLinks(fallbackLinks);
    return fetch('/api/community', { cache: 'no-store', credentials: 'same-origin' })
      .then(function(res) {
        if (!res || !res.ok) throw new Error('community links unavailable');
        return res.json();
      })
      .then(function(data) {
        applyLinks(data);
      })
      .catch(function() {
        applyLinks(fallbackLinks);
      });
  }

  function close() {
    if (typeof closeOverlay === 'function') closeOverlay('overlayCommunity');
    else if (overlay) {
      overlay.classList.remove('is-open', 'visible');
      if (document.body) document.body.classList.remove('has-open-overlay');
    }
  }

  if (btn) {
    btn.addEventListener('click', function() {
      loadLinks();
      if (typeof openOverlay === 'function') openOverlay('overlayCommunity');
      else if (overlay) {
        overlay.classList.add('is-open', 'visible');
        if (document.body) document.body.classList.add('has-open-overlay');
      }
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close();
    });
  }

  document.addEventListener('click', function(e) {
    var link = e.target && e.target.closest ? e.target.closest('[data-community-link]') : null;
    if (!link || link.classList.contains('hidden')) return;
    var href = link.getAttribute('href') || '';
    if (!/^https:\/\/t\.me\//i.test(href)) return;
    try {
      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.openTelegramLink === 'function') {
        e.preventDefault();
        tg.openTelegramLink(href);
      }
    } catch (err) {}
  });
})();

// Notifications system — backed by localStorage, surfaced via the top-bar bell.
(function bindNotifications() {
  var STORAGE_KEY = 'shift_tracker_notifications_v1';
  var bell = document.getElementById('appTopBarBell');
  var dotEl = bell && bell.querySelector('.app-top-bar-icon-dot');
  var overlay = document.getElementById('overlayNotifications');
  var listEl = document.getElementById('notifList');
  var btnRead = document.getElementById('btnNotifMarkRead');
  var btnClose = document.getElementById('btnNotifClose');

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
  function updateBell(items) {
    if (!dotEl) return;
    var n = unreadCount(items || load());
    dotEl.style.display = n > 0 ? 'block' : 'none';
    dotEl.setAttribute('data-count', String(n));
  }
  var CHEVRON = '<div class="notif-row-chevron" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
    '</div>';
  function render() {
    var items = load();
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
    var changed = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id && !items[i].read) { items[i].read = true; changed = true; }
    }
    if (changed) { save(items); updateBell(items); }
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
    var items = load();
    var now = Date.now();
    if (opts.key) {
      // Idempotent announcement: never re-add, so its read state sticks.
      for (var k = 0; k < items.length; k++) {
        if (items[k].key === opts.key) {
          if (opts.replace) {
            items[k].title = title;
            items[k].text = text || '';
            items[k].tone = tone || 'info';
            items[k].ts = opts.ts || items[k].ts || now;
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
      title: title,
      text: text || '',
      tone: tone || 'info',
      ts: opts.ts || now,
      read: false
    });
    items = items.slice(0, 50);
    save(items);
    render();
  }
  function open() {
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body && document.body.classList.add('has-open-overlay');
  }
  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body && document.body.classList.remove('has-open-overlay');
  }
  if (bell) {
    bell.addEventListener('click', function(e) {
      e.preventDefault();
      open();
      // Re-render so freshly added items appear
      render();
    });
  }
  if (btnClose) btnClose.addEventListener('click', close);
  if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  if (listEl) {
    listEl.addEventListener('click', function(e) {
      var row = e.target.closest ? e.target.closest('.notif-row') : null;
      if (row) activateRow(row);
    });
    listEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        var row = e.target.closest ? e.target.closest('.notif-row') : null;
        if (row) { e.preventDefault(); activateRow(row); }
      }
    });
  }
  if (btnRead) {
    btnRead.addEventListener('click', function() {
      var items = load();
      for (var i = 0; i < items.length; i++) items[i].read = true;
      save(items);
      render();
    });
  }

  var SYSTEM_ANNOUNCEMENTS = [
    {
      key: 'nav_refresh_2026_06_v1',
      title: 'Большое обновление',
      tone: 'success',
      ts: releaseTime('2026-06-08T00:12:00+10:00'),
      text:
        'Обновили навигацию и карточку смены:\n' +
        '• Профиль — данные, расчёт, Бригада и установка приложения\n' +
        '• Смены — журнал и запуск «Поехали» прямо с карточки\n' +
        '• Документы — разделы открываются быстрее и понятнее\n' +
        '• Карточка смены — спокойный вид с доходом, расходом и локомотивом'
    },
    {
      key: 'feedback_links_2026_06_v1',
      title: 'Помощь и обратная связь',
      tone: 'info',
      ts: releaseTime('2026-06-08T00:13:00+10:00'),
      text:
        'В Профиле появился блок «Помощь и связь».\n' +
        'Оттуда можно открыть бота, канал новостей, обсуждение и быстро написать о проблеме или идее.'
    },
    {
      key: 'docs_bd_folders_2026_06_v1',
      title: 'Документы и Папки',
      tone: 'info',
      ts: releaseTime('2026-06-08T00:14:00+10:00'),
      text:
        'Раздел «Папки» теперь подписан как материалы по нарушениям БД.\n' +
        'Инструкции, скорости, режимки, памятки и избранное остаются в одной вкладке «Документы».'
    },
    {
      key: 'brigade_launch_2026_06_v1',
      title: 'Бригада',
      tone: 'success',
      ts: releaseTime('2026-06-08T00:15:00+10:00'),
      text:
        'Можно связаться по короткому коду и делиться сменами внутри приложения.\n' +
        'Один участник открывает Профиль → Бригада и нажимает «Создать код», второй вводит этот код у себя.'
    },
    {
      key: 'poekhali_launch_2026_06_v1',
      title: 'Поехали',
      tone: 'success',
      ts: releaseTime('2026-06-08T00:16:00+10:00'),
      text:
        'Если смена уже создана, из неё можно открыть рабочий экран «Поехали».\n' +
        'Откройте нужную смену, нажмите «Поехали» и следите за скоростью, профилем пути и ограничениями.'
    }
  ];

  function seedSystemAnnouncements() {
    SYSTEM_ANNOUNCEMENTS.forEach(function(item) {
      addNotification(item.title, item.text, item.tone, {
        key: item.key,
        ts: item.ts,
        replace: true
      });
    });
  }

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
    poekhali:     { title: 'Поехали',           sub: 'Режим реального времени' },
    add:          { title: 'Новая смена',       sub: 'Сначала только время' },
    instructions: { title: 'Документы',         sub: 'Локальная библиотека' },
    shifts:       { title: 'Смены',             sub: 'Журнал поездок' },
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
      // No subtitle for this tab (e.g. Поехали) — hide it rather than show a
      // placeholder dash.
      subEl.textContent = '';
      subEl.classList.add('hidden');
    }
    bar.setAttribute('data-tab', tab);
    bar.classList.remove('hidden');
    // Swap top-bar trailing icon: show GPS chip on Poekhali, bell elsewhere.
    var bellEl = document.getElementById('appTopBarBell');
    var gpsEl = document.getElementById('appTopBarGps');
    if (bellEl) bellEl.classList.toggle('hidden', tab === 'poekhali');
    if (gpsEl)  gpsEl.classList.toggle('hidden', tab !== 'poekhali');
    var wayEl = document.getElementById('appTopBarWay');
    if (wayEl) wayEl.classList.toggle('hidden', tab !== 'poekhali');
  }

  // Top-bar Путь chip → proxy click to legacy btnPoekhaliWay; mirror its label.
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
      if (!text) return;
      // Normalise "П:1" → "П 1"
      wayValueEl.textContent = text.replace(':', ' ');
    }
    syncWayLabel();
    window.setInterval(syncWayLabel, 1000);
  })();

  // Top-bar GPS chip → re-kick the always-on GPS watch (passive status, no recording).
  (function bindGpsChip() {
    var gpsChip = document.getElementById('appTopBarGps');
    if (!gpsChip) return;
    gpsChip.addEventListener('click', function() {
      var legacy = document.getElementById('btnPoekhaliLive');
      if (legacy) legacy.click();
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
          avatar: cur.avatar || ''
        };
        if (patch && 'firstName' in patch) next.firstName = normalizeProfileText(patch.firstName, 80);
        if (patch && 'lastName' in patch) next.lastName = normalizeProfileText(patch.lastName, 80);
        if (patch && 'role' in patch) next.role = normalizeProfileText(patch.role);
        if (patch && 'depot' in patch) next.depot = normalizeProfileText(patch.depot);
        if (patch && 'avatar' in patch) next.avatar = patch.avatar || '';
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch (e) {}
    }
    // Exposed so the Home top-bar subtitle can use the user's real depot.
    window.getProfileDepot = function() { return (loadExtras().depot || '').trim(); };

    // ── Cross-device profile sync ──────────────────────────────────────────
    // localStorage is per-context (the PWA and the Telegram webview keep
    // separate stores), so role/depot/avatar set in one never showed up in the
    // other. Mirror them to the server keyed by the authenticated user.
    var PROFILE_API_URL = (window.SHIFT_API_BASE_URL || '') + '/api/profile';
    var profileSyncInFlight = false;
    var profileSyncQueued = false;

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
          avatar: p.avatar || ''
        };
        var cur = loadExtras();
        // Server is the source of truth for cross-device fields. Only repaint
        // when something actually changed to avoid clobbering a local edit.
        if (serverProfile.firstName === (cur.firstName || '') &&
            serverProfile.lastName === (cur.lastName || '') &&
            serverProfile.role === (cur.role || '') &&
            serverProfile.depot === (cur.depot || '') &&
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

    var editBtn = document.getElementById('btnProfileEdit');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        var extras = loadExtras();
        var u = getUser();
        var firstNameInp = document.getElementById('inputProfileFirstName');
        var lastNameInp = document.getElementById('inputProfileLastName');
        var roleSel = document.getElementById('inputProfileRole');
        var depotInp = document.getElementById('inputProfileDepot');
        if (firstNameInp) firstNameInp.value = extras.firstName || normalizeProfileText(u.first_name, 80);
        if (lastNameInp) lastNameInp.value = extras.lastName || normalizeProfileText(u.last_name, 80);
        if (roleSel) roleSel.value = extras.role || '';
        if (depotInp) depotInp.value = extras.depot || '';
        if (window.GlassSelect && typeof GlassSelect.sync === 'function') {
          GlassSelect.sync(document.getElementById('profileRoleSelect'));
        }
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
        saveExtras({
          firstName: firstNameInp ? firstNameInp.value : '',
          lastName: lastNameInp ? lastNameInp.value : '',
          role: roleSel ? roleSel.value : '',
          depot: depotInp ? depotInp.value : ''
        });
        renderHeader();
        syncProfileToServer();
        if (typeof closeOverlay === 'function') closeOverlay('overlayProfileEdit');
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
    set('trkPlateTrain', s.train_number ? ('поезд №' + s.train_number) : 'нет активной смены');
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
    // GPS status chip (top bar) — passive connection indicator fed by poekhaliHud.
    var gpsChip = document.getElementById('appTopBarGps');
    if (gpsChip) {
      var tone = hud.gpsTone || 'is-gps-muted';
      gpsChip.classList.remove('is-gps-ok', 'is-gps-warn', 'is-gps-muted', 'is-gps-error', 'is-on');
      gpsChip.classList.add(tone);
      var gpsWord = gpsChip.querySelector('.app-top-bar-gps-word');
      if (gpsWord) gpsWord.textContent = hud.gpsMeta && hud.gpsMeta !== '—' ? ('GPS · ' + hud.gpsMeta) : 'GPS';
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
  // v2: store the real file attributes (path/name/mime) so favorites can be
  // opened. v1 entries captured a garbled name and no file path, so they are
  // intentionally dropped on upgrade.
  var STORAGE_KEY = 'shift_tracker_docs_favorites_v2';
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
    var c = load().length;
    var el = favoritesTile.querySelector('.docs-entry-count');
    if (el) el.textContent = String(c);
  }

  function buildItemDescriptor(rowEl) {
    // Real docs rows (rendered by docs-app.js) carry the file identity on data
    // attributes (URI-encoded) and show the title/footer in dedicated nodes.
    var filePath = rowEl.getAttribute('data-file-path') || '';
    var fileName = rowEl.getAttribute('data-file-name') || '';
    var mimeType = rowEl.getAttribute('data-mime-type') || '';

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
      iconHTML: iconHTML, bodyHTML: bodyHTML, stateClass: stateClass
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
    var items = load();
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
          ' data-mime-type="' + escapeAttr(it.mimeType || '') + '"'
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
  try {
    fetch('/assets/docs/manifest.json', { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(manifest) {
        if (!manifest) return;
        Object.keys(manifestMap).forEach(function(k) {
          var arr = manifest[manifestMap[k]];
          setCount(k, Array.isArray(arr) ? arr.length : 0);
        });
      })
      .catch(function() { /* offline — leave dashes */ });
  } catch (e) {}

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
      var raw = window.localStorage && window.localStorage.getItem('shift_tracker_docs_recent_v1');
      if (raw) items = JSON.parse(raw) || [];
    } catch (e) { items = []; }
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
          ' data-mime-type="' + recentEscapeHtml(d.mimeType || '') + '"'
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
    if (e && e.key === 'shift_tracker_docs_recent_v1') renderRecentDocs();
  });
})();
