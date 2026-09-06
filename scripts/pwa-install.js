(function() {
  'use strict';
  var code = new URLSearchParams(window.location.hash.slice(1)).get('code') || '';
  // The credential never enters HTTP access logs, referrers, cache keys or storage.
  window.history.replaceState(null, '', '/install');
  var promptEvent = null;
  var authenticated = false;
  var installed = false;
  var checking = false;
  var pendingKey = 'shift_tracker_pwa_login_request_v1';
  var pendingRequest = '';
  try { pendingRequest = localStorage.getItem(pendingKey) || ''; } catch (_) {}
  var status = document.getElementById('statusTitle');
  var detail = document.getElementById('detail');
  var install = document.getElementById('installButton');
  var retry = document.getElementById('retryButton');
  var login = document.getElementById('loginButton');
  var instructions = document.getElementById('instructions');
  var openApp = document.getElementById('openApp');
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function standalone() { return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; }
  var ua = navigator.userAgent;
  var guideSelect = document.getElementById('guideSelect');
  guideSelect.value = ios ? (/CriOS/.test(ua) ? 'ios-chrome' : /Version\/.*Safari/.test(ua) ? 'ios-safari' : 'ios-other') : /Android/.test(ua) ? (/SamsungBrowser/.test(ua) ? 'android-samsung' : /Chrome/.test(ua) ? 'android-chrome' : 'android-other') : 'desktop';
  var icons = {
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    bars: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    share: '<path d="M8 9H5v12h14V9h-3M12 15V2m-4 4 4-4 4 4"/>',
    home: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  function showSteps(steps) {
    instructions.replaceChildren();
    steps.forEach(function(step, index) {
      var li = document.createElement('li');
      var art = document.createElement('div');
      art.className = 'step-art';
      art.setAttribute('aria-hidden', 'true');
      // Icons and guide copy are local constants, never external HTML.
      art.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + icons[step[0]] + '</svg>';
      var copy = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = (index + 1) + '. ' + step[1];
      var hint = document.createElement('p');
      hint.textContent = step[2];
      copy.append(title, hint); li.append(art, copy); instructions.appendChild(li);
    });
    instructions.hidden = false;
  }
  function renderGuide() {
    var kind = guideSelect.value;
    var home = ['home', 'На экран «Домой»', 'Прокрутите список действий вниз. Если пункта нет, нажмите «Ещё» или «Изменить действия».'];
    var confirm = ['check', 'Нажмите «Добавить»', 'Если есть «Открывать как веб-приложение», оставьте включённым.'];
    if (kind === 'ios-safari') showSteps([
      ['more', 'Нажмите «…» в браузере', 'В компактной панели — справа внизу, рядом с адресом сайта. Если уже виден значок «Поделиться», переходите к нему.'],
      ['share', 'Выберите «Поделиться»', 'Квадрат со стрелкой вверх — как на значке слева.'], home, confirm
    ]);
    else if (kind === 'ios-chrome') showSteps([
      ['share', 'Нажмите «Поделиться»', 'Справа от адресной строки — квадрат со стрелкой вверх.'], home, confirm
    ]);
    else if (kind === 'ios-other') showSteps([
      ['more', 'Откройте меню браузера', 'Найдите «…», затем «Поделиться». Во встроенном браузере может потребоваться «Открыть в Safari».'],
      ['share', 'Откройте «Поделиться»', 'Ищите квадрат со стрелкой вверх.'], home, confirm
    ]);
    else if (kind === 'desktop') showSteps([
      ['menu', 'Откройте меню браузера', 'В Chrome или Edge найдите «Установить Блокнот» либо раздел приложений. В Safari на Mac: «Файл» → «Добавить в Dock».'],
      ['check', 'Подтвердите добавление', 'Если установки в меню нет, откройте эту страницу в Chrome или Edge.']
    ]);
    else showSteps([
      [kind === 'android-samsung' ? 'bars' : 'menu', 'Откройте меню браузера', kind === 'android-samsung' ? 'Три полоски в нижней панели Samsung Internet.' : kind === 'android-chrome' ? 'Три точки справа вверху в Chrome.' : 'Найдите три точки или три полоски рядом с адресной строкой.'],
      ['home', 'Добавьте на главный экран', kind === 'android-samsung' ? '«Добавить страницу в» → «Главный экран».' : 'Выберите «Установить приложение» или «Добавить на главный экран».'],
      ['check', 'Подтвердите установку', 'Нажмите «Установить» или «Добавить». Иконка появится среди приложений или на главном экране.']
    ]);
  }
  guideSelect.addEventListener('change', renderGuide);
  function renderReady() {
    authenticated = true;
    retry.hidden = login.hidden = true;
    document.getElementById('loginHint').hidden = true;
    openApp.hidden = false;
    status.textContent = installed || standalone() ? 'Блокнот готов к работе' : 'Вход выполнен';
    detail.textContent = installed || standalone() ? 'Открывайте приложение с иконки на главном экране.' : 'Осталось добавить приложение на главный экран.';
    install.hidden = installed || standalone() || !promptEvent || ios;
    instructions.hidden = true;
    document.getElementById('guideOptions').hidden = true;
    document.getElementById('guideNote').hidden = true;
    if (installed || standalone()) return;
    if (ios || !promptEvent) {
      document.getElementById('guideOptions').hidden = false;
      document.getElementById('guideNote').hidden = false;
      renderGuide();
    }
  }
  function request(url, options) {
    var controller = new AbortController();
    var timer = window.setTimeout(function() { controller.abort(); }, 8000);
    return fetch(url, Object.assign({ credentials: 'include', cache: 'no-store', signal: controller.signal }, options || {}))
      .then(function(response) { return response.json().then(function(body) { return { status: response.status, ok: response.ok, body: body }; }); })
      .finally(function() { window.clearTimeout(timer); });
  }
  function rememberSession(body) {
    // Replace legacy bearer tokens only after the server verified the cookie.
    try {
      if (body.sessionToken) localStorage.setItem('shift_tracker_session_token', body.sessionToken);
      else localStorage.removeItem('shift_tracker_session_token');
    } catch (_) {}
  }
  async function check() {
    if (checking) return;
    checking = true;
    retry.hidden = true;
    try {
      var exchangeError = '';
      if (code) {
        var exchange = await request('/api/auth/install-exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }) });
        if (exchange.ok || exchange.status === 410 || exchange.status === 400) code = '';
        if (!exchange.ok) exchangeError = exchange.body.error || 'Не удалось перенести вход';
      }
      // Read back the cookie; a successful exchange alone does not prove it was saved.
      var result = await request('/api/auth');
      if (result.status === 401 && pendingRequest) {
        result = await request('/api/auth/pwa-login-request?request=' + encodeURIComponent(pendingRequest));
        if (result.status === 404 || result.status === 410 || (result.ok && result.body.user)) {
          pendingRequest = '';
          try { localStorage.removeItem(pendingKey); } catch (_) {}
        }
        if (result.ok && result.body.user) result = await request('/api/auth');
      }
      if (result.ok && result.body.user) { rememberSession(result.body); renderReady(); return; }
      if (result.status >= 500 || result.status === 429) throw new Error('Связь временно недоступна');
      status.textContent = pendingRequest ? 'Подтвердите вход в Telegram' : 'Подключите свой Блокнот';
      detail.textContent = exchangeError || (pendingRequest ? 'После подтверждения вернитесь на этот экран — вход завершится автоматически.' : 'Подтвердите вход один раз, затем установите приложение.');
      login.hidden = false;
      document.getElementById('loginHint').hidden = false;
    } catch (_) {
      status.textContent = 'Не удалось проверить вход';
      detail.textContent = 'Проверьте интернет и нажмите «Повторить». Повторный вход пока не требуется.';
      retry.hidden = false;
    } finally { checking = false; }
  }
  window.addEventListener('beforeinstallprompt', function(event) { event.preventDefault(); promptEvent = event; if (authenticated) renderReady(); });
  window.addEventListener('appinstalled', function() { installed = true; promptEvent = null; if (authenticated) renderReady(); });
  install.addEventListener('click', async function() {
    if (!authenticated || !promptEvent) return;
    var event = promptEvent;
    promptEvent = null;
    install.disabled = true;
    try {
      await event.prompt();
      var choice = await event.userChoice;
      renderReady();
      if (choice && choice.outcome === 'accepted' && !installed) detail.textContent = 'Установка запускается. Дождитесь появления иконки на главном экране.';
    } catch (_) { renderReady(); }
    finally { install.disabled = false; }
  });
  retry.addEventListener('click', check);
  login.addEventListener('click', async function() {
    login.disabled = true;
    try {
      var result = await request('/api/auth/pwa-login-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ return: '/install' }) });
      if (!result.ok || !result.body.requestId || !result.body.botUrl) throw new Error('Login unavailable');
      pendingRequest = result.body.requestId;
      try { localStorage.setItem(pendingKey, pendingRequest); } catch (_) {}
      window.location.assign(result.body.botUrl);
    } catch (_) { status.textContent = 'Не удалось открыть Telegram'; detail.textContent = 'Проверьте связь и попробуйте ещё раз.'; }
    finally { login.disabled = false; }
  });
  window.addEventListener('focus', function() { if (!authenticated) check(); });
  window.addEventListener('online', function() { if (!authenticated) check(); });
  document.addEventListener('visibilitychange', function() { if (!document.hidden && !authenticated) check(); });
  // A visible browser tab can remain open while Telegram approves the request.
  window.setInterval(function() { if (pendingRequest && !document.hidden && !authenticated) check(); }, 3000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js?v=v418', { scope: '/', updateViaCache: 'none' }).catch(function() {});
  check();
})();
