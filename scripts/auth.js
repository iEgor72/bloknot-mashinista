    var API_BASE_URL = window.SHIFT_API_BASE_URL || '';
    var AUTH_API_URL = API_BASE_URL + '/api/auth';
    var SHIFTS_API_URL = API_BASE_URL + '/api/shifts';
    var SCHEDULE_API_URL = API_BASE_URL + '/api/schedule';
    var USER_STATS_API_URL = API_BASE_URL + '/api/stats';
    var DOCS_API_URL = API_BASE_URL + '/api/docs';
    var TELEGRAM_BOT_USERNAME = 'bloknot_mashinista_bot';
    var CURRENT_USER = null;
    var AUTH_GATE = document.getElementById('authGate');
    var AUTH_CARD = document.getElementById('authCard');
    var AUTH_MODE_CHIP = document.getElementById('authModeChip');
    var AUTH_TITLE = document.getElementById('authTitle');
    var AUTH_MESSAGE = document.getElementById('authMessage');
    var AUTH_STATUS = document.getElementById('authStatus');
    var AUTH_BANNER = document.getElementById('authBanner');
    var AUTH_BANNER_ICON = document.getElementById('authBannerIcon');
    var AUTH_BANNER_TITLE = document.getElementById('authBannerTitle');
    var AUTH_BANNER_TEXT = document.getElementById('authBannerText');
    var AUTH_PRIMARY_ACTION = document.getElementById('authPrimaryAction');
    var AUTH_PRIMARY_HINT = document.getElementById('authPrimaryHint');
    var AUTH_ERROR = document.getElementById('authError');
    var AUTH_NOTE = document.getElementById('authNote');
    var AUTH_WIDGET = document.getElementById('telegramLoginWidget');
    var AUTH_WIDGET_SHELL = document.getElementById('authWidgetShell');
    var APP_SHELL = document.getElementById('appShell');
    var UI_OVERLAY_ROOT = document.getElementById('uiOverlayRoot');
    var SHIFT_ACTIONS_MENU = document.getElementById('shiftActionsMenu');
    var AUTH_WIDGET_READY = false;
    var AUTH_WIDGET_FALLBACK_TIMER = null;
    var authBootstrapPromise = null;
    var SESSION_STORAGE_KEY = 'shift_tracker_session_token';
    var AUTH_ENV_STATE = isLocalAuthEnvironment() ? 'dev' : 'prod';
    var AUTH_STATE = 'guest';
    var AUTH_VIEWS = {
      dev: {
        guest: {
          badge: 'DEV / LOCAL',
          title: 'Вход недоступен в локальной версии',
          message: 'Telegram не разрешает авторизацию с localhost. Открой приложение через бота или используй прод-домен.',
          primary: 'Открыть через Telegram',
          primaryHint: 'Telegram Login работает только на опубликованном домене.',
          status: '',
          note: 'Вход появится здесь только после публикации на прод-домене.',
          bannerTitle: 'Вход недоступен в локальной версии',
          bannerText: 'Telegram не разрешает авторизацию с localhost. Открой приложение через бота или используй прод-домен.',
          bannerIcon: 'i',
          showBanner: true,
          showWidget: false,
          showRetry: false,
          primaryBusy: false
        },
        authenticated: {
          showBanner: false,
          showWidget: false,
          showRetry: false,
          primaryBusy: false
        }
      },
      prod: {
        guest: {
          badge: 'Telegram login',
          title: 'Открой свои смены и рабочую историю',
          message: 'Блокнот Машиниста помогает записывать смены, смотреть часы по периоду, хранить заметки и держать под рукой документы. Вход через Telegram нужен, чтобы открыть твои данные и синхронизировать их между устройствами.',
          primary: 'Открыть бота',
          primaryHint: 'Если открыли сайт из поиска, проще сначала зайти через бота: https://t.me/bloknot_mashinista_bot',
          status: '',
          note: 'Впервые здесь? Сначала открой бота, потом при желании можно пользоваться и в браузере.',
          bannerTitle: 'Начать удобнее через Telegram',
          bannerText: 'Сначала бот открывает доступ к твоим данным, потом приложение можно открыть и в браузере.',
          bannerIcon: '↗',
          showBanner: true,
          showWidget: true,
          showPrimary: true,
          showRetry: false,
          primaryBusy: false
        },
        pending: {
          badge: 'Telegram login',
          title: 'Подтверждаем вход',
          message: 'Проверяем твою сессию и открываем доступ к сменам, часам и журналу.',
          primary: 'Открыть бота',
          primaryHint: 'Проверяем доступ и готовим вход.',
          status: 'Проверяем вход...',
          note: 'Обычно это занимает пару секунд. Если процесс затянулся, попробуйте ещё раз или откройте бота.',
          bannerTitle: 'Подтверждаем вход',
          bannerText: 'Смотрим, есть ли сохранённая сессия, и подготавливаем вход.',
          bannerIcon: '…',
          showBanner: true,
          showWidget: false,
          showRetry: false,
          primaryBusy: true
        },
        error: {
          badge: 'Telegram login',
          title: 'Не удалось выполнить вход',
          message: 'Попробуй ещё раз или открой приложение через Telegram. Обычно через бота вход проходит понятнее.',
          primary: 'Повторить',
          primaryHint: 'Если ошибка повторится, начни через бота: https://t.me/bloknot_mashinista_bot',
          status: '',
          note: 'Нажмите «Повторить». Если ошибка повторится, откройте бота: https://t.me/bloknot_mashinista_bot',
          bannerTitle: 'Не удалось выполнить вход',
          bannerText: 'Если вход снова не сработает, удобнее начать через Telegram-бота.',
          bannerIcon: '!',
          showBanner: true,
          showWidget: true,
          showRetry: false,
          primaryBusy: false
        },
        authenticated: {
          showBanner: false,
          showWidget: false,
          showRetry: false,
          primaryBusy: false
        }
      }
    };

    function getStoredSessionToken() {
      try {
        return localStorage.getItem(SESSION_STORAGE_KEY) || '';
      } catch(e) {
        return '';
      }
    }

    function setStoredSessionToken(token) {
      try {
        if (token) localStorage.setItem(SESSION_STORAGE_KEY, token);
        else localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch(e) {}
    }

    var CACHED_USER_STORAGE_KEY = 'shift_tracker_cached_user_v1';

    var CURRENT_SESSION_TOKEN = getStoredSessionToken();
    var STARTED_FROM_CACHED_STATE = false;

    function getStoredCachedUser() {
      try {
        var raw = localStorage.getItem(CACHED_USER_STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch(e) {
        return null;
      }
    }

    function hasKnownUserIdentity(user) {
      if (!user || user.id === undefined || user.id === null) return false;
      var id = String(user.id).trim();
      return !!id && id !== 'guest';
    }

    function setStoredCachedUser(user) {
      try {
        if (user && typeof user === 'object') {
          localStorage.setItem(CACHED_USER_STORAGE_KEY, JSON.stringify({
            id: user.id,
            display_name: user.display_name || '',
            username: user.username || '',
            is_admin: !!user.is_admin
          }));
        } else {
          localStorage.removeItem(CACHED_USER_STORAGE_KEY);
        }
      } catch(e) {}
    }

    function findStoredJsonByPrefix(prefix) {
      try {
        var matches = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (!key || key.indexOf(prefix) !== 0) continue;
          var value = readStoredJson(key, null);
          if (value) matches.push({ key: key, value: value });
        }
        return matches;
      } catch(e) {
        return [];
      }
    }

    function readAnyShiftsCache() {
      var matches = findStoredJsonByPrefix(SHIFTS_CACHE_STORAGE_KEY + '_');
      if (!matches.length) return null;
      matches.sort(function(a, b) {
        var aTime = a.value && a.value.updatedAt ? Date.parse(a.value.updatedAt) : 0;
        var bTime = b.value && b.value.updatedAt ? Date.parse(b.value.updatedAt) : 0;
        return bTime - aTime;
      });
      return matches[0] ? matches[0].value : null;
    }

    function readAnyOfflineMeta() {
      var matches = findStoredJsonByPrefix(SHIFTS_META_STORAGE_KEY + '_');
      if (!matches.length) return null;
      matches.sort(function(a, b) {
        var aTime = a.value && a.value.lastSyncAt ? Date.parse(a.value.lastSyncAt) : 0;
        var bTime = b.value && b.value.lastSyncAt ? Date.parse(b.value.lastSyncAt) : 0;
        return bTime - aTime;
      });
      return matches[0] ? matches[0].value : null;
    }

    function getAppUrl() {
      var pathname = window.location.pathname || '/';
      if (/\/index\.html$/i.test(pathname)) {
        pathname = pathname.replace(/index\.html$/i, '');
      }
      if (!pathname) pathname = '/';
      return window.location.origin + pathname;
    }

    function isLocalAuthEnvironment() {
      var hostname = String(window.location.hostname || '').toLowerCase();
      return window.location.protocol === 'file:' ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1';
    }

    function getTelegramBotUrl() {
      return 'https://t.me/' + TELEGRAM_BOT_USERNAME;
    }

    function getAuthView(envState, authState) {
      var envKey = envState === 'dev' ? 'dev' : 'prod';
      var authKey = AUTH_VIEWS[envKey] && AUTH_VIEWS[envKey][authState] ? authState : 'guest';
      return {
        env: envKey,
        state: authKey,
        copy: AUTH_VIEWS[envKey][authKey] || AUTH_VIEWS.prod.guest
      };
    }

    function applyAuthView(view) {
      var copy = view.copy || AUTH_VIEWS.prod.guest;

      if (AUTH_CARD) {
        AUTH_CARD.setAttribute('data-auth-mode', view.env === 'dev' ? 'local' : 'prod');
        AUTH_CARD.setAttribute('data-auth-state', view.state);
      }
      if (AUTH_MODE_CHIP) AUTH_MODE_CHIP.textContent = copy.badge || 'Telegram login';
      if (AUTH_TITLE) AUTH_TITLE.textContent = copy.title || '';
      if (AUTH_MESSAGE) AUTH_MESSAGE.textContent = copy.message || '';
      if (AUTH_STATUS) AUTH_STATUS.textContent = copy.status || '';
      if (AUTH_BANNER) {
        AUTH_BANNER.classList.toggle('hidden', !copy.showBanner);
        AUTH_BANNER.classList.toggle('is-local', view.env === 'dev');
        AUTH_BANNER.classList.toggle('is-error', view.state === 'error');
      }
      if (AUTH_BANNER_ICON) AUTH_BANNER_ICON.textContent = copy.bannerIcon || '';
      if (AUTH_BANNER_TITLE) AUTH_BANNER_TITLE.textContent = copy.bannerTitle || '';
      if (AUTH_BANNER_TEXT) AUTH_BANNER_TEXT.textContent = copy.bannerText || '';
      if (AUTH_PRIMARY_ACTION) {
        AUTH_PRIMARY_ACTION.textContent = copy.primary || 'Войти через Telegram';
        AUTH_PRIMARY_ACTION.disabled = !!copy.primaryBusy;
        AUTH_PRIMARY_ACTION.setAttribute('aria-busy', copy.primaryBusy ? 'true' : 'false');
        AUTH_PRIMARY_ACTION.setAttribute('aria-live', 'polite');
        AUTH_PRIMARY_ACTION.classList.toggle('hidden', copy.showPrimary === false);
      }
      if (AUTH_PRIMARY_HINT) AUTH_PRIMARY_HINT.textContent = copy.primaryHint || '';
      if (AUTH_ERROR) AUTH_ERROR.textContent = '';
      if (AUTH_NOTE) AUTH_NOTE.textContent = copy.note || '';
      if (AUTH_WIDGET_SHELL) AUTH_WIDGET_SHELL.classList.toggle('hidden', !copy.showWidget);
      if (document.getElementById('btnAuthRetry')) {
        document.getElementById('btnAuthRetry').classList.toggle('visible', !!copy.showRetry);
        document.getElementById('btnAuthRetry').textContent = 'Повторить';
      }
      AUTH_ENV_STATE = view.env;
      AUTH_STATE = view.state;
    }

    function showAuthGate(envState, authState) {
      try {
        document.documentElement.classList.remove('boot-has-cache');
      } catch (e) {}
      if (AUTH_GATE) AUTH_GATE.classList.remove('hidden');
      if (APP_SHELL) APP_SHELL.classList.add('hidden');
      var view = getAuthView(envState, authState);
      if (AUTH_GATE) {
        AUTH_GATE.setAttribute('data-auth-env', view.env);
        AUTH_GATE.setAttribute('data-auth-state', view.state);
      }
      applyAuthView(view);
    }

    function handleAuthUnauthorized() {
      var hasSession = !!CURRENT_USER || !!CURRENT_SESSION_TOKEN || !!getStoredSessionToken();
      var nextState = AUTH_ENV_STATE === 'dev' ? 'guest' : (hasSession ? 'error' : 'guest');
      showAuthGate(AUTH_ENV_STATE, nextState);
      if (nextState !== 'error') {
        renderTelegramLoginWidget();
      }
      return nextState;
    }

    function setAuthInlineError(message) {
      if (!AUTH_ERROR) return;
      AUTH_ERROR.textContent = message || '';
    }

    function clearAuthWidgetFallbackTimer() {
      if (!AUTH_WIDGET_FALLBACK_TIMER) return;
      clearTimeout(AUTH_WIDGET_FALLBACK_TIMER);
      AUTH_WIDGET_FALLBACK_TIMER = null;
    }

    function openTelegramBot() {
      try {
        window.location.href = getTelegramBotUrl();
      } catch (e) {}
    }

    function restartAuthFlow() {
      authBootstrapPromise = null;
      AUTH_WIDGET_READY = false;
      if (AUTH_WIDGET) AUTH_WIDGET.innerHTML = '';
      if (AUTH_ENV_STATE === 'dev') {
        showAppShell();
        loadShifts(function() { render(); });
        return;
      }

      showAuthGate('prod', 'pending');
      renderTelegramLoginWidget();
      ensureAuthenticated().then(function(user) {
        if (user) {
          loadShifts(function() {
            render();
          });
        }
      });
    }

    function showAppShell() {
      AUTH_STATE = 'authenticated';
      if (AUTH_GATE) AUTH_GATE.classList.add('hidden');
      if (APP_SHELL) APP_SHELL.classList.remove('hidden');
      settleSafeAreaInsets();
      repairUiText();
      if (typeof reloadScheduleStoreForCurrentUser === 'function') reloadScheduleStoreForCurrentUser(function() {
        if (typeof render === 'function') render();
      });
      updateSettingsControls();
      updateOfflineUiState();
      setActiveTab(activeTab || 'home');
      scheduleBottomNavHeightSync();
      updateFooter();
      renderInstallPromptCard();
      renderInstructionsScreen();
      if (navigator.onLine) {
        refreshUserStats('auth');
      } else {
        applyUserStatsOfflineFallback();
      }
    }

    function handleTabActivated(tab) {
      if (typeof renderDocsProGate === 'function') renderDocsProGate();
      if (tab === 'instructions') {
        renderDocumentationScreen();
      }
    }

    function getTabTransitionDirection(fromTab, toTab) {
      var order = {
        home: 0,
        shifts: 1,
        add: 2,
        salary: 3,
        instructions: 4
      };
      var fromIndex = order.hasOwnProperty(fromTab) ? order[fromTab] : -1;
      var toIndex = order.hasOwnProperty(toTab) ? order[toTab] : -1;
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return 1;
      return toIndex > fromIndex ? 1 : -1;
    }

    function setActiveTab(tab) {
      closeShiftActionsMenu(true);
      closeLocoSeriesMenu();
      var previousTab = activeTab || 'home';
      activeTab = tab || 'home';

      var panels = document.querySelectorAll('.tab-panel');
      var activePanel = null;
      for (var i = 0; i < panels.length; i++) {
        var panel = panels[i];
        panel.classList.remove('tab-enter-forward', 'tab-enter-backward', 'tab-enter-sheet-up');
        var isTargetPanel = panel.getAttribute('data-tab') === activeTab;
        panel.classList.toggle('active', isTargetPanel);
        if (isTargetPanel) activePanel = panel;
      }
      if (activePanel && hasRenderedInitialTab && previousTab !== activeTab && !prefersReducedMotion()) {
        var transitionClass = getTabTransitionDirection(previousTab, activeTab) > 0 ? 'tab-enter-forward' : 'tab-enter-backward';
        var sheetMotion = document.body && document.body.dataset ? document.body.dataset.shiftsMotion : '';
        if (activeTab === 'shifts' && sheetMotion === 'up') {
          transitionClass = 'tab-enter-sheet-up';
        }
        // Force reflow so repeated transitions on the same tab still animate.
        void activePanel.offsetWidth;
        activePanel.classList.add(transitionClass);
        var clearTransitionClass = function() {
          activePanel.classList.remove('tab-enter-forward', 'tab-enter-backward', 'tab-enter-sheet-up');
          activePanel.removeEventListener('animationend', clearTransitionClass);
        };
        activePanel.addEventListener('animationend', clearTransitionClass);
      }
      if (document.body && document.body.dataset) {
        delete document.body.dataset.shiftsMotion;
      }
      hasRenderedInitialTab = true;

      var navButtons = document.querySelectorAll('.tab-btn[data-tab]');
      for (var j = 0; j < navButtons.length; j++) {
        var btn = navButtons[j];
        var btnTab = btn.getAttribute('data-tab');
        var shouldBeActive = btnTab === activeTab;
        btn.classList.toggle('active', shouldBeActive);
      }

      if (activeTab !== 'shifts' && typeof clearJournalFocusHighlight === 'function') {
        clearJournalFocusHighlight();
      }

      scheduleBottomNavHeightSync();
      updateFooter();
      renderInstallPromptCard();
      handleTabActivated(activeTab);
      renderInstructionsScreen();
      if (activeTab === 'home') {
        revealShiftListOnFirstMount(document.getElementById('homeShiftsList'));
      } else if (activeTab === 'shifts') {
        revealShiftListOnFirstMount(document.getElementById('shiftsList'));
      }
    }

    function openAddTabAndFocusForm() {
      if (editingShiftId) {
        exitEditMode('add');
      } else {
        setFormMode('add');
      }
      setActiveTab('add');
      setTimeout(function() {
        var section = document.getElementById('shiftFormSection');
        if (section && section.scrollIntoView) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var startDate = document.getElementById('inputStartDate');
        if (startDate && startDate.focus) {
          startDate.focus();
        }
      }, 40);
    }

    var SHORT_MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    var QUARTER_LABELS = ['I квартал', 'II квартал', 'III квартал', 'IV квартал'];

    function getQuarterIndex(month0) {
      return Math.floor(month0 / 3);
    }

    function getQuarterLabel(month0) {
      return QUARTER_LABELS[getQuarterIndex(month0)] || '';
    }

    function getQuarterMonths(month0) {
      var q = getQuarterIndex(month0);
      var start = q * 3;
      return [start, start + 1, start + 2];
    }

    function renderQuarterMonthTabs(containerId, year, month0, onSelect) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var months = getQuarterMonths(month0);
      var html = '';
      for (var i = 0; i < months.length; i++) {
        var m = months[i];
        var active = m === month0 ? ' active' : '';
        html += '<button type="button" class="month-tab' + active + '" data-month="' + m + '">' + SHORT_MONTH_NAMES[m] + '</button>';
      }
      container.innerHTML = html;

      var buttons = container.querySelectorAll('.month-tab');
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].addEventListener('click', function(e) {
          var targetMonth = parseInt(e.currentTarget.getAttribute('data-month'), 10);
          if (typeof onSelect === 'function') onSelect(targetMonth);
        });
      }
    }

    function renderMonthHeader(titleId, quarterId, tabsId, year, month0, onSelect) {
      var monthTitle = document.getElementById(titleId);
      var monthQuarter = document.getElementById(quarterId);
      if (monthTitle) monthTitle.textContent = MONTH_NAMES[month0] + ' ' + year;
      if (monthQuarter) monthQuarter.textContent = getQuarterLabel(month0);
      renderQuarterMonthTabs(tabsId, year, month0, onSelect);
    }

    function repairUiText() {
      document.title = 'Блокнот машиниста';

      var monthPrev = document.getElementById('btnPrevMonth');
      if (monthPrev) {
        monthPrev.textContent = '‹';
        monthPrev.setAttribute('aria-label', 'Предыдущий месяц');
      }
      var monthNext = document.getElementById('btnNextMonth');
      if (monthNext) {
        monthNext.textContent = '›';
        monthNext.setAttribute('aria-label', 'Следующий месяц');
      }

      var topLabels = document.querySelectorAll('.stats-grid .stat-card .stat-label');
      var topLabelText = ['Праздничные', 'Ночные', 'Отработано', 'Смен', 'Норма', 'Осталось'];
      for (var i = 0; i < topLabels.length && i < topLabelText.length; i++) {
        topLabels[i].textContent = topLabelText[i];
      }

      var quickLabels = document.querySelectorAll('.quick-stats-grid .quick-stat .stat-label');
      var quickLabelText = ['Ночные', 'Смены', 'Праздничные'];
      var quickLabelByRole = {
        night: 'Ночные',
        shifts: 'Смены',
        holiday: 'Праздничные'
      };
      for (var q = 0; q < quickLabels.length && q < quickLabelText.length; q++) {
        var role = quickLabels[q].getAttribute('data-quick-label');
        quickLabels[q].textContent = quickLabelByRole[role] || quickLabelText[q];
      }

      var btnGoToShifts = document.getElementById('btnGoToShifts');
      if (btnGoToShifts) btnGoToShifts.textContent = 'Все смены';

      var shiftsHeader = document.getElementById('shiftsHeader');
      if (shiftsHeader) shiftsHeader.textContent = 'Журнал смен';

      var instructionsPageTitle = document.querySelector('.instructions-page-title');
      if (instructionsPageTitle) instructionsPageTitle.textContent = 'Инструкции';
      var appVersionValue = document.getElementById('appVersionValue');
      if (appVersionValue) appVersionValue.textContent = APP_VERSION;

      var addScreenBtn = document.getElementById('btnShowInstallGuide');
      if (addScreenBtn) addScreenBtn.textContent = 'Как установить';

      var overlays = document.querySelectorAll('.overlay');
      for (var oi = 0; oi < overlays.length; oi++) {
        var title = overlays[oi].querySelector('.sheet-title');
        if (!title) continue;
        if (overlays[oi].id === 'overlayAddScreen') title.textContent = 'Установить приложение';
        if (overlays[oi].id === 'overlaySalarySettings') title.textContent = 'Параметры расчёта';
        if (overlays[oi].id === 'overlayConfirm') title.textContent = 'Удалить запись';
      }
    }

    function getLoginReturnUrl() {
      return window.location.pathname + window.location.search + window.location.hash;
    }

    if (AUTH_PRIMARY_ACTION) {
      AUTH_PRIMARY_ACTION.addEventListener('click', function() {
        if (AUTH_STATE === 'error') {
          restartAuthFlow();
          return;
        }
        openTelegramBot();
      });
    }

    function renderTelegramLoginWidget() {
      if (!AUTH_WIDGET || AUTH_WIDGET_READY || AUTH_ENV_STATE === 'dev') return;
      AUTH_WIDGET_READY = true;
      clearAuthWidgetFallbackTimer();
      setAuthInlineError('');
      AUTH_WIDGET.innerHTML = '';

      if (navigator.onLine === false) {
        AUTH_WIDGET_READY = false;
        setAuthInlineError('Сейчас нет интернета. Как только связь появится, вход через Telegram снова станет доступен. Если приложение уже открывалось раньше, сохранённые данные подтянутся из кеша.');
        return;
      }

      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-auth-url', window.location.origin + '/api/auth?mode=telegram-login&return=' + encodeURIComponent(getLoginReturnUrl()));
      script.onload = function() {
        clearAuthWidgetFallbackTimer();
        AUTH_WIDGET_FALLBACK_TIMER = window.setTimeout(function() {
          AUTH_WIDGET_FALLBACK_TIMER = null;
          if (!AUTH_WIDGET || !AUTH_WIDGET.childElementCount) return;
          var widgetRoot = AUTH_WIDGET.firstElementChild;
          if (!widgetRoot || !(widgetRoot.offsetHeight > 0 || widgetRoot.querySelector('iframe, button, a'))) {
            AUTH_WIDGET_READY = false;
            setAuthInlineError('Виджет Telegram не успел загрузиться. Можно подождать ещё пару секунд или просто открыть бота кнопкой выше.');
          }
        }, 2600);
      };
      script.onerror = function() {
        clearAuthWidgetFallbackTimer();
        AUTH_WIDGET_READY = false;
        setAuthInlineError('Не удалось загрузить вход через Telegram. Попробуйте ещё раз или откройте бота напрямую.');
        showAuthGate('prod', 'error');
      };
      AUTH_WIDGET.appendChild(script);
    }

    function fetchJson(url, options, timeoutMs) {
      var reqOptions = options || {};
      reqOptions.credentials = 'include';
      reqOptions.headers = reqOptions.headers || {};
      if (CURRENT_SESSION_TOKEN) {
        reqOptions.headers['Authorization'] = 'Bearer ' + CURRENT_SESSION_TOKEN;
      }
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) reqOptions.signal = controller.signal;
      var timeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 8000;
      var timeoutId = controller ? setTimeout(function() { controller.abort(); }, timeout) : null;
      return fetch(url, reqOptions).then(function(res) {
        if (timeoutId) clearTimeout(timeoutId);
        return res.json().catch(function() { return {}; }).then(function(body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      }).catch(function(err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
      });
    }

    function getTelegramInitData() {
      try {
        if (window.Telegram && Telegram.WebApp && typeof Telegram.WebApp.initData === 'string') {
          return Telegram.WebApp.initData || '';
        }
      } catch (e) {}
      return '';
    }

    function waitForTelegramInitData(timeoutMs) {
      var budget = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 1400;
      var startedAt = Date.now();
      return new Promise(function(resolve) {
        var check = function() {
          var initData = getTelegramInitData();
          if (initData) {
            resolve(initData);
            return;
          }
          if (Date.now() - startedAt >= budget) {
            resolve('');
            return;
          }
          window.setTimeout(check, 120);
        };
        check();
      });
    }

    function authenticateWithTelegramWebApp(timeoutMs, options) {
      var opts = options || {};
      var waitBudgetMs = opts.waitBudgetMs;
      if (typeof waitBudgetMs !== 'number' || waitBudgetMs <= 0) {
        waitBudgetMs = Math.max(1200, Math.min(3000, (typeof timeoutMs === 'number' ? timeoutMs : 1200) + 600));
      }

      return waitForTelegramInitData(waitBudgetMs).then(function(initData) {
        if (!initData) return null;
        return fetchJson(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: initData })
        }, timeoutMs).then(function(result) {
          if (result.ok && result.body && result.body.user) {
            CURRENT_SESSION_TOKEN = result.body.sessionToken || '';
            setStoredSessionToken(CURRENT_SESSION_TOKEN);
            setStoredCachedUser(result.body.user);
            return result.body.user;
          }
          throw new Error((result.body && result.body.error) || 'Не удалось войти через Telegram');
        });
      });
    }

    function restoreSession(timeoutMs) {
      return fetchJson(AUTH_API_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, timeoutMs).then(function(result) {
        if (result.ok && result.body && result.body.user) {
          CURRENT_SESSION_TOKEN = result.body.sessionToken || CURRENT_SESSION_TOKEN || '';
          setStoredSessionToken(CURRENT_SESSION_TOKEN);
          setStoredCachedUser(result.body.user);
          return result.body.user;
        }
        return null;
      });
    }

    function logout() {
      return fetchJson(AUTH_API_URL, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      }).then(function() {
        CURRENT_USER = null;
        CURRENT_SESSION_TOKEN = '';
        setStoredSessionToken('');
        setStoredCachedUser(null);
        allShifts = [];
        authBootstrapPromise = null;
        AUTH_WIDGET_READY = false;
        if (AUTH_WIDGET) AUTH_WIDGET.innerHTML = '';
        updateFooter();
        showAuthGate(AUTH_ENV_STATE, 'guest');
        renderTelegramLoginWidget();
      });
    }

    function ensureAuthenticated(timeoutMs, options) {
      var silent = !!(options && options.silent);
      if (AUTH_ENV_STATE === 'dev') {
        if (!authBootstrapPromise) {
          authBootstrapPromise = Promise.resolve(null).then(function() {
            CURRENT_USER = { id: 0, first_name: 'Dev', username: 'devuser' };
            return CURRENT_USER;
          });
        }
        return authBootstrapPromise;
      }

      if (!authBootstrapPromise) {
        if (!silent) showAuthGate('prod', 'pending');
        authBootstrapPromise = authenticateWithTelegramWebApp(timeoutMs, {
          waitBudgetMs: silent ? 2600 : 1600
        })
          .then(function(user) {
            if (user) return user;
            return restoreSession(timeoutMs);
          })
          .then(function(user) {
            if (user) {
              CURRENT_USER = user;
              showAppShell();
              return user;
            }

            CURRENT_USER = null;
            if (!silent) {
              showAuthGate('prod', 'guest');
              renderTelegramLoginWidget();
            }
            return null;
          })
          .catch(function(err) {
            CURRENT_USER = null;
            if (!silent) {
              showAuthGate('prod', 'error');
              if (err && err.name === 'AbortError') {
                setAuthInlineError('Связь отвечает слишком медленно. Попробуйте ещё раз или откройте бота, если так надёжнее.');
              } else if (navigator.onLine === false) {
                setAuthInlineError('Сейчас нет интернета. Если приложение уже открывалось раньше, данные появятся после восстановления связи или из кеша.');
              }
              renderTelegramLoginWidget();
            }
            return null;
          });
      }

      return authBootstrapPromise;
    }

    function hasCachedBootstrapData() {
      var storedUser = getStoredCachedUser();
      var hasAnyCache =
        !!storedUser ||
        !!readShiftsCache() ||
        !!readAnyShiftsCache() ||
        !!readOfflineMeta() ||
        !!readAnyOfflineMeta() ||
        !!readPendingSnapshot();

      if (!hasAnyCache) return false;

      // Offline startup must remain instant even without a live session.
      if (!navigator.onLine) return true;

      // Online startup should skip shell bootstrap when there is no proven
      // authenticated context, otherwise users see app first and auth later.
      var hasStoredSession = !!getStoredSessionToken();
      var hasKnownIdentity = hasKnownUserIdentity(storedUser);
      return hasStoredSession && hasKnownIdentity;
    }

    function bootstrapCachedShellFromStorage() {
      var cachedUser = getStoredCachedUser();
      var cachedShifts = readShiftsCache() || readAnyShiftsCache();
      var cachedMeta = readOfflineMeta() || readAnyOfflineMeta();
      if (cachedUser && cachedUser.id !== undefined && cachedUser.id !== null) {
        CURRENT_USER = cachedUser;
      } else if (cachedShifts && cachedShifts.userId !== undefined && cachedShifts.userId !== null) {
        CURRENT_USER = { id: String(cachedShifts.userId) };
      } else if (cachedShifts || readPendingSnapshot() || cachedMeta) {
        CURRENT_USER = { id: 'guest' };
      } else {
        CURRENT_USER = { id: 'guest' };
      }

      STARTED_FROM_CACHED_STATE = true;
      if (cachedShifts && Array.isArray(cachedShifts.shifts)) {
        allShifts = normalizeShiftsForDisplay(cachedShifts.shifts);
      }
      updateOfflineUiState({
        isOffline: !navigator.onLine,
        isSyncing: false,
        hasPending: !!readPendingSnapshot(),
        lastSyncStatus: cachedShifts ? 'cached' : 'offline',
        lastError: ''
      });
      render();
      showAppShell();
      return true;
    }

    function bootstrapAppStartup() {
      if (hasCachedBootstrapData()) {
        bootstrapCachedShellFromStorage();
        window.requestAnimationFrame(function() {
          window.setTimeout(startBackgroundBootstrap, 320);
        });
        return;
      }
      restartAuthFlow();
    }

    function startBackgroundBootstrap() {
      if (!navigator.onLine) return;

      ensureAuthenticated(2200, { silent: true }).then(function(user) {
        if (user) {
          loadShifts(function() {
            render();
          });
          return;
        }

        var hasKnownIdentity = hasKnownUserIdentity(CURRENT_USER) || hasKnownUserIdentity(getStoredCachedUser());
        if (!hasKnownIdentity || (!readShiftsCache() && !readAnyShiftsCache())) {
          showAuthGate(AUTH_ENV_STATE, 'guest');
          renderTelegramLoginWidget();
        }
      });
    }

