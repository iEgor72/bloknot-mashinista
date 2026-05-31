(function() {
  'use strict';

  var state = {
    panel: 'overview',
    admin: null,
    overview: null,
    users: [],
    selectedSid: '',
    selectedUserData: null,
    userTab: 'shifts',
    docsManifest: null,
    docsCategory: '',
    adminConfig: null,
    poekhaliMap: null,
    poekhaliReference: null,
    poekhaliSpeedDocs: null,
    mapRouteId: 'haul-komsomolsk-volochaevka',
    selectedLearningMapId: '',
    selectedLearningSectionId: '',
    simpleMode: true,
    mapPopover: { kind: null, id: null },
    mapZoom: null,
    warningsPopover: { id: null },
    warningsZoom: null,
  };

  var panelTitles = {
    overview: ['Главная', 'Что происходит в приложении'],
    wizard: ['Мастер', 'Выбери задачу, дальше панель сама приведёт куда надо'],
    users: ['Люди', 'Карточки пользователей, смены, поездки и карта'],
    map: ['Карта Поехали', 'Скорости, станции и светофоры без кода'],
    documents: ['Файлы', 'Документы, которые видят пользователи'],
    functions: ['Конструктор', 'Настройки, идеи и будущие функции в понятных карточках'],
    raw: ['Аварийный режим', 'Скрытая техническая правка для разработчика'],
  };

  var docCategoryLabels = {
    speeds: 'Скорости',
    folders: 'Папки',
    instructions: 'Инструкции',
    memos: 'Режимки',
    reminders: 'Памятки',
  };

  var docCategoryPresets = [
    { key: 'speeds', title: 'Скорости', note: 'Приказы и таблицы скоростей' },
    { key: 'folders', title: 'Папки', note: 'Рабочие папки депо' },
    { key: 'instructions', title: 'Инструкции', note: 'Официальные инструкции' },
    { key: 'memos', title: 'Режимки', note: 'Режимные карты и схемы' },
    { key: 'reminders', title: 'Памятки', note: 'Короткие подсказки' },
  ];

  var salaryLabels = {
    tariffRate: 'Тариф',
    monthlyNormHours: 'Норма месяца',
    nightPercent: 'Ночные',
    classPercent: 'Классность',
    zonePercent: 'Зональная',
    bamPercent: 'БАМ',
    districtPercent: 'Районный',
    northPercent: 'Северная',
    localPercent: 'Местный',
    komPerTrip: 'Командировочные',
  };

  var salaryUnits = {
    tariffRate: '₽/час',
    monthlyNormHours: 'ч',
    nightPercent: '%',
    classPercent: '%',
    zonePercent: '%',
    bamPercent: '%',
    districtPercent: '%',
    northPercent: '%',
    localPercent: '%',
    komPerTrip: '₽',
  };

  var salaryPresetRows = [
    { title: 'Обычная смена', values: { nightPercent: 40, classPercent: 5, zonePercent: 0, bamPercent: 0 } },
    { title: 'БАМ', values: { nightPercent: 40, classPercent: 5, bamPercent: 30, districtPercent: 30, northPercent: 30 } },
    { title: 'Север', values: { nightPercent: 40, districtPercent: 30, northPercent: 50 } },
  ];

  var warningPresets = [
    { title: '25 км/ч', speed: 25, name: 'Ограничение 25' },
    { title: '40 км/ч', speed: 40, name: 'Ограничение 40' },
    { title: '60 км/ч', speed: 60, name: 'Ограничение 60' },
  ];

  var featurePresets = [
    { title: 'Кнопка в приложении', description: 'Что должна открыть кнопка, кто это увидит и когда включать.' },
    { title: 'Новый экран', description: 'Название экрана, какие поля на нем нужны и где он появится.' },
    { title: 'Проверка данных', description: 'Что приложение должно подсказать человеку перед сохранением.' },
  ];

  var calculationPresets = [
    { title: 'Надбавка', description: 'Название надбавки, процент или сумма, кому применять.' },
    { title: 'Норма часов', description: 'Как считать норму месяца и что делать с переработкой.' },
    { title: 'Командировка', description: 'Сумма за поездку, условия начисления и исключения.' },
  ];

  var cmsActionGroups = [
    {
      title: 'Добавить',
      actions: [
        { id: 'upload-doc', icon: '+', title: 'Загрузить файл', text: 'PDF, DOCX или картинку в документы', keywords: 'документ документы файл файлы загрузка загрузить pdf doc docx картинка картинку фото приказ инструкция', panel: 'documents' },
        { id: 'new-route', icon: '+', title: 'Создать маршрут', text: 'Новая линия для карты Поехали', keywords: 'карта карты карту маршрут маршруты линия линии перегон поехали схема участок путь', panel: 'map' },
        { id: 'new-user', icon: '+', title: 'Открыть человека', text: 'Ввести Telegram ID и править карточку', keywords: 'человек человека пользователь пользователи машинист сотрудник телеграм telegram id tg карточка права доступ', panel: 'users' },
      ],
    },
    {
      title: 'Изменить',
      actions: [
        { id: 'edit-map', icon: '↔', title: 'Поправить карту', text: 'Скорости, станции и светофоры', keywords: 'карта карты карту маршрут маршруты скорость скорости станция станции светофор светофоры линия поехали путь участок', panel: 'map' },
        { id: 'edit-warning', icon: '!', title: 'Ограничение скорости', text: 'Добавить 25, 40 или 60 км/ч человеку', keywords: 'ограничение ограничения скорость скорости предупреждение предупреждения человек человека 25 40 60 км час', panel: 'users' },
        { id: 'edit-salary', icon: '₽', title: 'Настроить зарплату', text: 'Ползунки, шаблоны БАМ и Север', keywords: 'зарплата зарплату деньги расчет расчёт начисления надбавка север бам ставка смена коэффициент', panel: 'users' },
      ],
    },
    {
      title: 'Запланировать',
      actions: [
        { id: 'new-feature', icon: '□', title: 'Идея функции', text: 'Карточка задачи без технических слов', keywords: 'идея задача функция функции предложение доработка улучшение todo план разработка', panel: 'functions' },
        { id: 'new-calc', icon: '%', title: 'Идея расчёта', text: 'Надбавка, норма или командировка', keywords: 'расчет расчёт калькулятор формула надбавка норма командировка зарплата деньги правило', panel: 'functions' },
        { id: 'docs-order', icon: '≡', title: 'Навести порядок', text: 'Разделы и подписи документов', keywords: 'документы документ файлы файл порядок раздел разделы сортировка подпись подписи список', panel: 'documents' },
      ],
    },
  ];

  var baseMapSpeedRules = [
    { id: 'bam-18-3799896-3801977-1', routeId: 'bam-silinka-halgaso', sector: 18, start: 3799896, end: 3801977, speed: 70, wayNumber: 1, name: 'Силинка, путь 1' },
    { id: 'bam-18-3795000-3799896-0', routeId: 'bam-silinka-halgaso', sector: 18, start: 3795000, end: 3799896, speed: 70, wayNumber: 0, name: 'Силинка - ПП 3796' },
    { id: 'bam-18-3788300-3789700-1', routeId: 'bam-silinka-halgaso', sector: 18, start: 3788300, end: 3789700, speed: 60, wayNumber: 1, name: 'ПП 3796, путь 1' },
    { id: 'bam-18-3789800-3793800-1', routeId: 'bam-silinka-halgaso', sector: 18, start: 3789800, end: 3793800, speed: 60, wayNumber: 1, name: 'ПП 3796, путь 1' },
    { id: 'bam-18-3793900-3795100-1', routeId: 'bam-silinka-halgaso', sector: 18, start: 3793900, end: 3795100, speed: 70, wayNumber: 1, name: 'ПП 3796, путь 1' },
    { id: 'bam-18-3787846-3795100-2', routeId: 'bam-silinka-halgaso', sector: 18, start: 3787846, end: 3795100, speed: 70, wayNumber: 2, name: 'ПП 3796, путь 2' },
    { id: 'bam-18-3789976-3792106-1', routeId: 'bam-silinka-halgaso', sector: 18, start: 3789976, end: 3792106, speed: 40, wayNumber: 1, name: 'Хальгасо, путь 1' },
    { id: 'bam-18-3787846-3789976-2', routeId: 'bam-silinka-halgaso', sector: 18, start: 3787846, end: 3789976, speed: 70, wayNumber: 2, name: 'Хальгасо, путь 2' },
    { id: 'bam-18-3775256-3789976-0', routeId: 'bam-halgaso-lian-holoni', sector: 18, start: 3775256, end: 3789976, speed: 70, wayNumber: 0, name: 'Хальгасо - Лиан' },
    { id: 'bam-18-3763395-3775256-0', routeId: 'bam-halgaso-lian-holoni', sector: 18, start: 3763395, end: 3775256, speed: 70, wayNumber: 0, name: 'Лиан - Холони' },
    { id: 'bam-18-3763395-3766487-1', routeId: 'bam-holoni', sector: 18, start: 3763395, end: 3766487, speed: 80, wayNumber: 1, name: 'Холони, путь 1' },
    { id: 'bam-18-3760303-3763395-2', routeId: 'bam-holoni', sector: 18, start: 3760303, end: 3763395, speed: 60, wayNumber: 2, name: 'Холони, путь 2' },
    { id: 'bam-18-3751329-3763395-0', routeId: 'bam-holoni', sector: 18, start: 3751329, end: 3763395, speed: 80, wayNumber: 0, name: 'Холони - Хурмули' },
  ];

  var poekhaliRouteSources = [
    { match: 'волочаевка', sourceCode: 'VLCH', sector: 9 },
    { match: 'сельгон', sourceCode: 'VLCH', sector: 9 },
    { match: 'высокогорная', sourceCode: 'VSG', sector: 12 },
    { match: 'вскг', sourceCode: 'VSG', sector: 12 },
    { match: 'постышево', sourceCode: 'BAM', sector: 18, start: 3613632, end: 3801977 },
  ];

  var els = {};

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setStatus(message, type) {
    els.statusLine.textContent = message || '';
    els.statusLine.classList.toggle('is-error', type === 'error');
    els.statusLine.classList.toggle('is-ok', type === 'ok');
  }

  function formatDate(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (!isFinite(date.getTime())) return value;
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatBytes(bytes) {
    var value = Number(bytes) || 0;
    if (value < 1024) return value + ' Б';
    if (value < 1024 * 1024) return Math.round(value / 1024) + ' КБ';
    return (value / 1024 / 1024).toFixed(1) + ' МБ';
  }

  function formatDuration(ms) {
    var totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    if (hours && minutes) return hours + ' ч ' + minutes + ' мин';
    if (hours) return hours + ' ч';
    return minutes + ' мин';
  }

  function formatDistance(meters) {
    var value = Math.max(0, Math.round(Number(meters) || 0));
    if (value >= 1000) return (value / 1000).toFixed(value >= 10000 ? 0 : 1) + ' км';
    return value + ' м';
  }

  function formatCoordinate(value) {
    var coordinate = Math.max(0, Math.round(Number(value) || 0));
    var km = Math.floor(coordinate / 1000);
    var meter = coordinate % 1000;
    var pk = Math.floor(meter / 100) + 1;
    return km + ' км ' + pk + ' пк +' + String(meter % 100).padStart(2, '0') + ' м';
  }

  function toDateTimeInputValue(value) {
    if (!value) return '';
    var date = new Date(value);
    if (!isFinite(date.getTime())) return String(value).slice(0, 16);
    var offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function createAdminId(prefix) {
    return String(prefix || 'item') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function normalizePlainKey(value, fallback) {
    var key = String(value || '').trim().toLowerCase()
      .replace(/[а-яё]/g, function(ch) {
        var map = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'c', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya' };
        return map[ch] || '';
      })
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return key || fallback || createAdminId('item');
  }

  function getRuleStart(rule) {
    return Math.min(Number(rule && (rule.start || rule.coordinate)) || 0, Number(rule && rule.end) || 0);
  }

  function getRuleEnd(rule) {
    return Math.max(Number(rule && (rule.start || rule.coordinate)) || 0, Number(rule && rule.end) || 0);
  }

  function normalizeMapConfig(config) {
    var source = config && typeof config === 'object' ? config : {};
    return {
      version: 1,
      routes: Array.isArray(source.routes) ? source.routes : [],
      speedRules: Array.isArray(source.speedRules) ? source.speedRules : [],
      objects: Array.isArray(source.objects) ? source.objects : [],
      updatedAt: source.updatedAt || '',
    };
  }

  function getPoekhaliRouteSource(routeName) {
    var name = String(routeName || '').toLowerCase().replace(/[ё]/g, 'е');
    for (var i = 0; i < poekhaliRouteSources.length; i += 1) {
      if (name.indexOf(poekhaliRouteSources[i].match) !== -1) return poekhaliRouteSources[i];
    }
    return null;
  }

  function getPoekhaliSpeedRulesBySource(sourceCode, sector) {
    var rules = state.poekhaliSpeedDocs && Array.isArray(state.poekhaliSpeedDocs.rules)
      ? state.poekhaliSpeedDocs.rules
      : [];
    return rules.filter(function(rule) {
      if (!rule || rule.sourceCode !== sourceCode) return false;
      var targets = Array.isArray(rule.targetSectors) ? rule.targetSectors : [];
      return !targets.length || targets.map(String).indexOf(String(sector)) !== -1;
    });
  }

  function buildPoekhaliRouteCatalog() {
    var reference = state.poekhaliReference || {};
    var hauls = Array.isArray(reference.hauls) ? reference.hauls : [];
    return hauls.map(function(haul) {
      var source = getPoekhaliRouteSource(haul && haul.name);
      if (!source) return null;
      var stations = Array.isArray(haul.stations) ? haul.stations : [];
      var stationMeters = stations.map(function(station) { return Number(station && station.meter); }).filter(isFinite);
      var sourceRules = getPoekhaliSpeedRulesBySource(source.sourceCode, source.sector);
      var ruleCoords = [];
      sourceRules.forEach(function(rule) {
        if (isFinite(Number(rule.coordinate))) ruleCoords.push(Number(rule.coordinate));
        if (isFinite(Number(rule.end))) ruleCoords.push(Number(rule.end));
      });
      var start = isFinite(source.start) ? source.start : Math.min.apply(Math, stationMeters.length ? stationMeters : [0]);
      var end = isFinite(source.end)
        ? source.end
        : Math.max.apply(Math, (stationMeters.length ? stationMeters : [0]).concat(ruleCoords));
      if (!isFinite(start)) start = 0;
      if (!isFinite(end) || end <= start) end = start + 1000;
      return {
        id: 'haul-' + normalizePlainKey(haul.name, createAdminId('haul')),
        title: haul.name,
        sector: source.sector,
        start: Math.min(start, end),
        end: Math.max(start, end),
        kind: 'reference',
        sourceCode: source.sourceCode,
        stations: stations,
      };
    }).filter(Boolean);
  }

  function getAllMapRoutes() {
    var map = normalizeMapConfig(state.poekhaliMap);
    var seen = {};
    var result = [];
    buildPoekhaliRouteCatalog().forEach(function(route) {
      if (!seen[route.id]) {
        seen[route.id] = true;
        result.push(route);
      }
    });
    (map.routes || []).forEach(function(route) {
      if (route && route.id && !seen[route.id]) {
        seen[route.id] = true;
        result.push(route);
      }
    });
    return result;
  }

  function getMapRoute(routeId) {
    var routes = getAllMapRoutes();
    return routes.find(function(route) { return route.id === routeId; }) || routes[0] || null;
  }

  function getCatalogSpeedRulesForRoute(route) {
    if (!route || !route.sourceCode) return [];
    var routeStart = Math.min(Number(route.start) || 0, Number(route.end) || 0);
    var routeEnd = Math.max(Number(route.start) || 0, Number(route.end) || 0);
    return getPoekhaliSpeedRulesBySource(route.sourceCode, route.sector).filter(function(rule) {
      var start = Number(rule.coordinate);
      var end = Number(rule.end);
      return isFinite(start) && isFinite(end) && end >= routeStart && start <= routeEnd;
    }).map(function(rule) {
      var start = Math.min(Number(rule.coordinate) || 0, Number(rule.end) || 0);
      var end = Math.max(Number(rule.coordinate) || 0, Number(rule.end) || 0);
      return {
        id: 'doc-' + String(rule.id || (route.sourceCode + '-' + start + '-' + end)).replace(/[^\w.-]+/g, '-'),
        routeId: route.id,
        sector: route.sector,
        coordinate: start,
        start: start,
        end: end,
        length: Math.max(0, end - start),
        speed: Number(rule.speed) || 60,
        wayNumber: Number(rule.wayNumber) || 0,
        name: (rule.sourceName || route.sourceCode) + ' · ' + formatCoordinate(start) + ' - ' + formatCoordinate(end),
        sourceName: rule.sourceName || route.sourceCode,
        appliesTo: rule.appliesTo || '',
        page: rule.page || 0,
      };
    });
  }

  function getMergedRouteSpeedRules(routeId) {
    var map = normalizeMapConfig(state.poekhaliMap);
    var route = getMapRoute(routeId);
    var overrides = {};
    map.speedRules.forEach(function(rule) {
      if (rule && rule.id) overrides[rule.id] = rule;
    });
    var baseRules = getCatalogSpeedRulesForRoute(route).concat(baseMapSpeedRules
      .filter(function(rule) { return !routeId || rule.routeId === routeId; })
    );
    return baseRules
      .map(function(rule) { return Object.assign({}, rule, overrides[rule.id] || {}, { baseId: rule.id }); })
      .concat(map.speedRules.filter(function(rule) {
        return rule && rule.routeId === routeId && !baseRules.some(function(base) { return base.id === rule.id; });
      }));
  }

  function getCoordinateBounds(items, keys) {
    var values = [];
    (items || []).forEach(function(item) {
      (keys || ['coordinate', 'start', 'end']).forEach(function(key) {
        var value = Number(item && item[key]);
        if (isFinite(value)) values.push(value);
      });
    });
    if (!values.length) return { min: 0, max: 1000 };
    var min = Math.max(0, Math.min.apply(Math, values));
    var max = Math.max.apply(Math, values);
    if (max <= min) max = min + 1000;
    var padding = Math.max(100, Math.round((max - min) * 0.08));
    return { min: Math.max(0, min - padding), max: max + padding };
  }

  function coordinatePercent(value, bounds) {
    var min = Number(bounds && bounds.min) || 0;
    var max = Number(bounds && bounds.max) || (min + 1);
    var current = Math.max(min, Math.min(max, Number(value) || 0));
    return Math.max(0, Math.min(100, ((current - min) / Math.max(1, max - min)) * 100));
  }

  function getJsonText(value) {
    return JSON.stringify(value || {}, null, 2);
  }

  function parseJsonTextarea(id) {
    var raw = $('#' + id).value;
    return raw.trim() ? JSON.parse(raw) : {};
  }

  var PLATFORM_LABELS = { ios: 'iPhone', android: 'Android', desktop: 'ПК', unknown: 'неизвестно' };

  function platformLabel(platform) {
    return PLATFORM_LABELS[platform] || PLATFORM_LABELS.unknown;
  }

  function describePlatformSummary(platforms) {
    var counts = platforms && typeof platforms === 'object' ? platforms : {};
    var ios = Number(counts.ios) || 0;
    var android = Number(counts.android) || 0;
    var desktop = Number(counts.desktop) || 0;
    var unknown = Number(counts.unknown) || 0;
    var known = ios + android + desktop;

    var breakdown = 'iPhone ' + ios + ' · Android ' + android + ' · ПК ' + desktop +
      (unknown ? ' · ещё не определено ' + unknown : '');

    var leader = '—';
    var leaderPercent = 8;
    if (known > 0) {
      if (ios >= android && ios >= desktop) { leader = 'iPhone'; leaderPercent = getPercent(ios, known); }
      else if (android >= ios && android >= desktop) { leader = 'Android'; leaderPercent = getPercent(android, known); }
      else { leader = 'ПК'; leaderPercent = getPercent(desktop, known); }
    } else if (unknown > 0) {
      breakdown = 'Платформа пока не собрана — данные появятся после захода пользователей';
    }

    return { leader: leader, leaderPercent: leaderPercent, breakdown: breakdown };
  }

  function getPercent(value, total) {
    var current = Math.max(0, Number(value) || 0);
    var max = Math.max(1, Number(total) || 0);
    return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  }

  function sumStorageBytes(storage) {
    return ['shifts', 'salaryParams', 'poekhaliLearning', 'poekhaliWarnings', 'poekhaliRuns'].reduce(function(sum, key) {
      return sum + Number(storage && storage[key] && storage[key].bytes || 0);
    }, 0);
  }

  function getStoredSessionToken() {
    try {
      return localStorage.getItem('shift_tracker_session_token') || '';
    } catch (_) {
      return '';
    }
  }

  function readSimpleModePreference() {
    try {
      var value = localStorage.getItem('bm_admin_simple_mode');
      return value === null ? true : value !== '0';
    } catch (_) {
      return true;
    }
  }

  function writeSimpleModePreference(value) {
    try {
      localStorage.setItem('bm_admin_simple_mode', value ? '1' : '0');
    } catch (_) {}
  }

  function updateSimpleModeUi() {
    document.body.classList.toggle('admin-simple-mode', !!state.simpleMode);
    if (els.simpleModeBtn) {
      els.simpleModeBtn.textContent = state.simpleMode ? 'Простой режим' : 'Подробный режим';
    }
  }

  function getAuthHeaders(extraHeaders) {
    var headers = extraHeaders && typeof extraHeaders === 'object' ? Object.assign({}, extraHeaders) : {};
    var token = getStoredSessionToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  function request(resource, options) {
    var params = new URLSearchParams();
    params.set('resource', resource);
    if (options && options.sid) params.set('sid', options.sid);
    return fetch('/api/admin?' + params.toString(), {
      method: options && options.method ? options.method : 'GET',
      headers: getAuthHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
      credentials: 'same-origin',
      body: options && options.body ? JSON.stringify(options.body) : undefined,
    }).then(function(response) {
      return response.text().then(function(text) {
        var body = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(body && body.error ? body.error : ('HTTP ' + response.status));
        }
        return body;
      });
    });
  }

  function isTechModeAllowed() {
    try {
      return new URLSearchParams(window.location.search || '').get('tech') === '1';
    } catch (_) {
      return false;
    }
  }

  function checkAdmin() {
    setStatus('Проверяю доступ...');
    return fetch('/api/admin/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: getAuthHeaders({ 'Accept': 'application/json' }),
    })
      .then(function(response) {
        return response.text().then(function(text) {
          var body = text ? JSON.parse(text) : {};
          if (!response.ok) throw new Error(body.error || 'Нет доступа');
          return body;
        });
      })
      .then(function(body) {
        state.admin = body.user || null;
        document.body.classList.remove('admin-locked');
        els.adminUser.textContent = state.admin
          ? ((state.admin.display_name || state.admin.username || ('ID ' + state.admin.id)) + ' · admin')
          : 'Администратор';
      });
  }

  function showAccessDenied(error) {
    var message = error && error.message ? error.message : 'Доступ закрыт';
    document.body.classList.remove('admin-locked');
    document.body.classList.add('admin-denied');
    els.adminUser.textContent = 'Нет доступа';
    setStatus('');
    els.overview.innerHTML =
      '<div class="access-denied-card">' +
        '<div class="access-denied-mark">БМ</div>' +
        '<div class="access-denied-kicker">Закрытый раздел</div>' +
        '<h2>Панель управления доступна только администратору</h2>' +
        '<p>Обычные пользователи могут пользоваться приложением, но не видят данные других людей, документы и настройки.</p>' +
        '<div class="access-denied-actions">' +
          '<a class="btn-primary" href="/">Вернуться в приложение</a>' +
          '<button class="btn" id="btnDeniedRefresh" type="button">Проверить ещё раз</button>' +
        '</div>' +
        '<div class="access-denied-note">' + escapeHtml(message === 'Admin access is not configured for this account' ? 'Если ты администратор, войди в приложение под своим Telegram-аккаунтом и обнови страницу.' : message) + '</div>' +
      '</div>';
    els.overview.classList.add('is-active');
    var btn = $('#btnDeniedRefresh');
    if (btn) btn.addEventListener('click', function() { window.location.reload(); });
  }

  function loadOverview() {
    return request('overview').then(function(data) {
      state.overview = data;
    });
  }

  function loadUsers() {
    return request('users').then(function(data) {
      state.users = data.users || [];
    });
  }

  function loadUser(sid) {
    state.selectedSid = sid;
    state.selectedLearningMapId = '';
    state.selectedLearningSectionId = '';
    return request('user', { sid: sid }).then(function(data) {
      state.selectedUserData = data;
    });
  }

  function loadDocs() {
    return request('docsManifest').then(function(data) {
      state.docsManifest = data.manifest || {};
      if (!state.docsCategory) {
        state.docsCategory = Object.keys(state.docsManifest)[0] || 'speeds';
      }
    });
  }

  function loadConfig() {
    return request('adminConfig').then(function(data) {
      var config = data.config || {};
      state.adminConfig = {
        version: 1,
        features: Array.isArray(config.features) ? config.features : [],
        calculationVariants: Array.isArray(config.calculationVariants) ? config.calculationVariants : [],
        notes: config.notes || '',
        updatedAt: config.updatedAt || '',
      };
    });
  }

  function fetchJsonAsset(path, fallback) {
    return fetch(path, { cache: 'no-store', credentials: 'same-origin' })
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .catch(function() {
        return fallback;
      });
  }

  function loadPoekhaliMap() {
    return Promise.all([
      request('poekhaliMap'),
      fetchJsonAsset('/assets/tracker/tch9-reference.json', null),
      fetchJsonAsset('/assets/tracker/speed-docs.json', null),
    ]).then(function(results) {
      var data = results[0] || {};
      state.poekhaliReference = results[1] || null;
      state.poekhaliSpeedDocs = results[2] || null;
      state.poekhaliMap = normalizeMapConfig(data.map);
      if (!getMapRoute(state.mapRouteId)) {
        var routes = getAllMapRoutes();
        state.mapRouteId = routes[0] ? routes[0].id : '';
      }
    });
  }

  function switchPanel(panel) {
    if (panel === 'raw' && !isTechModeAllowed()) panel = 'overview';
    if (!panelTitles[panel]) panel = 'overview';
    state.panel = panel;
    $all('.admin-nav-btn').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.dataset.panel === panel);
    });
    $all('.panel').forEach(function(section) {
      section.classList.toggle('is-active', section.dataset.panel === panel);
    });
    var title = panelTitles[panel] || panelTitles.overview;
    els.pageTitle.textContent = title[0];
    els.pageNote.textContent = title[1];
    render();
  }

  function renderOverview() {
    var data = state.overview;
    var panel = els.overview;
    if (!data) {
      panel.innerHTML = '<div class="empty">Данные ещё не загружены.</div>';
      return;
    }
    var storage = data.storage || {};
    var stats = data.stats || {};
    var onlinePercent = getPercent(stats.onlineUsers, stats.totalUsers);
    var platformSummary = describePlatformSummary(stats.platforms);
    var totalBytes = sumStorageBytes(storage);
    panel.innerHTML =
      '<div class="welcome-card">' +
        '<div>' +
          '<div class="welcome-kicker">Админка</div>' +
          '<div class="welcome-title">Что нужно сделать?</div>' +
          '<div class="welcome-text">Выбери действие. Лишние настройки спрятаны ниже.</div>' +
        '</div>' +
        '<div class="welcome-actions">' +
          '<button class="btn-primary" type="button" data-jump-panel="wizard">Все действия</button>' +
          '<button class="btn" type="button" data-cms-action="upload-doc">Загрузить файл</button>' +
          '<button class="btn" type="button" data-cms-action="edit-map">Править карту</button>' +
        '</div>' +
      '</div>' +
      renderCmsQuickStart() +
      '<details class="admin-quiet-details" open><summary>Состояние</summary><div class="grid grid-3">' +
        metricCard('Людей в приложении', stats.totalUsers, 'Все, кто хотя бы раз заходил или имеет смены', 'users') +
        metricCard('Сейчас онлайн', stats.onlineUsers, 'Зелёная полоска показывает долю онлайн', 'online', onlinePercent) +
        metricCard('Документов в базе', data.docs && data.docs.totalFiles, 'Файлы из раздела "Документы"', 'docs') +
        metricCard('iPhone или Android', platformSummary.leader, platformSummary.breakdown, 'users', platformSummary.leaderPercent) +
      '</div></details>' +
      '<details class="admin-quiet-details"><summary>Данные и доступ</summary><div class="grid grid-2">' +
        '<div class="card"><div class="card-title">Что уже заполнено</div>' +
          storageLine('Смены людей', storage.shifts, totalBytes) +
          storageLine('Настройки зарплаты', storage.salaryParams, totalBytes) +
          storageLine('Карты и светофоры', storage.poekhaliLearning, totalBytes) +
          storageLine('Ограничения скорости', storage.poekhaliWarnings, totalBytes) +
          storageLine('Поездки', storage.poekhaliRuns, totalBytes) +
        '</div>' +
        '<div class="card"><div class="card-title">Куда нажимать</div>' +
          guideItem('Люди', 'Карточки пользователей: смены, зарплата, поездки, ограничения и карта.', 'users') +
          guideItem('Файлы', 'Перетащи документ, дай ему название и подпись. Он появится в приложении.', 'documents') +
          guideItem('Конструктор', 'Карточки будущих функций и вариантов расчёта без программирования.', 'functions') +
          '<div class="health-strip"><span>Доступ администратора</span><strong>' + (data.app && data.app.adminIdsConfigured ? 'настроен' : 'не настроен') + '</strong></div>' +
          '<div class="health-strip"><span>Обновление админки</span><strong>без fresh-ссылок</strong></div>' +
        '</div>' +
      '</div></details>';
    $all('[data-jump-panel], [data-guide-panel]', panel).forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchPanel(btn.dataset.jumpPanel || btn.dataset.guidePanel);
      });
    });
    bindCmsActions(panel);
  }

  function renderCmsQuickStart() {
    return '<div class="cms-dashboard">' +
      '<div class="cms-dashboard-head"><div class="card-title">Быстрые действия</div></div>' +
      '<div class="cms-action-columns">' + cmsActionGroups.map(function(group) {
        return '<div class="cms-action-group"><div class="cms-action-title">' + escapeHtml(group.title) + '</div>' +
          group.actions.map(renderCmsActionCard).join('') +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function renderCmsActionCard(action) {
    return '<button class="cms-action-card" type="button" data-cms-action="' + escapeHtml(action.id) + '">' +
      '<span class="cms-action-icon">' + escapeHtml(action.icon || '+') + '</span>' +
      '<span><strong>' + escapeHtml(action.title) + '</strong><small>' + escapeHtml(action.text || '') + '</small></span>' +
    '</button>';
  }

  function bindCmsActions(root) {
    $all('[data-cms-action]', root || document).forEach(function(btn) {
      btn.addEventListener('click', function() {
        runCmsAction(btn.dataset.cmsAction);
      });
    });
  }

  function getFlatCmsActions() {
    var result = [];
    cmsActionGroups.forEach(function(group) {
      group.actions.forEach(function(action) {
        result.push(Object.assign({ groupTitle: group.title }, action));
      });
    });
    return result;
  }

  function getCommandTokens(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[ё]/g, 'е')
      .split(/[^a-zа-я0-9]+/i)
      .filter(Boolean);
  }

  function commandMatches(action, query) {
    var tokens = getCommandTokens(query);
    if (!tokens.length) return true;
    var haystack = getCommandTokens([
      action.title,
      action.text,
      action.groupTitle,
      action.keywords,
    ].join(' '));
    return tokens.every(function(token) {
      return haystack.some(function(word) {
        return word.indexOf(token) !== -1 || token.indexOf(word) !== -1;
      });
    });
  }

  function renderCommandMenu(query) {
    if (!els.commandMenu) return;
    var actions = getFlatCmsActions().filter(function(action) {
      return commandMatches(action, query);
    }).slice(0, 8);
    if (!actions.length) {
      els.commandMenu.innerHTML = '<div class="command-empty">Ничего не нашлось. Попробуй "файл", "карта", "человек" или "зарплата".</div>';
    } else {
      els.commandMenu.innerHTML = actions.map(function(action) {
        return '<button class="command-item" type="button" data-command-action="' + escapeHtml(action.id) + '">' +
          '<span class="cms-action-icon">' + escapeHtml(action.icon || '+') + '</span>' +
          '<span><strong>' + escapeHtml(action.title) + '</strong><small>' + escapeHtml(action.groupTitle + ' · ' + action.text) + '</small></span>' +
        '</button>';
      }).join('');
    }
    els.commandMenu.hidden = false;
    $all('[data-command-action]', els.commandMenu).forEach(function(btn) {
      btn.addEventListener('mousedown', function(event) {
        event.preventDefault();
      });
      btn.addEventListener('click', function() {
        els.commandInput.value = '';
        els.commandMenu.hidden = true;
        runCmsAction(btn.dataset.commandAction);
      });
    });
  }

  function bindCommandPalette() {
    if (!els.commandInput || !els.commandMenu) return;
    els.commandInput.addEventListener('focus', function() {
      renderCommandMenu(els.commandInput.value);
    });
    els.commandInput.addEventListener('input', function() {
      renderCommandMenu(els.commandInput.value);
    });
    els.commandInput.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        els.commandMenu.hidden = true;
        els.commandInput.blur();
      }
      if (event.key === 'Enter') {
        var first = $('[data-command-action]', els.commandMenu);
        if (first) {
          event.preventDefault();
          first.click();
        }
      }
    });
    document.addEventListener('click', function(event) {
      if (!event.target.closest('.admin-command')) els.commandMenu.hidden = true;
    });
  }

  function runCmsAction(actionId) {
    var action = findCmsAction(actionId);
    var panel = action && action.panel ? action.panel : 'wizard';
    switchPanel(panel);
    window.setTimeout(function() {
      applyCmsActionFocus(actionId);
    }, 0);
  }

  function findCmsAction(actionId) {
    var found = null;
    cmsActionGroups.forEach(function(group) {
      group.actions.forEach(function(action) {
        if (action.id === actionId) found = action;
      });
    });
    return found;
  }

  function applyCmsActionFocus(actionId) {
    var messages = {
      'upload-doc': 'Перетащи файл в большую область загрузки. Потом проверь название и нажми сохранить.',
      'new-route': 'Нажми "Новый" в блоке маршрутов, задай название и границы, потом сохрани карту.',
      'new-user': 'Впиши Telegram ID в поле справа и нажми "Открыть карточку".',
      'edit-map': 'Выбери маршрут слева, затем меняй скорости и точки на линии.',
      'edit-warning': 'Открой человека, вкладка "Ограничения", затем выбери готовую скорость 25/40/60.',
      'edit-salary': 'Открой человека, вкладка "Зарплата", затем выбери шаблон или двигай ползунки.',
      'new-feature': 'Нажми готовую карточку функции или "Добавить", заполни результат и сохрани идеи.',
      'new-calc': 'Нажми готовую карточку расчёта, опиши правило и сохрани идеи.',
      'docs-order': 'Выбери раздел, перетащи карточки документов в нужном порядке и сохрани.',
    };
    setStatus(messages[actionId] || 'Выбери действие и следуй подсказке на экране.', 'ok');
    var focusTarget = null;
    if (actionId === 'new-user') focusTarget = $('#newUserId');
    if (actionId === 'upload-doc') focusTarget = $('#docDropZone');
    if (actionId === 'new-route') focusTarget = $('#btnAddMapRoute');
    if (actionId === 'new-feature') focusTarget = $('#btnAddFeature');
    if (actionId === 'new-calc') focusTarget = $('#btnAddCalc');
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
  }

  function metricCard(label, value, note, tone, percent) {
    var safePercent = typeof percent === 'number' ? percent : Math.min(100, Math.max(8, Number(value) ? 70 : 8));
    return '<div class="card metric metric--' + escapeHtml(tone || 'default') + '">' +
      '<div class="metric-top"><div class="metric-label">' + escapeHtml(label) + '</div><div class="metric-dot"></div></div>' +
      '<div class="metric-value">' + escapeHtml(value === undefined ? '—' : value) + '</div>' +
      '<div class="meter"><span style="width:' + safePercent + '%"></span></div>' +
      '<div class="muted">' + escapeHtml(note || '') + '</div></div>';
  }

  function storageLine(label, row, totalBytes) {
    row = row || {};
    var percent = getPercent(row.bytes || 0, totalBytes || row.bytes || 1);
    return '<div class="storage-line">' +
      '<div class="storage-line-top"><span>' + escapeHtml(label) + '</span><strong>' +
      escapeHtml(row.files || 0) + ' файлов · ' + formatBytes(row.bytes || 0) + '</strong></div>' +
      '<div class="meter meter--thin"><span style="width:' + Math.max(3, percent) + '%"></span></div>' +
    '</div>';
  }

  function guideItem(title, text, panel) {
    return '<button class="guide-item" type="button" data-guide-panel="' + escapeHtml(panel) + '">' +
      '<span class="guide-title">' + escapeHtml(title) + '</span>' +
      '<span class="guide-text">' + escapeHtml(text) + '</span>' +
    '</button>';
  }

  function renderWizard() {
    var panel = els.wizard;
    panel.innerHTML =
      '<div class="wizard-hero">' +
        '<div>' +
          '<div class="welcome-kicker">Мастер действий</div>' +
          '<div class="welcome-title">Что нужно сделать сейчас?</div>' +
          '<div class="welcome-text">Выбери задачу обычными словами. Это самый простой вход в админку: без поиска нужной вкладки и без технических полей.</div>' +
        '</div>' +
      '</div>' +
      '<div class="wizard-layout">' +
        '<div class="wizard-main">' +
          cmsActionGroups.map(function(group) {
            return '<section class="wizard-section"><div class="wizard-section-head"><h2>' + escapeHtml(group.title) + '</h2><span>' + escapeHtml(group.actions.length) + ' действия</span></div>' +
              '<div class="wizard-action-grid">' + group.actions.map(renderWizardAction).join('') + '</div></section>';
          }).join('') +
        '</div>' +
        '<aside class="wizard-side">' +
          '<div class="card-title">Как тут работать</div>' +
          '<div class="wizard-rule"><b>1</b><span>Нажми большую карточку с нужным действием.</span></div>' +
          '<div class="wizard-rule"><b>2</b><span>Панель откроет нужный раздел и подсветит следующий шаг.</span></div>' +
          '<div class="wizard-rule"><b>3</b><span>Когда всё готово, нажми зелёную кнопку сохранения в этом разделе.</span></div>' +
          '<div class="danger-note wizard-note"><strong>Важно:</strong> если нет зелёной кнопки сохранения, значит этот экран только показывает данные.</div>' +
        '</aside>' +
      '</div>';
    bindCmsActions(panel);
  }

  function renderWizardAction(action) {
    return '<button class="wizard-action" type="button" data-cms-action="' + escapeHtml(action.id) + '">' +
      '<span class="cms-action-icon">' + escapeHtml(action.icon || '+') + '</span>' +
      '<span><strong>' + escapeHtml(action.title) + '</strong><small>' + escapeHtml(action.text || '') + '</small></span>' +
      '<em>Открыть</em>' +
    '</button>';
  }

  function moveArrayItem(items, from, to) {
    if (!Array.isArray(items)) return;
    var start = Number(from);
    var end = Number(to);
    if (!isFinite(start) || !isFinite(end) || start === end || start < 0 || end < 0 || start >= items.length || end >= items.length) return;
    var row = items.splice(start, 1)[0];
    items.splice(end, 0, row);
  }

  function bindReorderCards(root, selector, onMove) {
    var draggedIndex = null;
    $all(selector, root).forEach(function(card) {
      card.addEventListener('dragstart', function(event) {
        draggedIndex = Number(card.dataset.warningCard || card.dataset.docCard);
        card.classList.add('is-dragging');
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function() {
        card.classList.remove('is-dragging');
        draggedIndex = null;
      });
      card.addEventListener('dragover', function(event) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      card.addEventListener('drop', function(event) {
        event.preventDefault();
        var targetIndex = Number(card.dataset.warningCard || card.dataset.docCard);
        if (draggedIndex !== null && isFinite(targetIndex)) onMove(draggedIndex, targetIndex);
      });
    });
  }

  function renderUsers() {
    var panel = els.users;
    var selected = state.selectedUserData;
    panel.innerHTML =
      '<div class="friendly-note"><strong>Как пользоваться:</strong> выбери карточку человека. Справа откроются понятные вкладки: смены, зарплата, ограничения, поездки и карта. Пока не нажал "Сохранить", изменения не применятся.</div>' +
      '<div class="toolbar">' +
        '<div class="toolbar-left"><input class="input" id="userSearch" placeholder="Найти человека по ID" style="width:300px" /></div>' +
        '<div class="toolbar-right builder-inline"><input class="input" id="newUserId" inputmode="numeric" placeholder="Telegram ID" /><button class="btn-primary" id="btnCreateUser" type="button">Открыть карточку</button></div>' +
      '</div>' +
      '<div class="builder-steps builder-steps--compact">' +
        '<div><b>1</b><span>Найди или впиши ID</span></div>' +
        '<div><b>2</b><span>Выбери вкладку справа</span></div>' +
        '<div><b>3</b><span>Нажми сохранить</span></div>' +
      '</div>' +
      '<div class="people-layout">' +
        '<div class="card"><div class="card-title">Люди в приложении</div><div id="usersTableSlot"></div></div>' +
        '<div class="card user-editor-card"><div id="userEditorSlot">' + (selected ? '' : '<div class="empty">Выбери карточку человека слева. Здесь появится управление его сменами и поездками.</div>') + '</div></div>' +
      '</div>';
    renderUsersTable(state.users);
    if (selected) renderUserEditor();
    $('#userSearch').addEventListener('input', function(event) {
      var q = event.target.value.trim().toLowerCase();
      renderUsersTable(state.users.filter(function(user) {
        return String(user.id).toLowerCase().indexOf(q) !== -1;
      }));
    });
    $('#btnCreateUser').addEventListener('click', function() {
      var sid = $('#newUserId').value;
      if (!sid) return;
      loadUser(sid.trim()).then(function() {
        renderUsers();
      }).catch(showError);
    });
  }

  function renderUsersTable(users) {
    var slot = $('#usersTableSlot');
    if (!users.length) {
      slot.innerHTML = '<div class="empty">Людей пока нет.</div>';
      return;
    }
    slot.innerHTML =
      '<div class="people-card-list">' +
      users.map(function(user) {
        var learning = user.learning || {};
        var initials = String(user.id || '?').slice(-2).toUpperCase();
        var isSelected = String(state.selectedSid) === String(user.id);
        return '<button class="person-card ' + (isSelected ? 'is-active' : '') + '" type="button" data-sid="' + escapeHtml(user.id) + '">' +
          '<span class="person-avatar">' + escapeHtml(initials) + '</span>' +
          '<span class="person-main"><strong>Пользователь ' + escapeHtml(user.id) + '</strong>' +
            '<span class="person-sub">' + escapeHtml(user.online ? 'сейчас в приложении' : ('последний вход: ' + formatDate(user.lastSeenAt))) + '</span></span>' +
          '<span class="person-badges">' +
            '<span>' + escapeHtml(platformLabel(user.platform)) + '</span>' +
            '<span>' + escapeHtml(user.shifts || 0) + ' смен</span>' +
            '<span>' + escapeHtml(user.runs || 0) + ' поездок</span>' +
            '<span>' + escapeHtml(user.warnings || 0) + ' огр.</span>' +
            '<span>' + escapeHtml(learning.maps || 0) + ' карт</span>' +
          '</span>' +
        '</button>';
      }).join('') +
      '</div>';
    $all('[data-sid]', slot).forEach(function(card) {
      card.addEventListener('click', function() {
        setStatus('Открываю карточку человека...');
        loadUser(card.dataset.sid).then(function() {
          setStatus('Карточка открыта', 'ok');
          renderUsers();
        }).catch(showError);
      });
    });
  }

  function renderUserEditor() {
    var data = state.selectedUserData;
    var slot = $('#userEditorSlot');
    slot.innerHTML =
      '<div class="toolbar"><div><div class="card-title">Человек ' + escapeHtml(data.sid) + '</div>' +
      '<div class="muted">Измени нужные карточки и нажми сохранить. Без этой кнопки ничего не применится.</div></div>' +
      '<button class="btn-primary" id="btnSaveUser" type="button">Сохранить изменения</button></div>' +
      '<div class="tabs">' + ['shifts','salary','warnings','runs','learning'].map(function(tab) {
        var labels = { shifts:'Смены', salary:'Зарплата', warnings:'Ограничения', runs:'Поездки', learning:'Карта' };
        return '<button class="tab ' + (state.userTab === tab ? 'is-active' : '') + '" data-user-tab="' + tab + '" type="button">' + labels[tab] + '</button>';
      }).join('') + '</div>' +
      '<div id="userTabSlot"></div>';
    $all('[data-user-tab]', slot).forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.userTab = btn.dataset.userTab;
        renderUserEditor();
      });
    });
    $('#btnSaveUser').addEventListener('click', saveCurrentUser);
    renderUserTab();
  }

  function renderUserTab() {
    var slot = $('#userTabSlot');
    if (state.userTab === 'shifts') return renderShiftEditor(slot);
    if (state.userTab === 'salary') return renderSalaryEditor(slot);
    if (state.userTab === 'warnings') return renderWarningsEditor(slot);
    if (state.userTab === 'runs') return renderRunsCards(slot);
    renderLearningConstructor(slot);
  }

  function renderShiftEditor(slot) {
    var shifts = state.selectedUserData.shifts || [];
    slot.innerHTML = '<div class="constructor-head">' +
      '<div><div class="card-title">Смены визуальными карточками</div><div class="muted">Добавь смену, выбери быстрый шаблон и заполни только понятные поля.</div></div>' +
      '<button class="btn-primary" id="btnAddShift" type="button">Добавить смену</button></div>' +
      '<div class="quick-preset-row">' +
        '<button class="preset-btn" type="button" data-shift-preset="day">Дневная 8 ч</button>' +
        '<button class="preset-btn" type="button" data-shift-preset="night">Ночная 12 ч</button>' +
        '<button class="preset-btn" type="button" data-shift-preset="trip">Поездная</button>' +
      '</div><div class="mini-chart">' +
      '<div class="mini-chart-bar"><span style="width:' + Math.min(100, shifts.length * 4) + '%"></span></div>' +
      '<div class="muted">Визуально: чем длиннее полоска, тем больше записей у человека.</div></div><div class="editor-list" id="shiftList"></div>';
    $('#btnAddShift').addEventListener('click', function() {
      var now = new Date().toISOString();
      shifts.unshift({ id: createAdminId('shift'), start_msk: now, end_msk: now, created_at: now, route: '', notes: '' });
      renderShiftEditor(slot);
    });
    $all('[data-shift-preset]', slot).forEach(function(btn) {
      btn.addEventListener('click', function() {
        applyShiftPreset(btn.dataset.shiftPreset);
        renderShiftEditor(slot);
      });
    });
    var list = $('#shiftList');
    if (!shifts.length) {
      list.innerHTML = '<div class="empty">Смен нет.</div>';
      return;
    }
    list.innerHTML = shifts.map(function(shift, index) {
      return '<div class="row-card" data-index="' + index + '">' +
        '<div class="row-card-head"><strong>' + escapeHtml(shift.route || shift.id || 'Смена') + '</strong><button class="icon-btn" data-delete-shift="' + index + '" type="button">×</button></div>' +
        '<div class="form-grid">' +
          field('ID', 'id', shift.id, index) +
          field('Начало', 'start_msk', shift.start_msk, index, 'datetime-local') +
          field('Конец', 'end_msk', shift.end_msk, index, 'datetime-local') +
          field('Создано', 'created_at', shift.created_at, index, 'datetime-local') +
          field('Маршрут', 'route', shift.route, index) +
          field('Локомотив', 'locomotive', shift.locomotive, index) +
          field('Поезд', 'train', shift.train, index) +
          field('Тип', 'type', shift.type, index) +
          '<div class="field wide"><label>Заметки</label><textarea class="input" data-shift-field="notes" data-index="' + index + '">' + escapeHtml(shift.notes || '') + '</textarea></div>' +
        '</div></div>';
    }).join('');
    bindShiftInputs();
  }

  function applyShiftPreset(kind) {
    var shifts = state.selectedUserData.shifts || [];
    var now = new Date();
    var end = new Date(now.getTime() + (kind === 'night' ? 12 : 8) * 60 * 60 * 1000);
    var route = kind === 'trip' ? 'Поездная работа' : kind === 'night' ? 'Ночная смена' : 'Дневная смена';
    shifts.unshift({
      id: createAdminId('shift'),
      start_msk: now.toISOString(),
      end_msk: end.toISOString(),
      created_at: now.toISOString(),
      route: route,
      type: kind === 'trip' ? 'trip' : 'shift',
      notes: '',
    });
  }

  function field(label, key, value, index, type) {
    var inputType = type || 'text';
    var inputValue = inputType === 'datetime-local' ? toDateTimeInputValue(value) : (value || '');
    return '<div class="field"><label>' + escapeHtml(label) + '</label><input class="input" type="' + inputType + '" data-shift-field="' +
      escapeHtml(key) + '" data-index="' + index + '" value="' + escapeHtml(inputValue) + '" /></div>';
  }

  function bindShiftInputs() {
    $all('[data-shift-field]').forEach(function(input) {
      input.addEventListener('input', function() {
        var shift = state.selectedUserData.shifts[Number(input.dataset.index)];
        shift[input.dataset.shiftField] = input.value;
      });
    });
    $all('[data-delete-shift]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.selectedUserData.shifts.splice(Number(btn.dataset.deleteShift), 1);
        renderUserEditor();
      });
    });
  }

  function renderSalaryEditor(slot) {
    var salary = state.selectedUserData.salaryParams || {};
    var keys = Object.keys(salaryLabels);
    var totalPercent = keys.filter(function(key) { return key.indexOf('Percent') !== -1; }).reduce(function(sum, key) {
      return sum + Number(salary[key] || 0);
    }, 0);
    slot.innerHTML =
      '<div class="constructor-head">' +
        '<div><div class="card-title">Конструктор зарплаты</div><div class="muted">Ставки меняются ползунками. Сверху есть готовые шаблоны, чтобы не вспоминать проценты.</div></div>' +
      '</div>' +
      '<div class="quick-preset-row">' + salaryPresetRows.map(function(preset, index) {
        return '<button class="preset-btn" type="button" data-salary-preset="' + index + '">' + escapeHtml(preset.title) + '</button>';
      }).join('') + '</div>' +
      '<div class="salary-preview">' +
        '<div><span>Часовая ставка</span><strong>' + escapeHtml(salary.tariffRate || 0) + ' ₽</strong></div>' +
        '<div><span>Всего надбавок</span><strong>' + escapeHtml(Math.round(totalPercent)) + '%</strong></div>' +
        '<div><span>Командировочные</span><strong>' + escapeHtml(salary.komPerTrip || 0) + ' ₽</strong></div>' +
      '</div>' +
      '<div class="builder-grid salary-grid">' + keys.map(function(key) {
        var value = Number(salary[key] || 0);
        var max = key === 'monthlyNormHours' ? 250 : key === 'tariffRate' || key === 'komPerTrip' ? 3000 : 100;
        var step = key === 'tariffRate' || key === 'komPerTrip' ? 10 : 1;
        return '<div class="field salary-field"><label>' + escapeHtml(salaryLabels[key]) + ': <strong>' + escapeHtml(value) + ' ' + escapeHtml(salaryUnits[key]) + '</strong></label>' +
          '<input type="range" min="0" max="' + max + '" step="' + step + '" data-salary-key="' + key + '" value="' + escapeHtml(value) + '" />' +
          '<input class="input" type="number" min="0" step="0.01" data-salary-key="' + key + '" value="' + escapeHtml(value) + '" /></div>';
      }).join('') + '</div>';
    $all('[data-salary-preset]', slot).forEach(function(btn) {
      btn.addEventListener('click', function() {
        var preset = salaryPresetRows[Number(btn.dataset.salaryPreset)];
        Object.keys(preset.values).forEach(function(key) {
          state.selectedUserData.salaryParams[key] = preset.values[key];
        });
        renderSalaryEditor(slot);
      });
    });
    $all('[data-salary-key]').forEach(function(input) {
      input.addEventListener('input', function() {
        state.selectedUserData.salaryParams[input.dataset.salaryKey] = Number(input.value || 0);
      });
      input.addEventListener('change', function() { renderSalaryEditor(slot); });
    });
  }

  function renderWarningsEditor(slot) {
    if (!state.selectedUserData) return;
    if (!Array.isArray(state.selectedUserData.poekhaliWarnings)) {
      state.selectedUserData.poekhaliWarnings = [];
    }
    var warnings = state.selectedUserData.poekhaliWarnings;
    var routeBounds = getWarningsRouteBounds(warnings);
    var bounds = getWarningsViewBounds(routeBounds);
    var popover = state.warningsPopover || { id: null };
    state.warningsPopover = popover;
    if (popover.id && !warnings.some(function(w) { return w.id === popover.id; })) {
      popover.id = null;
    }

    slot.innerHTML =
      '<div class="map-editor-v2">' +
        renderWarningsToolbar(warnings.length) +
        renderWarningsStage(warnings, bounds, routeBounds, popover) +
        renderWarningsSummary(warnings, popover) +
      '</div>';

    bindWarningsEditorV2(routeBounds, bounds);
  }

  function getWarningsRouteBounds(warnings) {
    if (!warnings.length) return { min: 0, max: 200000 };
    var coords = [];
    warnings.forEach(function(w) {
      if (isFinite(Number(w.start))) coords.push(Number(w.start));
      if (isFinite(Number(w.end))) coords.push(Number(w.end));
    });
    if (!coords.length) return { min: 0, max: 200000 };
    var min = Math.min.apply(Math, coords);
    var max = Math.max.apply(Math, coords);
    var span = Math.max(2000, max - min);
    var pad = Math.max(2000, Math.round(span * 0.1));
    return { min: Math.max(0, min - pad), max: max + pad };
  }

  function getWarningsViewBounds(routeBounds) {
    var fullSpan = Math.max(1000, routeBounds.max - routeBounds.min);
    var zoom = state.warningsZoom;
    if (!zoom) {
      zoom = { center: (routeBounds.min + routeBounds.max) / 2, span: fullSpan };
    }
    zoom.span = Math.max(500, Math.min(fullSpan, zoom.span));
    var half = zoom.span / 2;
    zoom.center = Math.max(routeBounds.min + half, Math.min(routeBounds.max - half, zoom.center));
    state.warningsZoom = zoom;
    return { min: Math.round(zoom.center - half), max: Math.round(zoom.center + half) };
  }

  function renderWarningsToolbar(count) {
    return '<div class="map-toolbar">' +
      '<div class="map-toolbar-block">' +
        warningPresets.map(function(preset) {
          return '<button class="preset-btn" type="button" data-warning-add="' + preset.speed + '">+ ' + escapeHtml(preset.title) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="map-toolbar-counts">' +
        '<span><b>' + count + '</b> ограничений</span>' +
      '</div>' +
      '<div class="map-toolbar-block map-toolbar-zoom">' +
        '<button class="icon-btn" type="button" id="warningsZoomOut" title="Отдалить">−</button>' +
        '<button class="icon-btn" type="button" id="warningsZoomReset" title="Весь маршрут">⌂</button>' +
        '<button class="icon-btn" type="button" id="warningsZoomIn" title="Приблизить">+</button>' +
      '</div>' +
    '</div>';
  }

  function renderWarningsStage(warnings, bounds, routeBounds, popover) {
    var visible = warnings.filter(function(w) {
      var start = Math.min(Number(w.start) || 0, Number(w.end) || 0);
      var end = Math.max(Number(w.start) || 0, Number(w.end) || 0);
      return end >= bounds.min && start <= bounds.max;
    });
    var popoverEntity = popover.id ? warnings.find(function(w) { return w.id === popover.id; }) : null;
    return '<div class="map-stage">' +
      '<div class="map-stage-scale">' + renderMapTicks(bounds) + '</div>' +
      '<div class="map-stage-rail" id="warningsStageRail">' +
        '<div class="map-stage-line"></div>' +
        '<div class="map-stage-speeds">' + visible.map(function(w) { return renderWarningBar(w, bounds, popover); }).join('') + '</div>' +
      '</div>' +
      (popoverEntity ? renderWarningPopover(popoverEntity, bounds, routeBounds) : '') +
    '</div>';
  }

  function renderWarningBar(warning, bounds, popover) {
    var start = Math.max(Math.min(Number(warning.start) || 0, Number(warning.end) || 0), bounds.min);
    var end = Math.min(Math.max(Number(warning.start) || 0, Number(warning.end) || 0), bounds.max);
    var left = coordinatePercent(start, bounds);
    var right = coordinatePercent(end, bounds);
    var width = Math.max(0.6, right - left);
    var speed = Math.max(1, Math.round(Number(warning.speed) || 25));
    var tone = speed <= 40 ? 'danger' : speed <= 60 ? 'warning' : 'success';
    var selected = popover.id === warning.id;
    var disabled = warning.enabled === false;
    return '<button class="map-speed-bar map-speed-bar--' + tone + (selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '') + '" type="button"' +
      ' style="left:' + left + '%;width:' + width + '%"' +
      ' data-warning-bar="' + escapeHtml(warning.id) + '"' +
      ' title="' + escapeHtml((warning.name || 'Ограничение') + ' · ' + speed + ' км/ч') + '">' +
      '<span class="map-speed-bar-label">' + speed + '</span>' +
    '</button>';
  }

  function renderWarningPopover(warning, bounds, routeBounds) {
    var start = Math.min(Number(warning.start) || 0, Number(warning.end) || 0);
    var end = Math.max(Number(warning.start) || 0, Number(warning.end) || 0);
    var anchor = coordinatePercent((start + end) / 2, bounds);
    var edge = popoverAnchor(anchor);
    var speed = Math.max(1, Math.round(Number(warning.speed) || 25));
    var tone = speed <= 40 ? 'danger' : speed <= 60 ? 'warning' : 'success';
    var enabled = warning.enabled !== false;
    var validUntil = warning.validUntil ? String(warning.validUntil).slice(0, 10) : '';
    return '<div class="map-popover map-popover--' + tone + '" data-edge="' + edge + '" style="left:' + anchor + '%">' +
      '<div class="map-popover-head">' +
        '<strong>Ограничение · ' + speed + ' км/ч</strong>' +
        '<button class="icon-btn" type="button" data-warning-popover-close>×</button>' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Название</label>' +
        '<input class="input" type="text" data-warning-popover-field="name" value="' + escapeHtml(warning.name || '') + '" />' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Скорость: <strong>' + speed + ' км/ч</strong></label>' +
        '<input type="range" min="5" max="120" step="1" data-warning-popover-field="speed" value="' + speed + '" />' +
      '</div>' +
      '<div class="map-popover-presets">' +
        [25, 40, 60, 80].map(function(value) {
          return '<button class="preset-btn ' + (speed === value ? 'is-active' : '') + '" type="button" data-warning-popover-preset="' + value + '">' + value + '</button>';
        }).join('') +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Начало: <strong>' + escapeHtml(formatCoordinate(start)) + '</strong></label>' +
        '<input type="range" min="' + routeBounds.min + '" max="' + routeBounds.max + '" step="10" data-warning-popover-field="start" value="' + start + '" />' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Конец: <strong>' + escapeHtml(formatCoordinate(end)) + '</strong></label>' +
        '<input type="range" min="' + routeBounds.min + '" max="' + routeBounds.max + '" step="10" data-warning-popover-field="end" value="' + end + '" />' +
      '</div>' +
      '<div class="map-popover-row warning-popover-inline">' +
        '<div><label>Действует до</label><input class="input" type="date" data-warning-popover-field="validUntil" value="' + escapeHtml(validUntil) + '" /></div>' +
        '<div><label>Показывать</label>' +
          '<button class="toggle-pill ' + (enabled ? 'is-on' : '') + '" type="button" data-warning-popover-toggle>' + (enabled ? 'Да' : 'Нет') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Подпись для себя</label>' +
        '<textarea class="input warning-popover-note" rows="2" data-warning-popover-field="note">' + escapeHtml(warning.note || '') + '</textarea>' +
      '</div>' +
      '<div class="map-popover-foot">' +
        '<button class="btn-danger" type="button" data-warning-popover-delete>Удалить</button>' +
      '</div>' +
    '</div>';
  }

  function renderWarningsSummary(warnings, popover) {
    if (!warnings.length) {
      return '<div class="empty">Ограничений пока нет. Нажми «+ 25 км/ч», «+ 40 км/ч» или «+ 60 км/ч».</div>';
    }
    var rows = warnings.map(function(w) {
      var speed = Math.max(1, Math.round(Number(w.speed) || 25));
      var tone = speed <= 40 ? 'danger' : speed <= 60 ? 'warning' : 'success';
      var selected = popover.id === w.id;
      var disabled = w.enabled === false;
      var start = Math.min(Number(w.start) || 0, Number(w.end) || 0);
      var end = Math.max(Number(w.start) || 0, Number(w.end) || 0);
      var validLabel = w.validUntil ? ' · до ' + String(w.validUntil).slice(0, 10) : '';
      var stateLabel = disabled ? ' · скрыто' : '';
      return {
        sort: start,
        html: '<button class="map-summary-row ' + (selected ? 'is-active' : '') + (disabled ? ' is-muted' : '') + '" type="button" data-warning-summary="' + escapeHtml(w.id) + '">' +
          '<span class="map-summary-badge map-summary-badge--' + tone + '">' + speed + '</span>' +
          '<span class="map-summary-name">' + escapeHtml(w.name || 'Без названия') + '</span>' +
          '<span class="map-summary-coord">' + escapeHtml(formatCoordinate(start) + ' – ' + formatCoordinate(end) + validLabel + stateLabel) + '</span>' +
        '</button>',
      };
    });
    rows.sort(function(a, b) { return a.sort - b.sort; });
    return '<div class="map-summary">' +
      '<div class="map-summary-head"><strong>Все ограничения</strong><span>' + rows.length + ' элементов</span></div>' +
      '<div class="map-summary-list">' + rows.map(function(row) { return row.html; }).join('') + '</div>' +
    '</div>';
  }

  function bindWarningsEditorV2(routeBounds, bounds) {
    $all('[data-warning-add]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        addWarningEntity(Number(btn.dataset.warningAdd), bounds);
      });
    });

    var zoomIn = $('#warningsZoomIn');
    if (zoomIn) zoomIn.addEventListener('click', function() {
      if (state.warningsZoom) state.warningsZoom.span = Math.max(500, state.warningsZoom.span * 0.55);
      renderUserTab();
    });
    var zoomOut = $('#warningsZoomOut');
    if (zoomOut) zoomOut.addEventListener('click', function() {
      if (state.warningsZoom) state.warningsZoom.span = state.warningsZoom.span * 1.8;
      renderUserTab();
    });
    var zoomReset = $('#warningsZoomReset');
    if (zoomReset) zoomReset.addEventListener('click', function() {
      state.warningsZoom = null;
      renderUserTab();
    });

    $all('[data-warning-bar]').forEach(function(el) {
      el.addEventListener('click', function(event) {
        if (el.dataset.draggedRecently === '1') {
          el.dataset.draggedRecently = '0';
          return;
        }
        event.stopPropagation();
        toggleWarningPopover(el.dataset.warningBar);
      });
      el.addEventListener('pointerdown', function(event) {
        startWarningDrag(el, event, routeBounds, bounds);
      });
    });

    var rail = $('#warningsStageRail');
    if (rail) rail.addEventListener('click', function(event) {
      if (event.target.closest && event.target.closest('[data-warning-bar]')) return;
      if (state.warningsPopover && state.warningsPopover.id) {
        state.warningsPopover = { id: null };
        renderUserTab();
      }
    });

    $all('[data-warning-popover-field]').forEach(function(input) {
      var update = function() { updateWarningPopoverField(input); };
      input.addEventListener('input', update);
      input.addEventListener('change', function() {
        update();
        renderUserTab();
      });
    });
    $all('[data-warning-popover-preset]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        applyWarningPopoverPreset(Number(btn.dataset.warningPopoverPreset));
      });
    });
    var toggleBtn = $('[data-warning-popover-toggle]');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleCurrentWarningEnabled);
    var closeBtn = $('[data-warning-popover-close]');
    if (closeBtn) closeBtn.addEventListener('click', function() {
      state.warningsPopover = { id: null };
      renderUserTab();
    });
    var deleteBtn = $('[data-warning-popover-delete]');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentWarning);

    $all('[data-warning-summary]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.dataset.warningSummary;
        state.warningsPopover = { id: id };
        centerWarningView(id);
        renderUserTab();
      });
    });
  }

  function findWarning(id) {
    var warnings = (state.selectedUserData && state.selectedUserData.poekhaliWarnings) || [];
    return warnings.find(function(w) { return w.id === id; });
  }

  function toggleWarningPopover(id) {
    var current = state.warningsPopover || {};
    if (current.id === id) {
      state.warningsPopover = { id: null };
    } else {
      state.warningsPopover = { id: id };
    }
    renderUserTab();
  }

  function addWarningEntity(speed, bounds) {
    if (!Array.isArray(state.selectedUserData.poekhaliWarnings)) {
      state.selectedUserData.poekhaliWarnings = [];
    }
    var center = Math.round((bounds.min + bounds.max) / 2);
    var halfLen = Math.max(250, Math.round((bounds.max - bounds.min) / 30));
    var nowIso = new Date().toISOString();
    var entity = {
      id: createAdminId('warning'),
      mapId: 'komsomol-sk-tche-9',
      shiftId: '',
      sector: 0,
      start: center - halfLen,
      end: center + halfLen,
      coordinate: center - halfLen,
      length: halfLen * 2,
      speed: speed,
      name: 'Ограничение ' + speed,
      note: '',
      enabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    state.selectedUserData.poekhaliWarnings.unshift(entity);
    state.warningsPopover = { id: entity.id };
    renderUserTab();
  }

  function startWarningDrag(el, downEvent, routeBounds, bounds) {
    if (downEvent.button !== undefined && downEvent.button !== 0) return;
    var rail = $('#warningsStageRail');
    if (!rail) return;
    var rect = rail.getBoundingClientRect();
    var id = el.dataset.warningBar;
    var pointerId = downEvent.pointerId;
    var moved = false;
    var initialX = downEvent.clientX;
    var entity = findWarning(id);
    if (!entity) return;
    var initial = {
      start: Math.min(Number(entity.start) || 0, Number(entity.end) || 0),
      end: Math.max(Number(entity.start) || 0, Number(entity.end) || 0),
    };

    if (el.setPointerCapture) {
      try { el.setPointerCapture(pointerId); } catch (_) {}
    }
    el.classList.add('is-dragging');

    function onMove(event) {
      var dx = event.clientX - initialX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      var ratio = dx / Math.max(1, rect.width);
      var deltaCoord = Math.round(ratio * (bounds.max - bounds.min));
      var newStart = initial.start + deltaCoord;
      var newEnd = initial.end + deltaCoord;
      if (newStart < routeBounds.min) {
        newEnd += routeBounds.min - newStart;
        newStart = routeBounds.min;
      }
      if (newEnd > routeBounds.max) {
        newStart -= newEnd - routeBounds.max;
        newEnd = routeBounds.max;
      }
      entity.start = newStart;
      entity.end = newEnd;
      entity.coordinate = newStart;
      entity.length = Math.max(0, newEnd - newStart);
      entity.updatedAt = new Date().toISOString();
      var leftPct = coordinatePercent(Math.max(newStart, bounds.min), bounds);
      var rightPct = coordinatePercent(Math.min(newEnd, bounds.max), bounds);
      el.style.left = leftPct + '%';
      el.style.width = Math.max(0.6, rightPct - leftPct) + '%';
    }

    function finish() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', finish);
      el.removeEventListener('pointercancel', finish);
      if (el.releasePointerCapture) {
        try { el.releasePointerCapture(pointerId); } catch (_) {}
      }
      el.classList.remove('is-dragging');
      if (moved) {
        el.dataset.draggedRecently = '1';
        renderUserTab();
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }

  function updateWarningPopoverField(input) {
    var pop = state.warningsPopover;
    if (!pop || !pop.id) return;
    var entity = findWarning(pop.id);
    if (!entity) return;
    var field = input.dataset.warningPopoverField;
    var rawValue = input.type === 'number' || input.type === 'range' ? Number(input.value || 0) : input.value;
    entity[field] = rawValue;
    if (field === 'start' && Number(entity.start) > Number(entity.end)) entity.end = entity.start;
    if (field === 'end' && Number(entity.end) < Number(entity.start)) entity.start = entity.end;
    entity.coordinate = Math.min(Number(entity.start) || 0, Number(entity.end) || 0);
    entity.length = Math.max(0, Math.abs(Number(entity.end) - Number(entity.start)));
    entity.updatedAt = new Date().toISOString();
  }

  function applyWarningPopoverPreset(speed) {
    var pop = state.warningsPopover;
    if (!pop || !pop.id) return;
    var entity = findWarning(pop.id);
    if (!entity) return;
    entity.speed = speed;
    entity.updatedAt = new Date().toISOString();
    renderUserTab();
  }

  function toggleCurrentWarningEnabled() {
    var pop = state.warningsPopover;
    if (!pop || !pop.id) return;
    var entity = findWarning(pop.id);
    if (!entity) return;
    entity.enabled = entity.enabled === false;
    entity.updatedAt = new Date().toISOString();
    renderUserTab();
  }

  function deleteCurrentWarning() {
    var pop = state.warningsPopover;
    if (!pop || !pop.id) return;
    state.selectedUserData.poekhaliWarnings = (state.selectedUserData.poekhaliWarnings || []).filter(function(w) { return w.id !== pop.id; });
    state.warningsPopover = { id: null };
    renderUserTab();
  }

  function centerWarningView(id) {
    var entity = findWarning(id);
    if (!entity) return;
    var start = Number(entity.start) || 0;
    var end = Number(entity.end) || 0;
    var center = (start + end) / 2;
    if (state.warningsZoom) state.warningsZoom.center = center;
  }

  function renderRunsCards(slot) {
    var runs = state.selectedUserData.poekhaliRuns || [];
    var activeCount = runs.filter(function(run) { return run && run.status === 'active'; }).length;
    var totalDistance = runs.reduce(function(sum, run) { return sum + Number(run && run.distanceMeters || 0); }, 0);
    slot.innerHTML =
      '<div class="constructor-head">' +
        '<div><div class="card-title">Поездки карточками</div>' +
        '<div class="muted">Здесь просмотр поездок как в приложении: маршрут, скорость, события и прогресс без JSON.</div></div>' +
      '</div>' +
      '<div class="grid grid-3 trip-summary">' +
        metricCard('Всего поездок', runs.length, 'Записи режима Поехали', 'users') +
        metricCard('Активные', activeCount, 'Ещё не завершены', 'online', activeCount ? 70 : 8) +
        metricCard('Пройдено', formatDistance(totalDistance), 'Сумма записанных поездок', 'docs') +
      '</div>' +
      '<div class="trip-card-list">' + (runs.length ? runs.map(renderRunCard).join('') : '<div class="empty">Поездок пока нет.</div>') + '</div>';
  }

  function renderRunCard(run) {
    var title = run.route || [run.routeFromName, run.routeToName].filter(Boolean).join(' — ') || run.mapTitle || 'Поездка';
    var progress = Math.max(0, Math.min(100, Number(run.routeProgressPct) || 0));
    var status = run.status === 'active' ? 'идёт' : run.status === 'paused' ? 'пауза' : 'завершена';
    return '<div class="trip-card">' +
      '<div class="trip-card-top">' +
        '<div><strong>' + escapeHtml(title) + '</strong><div class="muted">' + escapeHtml(formatDate(run.startedAt || run.createdAt)) + '</div></div>' +
        '<span class="pill ' + (run.status === 'active' ? 'is-online' : '') + '">' + escapeHtml(status) + '</span>' +
      '</div>' +
      '<div class="trip-route">' +
        '<span>' + escapeHtml(run.routeFromName || 'Старт') + '</span>' +
        '<div class="trip-route-line"><i style="width:' + progress + '%"></i></div>' +
        '<span>' + escapeHtml(run.routeToName || 'Финиш') + '</span>' +
      '</div>' +
      '<div class="trip-stats">' +
        '<div><b>' + escapeHtml(formatDuration(run.durationMs)) + '</b><span>время</span></div>' +
        '<div><b>' + escapeHtml(formatDistance(run.distanceMeters)) + '</b><span>путь</span></div>' +
        '<div><b>' + escapeHtml(Math.round(Number(run.maxSpeedKmh) || 0)) + '</b><span>макс км/ч</span></div>' +
        '<div><b>' + escapeHtml(run.warningsCount || 0) + '</b><span>огр.</span></div>' +
      '</div>' +
      '<div class="trip-foot">' +
        '<span>Следующий светофор: <b>' + escapeHtml(run.nextSignalName || '—') + '</b></span>' +
        '<span>Следующая цель: <b>' + escapeHtml(run.nextTargetLabel || run.nextStationName || '—') + '</b></span>' +
      '</div>' +
    '</div>';
  }

  function getLearningStore() {
    var data = state.selectedUserData;
    if (!data.poekhaliLearning || typeof data.poekhaliLearning !== 'object' || Array.isArray(data.poekhaliLearning)) {
      data.poekhaliLearning = { version: 1, maps: {} };
    }
    if (!data.poekhaliLearning.maps || typeof data.poekhaliLearning.maps !== 'object' || Array.isArray(data.poekhaliLearning.maps)) {
      data.poekhaliLearning.maps = {};
    }
    return data.poekhaliLearning;
  }

  function getLearningSections() {
    var store = getLearningStore();
    var rows = [];
    Object.keys(store.maps || {}).forEach(function(mapId) {
      var map = store.maps[mapId] || {};
      Object.keys(map.userSections || {}).forEach(function(sectionId) {
        var section = map.userSections[sectionId];
        if (!section) return;
        rows.push({ mapId: mapId, sectionId: sectionId, section: section });
      });
    });
    return rows;
  }

  function renderLearningConstructor(slot) {
    var sections = getLearningSections();
    var selected = getSelectedLearningSection(sections);
    slot.innerHTML =
      '<div class="constructor-head">' +
        '<div><div class="card-title">Конструктор карты Поехали</div>' +
        '<div class="muted">Светофоры, станции и скорости редактируются карточками на линии координат. Это реальные пользовательские GPS-участки.</div></div>' +
        '<button class="btn-primary" id="btnCreateLearningSection" type="button">Создать участок</button>' +
      '</div>' +
      '<div class="learning-layout">' +
        '<div class="learning-sidebar" id="learningSectionList">' + renderLearningSectionList(sections, selected) + '</div>' +
        '<div class="learning-editor" id="learningEditor">' + (selected ? renderLearningSectionEditor(selected) : '<div class="empty">Участков пока нет. Нажми "Создать участок", задай начало и конец, потом добавь светофоры и скорости.</div>') + '</div>' +
      '</div>';
    $('#btnCreateLearningSection').addEventListener('click', function() {
      createManualLearningSection();
      renderLearningConstructor(slot);
    });
    $all('[data-learning-section]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.selectedLearningMapId = btn.dataset.mapId;
        state.selectedLearningSectionId = btn.dataset.sectionId;
        renderLearningConstructor(slot);
      });
    });
    if (selected) bindLearningEditor(slot, selected);
  }

  function createManualLearningSection() {
    var store = getLearningStore();
    var mapId = 'admin-map';
    if (!store.maps[mapId]) store.maps[mapId] = { updatedAt: Date.now(), sectors: {}, rawTracks: {}, userSections: {} };
    if (!store.maps[mapId].userSections) store.maps[mapId].userSections = {};
    var sectionId = createAdminId('section');
    var start = 3700000;
    var end = 3705000;
    store.maps[mapId].userSections[sectionId] = {
      id: sectionId,
      mapId: mapId,
      sector: 18,
      referenceSector: null,
      title: 'Новый участок',
      sourceTrackKey: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      verifiedAt: Date.now(),
      routePoints: [
        { lat: 0, lon: 0, ordinate: start, coordinate: start, sector: 18, ts: Date.now(), position: 0 },
        { lat: 0, lon: 0.01, ordinate: end, coordinate: end, sector: 18, ts: Date.now() + 1000, position: 1 },
      ],
      profileSegments: [],
      objects: [],
      speeds: [],
      history: [],
    };
    state.selectedLearningMapId = mapId;
    state.selectedLearningSectionId = sectionId;
  }

  function getSelectedLearningSection(sections) {
    if (!sections.length) return null;
    var selected = sections.find(function(row) {
      return row.mapId === state.selectedLearningMapId && row.sectionId === state.selectedLearningSectionId;
    }) || sections[0];
    state.selectedLearningMapId = selected.mapId;
    state.selectedLearningSectionId = selected.sectionId;
    return selected;
  }

  function renderLearningSectionList(sections, selected) {
    if (!sections.length) return '<div class="empty">Нет участков</div>';
    return sections.map(function(row) {
      var section = row.section || {};
      var active = selected && selected.mapId === row.mapId && selected.sectionId === row.sectionId;
      var signals = (section.objects || []).filter(function(item) { return String(item.type) === '1'; }).length;
      return '<button class="learning-section-card ' + (active ? 'is-active' : '') + '" type="button" data-learning-section="1" data-map-id="' + escapeHtml(row.mapId) + '" data-section-id="' + escapeHtml(row.sectionId) + '">' +
        '<strong>' + escapeHtml(section.title || row.sectionId) + '</strong>' +
        '<span>' + escapeHtml('уч. ' + (section.sector || '—') + ' · ' + signals + ' светофоров · ' + ((section.speeds || []).length) + ' скоростей') + '</span>' +
      '</button>';
    }).join('');
  }

  function renderLearningSectionEditor(row) {
    var section = row.section;
    var points = section.routePoints || [];
    var bounds = getCoordinateBounds(points.map(function(point) { return { coordinate: point.ordinate || point.coordinate }; }), ['coordinate']);
    var entities = getLearningEntities(section);
    return '<div class="learning-workbench">' +
      '<div class="builder-grid">' +
        '<div class="field wide"><label>Название участка</label><input class="input" data-section-meta="title" value="' + escapeHtml(section.title || '') + '" /></div>' +
        '<div class="field"><label>Участок</label><input class="input" type="number" data-section-meta="sector" value="' + escapeHtml(section.sector || 0) + '" /></div>' +
        '<div class="field"><label>Опорный участок</label><input class="input" type="number" data-section-meta="referenceSector" value="' + escapeHtml(section.referenceSector === null || section.referenceSector === undefined ? '' : section.referenceSector) + '" /></div>' +
        '<div class="field"><label>Начало линии</label><input class="input" type="number" data-section-bound="start" value="' + escapeHtml(bounds.min) + '" /></div>' +
        '<div class="field"><label>Конец линии</label><input class="input" type="number" data-section-bound="end" value="' + escapeHtml(bounds.max) + '" /></div>' +
      '</div>' +
      '<div class="route-scale route-scale--large"><span>' + escapeHtml(formatCoordinate(bounds.min)) + '</span><div class="route-scale-line"></div><span>' + escapeHtml(formatCoordinate(bounds.max)) + '</span></div>' +
      '<div class="map-canvas">' +
        '<div class="map-canvas-rail"></div>' +
        entities.map(function(entity) { return renderLearningMarker(entity, bounds); }).join('') +
      '</div>' +
      '<div class="add-entity-card">' +
        '<div class="card-title">Добавить на линию</div>' +
        '<div class="quick-preset-row"><button class="preset-btn" type="button" data-learning-kind="signal">Светофор</button><button class="preset-btn" type="button" data-learning-kind="station">Станция</button><button class="preset-btn" type="button" data-learning-kind="speed">Скорость</button></div>' +
        '<div class="builder-grid">' +
          '<div class="field"><label>Что</label><select class="select" id="learningNewKind"><option value="signal">Светофор</option><option value="station">Станция</option><option value="speed">Скорость</option></select></div>' +
          '<div class="field"><label>Название</label><input class="input" id="learningNewName" placeholder="Напр. НМ1 или ОГР 60" /></div>' +
          '<div class="field"><label>Координата</label><input class="input" type="number" id="learningNewCoordinate" value="' + escapeHtml(Math.round((bounds.min + bounds.max) / 2)) + '" /></div>' +
          '<div class="field"><label>Длина, м</label><input class="input" type="number" id="learningNewLength" value="0" /></div>' +
          '<div class="field"><label>Скорость</label><input class="input" type="number" id="learningNewSpeed" value="60" /></div>' +
        '</div>' +
        '<button class="btn-primary" id="btnAddLearningEntity" type="button">Добавить карточку</button>' +
      '</div>' +
      '<div class="editor-list visual-list">' + (entities.length ? entities.map(function(entity) { return renderLearningEntityCard(entity, bounds); }).join('') : '<div class="empty">На участке ещё нет светофоров, станций и скоростей.</div>') + '</div>' +
    '</div>';
  }

  function getLearningEntities(section) {
    var result = [];
    (section.objects || []).forEach(function(item, index) {
      result.push({ kind: String(item.type) === '1' ? 'signal' : 'station', list: 'objects', index: index, item: item, coordinate: Number(item.coordinate) || 0 });
    });
    (section.speeds || []).forEach(function(item, index) {
      result.push({ kind: 'speed', list: 'speeds', index: index, item: item, coordinate: Number(item.coordinate) || 0 });
    });
    return result.sort(function(a, b) { return a.coordinate - b.coordinate || a.kind.localeCompare(b.kind); });
  }

  function renderLearningMarker(entity, bounds) {
    var left = coordinatePercent(entity.coordinate, bounds);
    var label = entity.kind === 'signal' ? 'СВ' : entity.kind === 'station' ? 'СТ' : Math.round(Number(entity.item.speed) || 0);
    return '<span class="map-marker map-marker--' + entity.kind + '" style="left:' + left + '%" title="' + escapeHtml(entity.item.name || '') + '">' + escapeHtml(label) + '</span>';
  }

  function renderLearningEntityCard(entity, bounds) {
    var item = entity.item || {};
    var label = entity.kind === 'signal' ? 'Светофор' : entity.kind === 'station' ? 'Станция' : 'Скорость';
    return '<div class="row-card learning-entity-card">' +
      '<div class="row-card-head"><div><strong>' + escapeHtml(label + ': ' + (item.name || 'без названия')) + '</strong><div class="muted">' + escapeHtml(formatCoordinate(item.coordinate)) + '</div></div>' +
      '<button class="icon-btn" data-delete-entity="' + entity.list + ':' + entity.index + '" type="button">×</button></div>' +
      '<div class="track-preview"><div class="track-preview-line"></div><span class="track-pin" style="left:' + coordinatePercent(item.coordinate, bounds) + '%"></span></div>' +
      '<div class="builder-grid">' +
        '<div class="field"><label>Название</label><input class="input" data-learning-list="' + entity.list + '" data-learning-index="' + entity.index + '" data-learning-field="name" value="' + escapeHtml(item.name || '') + '" /></div>' +
        '<div class="field"><label>Координата</label><input class="input" type="number" data-learning-list="' + entity.list + '" data-learning-index="' + entity.index + '" data-learning-field="coordinate" value="' + escapeHtml(item.coordinate || 0) + '" /></div>' +
        '<div class="field range-field"><label>Перетащить по линии</label><input type="range" min="' + Math.round(bounds.min) + '" max="' + Math.round(bounds.max) + '" step="1" data-learning-list="' + entity.list + '" data-learning-index="' + entity.index + '" data-learning-field="coordinate" value="' + escapeHtml(item.coordinate || 0) + '" /></div>' +
        '<div class="field"><label>' + (entity.kind === 'speed' ? 'Длина, м' : 'Длина/зона, м') + '</label><input class="input" type="number" data-learning-list="' + entity.list + '" data-learning-index="' + entity.index + '" data-learning-field="length" value="' + escapeHtml(item.length || 0) + '" /></div>' +
        (entity.kind === 'speed' ? '<div class="field"><label>Скорость</label><input class="input" type="number" data-learning-list="' + entity.list + '" data-learning-index="' + entity.index + '" data-learning-field="speed" value="' + escapeHtml(item.speed || 60) + '" /></div>' : '') +
      '</div></div>';
  }

  function bindLearningEditor(slot, row) {
    var section = row.section;
    $all('[data-section-meta]').forEach(function(input) {
      input.addEventListener('input', function() {
        var key = input.dataset.sectionMeta;
        if (input.type === 'number') {
          section[key] = key === 'referenceSector' && input.value === '' ? null : Number(input.value || 0);
        } else {
          section[key] = input.value;
        }
        section.updatedAt = Date.now();
      });
    });
    $all('[data-section-bound]').forEach(function(input) {
      input.addEventListener('change', function() {
        var points = section.routePoints || [];
        if (points.length < 2) return;
        var value = Math.max(0, Math.round(Number(input.value) || 0));
        var sorted = points.slice().sort(function(a, b) { return Number(a.ordinate || a.coordinate || 0) - Number(b.ordinate || b.coordinate || 0); });
        var point = input.dataset.sectionBound === 'start' ? sorted[0] : sorted[sorted.length - 1];
        point.ordinate = value;
        point.coordinate = value;
        section.updatedAt = Date.now();
        renderLearningConstructor(slot);
      });
    });
    $all('[data-learning-kind]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        $('#learningNewKind').value = btn.dataset.learningKind;
        if (!$('#learningNewName').value) {
          $('#learningNewName').value = btn.dataset.learningKind === 'signal' ? 'Новый светофор' : btn.dataset.learningKind === 'station' ? 'Новая станция' : 'ОГР 60';
        }
      });
    });
    $all('[data-learning-field]').forEach(function(input) {
      var update = function() {
        var list = section[input.dataset.learningList] || [];
        var item = list[Number(input.dataset.learningIndex)];
        if (!item) return;
        var key = input.dataset.learningField;
        item[key] = (input.type === 'number' || input.type === 'range') ? Number(input.value || 0) : input.value;
        if (key === 'coordinate' || key === 'length') item.end = Math.max(Number(item.coordinate) || 0, (Number(item.coordinate) || 0) + (Number(item.length) || 0));
        section.updatedAt = Date.now();
      };
      input.addEventListener('input', update);
      input.addEventListener('change', function() {
        update();
        renderLearningConstructor(slot);
      });
    });
    $('#btnAddLearningEntity').addEventListener('click', function() {
      var kind = $('#learningNewKind').value;
      var coordinate = Math.max(0, Math.round(Number($('#learningNewCoordinate').value) || 0));
      var length = Math.max(0, Math.round(Number($('#learningNewLength').value) || 0));
      var speed = Math.max(1, Math.round(Number($('#learningNewSpeed').value) || 60));
      var name = ($('#learningNewName').value || '').trim() || (kind === 'signal' ? 'Новый светофор' : kind === 'station' ? 'Новая станция' : 'ОГР ' + speed);
      if (kind === 'speed') {
        if (!Array.isArray(section.speeds)) section.speeds = [];
        section.speeds.push({ id: 'admin-speed-' + Date.now(), sector: Number(section.sector) || 0, coordinate: coordinate, length: length || 1000, end: coordinate + (length || 1000), speed: speed, name: name, source: 'user' });
      } else {
        if (!Array.isArray(section.objects)) section.objects = [];
        section.objects.push({ id: 'admin-object-' + Date.now(), fileKey: 'user', sector: Number(section.sector) || 0, type: kind === 'signal' ? '1' : '2', name: name, coordinate: coordinate, length: length, end: coordinate + length, source: 'user' });
      }
      section.updatedAt = Date.now();
      renderLearningConstructor(slot);
    });
    $all('[data-delete-entity]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var parts = btn.dataset.deleteEntity.split(':');
        var list = section[parts[0]];
        if (Array.isArray(list)) list.splice(Number(parts[1]), 1);
        section.updatedAt = Date.now();
        renderLearningConstructor(slot);
      });
    });
  }

  function renderJsonEditor(slot, key, title, helpText) {
    slot.innerHTML = '<div class="danger-note"><strong>Осторожно:</strong> ' + escapeHtml(helpText || 'Это технический формат данных. Ошибка в скобке или запятой может сломать сохранение.') + '</div>' +
      '<div class="field"><label>' + escapeHtml(title) + '</label><textarea class="textarea" id="json_' + key + '">' +
      escapeHtml(getJsonText(state.selectedUserData[key])) + '</textarea></div>';
    $('#json_' + key).addEventListener('input', function() {
      try {
        state.selectedUserData[key] = parseJsonTextarea('json_' + key);
        setStatus('');
      } catch (error) {
        setStatus('Технический текст пока с ошибкой: ' + error.message, 'error');
      }
    });
  }

  function saveCurrentUser() {
    setStatus('Сохраняю пользователя...');
    return request('user', { method: 'PUT', sid: state.selectedSid, body: state.selectedUserData })
      .then(function(body) {
        state.selectedUserData = body.userData;
        setStatus('Пользователь сохранён', 'ok');
        return loadUsers();
      })
      .then(renderUsers)
      .catch(showError);
  }

  function renderPoekhaliMap() {
    var map = normalizeMapConfig(state.poekhaliMap);
    state.poekhaliMap = map;
    var routes = getAllMapRoutes();
    var route = getMapRoute(state.mapRouteId);
    if (!route) {
      els.map.innerHTML = '<div class="empty">Карта пока не загружена.</div>';
      return;
    }
    state.mapRouteId = route.id;

    var rules = getMergedRouteSpeedRules(route.id);
    var objects = map.objects.filter(function(item) { return item.routeId === route.id; });
    var routeBounds = getRouteBoundsForMap(route, rules, objects);
    var bounds = getMapViewBounds(route, routeBounds);
    var popover = state.mapPopover || { kind: null, id: null };
    state.mapPopover = popover;
    if (popover.id && !findMapEntity(popover.kind, popover.id, rules, objects, map)) {
      popover.kind = null;
      popover.id = null;
    }

    els.map.innerHTML =
      '<div class="map-editor-v2">' +
        renderMapToolbar(routes, route, rules.length, objects.length) +
        renderMapStage(rules, objects, bounds, routeBounds, route, popover) +
        renderMapSummary(rules, objects, popover) +
      '</div>';

    bindMapEditorV2(route, bounds, routeBounds);
  }

  function getRouteBoundsForMap(route, rules, objects) {
    var min = Math.min(Number(route && route.start) || 0, Number(route && route.end) || 0);
    var max = Math.max(Number(route && route.start) || 0, Number(route && route.end) || 0);
    (rules || []).forEach(function(rule) {
      min = Math.min(min, getRuleStart(rule));
      max = Math.max(max, getRuleEnd(rule));
    });
    (objects || []).forEach(function(obj) {
      var coord = Number(obj && obj.coordinate);
      if (isFinite(coord)) {
        min = Math.min(min, coord);
        max = Math.max(max, coord);
      }
    });
    if (max - min < 500) max = min + 500;
    return { min: min, max: max };
  }

  function getMapViewBounds(route, routeBounds) {
    var fullSpan = Math.max(500, routeBounds.max - routeBounds.min);
    var zoom = state.mapZoom;
    if (!zoom || zoom.routeId !== route.id) {
      zoom = { routeId: route.id, center: (routeBounds.min + routeBounds.max) / 2, span: fullSpan };
    }
    zoom.span = Math.max(200, Math.min(fullSpan, zoom.span));
    var half = zoom.span / 2;
    zoom.center = Math.max(routeBounds.min + half, Math.min(routeBounds.max - half, zoom.center));
    state.mapZoom = zoom;
    return { min: Math.round(zoom.center - half), max: Math.round(zoom.center + half) };
  }

  function findMapEntity(kind, id, rules, objects, map) {
    if (!kind || !id) return null;
    if (kind === 'speed') {
      var inMerged = (rules || []).find(function(rule) { return rule.id === id; });
      if (inMerged) return inMerged;
      return (map && map.speedRules || []).find(function(rule) { return rule.id === id; }) || null;
    }
    var hit = (objects || []).find(function(obj) { return obj.id === id; });
    if (hit) return hit;
    return (map && map.objects || []).find(function(obj) { return obj.id === id; }) || null;
  }

  function renderMapToolbar(routes, route, speedCount, objectCount) {
    return '<div class="map-toolbar">' +
      '<div class="map-toolbar-block map-toolbar-route">' +
        '<select class="select map-route-select" id="mapRouteSelect">' +
          routes.map(function(item) {
            return '<option value="' + escapeHtml(item.id) + '"' + (item.id === route.id ? ' selected' : '') + '>' + escapeHtml(item.title) + '</option>';
          }).join('') +
        '</select>' +
        '<button class="icon-btn" type="button" id="btnAddMapRoute" title="Создать маршрут">+</button>' +
        '<button class="icon-btn" type="button" id="btnDuplicateMapRoute" title="Скопировать маршрут">⎘</button>' +
        '<button class="icon-btn" type="button" id="btnDeleteMapRoute" title="Удалить маршрут"' + (routes.length <= 1 ? ' disabled' : '') + '>×</button>' +
      '</div>' +
      '<div class="map-toolbar-counts">' +
        '<span><b>' + speedCount + '</b> скоростей</span>' +
        '<span><b>' + objectCount + '</b> объектов</span>' +
      '</div>' +
      '<div class="map-toolbar-block">' +
        '<button class="preset-btn" type="button" data-map-add="speed">+ Скорость</button>' +
        '<button class="preset-btn" type="button" data-map-add="signal">+ Светофор</button>' +
        '<button class="preset-btn" type="button" data-map-add="station">+ Станция</button>' +
      '</div>' +
      '<div class="map-toolbar-block map-toolbar-zoom">' +
        '<button class="icon-btn" type="button" id="mapZoomOut" title="Отдалить">−</button>' +
        '<button class="icon-btn" type="button" id="mapZoomReset" title="Весь маршрут">⌂</button>' +
        '<button class="icon-btn" type="button" id="mapZoomIn" title="Приблизить">+</button>' +
      '</div>' +
      '<button class="btn-primary" id="btnSavePoekhaliMap" type="button">Сохранить</button>' +
    '</div>';
  }

  function renderMapStage(rules, objects, bounds, routeBounds, route, popover) {
    var popoverEntity = popover.id ? findMapEntity(popover.kind, popover.id, rules, objects, state.poekhaliMap) : null;
    return '<div class="map-stage">' +
      '<canvas class="map-stage-canvas" id="mapStageCanvas"></canvas>' +
      '<div class="map-stage-hint muted">Тяни середину полосы — двигай. Край — расширяй/сужай. Клик по пустому месту скорости — новая полоса в этой точке.</div>' +
      (popoverEntity ? renderMapPopover(popover.kind, popoverEntity, bounds, routeBounds) : '') +
    '</div>';
  }

  function drawMapCanvas(canvas, route, bounds, popover) {
    if (!canvas || !canvas.getContext) return;
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = Math.round(rect.width);
    var h = Math.round(rect.height || 180);
    if (w < 40) {
      window.setTimeout(function() { drawMapCanvas(canvas, route, bounds, popover); }, 50);
      return;
    }
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var map = normalizeMapConfig(state.poekhaliMap);
    var rules = getMergedRouteSpeedRules(route.id);
    var objects = map.objects.filter(function(item) { return item.routeId === route.id; });
    var stations = Array.isArray(route && route.stations) ? route.stations : [];

    var toX = function(c) {
      var ratio = (c - bounds.min) / Math.max(1, bounds.max - bounds.min);
      return ratio * w;
    };
    var fromX = function(x) {
      return bounds.min + (x / Math.max(1, w)) * (bounds.max - bounds.min);
    };

    var topScaleY = 14;
    var bandTop = 30;
    var bandBottom = 80;
    var bandHeight = bandBottom - bandTop;
    var trackY = 108;
    var stationLabelY = 132;
    var bottomScaleY = h - 6;

    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (var gi = 0; gi <= 6; gi += 1) {
      var gx = (w / 6) * gi;
      ctx.beginPath();
      ctx.moveTo(gx, topScaleY + 2);
      ctx.lineTo(gx, bottomScaleY - 10);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(154,164,178,0.7)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    for (var ti = 0; ti <= 6; ti += 1) {
      var tc = bounds.min + ((bounds.max - bounds.min) / 6) * ti;
      var tx = toX(tc);
      var label = formatCoordinate(tc);
      var clamped = Math.max(28, Math.min(w - 28, tx));
      ctx.fillText(label, clamped, topScaleY);
      ctx.fillText(label, clamped, bottomScaleY);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, trackY - 1, w, 2);

    var scene = { bands: [], handleWidth: 10 };

    var visibleRules = rules.filter(function(rule) {
      return getRuleEnd(rule) >= bounds.min && getRuleStart(rule) <= bounds.max;
    });

    visibleRules.forEach(function(rule) {
      var rs = getRuleStart(rule);
      var re = getRuleEnd(rule);
      var x1 = toX(Math.max(rs, bounds.min));
      var x2 = toX(Math.min(re, bounds.max));
      if (x2 - x1 < 1) x2 = x1 + 1;
      var speed = Math.max(1, Math.round(Number(rule.speed) || 60));
      var tone = speed <= 40 ? 'danger' : speed <= 60 ? 'warning' : 'success';
      var selected = popover.kind === 'speed' && popover.id === rule.id;
      var fill = tone === 'danger' ? 'rgba(255,107,107,0.78)' : tone === 'warning' ? 'rgba(246,198,91,0.78)' : 'rgba(97,211,148,0.78)';
      var border = tone === 'danger' ? 'rgba(255,107,107,1)' : tone === 'warning' ? 'rgba(246,198,91,1)' : 'rgba(97,211,148,1)';
      ctx.fillStyle = fill;
      ctx.fillRect(x1, bandTop, x2 - x1, bandHeight);
      ctx.strokeStyle = border;
      ctx.lineWidth = selected ? 2.5 : 1;
      ctx.strokeRect(x1 + 0.5, bandTop + 0.5, x2 - x1 - 1, bandHeight - 1);

      var handleW = Math.min(8, Math.max(4, (x2 - x1) * 0.18));
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(x1, bandTop, handleW, bandHeight);
      ctx.fillRect(x2 - handleW, bandTop, handleW, bandHeight);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (var hi = 0; hi < 3; hi += 1) {
        ctx.fillRect(x1 + handleW / 2 - 0.5, bandTop + 12 + hi * 8, 1, 4);
        ctx.fillRect(x2 - handleW / 2 - 0.5, bandTop + 12 + hi * 8, 1, 4);
      }

      if (selected) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,255,255,0.45)';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1 + 1, bandTop + 1, x2 - x1 - 2, bandHeight - 2);
        ctx.restore();
      }

      ctx.fillStyle = '#0c0f12';
      ctx.font = '900 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(speed + '', (x1 + x2) / 2, bandTop + bandHeight / 2 + 5);

      scene.bands.push({
        id: rule.id,
        x1: x1, x2: x2,
        y1: bandTop, y2: bandBottom,
        handleW: handleW,
        speed: speed,
        baseRuleId: rule.baseId || null,
      });
    });

    stations.forEach(function(station) {
      var coord = Number(station.meter || station.coordinate) || 0;
      if (coord < bounds.min || coord > bounds.max) return;
      var sx = toX(coord);
      ctx.fillStyle = 'rgba(122,183,255,0.85)';
      ctx.fillRect(Math.round(sx) - 0.5, trackY - 12, 2, 24);
      ctx.fillStyle = '#d8ebff';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      var name = String(station.name || '');
      if (name.length > 12) name = name.slice(0, 11) + '…';
      var nx = Math.max(28, Math.min(w - 28, sx));
      ctx.fillText(name, nx, stationLabelY);
    });

    objects.forEach(function(obj) {
      var coord = Number(obj.coordinate) || 0;
      if (coord < bounds.min || coord > bounds.max) return;
      var ox = toX(coord);
      var typeStr = String(obj.type);
      var selected = popover.kind === 'object' && popover.id === obj.id;
      if (typeStr === '2') {
        ctx.fillStyle = 'rgba(122,183,255,0.85)';
        ctx.fillRect(Math.round(ox) - 0.5, trackY - 12, 2, 24);
      } else {
        ctx.beginPath();
        ctx.arc(ox, trackY, selected ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = typeStr === '3' ? 'rgba(246,198,91,0.95)' : 'rgba(97,211,148,0.95)';
        ctx.fill();
        if (selected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    });

    state.mapCanvasScene = scene;
  }

  function renderMapTicks(bounds) {
    var html = '';
    var span = Math.max(1, bounds.max - bounds.min);
    var step = span / 6;
    for (var i = 0; i <= 6; i += 1) {
      var coord = bounds.min + step * i;
      var pct = coordinatePercent(coord, bounds);
      html += '<span class="map-tick" style="left:' + pct + '%"><i></i><b>' + escapeHtml(formatCoordinate(coord)) + '</b></span>';
    }
    return html;
  }

  function renderMapSpeedBar(rule, bounds, popover) {
    var start = Math.max(getRuleStart(rule), bounds.min);
    var end = Math.min(getRuleEnd(rule), bounds.max);
    var left = coordinatePercent(start, bounds);
    var right = coordinatePercent(end, bounds);
    var width = Math.max(0.6, right - left);
    var speed = Math.max(1, Math.round(Number(rule.speed) || 60));
    var tone = speed <= 40 ? 'danger' : speed <= 60 ? 'warning' : 'success';
    var selected = popover.kind === 'speed' && popover.id === rule.id;
    return '<button class="map-speed-bar map-speed-bar--' + tone + (selected ? ' is-selected' : '') + '" type="button"' +
      ' style="left:' + left + '%;width:' + width + '%"' +
      ' data-map-bar="speed" data-map-id="' + escapeHtml(rule.id) + '"' +
      ' title="' + escapeHtml((rule.name || 'Скорость') + ' · ' + speed + ' км/ч') + '">' +
      '<span class="map-speed-bar-label">' + speed + '</span>' +
    '</button>';
  }

  function renderMapMarker(item, bounds, popover) {
    var coord = Number(item.coordinate) || 0;
    var kind = String(item.type) === '2' ? 'station' : String(item.type) === '3' ? 'platform' : 'signal';
    var label = kind === 'station' ? 'СТ' : kind === 'platform' ? 'ПЛ' : 'СВ';
    var selected = popover.kind === 'object' && popover.id === item.id;
    return '<button class="map-marker-pin map-marker-pin--' + kind + (selected ? ' is-selected' : '') + '" type="button"' +
      ' style="left:' + coordinatePercent(coord, bounds) + '%"' +
      ' data-map-bar="object" data-map-id="' + escapeHtml(item.id) + '"' +
      ' title="' + escapeHtml(item.name || label) + '">' +
      '<i>' + label + '</i>' +
      '<b>' + escapeHtml(item.name || '') + '</b>' +
    '</button>';
  }

  function renderMapPopover(kind, entity, bounds, routeBounds) {
    if (kind === 'speed') return renderMapSpeedPopover(entity, bounds, routeBounds);
    return renderMapObjectPopover(entity, bounds, routeBounds);
  }

  function popoverAnchor(percent) {
    if (percent < 20) return 'left';
    if (percent > 80) return 'right';
    return 'mid';
  }

  function renderMapSpeedPopover(rule, bounds, routeBounds) {
    var start = getRuleStart(rule);
    var end = getRuleEnd(rule);
    var anchor = coordinatePercent((start + end) / 2, bounds);
    var edge = popoverAnchor(anchor);
    var speed = Math.max(1, Math.round(Number(rule.speed) || 60));
    var tone = speed <= 40 ? 'danger' : speed <= 60 ? 'warning' : 'success';
    var hasOverride = (state.poekhaliMap.speedRules || []).some(function(item) { return item && item.id === rule.id; });
    var isBase = !!rule.baseId || baseMapSpeedRules.some(function(item) { return item.id === rule.id; });
    var footHtml = '';
    if (isBase && hasOverride) {
      footHtml = '<button class="btn" type="button" data-popover-reset>Сбросить к базе</button>';
    } else if (!isBase) {
      footHtml = '<button class="btn-danger" type="button" data-popover-delete>Удалить</button>';
    }
    return '<div class="map-popover map-popover--' + tone + '" data-edge="' + edge + '" style="left:' + anchor + '%">' +
      '<div class="map-popover-head">' +
        '<strong>Скорость · ' + speed + ' км/ч</strong>' +
        '<button class="icon-btn" type="button" data-popover-close>×</button>' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Название</label>' +
        '<input class="input" type="text" data-popover-field="name" value="' + escapeHtml(rule.name || '') + '" />' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Скорость: <strong>' + speed + ' км/ч</strong></label>' +
        '<input type="range" min="5" max="160" step="1" data-popover-field="speed" value="' + speed + '" />' +
      '</div>' +
      '<div class="map-popover-presets">' +
        [25, 40, 60, 70, 80, 100, 120].map(function(value) {
          return '<button class="preset-btn ' + (speed === value ? 'is-active' : '') + '" type="button" data-popover-preset="' + value + '">' + value + '</button>';
        }).join('') +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Начало: <strong>' + escapeHtml(formatCoordinate(start)) + '</strong></label>' +
        '<input type="range" min="' + routeBounds.min + '" max="' + routeBounds.max + '" step="10" data-popover-field="start" value="' + start + '" />' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Конец: <strong>' + escapeHtml(formatCoordinate(end)) + '</strong></label>' +
        '<input type="range" min="' + routeBounds.min + '" max="' + routeBounds.max + '" step="10" data-popover-field="end" value="' + end + '" />' +
      '</div>' +
      (footHtml ? '<div class="map-popover-foot">' + footHtml + '</div>' : '') +
    '</div>';
  }

  function renderMapObjectPopover(item, bounds, routeBounds) {
    var coord = Number(item.coordinate) || 0;
    var anchor = coordinatePercent(coord, bounds);
    var edge = popoverAnchor(anchor);
    var typeCode = String(item.type) === '2' ? '2' : String(item.type) === '3' ? '3' : '1';
    var kindLabel = typeCode === '2' ? 'Станция' : typeCode === '3' ? 'Платформа' : 'Светофор';
    return '<div class="map-popover map-popover--marker" data-edge="' + edge + '" style="left:' + anchor + '%">' +
      '<div class="map-popover-head">' +
        '<strong>' + escapeHtml(kindLabel) + '</strong>' +
        '<button class="icon-btn" type="button" data-popover-close>×</button>' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Тип</label>' +
        '<select class="select" data-popover-field="type">' +
          '<option value="1"' + (typeCode === '1' ? ' selected' : '') + '>Светофор</option>' +
          '<option value="2"' + (typeCode === '2' ? ' selected' : '') + '>Станция</option>' +
          '<option value="3"' + (typeCode === '3' ? ' selected' : '') + '>Платформа</option>' +
        '</select>' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Название</label>' +
        '<input class="input" type="text" data-popover-field="name" value="' + escapeHtml(item.name || '') + '" />' +
      '</div>' +
      '<div class="map-popover-row">' +
        '<label>Координата: <strong>' + escapeHtml(formatCoordinate(coord)) + '</strong></label>' +
        '<input type="range" min="' + routeBounds.min + '" max="' + routeBounds.max + '" step="10" data-popover-field="coordinate" value="' + coord + '" />' +
      '</div>' +
      '<div class="map-popover-foot">' +
        '<button class="btn-danger" type="button" data-popover-delete>Удалить</button>' +
      '</div>' +
    '</div>';
  }

  function renderMapSummary(rules, objects, popover) {
    if (!rules.length && !objects.length) {
      return '<div class="empty">На маршруте пока пусто. Нажми «+ Скорость», «+ Светофор» или «+ Станция».</div>';
    }
    var rows = [];
    rules.forEach(function(rule) {
      var speed = Math.max(1, Math.round(Number(rule.speed) || 60));
      var tone = speed <= 40 ? 'danger' : speed <= 60 ? 'warning' : 'success';
      var selected = popover.kind === 'speed' && popover.id === rule.id;
      rows.push({
        sort: getRuleStart(rule),
        html: '<button class="map-summary-row ' + (selected ? 'is-active' : '') + '" type="button" data-summary-kind="speed" data-summary-id="' + escapeHtml(rule.id) + '">' +
          '<span class="map-summary-badge map-summary-badge--' + tone + '">' + speed + '</span>' +
          '<span class="map-summary-name">' + escapeHtml(rule.name || 'Без названия') + '</span>' +
          '<span class="map-summary-coord">' + escapeHtml(formatCoordinate(getRuleStart(rule)) + ' – ' + formatCoordinate(getRuleEnd(rule))) + '</span>' +
        '</button>',
      });
    });
    objects.forEach(function(item) {
      var typeCode = String(item.type);
      var label = typeCode === '2' ? 'СТ' : typeCode === '3' ? 'ПЛ' : 'СВ';
      var kindClass = typeCode === '2' ? 'station' : typeCode === '3' ? 'platform' : 'signal';
      var selected = popover.kind === 'object' && popover.id === item.id;
      rows.push({
        sort: Number(item.coordinate) || 0,
        html: '<button class="map-summary-row ' + (selected ? 'is-active' : '') + '" type="button" data-summary-kind="object" data-summary-id="' + escapeHtml(item.id) + '">' +
          '<span class="map-summary-badge map-summary-badge--' + kindClass + '">' + label + '</span>' +
          '<span class="map-summary-name">' + escapeHtml(item.name || 'Без названия') + '</span>' +
          '<span class="map-summary-coord">' + escapeHtml(formatCoordinate(Number(item.coordinate) || 0)) + '</span>' +
        '</button>',
      });
    });
    rows.sort(function(a, b) { return a.sort - b.sort; });
    return '<div class="map-summary">' +
      '<div class="map-summary-head"><strong>Всё на маршруте</strong><span>' + rows.length + ' элементов</span></div>' +
      '<div class="map-summary-list">' + rows.map(function(row) { return row.html; }).join('') + '</div>' +
    '</div>';
  }

  function ensureMapOverrideRule(baseRule) {
    var map = normalizeMapConfig(state.poekhaliMap);
    state.poekhaliMap = map;
    var existing = map.speedRules.find(function(rule) { return rule.id === baseRule.id; });
    if (existing) return existing;
    var copy = Object.assign({}, baseRule, {
      coordinate: getRuleStart(baseRule),
      length: Math.max(0, getRuleEnd(baseRule) - getRuleStart(baseRule)),
    });
    map.speedRules.push(copy);
    return copy;
  }

  function bindMapEditorV2(route, bounds, routeBounds) {
    var canvas = $('#mapStageCanvas');
    if (canvas) {
      drawMapCanvas(canvas, route, bounds, state.mapPopover || { kind: null, id: null });
      bindMapCanvasInteractions(canvas, route, bounds, routeBounds);
    }

    var routeSelect = $('#mapRouteSelect');
    if (routeSelect) routeSelect.addEventListener('change', function() {
      state.mapRouteId = routeSelect.value;
      state.mapPopover = { kind: null, id: null };
      state.mapZoom = null;
      renderPoekhaliMap();
    });

    var saveBtn = $('#btnSavePoekhaliMap');
    if (saveBtn) saveBtn.addEventListener('click', savePoekhaliMap);

    var zoomIn = $('#mapZoomIn');
    if (zoomIn) zoomIn.addEventListener('click', function() {
      if (state.mapZoom) state.mapZoom.span = Math.max(200, state.mapZoom.span * 0.55);
      renderPoekhaliMap();
    });
    var zoomOut = $('#mapZoomOut');
    if (zoomOut) zoomOut.addEventListener('click', function() {
      if (state.mapZoom) state.mapZoom.span = state.mapZoom.span * 1.8;
      renderPoekhaliMap();
    });
    var zoomReset = $('#mapZoomReset');
    if (zoomReset) zoomReset.addEventListener('click', function() {
      state.mapZoom = null;
      renderPoekhaliMap();
    });

    $all('[data-map-add]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        addMapEntity(btn.dataset.mapAdd, route, bounds);
      });
    });

    var addRouteBtn = $('#btnAddMapRoute');
    if (addRouteBtn) addRouteBtn.addEventListener('click', function() { addMapRoute(route); });
    var duplicateRouteBtn = $('#btnDuplicateMapRoute');
    if (duplicateRouteBtn) duplicateRouteBtn.addEventListener('click', function() { duplicateMapRoute(route); });
    var deleteRouteBtn = $('#btnDeleteMapRoute');
    if (deleteRouteBtn) deleteRouteBtn.addEventListener('click', function() { deleteMapRoute(route); });

    $all('[data-map-bar]').forEach(function(el) {
      el.addEventListener('click', function(event) {
        if (el.dataset.draggedRecently === '1') {
          el.dataset.draggedRecently = '0';
          return;
        }
        event.stopPropagation();
        toggleMapPopover(el.dataset.mapBar, el.dataset.mapId);
      });
      el.addEventListener('pointerdown', function(event) {
        startMapDrag(el, event, route, bounds, routeBounds);
      });
    });

    var rail = $('#mapStageRail');
    if (rail) rail.addEventListener('click', function(event) {
      if (event.target.closest && event.target.closest('[data-map-bar]')) return;
      if (state.mapPopover && state.mapPopover.id) {
        state.mapPopover = { kind: null, id: null };
        renderPoekhaliMap();
      }
    });

    $all('[data-popover-field]').forEach(function(input) {
      var update = function() { updatePopoverField(input, route); };
      input.addEventListener('input', update);
      input.addEventListener('change', function() {
        update();
        renderPoekhaliMap();
      });
    });
    $all('[data-popover-preset]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        applyPopoverSpeedPreset(Number(btn.dataset.popoverPreset), route);
      });
    });
    var closeBtn = $('[data-popover-close]');
    if (closeBtn) closeBtn.addEventListener('click', function() {
      state.mapPopover = { kind: null, id: null };
      renderPoekhaliMap();
    });
    var resetBtn = $('[data-popover-reset]');
    if (resetBtn) resetBtn.addEventListener('click', resetCurrentMapEntity);
    var deleteBtn = $('[data-popover-delete]');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteCurrentMapEntity);

    $all('[data-summary-id]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var kind = btn.dataset.summaryKind;
        var id = btn.dataset.summaryId;
        state.mapPopover = { kind: kind, id: id };
        centerMapViewOn(kind, id, route);
        renderPoekhaliMap();
      });
    });
  }

  function toggleMapPopover(kind, id) {
    var key = kind === 'object' ? 'object' : 'speed';
    var current = state.mapPopover || {};
    if (current.kind === key && current.id === id) {
      state.mapPopover = { kind: null, id: null };
    } else {
      state.mapPopover = { kind: key, id: id };
    }
    renderPoekhaliMap();
  }

  function addMapEntity(kind, route, bounds) {
    var map = normalizeMapConfig(state.poekhaliMap);
    state.poekhaliMap = map;
    var center = Math.round((bounds.min + bounds.max) / 2);
    if (kind === 'speed') {
      var span = Math.max(500, Math.round((bounds.max - bounds.min) / 12));
      var start = Math.max(0, center - Math.round(span / 2));
      var end = center + Math.round(span / 2);
      var rule = {
        id: createAdminId('speed'),
        routeId: route.id,
        sector: route.sector,
        coordinate: start,
        start: start,
        end: end,
        length: end - start,
        speed: 60,
        wayNumber: 0,
        name: 'Новая скорость',
      };
      map.speedRules.push(rule);
      state.mapPopover = { kind: 'speed', id: rule.id };
    } else {
      var typeCode = kind === 'station' ? '2' : kind === 'platform' ? '3' : '1';
      var defaultName = kind === 'station' ? 'Новая станция' : kind === 'platform' ? 'Новая платформа' : 'Новый светофор';
      var obj = {
        id: createAdminId(kind),
        routeId: route.id,
        sector: route.sector,
        type: typeCode,
        coordinate: center,
        length: 0,
        end: center,
        name: defaultName,
      };
      map.objects.push(obj);
      state.mapPopover = { kind: 'object', id: obj.id };
    }
    renderPoekhaliMap();
  }

  function bindMapCanvasInteractions(canvas, route, bounds, routeBounds) {
    canvas.addEventListener('pointerdown', function(event) {
      if (event.button !== undefined && event.button !== 0) return;
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      var scene = state.mapCanvasScene || { bands: [] };
      var inBandRow = y >= 28 && y <= 84;
      var hit = null;
      var mode = null;
      for (var i = 0; i < scene.bands.length; i += 1) {
        var b = scene.bands[i];
        if (x >= b.x1 - 2 && x <= b.x2 + 2 && y >= b.y1 - 2 && y <= b.y2 + 2) {
          if (x <= b.x1 + b.handleW) mode = 'resize-start';
          else if (x >= b.x2 - b.handleW) mode = 'resize-end';
          else mode = 'move';
          hit = b;
          break;
        }
      }
      if (!hit) {
        if (inBandRow) {
          var coord = Math.round(bounds.min + (x / Math.max(1, rect.width)) * (bounds.max - bounds.min));
          addMapSpeedAtCoord(coord, route, bounds);
        }
        return;
      }
      event.preventDefault();
      startMapCanvasDrag(canvas, event, hit, mode, route, bounds, routeBounds);
    });
  }

  function addMapSpeedAtCoord(coord, route, bounds) {
    var map = normalizeMapConfig(state.poekhaliMap);
    state.poekhaliMap = map;
    var span = Math.max(500, Math.round((bounds.max - bounds.min) / 18));
    var start = Math.max(0, coord - Math.round(span / 2));
    var end = coord + Math.round(span / 2);
    var rule = {
      id: createAdminId('speed'),
      routeId: route.id,
      sector: route.sector,
      coordinate: start,
      start: start,
      end: end,
      length: end - start,
      speed: 60,
      wayNumber: 0,
      name: 'Новая скорость',
    };
    map.speedRules.push(rule);
    state.mapPopover = { kind: 'speed', id: rule.id };
    renderPoekhaliMap();
  }

  function startMapCanvasDrag(canvas, downEvent, hit, mode, route, bounds, routeBounds) {
    var rect = canvas.getBoundingClientRect();
    var pointerId = downEvent.pointerId;
    var moved = false;
    var initialX = downEvent.clientX;

    var rules = getMergedRouteSpeedRules(route.id);
    var base = rules.find(function(r) { return r.id === hit.id; });
    if (!base) return;
    var entity = ensureMapOverrideRule(base);
    var initial = { start: getRuleStart(entity), end: getRuleEnd(entity) };

    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(pointerId); } catch (_) {}
    }
    canvas.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize';

    function onMove(event) {
      var dx = event.clientX - initialX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      var ratio = dx / Math.max(1, rect.width);
      var deltaCoord = Math.round(ratio * (bounds.max - bounds.min));
      if (mode === 'move') {
        var ns = initial.start + deltaCoord;
        var ne = initial.end + deltaCoord;
        if (ns < routeBounds.min) { ne += routeBounds.min - ns; ns = routeBounds.min; }
        if (ne > routeBounds.max) { ns -= ne - routeBounds.max; ne = routeBounds.max; }
        entity.start = ns;
        entity.end = ne;
      } else if (mode === 'resize-start') {
        var newStart = Math.max(routeBounds.min, Math.min(initial.end - 50, initial.start + deltaCoord));
        entity.start = newStart;
        entity.end = initial.end;
      } else if (mode === 'resize-end') {
        var newEnd = Math.min(routeBounds.max, Math.max(initial.start + 50, initial.end + deltaCoord));
        entity.start = initial.start;
        entity.end = newEnd;
      }
      entity.coordinate = Math.min(Number(entity.start) || 0, Number(entity.end) || 0);
      entity.length = Math.max(0, Math.abs(Number(entity.end) - Number(entity.start)));
      drawMapCanvas(canvas, route, bounds, state.mapPopover || { kind: null, id: null });
    }

    function finish() {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('pointercancel', finish);
      if (canvas.releasePointerCapture) {
        try { canvas.releasePointerCapture(pointerId); } catch (_) {}
      }
      canvas.style.cursor = '';
      if (moved) {
        renderPoekhaliMap();
      } else {
        state.mapPopover = { kind: 'speed', id: hit.id };
        renderPoekhaliMap();
      }
    }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  }

  function startMapDrag(el, downEvent, route, bounds, routeBounds) {
    if (downEvent.button !== undefined && downEvent.button !== 0) return;
    var rail = $('#mapStageRail');
    if (!rail) return;
    var rect = rail.getBoundingClientRect();
    var kind = el.dataset.mapBar;
    var id = el.dataset.mapId;
    var pointerId = downEvent.pointerId;
    var moved = false;
    var initialX = downEvent.clientX;

    var entity;
    var initial = {};
    if (kind === 'speed') {
      var rules = getMergedRouteSpeedRules(route.id);
      var base = rules.find(function(rule) { return rule.id === id; });
      if (!base) return;
      entity = ensureMapOverrideRule(base);
      initial.start = getRuleStart(entity);
      initial.end = getRuleEnd(entity);
    } else {
      var map = normalizeMapConfig(state.poekhaliMap);
      state.poekhaliMap = map;
      entity = map.objects.find(function(obj) { return obj.id === id; });
      if (!entity) return;
      initial.coordinate = Number(entity.coordinate) || 0;
      initial.length = Number(entity.length) || 0;
    }

    if (el.setPointerCapture) {
      try { el.setPointerCapture(pointerId); } catch (_) {}
    }
    el.classList.add('is-dragging');

    function onMove(event) {
      var dx = event.clientX - initialX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      var ratio = dx / Math.max(1, rect.width);
      var deltaCoord = Math.round(ratio * (bounds.max - bounds.min));
      if (kind === 'speed') {
        var newStart = initial.start + deltaCoord;
        var newEnd = initial.end + deltaCoord;
        if (newStart < routeBounds.min) {
          newEnd += routeBounds.min - newStart;
          newStart = routeBounds.min;
        }
        if (newEnd > routeBounds.max) {
          newStart -= newEnd - routeBounds.max;
          newEnd = routeBounds.max;
        }
        entity.start = newStart;
        entity.end = newEnd;
        entity.coordinate = Math.min(newStart, newEnd);
        entity.length = Math.max(0, Math.abs(newEnd - newStart));
        var leftPct = coordinatePercent(Math.max(newStart, bounds.min), bounds);
        var rightPct = coordinatePercent(Math.min(newEnd, bounds.max), bounds);
        el.style.left = leftPct + '%';
        el.style.width = Math.max(0.6, rightPct - leftPct) + '%';
      } else {
        var newCoord = Math.max(routeBounds.min, Math.min(routeBounds.max, initial.coordinate + deltaCoord));
        entity.coordinate = newCoord;
        entity.end = newCoord + initial.length;
        el.style.left = coordinatePercent(newCoord, bounds) + '%';
      }
    }

    function finish() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', finish);
      el.removeEventListener('pointercancel', finish);
      if (el.releasePointerCapture) {
        try { el.releasePointerCapture(pointerId); } catch (_) {}
      }
      el.classList.remove('is-dragging');
      if (moved) {
        el.dataset.draggedRecently = '1';
        renderPoekhaliMap();
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }

  function updatePopoverField(input, route) {
    var pop = state.mapPopover || {};
    if (!pop.id) return;
    var map = normalizeMapConfig(state.poekhaliMap);
    state.poekhaliMap = map;
    var field = input.dataset.popoverField;
    var rawValue = input.type === 'number' || input.type === 'range' ? Number(input.value || 0) : input.value;

    if (pop.kind === 'speed') {
      var rules = getMergedRouteSpeedRules(route.id);
      var base = rules.find(function(rule) { return rule.id === pop.id; });
      if (!base) return;
      var entity = ensureMapOverrideRule(base);
      entity[field] = rawValue;
      if (field === 'start' && Number(entity.start) > Number(entity.end)) entity.end = entity.start;
      if (field === 'end' && Number(entity.end) < Number(entity.start)) entity.start = entity.end;
      entity.coordinate = Math.min(Number(entity.start) || 0, Number(entity.end) || 0);
      entity.length = Math.max(0, Math.abs(Number(entity.end) - Number(entity.start)));
    } else {
      var obj = map.objects.find(function(item) { return item.id === pop.id; });
      if (!obj) return;
      obj[field] = rawValue;
      if (field === 'coordinate') obj.end = Number(obj.coordinate) + (Number(obj.length) || 0);
    }
  }

  function applyPopoverSpeedPreset(value, route) {
    var pop = state.mapPopover;
    if (!pop || pop.kind !== 'speed' || !pop.id) return;
    var rules = getMergedRouteSpeedRules(route.id);
    var base = rules.find(function(rule) { return rule.id === pop.id; });
    if (!base) return;
    var entity = ensureMapOverrideRule(base);
    entity.speed = value;
    renderPoekhaliMap();
  }

  function resetCurrentMapEntity() {
    var pop = state.mapPopover;
    if (!pop || pop.kind !== 'speed' || !pop.id) return;
    var map = normalizeMapConfig(state.poekhaliMap);
    map.speedRules = map.speedRules.filter(function(rule) { return rule.id !== pop.id; });
    state.poekhaliMap = map;
    renderPoekhaliMap();
  }

  function deleteCurrentMapEntity() {
    var pop = state.mapPopover;
    if (!pop || !pop.id) return;
    var map = normalizeMapConfig(state.poekhaliMap);
    if (pop.kind === 'speed') {
      map.speedRules = map.speedRules.filter(function(rule) { return rule.id !== pop.id; });
    } else {
      map.objects = map.objects.filter(function(obj) { return obj.id !== pop.id; });
    }
    state.poekhaliMap = map;
    state.mapPopover = { kind: null, id: null };
    renderPoekhaliMap();
  }

  function centerMapViewOn(kind, id, route) {
    var map = normalizeMapConfig(state.poekhaliMap);
    var center;
    if (kind === 'speed') {
      var rule = getMergedRouteSpeedRules(route.id).find(function(item) { return item.id === id; });
      if (!rule) return;
      center = (getRuleStart(rule) + getRuleEnd(rule)) / 2;
    } else {
      var obj = map.objects.find(function(item) { return item.id === id; });
      if (!obj) return;
      center = Number(obj.coordinate) || 0;
    }
    if (state.mapZoom) state.mapZoom.center = center;
  }

  function addMapRoute(currentRoute) {
    var map = normalizeMapConfig(state.poekhaliMap);
    state.poekhaliMap = map;
    var base = currentRoute || map.routes[0] || { sector: 18, start: 0, end: 1000 };
    var start = Math.max(0, Number(base.end || base.start || 0));
    var end = start + Math.max(1000, Math.round(Math.abs(Number(base.end || 0) - Number(base.start || 0)) / 2 || 5000));
    var newRoute = { id: createAdminId('route'), title: 'Новый маршрут', sector: Number(base.sector) || 18, start: start, end: end, kind: 'route' };
    map.routes.push(newRoute);
    state.mapRouteId = newRoute.id;
    state.mapZoom = null;
    state.mapPopover = { kind: null, id: null };
    renderPoekhaliMap();
  }

  function duplicateMapRoute(route) {
    if (!route) return;
    var map = normalizeMapConfig(state.poekhaliMap);
    state.poekhaliMap = map;
    var copy = Object.assign({}, route, { id: createAdminId('route'), title: (route.title || 'Маршрут') + ' копия' });
    map.routes.push(copy);
    state.mapRouteId = copy.id;
    state.mapZoom = null;
    state.mapPopover = { kind: null, id: null };
    renderPoekhaliMap();
  }

  function deleteMapRoute(route) {
    if (!route) return;
    var map = normalizeMapConfig(state.poekhaliMap);
    var userRoutes = map.routes.filter(function(item) { return item.id !== route.id; });
    if (getAllMapRoutes().length <= 1 && !userRoutes.length) return;
    map.routes = userRoutes;
    map.speedRules = map.speedRules.filter(function(item) { return item.routeId !== route.id; });
    map.objects = map.objects.filter(function(item) { return item.routeId !== route.id; });
    state.poekhaliMap = map;
    var remaining = getAllMapRoutes();
    state.mapRouteId = remaining[0] ? remaining[0].id : '';
    state.mapZoom = null;
    state.mapPopover = { kind: null, id: null };
    renderPoekhaliMap();
  }

  function savePoekhaliMap() {
    request('poekhaliMap', { method: 'PUT', body: { map: state.poekhaliMap } })
      .then(function(body) {
        state.poekhaliMap = normalizeMapConfig(body.map);
        setStatus('Карта Поехали сохранена', 'ok');
        renderPoekhaliMap();
      })
      .catch(showError);
  }

  function renderDocuments() {
    var panel = els.documents;
    var manifest = state.docsManifest || {};
    var categories = getDocCategories(manifest);
    if (!categories.includes(state.docsCategory)) state.docsCategory = categories[0] || 'speeds';
    panel.innerHTML =
      '<div class="toolbar"><div class="toolbar-left"><div class="tabs">' + categories.map(function(category) {
        return '<button class="tab ' + (category === state.docsCategory ? 'is-active' : '') + '" data-doc-category="' + category + '" type="button">' + escapeHtml(docCategoryLabels[category] || category) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="toolbar-right"><button class="btn-primary" id="btnSaveDocs" type="button">Сохранить</button></div></div>' +
      '<details class="admin-quiet-details admin-secondary-tools"><summary>Разделы</summary><div class="doc-category-builder">' +
        '<div class="doc-category-presets">' + docCategoryPresets.map(function(item) {
          return '<button class="preset-btn ' + (categories.includes(item.key) ? 'is-muted' : '') + '" type="button" data-doc-preset="' + escapeHtml(item.key) + '"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.note) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="builder-inline"><input class="input" id="newDocCategoryName" placeholder="Название нового раздела" /><button class="btn" id="btnAddDocCategory" type="button">Создать раздел</button></div>' +
      '</div></details>' +
      '<div class="docs-workbench">' +
        '<div class="doc-dropzone" id="docDropZone">' +
          '<input id="docFileInput" type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" hidden />' +
          '<div class="doc-drop-icon">+</div>' +
          '<div><strong>Загрузить файлы</strong><span>Перетащи сюда или нажми</span></div>' +
        '</div>' +
        '<div class="card"><div class="toolbar"><div><div class="card-title">' + escapeHtml(docCategoryLabels[state.docsCategory] || state.docsCategory || 'Документы') +
        '</div><div class="muted">' + (((manifest[state.docsCategory] || []).length) || 0) + ' файлов</div></div>' +
        '<button class="btn" id="btnAddDoc" type="button">Добавить строку</button></div><div class="editor-list doc-card-list" id="docsList"></div></div>' +
      '</div>';
    $all('[data-doc-category]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.docsCategory = btn.dataset.docCategory;
        renderDocuments();
      });
    });
    $('#btnAddDocCategory').addEventListener('click', function() {
      var name = $('#newDocCategoryName').value;
      if (!name) return;
      var safe = normalizePlainKey(name, '');
      if (!safe) return;
      docCategoryLabels[safe] = name.trim();
      if (!state.docsManifest[safe]) state.docsManifest[safe] = [];
      state.docsCategory = safe;
      renderDocuments();
    });
    $all('[data-doc-preset]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.dataset.docPreset;
        if (!state.docsManifest[key]) state.docsManifest[key] = [];
        state.docsCategory = key;
        renderDocuments();
      });
    });
    $('#btnAddDoc').addEventListener('click', function() {
      if (!state.docsManifest[state.docsCategory]) state.docsManifest[state.docsCategory] = [];
      state.docsManifest[state.docsCategory].push({ name: 'Новый документ', caption: '', path: '/assets/docs/', mime_type: 'application/pdf', size: 0, updated_at: new Date().toISOString().slice(0, 10) });
      renderDocuments();
    });
    $('#btnSaveDocs').addEventListener('click', saveDocs);
    bindDocDropzone();
    renderDocRows();
  }

  function getDocCategories(manifest) {
    var known = ['speeds', 'folders', 'instructions', 'memos', 'reminders'];
    var result = known.filter(function(category) { return Object.prototype.hasOwnProperty.call(manifest || {}, category); });
    Object.keys(manifest || {}).forEach(function(category) {
      if (!result.includes(category)) result.push(category);
    });
    return result.length ? result : known;
  }

  function renderDocRows() {
    var list = $('#docsList');
    var rows = (state.docsManifest && state.docsManifest[state.docsCategory]) || [];
    if (!rows.length) {
      list.innerHTML = '<div class="empty">В категории нет документов. Перетащи файл в зону сверху или нажми «Добавить строку».</div>';
      return;
    }
    list.innerHTML = rows.map(function(doc, index) {
      var typeKind = getDocTypeLabel(doc);
      var isImage = typeKind === 'IMG';
      var sizeLabel = doc.size ? formatBytes(doc.size) : '';
      var dateLabel = doc.updated_at || '';
      var pathLabel = doc.path || 'файл ещё не загружен';
      return '<div class="doc-row-v2 doc-row-v2--' + typeKind.toLowerCase() + '" data-doc-card="' + index + '" draggable="true">' +
        '<div class="doc-row-preview">' +
          (isImage && doc.path
            ? '<img src="' + escapeHtml(doc.path) + '" alt="" loading="lazy" />'
            : '<b>' + escapeHtml(typeKind) + '</b>') +
        '</div>' +
        '<div class="doc-row-main">' +
          '<input class="input doc-row-name" data-doc-field="name" data-index="' + index + '" value="' + escapeHtml(doc.name || '') + '" placeholder="Название документа" />' +
          '<input class="input doc-row-caption" data-doc-field="caption" data-index="' + index + '" value="' + escapeHtml(doc.caption || '') + '" placeholder="Подпись (короткое пояснение)" />' +
          '<div class="doc-row-meta">' +
            '<span class="doc-row-path" title="' + escapeHtml(pathLabel) + '">' + escapeHtml(pathLabel) + '</span>' +
            (sizeLabel ? '<span>' + escapeHtml(sizeLabel) + '</span>' : '') +
            (dateLabel ? '<span>' + escapeHtml(dateLabel) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="doc-row-actions">' +
          '<input type="file" class="doc-row-replace-input" data-replace-index="' + index + '" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" hidden />' +
          '<button class="btn doc-row-replace-btn" data-replace-btn="' + index + '" type="button" title="Заменить файл">Заменить</button>' +
          '<button class="icon-btn" data-delete-doc="' + index + '" type="button" title="Удалить">×</button>' +
        '</div>' +
      '</div>';
    }).join('');
    $all('[data-doc-field]', list).forEach(function(input) {
      input.addEventListener('input', function() {
        var doc = state.docsManifest[state.docsCategory][Number(input.dataset.index)];
        doc[input.dataset.docField] = input.type === 'number' ? Number(input.value || 0) : input.value;
      });
    });
    $all('[data-delete-doc]', list).forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.docsManifest[state.docsCategory].splice(Number(btn.dataset.deleteDoc), 1);
        renderDocuments();
      });
    });
    $all('[data-replace-btn]', list).forEach(function(btn) {
      btn.addEventListener('click', function() {
        var index = Number(btn.dataset.replaceBtn);
        var input = list.querySelector('[data-replace-index="' + index + '"]');
        if (input) input.click();
      });
    });
    $all('[data-replace-index]', list).forEach(function(input) {
      input.addEventListener('change', function() {
        var index = Number(input.dataset.replaceIndex);
        var file = input.files && input.files[0];
        input.value = '';
        if (file) replaceDocFile(index, file);
      });
    });
    $all('[data-doc-card]', list).forEach(function(card) {
      card.addEventListener('dragover', function(event) {
        if (event.dataTransfer && event.dataTransfer.types && Array.prototype.indexOf.call(event.dataTransfer.types, 'Files') !== -1) {
          event.preventDefault();
          event.stopPropagation();
          card.classList.add('is-replace-target');
          event.dataTransfer.dropEffect = 'copy';
        }
      });
      card.addEventListener('dragleave', function(event) {
        if (!card.contains(event.relatedTarget)) card.classList.remove('is-replace-target');
      });
      card.addEventListener('drop', function(event) {
        if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) return;
        event.preventDefault();
        event.stopPropagation();
        card.classList.remove('is-replace-target');
        var file = event.dataTransfer.files[0];
        var index = Number(card.dataset.docCard);
        replaceDocFile(index, file);
      });
    });
    bindReorderCards(list, '[data-doc-card]', function(from, to) {
      moveArrayItem(state.docsManifest[state.docsCategory], from, to);
      renderDocuments();
    });
  }

  function replaceDocFile(index, file) {
    var docs = state.docsManifest && state.docsManifest[state.docsCategory];
    if (!docs || !docs[index]) return;
    var oldDoc = docs[index];
    var beforeCount = docs.length;
    setStatus('Заменяю файл «' + (oldDoc.name || 'документ') + '»...');
    return uploadDocFile(file).then(function() {
      var list = state.docsManifest[state.docsCategory];
      if (!list || list.length <= beforeCount) {
        setStatus('Файл загружен, но manifest не содержит новой записи', 'error');
        renderDocuments();
        return;
      }
      var newEntry = list[list.length - 1];
      oldDoc.path = newEntry.path;
      oldDoc.mime_type = newEntry.mime_type;
      oldDoc.size = newEntry.size;
      oldDoc.updated_at = newEntry.updated_at;
      list.splice(list.length - 1, 1);
      saveDocs();
    }).catch(showError);
  }

  function getDocTypeLabel(doc) {
    var mime = String(doc && doc.mime_type || '').toLowerCase();
    var path = String(doc && doc.path || '').toLowerCase();
    if (mime.indexOf('pdf') !== -1 || path.endsWith('.pdf')) return 'PDF';
    if (mime.indexOf('image') !== -1 || /\.(jpg|jpeg|png|webp|gif)$/.test(path)) return 'IMG';
    if (mime.indexOf('word') !== -1 || /\.(doc|docx)$/.test(path)) return 'DOC';
    if (mime.indexOf('text') !== -1 || path.endsWith('.txt')) return 'TXT';
    return 'FILE';
  }

  function bindDocDropzone() {
    var dropzone = $('#docDropZone');
    var input = $('#docFileInput');
    if (!dropzone || !input) return;
    dropzone.addEventListener('click', function() { input.click(); });
    input.addEventListener('change', function() {
      uploadDocFiles(input.files);
      input.value = '';
    });
    ['dragenter', 'dragover'].forEach(function(type) {
      dropzone.addEventListener(type, function(event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function(type) {
      dropzone.addEventListener(type, function(event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', function(event) {
      uploadDocFiles(event.dataTransfer && event.dataTransfer.files);
    });
  }

  function uploadDocFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (!state.docsManifest[state.docsCategory]) state.docsManifest[state.docsCategory] = [];
    setStatus('Загружаю файлов: ' + files.length + '...');
    files.reduce(function(chain, file, index) {
      return chain.then(function() {
        setStatus('Загружаю ' + (index + 1) + ' из ' + files.length + ': ' + file.name);
        return uploadDocFile(file);
      });
    }, Promise.resolve()).then(function() {
      setStatus('Файлы загружены. Проверь названия и подписи.', 'ok');
      renderDocuments();
    }).catch(showError);
  }

  function uploadDocFile(file) {
    return readFileAsDataUrl(file).then(function(dataUrl) {
      var name = String(file.name || 'Документ').replace(/\.[^.]+$/, '').trim();
      return request('uploadDoc', {
        method: 'POST',
        body: {
          category: state.docsCategory,
          name: name,
          caption: '',
          fileName: file.name,
          mimeType: file.type || '',
          base64: dataUrl,
        },
      }).then(function(body) {
        state.docsManifest = body.manifest || state.docsManifest;
        state.docsCategory = body.category || state.docsCategory;
      });
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(String(reader.result || '')); };
      reader.onerror = function() { reject(new Error('Не удалось прочитать файл')); };
      reader.readAsDataURL(file);
    });
  }

  function saveDocs() {
    setStatus('Сохраняю документы...');
    request('docsManifest', { method: 'PUT', body: { manifest: state.docsManifest } })
      .then(function(body) {
        state.docsManifest = body.manifest;
        setStatus('Документы сохранены', 'ok');
        renderDocuments();
      })
      .catch(showError);
  }

  function renderFunctions() {
    var panel = els.functions;
    var config = state.adminConfig || { features: [], calculationVariants: [], notes: '' };
    panel.innerHTML =
      '<div class="friendly-note"><strong>Визуальный конструктор идей:</strong> собирай будущие функции карточками. Это безопасный черновик: пользователи ничего не увидят, пока функцию отдельно не подключат.</div>' +
      '<div class="builder-steps builder-steps--compact">' +
        '<div><b>1</b><span>Создай карточку</span></div>' +
        '<div><b>2</b><span>Выбери статус</span></div>' +
        '<div><b>3</b><span>Сохрани план</span></div>' +
      '</div>' +
      '<div class="toolbar"><div class="muted">Готовые карточки помогают описывать задачу без технических слов.</div>' +
      '<button class="btn-primary" id="btnSaveConfig" type="button">Сохранить идеи</button></div>' +
      '<div class="grid grid-2">' +
        '<div class="card"><div class="toolbar"><div><div class="card-title">Будущие функции</div><div class="muted">Что хочется добавить в приложение</div></div><button class="btn" id="btnAddFeature" type="button">Добавить</button></div><div class="quick-preset-row">' +
          featurePresets.map(function(item, index) { return '<button class="preset-btn" type="button" data-feature-preset="' + index + '">' + escapeHtml(item.title) + '</button>'; }).join('') +
          '</div><div id="featureList" class="editor-list"></div></div>' +
        '<div class="card"><div class="toolbar"><div><div class="card-title">Варианты расчёта</div><div class="muted">Идеи по зарплате, нормам и формулам</div></div><button class="btn" id="btnAddCalc" type="button">Добавить</button></div><div class="quick-preset-row">' +
          calculationPresets.map(function(item, index) { return '<button class="preset-btn" type="button" data-calc-preset="' + index + '">' + escapeHtml(item.title) + '</button>'; }).join('') +
          '</div><div id="calcList" class="editor-list"></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:12px"><div class="field"><label>Заметки администратора</label><textarea class="textarea" id="configNotes">' + escapeHtml(config.notes || '') + '</textarea></div></div>';
    $('#btnAddFeature').addEventListener('click', function() {
      config.features.push({ id: createAdminId('feature'), title: 'Новая функция', status: 'draft', enabled: false, description: '' });
      renderFunctions();
    });
    $('#btnAddCalc').addEventListener('click', function() {
      config.calculationVariants.push({ id: createAdminId('calc'), title: 'Новый вариант расчёта', status: 'draft', enabled: false, description: '' });
      renderFunctions();
    });
    $all('[data-feature-preset]', panel).forEach(function(btn) {
      btn.addEventListener('click', function() {
        var preset = featurePresets[Number(btn.dataset.featurePreset)];
        config.features.push({ id: createAdminId('feature'), title: preset.title, status: 'draft', enabled: false, description: preset.description });
        renderFunctions();
      });
    });
    $all('[data-calc-preset]', panel).forEach(function(btn) {
      btn.addEventListener('click', function() {
        var preset = calculationPresets[Number(btn.dataset.calcPreset)];
        config.calculationVariants.push({ id: createAdminId('calc'), title: preset.title, status: 'draft', enabled: false, description: preset.description });
        renderFunctions();
      });
    });
    $('#btnSaveConfig').addEventListener('click', saveConfig);
    $('#configNotes').addEventListener('input', function(event) {
      config.notes = event.target.value;
    });
    renderConfigList('featureList', config.features, 'features');
    renderConfigList('calcList', config.calculationVariants, 'calculationVariants');
  }

  function renderConfigList(slotId, rows, key) {
    var slot = $('#' + slotId);
    if (!rows.length) {
      slot.innerHTML = '<div class="empty">Записей нет.</div>';
      return;
    }
    slot.innerHTML = rows.map(function(row, index) {
      var status = row.status || 'draft';
      return '<div class="row-card config-card"><div class="row-card-head"><strong>' + escapeHtml(row.title || row.id) +
        '</strong><button class="icon-btn" data-config-delete="' + key + ':' + index + '" type="button">×</button></div>' +
        '<div class="status-picker">' +
          ['draft','ready','later'].map(function(value) {
            var labels = { draft: 'Черновик', ready: 'Готово', later: 'Потом' };
            return '<button class="status-chip ' + (status === value ? 'is-active' : '') + '" type="button" data-config-status="' + value + '" data-list="' + key + '" data-index="' + index + '">' + labels[value] + '</button>';
          }).join('') +
          '<button class="status-chip ' + (row.enabled ? 'is-active' : '') + '" type="button" data-config-toggle="' + key + ':' + index + '">' + (row.enabled ? 'Включено' : 'Выключено') + '</button>' +
        '</div>' +
        '<div class="form-grid">' +
          configField('Название', 'title', row.title, key, index) +
          '<div class="field wide"><label>Что должно получиться</label><textarea class="input" data-config-field="description" data-list="' + key + '" data-index="' + index + '">' + escapeHtml(row.description || '') + '</textarea></div>' +
        '</div></div>';
    }).join('');
    $all('[data-config-field]').forEach(function(input) {
      input.addEventListener('input', updateConfigInput);
      input.addEventListener('change', updateConfigInput);
    });
    $all('[data-config-status]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.adminConfig[btn.dataset.list][Number(btn.dataset.index)].status = btn.dataset.configStatus;
        renderFunctions();
      });
    });
    $all('[data-config-toggle]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var parts = btn.dataset.configToggle.split(':');
        var row = state.adminConfig[parts[0]][Number(parts[1])];
        row.enabled = !row.enabled;
        renderFunctions();
      });
    });
    $all('[data-config-delete]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var parts = btn.dataset.configDelete.split(':');
        state.adminConfig[parts[0]].splice(Number(parts[1]), 1);
        renderFunctions();
      });
    });
  }

  function configField(label, field, value, listKey, index) {
    return '<div class="field"><label>' + escapeHtml(label) + '</label><input class="input" data-config-field="' + field +
      '" data-list="' + listKey + '" data-index="' + index + '" value="' + escapeHtml(value || '') + '" /></div>';
  }

  function updateConfigInput(event) {
    var input = event.target;
    var row = state.adminConfig[input.dataset.list][Number(input.dataset.index)];
    row[input.dataset.configField] = input.dataset.configField === 'enabled' ? input.value === 'true' : input.value;
  }

  function saveConfig() {
    setStatus('Сохраняю черновики функций...');
    request('adminConfig', { method: 'PUT', body: { config: state.adminConfig } })
      .then(function(body) {
        state.adminConfig = body.config;
        setStatus('Черновики сохранены', 'ok');
        renderFunctions();
      })
      .catch(showError);
  }

  function renderRaw() {
    var panel = els.raw;
    panel.innerHTML =
      '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">Технические данные человека</div><div class="danger-note"><strong>Осторожно:</strong> этот режим нужен для точечной правки. Если сомневаешься, лучше не сохранять.</div>' +
          '<div class="field"><label>ID пользователя</label><input class="input" id="rawSid" value="' + escapeHtml(state.selectedSid || '') + '" /></div>' +
          '<div style="height:10px"></div><button class="btn" id="btnLoadRawUser" type="button">Загрузить</button>' +
          '<div style="height:10px"></div><textarea class="textarea" id="rawUserJson">' + escapeHtml(getJsonText(state.selectedUserData)) + '</textarea>' +
          '<div style="height:10px"></div><button class="btn-primary" id="btnSaveRawUser" type="button">Сохранить пользователя</button>' +
        '</div>' +
        '<div class="card"><div class="card-title">Технические данные документов и идей</div>' +
          '<div class="field"><label>docs manifest</label><textarea class="textarea" id="rawDocsJson">' + escapeHtml(getJsonText(state.docsManifest)) + '</textarea></div>' +
          '<div style="height:10px"></div><button class="btn" id="btnSaveRawDocs" type="button">Сохранить docs</button>' +
          '<div style="height:14px"></div><div class="field"><label>admin config</label><textarea class="textarea" id="rawConfigJson">' + escapeHtml(getJsonText(state.adminConfig)) + '</textarea></div>' +
          '<div style="height:10px"></div><button class="btn" id="btnSaveRawConfig" type="button">Сохранить config</button>' +
        '</div>' +
      '</div>';
    $('#btnLoadRawUser').addEventListener('click', function() {
      loadUser($('#rawSid').value.trim()).then(function() {
        setStatus('JSON пользователя загружен', 'ok');
        renderRaw();
      }).catch(showError);
    });
    $('#btnSaveRawUser').addEventListener('click', function() {
      var sid = $('#rawSid').value.trim();
      var payload = parseJsonTextarea('rawUserJson');
      request('user', { method: 'PUT', sid: sid, body: payload }).then(function(body) {
        state.selectedSid = sid;
        state.selectedUserData = body.userData;
        setStatus('JSON пользователя сохранён', 'ok');
      }).catch(showError);
    });
    $('#btnSaveRawDocs').addEventListener('click', function() {
      request('docsManifest', { method: 'PUT', body: { manifest: parseJsonTextarea('rawDocsJson') } }).then(function(body) {
        state.docsManifest = body.manifest;
        setStatus('Документы сохранены', 'ok');
      }).catch(showError);
    });
    $('#btnSaveRawConfig').addEventListener('click', function() {
      request('adminConfig', { method: 'PUT', body: { config: parseJsonTextarea('rawConfigJson') } }).then(function(body) {
        state.adminConfig = body.config;
        setStatus('Config сохранён', 'ok');
      }).catch(showError);
    });
  }

  function render() {
    renderOverview();
    if (state.panel === 'wizard') renderWizard();
    if (state.panel === 'users') renderUsers();
    if (state.panel === 'map') renderPoekhaliMap();
    if (state.panel === 'documents') renderDocuments();
    if (state.panel === 'functions') renderFunctions();
    if (state.panel === 'raw') renderRaw();
  }

  function showError(error) {
    setStatus(error && error.message ? error.message : String(error), 'error');
  }

  function refreshAll() {
    setStatus('Обновляю данные...');
    return Promise.all([loadOverview(), loadUsers(), loadDocs(), loadConfig(), loadPoekhaliMap()])
      .then(function() {
        setStatus('Данные обновлены', 'ok');
        render();
      })
      .catch(showError);
  }

  function init() {
    els.pageTitle = $('#pageTitle');
    els.pageNote = $('#pageNote');
    els.statusLine = $('#statusLine');
    els.adminUser = $('#adminUser');
    els.commandInput = $('#adminCommand');
    els.commandMenu = $('#commandMenu');
    els.simpleModeBtn = $('#btnSimpleMode');
    els.overview = $('#panel-overview');
    els.wizard = $('#panel-wizard');
    els.users = $('#panel-users');
    els.map = $('#panel-map');
    els.documents = $('#panel-documents');
    els.functions = $('#panel-functions');
    els.raw = $('#panel-raw');

    state.simpleMode = readSimpleModePreference();
    updateSimpleModeUi();
    bindCommandPalette();
    if (els.simpleModeBtn) {
      els.simpleModeBtn.addEventListener('click', function() {
        state.simpleMode = !state.simpleMode;
        writeSimpleModePreference(state.simpleMode);
        updateSimpleModeUi();
      });
    }

    $all('.admin-nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchPanel(btn.dataset.panel);
      });
    });
    $('#btnRefresh').addEventListener('click', refreshAll);

    checkAdmin()
      .then(refreshAll)
      .catch(function(error) {
        showAccessDenied(error);
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
