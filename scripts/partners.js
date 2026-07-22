// Crew partner pairing.
// Phase 1: linking via code, address book, active pointer.
// Phase 2: deliver shift facts to the active partner's inbox; receive/accept/dismiss.
// Relies on globals from auth.js/app.js: fetchJson, setActiveTab, API_BASE_URL,
// allShifts, saveShifts, render, inferShiftWorkCodeByLocalTime.
(function partnersModule() {
  var API_BASE = (typeof API_BASE_URL === 'string') ? API_BASE_URL : (window.SHIFT_API_BASE_URL || '');
  var PARTNERS_API = API_BASE + '/api/partners';
  var SHIFTS_API = API_BASE + '/api/shifts';

  var state = {
    partners: [],
    activePairingId: '',
    inbox: [],
    loaded: false,
    busy: false,
  };

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function api(method, path, body) {
    if (typeof fetchJson !== 'function') {
      return Promise.reject(new Error('auth not ready'));
    }
    return fetchJson(PARTNERS_API + path, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  function shiftsApi(method, path, body) {
    if (typeof fetchJson !== 'function') {
      return Promise.reject(new Error('auth not ready'));
    }
    return fetchJson(SHIFTS_API + path, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  function showFeedback(message, kind) {
    var el = $('partnersFeedback');
    if (!el) return;
    if (!message) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.textContent = message;
    el.classList.remove('hidden', 'is-error', 'is-ok');
    el.classList.add(kind === 'error' ? 'is-error' : 'is-ok');
  }

  function activePartnerLabel() {
    if (!state.activePairingId) return '';
    for (var i = 0; i < state.partners.length; i++) {
      if (state.partners[i].pairingId === state.activePairingId) {
        return state.partners[i].partnerLabel || '';
      }
    }
    return '';
  }

  function renderHomeEntrySub() {
    var sub = $('homeCrewEntrySub');
    if (!sub) return;
    var label = activePartnerLabel();
    if (label) {
      sub.textContent = 'Бригада: ' + label;
    } else if (state.partners.length) {
      sub.textContent = 'Бригада: ' + state.partners.length + ' · получатель не выбран';
    } else {
      sub.textContent = 'Настройте бригаду, чтобы делиться сменами';
    }
  }

  function activePartnerTrusted() {
    for (var i = 0; i < state.partners.length; i++) {
      if (state.partners[i].pairingId === state.activePairingId) {
        return !!state.partners[i].iTrustPartner;
      }
    }
    return false;
  }

  function renderActiveCard() {
    var valueEl = $('partnersActiveValue');
    var hintEl = $('partnersActiveHint');
    var card = $('partnersActiveCard');
    var label = activePartnerLabel();
    if (valueEl) valueEl.textContent = label || 'Не выбран';
    if (hintEl) {
      if (!label) {
        hintEl.textContent = 'Подставляется в выбор получателя при добавлении смены.';
      } else if (activePartnerTrusted()) {
        hintEl.textContent = 'Смены этого участника бригады добавляются автоматически. Ваши — уходят ему.';
      } else {
        hintEl.textContent = 'Новые смены по умолчанию делятся с этим участником бригады.';
      }
    }
    if (card) card.classList.toggle('is-set', !!label);
  }

  function renderBook() {
    var list = $('partnersBookList');
    var empty = $('partnersBookEmpty');
    if (!list) return;
    if (!state.partners.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    var html = state.partners.map(function(p) {
      var isActive = p.pairingId === state.activePairingId;
      var activeBtn = isActive
        ? '<button class="partners-item-active is-on" type="button" data-action="deactivate" data-id="' + escapeHtml(p.pairingId) + '">По умолчанию ✓</button>'
        : '<button class="partners-item-active" type="button" data-action="activate" data-id="' + escapeHtml(p.pairingId) + '">Сделать по умолчанию</button>';
      return '' +
        '<div class="partners-item' + (isActive ? ' is-active' : '') + '">' +
          '<div class="partners-item-main">' +
            '<div class="partners-item-name">' + escapeHtml(p.partnerLabel) + '</div>' +
            (isActive ? '<div class="partners-item-tag">Сейчас в паре</div>' : '') +
          '</div>' +
          '<div class="partners-item-actions">' +
            activeBtn +
            '<button class="partners-item-remove" type="button" data-action="unpair" data-id="' + escapeHtml(p.pairingId) + '" aria-label="Удалить участника бригады">✕</button>' +
          '</div>' +
        '</div>';
    }).join('');
    list.innerHTML = html;
  }

  var MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  // "2026-05-12T08:00" → "12 мая, 08:00". Tolerant of partial/odd values.
  function formatStamp(value) {
    var m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return String(value || '');
    var day = parseInt(m[3], 10);
    var month = MONTHS_RU[parseInt(m[2], 10) - 1] || '';
    return day + ' ' + month + ', ' + m[4] + ':' + m[5];
  }

  function formatProposalSummary(facts) {
    facts = facts || {};
    var parts = [];
    if (facts.start_msk) {
      var range = formatStamp(facts.start_msk);
      if (facts.end_msk) {
        var endM = String(facts.end_msk).match(/T(\d{2}:\d{2})/);
        if (endM) range += ' – ' + endM[1];
      }
      parts.push(range);
    }
    var route = [facts.route_from, facts.route_to].filter(Boolean).join(' → ');
    if (route) parts.push(route);
    else if (facts.train_number) parts.push('Поезд ' + facts.train_number);
    return parts.join(' · ');
  }

  function notifyApp(title, text, tone, opts) {
    if (typeof window.appNotify !== 'function') return;
    try {
      window.appNotify(title, text, tone || 'info', opts || {});
    } catch (e) {}
  }

  function notifyManualInbox(items) {
    (items || []).forEach(function(item) {
      if (!item || !item.id) return;
      var who = item.sharedByName || 'Участник бригады';
      var summary = formatProposalSummary(item.facts);
      notifyApp(
        'Смена от бригады',
        who + ' поделился сменой.' +
          (summary ? '\n' + summary : '') +
          '\nОткройте Бригаду и нажмите «Принять», если всё верно.',
        'info',
        { key: 'brigade_inbox_' + item.id }
      );
    });
  }

  function notifyAutoInbox(events) {
    (events || []).forEach(function(event) {
      var item = event && event.item;
      if (!item || !item.id) return;
      var who = item.sharedByName || 'участника бригады';
      var summary = formatProposalSummary(item.facts);
      var inserted = event.action === 'inserted';
      notifyApp(
        inserted ? 'Смена от бригады добавлена' : 'Смена от бригады обновлена',
        'Данные от ' + who + (inserted ? ' добавлены в журнал.' : ' обновили смену в журнале.') +
          (summary ? '\n' + summary : ''),
        'success',
        { key: 'brigade_auto_' + item.id + '_' + event.action }
      );
    });
  }

  function updateInboxBadge() {
    var badge = $('homeCrewBadge');
    if (!badge) return;
    var n = state.inbox.length;
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }

  function renderInbox() {
    var wrap = $('partnersInbox');
    var list = $('partnersInboxList');
    if (!wrap || !list) return;
    if (!state.inbox.length) {
      wrap.hidden = true;
      list.innerHTML = '';
      updateInboxBadge();
      return;
    }
    wrap.hidden = false;
    list.innerHTML = state.inbox.map(function(item) {
      return '' +
        '<div class="partners-inbox-item" data-id="' + escapeHtml(item.id) + '">' +
          '<div class="partners-inbox-from">' + escapeHtml(item.sharedByName || 'Участник бригады') + ' поделился сменой</div>' +
          '<div class="partners-inbox-summary">' + escapeHtml(formatProposalSummary(item.facts)) + '</div>' +
          '<div class="partners-inbox-actions">' +
            '<button class="btn-primary partners-inbox-accept" type="button" data-action="accept" data-id="' + escapeHtml(item.id) + '">Принять</button>' +
            '<button class="partners-inbox-dismiss" type="button" data-action="dismiss" data-id="' + escapeHtml(item.id) + '">Скрыть</button>' +
          '</div>' +
        '</div>';
    }).join('');
    updateInboxBadge();
  }

  function renderAll() {
    renderActiveCard();
    renderBook();
    renderInbox();
    renderHomeEntrySub();
  }

  function loadPartners() {
    var p1 = api('GET', '').then(function(res) {
      if (res && res.ok && res.body) {
        state.partners = Array.isArray(res.body.partners) ? res.body.partners : [];
        state.activePairingId = res.body.activePairingId || '';
        state.loaded = true;
      }
      return res;
    }).catch(function() { /* offline: keep last state */ });
    var p2 = loadInbox();
    return Promise.all([p1, p2]).then(function() { renderAll(); });
  }

  function appReady() {
    return typeof allShifts !== 'undefined' && allShifts && typeof saveShifts === 'function';
  }

  // Stable key for a shared shift, used to avoid inserting the same one twice
  // (across reloads / racing inbox loads) even if a resolve call was lost.
  function sharedSourceKey(item) {
    return (item.sharedBy || '') + '/' + (item.sourceId || item.id || '');
  }

  function buildSharedShift(item) {
    var facts = item.facts || {};
    var newId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    var shift = Object.assign({}, facts, {
      id: newId,
      created_at: new Date().toISOString(),
      shared_source_id: sharedSourceKey(item),
      shared_by_name: item.sharedByName || '',
    });
    if (typeof inferShiftWorkCodeByLocalTime === 'function') {
      shift.code = shift.code || inferShiftWorkCodeByLocalTime(shift) || '';
    }
    return shift;
  }

  // Insert a shared shift, or update the existing copy in place when the sender
  // edited a shift we already have (matched by shared_source_id). The sender is
  // the source of truth for the shared facts; local-only fields are preserved.
  function upsertSharedShift(item) {
    var key = sharedSourceKey(item);
    var facts = item.facts || {};
    if (appReady()) {
      for (var i = 0; i < allShifts.length; i++) {
        var existing = allShifts[i];
        if (existing && existing.shared_source_id === key) {
          Object.keys(facts).forEach(function(k) { existing[k] = facts[k]; });
          if (typeof inferShiftWorkCodeByLocalTime === 'function') {
            existing.code = inferShiftWorkCodeByLocalTime(existing) || existing.code || '';
          }
          return { action: 'updated', shift: existing };
        }
      }
    }
    var shift = buildSharedShift(item);
    allShifts.push(shift);
    return { action: 'inserted', shift: shift };
  }

  function loadInbox() {
    return shiftsApi('GET', '/inbox').then(function(res) {
      if (res && res.ok && res.body && Array.isArray(res.body.items)) {
        processInbox(res.body.items);
      }
      return res;
    }).catch(function() { /* offline: keep last state */ });
  }

  // Trusted partners' shifts land automatically; everyone else waits for a tap.
  function processInbox(items) {
    var manual = [];
    var inserted = [];
    var updated = [];
    var autoEvents = [];
    var senders = {};
    (items || []).forEach(function(item) {
      if (item.autoAccept && appReady()) {
        var r = upsertSharedShift(item);
        if (r.action === 'inserted') inserted.push(r.shift);
        else updated.push(r.shift);
        autoEvents.push({ item: item, action: r.action });
        senders[item.sharedByName || 'бригады'] = true;
        shiftsApi('POST', '/inbox/resolve', { id: item.id, action: 'accept' }).catch(function() {});
      } else {
        manual.push(item);
      }
    });
    state.inbox = manual;
    notifyManualInbox(manual);
    if (inserted.length || updated.length) {
      if (typeof pendingMutationIds !== 'undefined') {
        pendingMutationIds = inserted.concat(updated).map(function(s) { return s.id; });
      }
      if (typeof render === 'function') render();
      saveShifts(function() {});
      var who = Object.keys(senders).join(', ') || 'бригады';
      if (inserted.length) {
        showShareToast(inserted.length === 1
          ? ('Смена от ' + who + ' добавлена')
          : ('Добавлено смен от ' + who + ': ' + inserted.length),
          inserted.map(function(s) { return s.id; }));
      } else {
        showShareToast('Смена от ' + who + ' обновлена', null);
      }
      notifyAutoInbox(autoEvents);
    }
    renderInbox();
  }

  function acceptProposal(id) {
    if (state.busy) return;
    var item = state.inbox.filter(function(x) { return x.id === id; })[0];
    if (!item) return;
    if (!appReady()) {
      showFeedback('Приложение ещё не готово, попробуйте секунду спустя.', 'error');
      return;
    }
    var r = upsertSharedShift(item);
    if (typeof pendingMutationIds !== 'undefined') pendingMutationIds = [r.shift.id];
    if (typeof render === 'function') render();
    saveShifts(function() {});
    // Drop locally + tell the server to remove the proposal (also earns trust).
    state.inbox = state.inbox.filter(function(x) { return x.id !== id; });
    renderInbox();
    shiftsApi('POST', '/inbox/resolve', { id: id, action: 'accept' }).then(function() {
      // Reflect newly-earned trust in the active-card hint.
      loadPartners();
    }).catch(function() {});
    showFeedback(r.action === 'updated'
      ? 'Смена обновлена по данным бригады.'
      : 'Смена добавлена. Дальше смены этой бригады будут появляться сами.', 'ok');
  }

  function dismissProposal(id) {
    if (state.busy) return;
    state.inbox = state.inbox.filter(function(x) { return x.id !== id; });
    renderInbox();
    shiftsApi('POST', '/inbox/resolve', { id: id, action: 'dismiss' }).catch(function() {});
  }

  // ── Undo toast for auto-inserted shifts ──
  var undoTimer = null;
  function removeUndoToast() {
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    var t = $('partnersUndoToast');
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }
  function undoSharedInsert(ids) {
    if (!appReady()) return;
    var set = {};
    ids.forEach(function(id) { set[id] = true; });
    for (var i = allShifts.length - 1; i >= 0; i--) {
      if (allShifts[i] && set[allShifts[i].id]) allShifts.splice(i, 1);
    }
    if (typeof render === 'function') render();
    saveShifts(function() {});
  }
  // Toast for auto-applied shifts. Pass undoIds to offer an "Отменить" action
  // (used for fresh inserts); omit it for in-place updates.
  function showShareToast(text, undoIds) {
    removeUndoToast();
    var toast = document.createElement('div');
    toast.className = 'partners-undo-toast';
    toast.id = 'partnersUndoToast';
    var msg = document.createElement('span');
    msg.className = 'partners-undo-text';
    msg.textContent = text;
    toast.appendChild(msg);
    if (undoIds && undoIds.length) {
      var btn = document.createElement('button');
      btn.className = 'partners-undo-btn';
      btn.type = 'button';
      btn.textContent = 'Отменить';
      btn.addEventListener('click', function() {
        undoSharedInsert(undoIds);
        removeUndoToast();
      });
      toast.appendChild(btn);
    }
    document.body.appendChild(toast);
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function() { toast.classList.add('is-visible'); });
    } else {
      toast.classList.add('is-visible');
    }
    undoTimer = window.setTimeout(removeUndoToast, 7000);
  }

  function setBusy(busy) {
    state.busy = busy;
    var box = document.querySelector('[data-tab="partners"]');
    if (box) box.classList.toggle('is-busy', busy);
  }

  function generateCode() {
    if (state.busy) return;
    setBusy(true);
    showFeedback('');
    api('POST', '/invite').then(function(res) {
      if (res && res.ok && res.body && res.body.code) {
        if (window.ProductAnalytics) window.ProductAnalytics.track('partner_invite_created', { result: 'success' });
        var box = $('partnersCodeBox');
        var val = $('partnersCodeValue');
        var exp = $('partnersCodeExpiry');
        if (val) val.textContent = res.body.code;
        if (exp) exp.textContent = 'Код действует 30 минут и одноразовый.';
        if (box) box.classList.remove('hidden');
      } else {
        showFeedback('Не удалось создать код. Попробуйте ещё раз.', 'error');
      }
    }).catch(function() {
      showFeedback('Нет связи с сервером.', 'error');
    }).then(function() { setBusy(false); });
  }

  function codeCells() {
    var grid = $('partnersCodeGrid');
    return grid ? Array.prototype.slice.call(grid.querySelectorAll('.partners-code-cell')) : [];
  }

  function collectCode() {
    return codeCells().map(function(c) { return (c.value || '').replace(/\D/g, ''); }).join('');
  }

  function clearCode() {
    codeCells().forEach(function(c) { c.value = ''; });
  }

  function redeemCode() {
    if (state.busy) return;
    var code = collectCode();
    if (code.length < 6) {
      showFeedback('Введите все 6 цифр кода.', 'error');
      var first = codeCells()[code.length] || codeCells()[0];
      if (first) first.focus();
      return;
    }
    setBusy(true);
    showFeedback('');
    api('POST', '/redeem', { code: code }).then(function(res) {
      if (res && res.ok && res.body && res.body.pairing) {
        if (window.ProductAnalytics) window.ProductAnalytics.track('partner_connected', { result: 'success' });
        clearCode();
        showFeedback('Готово! Бригада «' + (res.body.pairing.partnerLabel || '') + '» добавлена.', 'ok');
        return loadPartners();
      }
      var msg = (res && res.body && res.body.error) || 'Не удалось связать.';
      showFeedback(msg, 'error');
      clearCode();
      var cells = codeCells();
      if (cells[0]) cells[0].focus();
    }).catch(function() {
      showFeedback('Нет связи с сервером.', 'error');
    }).then(function() { setBusy(false); });
  }

  // OTP-style entry: one digit per cell, auto-advance, backspace + paste support.
  function bindCodeGrid() {
    var cells = codeCells();
    if (!cells.length) return;
    cells.forEach(function(cell, index) {
      cell.addEventListener('input', function() {
        var digits = (cell.value || '').replace(/\D/g, '');
        if (!digits) { cell.value = ''; return; }
        // If several digits landed in one cell (autofill), spread them forward.
        cell.value = digits.charAt(0);
        var rest = digits.slice(1);
        for (var i = 1; i <= rest.length && index + i < cells.length; i++) {
          cells[index + i].value = rest.charAt(i - 1);
        }
        var nextEmpty = index + 1 + rest.length;
        var target = cells[Math.min(nextEmpty, cells.length - 1)];
        if (target) target.focus();
        if (collectCode().length === 6) redeemCode();
      });
      cell.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !cell.value && index > 0) {
          e.preventDefault();
          cells[index - 1].value = '';
          cells[index - 1].focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
          cells[index - 1].focus();
        } else if (e.key === 'ArrowRight' && index < cells.length - 1) {
          cells[index + 1].focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          redeemCode();
        }
      });
      cell.addEventListener('focus', function() { cell.select(); });
      cell.addEventListener('paste', function(e) {
        e.preventDefault();
        var text = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!text) return;
        for (var i = 0; i < cells.length; i++) {
          cells[i].value = text.charAt(i) || '';
        }
        var lastIdx = Math.min(text.length, cells.length) - 1;
        if (cells[lastIdx]) cells[lastIdx].focus();
        if (text.length === 6) redeemCode();
      });
    });
  }

  function setActivePairing(pairingId) {
    if (state.busy) return;
    setBusy(true);
    api('POST', '/active', { pairingId: pairingId || null }).then(function(res) {
      if (res && res.ok && res.body) {
        state.activePairingId = res.body.activePairingId || '';
        renderAll();
      }
    }).catch(function() {
      showFeedback('Нет связи с сервером.', 'error');
    }).then(function() { setBusy(false); });
  }

  function unpair(pairingId) {
    if (state.busy || !pairingId) return;
    var ok = window.confirm('Удалить участника из бригады? Связь разорвётся у обоих.');
    if (!ok) return;
    setBusy(true);
    api('DELETE', '/' + encodeURIComponent(pairingId)).then(function(res) {
      if (res && res.ok) {
        return loadPartners();
      }
      showFeedback('Не удалось удалить.', 'error');
    }).catch(function() {
      showFeedback('Нет связи с сервером.', 'error');
    }).then(function() { setBusy(false); });
  }

  var partnersOriginTab = 'home';
  function openPartnersScreen(fromTab) {
    partnersOriginTab = fromTab || 'home';
    if (typeof setActiveTab === 'function') setActiveTab('partners');
    showFeedback('');
    loadPartners();
  }

  function bind() {
    var entry = $('homeCrewEntry');
    if (entry) {
      entry.addEventListener('click', function() { openPartnersScreen('home'); });
    }
    var profileEntry = $('btnProfileCrew');
    if (profileEntry) {
      profileEntry.addEventListener('click', function() { openPartnersScreen('profile'); });
    }
    var back = $('partnersBack');
    if (back) {
      back.addEventListener('click', function() {
        if (typeof setActiveTab === 'function') setActiveTab(partnersOriginTab);
      });
    }
    var genBtn = $('partnersGenerateBtn');
    if (genBtn) genBtn.addEventListener('click', generateCode);
    var redeemBtn = $('partnersRedeemBtn');
    if (redeemBtn) redeemBtn.addEventListener('click', redeemCode);
    bindCodeGrid();
    var book = $('partnersBookList');
    if (book) {
      book.addEventListener('click', function(e) {
        var btn = e.target.closest && e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');
        if (action === 'activate') setActivePairing(id);
        else if (action === 'deactivate') setActivePairing('');
        else if (action === 'unpair') unpair(id);
      });
    }
    var inboxList = $('partnersInboxList');
    if (inboxList) {
      inboxList.addEventListener('click', function(e) {
        var btn = e.target.closest && e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');
        if (action === 'accept') acceptProposal(id);
        else if (action === 'dismiss') dismissProposal(id);
      });
    }
    // Refresh partner state + inbox badge once auth/shifts are ready (silent),
    // and push out any shares that were queued while offline.
    if (navigator.onLine) {
      window.setTimeout(function() { loadPartners(); flushShareQueue(); }, 1500);
    }
  }

  // ── Public API for the sender side (shift form) ──
  function getActivePartner() {
    if (!state.activePairingId) return null;
    return { pairingId: state.activePairingId, label: activePartnerLabel() };
  }

  // All linked partners, for the per-shift recipient picker.
  function getPartners() {
    return state.partners.map(function(p) {
      return { pairingId: p.pairingId, label: p.partnerLabel || '' };
    });
  }

  // The default recipient (formerly "active partner") — pre-selected in the picker.
  function getDefaultPairingId() {
    return state.activePairingId || '';
  }

  // ── Offline-durable share queue ──
  // A shift added in a cab with no signal must still reach the partner once online.
  // Each entry captures the intended pairing, so a later switch of active partner
  // never misroutes a queued share. The shift itself rides the normal pending queue.
  var SHARE_QUEUE_KEY = 'shift_tracker_pending_shares_v1';
  var SHARED_OUT_KEY = 'shift_tracker_shared_out_v1';
  var flushing = false;

  // Remember which of my shifts I shared and to which pairing, so editing one
  // re-pushes the update to the same partner without re-asking.
  function readSharedOut() {
    try {
      var raw = window.localStorage.getItem(SHARED_OUT_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) { return {}; }
  }
  function markSharedOut(shiftId, pairingId) {
    if (!shiftId || !pairingId) return;
    try {
      var map = readSharedOut();
      map[shiftId] = pairingId;
      window.localStorage.setItem(SHARED_OUT_KEY, JSON.stringify(map));
    } catch (e) {}
  }
  function getSharedPairing(shiftId) {
    return readSharedOut()[shiftId] || '';
  }

  function readShareQueue() {
    try {
      var raw = window.localStorage.getItem(SHARE_QUEUE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function writeShareQueue(queue) {
    try { window.localStorage.setItem(SHARE_QUEUE_KEY, JSON.stringify(queue || [])); } catch (e) {}
  }
  function enqueueShare(shift, pairingId) {
    if (!shift || !pairingId) return;
    var sourceId = shift.id || '';
    var queue = readShareQueue().filter(function(e) { return e.sourceId !== sourceId; });
    queue.push({ sourceId: sourceId, pairingId: pairingId, shift: shift, ts: Date.now() });
    writeShareQueue(queue);
  }

  function flushShareQueue() {
    if (flushing || !navigator.onLine) return Promise.resolve();
    var queue = readShareQueue();
    if (!queue.length) return Promise.resolve();
    flushing = true;
    var i = 0;
    function step() {
      if (i >= queue.length) return Promise.resolve();
      var entry = queue[i];
      i += 1;
      return shiftsApi('POST', '/share', { shift: entry.shift, sourceId: entry.sourceId, pairingId: entry.pairingId })
        .then(function(res) {
          // Delivered (ok) or permanently undeliverable (409: pair gone) → drop it.
          if (res && (res.ok || res.status === 409)) {
            writeShareQueue(readShareQueue().filter(function(e) {
              return !(e.sourceId === entry.sourceId && e.pairingId === entry.pairingId);
            }));
          }
          return step();
        })
        .catch(function() { return step(); }); // network error → keep, try later
    }
    return step().then(function() { flushing = false; }, function() { flushing = false; });
  }

  // Deliver a saved shift's facts to a specific partner (queued + flushed).
  function shareShiftTo(shift, pairingId) {
    if (!shift || !pairingId) return Promise.resolve({ delivered: false });
    markSharedOut(shift.id, pairingId);
    enqueueShare(shift, pairingId);
    return flushShareQueue().then(function() {
      var stillQueued = readShareQueue().some(function(e) { return e.sourceId === (shift.id || ''); });
      if (window.ProductAnalytics) window.ProductAnalytics.track('shift_shared', { result: stillQueued ? 'queued' : 'delivered', offline: navigator.onLine === false });
      return { delivered: !stillQueued };
    });
  }

  // Stop sharing a shift: clear the local "shared out" mark + any queued send,
  // so the card no longer shows a recipient and edits won't re-push. (Local
  // un-mark; a true server-side recall is a separate, future concern.)
  function unshareShift(shiftId) {
    if (!shiftId) return;
    try {
      var map = readSharedOut();
      if (map[shiftId]) { delete map[shiftId]; window.localStorage.setItem(SHARED_OUT_KEY, JSON.stringify(map)); }
    } catch (e) {}
    try {
      writeShareQueue(readShareQueue().filter(function(e) { return e.sourceId !== shiftId; }));
    } catch (e) {}
  }

  // Share with the currently active partner (used when adding a new shift).
  function shareShift(shift) {
    var active = getActivePartner();
    if (!shift || !active) return Promise.resolve({ delivered: false });
    return shareShiftTo(shift, active.pairingId);
  }

  function ensureLoaded() {
    if (state.loaded) return Promise.resolve();
    return loadPartners();
  }

  window.BrigadePartners = {
    getActivePartner: getActivePartner,
    getPartners: getPartners,
    getDefaultPairingId: getDefaultPairingId,
    shareShift: shareShift,
    shareShiftTo: shareShiftTo,
    unshareShift: unshareShift,
    getSharedPairing: getSharedPairing,
    flushShareQueue: flushShareQueue,
    ensureLoaded: ensureLoaded,
    refresh: loadPartners,
    refreshInbox: loadInbox,
  };

  window.addEventListener('online', function() { flushShareQueue(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
