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
  function showSteps(steps) {
    instructions.replaceChildren();
    steps.forEach(function(text) { var li = document.createElement('li'); li.textContent = text; instructions.appendChild(li); });
    instructions.hidden = false;
  }
  function renderReady() {
    authenticated = true;
    retry.hidden = login.hidden = true;
    document.getElementById('loginHint').hidden = true;
    openApp.hidden = false;
    status.textContent = installed || standalone() ? 'Блокнот готов к работе' : 'Вход выполнен';
    detail.textContent = installed || standalone() ? 'Открывайте приложение с иконки на главном экране.' : 'Осталось добавить приложение на главный экран.';
    install.hidden = installed || standalone() || !promptEvent || ios;
    instructions.hidden = true;
    if (installed || standalone()) return;
    if (ios) {
      showSteps(['Откройте меню «Поделиться» в браузере.', 'Выберите «На экран “Домой”». Если пункт скрыт, прокрутите список действий.', 'Оставьте «Открывать как веб-приложение» включённым, если такой переключатель есть, и нажмите «Добавить».']);
    } else if (!promptEvent) {
      showSteps(['Откройте меню браузера.', 'Выберите «Установить приложение» или «Добавить на главный экран» и подтвердите.']);
      detail.textContent = 'Если Блокнот уже установлен, откройте его с иконки. Иначе добавьте через меню браузера.';
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
