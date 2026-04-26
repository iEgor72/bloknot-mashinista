(function() {
  'use strict';

  var EARTH_RADIUS_M = 6371000;
  var MATCH_THRESHOLD_M = 550;
  var SECOND_POINT_THRESHOLD_M = 1100;
  var MAX_SEGMENT_ORDINATE_GAP_M = 1600;
  var TRACK_METERS_PER_PIXEL = 16;
  var APK_VISIBLE_PICKETS = 60;
  var APK_ANGLE_MULTIPLIER = 0.22;
  var APK_LABEL_FOCUS_RADIUS_M = 720;
  var APK_LABEL_CONTEXT_RADIUS_M = 1500;
  var POEKHALI_DIAGNOSTIC_VERSION = 'v185';
  var REMOTE_MAP_SOURCE_ENABLED = false;
  var BACKUP_SCHEMA_VERSION = 1;
  var TRAIN_LOCO_LENGTH_M = 51;
  var TRAIN_WAGON_COUNT = 71;
  var TRAIN_WAGON_LENGTH_M = 14;
  var DEFAULT_TRAIN_SETTINGS = {
    locoLength: TRAIN_LOCO_LENGTH_M,
    wagonCount: TRAIN_WAGON_COUNT,
    wagonLength: TRAIN_WAGON_LENGTH_M
  };
  var DEFAULT_MAP = {
    id: 'komsomol-sk-tche-9',
    title: 'Комсомольск ТЧЭ-9',
    sourceName: 'phone-backup:ru.badlog.trainnote/app_emap',
    data: '/assets/tracker/maps/komsomol-sk-tche-9/data.xml',
    profile: '/assets/tracker/maps/komsomol-sk-tche-9/profile.xml',
    speed: '/assets/tracker/maps/komsomol-sk-tche-9/speed.xml',
    files: [
      '/assets/tracker/maps/komsomol-sk-tche-9/data.xml',
      '/assets/tracker/maps/komsomol-sk-tche-9/profile.xml',
      '/assets/tracker/maps/komsomol-sk-tche-9/speed.xml',
      '/assets/tracker/maps/komsomol-sk-tche-9/1.xml',
      '/assets/tracker/maps/komsomol-sk-tche-9/1n.xml',
      '/assets/tracker/maps/komsomol-sk-tche-9/2.xml',
      '/assets/tracker/maps/komsomol-sk-tche-9/2n.xml'
    ]
  };
  var ASSET_PATHS = {
    manifest: '/assets/tracker/maps-manifest.json',
    reference: '/assets/tracker/tch9-reference.json',
    speedDocs: '/assets/tracker/speed-docs.json',
    regimeMaps: '/assets/tracker/regime-maps.json'
  };
  var MAP_STORAGE_KEY = 'poekhali.mapId';
  var OPS_VIEW_STORAGE_KEY = 'poekhali.opsView';
  var SELECTED_SHIFT_STORAGE_KEY = 'poekhali.shiftId';
  var LAST_PROJECTION_STORAGE_KEY = 'poekhali.lastProjection';
  var PREVIEW_PROJECTION_STORAGE_KEY = 'poekhali.previewProjection';
  var WARNINGS_STORAGE_KEY = 'poekhali.warnings';
  var WARNINGS_SYNC_STORAGE_KEY = 'poekhali.warnings.sync.v1';
  var WARNINGS_SYNC_DEBOUNCE_MS = 900;
  var PROD_AUDIT_STORAGE_KEY = 'poekhali.prodAudit.v1';
  var SPEED_DOC_REVIEW_STORAGE_KEY = 'poekhali.speedDocsReview.v1';
  var RUNS_STORAGE_KEY = 'poekhali.runs.v1';
  var RUNS_SYNC_STORAGE_KEY = 'poekhali.runs.sync.v1';
  var RUNS_SYNC_DEBOUNCE_MS = 1200;
  var RUNS_MAX_ITEMS = 200;
  var LEARNING_STORAGE_KEY = 'poekhali.mapLearning.v1';
  var LEARNING_SYNC_STORAGE_KEY = 'poekhali.mapLearning.sync.v1';
  var LEARNING_SYNC_DEBOUNCE_MS = 1200;
  var LEARNING_MAX_ACCURACY_M = 150;
  var LEARNING_MIN_COORDINATE_DELTA_M = 35;
  var LEARNING_MIN_DISTANCE_DELTA_M = 120;
  var LEARNING_NEAR_TRACK_DISTANCE_M = 1600;
  var LEARNING_MIN_TIME_DELTA_MS = 5000;
  var LEARNING_MAX_SAMPLES_PER_SECTOR = 450;
  var LEARNING_MAX_RAW_TRACKS_PER_MAP = 160;
  var LEARNING_MAX_SAMPLES_PER_RAW_TRACK = 1800;
  var LEARNING_MAX_USER_SECTIONS_PER_MAP = 240;
  var LEARNING_MAX_POINTS_PER_USER_SECTION = 1800;
  var LEARNING_MAX_PROFILE_SEGMENTS_PER_USER_SECTION = 1800;
  var LEARNING_MAX_OBJECTS_PER_USER_SECTION = 420;
  var LEARNING_MAX_SPEEDS_PER_USER_SECTION = 420;
  var LEARNING_MAX_HISTORY_PER_USER_SECTION = 80;
  var LEARNING_RAW_DRAFT_SECTOR_BASE = 900000;
  var LEARNING_RAW_DRAFT_MIN_DISTANCE_M = 120;
  var GPS_DIRECTION_MIN_DELTA_M = 25;
  var GPS_DIRECTION_MIN_TIME_MS = 2500;
  var GPS_DIRECTION_MANUAL_LOCK_MS = 120000;
  var AUTO_MAP_SWITCH_MARGIN_M = 160;
  var ROUTE_MAP_MIN_SCORE = 64;
  var NEXT_RESTRICTION_LOOKAHEAD_M = 5000;
  var LIVE_ALERT_AHEAD_M = 1000;
  var LIVE_ALERT_NEAR_M = 300;
  var LIVE_ALERT_VISIBLE_MS = 9000;
  var LIVE_ALERT_REPEAT_MS = 30000;
  var LIVE_ALERT_DANGER_REPEAT_MS = 12000;
  var PROD_AUDIT_MANUAL_CHECKS = [
    { id: 'mobile320', title: 'Мобильная ширина 320', detail: 'Профиль, HUD, ПР и нижнее меню не налезают друг на друга на 320 px.' },
    { id: 'mobile360', title: 'Мобильная ширина 360', detail: 'Рабочий экран и ПР читаются на типовом Android-экране 360 px.' },
    { id: 'mobile390', title: 'Мобильная ширина 390', detail: 'iPhone/крупный Android без обрезанных кнопок и скрытых меток.' },
    { id: 'realGpsRide', title: 'Реальная поездка GPS', detail: 'На маршруте GPS сам выбрал карту, участок, км/пк и вел поезд по профилю.' },
    { id: 'apkVisualParity', title: 'Сверка с APK', detail: 'Поезд, станции, светофоры, скорости, уклоны и км/пк визуально сверены с реальным Поехали.' },
    { id: 'profileOverlap', title: 'Нет критичных наложений', detail: 'На рабочих участках профиль, состав, ПР, скорости, РК и объекты не мешают чтению.' }
  ];
  var THEME = {
    bg: '#0C0C10',
    bgDeep: '#090A0F',
    surface: '#131318',
    surfaceHi: '#1A1A22',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHi: 'rgba(255, 255, 255, 0.14)',
    text: '#EEF2F8',
    sub: '#8892A4',
    muted: '#3A4254',
    accent: '#38BDF8',
    accentDim: 'rgba(56, 189, 248, 0.14)',
    accentStrong: '#5bd2ff',
    green: '#4ADE80',
    greenDim: 'rgba(74, 222, 128, 0.14)',
    danger: '#f43f5e',
    dangerDim: 'rgba(244, 63, 94, 0.14)',
    shadow: 'rgba(0, 0, 0, 0.34)'
  };

  var tracker = {
    active: false,
    watchId: null,
    frameId: null,
    assetPromise: null,
    manifestPromise: null,
    referencePromise: null,
    speedDocsPromise: null,
    assetMapId: '',
    assetsLoaded: false,
    assetsError: '',
    reference: null,
    referenceLoaded: false,
    referenceError: '',
    speedDocs: null,
    speedDocsLoaded: false,
    speedDocsError: '',
    speedDocsBySector: {},
    regimeMaps: null,
    regimeMapsLoaded: false,
    regimeMapsError: '',
    regimeMapsBySector: {},
    regimeProfilesBySector: {},
    regimeSpeedRulesBySector: {},
    regimeObjectsBySector: {},
    regimeControlMarksBySector: {},
    regimeMapsPromise: null,
    canvas: null,
    ctx: null,
    mapPicker: null,
    mapPickerOpen: false,
    opsSheet: null,
    opsView: readStringStorage(OPS_VIEW_STORAGE_KEY) || 'drive',
    conflictCard: null,
    prodAudit: null,
    speedDocReview: null,
    activeSpeedConflict: null,
    activeRestriction: null,
    nextRestriction: null,
    liveAlert: null,
    liveAlertLastKey: '',
    liveAlertLastAt: 0,
    editingWarningId: '',
    width: 0,
    height: 0,
    dpr: 1,
    routePoints: [],
    routeSegments: [],
    profilePoints: [],
    profileBySector: {},
    trackObjectsByFile: {},
    speedLimits: [],
    speedLimitsBySector: {},
    learning: null,
    sharedLearning: null,
    learningSync: {
      state: 'idle',
      pending: false,
      lastSyncAt: 0,
      error: '',
      inFlight: false,
      timer: null
    },
    learnedProfilesBySector: {},
    userSections: [],
    userSectionsBySector: {},
    userProfilesBySector: {},
    userRoutePoints: [],
    userRouteSegments: [],
    userObjectsBySector: {},
    userSpeedsBySector: {},
    rawDrafts: [],
    rawDraftsBySector: {},
    rawDraftProfilesBySector: {},
    rawDraftRoutePoints: [],
    rawDraftRouteSegments: [],
    lastLearningSample: null,
    lastRawLearningSample: null,
    editingUserSectionEntity: null,
    mapManifestGeneratedAt: '',
    availableMaps: [DEFAULT_MAP],
    remoteMaps: [],
    currentMap: DEFAULT_MAP,
    mapProbeCache: {},
    mapReadinessCache: {},
    mapsReadinessChecking: false,
    mapsReadinessCheckedAt: 0,
    routeMapProbeCache: {},
    routeMapSelecting: false,
    routeMapCandidate: null,
    routeMapLastCheckedAt: 0,
    entryShiftLockId: '',
    autoMapSelecting: false,
    autoMapCandidate: null,
    autoMapLastCheckedAt: 0,
    warnings: [],
    warningBulkMessage: '',
    warningSync: {
      state: 'idle',
      pending: false,
      lastSyncAt: 0,
      error: '',
      inFlight: false,
      timer: null
    },
    runs: [],
    activeRunId: '',
    lastShiftRunWriteAt: 0,
    runSync: {
      state: 'idle',
      pending: false,
      lastSyncAt: 0,
      error: '',
      inFlight: false,
      timer: null
    },
    lastLocation: null,
    projection: null,
    nearestProjection: null,
    autoPosition: null,
    lastDirectionProbe: null,
    directionSource: '',
    manualDirectionLockedUntil: 0,
    previewCoordinate: null,
    previewSector: null,
    previewDragActive: false,
    previewDragX: 0,
    gpsError: '',
    status: 'idle',
    even: true,
    wayNumber: 1,
    simpleCoordinate: true,
    speedMeters: false,
    timerRunning: false,
    runStartPreparing: false,
    runStartToken: 0,
    runStartMessage: '',
    backupMessage: '',
    backupMessageTone: '',
    timerStartedAt: 0,
    timerElapsedMs: 0,
    speedMps: 0,
    accuracy: 0,
    satellites: '—',
    lastUpdatedAt: 0
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var el = byId(id);
    if (el) el.textContent = text;
  }

  function getGpsStatusDisplayText(text) {
    var value = text || 'GPS';
    if (window.innerWidth <= 420 && value === 'НЕТ GPS') return 'GPS';
    if (window.innerWidth <= 420 && value.indexOf('GPS · УЧ ') === 0) return value.replace('GPS · ', '');
    if (window.innerWidth <= 420 && value.indexOf('ВНЕ · УЧ ') === 0) return 'ВНЕ';
    return value;
  }

  function syncGpsStatusDisplay() {
    var el = byId('poekhaliGpsStatus');
    if (!el) return;
    el.textContent = getGpsStatusDisplayText(el.dataset.fullText || el.textContent || 'GPS');
  }

  function setGpsStatus(text, tone) {
    var el = byId('poekhaliGpsStatus');
    if (!el) return;
    var value = text || 'GPS';
    el.dataset.fullText = value;
    el.title = value;
    el.setAttribute('aria-label', value);
    el.textContent = getGpsStatusDisplayText(value);
    el.classList.remove('is-live', 'is-error');
    if (tone) el.classList.add(tone);
  }

  function parseNumber(value) {
    if (value === null || value === undefined) return NaN;
    return parseFloat(String(value).replace(',', '.'));
  }

  function isRealNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function getElementsByLocalName(root, localName) {
    var all = root ? root.getElementsByTagName('*') : [];
    var result = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].localName === localName || all[i].tagName === localName) {
        result.push(all[i]);
      }
    }
    return result;
  }

  function getFirstTextByLocalName(root, localName) {
    var items = getElementsByLocalName(root, localName);
    if (!items.length) return '';
    return (items[0].textContent || '').trim();
  }

  function normalizeOrdinate(rawValue) {
    var value = parseNumber(rawValue);
    if (!isFinite(value)) return NaN;
    return Math.round(value);
  }

  function fetchText(path) {
    return fetch(path, { cache: 'no-store' }).then(function(response) {
      if (!response || !response.ok) {
        throw new Error('Не удалось загрузить ' + path);
      }
      return response.text();
    });
  }

  function getFileName(path) {
    return String(path || '').split(/[\\/]/).pop().toLowerCase();
  }

  function uniqueStrings(values) {
    var seen = {};
    var result = [];
    for (var i = 0; i < values.length; i++) {
      var value = values[i] ? String(values[i]) : '';
      if (!value || seen[value]) continue;
      seen[value] = true;
      result.push(value);
    }
    return result;
  }

  function readJsonStorage(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // localStorage can be blocked in restricted browser contexts.
    }
  }

  function readStringStorage(key) {
    try {
      return String(localStorage.getItem(key) || '').trim();
    } catch (error) {
      return '';
    }
  }

  function writeStringStorage(key, value) {
    try {
      var text = String(value || '').trim();
      if (text) localStorage.setItem(key, text);
      else localStorage.removeItem(key);
    } catch (error) {
      // localStorage can be blocked in restricted browser contexts.
    }
  }

  function normalizeProdAuditState(raw) {
    var state = raw && typeof raw === 'object' ? raw : {};
    var checks = state.checks && typeof state.checks === 'object' ? state.checks : {};
    var normalized = {
      checks: {},
      updatedAt: Math.max(0, Number(state.updatedAt) || 0)
    };
    PROD_AUDIT_MANUAL_CHECKS.forEach(function(config) {
      var item = checks[config.id] && typeof checks[config.id] === 'object' ? checks[config.id] : {};
      var status = String(item.status || '').toLowerCase();
      if (status !== 'ok' && status !== 'problem') status = 'pending';
      normalized.checks[config.id] = {
        status: status,
        updatedAt: Math.max(0, Number(item.updatedAt) || 0)
      };
    });
    return normalized;
  }

  function getProdAuditState() {
    if (!tracker.prodAudit) {
      tracker.prodAudit = normalizeProdAuditState(readJsonStorage(PROD_AUDIT_STORAGE_KEY, null));
    }
    return tracker.prodAudit;
  }

  function saveProdAuditState() {
    if (!tracker.prodAudit) tracker.prodAudit = normalizeProdAuditState(null);
    tracker.prodAudit.updatedAt = Date.now();
    writeJsonStorage(PROD_AUDIT_STORAGE_KEY, tracker.prodAudit);
  }

  function setProdAuditManualCheck(id, status) {
    var state = getProdAuditState();
    if (!state.checks[id]) return;
    var value = String(status || 'pending').toLowerCase();
    if (value !== 'ok' && value !== 'problem') value = 'pending';
    state.checks[id] = {
      status: value,
      updatedAt: Date.now()
    };
    saveProdAuditState();
  }

  function cycleProdAuditManualCheck(id) {
    var state = getProdAuditState();
    var current = state.checks[id] ? state.checks[id].status : 'pending';
    var next = current === 'pending' ? 'ok' : current === 'ok' ? 'problem' : 'pending';
    setProdAuditManualCheck(id, next);
    renderOpsSheet();
  }

  function getSpeedDocReviewKey(rule) {
    if (!rule) return '';
    return String(rule.id || [
      rule.sourceCode || '',
      rule.page || '',
      rule.coordinate || '',
      rule.end || '',
      rule.speed || ''
    ].join(':'));
  }

  function normalizeSpeedDocReviewState(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var items = source.items && typeof source.items === 'object' ? source.items : source;
    var normalized = {
      items: {},
      updatedAt: Math.max(0, Number(source.updatedAt) || 0)
    };
    Object.keys(items || {}).forEach(function(key) {
      var item = items[key] && typeof items[key] === 'object' ? items[key] : {};
      var status = String(item.status || '').toLowerCase();
      if (status !== 'verified' && status !== 'problem') status = 'pending';
      if (status === 'pending') return;
      normalized.items[key] = {
        status: status,
        note: String(item.note || '').slice(0, 240),
        updatedAt: Math.max(0, Number(item.updatedAt) || 0)
      };
    });
    return normalized;
  }

  function getSpeedDocReviewState() {
    if (!tracker.speedDocReview) {
      tracker.speedDocReview = normalizeSpeedDocReviewState(readJsonStorage(SPEED_DOC_REVIEW_STORAGE_KEY, null));
    }
    return tracker.speedDocReview;
  }

  function saveSpeedDocReviewState() {
    if (!tracker.speedDocReview) tracker.speedDocReview = normalizeSpeedDocReviewState(null);
    tracker.speedDocReview.updatedAt = Date.now();
    writeJsonStorage(SPEED_DOC_REVIEW_STORAGE_KEY, tracker.speedDocReview);
  }

  function getSpeedDocRuleReview(rule) {
    var key = getSpeedDocReviewKey(rule);
    var state = getSpeedDocReviewState();
    return key && state.items[key] ? state.items[key] : {
      status: 'pending',
      note: '',
      updatedAt: 0
    };
  }

  function setSpeedDocRuleReview(rule, status, note) {
    var key = getSpeedDocReviewKey(rule);
    if (!key) return;
    var value = String(status || 'pending').toLowerCase();
    var state = getSpeedDocReviewState();
    if (value !== 'verified' && value !== 'problem') {
      delete state.items[key];
    } else {
      state.items[key] = {
        status: value,
        note: String(note || '').slice(0, 240),
        updatedAt: Date.now()
      };
    }
    saveSpeedDocReviewState();
  }

  function getSpeedDocReviewLabel(review) {
    var status = review && review.status;
    if (status === 'verified') return 'сверено';
    if (status === 'problem') return 'ошибка';
    return 'не сверено';
  }

  function getSpeedDocReviewTone(review) {
    var status = review && review.status;
    if (status === 'verified') return 'success';
    if (status === 'problem') return 'danger';
    return 'warning';
  }

  function getSpeedDocSourceUrl(rule) {
    if (!rule || !rule.sourcePath) return '';
    var url = String(rule.sourcePath);
    if (rule.page) url += '#page=' + encodeURIComponent(String(rule.page));
    return url;
  }

  function openSpeedDocSource(rule) {
    var url = getSpeedDocSourceUrl(rule);
    if (!url) return false;
    window.open(url, '_blank', 'noopener');
    return true;
  }

  function getSpeedDocsReviewSummary(items) {
    var rows = Array.isArray(items) ? items : [];
    var result = {
      total: rows.length,
      verified: 0,
      problem: 0,
      pending: 0
    };
    for (var i = 0; i < rows.length; i++) {
      var review = getSpeedDocRuleReview(rows[i].doc);
      if (review.status === 'verified') result.verified++;
      else if (review.status === 'problem') result.problem++;
      else result.pending++;
    }
    return result;
  }

  function clampNumber(value, min, max, fallback) {
    var numeric = Number(value);
    if (!isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
  }

  function normalizeTrainSettings(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      locoLength: Math.round(clampNumber(value.locoLength, 1, 250, DEFAULT_TRAIN_SETTINGS.locoLength)),
      wagonCount: Math.round(clampNumber(value.wagonCount, 0, 200, DEFAULT_TRAIN_SETTINGS.wagonCount)),
      wagonLength: Math.round(clampNumber(value.wagonLength, 1, 50, DEFAULT_TRAIN_SETTINGS.wagonLength))
    };
  }

  function getGlobalShifts() {
    try {
      if (typeof allShifts !== 'undefined' && Array.isArray(allShifts)) return allShifts;
    } catch (error) {}
    return [];
  }

  function parseMskDateTime(value) {
    var text = String(value || '').trim();
    if (!text) return NaN;
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
      var zoned = new Date(text).getTime();
      return isFinite(zoned) ? zoned : NaN;
    }
    var match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
    if (match) {
      return Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]) - 3,
        Number(match[5]),
        Number(match[6] || 0)
      );
    }
    var parsed = new Date(text).getTime();
    return isFinite(parsed) ? parsed : NaN;
  }

  function getShiftStartMs(shift) {
    return parseMskDateTime(shift && shift.start_msk);
  }

  function getShiftEndMs(shift) {
    return parseMskDateTime(shift && shift.end_msk);
  }

  function compareShiftsRecentFirst(a, b) {
    var aStart = getShiftStartMs(a);
    var bStart = getShiftStartMs(b);
    if (isFinite(aStart) && isFinite(bStart) && aStart !== bStart) return bStart - aStart;
    if (isFinite(aStart) !== isFinite(bStart)) return isFinite(aStart) ? -1 : 1;
    var aCreated = new Date(a && a.created_at ? a.created_at : 0).getTime();
    var bCreated = new Date(b && b.created_at ? b.created_at : 0).getTime();
    return (isFinite(bCreated) ? bCreated : 0) - (isFinite(aCreated) ? aCreated : 0);
  }

  function getPoekhaliCandidateShifts() {
    return getGlobalShifts().filter(function(shift) {
      return shift && !shift.schedule_generated && !shift.isScheduleDerived && !shift.schedule_period_id;
    }).sort(compareShiftsRecentFirst);
  }

  function findShiftInListById(shifts, id) {
    var target = String(id || '').trim();
    if (!target || !Array.isArray(shifts)) return null;
    for (var i = 0; i < shifts.length; i++) {
      if (String(shifts[i] && shifts[i].id || '') === target) return shifts[i];
    }
    return null;
  }

  function getSelectedPoekhaliShiftId() {
    return readStringStorage(SELECTED_SHIFT_STORAGE_KEY);
  }

  function setSelectedPoekhaliShiftId(id) {
    writeStringStorage(SELECTED_SHIFT_STORAGE_KEY, id || '');
  }

  function findShiftByGlobalId(id) {
    var target = String(id || '');
    if (!target) return null;
    var shifts = getGlobalShifts();
    return findShiftInListById(shifts, target);
  }

  function getPoekhaliShiftContext() {
    var shifts = getPoekhaliCandidateShifts();
    if (!shifts.length) return null;

    var activeRun = getActiveRun();
    if (activeRun && activeRun.shiftId) {
      var linkedShift = findShiftByGlobalId(activeRun.shiftId);
      if (linkedShift) return { shift: linkedShift, source: 'recording' };
    }

    var selectedShiftId = getSelectedPoekhaliShiftId();
    if (selectedShiftId) {
      var selectedShift = findShiftInListById(shifts, selectedShiftId);
      if (selectedShift) return { shift: selectedShift, source: 'selected' };
      setSelectedPoekhaliShiftId('');
    }

    var now = Date.now();
    var active = shifts.filter(function(shift) {
      var start = getShiftStartMs(shift);
      var end = getShiftEndMs(shift);
      return isFinite(start) && isFinite(end) && start <= now && end >= now;
    }).sort(compareShiftsRecentFirst);
    if (active.length) return { shift: active[0], source: 'active' };

    var recentId = '';
    try {
      if (typeof recentAddedShiftId !== 'undefined' && recentAddedShiftId) recentId = String(recentAddedShiftId);
    } catch (error) {}
    var recent = findShiftByGlobalId(recentId);
    if (recent) return { shift: recent, source: 'recent' };

    shifts.sort(compareShiftsRecentFirst);
    return { shift: shifts[0], source: 'latest' };
  }

  function getPoekhaliEntryShiftContext(pinnedShiftId) {
    var shifts = getPoekhaliCandidateShifts();
    if (!shifts.length) return null;

    var activeRun = getActiveRun();
    if (activeRun && activeRun.shiftId) {
      var linkedShift = findShiftByGlobalId(activeRun.shiftId);
      if (linkedShift) return { shift: linkedShift, source: 'recording' };
    }

    var pinnedId = String(pinnedShiftId || '').trim();
    if (pinnedId) {
      var pinnedShift = findShiftInListById(shifts, pinnedId);
      if (pinnedShift) return { shift: pinnedShift, source: 'selected' };
    }

    var now = Date.now();
    var active = shifts.filter(function(shift) {
      var start = getShiftStartMs(shift);
      var end = getShiftEndMs(shift);
      return isFinite(start) && isFinite(end) && start <= now && end >= now;
    }).sort(compareShiftsRecentFirst);
    if (active.length) return { shift: active[0], source: 'active' };

    var recentId = '';
    try {
      if (typeof recentAddedShiftId !== 'undefined' && recentAddedShiftId) recentId = String(recentAddedShiftId);
    } catch (error) {}
    var recent = findShiftByGlobalId(recentId);
    if (recent) return { shift: recent, source: 'recent' };

    var selectedShiftId = getSelectedPoekhaliShiftId();
    if (selectedShiftId) {
      var selectedShift = findShiftInListById(shifts, selectedShiftId);
      if (selectedShift) return { shift: selectedShift, source: 'selected' };
      setSelectedPoekhaliShiftId('');
    }

    shifts.sort(compareShiftsRecentFirst);
    return { shift: shifts[0], source: 'latest' };
  }

  function getShiftSourceLabel(source) {
    if (source === 'recording') return 'запись Поехали';
    if (source === 'selected') return 'выбрана вручную';
    if (source === 'active') return 'текущая смена';
    if (source === 'recent') return 'только что добавлена';
    return 'последняя смена';
  }

  function formatLocoSummary(shift) {
    var parts = [];
    if (shift && shift.locomotive_series) parts.push(String(shift.locomotive_series));
    if (shift && shift.locomotive_number) parts.push('№ ' + String(shift.locomotive_number));
    return parts.join(' ');
  }

  function formatRouteSummary(shift) {
    var from = shift && shift.route_from ? String(shift.route_from).trim() : '';
    var to = shift && shift.route_to ? String(shift.route_to).trim() : '';
    if (from || to) return (from || '—') + ' → ' + (to || '—');
    return shift && shift.route_kind === 'trip' ? 'Поездка' : 'Смена';
  }

  function formatPoekhaliShiftOption(shift) {
    if (!shift) return '—';
    var start = String(shift.start_msk || '').trim();
    var date = /^\d{4}-\d{2}-\d{2}/.test(start) ? start.substring(8, 10) + '.' + start.substring(5, 7) : 'без даты';
    var route = formatRouteSummary(shift);
    var train = shift.train_number ? ' · №' + String(shift.train_number).trim() : '';
    var loco = formatLocoSummary(shift);
    return date + ' · ' + route + train + (loco ? ' · ' + loco : '');
  }

  function normalizeRouteName(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\b(ст|станция|разъезд|рзд|остановочный|пункт|оп)\b/g, ' ')
      .replace(/[^a-zа-я0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function getRouteMatchScore(query, candidate) {
    var q = normalizeRouteName(query);
    var c = normalizeRouteName(candidate);
    if (!q || !c) return 0;
    if (q === c) return 100;
    if (c.indexOf(q) === 0 || q.indexOf(c) === 0) return 86;
    if (c.indexOf(q) >= 0 || q.indexOf(c) >= 0) return 72;
    var qParts = q.split(' ').filter(Boolean);
    var matched = 0;
    for (var i = 0; i < qParts.length; i++) {
      if (qParts[i].length >= 3 && c.indexOf(qParts[i]) >= 0) matched++;
    }
    return qParts.length && matched === qParts.length ? 64 : 0;
  }

  function getShiftTrainConditionalLength(shift) {
    var value = parseNumber(shift && shift.train_length);
    return isFinite(value) && value > 0 ? Math.round(value) : 0;
  }

  function getShiftTrainAxlesCount(shift) {
    var value = parseNumber(shift && shift.train_axles);
    return isFinite(value) && value > 0 ? Math.round(value) : 0;
  }

  function getShiftTrainWeightTonnes(shift) {
    var value = parseNumber(shift && shift.train_weight);
    return isFinite(value) && value > 0 ? Math.round(value) : 0;
  }

  function getPoekhaliTrainComposition(shift, conditionalLength, settings) {
    var safeSettings = normalizeTrainSettings(settings || DEFAULT_TRAIN_SETTINGS);
    var axles = getShiftTrainAxlesCount(shift);
    var weight = getShiftTrainWeightTonnes(shift);
    var hasTrip = !!(shift && shift.route_kind === 'trip');
    var hasTrainNumber = !!(shift && shift.train_number);
    var hasTrainPayload = !!(hasTrainNumber || weight || axles || conditionalLength);

    if (conditionalLength > 0) {
      return {
        type: 'train',
        lengthMeters: safeSettings.locoLength + conditionalLength * safeSettings.wagonLength,
        lengthLabel: conditionalLength + ' уд.',
        lengthSource: 'из смены',
        lengthTone: '',
        readiness: 'ready',
        note: 'Длина состава взята из карточки смены. Отрисовка головы и хвоста идет по этой длине.'
      };
    }

    if (axles > 0) {
      var wagonCountByAxles = Math.max(1, Math.ceil(axles / 4));
      return {
        type: 'estimated',
        lengthMeters: safeSettings.locoLength + wagonCountByAxles * safeSettings.wagonLength,
        lengthLabel: '~' + (safeSettings.locoLength + wagonCountByAxles * safeSettings.wagonLength) + ' м',
        lengthSource: 'по осям',
        lengthTone: 'warning',
        readiness: 'review',
        note: 'Условная длина не указана, поэтому хвост состава рассчитан по осям. Для точной работы заполните условную длину в смене.'
      };
    }

    if (shift && hasTrip && hasTrainPayload) {
      return {
        type: 'unknown-train',
        lengthMeters: safeSettings.locoLength,
        lengthLabel: 'нет данных',
        lengthSource: 'только лок.',
        lengthTone: 'danger',
        readiness: 'blocked',
        note: 'В смене есть поездка, но нет условной длины и осей. Режим не подставляет демо-состав: на профиле показан только локомотив до заполнения длины.'
      };
    }

    if (shift) {
      return {
        type: hasTrip ? 'unknown' : 'loco',
        lengthMeters: safeSettings.locoLength,
        lengthLabel: 'локомотив',
        lengthSource: hasTrip ? 'нет состава' : 'смена',
        lengthTone: hasTrip ? 'warning' : 'muted',
        readiness: hasTrip ? 'review' : 'ready',
        note: hasTrip
          ? 'Поездные данные в смене не заполнены. На профиле показан локомотив, без выдуманной длины состава.'
          : 'Для работы без поездки режим использует длину локомотива и не подставляет грузовой состав.'
      };
    }

    return {
      type: 'no-shift',
      lengthMeters: safeSettings.locoLength,
      lengthLabel: 'нет смены',
      lengthSource: 'локомотив',
      lengthTone: 'danger',
      readiness: 'blocked',
      note: 'Смена не найдена. Режим не подставляет демо-состав; добавьте или откройте смену, чтобы взять поезд и длину.'
    };
  }

  function normalizeWayNumber(value) {
    var way = Math.round(Number(value) || 1);
    return way === 2 ? 2 : 1;
  }

  function getCurrentTrackLabel() {
    return 'П ' + normalizeWayNumber(tracker.wayNumber);
  }

  function getWayNumberFromObjectFileKey(fileKey) {
    var match = String(fileKey || '').match(/[12]/);
    return match ? normalizeWayNumber(match[0]) : 0;
  }

  function getRouteObjectFileLabel(fileKey) {
    var wayNumber = getWayNumberFromObjectFileKey(fileKey);
    if (!wayNumber) return '';
    return 'П ' + wayNumber;
  }

  function getEvenFromObjectFileKey(fileKey) {
    var key = String(fileKey || '').toLowerCase();
    if (!/^[12]n?$/.test(key)) return null;
    return key.slice(-1) !== 'n';
  }

  function getRouteObjectFileScore(station, even) {
    if (!station) return 0;
    var wayNumber = getWayNumberFromObjectFileKey(station.fileKey);
    var directionEven = getEvenFromObjectFileKey(station.fileKey);
    var score = 0;
    if (wayNumber) score += 4;
    if (wayNumber && wayNumber === normalizeWayNumber(tracker.wayNumber)) score += 1;
    if (directionEven !== null && directionEven === !!even) score += 6;
    return score;
  }

  function applyRunNavigationState(run) {
    if (!run) return;
    var direction = String(run.direction || '').toUpperCase().replace(/\s+/g, '');
    if (direction.indexOf('НЕЧ') === 0) tracker.even = false;
    else if (direction.indexOf('ЧЕТ') === 0) tracker.even = true;
    var trackMatch = String(run.track || '').match(/[12]/);
    if (trackMatch) tracker.wayNumber = normalizeWayNumber(trackMatch[0]);
  }

  function applyProjectionNavigationState(projection) {
    if (!projection) return;
    if (projection.even !== undefined) tracker.even = !!projection.even;
    if (projection.wayNumber !== undefined) tracker.wayNumber = normalizeWayNumber(projection.wayNumber);
  }

  function getPoekhaliTrainDetails() {
    var context = getPoekhaliShiftContext();
    var shift = context && context.shift ? context.shift : null;
    var conditionalLength = getShiftTrainConditionalLength(shift);
    var fallbackSettings = normalizeTrainSettings(DEFAULT_TRAIN_SETTINGS);
    var composition = getPoekhaliTrainComposition(shift, conditionalLength, fallbackSettings);
    var trainNumber = shift && shift.train_number ? String(shift.train_number).trim() : '';
    var loco = formatLocoSummary(shift);
    var axles = getShiftTrainAxlesCount(shift);
    var weight = getShiftTrainWeightTonnes(shift);
    var parts = [];
    if (trainNumber) parts.push('Поезд ' + trainNumber);
    if (loco) parts.push(loco);
    if (conditionalLength > 0) parts.push(conditionalLength + ' уд.');
    else if (composition.lengthSource) parts.push(composition.lengthSource);
    return {
      context: context,
      shift: shift,
      source: context ? context.source : '',
      trainNumber: trainNumber,
      loco: loco,
      weight: weight ? String(weight) : '',
      axles: axles ? String(axles) : '',
      route: shift ? formatRouteSummary(shift) : '',
      conditionalLength: conditionalLength,
      lengthMeters: Math.max(1, Math.round(composition.lengthMeters || fallbackSettings.locoLength)),
      lengthLabel: composition.lengthLabel || '',
      lengthSource: composition.lengthSource || '',
      lengthTone: composition.lengthTone || '',
      compositionType: composition.type || '',
      compositionReadiness: composition.readiness || '',
      compositionNote: composition.note || '',
      hasShift: !!shift,
      hasFilledTrainData: !!(trainNumber || loco || conditionalLength || axles || weight),
      summary: parts.length ? parts.join(' · ') : ''
    };
  }

  function collectRouteStationsFromStores(stores) {
    var sources = [];
    if (Array.isArray(stores)) {
      sources = stores;
    } else if (stores && typeof stores === 'object') {
      Object.keys(stores).forEach(function(key) {
        if (stores[key]) sources.push({ store: stores[key], key: key });
      });
    }
    var stations = [];
    var seen = {};
    for (var s = 0; s < sources.length; s++) {
      var source = sources[s] && sources[s].store ? sources[s].store : sources[s];
      var sourceKey = sources[s] && sources[s].key ? String(sources[s].key) : '';
      var objects = source && Array.isArray(source.all) ? source.all : [];
      for (var i = 0; i < objects.length; i++) {
        var item = objects[i];
        if (!item || item.type !== '2') continue;
        var fileKey = String(item.fileKey || sourceKey || '');
        var key = [
          fileKey,
          normalizeRouteName(item.name),
          getSectorKey(item.sector),
          Math.round(Number(item.coordinate || 0))
        ].join(':');
        if (seen[key]) continue;
        seen[key] = true;
        if (fileKey && !item.fileKey) item.fileKey = fileKey;
        stations.push(item);
      }
    }
    stations.sort(function(a, b) {
      if (a.sector !== b.sector) return a.sector - b.sector;
      if (a.coordinate !== b.coordinate) return a.coordinate - b.coordinate;
      return String(a.fileKey || '').localeCompare(String(b.fileKey || ''));
    });
    return stations;
  }

  function getRouteStationsFromCurrentMap() {
    return collectRouteStationsFromStores(tracker.trackObjectsByFile);
  }

  function getRouteStationMatchesInList(name, stations) {
    var matches = [];
    var source = Array.isArray(stations) ? stations : [];
    for (var i = 0; i < source.length; i++) {
      if (!source[i]) continue;
      var score = getRouteMatchScore(name, source[i].name);
      if (score <= 0) continue;
      matches.push({
        station: source[i],
        score: score
      });
    }
    matches.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var aWay = getWayNumberFromObjectFileKey(a.station && a.station.fileKey);
      var bWay = getWayNumberFromObjectFileKey(b.station && b.station.fileKey);
      var currentWay = normalizeWayNumber(tracker.wayNumber);
      if ((aWay === currentWay) !== (bWay === currentWay)) return aWay === currentWay ? -1 : 1;
      if (a.station.coordinate !== b.station.coordinate) return a.station.coordinate - b.station.coordinate;
      return String(a.station.fileKey || '').localeCompare(String(b.station.fileKey || ''));
    });
    return matches;
  }

  function findRouteStationInList(name, stations) {
    var matches = getRouteStationMatchesInList(name, stations);
    return matches.length ? matches[0] : null;
  }

  function findRouteStation(name) {
    return findRouteStationInList(name, getRouteStationsFromCurrentMap());
  }

  function buildShiftRouteSuggestion(details, from, to, fromMatch, toMatch, map) {
    if (!fromMatch || !toMatch || fromMatch.score < ROUTE_MAP_MIN_SCORE || toMatch.score < ROUTE_MAP_MIN_SCORE) return null;
    var fromStation = fromMatch.station;
    var toStation = toMatch.station;
    var even = toStation.coordinate >= fromStation.coordinate;
    var distance = Math.abs(toStation.coordinate - fromStation.coordinate);
    var coordinate = even ? fromStation.coordinate : fromStation.end;
    var fromWay = getWayNumberFromObjectFileKey(fromStation.fileKey);
    var toWay = getWayNumberFromObjectFileKey(toStation.fileKey);
    var wayNumber = fromWay && toWay && fromWay === toWay ? fromWay : (fromWay || toWay || 0);
    var fromTrackLabel = getRouteObjectFileLabel(fromStation.fileKey);
    var toTrackLabel = getRouteObjectFileLabel(toStation.fileKey);
    return {
      status: 'ready',
      details: details,
      fromText: from,
      toText: to,
      fromMatch: fromMatch,
      toMatch: toMatch,
      fromStation: fromStation,
      toStation: toStation,
      sector: fromStation.sector,
      coordinate: coordinate,
      even: even,
      directionLabel: even ? 'ЧЕТ' : 'НЕЧЕТ',
      wayNumber: wayNumber,
      trackLabel: wayNumber ? 'П ' + wayNumber : '',
      trackSourceLabel: fromTrackLabel && toTrackLabel && fromTrackLabel === toTrackLabel
        ? fromTrackLabel
        : [fromTrackLabel, toTrackLabel].filter(Boolean).join(' / '),
      distance: distance,
      confidence: Math.min(fromMatch.score, toMatch.score),
      map: map || tracker.currentMap || DEFAULT_MAP
    };
  }

  function getShiftRouteSuggestionScore(suggestion) {
    if (!suggestion) return -Infinity;
    var sameWay = suggestion.wayNumber &&
      getWayNumberFromObjectFileKey(suggestion.fromStation && suggestion.fromStation.fileKey) === suggestion.wayNumber &&
      getWayNumberFromObjectFileKey(suggestion.toStation && suggestion.toStation.fileKey) === suggestion.wayNumber;
    return suggestion.confidence * 1000000 +
      getRouteObjectFileScore(suggestion.fromStation, suggestion.even) * 1000 +
      getRouteObjectFileScore(suggestion.toStation, suggestion.even) * 1000 +
      (sameWay ? 5000 : 0) +
      Math.min(suggestion.distance, 99999);
  }

  function buildBestShiftRouteSuggestion(details, from, to, stations, map) {
    var fromMatches = getRouteStationMatchesInList(from, stations)
      .filter(function(match) { return match.score >= ROUTE_MAP_MIN_SCORE; })
      .slice(0, 12);
    var toMatches = getRouteStationMatchesInList(to, stations)
      .filter(function(match) { return match.score >= ROUTE_MAP_MIN_SCORE; })
      .slice(0, 12);
    var best = null;
    for (var i = 0; i < fromMatches.length; i++) {
      for (var j = 0; j < toMatches.length; j++) {
        var suggestion = buildShiftRouteSuggestion(details, from, to, fromMatches[i], toMatches[j], map);
        if (!suggestion) continue;
        var score = getShiftRouteSuggestionScore(suggestion);
        if (!best || score > best.score) {
          best = {
            score: score,
            suggestion: suggestion
          };
        }
      }
    }
    return best ? best.suggestion : null;
  }

  function loadMapRouteProbe(map) {
    var normalized = normalizeMapConfig(map);
    if (!normalized) return Promise.resolve(null);
    var key = getMapKey(normalized);
    if (isCurrentMap(normalized) && tracker.assetsLoaded) {
      return Promise.resolve({
        map: normalized,
        stations: getRouteStationsFromCurrentMap(),
        objectsLoaded: Object.keys(tracker.trackObjectsByFile || {}).length
      });
    }
    if (tracker.routeMapProbeCache[key]) return tracker.routeMapProbeCache[key];
    var entries = getObjectFileEntries(normalized);
    if (!entries.length) {
      tracker.routeMapProbeCache[key] = Promise.resolve({
        map: normalized,
        stations: [],
        objectsLoaded: 0,
        error: 'В карте нет объектных XML со станциями'
      });
      return tracker.routeMapProbeCache[key];
    }
    tracker.routeMapProbeCache[key] = Promise.all(entries.map(function(entry) {
      return fetchText(entry.path).then(function(text) {
        return parseTrackObjectsXml(text, entry.key);
      }).catch(function(error) {
        return {
          all: [],
          bySector: {},
          error: error && error.message ? error.message : 'объекты не прочитаны'
        };
      });
    })).then(function(stores) {
      return {
        map: normalized,
        stations: collectRouteStationsFromStores(stores),
        objectsLoaded: stores.length
      };
    });
    return tracker.routeMapProbeCache[key];
  }

  function scoreMapForShiftRoute(map, route) {
    return loadMapRouteProbe(map).then(function(probe) {
      if (!probe || !route) return null;
      var fromMatch = findRouteStationInList(route.from, probe.stations);
      var toMatch = findRouteStationInList(route.to, probe.stations);
      var suggestion = buildBestShiftRouteSuggestion(route.details, route.from, route.to, probe.stations, probe.map);
      if (!suggestion) {
        return {
          status: 'unmatched',
          map: probe.map,
          fromMatch: fromMatch,
          toMatch: toMatch,
          stations: probe.stations.length,
          score: Math.min(fromMatch ? fromMatch.score : 0, toMatch ? toMatch.score : 0)
        };
      }
      suggestion.stations = probe.stations.length;
      suggestion.score = getShiftRouteSuggestionScore(suggestion);
      return suggestion;
    }).catch(function(error) {
      return {
        status: 'error',
        map: map,
        error: error && error.message ? error.message : 'маршрут не проверен',
        score: 0
      };
    });
  }

  function chooseBestRouteMapCandidate(candidates) {
    var ready = (Array.isArray(candidates) ? candidates : []).filter(function(item) {
      return item && item.status === 'ready' && item.map;
    });
    if (!ready.length) return null;
    ready.sort(function(a, b) {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (isCurrentMap(a.map) !== isCurrentMap(b.map)) return isCurrentMap(a.map) ? -1 : 1;
      return b.distance - a.distance;
    });
    return ready[0];
  }

  function getShiftRouteRequest(details) {
    var shift = details && details.shift;
    var from = shift && shift.route_from ? String(shift.route_from).trim() : '';
    var to = shift && shift.route_to ? String(shift.route_to).trim() : '';
    if (!shift || shift.route_kind !== 'trip' || (!from && !to)) return null;
    return {
      details: details,
      shift: shift,
      from: from,
      to: to
    };
  }

  function formatRouteMapCandidate(candidate) {
    if (!candidate || !candidate.map) return '—';
    var title = candidate.map.title || 'ЭК';
    if (candidate.status === 'ready') {
      return title + ' · ' + candidate.directionLabel + ' · ' + Math.round(candidate.confidence) + '%';
    }
    return title;
  }

  function maybeAutoSelectMapForShiftRoute(options) {
    options = options || {};
    if (tracker.routeMapSelecting || !tracker.availableMaps || tracker.availableMaps.length <= 1) {
      return Promise.resolve(false);
    }
    var details = getPoekhaliTrainDetails();
    var route = getShiftRouteRequest(details);
    if (!route) {
      tracker.routeMapCandidate = null;
      return Promise.resolve(false);
    }
    var maps = tracker.availableMaps.filter(function(map) {
      return getMapDownloadState(map) === 'ready';
    });
    if (!maps.length) return Promise.resolve(false);

    tracker.routeMapSelecting = true;
    tracker.routeMapLastCheckedAt = Date.now();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }

    return Promise.all(maps.map(function(map) {
      return scoreMapForShiftRoute(map, route);
    })).then(function(candidates) {
      var best = chooseBestRouteMapCandidate(candidates);
      tracker.routeMapCandidate = best || candidates.filter(Boolean).sort(function(a, b) {
        return (b.score || 0) - (a.score || 0);
      })[0] || null;
      if (!best) return false;

      if (!isCurrentMap(best.map)) {
        updateAutoPositionState('route-map-switch', {
          sector: best.sector,
          lineCoordinate: best.coordinate
        }, 'Переключаю ЭК по маршруту смены: ' + formatRouteMapCandidate(best) + '.');
        return selectMap(best.map, { keepPicker: true }).then(function() {
          if (options.applyPreview !== false) applyShiftRouteSuggestion();
          return true;
        });
      }
      if (options.applyPreview && (!tracker.projection || !tracker.projection.onTrack)) {
        applyShiftRouteSuggestion(best);
      }
      return false;
    }).catch(function(error) {
      tracker.routeMapCandidate = {
        status: 'error',
        error: error && error.message ? error.message : 'карта маршрута не подобрана'
      };
      return false;
    }).then(function(result) {
      tracker.routeMapSelecting = false;
      if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
        renderOpsSheet();
      }
      if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
        renderMapPicker();
      }
      requestDraw();
      return result;
    });
  }

  function getShiftRouteSuggestion() {
    var details = getPoekhaliTrainDetails();
    var route = getShiftRouteRequest(details);
    if (!route) {
      return {
        status: 'missing',
        details: details,
        message: details.hasShift ? 'В карточке смены не заполнен маршрут поездки.' : 'Сначала сохраните смену с маршрутом.'
      };
    }
    if (!tracker.assetsLoaded) {
      return {
        status: 'loading',
        details: details,
        fromText: route.from,
        toText: route.to,
        message: 'Карта еще загружается.'
      };
    }
    var stations = getRouteStationsFromCurrentMap();
    var fromMatch = findRouteStationInList(route.from, stations);
    var toMatch = findRouteStationInList(route.to, stations);
    var ready = buildBestShiftRouteSuggestion(details, route.from, route.to, stations, tracker.currentMap || DEFAULT_MAP);
    if (ready) return ready;

    var candidate = tracker.routeMapCandidate;
    var message = tracker.routeMapSelecting
      ? 'Проверяю маршрут по всем скачанным ЭК.'
      : candidate && candidate.status === 'ready' && candidate.map && !isCurrentMap(candidate.map)
        ? 'Маршрут найден в другой скачанной ЭК: ' + (candidate.map.title || 'Карта ЭК') + '.'
        : 'Маршрут из карточки не найден в текущей ЭК.';
    return {
      status: 'unmatched',
      details: details,
      fromText: route.from,
      toText: route.to,
      fromMatch: fromMatch,
      toMatch: toMatch,
      routeMapCandidate: candidate,
      message: message
    };
  }

  function applyShiftRouteSuggestion(suggestion) {
    var item = suggestion || getShiftRouteSuggestion();
    if (!item || item.status !== 'ready') return false;
    tracker.even = !!item.even;
    if (item.wayNumber) tracker.wayNumber = normalizeWayNumber(item.wayNumber);
    tracker.directionSource = 'route';
    tracker.manualDirectionLockedUntil = 0;
    setPreviewProjection({
      lineCoordinate: item.coordinate,
      sector: item.sector
    }, true);
    updateActiveRunNavigationState();
    updateModeButtons();
    requestDraw();
    return true;
  }

  function applyPreparedRouteBeforeRun() {
    var item = getShiftRouteSuggestion();
    if (!item || item.status !== 'ready') return false;
    var hasLiveProjection = tracker.projection && tracker.projection.onTrack;
    if (hasLiveProjection) {
      if (!tracker.directionSource || tracker.directionSource === 'route') {
        tracker.even = !!item.even;
        tracker.directionSource = 'route';
      }
      if (item.wayNumber) tracker.wayNumber = normalizeWayNumber(item.wayNumber);
      tracker.manualDirectionLockedUntil = 0;
      updateModeButtons();
      requestDraw();
      return true;
    }
    return applyShiftRouteSuggestion(item);
  }

  function getRunStartBlockedMessage(routeSuggestion, details) {
    if (!details || !details.hasShift) {
      return 'Для рабочей поездки выберите смену: данные поезда, локомотива и длины должны идти из карточки.';
    }
    if (!tracker.assetsLoaded) {
      return 'Карта ЭК еще загружается. Запуск станет доступен после готовности профиля.';
    }
    if (routeSuggestion && routeSuggestion.status === 'loading') {
      return routeSuggestion.message || 'Маршрут смены еще связывается с картой.';
    }
    if (routeSuggestion && routeSuggestion.status === 'missing') {
      return routeSuggestion.message || 'В карточке смены не заполнен маршрут поездки.';
    }
    if (routeSuggestion && routeSuggestion.status === 'unmatched') {
      return routeSuggestion.message || 'Маршрут смены не найден в скачанных ЭК.';
    }
    return 'Нет рабочей координаты: дождитесь GPS или привяжите маршрут смены к карте ЭК.';
  }

  function getRunStartReadiness() {
    var existingRun = getActiveRun();
    if (existingRun) {
      return {
        ready: true,
        reason: 'resume'
      };
    }

    var details = getPoekhaliTrainDetails();
    var routeSuggestion = getShiftRouteSuggestion();
    var liveProjection = tracker.projection && tracker.projection.onTrack ? tracker.projection : null;
    var livePoint = liveProjection ? createRunPoint(liveProjection, tracker.lastLocation) : null;

    if (!details || !details.hasShift) {
      return {
        ready: false,
        reason: 'missing-shift',
        routeSuggestion: routeSuggestion,
        message: getRunStartBlockedMessage(routeSuggestion, details)
      };
    }

    if (livePoint) {
      return {
        ready: true,
        reason: 'gps',
        projection: liveProjection,
        point: livePoint
      };
    }

    var routeApplied = applyPreparedRouteBeforeRun();
    var projection = getCurrentProjectionForForm();
    var point = createRunPoint(projection, tracker.lastLocation);
    if (routeApplied && point) {
      return {
        ready: true,
        reason: 'route',
        projection: projection,
        point: point
      };
    }

    return {
      ready: false,
      reason: routeSuggestion && routeSuggestion.status ? routeSuggestion.status : 'no-position',
      routeSuggestion: routeSuggestion,
      projection: projection,
      message: getRunStartBlockedMessage(routeSuggestion, details)
    };
  }

  function blockRunStart(readiness) {
    var info = readiness || {};
    var message = info.message || 'Поездку нельзя начать без смены, GPS или маршрута на карте.';
    tracker.runStartMessage = message;
    tracker.gpsError = message;
    tracker.status = 'run-blocked';
    tracker.timerRunning = false;
    tracker.timerStartedAt = 0;
    updateAutoPositionState('run-blocked', info.projection || tracker.nearestProjection || null, message);
    setGpsStatus('МАРШРУТ', 'is-error');
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
    updateModeButtons();
    requestDraw();
  }

  function getDirectionSourceLabel() {
    if (tracker.directionSource === 'gps') return 'GPS';
    if (tracker.directionSource === 'route') return 'маршрут';
    if (tracker.directionSource === 'manual') return 'ручн.';
    return 'по умолч.';
  }

  function updateAutoPositionState(status, projection, message) {
    var info = {
      status: status || 'idle',
      message: message || '',
      mapId: tracker.currentMap && tracker.currentMap.id ? tracker.currentMap.id : DEFAULT_MAP.id,
      mapTitle: tracker.currentMap && tracker.currentMap.title ? tracker.currentMap.title : 'Карта ЭК',
      sector: projection && isRealNumber(projection.sector) ? projection.sector : null,
      lineCoordinate: projection && isRealNumber(projection.lineCoordinate) ? projection.lineCoordinate : null,
      distance: projection && isFinite(projection.distance) ? Math.max(0, projection.distance) : null,
      secondDistance: projection && isFinite(projection.secondDistance) ? Math.max(0, projection.secondDistance) : null,
      accuracy: isFinite(tracker.accuracy) && tracker.accuracy > 0 ? tracker.accuracy : null,
      updatedAt: Date.now()
    };
    tracker.autoPosition = info;
    return info;
  }

  function inferDirectionFromGpsProjection(projection, coords) {
    if (!projection || !projection.onTrack || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return;
    var now = Date.now();
    var previous = tracker.lastDirectionProbe;
    tracker.lastDirectionProbe = {
      sector: projection.sector,
      lineCoordinate: projection.lineCoordinate,
      ts: now
    };
    if (tracker.manualDirectionLockedUntil && now < tracker.manualDirectionLockedUntil) return;
    if (!previous || getSectorKey(previous.sector) !== getSectorKey(projection.sector)) return;
    var delta = projection.lineCoordinate - previous.lineCoordinate;
    var dt = now - previous.ts;
    var speed = Number(coords && coords.speed);
    if (dt < GPS_DIRECTION_MIN_TIME_MS || Math.abs(delta) < GPS_DIRECTION_MIN_DELTA_M) return;
    if (isFinite(speed) && speed > 0 && speed < 0.6) return;
    var nextEven = delta > 0;
    if (tracker.even !== nextEven || tracker.directionSource !== 'gps') {
      tracker.even = nextEven;
      tracker.directionSource = 'gps';
      updateModeButtons();
    }
  }

  function getTrainLengthMeters() {
    return getPoekhaliTrainDetails().lengthMeters;
  }

  function formatPoekhaliCompositionLength(details) {
    var source = details || getPoekhaliTrainDetails();
    var length = Math.max(0, Math.round(Number(source && source.lengthMeters) || 0));
    if (!length) return '—';
    if (source && source.lengthSource === 'по осям') return '~' + length + ' м';
    if (source && (source.compositionType === 'loco' || source.compositionType === 'no-shift')) return 'лок. ' + length + ' м';
    if (source && source.compositionType === 'unknown-train') return 'нет длины';
    return length + ' м';
  }

  function formatPoekhaliCompositionTitle(details) {
    var source = details || getPoekhaliTrainDetails();
    var prefix = source && (source.compositionType === 'train' || source.compositionType === 'estimated' || source.compositionType === 'unknown-train')
      ? 'Состав '
      : 'Локомотив ';
    return prefix + formatPoekhaliCompositionLength(source);
  }

  function getWarningStorageScope() {
    return tracker.currentMap && tracker.currentMap.id ? tracker.currentMap.id : DEFAULT_MAP.id;
  }

  function normalizeDateValue(value) {
    var text = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }

  function getTodayDateString() {
    var date = new Date();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  function formatDateLabel(value) {
    var date = normalizeDateValue(value);
    if (!date) return '';
    var parts = date.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }

  function normalizeWarning(item) {
    if (!item || typeof item !== 'object') return null;
    var mapId = String(item.mapId || getWarningStorageScope());
    var sector = Number(item.sector);
    var start = normalizeOrdinate(item.start);
    var end = normalizeOrdinate(item.end);
    var speed = parseNumber(item.speed);
    if (!isRealNumber(sector) || !isFinite(start) || !isFinite(end) || !isFinite(speed)) return null;
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
    var meta = normalizeWarningSyncMeta(readJsonStorage(WARNINGS_SYNC_STORAGE_KEY, null));
    tracker.warningSync.pending = meta.pending;
    tracker.warningSync.lastSyncAt = meta.lastSyncAt;
    tracker.warningSync.error = meta.error;
    tracker.warningSync.state = meta.pending ? 'pending' : meta.lastSyncAt ? 'synced' : 'idle';
  }

  function saveWarningSyncState() {
    writeJsonStorage(WARNINGS_SYNC_STORAGE_KEY, {
      pending: !!tracker.warningSync.pending,
      lastSyncAt: tracker.warningSync.lastSyncAt || 0,
      error: tracker.warningSync.error || ''
    });
  }

  function setWarningSyncState(patch) {
    var next = patch || {};
    if (next.state !== undefined) tracker.warningSync.state = String(next.state || 'idle');
    if (next.pending !== undefined) tracker.warningSync.pending = !!next.pending;
    if (next.lastSyncAt !== undefined) tracker.warningSync.lastSyncAt = Math.max(0, Number(next.lastSyncAt) || 0);
    if (next.error !== undefined) tracker.warningSync.error = String(next.error || '').slice(0, 240);
    saveWarningSyncState();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
  }

  function getWarningApiUrl() {
    if (typeof POEKHALI_WARNINGS_API_URL === 'string' && POEKHALI_WARNINGS_API_URL) {
      return POEKHALI_WARNINGS_API_URL;
    }
    var base = typeof API_BASE_URL === 'string' ? API_BASE_URL : '';
    return base + '/api/poekhali-warnings';
  }

  function isWarningSyncAvailable() {
    return typeof fetchJson === 'function' && typeof navigator !== 'undefined';
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
    var raw = readJsonStorage(WARNINGS_STORAGE_KEY, []);
    tracker.warnings = normalizeWarningsList(raw);
  }

  function saveWarnings(options) {
    tracker.warnings = normalizeWarningsList(tracker.warnings);
    writeJsonStorage(WARNINGS_STORAGE_KEY, tracker.warnings);
    if (!(options && options.skipSync)) {
      setWarningSyncState({
        state: typeof navigator !== 'undefined' && navigator.onLine ? 'pending' : 'offline',
        pending: true,
        error: ''
      });
      scheduleWarningSync();
    }
    writeWarningsToLinkedShift();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
    requestDraw();
  }

  function scheduleWarningSync(delayMs) {
    if (!isWarningSyncAvailable()) return;
    if (tracker.warningSync.timer) {
      clearTimeout(tracker.warningSync.timer);
      tracker.warningSync.timer = null;
    }
    var delay = Number(delayMs);
    if (!isFinite(delay) || delay < 0) delay = WARNINGS_SYNC_DEBOUNCE_MS;
    tracker.warningSync.timer = setTimeout(function() {
      tracker.warningSync.timer = null;
      syncWarningsWithServer('scheduled');
    }, delay);
  }

  function syncWarningsWithServer(reason) {
    if (!isWarningSyncAvailable()) return Promise.resolve(false);
    if (tracker.warningSync.inFlight) {
      scheduleWarningSync(WARNINGS_SYNC_DEBOUNCE_MS);
      return Promise.resolve(false);
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (hasWarningsData(tracker.warnings) || tracker.warningSync.pending) {
        setWarningSyncState({ state: 'offline', pending: true, error: '' });
      }
      return Promise.resolve(false);
    }

    var apiUrl = getWarningApiUrl();
    var localBefore = normalizeWarningsList(tracker.warnings);
    tracker.warningSync.inFlight = true;
    setWarningSyncState({ state: reason === 'load' ? 'loading' : 'syncing', error: '' });

    return fetchJson(apiUrl, {
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
      var shouldPush = tracker.warningSync.pending || mergedJson !== remoteJson;

      if (localChanged) {
        tracker.warnings = mergedWarnings;
        saveWarnings({ skipSync: true });
      }

      if (!shouldPush) {
        tracker.warningSync.inFlight = false;
        setWarningSyncState({
          state: 'synced',
          pending: false,
          lastSyncAt: Date.now(),
          error: ''
        });
        return true;
      }

      return fetchJson(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ warnings: mergedWarnings })
      }, 9000).then(function(saveResult) {
        if (!saveResult.ok) {
          if (saveResult.status === 401) throw createWarningSyncError('Unauthorized', 'unauthorized');
          if (saveResult.status === 404) throw createWarningSyncError('Warnings sync unavailable', 'unavailable');
          throw new Error((saveResult.body && saveResult.body.error) || 'Warnings save failed');
        }
        tracker.warnings = normalizeWarningsList(saveResult.body && saveResult.body.warnings ? saveResult.body.warnings : mergedWarnings);
        saveWarnings({ skipSync: true });
        tracker.warningSync.inFlight = false;
        setWarningSyncState({
          state: 'synced',
          pending: false,
          lastSyncAt: Date.now(),
          error: ''
        });
        return true;
      });
    }).catch(function(error) {
      tracker.warningSync.inFlight = false;
      var unavailable = error && error.code === 'unavailable';
      setWarningSyncState({
        state: unavailable ? 'local' : 'error',
        pending: hasWarningsData(tracker.warnings) || tracker.warningSync.pending,
        error: unavailable ? '' : (error && error.message ? error.message : 'Warnings sync failed')
      });
      return false;
    });
  }

  function bindWarningSyncEvents() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('online', function() {
      if (tracker.warningSync.pending || hasWarningsData(tracker.warnings)) {
        scheduleWarningSync(250);
      }
    });
  }

  function normalizeRunPoint(point) {
    if (!point || typeof point !== 'object') return null;
    var sector = Number(point.sector);
    var coordinate = normalizeOrdinate(point.coordinate);
    if (!isRealNumber(sector) || !isFinite(coordinate)) return null;
    var kmPk = coordinateToKmPk(coordinate);
    var result = {
      sector: sector,
      coordinate: coordinate,
      km: kmPk.km,
      pk: kmPk.pk,
      ts: isFinite(Number(point.ts)) ? Number(point.ts) : Date.now()
    };
    if (isFinite(Number(point.lat))) result.lat = Number(point.lat);
    if (isFinite(Number(point.lon))) result.lon = Number(point.lon);
    if (isFinite(Number(point.accuracy))) result.accuracy = Math.max(0, Math.round(Number(point.accuracy)));
    if (isFinite(Number(point.speedKmh))) result.speedKmh = Math.max(0, Math.round(Number(point.speedKmh)));
    return result;
  }

  function calculateSpeedKmh(distanceMeters, durationMs) {
    var distance = Math.max(0, Number(distanceMeters) || 0);
    var duration = Math.max(0, Number(durationMs) || 0);
    if (!distance || duration <= 0) return 0;
    return Math.round((distance / 1000) / (duration / 3600000) * 10) / 10;
  }

  function getRunMetricDurationMs(run) {
    if (run && run.status === 'active' && tracker.timerRunning) return getTimerElapsed();
    return Math.max(0, Math.round(Number(run && run.durationMs) || 0));
  }

  function updateRunDerivedMetrics(run) {
    if (!run) return run;
    var durationMs = getRunMetricDurationMs(run);
    var movingMs = Math.max(0, Math.round(Number(run.movingDurationMs) || 0));
    var idleMs = Math.max(0, Math.round(Number(run.idleDurationMs) || 0));
    if (durationMs > 0 && movingMs + idleMs > durationMs + 1000) {
      var scale = durationMs / Math.max(1, movingMs + idleMs);
      movingMs = Math.round(movingMs * scale);
      idleMs = Math.max(0, durationMs - movingMs);
    }
    run.durationMs = durationMs;
    run.movingDurationMs = movingMs;
    run.idleDurationMs = idleMs;
    run.averageSpeedKmh = calculateSpeedKmh(run.distanceMeters, durationMs);
    run.technicalSpeedKmh = calculateSpeedKmh(run.distanceMeters, movingMs || durationMs);
    return run;
  }

  function getPointSector(point) {
    return point && isRealNumber(point.sector) ? point.sector : null;
  }

  function getPointCoordinate(point) {
    return point && isRealNumber(point.coordinate) ? Math.max(0, Math.round(point.coordinate)) : null;
  }

  function getShiftRunNumber(value) {
    var number = Number(value);
    return isFinite(number) ? Math.max(0, Math.round(number)) : 0;
  }

  function buildPoekhaliShiftPatch(run) {
    var normalized = updateRunDerivedMetrics(run);
    if (!normalized) return null;
    var endPoint = normalized.endPoint || normalized.lastPoint || null;
    return {
      poekhali_run_id: String(normalized.id || ''),
      poekhali_status: String(normalized.status || ''),
      poekhali_map_id: String(normalized.mapId || getWarningStorageScope()),
      poekhali_map_title: String(normalized.mapTitle || (tracker.currentMap && tracker.currentMap.title) || ''),
      poekhali_direction: String(normalized.direction || (tracker.even ? 'ЧЕТ' : 'НЕЧЕТ')),
      poekhali_track: String(normalized.track || getCurrentTrackLabel()),
      poekhali_started_at: String(normalized.startedAt || ''),
      poekhali_ended_at: String(normalized.endedAt || ''),
      poekhali_updated_at: String(normalized.updatedAt || new Date().toISOString()),
      poekhali_duration_ms: getShiftRunNumber(normalized.durationMs),
      poekhali_moving_ms: getShiftRunNumber(normalized.movingDurationMs),
      poekhali_idle_ms: getShiftRunNumber(normalized.idleDurationMs),
      poekhali_distance_m: getShiftRunNumber(normalized.distanceMeters),
      poekhali_average_speed_kmh: Math.max(0, Math.round((Number(normalized.averageSpeedKmh) || 0) * 10) / 10),
      poekhali_technical_speed_kmh: Math.max(0, Math.round((Number(normalized.technicalSpeedKmh) || 0) * 10) / 10),
      poekhali_max_speed_kmh: getShiftRunNumber(normalized.maxSpeedKmh),
      poekhali_overspeed_max_kmh: getShiftRunNumber(normalized.overspeedMaxKmh),
      poekhali_overspeed_duration_ms: getShiftRunNumber(normalized.overspeedDurationMs),
      poekhali_overspeed_distance_m: getShiftRunNumber(normalized.overspeedDistanceMeters),
      poekhali_warnings_count: getShiftRunNumber(normalized.warningsCount),
      poekhali_alert_count: getShiftRunNumber(normalized.alertCount),
      poekhali_last_alert_kind: String(normalized.lastAlertKind || ''),
      poekhali_last_alert_level: String(normalized.lastAlertLevel || ''),
      poekhali_last_alert_title: String(normalized.lastAlertTitle || ''),
      poekhali_last_alert_text: String(normalized.lastAlertText || ''),
      poekhali_last_alert_distance_m: getShiftRunNumber(normalized.lastAlertDistanceMeters),
      poekhali_last_alert_at: String(normalized.lastAlertAt || ''),
      poekhali_active_restriction_label: String(normalized.activeRestrictionLabel || ''),
      poekhali_active_restriction_source: String(normalized.activeRestrictionSource || ''),
      poekhali_active_restriction_speed_kmh: getShiftRunNumber(normalized.activeRestrictionSpeedKmh),
      poekhali_active_restriction_sector: getShiftRunNumber(normalized.activeRestrictionSector),
      poekhali_active_restriction_start: getShiftRunNumber(normalized.activeRestrictionStart),
      poekhali_active_restriction_end: getShiftRunNumber(normalized.activeRestrictionEnd),
      poekhali_active_restriction_distance_m: getShiftRunNumber(normalized.activeRestrictionDistanceToEnd),
      poekhali_active_restriction_updated_at: String(normalized.activeRestrictionUpdatedAt || ''),
      poekhali_next_restriction_label: String(normalized.nextRestrictionLabel || ''),
      poekhali_next_restriction_source: String(normalized.nextRestrictionSource || ''),
      poekhali_next_restriction_speed_kmh: getShiftRunNumber(normalized.nextRestrictionSpeedKmh),
      poekhali_next_restriction_sector: getShiftRunNumber(normalized.nextRestrictionSector),
      poekhali_next_restriction_coordinate: getShiftRunNumber(normalized.nextRestrictionCoordinate),
      poekhali_next_restriction_distance_m: getShiftRunNumber(normalized.nextRestrictionDistanceMeters),
      poekhali_next_restriction_eta_s: getShiftRunNumber(normalized.nextRestrictionEtaSeconds),
      poekhali_next_restriction_updated_at: String(normalized.nextRestrictionUpdatedAt || ''),
      poekhali_next_signal_name: String(normalized.nextSignalName || ''),
      poekhali_next_signal_source: String(normalized.nextSignalSource || ''),
      poekhali_next_signal_sector: getShiftRunNumber(normalized.nextSignalSector),
      poekhali_next_signal_coordinate: getShiftRunNumber(normalized.nextSignalCoordinate),
      poekhali_next_signal_distance_m: getShiftRunNumber(normalized.nextSignalDistanceMeters),
      poekhali_next_signal_eta_s: getShiftRunNumber(normalized.nextSignalEtaSeconds),
      poekhali_next_station_name: String(normalized.nextStationName || ''),
      poekhali_next_station_source: String(normalized.nextStationSource || ''),
      poekhali_next_station_sector: getShiftRunNumber(normalized.nextStationSector),
      poekhali_next_station_coordinate: getShiftRunNumber(normalized.nextStationCoordinate),
      poekhali_next_station_distance_m: getShiftRunNumber(normalized.nextStationDistanceMeters),
      poekhali_next_station_eta_s: getShiftRunNumber(normalized.nextStationEtaSeconds),
      poekhali_next_target_kind: String(normalized.nextTargetKind || ''),
      poekhali_next_target_label: String(normalized.nextTargetLabel || ''),
      poekhali_next_target_source: String(normalized.nextTargetSource || ''),
      poekhali_next_target_sector: getShiftRunNumber(normalized.nextTargetSector),
      poekhali_next_target_coordinate: getShiftRunNumber(normalized.nextTargetCoordinate),
      poekhali_next_target_distance_m: getShiftRunNumber(normalized.nextTargetDistanceMeters),
      poekhali_next_target_eta_s: getShiftRunNumber(normalized.nextTargetEtaSeconds),
      poekhali_next_target_updated_at: String(normalized.nextTargetUpdatedAt || ''),
      poekhali_route_from_name: String(normalized.routeFromName || ''),
      poekhali_route_to_name: String(normalized.routeToName || ''),
      poekhali_route_status: String(normalized.routeStatus || ''),
      poekhali_route_from_coordinate: getShiftRunNumber(normalized.routeFromCoordinate),
      poekhali_route_to_coordinate: getShiftRunNumber(normalized.routeToCoordinate),
      poekhali_route_distance_m: getShiftRunNumber(normalized.routeDistanceMeters),
      poekhali_route_passed_m: getShiftRunNumber(normalized.routePassedMeters),
      poekhali_route_remaining_m: getShiftRunNumber(normalized.routeRemainingMeters),
      poekhali_route_outside_m: getShiftRunNumber(normalized.routeOutsideMeters),
      poekhali_route_progress_pct: Math.max(0, Math.min(100, Math.round((Number(normalized.routeProgressPct) || 0) * 10) / 10)),
      poekhali_route_eta_s: getShiftRunNumber(normalized.routeEtaSeconds),
      poekhali_train_length_m: getShiftRunNumber(normalized.lengthMeters),
      poekhali_train_length_source: String(normalized.lengthSource || ''),
      poekhali_train_length_label: String(normalized.lengthLabel || ''),
      poekhali_train_composition_type: String(normalized.compositionType || ''),
      poekhali_train_composition_status: String(normalized.compositionReadiness || ''),
      poekhali_start_sector: getPointSector(normalized.startPoint),
      poekhali_start_coordinate: getPointCoordinate(normalized.startPoint),
      poekhali_end_sector: getPointSector(endPoint),
      poekhali_end_coordinate: getPointCoordinate(endPoint)
    };
  }

  function findShiftForRun(run) {
    if (run && run.shiftId) {
      var linked = findShiftByGlobalId(run.shiftId);
      if (linked) return linked;
    }
    var details = getPoekhaliTrainDetails();
    return details && details.shift ? details.shift : null;
  }

  function findRunById(runId) {
    var target = String(runId || '').trim();
    if (!target) return null;
    var source = Array.isArray(tracker.runs) ? tracker.runs : [];
    for (var i = 0; i < source.length; i++) {
      if (source[i] && String(source[i].id || '') === target) return source[i];
    }
    return null;
  }

  function getSourceKeyShift(section) {
    var key = String(section && section.sourceTrackKey || '').trim();
    if (!key) return null;
    if (key.indexOf('shift-') === 0) {
      return findShiftByGlobalId(key.slice(6));
    }
    if (key.indexOf('run-') === 0) {
      var candidates = [key.slice(4), key];
      if (key.indexOf('run-run-') === 0) candidates.push(key.slice(4));
      for (var i = 0; i < candidates.length; i++) {
        var run = findRunById(candidates[i]);
        if (run) return findShiftForRun(run);
      }
      var runs = Array.isArray(tracker.runs) ? tracker.runs : [];
      for (var r = 0; r < runs.length; r++) {
        if (runs[r] && runs[r].id && key.indexOf(String(runs[r].id)) >= 0) {
          return findShiftForRun(runs[r]);
        }
      }
    }
    return null;
  }

  function findShiftForUserSection(section) {
    var bySource = getSourceKeyShift(section);
    if (bySource) return bySource;
    var context = getPoekhaliShiftContext();
    return context && context.shift ? context.shift : null;
  }

  function buildPoekhaliUserSectionShiftPatch(section) {
    if (!section || !section.id) return null;
    var quality = getUserSectionQuality(section);
    var bounds = getUserSectionBounds(section);
    return {
      poekhali_user_section_id: String(section.id || ''),
      poekhali_user_section_title: String(section.title || ''),
      poekhali_user_section_map_id: String(section.mapId || getLearningMapScope()),
      poekhali_user_section_sector: getShiftRunNumber(section.sector),
      poekhali_user_section_reference_sector: isRealNumber(getUserSectionReferenceSector(section))
        ? getUserSectionReferenceSector(section)
        : null,
      poekhali_user_section_status: getUserSectionVerificationState(section),
      poekhali_user_section_updated_at: section.updatedAt ? new Date(section.updatedAt).toISOString() : '',
      poekhali_user_section_verified_at: section.verifiedAt ? new Date(section.verifiedAt).toISOString() : '',
      poekhali_user_section_start_coordinate: bounds ? getShiftRunNumber(bounds.left) : 0,
      poekhali_user_section_end_coordinate: bounds ? getShiftRunNumber(bounds.right) : 0,
      poekhali_user_section_route_points: quality.routePoints,
      poekhali_user_section_profile_segments: quality.profileSegments,
      poekhali_user_section_stations_count: quality.stations,
      poekhali_user_section_signals_count: quality.signals,
      poekhali_user_section_speeds_count: quality.speeds,
      poekhali_user_section_objects_count: quality.stations + quality.signals,
      poekhali_user_section_ready: !!quality.ready
    };
  }

  function getWarningsForShiftSnapshot(shift, includeInactive) {
    if (!shift || !shift.id) return [];
    var shiftId = String(shift.id);
    var scope = getWarningStorageScope();
    return tracker.warnings.filter(function(item) {
      if (!item || item.deletedAt) return false;
      if (item.mapId !== scope) return false;
      if (String(item.shiftId || '') !== shiftId) return false;
      if (!includeInactive && !isWarningUsable(item)) return false;
      return true;
    });
  }

  function formatWarningShiftRange(item) {
    var start = coordinateToKmPk(item && item.start);
    var end = coordinateToKmPk(item && item.end);
    var startText = start.km + ' км ' + start.pk + ' пк';
    var endText = end.km + ' км ' + end.pk + ' пк';
    return startText === endText ? startText : startText + '-' + endText;
  }

  function formatWarningShiftSummary(item) {
    if (!item) return '';
    var parts = [
      'уч. ' + Math.round(Number(item.sector) || 0),
      formatWarningShiftRange(item),
      'до ' + Math.round(Number(item.speed) || 0)
    ];
    var note = String(item.note || item.name || '').trim();
    if (note) parts.push(note.slice(0, 48));
    return parts.join(' · ');
  }

  function buildPoekhaliWarningsShiftPatch(shift) {
    if (!shift || !shift.id) return null;
    var warnings = getWarningsForShiftSnapshot(shift, true);
    var activeWarnings = warnings.filter(isWarningUsable);
    var disabledCount = Math.max(0, warnings.length - activeWarnings.length);
    var summary = activeWarnings.slice(0, 3).map(formatWarningShiftSummary).filter(Boolean).join('; ');
    if (activeWarnings.length > 3) summary += '; +' + (activeWarnings.length - 3);
    return {
      poekhali_warning_rules_map_id: getWarningStorageScope(),
      poekhali_warning_rules_map_title: String((tracker.currentMap && tracker.currentMap.title) || DEFAULT_MAP.title || ''),
      poekhali_warning_rules_count: getShiftRunNumber(warnings.length),
      poekhali_warning_rules_active_count: getShiftRunNumber(activeWarnings.length),
      poekhali_warning_rules_disabled_count: getShiftRunNumber(disabledCount),
      poekhali_warning_rules_summary: summary,
      poekhali_warning_rules_updated_at: new Date().toISOString()
    };
  }

  function writeWarningsToLinkedShift(options) {
    if (typeof allShifts === 'undefined' || !Array.isArray(allShifts)) return false;
    var context = getPoekhaliShiftContext();
    var shift = context && context.shift ? context.shift : null;
    if (!shift || !shift.id) return false;
    var patch = buildPoekhaliWarningsShiftPatch(shift);
    if (!patch || (!isPoekhaliShiftPatchChanged(shift, patch) && !(options && options.force))) return false;
    Object.keys(patch).forEach(function(key) {
      shift[key] = patch[key];
    });
    try {
      if (typeof pendingMutationIds !== 'undefined') {
        pendingMutationIds = [String(shift.id)];
      }
      if (typeof saveShifts === 'function') {
        saveShifts();
      } else if (typeof render === 'function') {
        render();
      }
    } catch (error) {
      console.warn('Poekhali warnings shift write failed:', error);
      return false;
    }
    return true;
  }

  function writeUserSectionToLinkedShift(section, options) {
    if (!section || !section.id) return false;
    if (typeof allShifts === 'undefined' || !Array.isArray(allShifts)) return false;
    var shift = findShiftForUserSection(section);
    if (!shift || !shift.id) return false;
    var patch = buildPoekhaliUserSectionShiftPatch(section);
    if (!patch || (!isPoekhaliShiftPatchChanged(shift, patch) && !(options && options.force))) return false;
    Object.keys(patch).forEach(function(key) {
      shift[key] = patch[key];
    });
    try {
      if (typeof pendingMutationIds !== 'undefined') {
        pendingMutationIds = [String(shift.id)];
      }
      if (typeof saveShifts === 'function') {
        saveShifts();
      } else if (typeof render === 'function') {
        render();
      }
    } catch (error) {
      console.warn('Poekhali user section shift write failed:', error);
      return false;
    }
    return true;
  }

  function isPoekhaliShiftPatchChanged(shift, patch) {
    if (!shift || !patch) return false;
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (patch[key] === null || patch[key] === undefined) {
        if (shift[key] !== null && shift[key] !== undefined && shift[key] !== '') return true;
      } else if (shift[key] !== patch[key]) {
        return true;
      }
    }
    return false;
  }

  function writeRunToLinkedShift(run, options) {
    if (!run) return false;
    var opts = options || {};
    var now = Date.now();
    var throttleMs = Math.max(0, Number(opts.throttleMs) || 0);
    if (!opts.force && throttleMs && tracker.lastShiftRunWriteAt && now - tracker.lastShiftRunWriteAt < throttleMs) {
      return false;
    }
    if (typeof allShifts === 'undefined' || !Array.isArray(allShifts)) return false;
    var shift = findShiftForRun(run);
    if (!shift || !shift.id) return false;
    var linkedRunToShift = false;
    if (!run.shiftId) {
      run.shiftId = String(shift.id);
      linkedRunToShift = true;
    }
    var patch = buildPoekhaliShiftPatch(run);
    var patchChanged = patch && isPoekhaliShiftPatchChanged(shift, patch);
    if (!patch || (!patchChanged && !linkedRunToShift)) return false;
    if (patchChanged) {
      Object.keys(patch).forEach(function(key) {
        shift[key] = patch[key];
      });
      tracker.lastShiftRunWriteAt = now;
    }

    try {
      if (linkedRunToShift) {
        saveRuns();
      }
      if (patchChanged && typeof pendingMutationIds !== 'undefined') {
        pendingMutationIds = [String(shift.id)];
      }
      if (patchChanged && typeof saveShifts === 'function') {
        saveShifts();
      } else if (patchChanged && typeof render === 'function') {
        render();
      }
    } catch (error) {
      console.warn('Poekhali shift write failed:', error);
      return false;
    }
    return true;
  }

  function applyShiftDetailsToRun(run, details) {
    if (!run || !details || !details.shift) return false;
    run.shiftId = String(details.shift.id || '');
    run.route = details.route || '';
    run.trainNumber = details.trainNumber || '';
    run.loco = details.loco || '';
    run.weight = details.weight || '';
    run.axles = details.axles || '';
    run.conditionalLength = details.conditionalLength || 0;
    run.lengthMeters = details.lengthMeters || 0;
    run.lengthLabel = details.lengthLabel || '';
    run.lengthSource = details.lengthSource || '';
    run.compositionType = details.compositionType || '';
    run.compositionReadiness = details.compositionReadiness || '';
    run.updatedAt = new Date().toISOString();
    updateRunDerivedMetrics(run);
    return true;
  }

  function selectPoekhaliShift(shiftId, options) {
    var shift = findShiftInListById(getPoekhaliCandidateShifts(), shiftId);
    if (!shift || !shift.id) return false;
    setSelectedPoekhaliShiftId(shift.id);
    tracker.routeMapCandidate = null;

    var run = getActiveRun();
    if (run) {
      run.shiftId = String(shift.id);
      applyShiftDetailsToRun(run, getPoekhaliTrainDetails());
      saveRuns();
      writeRunToLinkedShift(run, { force: true });
    } else {
      writeWarningsToLinkedShift();
    }

    if (!(options && options.skipRoutePreview)) {
      maybeAutoSelectMapForShiftRoute({ applyPreview: true });
    }
    setOpsButton();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
    requestDraw();
    return true;
  }

  function preparePoekhaliModeEntry(options) {
    options = options || {};
    var pinnedShiftId = options.pinnedShiftId || tracker.entryShiftLockId || '';
    tracker.entryShiftLockId = '';
    var context = getPoekhaliEntryShiftContext(pinnedShiftId);
    var shift = context && context.shift ? context.shift : null;
    var run = getActiveRun();

    if (shift && shift.id) {
      if (run && !run.shiftId) {
        run.shiftId = String(shift.id);
        applyShiftDetailsToRun(run, getPoekhaliTrainDetails());
        saveRuns();
        writeRunToLinkedShift(run, { force: true });
      } else if (!run) {
        if (context.source !== 'selected' && context.source !== 'recording') {
          setSelectedPoekhaliShiftId(shift.id);
          tracker.routeMapCandidate = null;
        }
        writeWarningsToLinkedShift();
      }
    } else {
      tracker.routeMapCandidate = null;
    }

    updateModeButtons();
    setOpsButton();
    requestDraw();

    return loadManifest()
      .then(function() {
        return maybeAutoSelectMapForShiftRoute({ applyPreview: true });
      })
      .catch(function(error) {
        console.warn('Poekhali entry route preparation failed:', error);
        return false;
      })
      .then(function() {
        return options.loadAssets === false ? false : loadAssets();
      })
      .then(function() {
        updateModeButtons();
        setOpsButton();
        requestDraw();
        return true;
      });
  }

  function openPoekhaliForShift(shiftId) {
    var selected = selectPoekhaliShift(shiftId, { skipRoutePreview: true });
    if (selected) tracker.entryShiftLockId = String(shiftId || '');
    closeMapPicker();
    closeOpsSheet();
    if (typeof closeShiftDetail === 'function') {
      closeShiftDetail({ immediate: true, force: true });
    }
    if (typeof setActiveTab === 'function') setActiveTab('poekhali');
    updateModeButtons();
    setOpsButton();
    requestDraw();
    if (!selected) return false;

    preparePoekhaliModeEntry({ pinnedShiftId: shiftId });

    return true;
  }

  function normalizeRun(item) {
    if (!item || typeof item !== 'object') return null;
    var id = String(item.id || '').trim();
    if (!id) return null;
    var nowIso = new Date().toISOString();
    var status = String(item.status || 'finished');
    if (status !== 'active' && status !== 'paused' && status !== 'finished') status = 'finished';
    var normalized = {
      id: id,
      shiftId: String(item.shiftId || ''),
      mapId: String(item.mapId || getWarningStorageScope()),
      mapTitle: String(item.mapTitle || ''),
      route: String(item.route || ''),
      trainNumber: String(item.trainNumber || ''),
      loco: String(item.loco || ''),
      weight: String(item.weight || ''),
      axles: String(item.axles || ''),
      conditionalLength: Math.max(0, Math.round(Number(item.conditionalLength) || 0)),
      lengthMeters: Math.max(0, Math.round(Number(item.lengthMeters) || 0)),
      lengthLabel: String(item.lengthLabel || ''),
      lengthSource: String(item.lengthSource || ''),
      compositionType: String(item.compositionType || ''),
      compositionReadiness: String(item.compositionReadiness || ''),
      direction: String(item.direction || ''),
      track: String(item.track || ''),
      status: status,
      startedAt: String(item.startedAt || item.createdAt || nowIso),
      endedAt: String(item.endedAt || ''),
      durationMs: Math.max(0, Math.round(Number(item.durationMs) || 0)),
      movingDurationMs: Math.max(0, Math.round(Number(item.movingDurationMs) || 0)),
      idleDurationMs: Math.max(0, Math.round(Number(item.idleDurationMs) || 0)),
      distanceMeters: Math.max(0, Math.round(Number(item.distanceMeters) || 0)),
      maxSpeedKmh: Math.max(0, Math.round(Number(item.maxSpeedKmh) || 0)),
      averageSpeedKmh: Math.max(0, Number(item.averageSpeedKmh) || 0),
      technicalSpeedKmh: Math.max(0, Number(item.technicalSpeedKmh) || 0),
      overspeedMaxKmh: Math.max(0, Math.round(Number(item.overspeedMaxKmh) || 0)),
      overspeedDurationMs: Math.max(0, Math.round(Number(item.overspeedDurationMs) || 0)),
      overspeedDistanceMeters: Math.max(0, Math.round(Number(item.overspeedDistanceMeters) || 0)),
      warningsCount: Math.max(0, Math.round(Number(item.warningsCount) || 0)),
      alertCount: Math.max(0, Math.round(Number(item.alertCount) || 0)),
      lastAlertKind: String(item.lastAlertKind || ''),
      lastAlertLevel: String(item.lastAlertLevel || ''),
      lastAlertTitle: String(item.lastAlertTitle || ''),
      lastAlertText: String(item.lastAlertText || ''),
      lastAlertDistanceMeters: Math.max(0, Math.round(Number(item.lastAlertDistanceMeters) || 0)),
      lastAlertAt: String(item.lastAlertAt || ''),
      activeRestrictionLabel: String(item.activeRestrictionLabel || ''),
      activeRestrictionSource: String(item.activeRestrictionSource || ''),
      activeRestrictionSpeedKmh: Math.max(0, Math.round(Number(item.activeRestrictionSpeedKmh) || 0)),
      activeRestrictionSector: Math.max(0, Math.round(Number(item.activeRestrictionSector) || 0)),
      activeRestrictionStart: Math.max(0, Math.round(Number(item.activeRestrictionStart) || 0)),
      activeRestrictionEnd: Math.max(0, Math.round(Number(item.activeRestrictionEnd) || 0)),
      activeRestrictionDistanceToEnd: Math.max(0, Math.round(Number(item.activeRestrictionDistanceToEnd) || 0)),
      activeRestrictionUpdatedAt: String(item.activeRestrictionUpdatedAt || ''),
      nextRestrictionLabel: String(item.nextRestrictionLabel || ''),
      nextRestrictionSource: String(item.nextRestrictionSource || ''),
      nextRestrictionSpeedKmh: Math.max(0, Math.round(Number(item.nextRestrictionSpeedKmh) || 0)),
      nextRestrictionSector: Math.max(0, Math.round(Number(item.nextRestrictionSector) || 0)),
      nextRestrictionCoordinate: Math.max(0, Math.round(Number(item.nextRestrictionCoordinate) || 0)),
      nextRestrictionDistanceMeters: Math.max(0, Math.round(Number(item.nextRestrictionDistanceMeters) || 0)),
      nextRestrictionEtaSeconds: Math.max(0, Math.round(Number(item.nextRestrictionEtaSeconds) || 0)),
      nextRestrictionUpdatedAt: String(item.nextRestrictionUpdatedAt || ''),
      nextSignalName: String(item.nextSignalName || ''),
      nextSignalSource: String(item.nextSignalSource || ''),
      nextSignalSector: Math.max(0, Math.round(Number(item.nextSignalSector) || 0)),
      nextSignalCoordinate: Math.max(0, Math.round(Number(item.nextSignalCoordinate) || 0)),
      nextSignalDistanceMeters: Math.max(0, Math.round(Number(item.nextSignalDistanceMeters) || 0)),
      nextSignalEtaSeconds: Math.max(0, Math.round(Number(item.nextSignalEtaSeconds) || 0)),
      nextStationName: String(item.nextStationName || ''),
      nextStationSource: String(item.nextStationSource || ''),
      nextStationSector: Math.max(0, Math.round(Number(item.nextStationSector) || 0)),
      nextStationCoordinate: Math.max(0, Math.round(Number(item.nextStationCoordinate) || 0)),
      nextStationDistanceMeters: Math.max(0, Math.round(Number(item.nextStationDistanceMeters) || 0)),
      nextStationEtaSeconds: Math.max(0, Math.round(Number(item.nextStationEtaSeconds) || 0)),
      nextTargetKind: String(item.nextTargetKind || ''),
      nextTargetLabel: String(item.nextTargetLabel || ''),
      nextTargetSource: String(item.nextTargetSource || ''),
      nextTargetSector: Math.max(0, Math.round(Number(item.nextTargetSector) || 0)),
      nextTargetCoordinate: Math.max(0, Math.round(Number(item.nextTargetCoordinate) || 0)),
      nextTargetDistanceMeters: Math.max(0, Math.round(Number(item.nextTargetDistanceMeters) || 0)),
      nextTargetEtaSeconds: Math.max(0, Math.round(Number(item.nextTargetEtaSeconds) || 0)),
      nextTargetUpdatedAt: String(item.nextTargetUpdatedAt || ''),
      routeFromName: String(item.routeFromName || ''),
      routeToName: String(item.routeToName || ''),
      routeStatus: String(item.routeStatus || ''),
      routeFromCoordinate: Math.max(0, Math.round(Number(item.routeFromCoordinate) || 0)),
      routeToCoordinate: Math.max(0, Math.round(Number(item.routeToCoordinate) || 0)),
      routeDistanceMeters: Math.max(0, Math.round(Number(item.routeDistanceMeters) || 0)),
      routePassedMeters: Math.max(0, Math.round(Number(item.routePassedMeters) || 0)),
      routeRemainingMeters: Math.max(0, Math.round(Number(item.routeRemainingMeters) || 0)),
      routeOutsideMeters: Math.max(0, Math.round(Number(item.routeOutsideMeters) || 0)),
      routeProgressPct: Math.max(0, Math.min(100, Number(item.routeProgressPct) || 0)),
      routeEtaSeconds: Math.max(0, Math.round(Number(item.routeEtaSeconds) || 0)),
      startPoint: normalizeRunPoint(item.startPoint),
      endPoint: normalizeRunPoint(item.endPoint || item.lastPoint),
      lastPoint: normalizeRunPoint(item.lastPoint || item.endPoint || item.startPoint),
      createdAt: String(item.createdAt || item.startedAt || nowIso),
      updatedAt: String(item.updatedAt || item.endedAt || item.startedAt || nowIso),
      deletedAt: String(item.deletedAt || '')
    };
    return updateRunDerivedMetrics(normalized);
  }

  function normalizeRunsList(raw) {
    var items = Array.isArray(raw) ? raw : [];
    return items.map(normalizeRun).filter(Boolean).sort(function(a, b) {
      var aTime = Date.parse(a.startedAt || a.createdAt || '') || 0;
      var bTime = Date.parse(b.startedAt || b.createdAt || '') || 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }).slice(0, RUNS_MAX_ITEMS);
  }

  function normalizeRunSyncMeta(raw) {
    var meta = raw && typeof raw === 'object' ? raw : {};
    return {
      pending: !!meta.pending,
      lastSyncAt: Math.max(0, Number(meta.lastSyncAt) || 0),
      error: String(meta.error || '').slice(0, 240)
    };
  }

  function loadRunSyncState() {
    var meta = normalizeRunSyncMeta(readJsonStorage(RUNS_SYNC_STORAGE_KEY, null));
    tracker.runSync.pending = meta.pending;
    tracker.runSync.lastSyncAt = meta.lastSyncAt;
    tracker.runSync.error = meta.error;
    tracker.runSync.state = meta.pending ? 'pending' : meta.lastSyncAt ? 'synced' : 'idle';
  }

  function saveRunSyncState() {
    writeJsonStorage(RUNS_SYNC_STORAGE_KEY, {
      pending: !!tracker.runSync.pending,
      lastSyncAt: tracker.runSync.lastSyncAt || 0,
      error: tracker.runSync.error || ''
    });
  }

  function setRunSyncState(patch) {
    var next = patch || {};
    if (next.state !== undefined) tracker.runSync.state = String(next.state || 'idle');
    if (next.pending !== undefined) tracker.runSync.pending = !!next.pending;
    if (next.lastSyncAt !== undefined) tracker.runSync.lastSyncAt = Math.max(0, Number(next.lastSyncAt) || 0);
    if (next.error !== undefined) tracker.runSync.error = String(next.error || '').slice(0, 240);
    saveRunSyncState();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
  }

  function getRunsApiUrl() {
    if (typeof POEKHALI_RUNS_API_URL === 'string' && POEKHALI_RUNS_API_URL) {
      return POEKHALI_RUNS_API_URL;
    }
    var base = typeof API_BASE_URL === 'string' ? API_BASE_URL : '';
    return base + '/api/poekhali-runs';
  }

  function isRunSyncAvailable() {
    return typeof fetchJson === 'function' && typeof navigator !== 'undefined';
  }

  function createRunSyncError(message, code) {
    var error = new Error(message || 'Runs sync failed');
    error.code = code || '';
    return error;
  }

  function getRunRevisionTime(item) {
    if (!item) return 0;
    var candidates = [item.deletedAt, item.updatedAt, item.endedAt, item.startedAt, item.createdAt];
    for (var i = 0; i < candidates.length; i++) {
      var ts = Date.parse(candidates[i] || '');
      if (isFinite(ts)) return ts;
    }
    return 0;
  }

  function mergeRunsLists(baseRuns, incomingRuns) {
    var base = normalizeRunsList(baseRuns);
    var incoming = normalizeRunsList(incomingRuns);
    var byId = {};

    function put(item, preferExistingOnTie) {
      if (!item || !item.id) return;
      var existing = byId[item.id];
      if (!existing) {
        byId[item.id] = item;
        return;
      }
      var existingTime = getRunRevisionTime(existing);
      var nextTime = getRunRevisionTime(item);
      if (nextTime > existingTime || (nextTime === existingTime && !preferExistingOnTie)) {
        byId[item.id] = item;
      }
    }

    for (var i = 0; i < incoming.length; i++) put(incoming[i], false);
    for (var j = 0; j < base.length; j++) put(base[j], true);
    return normalizeRunsList(Object.keys(byId).map(function(id) { return byId[id]; }));
  }

  function hasRunsData(runs) {
    return normalizeRunsList(runs).length > 0;
  }

  function getActiveRun() {
    if (tracker.activeRunId) {
      for (var i = 0; i < tracker.runs.length; i++) {
        if (tracker.runs[i] && tracker.runs[i].id === tracker.activeRunId && !tracker.runs[i].deletedAt && tracker.runs[i].status !== 'finished') {
          return tracker.runs[i];
        }
      }
    }
    for (var j = 0; j < tracker.runs.length; j++) {
      if (tracker.runs[j] && !tracker.runs[j].deletedAt && tracker.runs[j].status !== 'finished') {
        tracker.activeRunId = tracker.runs[j].id;
        return tracker.runs[j];
      }
    }
    tracker.activeRunId = '';
    return null;
  }

  function restoreTimerFromActiveRun() {
    var run = getActiveRun();
    if (!run) return;
    applyRunNavigationState(run);
    var durationMs = Math.max(0, Math.round(Number(run.durationMs) || 0));
    if (run.status === 'active') {
      var updatedAt = Date.parse(run.updatedAt || run.startedAt || '');
      var carriedMs = isFinite(updatedAt) ? Math.max(0, Date.now() - updatedAt) : 0;
      tracker.timerElapsedMs = durationMs + Math.min(carriedMs, 24 * 60 * 60 * 1000);
      tracker.timerStartedAt = Date.now();
      tracker.timerRunning = true;
      updateRunDerivedMetrics(run);
      return;
    }
    if (run.status === 'paused') {
      tracker.timerElapsedMs = durationMs;
      tracker.timerStartedAt = 0;
      tracker.timerRunning = false;
    }
  }

  function loadRuns() {
    loadRunSyncState();
    tracker.runs = normalizeRunsList(readJsonStorage(RUNS_STORAGE_KEY, []));
    restoreTimerFromActiveRun();
  }

  function saveRuns(options) {
    tracker.runs = normalizeRunsList(tracker.runs);
    writeJsonStorage(RUNS_STORAGE_KEY, tracker.runs);
    if (!(options && options.skipSync)) {
      setRunSyncState({
        state: typeof navigator !== 'undefined' && navigator.onLine ? 'pending' : 'offline',
        pending: true,
        error: ''
      });
      scheduleRunSync();
    }
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
  }

  function scheduleRunSync(delayMs) {
    if (!isRunSyncAvailable()) return;
    if (tracker.runSync.timer) {
      clearTimeout(tracker.runSync.timer);
      tracker.runSync.timer = null;
    }
    var delay = Number(delayMs);
    if (!isFinite(delay) || delay < 0) delay = RUNS_SYNC_DEBOUNCE_MS;
    tracker.runSync.timer = setTimeout(function() {
      tracker.runSync.timer = null;
      syncRunsWithServer('scheduled');
    }, delay);
  }

  function syncRunsWithServer(reason) {
    if (!isRunSyncAvailable()) return Promise.resolve(false);
    if (tracker.runSync.inFlight) {
      scheduleRunSync(RUNS_SYNC_DEBOUNCE_MS);
      return Promise.resolve(false);
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (hasRunsData(tracker.runs) || tracker.runSync.pending) {
        setRunSyncState({ state: 'offline', pending: true, error: '' });
      }
      return Promise.resolve(false);
    }

    var apiUrl = getRunsApiUrl();
    var localBefore = normalizeRunsList(tracker.runs);
    tracker.runSync.inFlight = true;
    setRunSyncState({ state: reason === 'load' ? 'loading' : 'syncing', error: '' });

    return fetchJson(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 7000).then(function(result) {
      if (!result.ok) {
        if (result.status === 401) throw createRunSyncError('Unauthorized', 'unauthorized');
        if (result.status === 404) throw createRunSyncError('Runs sync unavailable', 'unavailable');
        throw new Error((result.body && result.body.error) || 'Runs load failed');
      }

      var remoteRuns = normalizeRunsList(result.body && result.body.runs);
      var mergedRuns = mergeRunsLists(localBefore, remoteRuns);
      var mergedJson = JSON.stringify(mergedRuns);
      var remoteJson = JSON.stringify(remoteRuns);
      var localJson = JSON.stringify(localBefore);
      var localChanged = mergedJson !== localJson;
      var shouldPush = tracker.runSync.pending || mergedJson !== remoteJson;

      if (localChanged) {
        tracker.runs = mergedRuns;
        restoreTimerFromActiveRun();
        saveRuns({ skipSync: true });
      }

      if (!shouldPush) {
        tracker.runSync.inFlight = false;
        setRunSyncState({ state: 'synced', pending: false, lastSyncAt: Date.now(), error: '' });
        return true;
      }

      return fetchJson(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ runs: mergedRuns })
      }, 9000).then(function(saveResult) {
        if (!saveResult.ok) {
          if (saveResult.status === 401) throw createRunSyncError('Unauthorized', 'unauthorized');
          if (saveResult.status === 404) throw createRunSyncError('Runs sync unavailable', 'unavailable');
          throw new Error((saveResult.body && saveResult.body.error) || 'Runs save failed');
        }
        tracker.runs = normalizeRunsList(saveResult.body && saveResult.body.runs ? saveResult.body.runs : mergedRuns);
        restoreTimerFromActiveRun();
        saveRuns({ skipSync: true });
        tracker.runSync.inFlight = false;
        setRunSyncState({ state: 'synced', pending: false, lastSyncAt: Date.now(), error: '' });
        return true;
      });
    }).catch(function(error) {
      tracker.runSync.inFlight = false;
      var unavailable = error && error.code === 'unavailable';
      setRunSyncState({
        state: unavailable ? 'local' : 'error',
        pending: hasRunsData(tracker.runs) || tracker.runSync.pending,
        error: unavailable ? '' : (error && error.message ? error.message : 'Runs sync failed')
      });
      return false;
    });
  }

  function bindRunSyncEvents() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('online', function() {
      if (tracker.runSync.pending || hasRunsData(tracker.runs)) {
        scheduleRunSync(250);
      }
    });
  }

  function createRunPoint(projection, position) {
    var source = projection || getCurrentProjectionForForm();
    if (!source || !isRealNumber(source.sector) || !isRealNumber(source.lineCoordinate)) return null;
    var coords = position && position.coords ? position.coords : (tracker.lastLocation && tracker.lastLocation.coords ? tracker.lastLocation.coords : null);
    var speedKmh = coords && isFinite(Number(coords.speed)) ? Math.max(0, Math.round(Number(coords.speed) * 3.6)) : Math.max(0, Math.round((tracker.speedMps || 0) * 3.6));
    return normalizeRunPoint({
      sector: source.sector,
      coordinate: source.lineCoordinate,
      lat: coords && isFinite(Number(coords.latitude)) ? Number(coords.latitude) : null,
      lon: coords && isFinite(Number(coords.longitude)) ? Number(coords.longitude) : null,
      accuracy: coords && isFinite(Number(coords.accuracy)) ? Number(coords.accuracy) : tracker.accuracy,
      speedKmh: speedKmh,
      ts: position && position.timestamp ? position.timestamp : Date.now()
    });
  }

  function createRunSnapshot(status) {
    var details = getPoekhaliTrainDetails();
    var shift = details && details.shift ? details.shift : null;
    var projection = getCurrentProjectionForForm();
    var point = createRunPoint(projection, tracker.lastLocation);
    var nowIso = new Date().toISOString();
    var snapshot = normalizeRun({
      id: 'run-' + Date.now() + '-' + Math.round(Math.random() * 10000),
      shiftId: shift && shift.id ? shift.id : '',
      mapId: getWarningStorageScope(),
      mapTitle: tracker.currentMap && tracker.currentMap.title ? tracker.currentMap.title : DEFAULT_MAP.title,
      route: details.route || '',
      trainNumber: details.trainNumber || '',
      loco: details.loco || '',
      weight: details.weight || '',
      axles: details.axles || '',
      conditionalLength: details.conditionalLength || 0,
      lengthMeters: details.lengthMeters || 0,
      lengthLabel: details.lengthLabel || '',
      lengthSource: details.lengthSource || '',
      compositionType: details.compositionType || '',
      compositionReadiness: details.compositionReadiness || '',
      direction: tracker.even ? 'ЧЕТ' : 'НЕЧЕТ',
      track: getCurrentTrackLabel(),
      status: status || 'active',
      startedAt: nowIso,
      durationMs: getTimerElapsed(),
      movingDurationMs: 0,
      idleDurationMs: 0,
      distanceMeters: 0,
      maxSpeedKmh: point && point.speedKmh ? point.speedKmh : Math.max(0, Math.round((tracker.speedMps || 0) * 3.6)),
      averageSpeedKmh: 0,
      technicalSpeedKmh: 0,
      overspeedMaxKmh: 0,
      overspeedDurationMs: 0,
      overspeedDistanceMeters: 0,
      alertCount: 0,
      lastAlertKind: '',
      lastAlertLevel: '',
      lastAlertTitle: '',
      lastAlertText: '',
      lastAlertDistanceMeters: 0,
      lastAlertAt: '',
      nextRestrictionLabel: '',
      nextRestrictionSource: '',
      nextRestrictionSpeedKmh: 0,
      nextRestrictionSector: 0,
      nextRestrictionCoordinate: 0,
      nextRestrictionDistanceMeters: 0,
      nextRestrictionEtaSeconds: 0,
      nextRestrictionUpdatedAt: '',
      nextSignalName: '',
      nextSignalSource: '',
      nextSignalSector: 0,
      nextSignalCoordinate: 0,
      nextSignalDistanceMeters: 0,
      nextSignalEtaSeconds: 0,
      nextStationName: '',
      nextStationSource: '',
      nextStationSector: 0,
      nextStationCoordinate: 0,
      nextStationDistanceMeters: 0,
      nextStationEtaSeconds: 0,
      nextTargetKind: '',
      nextTargetLabel: '',
      nextTargetSource: '',
      nextTargetSector: 0,
      nextTargetCoordinate: 0,
      nextTargetDistanceMeters: 0,
      nextTargetEtaSeconds: 0,
      nextTargetUpdatedAt: '',
      routeFromName: '',
      routeToName: '',
      routeStatus: '',
      routeFromCoordinate: 0,
      routeToCoordinate: 0,
      routeDistanceMeters: 0,
      routePassedMeters: 0,
      routeRemainingMeters: 0,
      routeOutsideMeters: 0,
      routeProgressPct: 0,
      routeEtaSeconds: 0,
      warningsCount: getCurrentWarnings().length,
      startPoint: point,
      endPoint: point,
      lastPoint: point,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    applyActiveRestrictionToRun(snapshot, projection);
    applyNextRestrictionToRun(snapshot, projection);
    applyNextTrackObjectsToRun(snapshot, projection);
    applyRouteProgressToRun(snapshot, projection);
    applyNavigationEtaToRun(snapshot, point ? point.speedKmh : 0);
    applyNavigationTargetToRun(snapshot, point ? point.speedKmh : 0);
    return snapshot;
  }

  function startOrResumeRun() {
    applyPreparedRouteBeforeRun();
    resetPoekhaliLiveAlert();
    var run = getActiveRun();
    var nowIso = new Date().toISOString();
    if (!run) {
      run = createRunSnapshot('active');
      if (!run) return null;
      tracker.runs.unshift(run);
      tracker.activeRunId = run.id;
    } else {
      run.status = 'active';
      run.updatedAt = nowIso;
      run.durationMs = getTimerElapsed();
      run.direction = tracker.even ? 'ЧЕТ' : 'НЕЧЕТ';
      run.track = getCurrentTrackLabel();
      run.warningsCount = getCurrentWarnings().length;
      applyActiveRestrictionToRun(run, getCurrentProjectionForForm());
      applyNextRestrictionToRun(run, getCurrentProjectionForForm());
      applyNextTrackObjectsToRun(run, getCurrentProjectionForForm());
      applyRouteProgressToRun(run, getCurrentProjectionForForm());
      applyNavigationEtaToRun(run);
      applyNavigationTargetToRun(run);
      updateRunDerivedMetrics(run);
    }
    saveRuns();
    writeRunToLinkedShift(run, { force: true });
    return run;
  }

  function updateActiveRunFromProjection(projection, position) {
    if (!tracker.timerRunning) return;
    var run = getActiveRun();
    if (!run || run.status === 'finished') return;
    var point = createRunPoint(projection, position);
    if (!point) return;
    var last = run.lastPoint;
    var movedMeters = 0;
    var deltaMs = 0;
    if (last && getSectorKey(last.sector) === getSectorKey(point.sector)) {
      var delta = Math.abs(point.coordinate - last.coordinate);
      if (delta >= 2 && delta <= 3000) {
        run.distanceMeters = Math.max(0, Math.round((run.distanceMeters || 0) + delta));
        movedMeters = delta;
      }
      deltaMs = Math.round((Number(point.ts) || 0) - (Number(last.ts) || 0));
      if (deltaMs > 0 && deltaMs <= 10 * 60 * 1000) {
        if (movedMeters >= 3 || (point.speedKmh || 0) >= 3) {
          run.movingDurationMs = Math.max(0, Math.round((run.movingDurationMs || 0) + deltaMs));
        } else {
          run.idleDurationMs = Math.max(0, Math.round((run.idleDurationMs || 0) + deltaMs));
        }
      }
    }
    if (!run.startPoint) run.startPoint = point;
    run.lastPoint = point;
    run.endPoint = point;
    run.durationMs = getTimerElapsed();
    run.maxSpeedKmh = Math.max(run.maxSpeedKmh || 0, point.speedKmh || 0);
    run.warningsCount = getCurrentWarnings().length;
    run.direction = tracker.even ? 'ЧЕТ' : 'НЕЧЕТ';
    run.track = getCurrentTrackLabel();
    var activeRestriction = applyActiveRestrictionToRun(run, projection);
    applyNextRestrictionToRun(run, projection);
    applyNextTrackObjectsToRun(run, projection);
    applyRouteProgressToRun(run, projection);
    applyNavigationEtaToRun(run, point.speedKmh);
    applyNavigationTargetToRun(run, point.speedKmh);
    var overspeed = activeRestriction && activeRestriction.speedKmh > 0
      ? Math.max(0, (point.speedKmh || 0) - activeRestriction.speedKmh)
      : 0;
    if (overspeed > 1) {
      run.overspeedMaxKmh = Math.max(run.overspeedMaxKmh || 0, Math.round(overspeed));
      if (deltaMs > 0 && deltaMs <= 10 * 60 * 1000) {
        run.overspeedDurationMs = Math.max(0, Math.round((run.overspeedDurationMs || 0) + deltaMs));
      }
      if (movedMeters > 0) {
        run.overspeedDistanceMeters = Math.max(0, Math.round((run.overspeedDistanceMeters || 0) + movedMeters));
      }
    }
    updatePoekhaliRuntimeAlert(run, point, activeRestriction, overspeed);
    run.updatedAt = new Date().toISOString();
    updateRunDerivedMetrics(run);
    saveRuns();
    writeRunToLinkedShift(run, { throttleMs: 15000 });
  }

  function updateActiveRunNavigationState() {
    var run = getActiveRun();
    if (!run || run.status === 'finished') return;
    run.direction = tracker.even ? 'ЧЕТ' : 'НЕЧЕТ';
    run.track = getCurrentTrackLabel();
    applyActiveRestrictionToRun(run, getCurrentProjectionForForm());
    applyNextRestrictionToRun(run, getCurrentProjectionForForm());
    applyNextTrackObjectsToRun(run, getCurrentProjectionForForm());
    applyRouteProgressToRun(run, getCurrentProjectionForForm());
    applyNavigationEtaToRun(run);
    applyNavigationTargetToRun(run);
    run.updatedAt = new Date().toISOString();
    saveRuns();
    writeRunToLinkedShift(run, { force: true });
  }

  function pauseActiveRun() {
    var run = getActiveRun();
    if (!run || run.status === 'finished') return;
    run.status = 'paused';
    run.durationMs = getTimerElapsed();
    run.updatedAt = new Date().toISOString();
    applyNextTrackObjectsToRun(run, getCurrentProjectionForForm());
    applyRouteProgressToRun(run, getCurrentProjectionForForm());
    applyNavigationEtaToRun(run);
    applyNavigationTargetToRun(run);
    updateRunDerivedMetrics(run);
    resetPoekhaliLiveAlert();
    saveRuns();
    writeRunToLinkedShift(run, { force: true });
  }

  function finishActiveRun() {
    var run = getActiveRun();
    if (!run) return;
    var nowIso = new Date().toISOString();
    run.status = 'finished';
    run.endedAt = nowIso;
    run.durationMs = getTimerElapsed();
    run.updatedAt = nowIso;
    if (run.lastPoint) run.endPoint = run.lastPoint;
    applyNextTrackObjectsToRun(run, getCurrentProjectionForForm());
    applyRouteProgressToRun(run, getCurrentProjectionForForm());
    applyNavigationEtaToRun(run);
    applyNavigationTargetToRun(run);
    updateRunDerivedMetrics(run);
    tracker.activeRunId = '';
    tracker.timerRunning = false;
    tracker.timerStartedAt = 0;
    tracker.timerElapsedMs = 0;
    resetPoekhaliLiveAlert();
    saveRuns();
    writeRunToLinkedShift(run, { force: true });
    updateModeButtons();
    requestDraw();
  }

  function getRunSyncLabel() {
    var state = tracker.runSync && tracker.runSync.state;
    if (state === 'synced') return 'сохранено';
    if (state === 'syncing' || state === 'loading') return 'синхр.';
    if (state === 'local') return 'локально';
    if (state === 'offline') return 'оффлайн';
    if (state === 'error') return 'ошибка';
    if (tracker.runSync && tracker.runSync.pending) return 'ожидает';
    return '—';
  }

  function getRunSyncTone() {
    var state = tracker.runSync && tracker.runSync.state;
    if (state === 'synced') return 'is-success';
    if (state === 'syncing' || state === 'loading' || state === 'pending') return 'is-muted';
    if (state === 'offline' || state === 'error') return 'is-danger';
    return 'is-muted';
  }

  function getRunStatusText(status) {
    if (status === 'active') return 'идет запись';
    if (status === 'paused') return 'пауза';
    if (status === 'finished') return 'завершено';
    return '—';
  }

  function formatRunDateTime(value) {
    var ts = Date.parse(value || '');
    if (!isFinite(ts)) return '—';
    return formatLearningTime(ts);
  }

  function formatRunPoint(point) {
    if (!point || !isRealNumber(point.coordinate)) return '—';
    var draft = getRawDraftForSector(point.sector);
    var prefix = draft ? draft.title + ' · ' : (isRealNumber(point.sector) ? 'уч. ' + Math.round(point.sector) + ' · ' : '');
    return prefix + formatLineCoordinate(point.coordinate);
  }

  function formatRunDistance(meters) {
    var value = Math.max(0, Math.round(Number(meters) || 0));
    if (value >= 10000) return (value / 1000).toFixed(1).replace('.', ',') + ' км';
    if (value >= 1000) return (value / 1000).toFixed(2).replace('.', ',') + ' км';
    return value + ' м';
  }

  function formatRunSpeedKmh(value) {
    var speed = Number(value);
    if (!isFinite(speed) || speed <= 0) return '—';
    return (Math.round(speed * 10) / 10).toString().replace('.', ',') + ' км/ч';
  }

  function formatEtaSeconds(value, compact) {
    var seconds = Math.max(0, Math.round(Number(value) || 0));
    if (!seconds) return '';
    var minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return (compact ? '~' : 'примерно ') + minutes + ' мин';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    if (compact) return '~' + hours + 'ч' + (rest ? ' ' + rest + 'м' : '');
    return 'примерно ' + hours + ' ч' + (rest ? ' ' + rest + ' мин' : '');
  }

  function formatRunActiveRestriction(run, compact) {
    if (!run) return '—';
    var label = String(run.activeRestrictionLabel || '').trim();
    var speed = Math.max(0, Math.round(Number(run.activeRestrictionSpeedKmh) || 0));
    if (!label && speed > 0) label = speed + ' км/ч';
    if (!label) return '—';
    if (speed > 0 && label.indexOf('км/ч') < 0) label += ' км/ч';
    if (compact) return label;
    var start = Number(run.activeRestrictionStart);
    var end = Number(run.activeRestrictionEnd);
    var range = '';
    if (isFinite(start) && start > 0 && isFinite(end) && end >= start) {
      range = formatLineCoordinate(start) + (Math.abs(end - start) > 1 ? ' - ' + formatLineCoordinate(end) : '');
    }
    return range ? label + ' · ' + range : label;
  }

  function formatRunNextRestriction(run, compact) {
    if (!run) return '—';
    var label = String(run.nextRestrictionLabel || '').trim();
    var speed = Math.max(0, Math.round(Number(run.nextRestrictionSpeedKmh) || 0));
    if (!label && speed > 0) label = speed + ' км/ч';
    if (!label) return '—';
    if (speed > 0 && label.indexOf('км/ч') < 0) label += ' км/ч';
    var distance = Math.max(0, Math.round(Number(run.nextRestrictionDistanceMeters) || 0));
    var eta = formatEtaSeconds(run.nextRestrictionEtaSeconds, compact);
    if (compact) return distance ? label + ' / ' + formatRunDistance(distance) + (eta ? ' / ' + eta : '') : label;
    var coordinate = Number(run.nextRestrictionCoordinate);
    var point = isFinite(coordinate) && coordinate > 0 ? formatLineCoordinate(coordinate) : '';
    var parts = [label];
    if (distance > 0) parts.push('через ' + formatRunDistance(distance));
    if (eta) parts.push(eta);
    if (point) parts.push(point);
    return parts.join(' · ');
  }

  function formatRunNextObject(run, prefix, compact) {
    if (!run || !prefix) return '—';
    var name = String(run[prefix + 'Name'] || '').trim();
    if (!name) return '—';
    var source = String(run[prefix + 'Source'] || '').trim();
    var distance = Math.max(0, Math.round(Number(run[prefix + 'DistanceMeters']) || 0));
    if (compact) {
      var etaCompact = formatEtaSeconds(run[prefix + 'EtaSeconds'], true);
      return name + (distance ? ' / ' + formatRunDistance(distance) : '') + (etaCompact ? ' / ' + etaCompact : '');
    }
    var coordinate = Number(run[prefix + 'Coordinate']);
    var point = isFinite(coordinate) && coordinate > 0 ? formatLineCoordinate(coordinate) : '';
    var eta = formatEtaSeconds(run[prefix + 'EtaSeconds'], false);
    var parts = [name];
    if (distance > 0) parts.push('через ' + formatRunDistance(distance));
    if (eta) parts.push(eta);
    if (point) parts.push(point);
    if (source) parts.push(source);
    return parts.join(' · ');
  }

  function formatRunRouteProgress(run, compact) {
    if (!run || !run.routeDistanceMeters) return '—';
    var progress = Math.max(0, Math.min(100, Number(run.routeProgressPct) || 0));
    var remaining = Math.max(0, Math.round(Number(run.routeRemainingMeters) || 0));
    var eta = formatEtaSeconds(run.routeEtaSeconds, compact);
    if (compact) {
      return Math.round(progress) + '% / ост. ' + formatRunDistance(remaining) + (eta ? ' / ' + eta : '');
    }
    var from = String(run.routeFromName || '').trim();
    var to = String(run.routeToName || '').trim();
    var parts = [];
    if (from || to) parts.push((from || 'старт') + ' → ' + (to || 'финиш'));
    parts.push(Math.round(progress * 10) / 10 + '%');
    parts.push('осталось ' + formatRunDistance(remaining));
    if (eta) parts.push(eta);
    parts.push('из ' + formatRunDistance(run.routeDistanceMeters));
    return parts.join(' · ');
  }

  function getNavigationTargetShortLabel(kind, source) {
    if (kind === 'restriction_end') return 'КОНЕЦ';
    if (kind === 'warning') return 'ПР';
    if (kind === 'restriction') {
      if (source === 'document') return 'ДОК';
      if (source === 'regime') return 'РК';
      if (source === 'user') return 'GPS';
      return 'ОГР';
    }
    if (kind === 'signal') return 'СВ';
    if (kind === 'station') return 'СТ';
    if (kind === 'route_start') return 'СТАРТ';
    if (kind === 'route_finish') return 'ФИН';
    return 'ЦЕЛЬ';
  }

  function formatRunNavigationTarget(run, compact) {
    if (!run || !run.nextTargetLabel) return '—';
    var label = String(run.nextTargetLabel || '').trim();
    var distance = Math.max(0, Math.round(Number(run.nextTargetDistanceMeters) || 0));
    var eta = formatEtaSeconds(run.nextTargetEtaSeconds, compact);
    if (compact) {
      return label + (distance ? ' / ' + formatRunDistance(distance) : ' / тут') + (eta ? ' / ' + eta : '');
    }
    var coordinate = Number(run.nextTargetCoordinate);
    var point = isFinite(coordinate) && coordinate > 0 ? formatLineCoordinate(coordinate) : '';
    var parts = [label];
    if (distance > 0) parts.push('через ' + formatRunDistance(distance));
    else parts.push('тут');
    if (eta) parts.push(eta);
    if (point) parts.push(point);
    parts.push(getNavigationTargetShortLabel(run.nextTargetKind, run.nextTargetSource));
    return parts.join(' · ');
  }

  function resetPoekhaliLiveAlert() {
    tracker.liveAlert = null;
    tracker.liveAlertLastKey = '';
    tracker.liveAlertLastAt = 0;
  }

  function expirePoekhaliLiveAlert(now) {
    var current = tracker.liveAlert;
    var time = now || Date.now();
    if (current && current.expiresAt && current.expiresAt <= time) {
      tracker.liveAlert = null;
    }
  }

  function getCurrentPoekhaliLiveAlert() {
    expirePoekhaliLiveAlert();
    return tracker.liveAlert || null;
  }

  function emitPoekhaliAlertHaptic(level) {
    var haptics = typeof window !== 'undefined' ? window.BM_HAPTICS : null;
    if (!haptics) return;
    try {
      if (level === 'danger' && typeof haptics.hapticError === 'function') {
        haptics.hapticError();
      } else if (typeof haptics.hapticWarning === 'function') {
        haptics.hapticWarning();
      } else if (typeof haptics.hapticActionMedium === 'function') {
        haptics.hapticActionMedium();
      }
    } catch (error) {
      // Tactile feedback is optional; the working display must keep rendering.
    }
  }

  function setPoekhaliLiveAlert(alert) {
    if (!alert || !alert.key) return null;
    var now = Date.now();
    var repeatMs = alert.level === 'danger' ? LIVE_ALERT_DANGER_REPEAT_MS : LIVE_ALERT_REPEAT_MS;
    var shouldBuzz = tracker.liveAlertLastKey !== alert.key || !tracker.liveAlertLastAt || now - tracker.liveAlertLastAt >= repeatMs;
    tracker.liveAlert = {
      key: alert.key,
      kind: alert.kind || '',
      level: alert.level || 'warning',
      title: alert.title || 'Предупреждение',
      text: alert.text || '',
      distanceMeters: Math.max(0, Math.round(Number(alert.distanceMeters) || 0)),
      ts: now,
      expiresAt: now + LIVE_ALERT_VISIBLE_MS,
      notified: shouldBuzz
    };
    if (shouldBuzz) {
      tracker.liveAlertLastKey = alert.key;
      tracker.liveAlertLastAt = now;
      emitPoekhaliAlertHaptic(tracker.liveAlert.level);
    }
    return tracker.liveAlert;
  }

  function recordPoekhaliRunAlert(run, alert) {
    if (!run || !alert || !alert.notified) return;
    run.alertCount = Math.max(0, Math.round(Number(run.alertCount) || 0)) + 1;
    run.lastAlertKind = String(alert.kind || '');
    run.lastAlertLevel = String(alert.level || '');
    run.lastAlertTitle = String(alert.title || '');
    run.lastAlertText = String(alert.text || '');
    run.lastAlertDistanceMeters = Math.max(0, Math.round(Number(alert.distanceMeters) || 0));
    run.lastAlertAt = new Date(alert.ts || Date.now()).toISOString();
  }

  function buildPoekhaliRuntimeAlert(run, point, activeRestriction, overspeed) {
    if (!run || !point) return null;
    var speed = Math.max(0, Math.round(Number(point.speedKmh) || 0));
    var overspeedValue = Math.max(0, Math.round(Number(overspeed) || 0));
    if (overspeedValue > 1 && activeRestriction && activeRestriction.speedKmh > 0) {
      var restrictionLabel = activeRestriction.label || (activeRestriction.speedKmh + ' км/ч');
      return {
        key: [
          'overspeed',
          activeRestriction.source || '',
          activeRestriction.sector || point.sector || '',
          activeRestriction.start || '',
          activeRestriction.end || '',
          activeRestriction.speedKmh || ''
        ].join(':'),
        kind: 'overspeed',
        level: 'danger',
        title: 'Превышение +' + overspeedValue + ' км/ч',
        text: speed + ' км/ч при ограничении ' + restrictionLabel,
        distanceMeters: activeRestriction.distanceToEnd || 0
      };
    }

    var label = String(run.nextTargetLabel || '').trim();
    var distance = Math.max(0, Math.round(Number(run.nextTargetDistanceMeters) || 0));
    if (!label || distance > LIVE_ALERT_AHEAD_M) return null;

    var isNear = distance <= LIVE_ALERT_NEAR_M;
    var eta = formatEtaSeconds(run.nextTargetEtaSeconds, true);
    var shortLabel = getNavigationTargetShortLabel(run.nextTargetKind, run.nextTargetSource);
    var text = label + (distance > 0 ? ' через ' + formatRunDistance(distance) : ' тут');
    if (eta) text += ' · ' + eta;
    if (shortLabel) text += ' · ' + shortLabel;

    return {
      key: [
        'target',
        isNear ? 'near' : 'ahead',
        run.nextTargetKind || '',
        run.nextTargetSource || '',
        run.nextTargetSector || point.sector || '',
        run.nextTargetCoordinate || ''
      ].join(':'),
      kind: run.nextTargetKind || 'target',
      level: isNear ? 'danger' : 'warning',
      title: isNear ? 'Цель рядом' : 'Цель впереди',
      text: text,
      distanceMeters: distance
    };
  }

  function updatePoekhaliRuntimeAlert(run, point, activeRestriction, overspeed) {
    var alert = buildPoekhaliRuntimeAlert(run, point, activeRestriction, overspeed);
    if (alert) {
      recordPoekhaliRunAlert(run, setPoekhaliLiveAlert(alert));
      return alert;
    }
    expirePoekhaliLiveAlert();
    return null;
  }

  function getRunShiftLabel(run) {
    var shift = findShiftForRun(run);
    if (!shift) return 'нет';
    return run && run.shiftId ? 'записана' : 'текущая';
  }

  function focusRunPoint(point) {
    if (!point || !isRealNumber(point.sector) || !isRealNumber(point.coordinate)) return;
    setPreviewProjection({
      sector: point.sector,
      lineCoordinate: point.coordinate
    }, true);
    closeOpsSheet();
    requestDraw();
  }

  function isWarningExpired(item) {
    return !!(item && item.validUntil && item.validUntil < getTodayDateString());
  }

  function isWarningUsable(item) {
    return !!(item && item.enabled !== false && !isWarningExpired(item));
  }

  function getScopedWarnings(includeInactive) {
    var scope = getWarningStorageScope();
    var context = getPoekhaliShiftContext();
    var shiftId = context && context.shift && context.shift.id ? String(context.shift.id) : '';
    return tracker.warnings.filter(function(item) {
      if (!item || item.mapId !== scope) return false;
      if (item.deletedAt) return false;
      if (item.shiftId && shiftId && item.shiftId !== shiftId) return false;
      if (item.shiftId && !shiftId) return false;
      if (!includeInactive && !isWarningUsable(item)) return false;
      return true;
    });
  }

  function getCurrentWarnings() {
    return getScopedWarnings(false);
  }

  function getWarningById(id) {
    var target = String(id || '');
    if (!target) return null;
    for (var i = 0; i < tracker.warnings.length; i++) {
      if (tracker.warnings[i] && tracker.warnings[i].id === target && !tracker.warnings[i].deletedAt) return tracker.warnings[i];
    }
    return null;
  }

  function getWarningRuntimeStatus(item, projection) {
    if (!item) return 'ready';
    if (item.enabled === false) return 'disabled';
    if (isWarningExpired(item)) return 'expired';
    var current = projection || getCurrentProjectionForForm();
    if (!current || getSectorKey(current.sector) !== getSectorKey(item.sector) || !isRealNumber(current.lineCoordinate)) {
      return 'ready';
    }
    var coordinate = current.lineCoordinate;
    if (coordinate >= item.start && coordinate <= item.end) return 'active';
    if (tracker.even) return item.start > coordinate ? 'ahead' : 'passed';
    return item.end < coordinate ? 'ahead' : 'passed';
  }

  function getWarningStatusText(status) {
    if (status === 'active') return 'Действует';
    if (status === 'ahead') return 'Впереди';
    if (status === 'passed') return 'Пройдено';
    if (status === 'disabled') return 'Откл.';
    if (status === 'expired') return 'Истекло';
    return 'Готово';
  }

  function getWarningsForSector(sector, left, right) {
    var sectorKey = getSectorKey(sector);
    return getCurrentWarnings().filter(function(item) {
      if (getSectorKey(item.sector) !== sectorKey) return false;
      if (isFinite(left) && isFinite(right) && !isObjectInRange(item, left, right)) return false;
      return true;
    });
  }

  function createWarning(sector, start, end, speed, note, validUntil) {
    var context = getPoekhaliShiftContext();
    var shift = context && context.shift ? context.shift : null;
    var item = normalizeWarning({
      mapId: getWarningStorageScope(),
      shiftId: shift && shift.id ? shift.id : '',
      sector: sector,
      start: start,
      end: end,
      speed: speed,
      note: note,
      validUntil: validUntil,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (!item) return null;
    tracker.warnings.push(item);
    saveWarnings();
    return item;
  }

  function parseWarningCoordinateAtStart(text) {
    var source = String(text || '');
    var match = source.match(/^\s*(\d{1,4})(?:\s*(?:км|km|k))?(?:(?:\s*[\/.,]\s*([1-9]|10))|(?:\s*(?:пк|pk)\s*([1-9]|10))|(?:\s*([1-9]|10)\s*(?:пк|pk))|(?:\s+([1-9]|10)\b))?(?:\s*\+\s*(\d{1,2})\s*(?:м)?)?/i);
    if (!match) return null;
    var pkText = match[2] || match[3] || match[4] || match[5] || '';
    return {
      coordinate: coordinateFromKmPkMeter(match[1], pkText || 1, match[6] || 0),
      length: match[0].length,
      label: source.slice(0, match[0].length).trim()
    };
  }

  function parseBulkWarningLine(rawLine, defaultSector, defaultValidUntil) {
    var original = String(rawLine || '');
    var line = original.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    if (!line || line.charAt(0) === '#') return null;
    line = line.replace(/^\s*(?:пр|огр|предупреждение)\s*[:№#-]?\s*/i, '');

    var sector = Number(defaultSector);
    var sectorMatch = line.match(/\b(?:уч|участок|сектор)\s*\.?\s*(\d+(?:[.,]\d+)?)/i);
    if (sectorMatch) {
      sector = Number(String(sectorMatch[1]).replace(',', '.'));
      line = line.replace(sectorMatch[0], '').trim();
    }
    if (!isRealNumber(sector)) {
      return { error: 'не найден участок', raw: original };
    }

    var separator = line.match(/\s+до\s+|-/i);
    if (!separator) {
      return { error: 'нет диапазона км/пк', raw: original };
    }

    var startText = line.slice(0, separator.index).trim();
    var restText = line.slice(separator.index + separator[0].length).trim();
    var start = parseWarningCoordinateAtStart(startText);
    var end = parseWarningCoordinateAtStart(restText);
    if (!start || !end) {
      return { error: 'не прочитан диапазон км/пк', raw: original };
    }

    var tail = restText.slice(end.length).trim();
    var speedMatch = tail.match(/(?:^|\s)(?:(?:v|скор(?:ость)?|огр(?:аничение)?|до)\s*)?(\d{1,3})(?:\s*(?:км\s*\/?\s*ч|кмч))?\b/i);
    if (!speedMatch) {
      return { error: 'не найдена скорость', raw: original };
    }
    var speed = Number(speedMatch[1]);
    if (!isFinite(speed) || speed < 1 || speed > 200) {
      return { error: 'скорость вне диапазона', raw: original };
    }
    var note = (tail.slice(0, speedMatch.index) + ' ' + tail.slice(speedMatch.index + speedMatch[0].length))
      .replace(/^[\s:;,.#-]+/, '')
      .trim();

    return {
      sector: sector,
      start: start.coordinate,
      end: end.coordinate,
      speed: speed,
      note: note,
      validUntil: defaultValidUntil || ''
    };
  }

  function createWarningsFromBulkText(text, defaultSector, validUntil) {
    var lines = String(text || '').split(/\r?\n|;/);
    var context = getPoekhaliShiftContext();
    var shift = context && context.shift ? context.shift : null;
    var created = [];
    var errors = [];
    var now = new Date().toISOString();
    for (var i = 0; i < lines.length; i++) {
      var parsed = parseBulkWarningLine(lines[i], defaultSector, validUntil);
      if (!parsed) continue;
      if (parsed.error) {
        errors.push((i + 1) + ': ' + parsed.error + ' — ' + String(parsed.raw || '').trim());
        continue;
      }
      var item = normalizeWarning({
        mapId: getWarningStorageScope(),
        shiftId: shift && shift.id ? shift.id : '',
        sector: parsed.sector,
        start: parsed.start,
        end: parsed.end,
        speed: parsed.speed,
        note: parsed.note,
        validUntil: parsed.validUntil,
        enabled: true,
        createdAt: now,
        updatedAt: now
      });
      if (item) {
        tracker.warnings.push(item);
        created.push(item);
      } else {
        errors.push((i + 1) + ': строка не прошла проверку');
      }
    }
    if (created.length) saveWarnings();
    return {
      created: created,
      errors: errors
    };
  }

  function saveWarningFromForm(id, sector, start, end, speed, note, validUntil) {
    var existing = id ? getWarningById(id) : null;
    if (!existing) {
      return createWarning(sector, start, end, speed, note, validUntil);
    }
    var item = normalizeWarning({
      id: existing.id,
      mapId: existing.mapId,
      shiftId: existing.shiftId,
      sector: sector,
      start: start,
      end: end,
      speed: speed,
      note: note,
      validUntil: validUntil,
      enabled: existing.enabled !== false,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    });
    if (!item) return null;
    for (var i = 0; i < tracker.warnings.length; i++) {
      if (tracker.warnings[i] && tracker.warnings[i].id === existing.id) {
        tracker.warnings[i] = item;
        break;
      }
    }
    tracker.editingWarningId = '';
    saveWarnings();
    return item;
  }

  function deleteWarning(id) {
    var target = getWarningById(id);
    if (target) {
      target.enabled = false;
      target.deletedAt = new Date().toISOString();
      target.updatedAt = target.deletedAt;
    }
    if (tracker.editingWarningId === id) tracker.editingWarningId = '';
    saveWarnings();
  }

  function toggleWarningEnabled(item) {
    if (!item) return;
    item.enabled = item.enabled === false;
    item.updatedAt = new Date().toISOString();
    saveWarnings();
  }

  function getLearningMapScope() {
    return tracker.currentMap && tracker.currentMap.id ? tracker.currentMap.id : DEFAULT_MAP.id;
  }

  function normalizeLearningTrackState(value, onTrack) {
    var state = String(value || '').toLowerCase();
    if (state === 'on-track') state = 'ontrack';
    if (state === 'neartrack') state = 'near';
    if (state === 'off-track') state = 'offtrack';
    if (state === 'ontrack' || state === 'near' || state === 'offtrack') return state;
    return onTrack === false ? 'offtrack' : 'ontrack';
  }

  function getLearningTrackState(projection) {
    if (!projection) return 'offtrack';
    if (projection.onTrack) return 'ontrack';
    if (isFinite(projection.distance) && projection.distance <= LEARNING_NEAR_TRACK_DISTANCE_M) return 'near';
    return 'offtrack';
  }

  function getLearningTrackStateLabel(state) {
    if (state === 'ontrack') return 'на карте';
    if (state === 'near') return 'рядом';
    if (state === 'offtrack') return 'вне карты';
    return '—';
  }

  function getLearningTrackStateTone(state) {
    if (state === 'ontrack') return 'success';
    if (state === 'near') return 'warning';
    if (state === 'offtrack') return 'danger';
    return 'muted';
  }

  function normalizeLearningSample(sample, fallbackMapId) {
    if (!sample || typeof sample !== 'object') return null;
    var sector = Number(sample.sector);
    var coordinate = Number(sample.coordinate);
    var lat = Number(sample.lat);
    var lon = Number(sample.lon);
    var accuracy = Number(sample.accuracy);
    if (!isRealNumber(sector) || !isFinite(coordinate) || !isFinite(lat) || !isFinite(lon)) return null;
    var roundedCoordinate = Math.max(0, Math.round(coordinate));
    var meters = ((roundedCoordinate % 1000) + 1000) % 1000;
    var trackState = normalizeLearningTrackState(sample.trackState, sample.onTrack);
    return {
      mapId: String(sample.mapId || fallbackMapId || getLearningMapScope()),
      sector: sector,
      coordinate: roundedCoordinate,
      km: Math.floor(roundedCoordinate / 1000),
      pk: Math.floor(meters / 100) + 1,
      lat: lat,
      lon: lon,
      altitude: sample.altitude !== null && sample.altitude !== undefined && sample.altitude !== '' && isFinite(Number(sample.altitude)) ? Number(sample.altitude) : null,
      accuracy: isFinite(accuracy) ? Math.max(0, Math.round(accuracy)) : 0,
      speed: isFinite(Number(sample.speed)) ? Number(sample.speed) : 0,
      distance: isFinite(Number(sample.distance)) ? Math.round(Number(sample.distance)) : null,
      trackState: trackState,
      shiftId: String(sample.shiftId || ''),
      ts: isFinite(Number(sample.ts)) ? Number(sample.ts) : Date.now()
    };
  }

  function getRawLearningTrackKey() {
    var activeRun = getActiveRun();
    if (activeRun && activeRun.id) return 'run-' + String(activeRun.id);
    var context = getPoekhaliShiftContext();
    var shift = context && context.shift ? context.shift : null;
    if (shift && shift.id) return 'shift-' + String(shift.id);
    var date = new Date();
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return 'raw-' + year + '-' + month + '-' + day;
  }

  function normalizeLearningRawTrackKey(value) {
    var key = String(value || '').trim();
    if (!key) key = getRawLearningTrackKey();
    key = key.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_.:-]+/g, '-').slice(0, 160);
    return key || ('raw-' + Date.now());
  }

  function normalizeLearningRawSample(sample, fallbackMapId) {
    if (!sample || typeof sample !== 'object') return null;
    var lat = Number(sample.lat);
    var lon = Number(sample.lon);
    if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    var accuracy = Number(sample.accuracy);
    var nearestCoordinate = Number(sample.nearestCoordinate);
    var nearestSector = Number(sample.nearestSector);
    var roundedNearestCoordinate = isFinite(nearestCoordinate) ? Math.max(0, Math.round(nearestCoordinate)) : null;
    var meters = roundedNearestCoordinate === null ? null : ((roundedNearestCoordinate % 1000) + 1000) % 1000;
    return {
      mapId: String(sample.mapId || fallbackMapId || getLearningMapScope()),
      lat: lat,
      lon: lon,
      altitude: sample.altitude !== null && sample.altitude !== undefined && sample.altitude !== '' && isFinite(Number(sample.altitude)) ? Number(sample.altitude) : null,
      accuracy: isFinite(accuracy) ? Math.max(0, Math.round(accuracy)) : 0,
      speed: isFinite(Number(sample.speed)) ? Number(sample.speed) : 0,
      distance: isFinite(Number(sample.distance)) ? Math.round(Number(sample.distance)) : null,
      trackState: 'raw',
      shiftId: String(sample.shiftId || ''),
      runId: String(sample.runId || ''),
      nearestSector: isRealNumber(nearestSector) ? nearestSector : null,
      nearestCoordinate: roundedNearestCoordinate,
      nearestKm: roundedNearestCoordinate === null ? null : Math.floor(roundedNearestCoordinate / 1000),
      nearestPk: meters === null ? null : Math.floor(meters / 100) + 1,
      ts: isFinite(Number(sample.ts)) ? Number(sample.ts) : Date.now()
    };
  }

  function normalizeLearningRawBucket(bucket, mapId) {
    var source = bucket && typeof bucket === 'object' ? bucket : {};
    var samples = Array.isArray(source.samples) ? source.samples : [];
    var normalizedSamples = samples.map(function(sample) {
      return normalizeLearningRawSample(sample, mapId);
    }).filter(Boolean).sort(function(a, b) {
      return a.ts - b.ts;
    });
    if (normalizedSamples.length > LEARNING_MAX_SAMPLES_PER_RAW_TRACK) {
      normalizedSamples = normalizedSamples.slice(normalizedSamples.length - LEARNING_MAX_SAMPLES_PER_RAW_TRACK);
    }
    if (!normalizedSamples.length) return null;
    return {
      samples: normalizedSamples,
      updatedAt: Number(source.updatedAt) || normalizedSamples[normalizedSamples.length - 1].ts || 0,
      promotedAt: Math.max(0, Number(source.promotedAt) || 0)
    };
  }

  function thinLearningArray(items, maxItems) {
    var source = Array.isArray(items) ? items.filter(Boolean) : [];
    var max = Math.max(2, Math.round(Number(maxItems) || 0));
    if (source.length <= max) return source.slice();
    var result = [];
    var lastIndex = -1;
    for (var i = 0; i < max; i++) {
      var index = Math.round(i * (source.length - 1) / (max - 1));
      if (index === lastIndex) continue;
      result.push(source[index]);
      lastIndex = index;
    }
    return result;
  }

  function makeLearningUserEntityId(prefix) {
    var safePrefix = normalizeLearningRawTrackKey(prefix || 'entity') || 'entity';
    return safePrefix + '-' + Date.now() + '-' + Math.round(Math.random() * 100000);
  }

  function normalizeLearningUserEntityId(value, fallback) {
    var text = String(value || fallback || '').trim();
    if (!text) text = makeLearningUserEntityId('entity');
    return normalizeLearningRawTrackKey(text).slice(0, 128);
  }

  function getLearningUserObjectKind(item) {
    return String(item && item.type) === '1' ? 'signal' : 'station';
  }

  function getLearningUserEntityKindLabel(kind, item) {
    var type = kind || (item && item.speed !== undefined && item.source === 'user' && !item.type ? 'speed' : '');
    if (type === 'speed') return 'Скорость';
    if (type === 'signal' || String(item && item.type) === '1') return 'Светофор';
    return 'Станция';
  }

  function normalizeLearningUserHistoryItem(item) {
    if (!item || typeof item !== 'object') return null;
    var ts = Math.max(0, Number(item.ts) || Number(item.time) || 0);
    var action = String(item.action || '').trim().slice(0, 48);
    var detail = String(item.detail || item.note || '').trim().slice(0, 160);
    if (!ts || !action) return null;
    return {
      ts: ts,
      action: action,
      detail: detail
    };
  }

  function normalizeLearningUserHistory(items) {
    var source = Array.isArray(items) ? items : [];
    return source.map(normalizeLearningUserHistoryItem).filter(Boolean).sort(function(a, b) {
      return a.ts - b.ts;
    }).slice(-LEARNING_MAX_HISTORY_PER_USER_SECTION);
  }

  function normalizeUserSectionEntitySource(source) {
    var value = String(source || 'user').trim().toLowerCase();
    if (value === 'document' || value === 'doc') return 'document';
    if (value === 'regime' || value === 'rk') return 'regime';
    if (value === 'emap' || value === 'object' || value === 'speed') return 'emap';
    return 'user';
  }

  function getUserSectionEntitySourceLabel(source) {
    var value = normalizeUserSectionEntitySource(source);
    if (value === 'document') return 'ДОК';
    if (value === 'regime') return 'РК';
    if (value === 'emap') return 'ЭК';
    return 'USER';
  }

  function appendUserSectionHistory(section, action, detail) {
    if (!section) return;
    if (!Array.isArray(section.history)) section.history = [];
    section.history.push({
      ts: Date.now(),
      action: String(action || 'Изменение').trim().slice(0, 48),
      detail: String(detail || '').trim().slice(0, 160)
    });
    section.history = normalizeLearningUserHistory(section.history);
  }

  function normalizeLearningUserPoint(point, fallbackSector) {
    if (!point || typeof point !== 'object') return null;
    var lat = Number(point.lat);
    var lon = Number(point.lon);
    var ordinate = Number(point.ordinate !== undefined ? point.ordinate : point.coordinate);
    var sector = isRealNumber(point.sector) ? Number(point.sector) : Number(fallbackSector);
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(ordinate) || !isRealNumber(sector)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {
      lat: lat,
      lon: lon,
      ordinate: Math.max(0, Math.round(ordinate)),
      sector: sector,
      altitude: point.altitude === null || point.altitude === undefined || point.altitude === '' || !isFinite(Number(point.altitude))
        ? null
        : Number(point.altitude),
      accuracy: Math.max(0, Math.round(Number(point.accuracy) || 0)),
      ts: Math.max(0, Number(point.ts) || 0)
    };
  }

  function normalizeLearningUserProfileSegment(segment, fallbackSector) {
    if (!segment || typeof segment !== 'object') return null;
    var start = Math.max(0, Math.round(Number(segment.start)));
    var end = Math.max(0, Math.round(Number(segment.end)));
    var length = Math.max(0, Math.round(Number(segment.length) || Math.abs(end - start)));
    var sector = isRealNumber(segment.sector) ? Number(segment.sector) : Number(fallbackSector);
    var grade = Number(segment.grade);
    if (!isFinite(start) || !isFinite(end) || !isFinite(length) || length <= 0 || !isFinite(grade) || !isRealNumber(sector)) return null;
    if (end < start) {
      var swap = start;
      start = end;
      end = swap;
    }
    length = Math.max(1, end - start);
    return {
      start: start,
      end: end,
      length: length,
      grade: clamp(grade, -45, 45),
      sector: sector,
      userSection: true,
      altitudeMissing: !!segment.altitudeMissing,
      sampleCount: Math.max(1, Math.round(Number(segment.sampleCount) || 1))
    };
  }

  function normalizeLearningUserObject(item, fallbackSector) {
    if (!item || typeof item !== 'object') return null;
    var coordinate = Math.max(0, Math.round(Number(item.coordinate)));
    var length = Math.max(0, Math.round(Number(item.length) || 0));
    var sector = isRealNumber(item.sector) ? Number(item.sector) : Number(fallbackSector);
    var type = String(item.type || '').trim();
    var name = String(item.name || '').trim().slice(0, 80);
    if (!isFinite(coordinate) || !isRealNumber(sector) || !type || !name) return null;
    var speed = Number(item.speed);
    var fallbackId = 'obj-' + sector + '-' + type + '-' + coordinate + '-' + normalizeLearningRawTrackKey(name);
    return {
      id: normalizeLearningUserEntityId(item.id || item.key, fallbackId),
      fileKey: 'user',
      sector: sector,
      type: type,
      name: name,
      coordinate: coordinate,
      length: length,
      end: coordinate + length,
      speed: isFinite(speed) ? speed : null,
      source: normalizeUserSectionEntitySource(item.source)
    };
  }

  function normalizeLearningUserSpeed(rule, fallbackSector) {
    if (!rule || typeof rule !== 'object') return null;
    var coordinate = Math.max(0, Math.round(Number(rule.coordinate)));
    var length = Math.max(0, Math.round(Number(rule.length) || 0));
    var end = Math.max(coordinate, Math.round(Number(rule.end) || (coordinate + length)));
    var sector = isRealNumber(rule.sector) ? Number(rule.sector) : Number(fallbackSector);
    var speed = Number(rule.speed);
    if (!isFinite(coordinate) || !isFinite(end) || !isFinite(speed) || !isRealNumber(sector)) return null;
    var fallbackId = 'speed-' + sector + '-' + coordinate + '-' + end + '-' + Math.round(speed);
    return {
      id: normalizeLearningUserEntityId(rule.id || rule.key, fallbackId),
      sector: sector,
      wayNumber: Math.max(0, Math.round(Number(rule.wayNumber) || 0)),
      coordinate: coordinate,
      length: Math.max(0, end - coordinate),
      end: end,
      speed: speed,
      name: String(rule.name || Math.round(speed)).trim().slice(0, 80),
      source: normalizeUserSectionEntitySource(rule.source)
    };
  }

  function buildRouteSegmentsFromUserPoints(points) {
    var source = Array.isArray(points) ? points.slice().sort(function(a, b) {
      return a.ordinate - b.ordinate;
    }) : [];
    var result = [];
    for (var i = 1; i < source.length; i++) {
      var start = source[i - 1];
      var end = source[i];
      var length = end.ordinate - start.ordinate;
      if (length < 8) continue;
      result.push({
        start: start,
        end: end,
        sector: start.sector,
        length: length,
        userSection: true
      });
    }
    return result;
  }

  function buildFlatProfileFromUserPoints(points, sector) {
    var source = Array.isArray(points) ? points.slice().sort(function(a, b) {
      return a.ordinate - b.ordinate;
    }) : [];
    var result = [];
    for (var i = 1; i < source.length; i++) {
      var start = source[i - 1].ordinate;
      var end = source[i].ordinate;
      var length = end - start;
      if (length < 25) continue;
      result.push({
        start: start,
        end: end,
        length: length,
        grade: 0,
        sector: sector,
        userSection: true,
        altitudeMissing: true,
        sampleCount: 2
      });
    }
    return indexProfileElevations(result);
  }

  function normalizeLearningUserSection(section, mapId, fallbackKey) {
    var source = section && typeof section === 'object' ? section : {};
    var sector = Number(source.sector);
    if (!isRealNumber(sector)) return null;
    var pointSource = Array.isArray(source.routePoints) ? source.routePoints : (Array.isArray(source.points) ? source.points : []);
    var points = thinLearningArray(pointSource, LEARNING_MAX_POINTS_PER_USER_SECTION).map(function(point) {
      return normalizeLearningUserPoint(point, sector);
    }).filter(Boolean).sort(function(a, b) {
      return a.ordinate - b.ordinate || a.ts - b.ts;
    });
    if (points.length < 2) return null;
    for (var i = 0; i < points.length; i++) {
      points[i].position = i;
      points[i].sector = sector;
    }
    var profileSource = Array.isArray(source.profileSegments) ? source.profileSegments : (Array.isArray(source.profile) ? source.profile : []);
    var profileSegments = thinLearningArray(profileSource, LEARNING_MAX_PROFILE_SEGMENTS_PER_USER_SECTION).map(function(segment) {
      return normalizeLearningUserProfileSegment(segment, sector);
    }).filter(Boolean);
    if (!profileSegments.length) profileSegments = buildFlatProfileFromUserPoints(points, sector);
    else profileSegments = indexProfileElevations(profileSegments);
    var objects = thinLearningArray(source.objects, LEARNING_MAX_OBJECTS_PER_USER_SECTION).map(function(item) {
      return normalizeLearningUserObject(item, sector);
    }).filter(Boolean).sort(function(a, b) {
      return a.coordinate - b.coordinate || String(a.type || '').localeCompare(String(b.type || ''));
    });
    var speeds = thinLearningArray(source.speeds, LEARNING_MAX_SPEEDS_PER_USER_SECTION).map(function(rule) {
      return normalizeLearningUserSpeed(rule, sector);
    }).filter(Boolean).sort(function(a, b) {
      return a.coordinate - b.coordinate || a.speed - b.speed;
    });
    var routeSegments = buildRouteSegmentsFromUserPoints(points);
    if (!routeSegments.length) return null;
    var key = normalizeLearningRawTrackKey(source.id || fallbackKey || ('user-' + sector));
    var updatedAt = Math.max(0, Number(source.updatedAt) || 0);
    var verifiedAt = Math.max(0, Number(source.verifiedAt) || 0);
    var history = normalizeLearningUserHistory(source.history);
    var referenceSector = Number(source.referenceSector);
    if (!isRealNumber(referenceSector)) referenceSector = null;
    return {
      id: key,
      mapId: String(source.mapId || mapId || getLearningMapScope()),
      sector: sector,
      referenceSector: referenceSector,
      title: String(source.title || ('GPS участок ' + Math.round(sector))).trim().slice(0, 80),
      sourceTrackKey: String(source.sourceTrackKey || '').slice(0, 160),
      createdAt: Math.max(0, Number(source.createdAt) || updatedAt || verifiedAt || Date.now()),
      updatedAt: updatedAt || verifiedAt || Date.now(),
      verifiedAt: verifiedAt,
      routePoints: points,
      routeSegments: routeSegments,
      profileSegments: profileSegments,
      objects: objects,
      speeds: speeds,
      history: history
    };
  }

  function getUserSectionKeyForDraft(draft) {
    return normalizeLearningRawTrackKey('gps-' + (draft && draft.key ? draft.key : Date.now()));
  }

  function buildUserSectionFromRawDraft(draft) {
    if (!draft || !isRealNumber(draft.sector) || !Array.isArray(draft.routePoints) || draft.routePoints.length < 2) return null;
    var now = Date.now();
    return normalizeLearningUserSection({
      id: getUserSectionKeyForDraft(draft),
      mapId: getLearningMapScope(),
      sector: draft.sector,
      referenceSector: isRealNumber(draft.referenceSector) ? draft.referenceSector : null,
      title: String(draft.title || 'GPS участок').replace(/^GPS черновик/i, 'GPS участок'),
      sourceTrackKey: draft.key || '',
      createdAt: now,
      updatedAt: now,
      verifiedAt: 0,
      routePoints: draft.routePoints,
      profileSegments: draft.profileSegments,
      objects: [],
      speeds: [],
      history: [{
        ts: now,
        action: 'Принят черновик',
        detail: draft.samples + ' GPS-точек'
      }]
    }, getLearningMapScope(), getUserSectionKeyForDraft(draft));
  }

  function getRawDraftSectorForKey(trackKey) {
    var text = String(trackKey || '');
    var hash = 0;
    for (var i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return LEARNING_RAW_DRAFT_SECTOR_BASE + Math.abs(hash % 90000);
  }

  function isSyntheticLearningSector(sector) {
    return isRealNumber(sector) && Number(sector) >= LEARNING_RAW_DRAFT_SECTOR_BASE;
  }

  function getDominantReferenceSector(counts) {
    var bestSector = null;
    var bestCount = 0;
    Object.keys(counts || {}).forEach(function(key) {
      var sector = Number(key);
      var count = counts[key] || 0;
      if (!isRealNumber(sector) || isSyntheticLearningSector(sector)) return;
      if (count > bestCount || (count === bestCount && (bestSector === null || sector < bestSector))) {
        bestSector = sector;
        bestCount = count;
      }
    });
    return bestCount >= 2 ? bestSector : null;
  }

  function buildRawLearningDraft(trackKey, bucket) {
    var normalizedBucket = normalizeLearningRawBucket(bucket, getLearningMapScope());
    var samples = normalizedBucket && Array.isArray(normalizedBucket.samples) ? normalizedBucket.samples : [];
    if (samples.length < 2) return null;
    var points = [];
    var altitudeSamples = 0;
    var distanceMeters = 0;
    var previous = null;
    var sector = getRawDraftSectorForKey(trackKey);
    var referenceCounts = {};
    var referenceAnchors = [];

    for (var i = 0; i < samples.length; i++) {
      var sample = samples[i];
      if (!sample || !isFinite(sample.lat) || !isFinite(sample.lon)) continue;
      if (sample.accuracy && sample.accuracy > LEARNING_MAX_ACCURACY_M) continue;
      if (previous) {
        var step = haversine(previous.lat, previous.lon, sample.lat, sample.lon);
        if (!isFinite(step) || step < 8) continue;
        if (step > 4500) continue;
        distanceMeters += step;
      }
      if (isRealNumber(sample.altitude)) altitudeSamples++;
      var coordinate = Math.round(distanceMeters);
      var nearestSector = Number(sample.nearestSector);
      var nearestCoordinate = Number(sample.nearestCoordinate);
      if (isRealNumber(nearestSector) && !isSyntheticLearningSector(nearestSector)) {
        var nearestKey = getSectorKey(nearestSector);
        referenceCounts[nearestKey] = (referenceCounts[nearestKey] || 0) + 1;
        if (isFinite(nearestCoordinate)) {
          referenceAnchors.push({
            sector: nearestSector,
            coordinate: Math.max(0, Math.round(nearestCoordinate)),
            ordinate: coordinate
          });
        }
      }
      points.push({
        lat: sample.lat,
        lon: sample.lon,
        ordinate: coordinate,
        sector: sector,
        altitude: sample.altitude,
        accuracy: sample.accuracy,
        ts: sample.ts
      });
      previous = sample;
    }

    if (points.length < 2 || distanceMeters < LEARNING_RAW_DRAFT_MIN_DISTANCE_M) return null;
    var referenceSector = getDominantReferenceSector(referenceCounts);
    var referenceAnchor = null;
    if (isRealNumber(referenceSector)) {
      for (var a = 0; a < referenceAnchors.length; a++) {
        if (getSectorKey(referenceAnchors[a].sector) !== getSectorKey(referenceSector)) continue;
        if (!referenceAnchor || referenceAnchors[a].ordinate < referenceAnchor.ordinate) referenceAnchor = referenceAnchors[a];
      }
    }
    if (referenceAnchor && isFinite(referenceAnchor.coordinate)) {
      var offset = Math.round(referenceAnchor.coordinate - referenceAnchor.ordinate);
      if (points[0].ordinate + offset >= 0) {
        for (var shiftIndex = 0; shiftIndex < points.length; shiftIndex++) {
          points[shiftIndex].ordinate = Math.max(0, Math.round(points[shiftIndex].ordinate + offset));
        }
      }
    }
    var routeSegments = [];
    var profileSegments = [];
    for (var p = 1; p < points.length; p++) {
      var start = points[p - 1];
      var end = points[p];
      var length = end.ordinate - start.ordinate;
      if (length < 8) continue;
      routeSegments.push({
        start: start,
        end: end,
        sector: sector,
        length: length
      });
      var hasAltitude = isRealNumber(start.altitude) && isRealNumber(end.altitude);
      var grade = 0;
      if (hasAltitude) {
        var altitudeDelta = end.altitude - start.altitude;
        if (Math.abs(altitudeDelta) <= 140 && length >= 25) {
          grade = clamp((altitudeDelta / length) * 1000, -45, 45);
        }
      }
      if (length >= 25) {
        profileSegments.push({
          start: start.ordinate,
          end: end.ordinate,
          length: length,
          grade: grade,
          sector: sector,
          rawDraft: true,
          altitudeMissing: !hasAltitude,
          sampleCount: 2
        });
      }
    }

    if (!routeSegments.length) return null;
    var title = 'GPS черновик ' + String(trackKey || '').replace(/^(run|shift|raw)-/i, '').slice(0, 18);
    if (title.length < 16) title = 'GPS черновик';
    return {
      key: String(trackKey || ''),
      title: title,
      sector: sector,
      referenceSector: referenceSector,
      samples: samples.length,
      points: points.length,
      altitudeSamples: altitudeSamples,
      lengthMeters: Math.round(distanceMeters),
      updatedAt: normalizedBucket.updatedAt || samples[samples.length - 1].ts || 0,
      promotedAt: normalizedBucket.promotedAt || 0,
      start: points[0],
      end: points[points.length - 1],
      routePoints: points,
      routeSegments: routeSegments,
      profileSegments: indexProfileElevations(profileSegments)
    };
  }

  function normalizeLearningStore(raw) {
    var store = raw && typeof raw === 'object' ? raw : {};
    var normalized = {
      version: 1,
      maps: {}
    };
    var maps = store.maps && typeof store.maps === 'object' ? store.maps : {};
    Object.keys(maps).forEach(function(mapId) {
      var map = maps[mapId] && typeof maps[mapId] === 'object' ? maps[mapId] : {};
      var sectors = map.sectors && typeof map.sectors === 'object' ? map.sectors : {};
      var rawTracks = map.rawTracks && typeof map.rawTracks === 'object' ? map.rawTracks : {};
      var userSections = map.userSections && typeof map.userSections === 'object' ? map.userSections : {};
      var nextMap = {
        updatedAt: Number(map.updatedAt) || 0,
        sectors: {},
        rawTracks: {},
        userSections: {}
      };
      Object.keys(sectors).forEach(function(sectorKey) {
        var bucket = sectors[sectorKey] && typeof sectors[sectorKey] === 'object' ? sectors[sectorKey] : {};
        var samples = Array.isArray(bucket.samples) ? bucket.samples : [];
        var normalizedSamples = samples.map(function(sample) {
          return normalizeLearningSample(sample, mapId);
        }).filter(Boolean).sort(function(a, b) {
          return a.coordinate - b.coordinate || a.ts - b.ts;
        });
        if (normalizedSamples.length > LEARNING_MAX_SAMPLES_PER_SECTOR) {
          normalizedSamples = normalizedSamples.slice(normalizedSamples.length - LEARNING_MAX_SAMPLES_PER_SECTOR);
        }
        if (normalizedSamples.length) {
          nextMap.sectors[sectorKey] = {
            samples: normalizedSamples,
            updatedAt: Number(bucket.updatedAt) || nextMap.updatedAt || 0,
            verifiedAt: Math.max(0, Number(bucket.verifiedAt) || 0),
            verifiedSamples: Math.max(0, Number(bucket.verifiedSamples) || 0),
            verifiedProfileSegments: Math.max(0, Number(bucket.verifiedProfileSegments) || 0)
          };
        }
      });
      Object.keys(rawTracks).slice(-LEARNING_MAX_RAW_TRACKS_PER_MAP).forEach(function(trackKey) {
        var normalizedTrack = normalizeLearningRawBucket(rawTracks[trackKey], mapId);
        if (!normalizedTrack) return;
        var safeTrackKey = normalizeLearningRawTrackKey(trackKey);
        nextMap.rawTracks[safeTrackKey] = normalizedTrack;
        nextMap.updatedAt = Math.max(nextMap.updatedAt, normalizedTrack.updatedAt || 0);
      });
      Object.keys(userSections).slice(-LEARNING_MAX_USER_SECTIONS_PER_MAP).forEach(function(sectionKey) {
        var normalizedSection = normalizeLearningUserSection(userSections[sectionKey], mapId, sectionKey);
        if (!normalizedSection) return;
        nextMap.userSections[normalizedSection.id] = normalizedSection;
        nextMap.updatedAt = Math.max(nextMap.updatedAt, normalizedSection.updatedAt || 0);
      });
      normalized.maps[String(mapId)] = nextMap;
    });
    return normalized;
  }

  function normalizeLearningSyncMeta(raw) {
    var meta = raw && typeof raw === 'object' ? raw : {};
    return {
      pending: !!meta.pending,
      lastSyncAt: Math.max(0, Number(meta.lastSyncAt) || 0),
      error: String(meta.error || '').slice(0, 240)
    };
  }

  function loadLearningSyncState() {
    var meta = normalizeLearningSyncMeta(readJsonStorage(LEARNING_SYNC_STORAGE_KEY, null));
    tracker.learningSync.pending = meta.pending;
    tracker.learningSync.lastSyncAt = meta.lastSyncAt;
    tracker.learningSync.error = meta.error;
    tracker.learningSync.state = meta.pending ? 'pending' : meta.lastSyncAt ? 'synced' : 'idle';
  }

  function saveLearningSyncState() {
    writeJsonStorage(LEARNING_SYNC_STORAGE_KEY, {
      pending: !!tracker.learningSync.pending,
      lastSyncAt: tracker.learningSync.lastSyncAt || 0,
      error: tracker.learningSync.error || ''
    });
  }

  function setLearningSyncState(patch) {
    var next = patch || {};
    if (next.state !== undefined) tracker.learningSync.state = String(next.state || 'idle');
    if (next.pending !== undefined) tracker.learningSync.pending = !!next.pending;
    if (next.lastSyncAt !== undefined) tracker.learningSync.lastSyncAt = Math.max(0, Number(next.lastSyncAt) || 0);
    if (next.error !== undefined) tracker.learningSync.error = String(next.error || '').slice(0, 240);
    saveLearningSyncState();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
  }

  function getLearningApiUrl() {
    if (typeof POEKHALI_LEARNING_API_URL === 'string' && POEKHALI_LEARNING_API_URL) {
      return POEKHALI_LEARNING_API_URL;
    }
    var base = typeof API_BASE_URL === 'string' ? API_BASE_URL : '';
    return base + '/api/poekhali-learning';
  }

  function isLearningSyncAvailable() {
    return typeof fetchJson === 'function' && typeof navigator !== 'undefined';
  }

  function createLearningSyncError(message, code) {
    var error = new Error(message || 'Learning sync failed');
    error.code = code || '';
    return error;
  }

  function hasLearningStoreData(store) {
    var normalized = normalizeLearningStore(store);
    var mapIds = Object.keys(normalized.maps || {});
    for (var i = 0; i < mapIds.length; i++) {
      var map = normalized.maps[mapIds[i]];
      if (map && map.sectors && Object.keys(map.sectors).length) return true;
      if (map && map.rawTracks && Object.keys(map.rawTracks).length) return true;
      if (map && map.userSections && Object.keys(map.userSections).length) return true;
    }
    return false;
  }

  function getLearningSampleMergeKey(sample) {
    return [
      sample.mapId,
      getSectorKey(sample.sector),
      sample.coordinate,
      Math.round(sample.lat * 1000000),
      Math.round(sample.lon * 1000000),
      Math.round(sample.ts || 0)
    ].join(':');
  }

  function getLearningRawSampleMergeKey(sample) {
    return [
      sample.mapId,
      Math.round(sample.lat * 1000000),
      Math.round(sample.lon * 1000000),
      Math.round(sample.ts || 0)
    ].join(':');
  }

  function mergeLearningBucket(baseBucket, incomingBucket, mapId) {
    var buckets = [baseBucket, incomingBucket];
    var byKey = {};
    var samples = [];
    var updatedAt = 0;
    var verification = {
      verifiedAt: 0,
      verifiedSamples: 0,
      verifiedProfileSegments: 0
    };

    for (var b = 0; b < buckets.length; b++) {
      var bucket = buckets[b];
      if (!bucket || typeof bucket !== 'object') continue;
      updatedAt = Math.max(updatedAt, Number(bucket.updatedAt) || 0);
      var verifiedAt = Math.max(0, Number(bucket.verifiedAt) || 0);
      if (verifiedAt >= verification.verifiedAt) {
        verification.verifiedAt = verifiedAt;
        verification.verifiedSamples = Math.max(0, Number(bucket.verifiedSamples) || 0);
        verification.verifiedProfileSegments = Math.max(0, Number(bucket.verifiedProfileSegments) || 0);
      }
      var sourceSamples = Array.isArray(bucket.samples) ? bucket.samples : [];
      for (var s = 0; s < sourceSamples.length; s++) {
        var sample = normalizeLearningSample(sourceSamples[s], mapId);
        if (!sample) continue;
        var key = getLearningSampleMergeKey(sample);
        if (byKey[key]) continue;
        byKey[key] = true;
        samples.push(sample);
      }
    }

    samples.sort(function(a, b) {
      return a.coordinate - b.coordinate || a.ts - b.ts;
    });
    if (samples.length > LEARNING_MAX_SAMPLES_PER_SECTOR) {
      samples = samples.slice(samples.length - LEARNING_MAX_SAMPLES_PER_SECTOR);
    }
    if (!samples.length) return null;

    return {
      samples: samples,
      updatedAt: updatedAt || samples[samples.length - 1].ts || 0,
      verifiedAt: verification.verifiedAt,
      verifiedSamples: verification.verifiedSamples,
      verifiedProfileSegments: verification.verifiedProfileSegments
    };
  }

  function mergeLearningRawBucket(baseBucket, incomingBucket, mapId) {
    var buckets = [baseBucket, incomingBucket];
    var byKey = {};
    var samples = [];
    var updatedAt = 0;
    var promotedAt = 0;

    for (var b = 0; b < buckets.length; b++) {
      var bucket = buckets[b];
      if (!bucket || typeof bucket !== 'object') continue;
      updatedAt = Math.max(updatedAt, Number(bucket.updatedAt) || 0);
      promotedAt = Math.max(promotedAt, Number(bucket.promotedAt) || 0);
      var sourceSamples = Array.isArray(bucket.samples) ? bucket.samples : [];
      for (var s = 0; s < sourceSamples.length; s++) {
        var sample = normalizeLearningRawSample(sourceSamples[s], mapId);
        if (!sample) continue;
        var key = getLearningRawSampleMergeKey(sample);
        if (byKey[key]) continue;
        byKey[key] = true;
        samples.push(sample);
      }
    }

    samples.sort(function(a, b) {
      return a.ts - b.ts;
    });
    if (samples.length > LEARNING_MAX_SAMPLES_PER_RAW_TRACK) {
      samples = samples.slice(samples.length - LEARNING_MAX_SAMPLES_PER_RAW_TRACK);
    }
    if (!samples.length) return null;

    return {
      samples: samples,
      updatedAt: updatedAt || samples[samples.length - 1].ts || 0,
      promotedAt: promotedAt
    };
  }

  function mergeLearningUserSection(baseSection, incomingSection, mapId, sectionKey) {
    var base = normalizeLearningUserSection(baseSection, mapId, sectionKey);
    var incoming = normalizeLearningUserSection(incomingSection, mapId, sectionKey);
    if (!base) return incoming;
    if (!incoming) return base;
    return (incoming.updatedAt || incoming.verifiedAt || 0) >= (base.updatedAt || base.verifiedAt || 0)
      ? incoming
      : base;
  }

  function mergeLearningStores(baseStore, incomingStore) {
    var base = normalizeLearningStore(baseStore);
    var incoming = normalizeLearningStore(incomingStore);
    var result = normalizeLearningStore(base);
    var incomingMapIds = Object.keys(incoming.maps || {});

    for (var m = 0; m < incomingMapIds.length; m++) {
      var mapId = incomingMapIds[m];
      var incomingMap = incoming.maps[mapId];
      if (!result.maps[mapId]) {
        result.maps[mapId] = {
          updatedAt: Number(incomingMap.updatedAt) || 0,
          sectors: {},
          rawTracks: {},
          userSections: {}
        };
      }
      var targetMap = result.maps[mapId];
      if (!targetMap.rawTracks) targetMap.rawTracks = {};
      if (!targetMap.userSections) targetMap.userSections = {};
      targetMap.updatedAt = Math.max(Number(targetMap.updatedAt) || 0, Number(incomingMap.updatedAt) || 0);
      var sectorKeys = Object.keys((incomingMap && incomingMap.sectors) || {});
      for (var s = 0; s < sectorKeys.length; s++) {
        var sectorKey = sectorKeys[s];
        var mergedBucket = mergeLearningBucket(targetMap.sectors[sectorKey], incomingMap.sectors[sectorKey], mapId);
        if (!mergedBucket) continue;
        targetMap.sectors[sectorKey] = mergedBucket;
        targetMap.updatedAt = Math.max(targetMap.updatedAt, mergedBucket.updatedAt || 0);
      }
      var rawTrackKeys = Object.keys((incomingMap && incomingMap.rawTracks) || {});
      for (var r = 0; r < rawTrackKeys.length; r++) {
        var rawTrackKey = normalizeLearningRawTrackKey(rawTrackKeys[r]);
        var mergedRawBucket = mergeLearningRawBucket(targetMap.rawTracks[rawTrackKey], incomingMap.rawTracks[rawTrackKeys[r]], mapId);
        if (!mergedRawBucket) continue;
        targetMap.rawTracks[rawTrackKey] = mergedRawBucket;
        targetMap.updatedAt = Math.max(targetMap.updatedAt, mergedRawBucket.updatedAt || 0);
      }
      var userSectionKeys = Object.keys((incomingMap && incomingMap.userSections) || {});
      for (var u = 0; u < userSectionKeys.length; u++) {
        var userSectionKey = normalizeLearningRawTrackKey(userSectionKeys[u]);
        var mergedUserSection = mergeLearningUserSection(targetMap.userSections[userSectionKey], incomingMap.userSections[userSectionKeys[u]], mapId, userSectionKey);
        if (!mergedUserSection) continue;
        targetMap.userSections[mergedUserSection.id] = mergedUserSection;
        targetMap.updatedAt = Math.max(targetMap.updatedAt, mergedUserSection.updatedAt || 0);
      }
    }

    return normalizeLearningStore(result);
  }

  function renderAfterLearningSyncChange() {
    rebuildLearnedProfiles();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
    requestDraw();
  }

  function loadLearningStore() {
    loadLearningSyncState();
    tracker.learning = normalizeLearningStore(readJsonStorage(LEARNING_STORAGE_KEY, null));
    tracker.sharedLearning = normalizeLearningStore(null);
    rebuildLearnedProfiles();
  }

  function saveLearningStore(options) {
    if (!tracker.learning) tracker.learning = normalizeLearningStore(null);
    tracker.learning = normalizeLearningStore(tracker.learning);
    writeJsonStorage(LEARNING_STORAGE_KEY, tracker.learning);
    if (!(options && options.skipSync)) {
      setLearningSyncState({
        state: typeof navigator !== 'undefined' && navigator.onLine ? 'pending' : 'offline',
        pending: true,
        error: ''
      });
      scheduleLearningSync();
    }
  }

  function scheduleLearningSync(delayMs) {
    if (!isLearningSyncAvailable()) return;
    if (tracker.learningSync.timer) {
      clearTimeout(tracker.learningSync.timer);
      tracker.learningSync.timer = null;
    }
    var delay = Number(delayMs);
    if (!isFinite(delay) || delay < 0) delay = LEARNING_SYNC_DEBOUNCE_MS;
    tracker.learningSync.timer = setTimeout(function() {
      tracker.learningSync.timer = null;
      syncLearningStoreWithServer('scheduled');
    }, delay);
  }

  function syncLearningStoreWithServer(reason) {
    if (!isLearningSyncAvailable()) return Promise.resolve(false);
    if (tracker.learningSync.inFlight) {
      scheduleLearningSync(LEARNING_SYNC_DEBOUNCE_MS);
      return Promise.resolve(false);
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (hasLearningStoreData(tracker.learning) || tracker.learningSync.pending) {
        setLearningSyncState({ state: 'offline', pending: true, error: '' });
      }
      return Promise.resolve(false);
    }

    var apiUrl = getLearningApiUrl();
    var localBefore = normalizeLearningStore(tracker.learning);
    tracker.learningSync.inFlight = true;
    setLearningSyncState({ state: reason === 'load' ? 'loading' : 'syncing', error: '' });

    return fetchJson(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 7000).then(function(result) {
      if (!result.ok) {
        if (result.status === 401) {
          throw createLearningSyncError('Unauthorized', 'unauthorized');
        }
        if (result.status === 404) {
          throw createLearningSyncError('Learning sync unavailable', 'unavailable');
        }
        throw new Error((result.body && result.body.error) || 'Learning load failed');
      }

      var remoteStore = normalizeLearningStore(result.body && result.body.learning);
      var sharedStore = normalizeLearningStore(result.body && result.body.sharedLearning);
      var mergedStore = mergeLearningStores(localBefore, remoteStore);
      var mergedJson = JSON.stringify(mergedStore);
      var remoteJson = JSON.stringify(remoteStore);
      var localJson = JSON.stringify(localBefore);
      var sharedJson = JSON.stringify(sharedStore);
      var previousSharedJson = JSON.stringify(normalizeLearningStore(tracker.sharedLearning));
      var localChanged = mergedJson !== localJson;
      var sharedChanged = sharedJson !== previousSharedJson;
      var shouldPush = tracker.learningSync.pending || mergedJson !== remoteJson;
      tracker.sharedLearning = sharedStore;

      if (localChanged) {
        tracker.learning = mergedStore;
        saveLearningStore({ skipSync: true });
      }
      if (localChanged || sharedChanged) {
        renderAfterLearningSyncChange();
      }

      if (!shouldPush) {
        setLearningSyncState({
          state: 'synced',
          pending: false,
          lastSyncAt: Date.now(),
          error: ''
        });
        tracker.learningSync.inFlight = false;
        return true;
      }

      return fetchJson(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ learning: mergedStore })
      }, 9000).then(function(saveResult) {
        if (!saveResult.ok) {
          if (saveResult.status === 401) {
            throw createLearningSyncError('Unauthorized', 'unauthorized');
          }
          if (saveResult.status === 404) {
            throw createLearningSyncError('Learning sync unavailable', 'unavailable');
          }
          throw new Error((saveResult.body && saveResult.body.error) || 'Learning save failed');
        }
        tracker.learning = normalizeLearningStore(saveResult.body && saveResult.body.learning ? saveResult.body.learning : mergedStore);
        tracker.sharedLearning = normalizeLearningStore(saveResult.body && saveResult.body.sharedLearning !== undefined
          ? saveResult.body.sharedLearning
          : tracker.sharedLearning);
        saveLearningStore({ skipSync: true });
        setLearningSyncState({
          state: 'synced',
          pending: false,
          lastSyncAt: Date.now(),
          error: ''
        });
        tracker.learningSync.inFlight = false;
        renderAfterLearningSyncChange();
        return true;
      });
    }).catch(function(error) {
      tracker.learningSync.inFlight = false;
      var unavailable = error && error.code === 'unavailable';
      setLearningSyncState({
        state: unavailable ? 'local' : 'error',
        pending: hasLearningStoreData(tracker.learning) || tracker.learningSync.pending,
        error: unavailable ? '' : (error && error.message ? error.message : 'Learning sync failed')
      });
      return false;
    });
  }

  function bindLearningSyncEvents() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('online', function() {
      if (tracker.learningSync.pending || hasLearningStoreData(tracker.learning)) {
        scheduleLearningSync(250);
      }
    });
  }

  function getLearningMap(mapId) {
    if (!tracker.learning) tracker.learning = normalizeLearningStore(null);
    var id = String(mapId || getLearningMapScope());
    if (!tracker.learning.maps[id]) {
      tracker.learning.maps[id] = {
        updatedAt: 0,
        sectors: {},
        rawTracks: {},
        userSections: {}
      };
    }
    if (!tracker.learning.maps[id].rawTracks) tracker.learning.maps[id].rawTracks = {};
    if (!tracker.learning.maps[id].userSections) tracker.learning.maps[id].userSections = {};
    return tracker.learning.maps[id];
  }

  function getLearnedSamplesForSector(sector) {
    if (!tracker.learning) return [];
    var map = tracker.learning.maps[getLearningMapScope()];
    if (!map || !map.sectors) return [];
    var bucket = map.sectors[getSectorKey(sector)];
    return bucket && Array.isArray(bucket.samples) ? bucket.samples : [];
  }

  function getLearningSectorBucket(sector) {
    if (!tracker.learning) return null;
    var map = tracker.learning.maps[getLearningMapScope()];
    if (!map || !map.sectors) return null;
    return map.sectors[getSectorKey(sector)] || null;
  }

  function buildLearnedProfileSegments(samples, sector) {
    var source = (samples || []).filter(function(sample) {
      return sample &&
        sample.trackState !== 'offtrack' &&
        isFinite(sample.coordinate) &&
        isRealNumber(sample.altitude);
    }).slice().sort(function(a, b) {
      return a.coordinate - b.coordinate || a.ts - b.ts;
    });
    if (source.length < 2) return [];
    var deduped = [];
    for (var i = 0; i < source.length; i++) {
      var current = source[i];
      var previous = deduped[deduped.length - 1];
      if (previous && Math.abs(previous.coordinate - current.coordinate) < 12) {
        if ((current.accuracy || 9999) < (previous.accuracy || 9999)) deduped[deduped.length - 1] = current;
        continue;
      }
      deduped.push(current);
    }

    var segments = [];
    for (var j = 1; j < deduped.length; j++) {
      var a = deduped[j - 1];
      var b = deduped[j];
      var length = b.coordinate - a.coordinate;
      if (length < 25 || length > 2500) continue;
      var altitudeDelta = b.altitude - a.altitude;
      if (Math.abs(altitudeDelta) > 140) continue;
      var grade = clamp((altitudeDelta / length) * 1000, -45, 45);
      segments.push({
        start: a.coordinate,
        end: b.coordinate,
        length: length,
        grade: grade,
        sector: sector,
        learned: true,
        sampleCount: 2
      });
    }
    return indexProfileElevations(segments);
  }

  function rebuildLearnedProfiles() {
    var profiles = {};
    var userProfiles = {};
    var userSections = [];
    var userSectionsBySector = {};
    var userRoutePoints = [];
    var userRouteSegments = [];
    var userObjectsBySector = {};
    var userSpeedsBySector = {};
    var rawDraftProfiles = {};
    var rawDrafts = [];
    var rawDraftsBySector = {};
    var rawDraftRoutePoints = [];
    var rawDraftRouteSegments = [];
    function collectLearningStore(store, options) {
      var normalized = normalizeLearningStore(store);
      var includeRawDrafts = !(options && options.skipRawDrafts);
      if (!normalized || !normalized.maps) return;
      Object.keys(normalized.maps).forEach(function(mapId) {
        if (mapId !== getLearningMapScope()) return;
        var map = normalized.maps[mapId];
        var sectors = map && map.sectors ? map.sectors : {};
        Object.keys(sectors).forEach(function(sectorKey) {
          var samples = Array.isArray(sectors[sectorKey].samples) ? sectors[sectorKey].samples : [];
          var sector = samples[0] && isRealNumber(samples[0].sector) ? samples[0].sector : Number(sectorKey);
          var built = buildLearnedProfileSegments(samples, sector);
          if (built.length) profiles[sectorKey] = built;
        });
        var sectionStore = map && map.userSections ? map.userSections : {};
        Object.keys(sectionStore).forEach(function(sectionKey) {
          var section = normalizeLearningUserSection(sectionStore[sectionKey], mapId, sectionKey);
          if (!section) return;
          var userKey = getSectorKey(section.sector);
          userSections.push(section);
          userSectionsBySector[userKey] = section;
          if (section.profileSegments.length) userProfiles[userKey] = section.profileSegments;
          userRoutePoints = userRoutePoints.concat(section.routePoints);
          userRouteSegments = userRouteSegments.concat(section.routeSegments);
          userObjectsBySector[userKey] = (userObjectsBySector[userKey] || []).concat(section.objects);
          userSpeedsBySector[userKey] = (userSpeedsBySector[userKey] || []).concat(section.speeds);
        });
        if (!includeRawDrafts) return;
        var rawTracks = map && map.rawTracks ? map.rawTracks : {};
        Object.keys(rawTracks).forEach(function(trackKey) {
          var draft = buildRawLearningDraft(trackKey, rawTracks[trackKey]);
          if (!draft) return;
          if (draft.promotedAt && draft.updatedAt <= draft.promotedAt) return;
          var draftKey = getSectorKey(draft.sector);
          rawDrafts.push(draft);
          rawDraftsBySector[draftKey] = draft;
          if (draft.profileSegments.length) rawDraftProfiles[draftKey] = draft.profileSegments;
          rawDraftRoutePoints = rawDraftRoutePoints.concat(draft.routePoints);
          rawDraftRouteSegments = rawDraftRouteSegments.concat(draft.routeSegments);
        });
      });
    }
    collectLearningStore(tracker.sharedLearning, { skipRawDrafts: true });
    collectLearningStore(tracker.learning, { skipRawDrafts: false });
    rawDrafts.sort(function(a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    userSections.sort(function(a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    tracker.learnedProfilesBySector = profiles;
    tracker.userProfilesBySector = userProfiles;
    tracker.userSections = userSections;
    tracker.userSectionsBySector = userSectionsBySector;
    tracker.userRoutePoints = userRoutePoints;
    tracker.userRouteSegments = userRouteSegments;
    tracker.userObjectsBySector = userObjectsBySector;
    tracker.userSpeedsBySector = userSpeedsBySector;
    tracker.rawDraftProfilesBySector = rawDraftProfiles;
    tracker.rawDrafts = rawDrafts;
    tracker.rawDraftsBySector = rawDraftsBySector;
    tracker.rawDraftRoutePoints = rawDraftRoutePoints;
    tracker.rawDraftRouteSegments = rawDraftRouteSegments;
  }

  function getLearnedProfilePointsForSector(sector) {
    return tracker.learnedProfilesBySector[getSectorKey(sector)] || [];
  }

  function getUserSectionForSector(sector) {
    return tracker.userSectionsBySector[getSectorKey(sector)] || null;
  }

  function getUserProfilePointsForSector(sector) {
    return tracker.userProfilesBySector[getSectorKey(sector)] || [];
  }

  function getUserRoutePointsForSector(sector) {
    var key = getSectorKey(sector);
    return (tracker.userRoutePoints || []).filter(function(point) {
      return getSectorKey(point.sector) === key;
    });
  }

  function getUserRouteSegmentsForSector(sector) {
    var key = getSectorKey(sector);
    return (tracker.userRouteSegments || []).filter(function(segment) {
      return getSectorKey(segment.sector) === key;
    });
  }

  function getUserObjectsForSector(sector) {
    return tracker.userObjectsBySector[getSectorKey(sector)] || [];
  }

  function getUserSpeedRulesForSector(sector, left, right) {
    var rules = tracker.userSpeedsBySector[getSectorKey(sector)] || [];
    var result = [];
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (isFinite(left) && isFinite(right) && !isObjectInRange(rule, left, right)) continue;
      result.push(rule);
    }
    return result;
  }

  function getRawDraftForSector(sector) {
    return tracker.rawDraftsBySector[getSectorKey(sector)] || null;
  }

  function getRawDraftProfilePointsForSector(sector) {
    return tracker.rawDraftProfilesBySector[getSectorKey(sector)] || [];
  }

  function formatSectorDisplayName(sector) {
    var userSection = getUserSectionForSector(sector);
    if (userSection) return userSection.title;
    var draft = getRawDraftForSector(sector);
    if (draft) return draft.title;
    return isRealNumber(sector) ? 'Участок ' + Math.round(sector) : 'Участок';
  }

  function formatSectorShortName(sector) {
    var userSection = getUserSectionForSector(sector);
    if (userSection) return 'GPS уч.';
    var draft = getRawDraftForSector(sector);
    if (draft) return 'GPS черн.';
    return isRealNumber(sector) ? String(Math.round(sector)) : '—';
  }

  function getProfileStatusForSector(sector) {
    if (getEMapProfilePointsForSector(sector).length) return 'emap';
    if (getUserProfilePointsForSector(sector).length) return 'user';
    if (getLearnedProfilePointsForSector(sector).length) return 'learned';
    if (getRegimeProfilePointsForSector(sector).length) return 'regime';
    if (getRawDraftProfilePointsForSector(sector).length) return 'raw';
    if (getEMapProfilePointsForSector(0).length) return 'fallback';
    return 'missing';
  }

  function getLearningSummary() {
    var map = tracker.learning && tracker.learning.maps ? tracker.learning.maps[getLearningMapScope()] : null;
    var sectors = map && map.sectors ? map.sectors : {};
    var rawTracks = map && map.rawTracks ? map.rawTracks : {};
    var sectorKeys = Object.keys(sectors);
    var rawTrackKeys = Object.keys(rawTracks);
    var sampleCount = 0;
    var rawSampleCount = 0;
    var profileSectors = 0;
    var verifiedSectors = 0;
    var changedSectors = 0;
    var onTrack = 0;
    var nearTrack = 0;
    var offTrack = 0;
    var altitudeSamples = 0;
    var rawAltitudeSamples = 0;
    var maxDistance = 0;
    var lastSample = null;
    var lastRawSample = null;
    for (var i = 0; i < sectorKeys.length; i++) {
      var samples = Array.isArray(sectors[sectorKeys[i]].samples) ? sectors[sectorKeys[i]].samples : [];
      sampleCount += samples.length;
      if (tracker.learnedProfilesBySector[sectorKeys[i]] && tracker.learnedProfilesBySector[sectorKeys[i]].length) profileSectors++;
      var sectorSummary = getLearningSectorSummary(Number(sectorKeys[i]));
      if (sectorSummary.verificationState === 'verified') verifiedSectors++;
      else if (sectorSummary.verificationState === 'changed') changedSectors++;
      for (var j = 0; j < samples.length; j++) {
        var sample = samples[j];
        if (sample.trackState === 'near') nearTrack++;
        else if (sample.trackState === 'offtrack') offTrack++;
        else onTrack++;
        if (isRealNumber(sample.altitude)) altitudeSamples++;
        if (isRealNumber(sample.distance)) maxDistance = Math.max(maxDistance, sample.distance);
        if (!lastSample || sample.ts > lastSample.ts) lastSample = sample;
      }
    }
    for (var r = 0; r < rawTrackKeys.length; r++) {
      var rawSamples = Array.isArray(rawTracks[rawTrackKeys[r]].samples) ? rawTracks[rawTrackKeys[r]].samples : [];
      rawSampleCount += rawSamples.length;
      for (var q = 0; q < rawSamples.length; q++) {
        var rawSample = rawSamples[q];
        if (isRealNumber(rawSample.altitude)) rawAltitudeSamples++;
        if (isRealNumber(rawSample.distance)) maxDistance = Math.max(maxDistance, rawSample.distance);
        if (!lastRawSample || rawSample.ts > lastRawSample.ts) lastRawSample = rawSample;
        if (!lastSample || rawSample.ts > lastSample.ts) lastSample = rawSample;
      }
    }
    return {
      sectors: sectorKeys.length,
      samples: sampleCount,
      rawTracks: rawTrackKeys.length,
      rawSamples: rawSampleCount,
      rawDrafts: tracker.rawDrafts ? tracker.rawDrafts.length : 0,
      userSections: tracker.userSections ? tracker.userSections.length : 0,
      totalSamples: sampleCount + rawSampleCount,
      profileSectors: profileSectors,
      verifiedSectors: verifiedSectors,
      changedSectors: changedSectors,
      onTrack: onTrack,
      nearTrack: nearTrack,
      offTrack: offTrack,
      altitudeSamples: altitudeSamples,
      rawAltitudeSamples: rawAltitudeSamples,
      conflictSamples: nearTrack + offTrack,
      maxDistance: maxDistance,
      lastSample: lastSample,
      lastRawSample: lastRawSample
    };
  }

  function getLearningSectorSummary(sector) {
    var samples = getLearnedSamplesForSector(sector);
    var bucket = getLearningSectorBucket(sector);
    var summary = {
      sector: sector,
      samples: samples.length,
      onTrack: 0,
      nearTrack: 0,
      offTrack: 0,
      altitudeSamples: 0,
      profileSegments: getLearnedProfilePointsForSector(sector).length,
      lastSample: null,
      updatedAt: bucket && isFinite(Number(bucket.updatedAt)) ? Number(bucket.updatedAt) : 0,
      verifiedAt: bucket && isFinite(Number(bucket.verifiedAt)) ? Number(bucket.verifiedAt) : 0,
      verifiedSamples: bucket && isFinite(Number(bucket.verifiedSamples)) ? Number(bucket.verifiedSamples) : 0,
      verifiedProfileSegments: bucket && isFinite(Number(bucket.verifiedProfileSegments)) ? Number(bucket.verifiedProfileSegments) : 0,
      verificationState: 'none'
    };
    for (var i = 0; i < samples.length; i++) {
      var sample = samples[i];
      if (sample.trackState === 'near') summary.nearTrack++;
      else if (sample.trackState === 'offtrack') summary.offTrack++;
      else summary.onTrack++;
      if (isRealNumber(sample.altitude)) summary.altitudeSamples++;
      if (!summary.lastSample || sample.ts > summary.lastSample.ts) summary.lastSample = sample;
    }
    var lastTs = summary.lastSample ? summary.lastSample.ts : 0;
    var sourceUpdatedAt = Math.max(summary.updatedAt || 0, lastTs || 0);
    if (!summary.samples) {
      summary.verificationState = 'none';
    } else if (summary.verifiedAt && sourceUpdatedAt <= summary.verifiedAt &&
      summary.samples === summary.verifiedSamples &&
      summary.profileSegments === summary.verifiedProfileSegments) {
      summary.verificationState = 'verified';
    } else if (summary.verifiedAt) {
      summary.verificationState = 'changed';
    } else {
      summary.verificationState = 'draft';
    }
    return summary;
  }

  function getLearningVerificationLabel(state) {
    if (state === 'verified') return 'проверено';
    if (state === 'changed') return 'изменено';
    if (state === 'draft') return 'черновик';
    return '—';
  }

  function getLearningVerificationTone(state) {
    if (state === 'verified') return 'success';
    if (state === 'changed') return 'warning';
    if (state === 'draft') return 'danger';
    return 'muted';
  }

  function setLearningSectorVerified(sector, verified) {
    if (!isRealNumber(sector)) return false;
    var map = getLearningMap();
    var sectorKey = getSectorKey(sector);
    var bucket = map.sectors[sectorKey];
    if (!bucket || !Array.isArray(bucket.samples) || !bucket.samples.length) return false;
    var now = Date.now();
    if (verified) {
      bucket.verifiedAt = now;
      bucket.verifiedSamples = bucket.samples.length;
      bucket.verifiedProfileSegments = getLearnedProfilePointsForSector(sector).length;
    } else {
      bucket.verifiedAt = 0;
      bucket.verifiedSamples = 0;
      bucket.verifiedProfileSegments = 0;
    }
    map.updatedAt = now;
    saveLearningStore();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
    requestDraw();
    return true;
  }

  function focusRawLearningDraft(draft) {
    if (!draft || !isRealNumber(draft.sector) || !draft.routePoints || !draft.routePoints.length) return false;
    var coordinate = draft.lengthMeters ? Math.round(draft.lengthMeters / 2) : draft.routePoints[0].ordinate;
    if (draft.end && isFinite(draft.end.ordinate)) coordinate = Math.round(draft.end.ordinate / 2);
    setPreviewProjection({
      sector: draft.sector,
      lineCoordinate: coordinate,
      rawDraft: true
    }, true);
    closeOpsSheet();
    requestDraw();
    return true;
  }

  function focusUserLearningSection(section) {
    if (!section || !isRealNumber(section.sector) || !section.routePoints || !section.routePoints.length) return false;
    var first = section.routePoints[0].ordinate;
    var last = section.routePoints[section.routePoints.length - 1].ordinate;
    setPreviewProjection({
      sector: section.sector,
      lineCoordinate: Math.round((first + last) / 2),
      userSection: true
    }, true);
    closeOpsSheet();
    requestDraw();
    return true;
  }

  function promoteRawLearningDraft(draft) {
    if (!draft || !draft.key) return false;
    var section = buildUserSectionFromRawDraft(draft);
    if (!section) return false;
    var map = getLearningMap(section.mapId);
    if (!map.userSections) map.userSections = {};
    if (!map.rawTracks) map.rawTracks = {};
    map.userSections[section.id] = section;
    var rawKey = normalizeLearningRawTrackKey(draft.key);
    if (map.rawTracks[rawKey]) {
      map.rawTracks[rawKey].promotedAt = section.updatedAt;
      map.rawTracks[rawKey].updatedAt = Math.max(Number(map.rawTracks[rawKey].updatedAt) || 0, section.updatedAt);
    }
    map.updatedAt = Math.max(Number(map.updatedAt) || 0, section.updatedAt);
    rebuildLearnedProfiles();
    saveLearningStore();
    writeUserSectionToLinkedShift(section, { force: true });
    focusUserLearningSection(section);
    return true;
  }

  function getStoredUserLearningSection(section) {
    if (!section || !section.id || !isRealNumber(section.sector)) return null;
    var map = getLearningMap(section.mapId);
    var stored = map.userSections && map.userSections[section.id] ? map.userSections[section.id] : null;
    if (!stored) return null;
    var normalized = normalizeLearningUserSection(stored, section.mapId, section.id);
    if (!normalized) return null;
    return {
      map: map,
      section: normalized
    };
  }

  function saveStoredUserLearningSection(map, section, options) {
    if (!map || !section || !section.id) return false;
    if (!map.userSections) map.userSections = {};
    var normalized = normalizeLearningUserSection(section, section.mapId, section.id);
    if (!normalized) return false;
    var now = Date.now();
    if (!options || options.touch !== false) {
      normalized.updatedAt = Math.max(now, Number(normalized.updatedAt) || 0);
    }
    map.updatedAt = normalized.updatedAt;
    map.userSections[normalized.id] = normalized;
    rebuildLearnedProfiles();
    saveLearningStore();
    writeUserSectionToLinkedShift(normalized);
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
    requestDraw();
    return true;
  }

  function getUserSectionVerificationState(section) {
    if (!section) return 'missing';
    var verifiedAt = Number(section.verifiedAt) || 0;
    var updatedAt = Number(section.updatedAt) || 0;
    if (!verifiedAt) return 'draft';
    if (updatedAt > verifiedAt + 1000) return 'changed';
    return 'verified';
  }

  function getUserSectionVerificationLabel(section) {
    var state = getUserSectionVerificationState(section);
    if (state === 'verified') return 'проверено';
    if (state === 'changed') return 'изменено';
    if (state === 'draft') return 'на проверку';
    return 'нет участка';
  }

  function getUserSectionQuality(section) {
    var result = {
      ready: false,
      issues: [],
      referenceSector: getUserSectionReferenceSector(section),
      stations: 0,
      signals: 0,
      speeds: 0,
      profileSegments: section && section.profileSegments ? section.profileSegments.length : 0,
      routePoints: section && section.routePoints ? section.routePoints.length : 0
    };
    if (!section) {
      result.issues.push('нет GPS-участка');
      return result;
    }
    var objects = Array.isArray(section.objects) ? section.objects : [];
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].type === '2') result.stations++;
      else if (objects[i].type === '1') result.signals++;
    }
    result.speeds = Array.isArray(section.speeds) ? section.speeds.length : 0;
    if (result.routePoints < 2) result.issues.push('нет рабочей линии');
    if (!isRealNumber(result.referenceSector)) result.issues.push('нет опорного ЭК');
    if (!result.profileSegments) result.issues.push('нет профиля');
    if (!result.stations) result.issues.push('нет станций');
    if (!result.signals) result.issues.push('нет светофоров');
    if (!result.speeds) result.issues.push('нет скоростей');
    if (getUserSectionVerificationState(section) !== 'verified') result.issues.push('не подтвержден');
    result.ready = result.issues.length === 0;
    return result;
  }

  function getUserSectionReferenceSector(section) {
    if (!section) return null;
    var referenceSector = Number(section.referenceSector);
    if (isRealNumber(referenceSector) && !isSyntheticLearningSector(referenceSector)) return referenceSector;
    var sectionSector = Number(section.sector);
    if (isRealNumber(sectionSector) && !isSyntheticLearningSector(sectionSector)) return sectionSector;
    return null;
  }

  function addReferenceSectorOption(seen, result, sector) {
    var numeric = Number(sector);
    if (!isRealNumber(numeric) || isSyntheticLearningSector(numeric)) return;
    var key = getSectorKey(numeric);
    if (!key || seen[key]) return;
    seen[key] = true;
    result.push(numeric);
  }

  function getReferenceSectorOptions(section) {
    var seen = {};
    var result = [];
    var points = tracker.routePoints || [];
    for (var i = 0; i < points.length; i++) addReferenceSectorOption(seen, result, points[i].sector);
    Object.keys(tracker.speedLimitsBySector || {}).forEach(function(key) {
      addReferenceSectorOption(seen, result, key);
    });
    Object.keys(tracker.speedDocsBySector || {}).forEach(function(key) {
      addReferenceSectorOption(seen, result, key);
    });
    Object.keys(tracker.regimeSpeedRulesBySector || {}).forEach(function(key) {
      addReferenceSectorOption(seen, result, key);
    });
    Object.keys(tracker.regimeObjectsBySector || {}).forEach(function(key) {
      addReferenceSectorOption(seen, result, key);
    });
    Object.keys(tracker.trackObjectsByFile || {}).forEach(function(fileKey) {
      var store = tracker.trackObjectsByFile[fileKey];
      Object.keys((store && store.bySector) || {}).forEach(function(key) {
        addReferenceSectorOption(seen, result, key);
      });
    });
    addReferenceSectorOption(seen, result, getUserSectionReferenceSector(section));
    result.sort(function(a, b) {
      return a - b;
    });
    return result;
  }

  function getUserSectionBounds(section) {
    var points = section && Array.isArray(section.routePoints) ? section.routePoints : [];
    if (!points.length) return null;
    var left = points[0].ordinate;
    var right = points[0].ordinate;
    for (var i = 1; i < points.length; i++) {
      left = Math.min(left, points[i].ordinate);
      right = Math.max(right, points[i].ordinate);
    }
    return {
      left: left,
      right: right
    };
  }

  function getReferenceEMapObjectsForSector(sector, left, right, allowedTypes) {
    var store = getCurrentTrackObjectStore();
    var base = store && store.bySector && store.bySector[getSectorKey(sector)] ? store.bySector[getSectorKey(sector)] : [];
    var typeMap = {};
    for (var t = 0; t < allowedTypes.length; t++) typeMap[String(allowedTypes[t])] = true;
    return base.filter(function(item) {
      if (!item || !typeMap[String(item.type || '')]) return false;
      if (isFinite(left) && isFinite(right) && !isObjectInRange(item, left, right)) return false;
      return true;
    });
  }

  function getReferenceEMapSpeedRulesForSector(sector, left, right) {
    var result = [];
    var objects = getReferenceEMapObjectsForSector(sector, left, right, ['3']);
    for (var i = 0; i < objects.length; i++) {
      result.push({
        coordinate: objects[i].coordinate,
        length: objects[i].length,
        end: objects[i].end,
        speed: objects[i].speed,
        name: objects[i].name,
        source: 'emap'
      });
    }
    var sectorSpeeds = tracker.speedLimitsBySector[getSectorKey(sector)] || [];
    for (var j = 0; j < sectorSpeeds.length; j++) {
      var speed = sectorSpeeds[j];
      if (speed.wayNumber && speed.wayNumber !== tracker.wayNumber) continue;
      if (isFinite(left) && isFinite(right) && !isObjectInRange(speed, left, right)) continue;
      result.push({
        coordinate: speed.coordinate,
        length: speed.length,
        end: speed.end,
        speed: speed.speed,
        name: speed.name,
        source: 'emap'
      });
    }
    return result;
  }

  function getReferenceSpeedRulesForUserSection(section, source) {
    var referenceSector = getUserSectionReferenceSector(section);
    var bounds = getUserSectionBounds(section);
    if (!isRealNumber(referenceSector) || !bounds) return [];
    if (source === 'document') return getDocumentSpeedRulesForSector(referenceSector, bounds.left, bounds.right);
    if (source === 'regime') return getRegimeSpeedRulesForSector(referenceSector, bounds.left, bounds.right);
    if (source === 'emap') return getReferenceEMapSpeedRulesForSector(referenceSector, bounds.left, bounds.right);
    return [];
  }

  function getReferenceObjectsForUserSection(section, source) {
    var referenceSector = getUserSectionReferenceSector(section);
    var bounds = getUserSectionBounds(section);
    if (!isRealNumber(referenceSector) || !bounds) return [];
    var items = source === 'regime'
      ? getRegimeTrackObjectsForSector(referenceSector)
      : getReferenceEMapObjectsForSector(referenceSector, bounds.left, bounds.right, ['1', '2']);
    return items.filter(function(item) {
      if (!item || (String(item.type || '') !== '1' && String(item.type || '') !== '2')) return false;
      if (isFinite(bounds.left) && isFinite(bounds.right) && !isObjectInRange(item, bounds.left, bounds.right)) return false;
      return true;
    });
  }

  function buildReferenceSpeedItem(rule, stored, source) {
    if (!rule || !stored) return null;
    var coordinate = Math.max(0, Math.round(Number(rule.coordinate)));
    var end = Math.max(coordinate, Math.round(Number(rule.end) || coordinate + Math.max(0, Number(rule.length) || 0)));
    var speed = Math.round(getSpeedRuleValue(rule));
    if (!isFinite(coordinate) || !isFinite(end) || !isFinite(speed) || speed <= 0) return null;
    var sourceKey = normalizeUserSectionEntitySource(source || rule.source);
    var label = getUserSectionEntitySourceLabel(sourceKey);
    var name = String(rule.name || Math.round(speed)).trim();
    if (!name || name === String(Math.round(speed))) name = label + ' ' + Math.round(speed);
    else if (name.indexOf(label) !== 0) name = label + ' ' + name;
    return {
      id: makeLearningUserEntityId('speed-' + sourceKey),
      sector: stored.sector,
      wayNumber: normalizeWayNumber(rule.wayNumber || tracker.wayNumber),
      coordinate: coordinate,
      length: Math.max(0, end - coordinate),
      end: end,
      speed: speed,
      name: name.slice(0, 80),
      source: sourceKey
    };
  }

  function buildReferenceObjectItem(item, stored, source) {
    if (!item || !stored) return null;
    var type = String(item.type || '');
    if (type !== '1' && type !== '2') return null;
    var coordinate = Math.max(0, Math.round(Number(item.coordinate)));
    var length = Math.max(0, Math.round(Number(item.length) || 0));
    var name = String(item.name || '').trim().slice(0, 80);
    if (!name || !isFinite(coordinate)) return null;
    var sourceKey = normalizeUserSectionEntitySource(source || item.source);
    return {
      id: makeLearningUserEntityId((type === '1' ? 'signal-' : 'station-') + sourceKey),
      fileKey: sourceKey,
      sector: stored.sector,
      type: type,
      name: name,
      coordinate: coordinate,
      length: length,
      end: coordinate + length,
      speed: null,
      source: sourceKey
    };
  }

  function addReferenceSpeedsToUserSection(section, source) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var stored = ref.section;
    if (!Array.isArray(stored.speeds)) stored.speeds = [];
    var rules = getReferenceSpeedRulesForUserSection(stored, source);
    var added = 0;
    for (var i = 0; i < rules.length; i++) {
      var item = buildReferenceSpeedItem(rules[i], stored, source);
      if (!item) continue;
      if (findUserSectionSpeedDuplicate(stored.speeds, item, '') >= 0) continue;
      stored.speeds.push(item);
      added++;
    }
    if (!added) return false;
    stored.updatedAt = Date.now();
    appendUserSectionHistory(stored, 'Импорт скоростей ' + getUserSectionEntitySourceLabel(source), added + ' правил');
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function addReferenceObjectsToUserSection(section, source) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var stored = ref.section;
    if (!Array.isArray(stored.objects)) stored.objects = [];
    var objects = getReferenceObjectsForUserSection(stored, source);
    var added = 0;
    for (var i = 0; i < objects.length; i++) {
      var item = buildReferenceObjectItem(objects[i], stored, source);
      if (!item) continue;
      if (findUserSectionObjectDuplicate(stored.objects, item, '') >= 0) continue;
      stored.objects.push(item);
      added++;
    }
    if (!added) return false;
    stored.updatedAt = Date.now();
    appendUserSectionHistory(stored, 'Импорт объектов ' + getUserSectionEntitySourceLabel(source), added + ' объектов');
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function getUserSectionReferenceSummary(section) {
    return {
      referenceSector: getUserSectionReferenceSector(section),
      emapObjects: getReferenceObjectsForUserSection(section, 'emap').length,
      regimeObjects: getReferenceObjectsForUserSection(section, 'regime').length,
      emapSpeeds: getReferenceSpeedRulesForUserSection(section, 'emap').length,
      regimeSpeeds: getReferenceSpeedRulesForUserSection(section, 'regime').length,
      documentSpeeds: getReferenceSpeedRulesForUserSection(section, 'document').length
    };
  }

  function addReferenceObjectsToStoredSection(stored, source) {
    if (!stored) return 0;
    if (!Array.isArray(stored.objects)) stored.objects = [];
    var objects = getReferenceObjectsForUserSection(stored, source);
    var added = 0;
    for (var i = 0; i < objects.length; i++) {
      var item = buildReferenceObjectItem(objects[i], stored, source);
      if (!item) continue;
      if (findUserSectionObjectDuplicate(stored.objects, item, '') >= 0) continue;
      stored.objects.push(item);
      added++;
    }
    return added;
  }

  function addReferenceSpeedsToStoredSection(stored, source) {
    if (!stored) return 0;
    if (!Array.isArray(stored.speeds)) stored.speeds = [];
    var rules = getReferenceSpeedRulesForUserSection(stored, source);
    var added = 0;
    for (var i = 0; i < rules.length; i++) {
      var item = buildReferenceSpeedItem(rules[i], stored, source);
      if (!item) continue;
      if (findUserSectionSpeedDuplicate(stored.speeds, item, '') >= 0) continue;
      stored.speeds.push(item);
      added++;
    }
    return added;
  }

  function autoCompleteUserLearningSection(section) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var stored = ref.section;
    var details = [];
    if (!isRealNumber(getUserSectionReferenceSector(stored))) {
      var suggestion = getShiftRouteSuggestion();
      if (suggestion && suggestion.status === 'ready' && isRealNumber(suggestion.sector)) {
        stored.referenceSector = suggestion.sector;
        details.push('опорный ЭК уч. ' + suggestion.sector);
      }
    }
    if (!isRealNumber(getUserSectionReferenceSector(stored))) return false;
    var emapObjects = addReferenceObjectsToStoredSection(stored, 'emap');
    var regimeObjects = addReferenceObjectsToStoredSection(stored, 'regime');
    var documentSpeeds = addReferenceSpeedsToStoredSection(stored, 'document');
    var regimeSpeeds = addReferenceSpeedsToStoredSection(stored, 'regime');
    var emapSpeeds = addReferenceSpeedsToStoredSection(stored, 'emap');
    if (emapObjects) details.push('ЭК объекты ' + emapObjects);
    if (regimeObjects) details.push('РК объекты ' + regimeObjects);
    if (documentSpeeds) details.push('ДОК скорости ' + documentSpeeds);
    if (regimeSpeeds) details.push('РК скорости ' + regimeSpeeds);
    if (emapSpeeds) details.push('ЭК скорости ' + emapSpeeds);
    if (!details.length) return false;
    stored.updatedAt = Date.now();
    appendUserSectionHistory(stored, 'Автосборка участка', details.join(' · '));
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function setUserLearningSectionVerified(section, verified) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var stored = ref.section;
    var now = Date.now();
    if (verified) {
      stored.verifiedAt = now;
      appendUserSectionHistory(stored, 'Проверка', 'GPS-участок подтвержден');
    } else {
      stored.verifiedAt = 0;
      appendUserSectionHistory(stored, 'Проверка снята', 'GPS-участок возвращен в проверку');
    }
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function updateUserLearningSectionMeta(section, payload) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var stored = ref.section;
    var title = String(payload && payload.title || '').trim().slice(0, 80);
    if (title) stored.title = title;
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'referenceSector')) {
      var rawReferenceSector = String(payload.referenceSector || '').trim();
      var referenceSector = Number(rawReferenceSector);
      stored.referenceSector = rawReferenceSector && isRealNumber(referenceSector) && !isSyntheticLearningSector(referenceSector)
        ? referenceSector
        : null;
    }
    var nextStart = Math.max(0, Math.round(Number(payload && payload.startCoordinate)));
    if (isFinite(nextStart) && stored.routePoints && stored.routePoints.length) {
      var first = stored.routePoints[0].ordinate;
      var delta = nextStart - first;
      if (delta) {
        stored.routePoints = stored.routePoints.map(function(point) {
          var copy = Object.assign({}, point);
          copy.ordinate = Math.max(0, Math.round(copy.ordinate + delta));
          return copy;
        });
        stored.profileSegments = (stored.profileSegments || []).map(function(segment) {
          var copy = Object.assign({}, segment);
          copy.start = Math.max(0, Math.round(copy.start + delta));
          copy.end = Math.max(copy.start + 1, Math.round(copy.end + delta));
          copy.length = Math.max(1, copy.end - copy.start);
          return copy;
        });
        stored.objects = (stored.objects || []).map(function(item) {
          var copy = Object.assign({}, item);
          copy.coordinate = Math.max(0, Math.round(copy.coordinate + delta));
          copy.end = Math.max(copy.coordinate, Math.round((copy.end !== undefined ? copy.end : copy.coordinate + (copy.length || 0)) + delta));
          copy.length = Math.max(0, copy.end - copy.coordinate);
          return copy;
        });
        stored.speeds = (stored.speeds || []).map(function(rule) {
          var copy = Object.assign({}, rule);
          copy.coordinate = Math.max(0, Math.round(copy.coordinate + delta));
          copy.end = Math.max(copy.coordinate, Math.round((copy.end !== undefined ? copy.end : copy.coordinate + (copy.length || 0)) + delta));
          copy.length = Math.max(0, copy.end - copy.coordinate);
          return copy;
        });
      }
    }
    stored.updatedAt = Date.now();
    appendUserSectionHistory(stored, 'Привязка км/ПК', (title || stored.title || '') +
      (isRealNumber(stored.referenceSector) ? ' · ЭК уч. ' + stored.referenceSector : ''));
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function getEditingUserSectionEntity(section) {
    var edit = tracker.editingUserSectionEntity;
    if (!edit || !section || edit.sectionId !== section.id) return null;
    var ref = getStoredUserLearningSection(section);
    if (!ref) return null;
    var id = String(edit.id || '');
    var kind = String(edit.kind || '');
    var source = kind === 'speed' ? ref.section.speeds : ref.section.objects;
    for (var i = 0; i < source.length; i++) {
      if (String(source[i].id || '') === id) {
        return {
          kind: kind,
          item: source[i]
        };
      }
    }
    tracker.editingUserSectionEntity = null;
    return null;
  }

  function findUserSectionObjectDuplicate(objects, candidate, ignoreId) {
    var source = Array.isArray(objects) ? objects : [];
    var targetName = normalizeRouteName(candidate && candidate.name);
    for (var i = 0; i < source.length; i++) {
      var item = source[i];
      if (!item || String(item.id || '') === String(ignoreId || '')) continue;
      if (String(item.type || '') !== String(candidate.type || '')) continue;
      var delta = Math.abs((Number(item.coordinate) || 0) - (Number(candidate.coordinate) || 0));
      if (delta > 25) continue;
      var itemName = normalizeRouteName(item.name);
      if (delta <= 5 || !targetName || !itemName || targetName === itemName) return i;
    }
    return -1;
  }

  function findUserSectionSpeedDuplicate(speeds, candidate, ignoreId) {
    var source = Array.isArray(speeds) ? speeds : [];
    for (var i = 0; i < source.length; i++) {
      var item = source[i];
      if (!item || String(item.id || '') === String(ignoreId || '')) continue;
      if (normalizeWayNumber(item.wayNumber || tracker.wayNumber) !== normalizeWayNumber(candidate.wayNumber || tracker.wayNumber)) continue;
      if (Math.abs((Number(item.coordinate) || 0) - (Number(candidate.coordinate) || 0)) > 25) continue;
      if (Math.abs((Number(item.end) || 0) - (Number(candidate.end) || 0)) > 25) continue;
      return i;
    }
    return -1;
  }

  function addUserSectionEntity(section, payload) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var stored = ref.section;
    var type = String(payload && payload.type || '').trim();
    var id = String(payload && payload.id || '').trim();
    var coordinate = Math.max(0, Math.round(Number(payload && payload.coordinate)));
    var length = Math.max(0, Math.round(Number(payload && payload.length) || 0));
    var name = String(payload && payload.name || '').trim();
    var speed = Number(payload && payload.speed);
    if (!isFinite(coordinate)) return false;
    if (type === 'speed') {
      if (!isFinite(speed) || speed <= 0) return false;
      if (!Array.isArray(stored.speeds)) stored.speeds = [];
      var speedRule = {
        id: normalizeLearningUserEntityId(id, makeLearningUserEntityId('speed')),
        sector: section.sector,
        wayNumber: normalizeWayNumber(tracker.wayNumber),
        coordinate: coordinate,
        length: length,
        end: coordinate + length,
        speed: Math.round(speed),
        name: name || String(Math.round(speed)),
        source: 'user'
      };
      var speedIndex = id
        ? stored.speeds.findIndex(function(item) { return String(item.id || '') === id; })
        : findUserSectionSpeedDuplicate(stored.speeds, speedRule, '');
      if (speedIndex >= 0) {
        speedRule.id = stored.speeds[speedIndex].id || speedRule.id;
        stored.speeds[speedIndex] = speedRule;
        appendUserSectionHistory(stored, 'Скорость изменена', speedRule.name + ' · ' + formatLineCoordinate(speedRule.coordinate));
      } else {
        stored.speeds.push(speedRule);
        appendUserSectionHistory(stored, 'Скорость добавлена', speedRule.name + ' · ' + formatLineCoordinate(speedRule.coordinate));
      }
    } else {
      var objectType = type === 'signal' ? '1' : '2';
      if (!name) name = type === 'signal' ? 'Сигнал' : 'Станция';
      if (!Array.isArray(stored.objects)) stored.objects = [];
      var objectItem = {
        id: normalizeLearningUserEntityId(id, makeLearningUserEntityId(objectType === '1' ? 'signal' : 'station')),
        fileKey: 'user',
        sector: section.sector,
        type: objectType,
        name: name,
        coordinate: coordinate,
        length: length,
        end: coordinate + length,
        speed: null,
        source: 'user'
      };
      var objectIndex = id
        ? stored.objects.findIndex(function(item) { return String(item.id || '') === id; })
        : findUserSectionObjectDuplicate(stored.objects, objectItem, '');
      if (objectIndex >= 0) {
        objectItem.id = stored.objects[objectIndex].id || objectItem.id;
        stored.objects[objectIndex] = objectItem;
        appendUserSectionHistory(stored, getLearningUserEntityKindLabel(getLearningUserObjectKind(objectItem)) + ' изменен', objectItem.name + ' · ' + formatLineCoordinate(objectItem.coordinate));
      } else {
        stored.objects.push(objectItem);
        appendUserSectionHistory(stored, getLearningUserEntityKindLabel(getLearningUserObjectKind(objectItem)) + ' добавлен', objectItem.name + ' · ' + formatLineCoordinate(objectItem.coordinate));
      }
    }
    tracker.editingUserSectionEntity = null;
    stored.updatedAt = Date.now();
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function deleteUserSectionEntity(section, kind, id) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var stored = ref.section;
    var targetId = String(id || '');
    if (!targetId) return false;
    if (kind === 'speed') {
      var removedSpeed = (stored.speeds || []).filter(function(item) { return String(item.id || '') === targetId; })[0];
      stored.speeds = (stored.speeds || []).filter(function(item) {
        return String(item.id || '') !== targetId;
      });
      appendUserSectionHistory(stored, 'Скорость удалена', removedSpeed ? (removedSpeed.name + ' · ' + formatLineCoordinate(removedSpeed.coordinate)) : targetId);
    } else {
      var removedObject = (stored.objects || []).filter(function(item) { return String(item.id || '') === targetId; })[0];
      stored.objects = (stored.objects || []).filter(function(item) {
        return String(item.id || '') !== targetId;
      });
      appendUserSectionHistory(stored, 'Объект удален', removedObject ? (removedObject.name + ' · ' + formatLineCoordinate(removedObject.coordinate)) : targetId);
    }
    if (tracker.editingUserSectionEntity && tracker.editingUserSectionEntity.id === targetId) {
      tracker.editingUserSectionEntity = null;
    }
    stored.updatedAt = Date.now();
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function addShiftRouteStationsToUserSection(section) {
    var ref = getStoredUserLearningSection(section);
    if (!ref) return false;
    var details = getPoekhaliTrainDetails();
    var route = getShiftRouteRequest(details);
    if (!route || !route.from || !route.to) return false;
    var stored = ref.section;
    if (!Array.isArray(stored.objects)) stored.objects = [];
    var first = stored.routePoints[0].ordinate;
    var last = stored.routePoints[stored.routePoints.length - 1].ordinate;
    var added = 0;
    [
      { name: route.from, coordinate: first },
      { name: route.to, coordinate: last }
    ].forEach(function(item) {
      var objectItem = {
        id: makeLearningUserEntityId('station'),
        fileKey: 'user',
        sector: stored.sector,
        type: '2',
        name: item.name,
        coordinate: item.coordinate,
        length: 0,
        end: item.coordinate,
        speed: null,
        source: 'user'
      };
      var index = findUserSectionObjectDuplicate(stored.objects, objectItem, '');
      if (index >= 0) {
        stored.objects[index] = Object.assign({}, stored.objects[index], objectItem, {
          id: stored.objects[index].id || objectItem.id
        });
      } else {
        stored.objects.push(objectItem);
        added++;
      }
    });
    stored.updatedAt = Date.now();
    appendUserSectionHistory(stored, added ? 'Станции из смены' : 'Станции обновлены', route.from + ' -> ' + route.to);
    return saveStoredUserLearningSection(ref.map, stored, { touch: false });
  }

  function shouldRecordLearningSample(sample) {
    if (!sample) return false;
    if (sample.accuracy && sample.accuracy > LEARNING_MAX_ACCURACY_M) return false;
    var last = tracker.lastLearningSample;
    if (!last) return true;
    if (last.mapId !== sample.mapId) return true;
    if (getSectorKey(last.sector) !== getSectorKey(sample.sector)) return true;
    if (last.trackState !== sample.trackState) return true;
    if (Math.abs(sample.coordinate - last.coordinate) >= LEARNING_MIN_COORDINATE_DELTA_M) return true;
    if (Math.abs((sample.distance || 0) - (last.distance || 0)) >= LEARNING_MIN_DISTANCE_DELTA_M) return true;
    if (sample.ts - last.ts >= LEARNING_MIN_TIME_DELTA_MS) return true;
    return false;
  }

  function shouldRecordRawLearningSample(sample) {
    if (!sample) return false;
    if (sample.accuracy && sample.accuracy > LEARNING_MAX_ACCURACY_M) return false;
    var last = tracker.lastRawLearningSample;
    if (!last) return true;
    if (last.mapId !== sample.mapId) return true;
    if (last.runId !== sample.runId) return true;
    if (last.shiftId !== sample.shiftId) return true;
    var moved = haversine(last.lat, last.lon, sample.lat, sample.lon);
    if (isFinite(moved) && moved >= LEARNING_MIN_COORDINATE_DELTA_M) return true;
    if (Math.abs((sample.distance || 0) - (last.distance || 0)) >= LEARNING_MIN_DISTANCE_DELTA_M) return true;
    if (sample.ts - last.ts >= LEARNING_MIN_TIME_DELTA_MS) return true;
    return false;
  }

  function recordRawLearningSample(position, projection) {
    if (!position || !position.coords) return false;
    var coords = position.coords;
    var mapId = getLearningMapScope();
    var context = getPoekhaliShiftContext();
    var shift = context && context.shift ? context.shift : null;
    var activeRun = getActiveRun();
    var sample = normalizeLearningRawSample({
      mapId: mapId,
      lat: coords.latitude,
      lon: coords.longitude,
      altitude: coords.altitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      distance: projection && isFinite(Number(projection.distance)) ? projection.distance : null,
      shiftId: shift && shift.id ? shift.id : '',
      runId: activeRun && activeRun.id ? activeRun.id : '',
      nearestSector: projection && isRealNumber(projection.sector) ? projection.sector : null,
      nearestCoordinate: projection && isFinite(Number(projection.lineCoordinate)) ? projection.lineCoordinate : null,
      ts: position.timestamp || Date.now()
    }, mapId);
    if (!shouldRecordRawLearningSample(sample)) return false;

    var map = getLearningMap(mapId);
    if (!map.rawTracks) map.rawTracks = {};
    var rawTrackKey = normalizeLearningRawTrackKey(sample.runId ? ('run-' + sample.runId) : sample.shiftId ? ('shift-' + sample.shiftId) : getRawLearningTrackKey());
    if (!map.rawTracks[rawTrackKey]) {
      map.rawTracks[rawTrackKey] = {
        samples: [],
        updatedAt: 0,
        promotedAt: 0
      };
    }
    var samples = map.rawTracks[rawTrackKey].samples;
    samples.push(sample);
    samples.sort(function(a, b) {
      return a.ts - b.ts;
    });
    if (samples.length > LEARNING_MAX_SAMPLES_PER_RAW_TRACK) {
      map.rawTracks[rawTrackKey].samples = samples.slice(samples.length - LEARNING_MAX_SAMPLES_PER_RAW_TRACK);
    }
    map.rawTracks[rawTrackKey].updatedAt = sample.ts;
    map.updatedAt = sample.ts;
    tracker.lastRawLearningSample = sample;
    rebuildLearnedProfiles();
    saveLearningStore();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
    return true;
  }

  function recordLearningSample(position, projection) {
    if (!position || !position.coords) return;
    if (!projection || !isRealNumber(projection.sector) || !isFinite(projection.lineCoordinate)) {
      recordRawLearningSample(position, projection);
      return;
    }
    if (projection.rawDraft) {
      recordRawLearningSample(position, projection);
      return;
    }
    var coords = position.coords;
    var context = getPoekhaliShiftContext();
    var shift = context && context.shift ? context.shift : null;
    var mapId = getLearningMapScope();
    var trackState = getLearningTrackState(projection);
    if (trackState === 'offtrack') {
      recordRawLearningSample(position, projection);
    }
    var sample = normalizeLearningSample({
      mapId: mapId,
      sector: projection.sector,
      coordinate: projection.lineCoordinate,
      lat: coords.latitude,
      lon: coords.longitude,
      altitude: coords.altitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      distance: projection.distance,
      trackState: trackState,
      shiftId: shift && shift.id ? shift.id : '',
      ts: position.timestamp || Date.now()
    }, mapId);
    if (!shouldRecordLearningSample(sample)) return;

    var map = getLearningMap();
    var sectorKey = getSectorKey(sample.sector);
    if (!map.sectors[sectorKey]) {
      map.sectors[sectorKey] = {
        samples: [],
        updatedAt: 0
      };
    }
    var samples = map.sectors[sectorKey].samples;
    samples.push(sample);
    samples.sort(function(a, b) {
      return a.coordinate - b.coordinate || a.ts - b.ts;
    });
    if (samples.length > LEARNING_MAX_SAMPLES_PER_SECTOR) {
      map.sectors[sectorKey].samples = samples.slice(samples.length - LEARNING_MAX_SAMPLES_PER_SECTOR);
    }
    map.sectors[sectorKey].updatedAt = sample.ts;
    map.updatedAt = sample.ts;
    tracker.lastLearningSample = sample;
    rebuildLearnedProfiles();
    saveLearningStore();
    if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
      renderOpsSheet();
    }
  }

  function getMapFiles(map) {
    if (!map) return [];
    var files = Array.isArray(map.files) ? map.files.slice() : [];
    files.push(map.data, map.profile, map.speed);
    return uniqueStrings(files);
  }

  function findMapFile(map, fileName) {
    var target = String(fileName || '').toLowerCase();
    var files = getMapFiles(map);
    for (var i = 0; i < files.length; i++) {
      if (getFileName(files[i]) === target) return files[i];
    }
    return '';
  }

  function getObjectFileEntries(map) {
    return ['1', '1n', '2', '2n'].map(function(key) {
      var path = map && map.objects && map.objects[key] ? map.objects[key] : findMapFile(map, key + '.xml');
      return path ? { key: key, path: path } : null;
    }).filter(Boolean);
  }

  function getSpeedFilePath(map) {
    return (map && map.speed) || findMapFile(map, 'speed.xml');
  }

  function normalizeSpeedDocRule(item) {
    if (!item || typeof item !== 'object') return null;
    var coordinate = normalizeOrdinate(item.coordinate);
    var end = normalizeOrdinate(item.end);
    var speed = parseNumber(item.speed);
    if (!isFinite(coordinate) || !isFinite(end) || !isFinite(speed)) return null;
    if (end < coordinate) {
      var tmp = coordinate;
      coordinate = end;
      end = tmp;
    }
    if (end === coordinate) end = coordinate + 100;
    var sectors = Array.isArray(item.targetSectors) ? item.targetSectors.map(function(value) {
      return Math.round(parseNumber(value));
    }).filter(function(value) {
      return isFinite(value);
    }) : [];
    if (!sectors.length) return null;
    return {
      id: String(item.id || ('speed-doc-' + coordinate + '-' + end + '-' + speed)),
      coordinate: coordinate,
      end: end,
      length: Math.max(100, end - coordinate),
      speed: speed,
      name: String(item.name || item.speed || '').trim() || String(Math.round(speed)),
      note: String(item.raw || '').trim(),
      source: 'document',
      sourceName: String(item.sourceName || 'Документ').trim(),
      sourceCode: String(item.sourceCode || '').trim(),
      sourcePath: String(item.sourcePath || '').trim(),
      sourceUpdatedAt: String(item.sourceUpdatedAt || '').trim(),
      confidence: String(item.confidence || 'medium').trim(),
      appliesTo: String(item.appliesTo || 'all').trim(),
      page: Math.round(parseNumber(item.page) || 0),
      targetSectors: sectors
    };
  }

  function normalizeSpeedDocsPayload(payload) {
    var result = {
      title: payload && payload.title ? String(payload.title) : 'Актуальные скорости',
      generatedAt: payload && payload.generatedAt ? String(payload.generatedAt) : '',
      sources: Array.isArray(payload && payload.sources) ? payload.sources : [],
      rules: [],
      bySector: {},
      counts: payload && payload.counts ? payload.counts : {}
    };
    var rules = Array.isArray(payload && payload.rules) ? payload.rules : [];
    for (var i = 0; i < rules.length; i++) {
      var rule = normalizeSpeedDocRule(rules[i]);
      if (!rule) continue;
      result.rules.push(rule);
      for (var s = 0; s < rule.targetSectors.length; s++) {
        var key = getSectorKey(rule.targetSectors[s]);
        if (!key) continue;
        if (!result.bySector[key]) result.bySector[key] = [];
        result.bySector[key].push(rule);
      }
    }
    Object.keys(result.bySector).forEach(function(key) {
      result.bySector[key].sort(function(a, b) {
        return a.coordinate - b.coordinate || a.speed - b.speed;
      });
    });
    return result;
  }

  function loadSpeedDocs() {
    if (tracker.speedDocsPromise) return tracker.speedDocsPromise;
    tracker.speedDocsPromise = fetchText(ASSET_PATHS.speedDocs)
      .then(function(text) {
        var payload = JSON.parse(text);
        tracker.speedDocs = normalizeSpeedDocsPayload(payload);
        tracker.speedDocsBySector = tracker.speedDocs.bySector || {};
        tracker.speedDocsLoaded = true;
        tracker.speedDocsError = '';
        requestDraw();
        if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
          renderOpsSheet();
        }
        if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
          renderMapPicker();
        }
        return tracker.speedDocs;
      })
      .catch(function(error) {
        tracker.speedDocs = null;
        tracker.speedDocsBySector = {};
        tracker.speedDocsLoaded = false;
        tracker.speedDocsError = error && error.message ? error.message : 'Документы скоростей не загружены';
        requestDraw();
        return null;
      });
    return tracker.speedDocsPromise;
  }

  function getSpeedDocsSummary() {
    var docs = tracker.speedDocs;
    if (!docs) {
      return {
        loaded: false,
        sources: 0,
        rules: 0,
        activeRules: 0,
        sectors: 0,
        updatedAt: '',
        error: tracker.speedDocsError || ''
      };
    }
    var sectors = Object.keys(docs.bySector || {});
    var activeRules = 0;
    for (var s = 0; s < sectors.length; s++) {
      var sectorRules = docs.bySector[sectors[s]] || [];
      for (var r = 0; r < sectorRules.length; r++) {
        if (isDocumentSpeedRuleUsable(sectorRules[r])) activeRules++;
      }
    }
    var updatedAt = '';
    for (var i = 0; i < docs.sources.length; i++) {
      var sourceUpdated = docs.sources[i] && (docs.sources[i].updatedAt || docs.sources[i].updated_at);
      if (sourceUpdated && (!updatedAt || String(sourceUpdated) > updatedAt)) updatedAt = String(sourceUpdated);
    }
    return {
      loaded: true,
      sources: docs.sources.length,
      rules: docs.rules.length,
      activeRules: activeRules,
      sectors: sectors.length,
      updatedAt: updatedAt,
      error: ''
    };
  }

  function normalizeRegimeMapsPayload(payload) {
    var result = {
      title: payload && payload.title ? String(payload.title) : 'Режимные карты',
      generatedAt: payload && payload.generatedAt ? String(payload.generatedAt) : '',
      sources: Array.isArray(payload && payload.sources) ? payload.sources : [],
      bySector: payload && payload.bySector && typeof payload.bySector === 'object' ? payload.bySector : {},
      counts: payload && payload.counts ? payload.counts : {}
    };
    Object.keys(result.bySector).forEach(function(key) {
      if (!Array.isArray(result.bySector[key])) result.bySector[key] = [];
    });
    return result;
  }

  function loadRegimeMaps() {
    if (tracker.regimeMapsPromise) return tracker.regimeMapsPromise;
    tracker.regimeMapsPromise = fetchText(ASSET_PATHS.regimeMaps)
      .then(function(text) {
        var payload = JSON.parse(text);
        tracker.regimeMaps = normalizeRegimeMapsPayload(payload);
        tracker.regimeMapsBySector = tracker.regimeMaps.bySector || {};
        tracker.regimeProfilesBySector = buildRegimeProfilesBySector(tracker.regimeMapsBySector);
        tracker.regimeSpeedRulesBySector = buildRegimeSpeedRulesBySector(tracker.regimeMapsBySector);
        tracker.regimeObjectsBySector = buildRegimeObjectsBySector(tracker.regimeMapsBySector);
        tracker.regimeControlMarksBySector = buildRegimeControlMarksBySector(tracker.regimeMapsBySector);
        tracker.regimeMapsLoaded = true;
        tracker.regimeMapsError = '';
        requestDraw();
        if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
          renderOpsSheet();
        }
        if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
          renderMapPicker();
        }
        return tracker.regimeMaps;
      })
      .catch(function(error) {
        tracker.regimeMaps = null;
        tracker.regimeMapsBySector = {};
        tracker.regimeProfilesBySector = {};
        tracker.regimeSpeedRulesBySector = {};
        tracker.regimeObjectsBySector = {};
        tracker.regimeControlMarksBySector = {};
        tracker.regimeMapsLoaded = false;
        tracker.regimeMapsError = error && error.message ? error.message : 'Режимные карты не загружены';
        requestDraw();
        return null;
      });
    return tracker.regimeMapsPromise;
  }

  function buildRegimeProfilesBySector(bySector) {
    var result = {};
    Object.keys(bySector || {}).forEach(function(sectorKey) {
      var items = Array.isArray(bySector[sectorKey]) ? bySector[sectorKey] : [];
      var segments = [];
      var seen = {};
      var sector = Number(sectorKey);
      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var rawSegments = Array.isArray(item.profileSegments) ? item.profileSegments : [];
        for (var j = 0; j < rawSegments.length; j++) {
          var raw = rawSegments[j] || {};
          var start = Number(raw.start);
          var end = Number(raw.end);
          var grade = Number(raw.grade);
          if (!isFinite(start) || !isFinite(end) || !isFinite(grade)) continue;
          if (end < start) {
            var tmp = start;
            start = end;
            end = tmp;
          }
          var length = Math.round(end - start);
          if (length < 100 || Math.abs(grade) > 45) continue;
          start = Math.round(start);
          end = Math.round(end);
          var key = [
            start,
            end,
            Math.round(grade * 10),
            raw.sourceCode || item.sourceCode || '',
            raw.page || item.page || ''
          ].join(':');
          if (seen[key]) continue;
          seen[key] = true;
          segments.push({
            start: start,
            end: end,
            length: length,
            grade: grade,
            sector: isFinite(sector) ? sector : Number(raw.sector),
            regime: true,
            gradeSigned: raw.gradeSigned === true,
            confidence: raw.confidence || 'rk-extracted',
            sourceCode: raw.sourceCode || item.sourceCode || 'REGIME',
            sourceName: raw.sourceName || item.sourceName || 'Режимная карта',
            sourcePath: raw.sourcePath || item.sourcePath || '',
            sourceUpdatedAt: raw.sourceUpdatedAt || item.sourceUpdatedAt || '',
            page: raw.page || item.page || null
          });
        }
      }
      if (segments.length) result[sectorKey] = indexProfileElevations(segments);
    });
    return result;
  }

  function getRegimeProfilePointsForSector(sector) {
    return tracker.regimeProfilesBySector[getSectorKey(sector)] || [];
  }

  function buildRegimeSpeedRulesBySector(bySector) {
    var result = {};
    Object.keys(bySector || {}).forEach(function(sectorKey) {
      var sector = Number(sectorKey);
      var items = Array.isArray(bySector[sectorKey]) ? bySector[sectorKey] : [];
      var rules = [];
      var seen = {};
      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var rawRules = Array.isArray(item.speedRules) ? item.speedRules : [];
        for (var j = 0; j < rawRules.length; j++) {
          var raw = rawRules[j] || {};
          var targetSectors = Array.isArray(raw.targetSectors) ? raw.targetSectors.map(Number) : [];
          if (targetSectors.length && targetSectors.indexOf(sector) < 0) continue;
          var coordinate = Math.round(Number(raw.coordinate));
          var end = Math.round(Number(raw.end));
          var speed = Number(raw.speed);
          if (!isFinite(coordinate) || !isFinite(end) || !isFinite(speed) || end <= coordinate) continue;
          if (speed < 5 || speed > 160) continue;
          var key = [
            coordinate,
            end,
            Math.round(speed),
            raw.sourceCode || item.sourceCode || '',
            raw.page || item.page || ''
          ].join(':');
          if (seen[key]) continue;
          seen[key] = true;
          rules.push({
            coordinate: coordinate,
            end: end,
            length: end - coordinate,
            speed: speed,
            name: raw.name || ('РК ' + Math.round(speed)),
            note: raw.raw || '',
            source: 'regime',
            sourceName: raw.sourceName || item.sourceName || 'Режимная карта',
            sourceCode: raw.sourceCode || item.sourceCode || 'REGIME',
            sourceUpdatedAt: raw.sourceUpdatedAt || item.sourceUpdatedAt || '',
            sourcePath: raw.sourcePath || item.sourcePath || '',
            confidence: raw.confidence || 'rk-geometry',
            page: raw.page || item.page || null
          });
        }
      }
      if (rules.length) {
        rules.sort(function(a, b) {
          return a.coordinate - b.coordinate || a.speed - b.speed;
        });
        result[sectorKey] = rules;
      }
    });
    return result;
  }

  function getRegimeSpeedRulesForSector(sector, left, right) {
    var sectorRules = tracker.regimeSpeedRulesBySector[getSectorKey(sector)] || [];
    var result = [];
    for (var i = 0; i < sectorRules.length; i++) {
      var rule = sectorRules[i];
      if (!rule || !isFinite(rule.coordinate) || !isFinite(rule.end) || !isFinite(rule.speed)) continue;
      if (isFinite(left) && isFinite(right) && !isObjectInRange(rule, left, right)) continue;
      result.push(rule);
    }
    return result;
  }

  function buildRegimeObjectsBySector(bySector) {
    var result = {};
    Object.keys(bySector || {}).forEach(function(sectorKey) {
      var sector = Number(sectorKey);
      var items = Array.isArray(bySector[sectorKey]) ? bySector[sectorKey] : [];
      var objects = [];
      var seen = {};
      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var rawObjects = Array.isArray(item.objects) ? item.objects : [];
        for (var j = 0; j < rawObjects.length; j++) {
          var raw = rawObjects[j] || {};
          var rawSector = Number(raw.sector);
          if (isFinite(rawSector) && rawSector !== sector) continue;
          var coordinate = Math.round(Number(raw.coordinate));
          var length = Math.max(0, Math.round(Number(raw.length) || 0));
          var name = String(raw.name || '').trim();
          var type = String(raw.type || '').trim();
          if (!isFinite(coordinate) || !type || !name) continue;
          var key = [type, normalizeRouteName(name), Math.round(coordinate / 50)].join(':');
          if (seen[key]) continue;
          seen[key] = true;
          objects.push({
            fileKey: 'regime',
            sector: sector,
            type: type,
            name: name,
            coordinate: coordinate,
            length: length,
            end: coordinate + length,
            speed: isFinite(Number(raw.speed)) ? Number(raw.speed) : null,
            source: 'regime',
            sourceName: raw.sourceName || item.sourceName || 'Режимная карта',
            sourceCode: raw.sourceCode || item.sourceCode || 'REGIME',
            sourceUpdatedAt: raw.sourceUpdatedAt || item.sourceUpdatedAt || '',
            sourcePath: raw.sourcePath || item.sourcePath || '',
            confidence: raw.confidence || 'rk-object',
            page: raw.page || item.page || null
          });
        }
      }
      if (objects.length) {
        objects.sort(function(a, b) {
          return a.coordinate - b.coordinate || a.type.localeCompare(b.type);
        });
        result[sectorKey] = objects;
      }
    });
    return result;
  }

  function getRegimeTrackObjectsForSector(sector) {
    return tracker.regimeObjectsBySector[getSectorKey(sector)] || [];
  }

  function buildRegimeControlMarksBySector(bySector) {
    var result = {};
    Object.keys(bySector || {}).forEach(function(sectorKey) {
      var sector = Number(sectorKey);
      var items = Array.isArray(bySector[sectorKey]) ? bySector[sectorKey] : [];
      var marks = [];
      var seen = {};
      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        var rawMarks = Array.isArray(item.controlMarks) ? item.controlMarks : [];
        for (var j = 0; j < rawMarks.length; j++) {
          var raw = rawMarks[j] || {};
          var rawSector = Number(raw.sector);
          if (isFinite(rawSector) && rawSector !== sector) continue;
          var coordinate = Math.round(Number(raw.coordinate));
          var kind = String(raw.kind || '').trim();
          var name = String(raw.name || '').trim();
          if (!isFinite(coordinate) || !kind || !name) continue;
          var key = [kind, normalizeRouteName(name), Math.round(coordinate / 50)].join(':');
          if (seen[key]) continue;
          seen[key] = true;
          marks.push({
            sector: sector,
            coordinate: coordinate,
            kind: kind,
            name: name,
            source: 'regime-control',
            sourceName: raw.sourceName || item.sourceName || 'Режимная карта',
            sourceCode: raw.sourceCode || item.sourceCode || 'REGIME',
            sourceUpdatedAt: raw.sourceUpdatedAt || item.sourceUpdatedAt || '',
            sourcePath: raw.sourcePath || item.sourcePath || '',
            confidence: raw.confidence || 'rk-control-label',
            page: raw.page || item.page || null
          });
        }
      }
      if (marks.length) {
        marks.sort(function(a, b) {
          return a.coordinate - b.coordinate || a.kind.localeCompare(b.kind);
        });
        result[sectorKey] = marks;
      }
    });
    return result;
  }

  function getRegimeControlMarksForSector(sector) {
    return tracker.regimeControlMarksBySector[getSectorKey(sector)] || [];
  }

  function getRegimeControlMarksInWindow(left, right, sector) {
    var marks = getRegimeControlMarksForSector(sector);
    var result = [];
    for (var i = 0; i < marks.length; i++) {
      var mark = marks[i];
      if (!mark || !isFinite(mark.coordinate)) continue;
      if (isFinite(left) && isFinite(right) && (mark.coordinate < left || mark.coordinate > right)) continue;
      result.push(mark);
    }
    return result;
  }

  function getRegimeMapCoverageForSector(sector) {
    var items = tracker.regimeMapsBySector[getSectorKey(sector)] || [];
    return Array.isArray(items) ? items : [];
  }

  function hasRegimeProfileForSector(sector) {
    if (getRegimeProfilePointsForSector(sector).length) return true;
    var items = getRegimeMapCoverageForSector(sector);
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].profileSegments && items[i].profileSegments.length) return true;
      var hints = items[i] && items[i].profileHints ? items[i].profileHints : null;
      if (hints && hints.grades > 0 && hints.lengths > 0) return true;
    }
    return false;
  }

  function getBestRegimeMapCoverageForSector(sector) {
    var items = getRegimeMapCoverageForSector(sector);
    if (!items.length) return null;
    for (var i = 0; i < items.length; i++) {
      var hints = items[i] && items[i].profileHints ? items[i].profileHints : null;
      if (hints && hints.grades > 0 && hints.lengths > 0) return items[i];
    }
    return items[0];
  }

  function getRegimeMapsSummary() {
    var data = tracker.regimeMaps;
    if (!data) {
      return {
        loaded: false,
        sources: 0,
        pages: 0,
        profilePages: 0,
        profileSegments: 0,
        signedProfileSegments: 0,
        speedRules: 0,
        objects: 0,
        signalObjects: 0,
        controlMarks: 0,
        neutralMarks: 0,
        sectors: 0,
        updatedAt: '',
        generatedAt: '',
        error: tracker.regimeMapsError || ''
      };
    }
    var updatedAt = '';
    for (var i = 0; i < data.sources.length; i++) {
      var sourceUpdated = data.sources[i] && (data.sources[i].updatedAt || data.sources[i].updated_at);
      if (sourceUpdated && (!updatedAt || String(sourceUpdated) > updatedAt)) updatedAt = String(sourceUpdated);
    }
    return {
      loaded: true,
      sources: data.counts && data.counts.sources ? data.counts.sources : data.sources.length,
      pages: data.counts && data.counts.pages ? data.counts.pages : 0,
      profilePages: data.counts && data.counts.profilePages ? data.counts.profilePages : 0,
      profileSegments: data.counts && data.counts.profileSegments ? data.counts.profileSegments : 0,
      signedProfileSegments: data.counts && data.counts.signedProfileSegments ? data.counts.signedProfileSegments : 0,
      speedRules: data.counts && data.counts.speedRules ? data.counts.speedRules : 0,
      objects: data.counts && data.counts.objects ? data.counts.objects : 0,
      signalObjects: data.counts && data.counts.signalObjects ? data.counts.signalObjects : 0,
      controlMarks: data.counts && data.counts.controlMarks ? data.counts.controlMarks : 0,
      neutralMarks: data.counts && data.counts.neutralMarks ? data.counts.neutralMarks : 0,
      sectors: data.counts && data.counts.sectors ? data.counts.sectors : Object.keys(data.bySector || {}).length,
      updatedAt: updatedAt,
      generatedAt: data.generatedAt || '',
      error: ''
    };
  }

  function loadReference() {
    if (tracker.referencePromise) return tracker.referencePromise;
    tracker.referencePromise = fetchText(ASSET_PATHS.reference)
      .then(function(text) {
        var reference = JSON.parse(text);
        tracker.reference = reference && reference.schemaVersion ? reference : null;
        tracker.referenceLoaded = !!tracker.reference;
        tracker.referenceError = '';
        requestDraw();
        return tracker.reference;
      })
      .catch(function(error) {
        tracker.reference = null;
        tracker.referenceLoaded = false;
        tracker.referenceError = error && error.message ? error.message : 'Справочник ТЧЭ-9 не загружен';
        requestDraw();
        return null;
      });
    return tracker.referencePromise;
  }

  function getReferenceSummary() {
    var reference = tracker.reference;
    if (!reference) return '';
    var hauls = Array.isArray(reference.hauls) ? reference.hauls.length : 0;
    var stations = reference.counts && reference.counts.station_on_haul
      ? reference.counts.station_on_haul
      : (Array.isArray(reference.hauls) ? reference.hauls.reduce(function(total, haul) {
        return total + (Array.isArray(haul.stations) ? haul.stations.length : 0);
      }, 0) : 0);
    return 'ТЧЭ-9: ' + hauls + ' уч. / ' + stations + ' ст.';
  }

  function isCurrentMapTch9() {
    var map = tracker.currentMap || {};
    var text = String((map.id || '') + ' ' + (map.title || '') + ' ' + (map.sourceName || '')).toLowerCase();
    return text.indexOf('комсом') !== -1 ||
      text.indexOf('тчэ-9') !== -1 ||
      text.indexOf('tch9') !== -1 ||
      text.indexOf('tche-9') !== -1;
  }

  function findNearestReferenceStation(stations, km) {
    var best = null;
    var prev = null;
    var next = null;
    if (!Array.isArray(stations)) return null;
    for (var i = 0; i < stations.length; i++) {
      var station = stations[i];
      var stationKm = Number(station.km);
      if (!isFinite(stationKm)) continue;
      if (stationKm <= km) prev = station;
      if (stationKm >= km && !next) next = station;
      var delta = Math.abs(stationKm - km);
      if (!best || delta < best.deltaKm) {
        best = {
          station: station,
          deltaKm: delta
        };
      }
    }
    if (!best) return null;
    best.prev = prev;
    best.next = next;
    return best;
  }

  function getReferenceContext(lineCoordinate) {
    var reference = tracker.reference;
    if (!reference || !isCurrentMapTch9() || !isFinite(lineCoordinate)) return null;
    var km = Math.max(0, Math.floor(lineCoordinate / 1000));
    var hauls = Array.isArray(reference.hauls) ? reference.hauls : [];
    var candidates = [];
    for (var i = 0; i < hauls.length; i++) {
      var haul = hauls[i];
      var lengthKm = Number(haul.lengthKm);
      if (!isFinite(lengthKm) || km < 0 || km > lengthKm) continue;
      var nearest = findNearestReferenceStation(haul.stations, km);
      if (!nearest) continue;
      candidates.push({
        haul: haul,
        station: nearest.station,
        prev: nearest.prev,
        next: nearest.next,
        km: km,
        deltaKm: nearest.deltaKm
      });
    }
    candidates.sort(function(a, b) {
      return a.deltaKm - b.deltaKm;
    });
    if (!candidates.length) return null;
    if (candidates.length > 1 && candidates[0].deltaKm >= candidates[1].deltaKm - 0.1) {
      return null;
    }
    return candidates[0];
  }

  function normalizeMapConfig(item) {
    if (!item || !item.data || !item.profile) return null;
    return {
      id: String(item.id || item.title || item.data || 'map'),
      title: String(item.title || item.id || 'Карта ЭК'),
      sourceName: item.sourceName ? String(item.sourceName) : '',
      data: String(item.data),
      profile: String(item.profile),
      speed: item.speed ? String(item.speed) : '',
      files: Array.isArray(item.files) ? item.files.map(String) : [],
      objects: item.objects && typeof item.objects === 'object' ? item.objects : null,
      downloaded: item.downloaded !== false
    };
  }

  function setCurrentMap(map) {
    tracker.currentMap = map || DEFAULT_MAP;
    rebuildLearnedProfiles();
    setMapButton();
  }

  function getMapKey(map) {
    return String(map && map.id ? map.id : (map && map.data ? map.data : 'map'));
  }

  function isCurrentMap(map) {
    return !!(map && tracker.currentMap && getMapKey(map) === getMapKey(tracker.currentMap));
  }

  function getMapDownloadState(map) {
    if (!map) return 'missing';
    if (map.downloaded === false) return 'remote';
    if (!map.data || !map.profile) return 'broken';
    return 'ready';
  }

  function findInstalledMapById(id) {
    var key = String(id || '');
    if (!key) return null;
    var maps = tracker.availableMaps && tracker.availableMaps.length ? tracker.availableMaps : [DEFAULT_MAP];
    for (var i = 0; i < maps.length; i++) {
      var map = maps[i];
      if (!map) continue;
      if (getMapKey(map) === key || String(map.id || '') === key) return map;
    }
    return null;
  }

  function formatRemoteMapError(item) {
    var raw = item && item.downloadError ? String(item.downloadError) : '';
    if (!raw) return item && item.downloaded === false ? 'zip отсутствует в локальном каталоге' : '';
    var normalized = raw.replace(/\s+/g, ' ').trim();
    var lower = normalized.toLowerCase();
    if (lower.indexOf('412') !== -1 && lower.indexOf('service account') !== -1) {
      return 'Firebase Storage: нет прав на скачивание zip';
    }
    if (lower.indexOf('403') !== -1 || lower.indexOf('permission') !== -1) {
      return 'Источник не дает доступ к zip';
    }
    if (lower.indexOf('404') !== -1 || lower.indexOf('not found') !== -1) {
      return 'zip не найден в источнике';
    }
    return normalized.length > 120 ? normalized.slice(0, 117) + '...' : normalized;
  }

  function getMapCatalogSnapshot() {
    var installedMaps = getDownloadedMaps();
    var allRemote = Array.isArray(tracker.remoteMaps) ? tracker.remoteMaps : [];
    var remote = REMOTE_MAP_SOURCE_ENABLED ? allRemote : [];
    var seen = {};
    var items = [];
    var remoteInstalled = 0;
    var unavailable = 0;

    for (var i = 0; i < remote.length; i++) {
      var remoteItem = remote[i];
      if (!remoteItem) continue;
      var id = String(remoteItem.id || remoteItem.title || remoteItem.zip || ('remote-' + i));
      var installedMap = findInstalledMapById(id);
      var installed = !!installedMap || remoteItem.downloaded !== false;
      seen[id] = true;
      if (installed) remoteInstalled += 1;
      else unavailable += 1;
      items.push({
        id: id,
        title: String(remoteItem.title || remoteItem.id || 'Карта ЭК'),
        sourceName: remoteItem.sourceName ? String(remoteItem.sourceName) : '',
        zip: remoteItem.zip ? String(remoteItem.zip) : '',
        map: installedMap,
        state: installed ? 'installed' : 'unavailable',
        reason: installed ? '' : formatRemoteMapError(remoteItem)
      });
    }

    for (var j = 0; j < installedMaps.length; j++) {
      var map = installedMaps[j];
      var mapId = getMapKey(map);
      if (seen[mapId]) continue;
      items.unshift({
        id: mapId,
        title: map.title || map.id || 'Карта ЭК',
        sourceName: map.sourceName || 'локальная карта',
        zip: '',
        map: map,
        state: 'installed',
        reason: ''
      });
    }

    return {
      installed: installedMaps.length,
      remoteTotal: remote.length,
      remoteDisabled: !REMOTE_MAP_SOURCE_ENABLED,
      disabledRemoteTotal: !REMOTE_MAP_SOURCE_ENABLED ? allRemote.length : 0,
      remoteInstalled: remoteInstalled,
      unavailable: unavailable,
      generatedAt: tracker.mapManifestGeneratedAt || '',
      items: items
    };
  }

  function loadMapProbe(map) {
    var normalized = normalizeMapConfig(map);
    if (!normalized) return Promise.resolve(null);
    var key = getMapKey(normalized);
    if (isCurrentMap(normalized) && tracker.assetsLoaded && tracker.routePoints.length) {
      return Promise.resolve({
        map: normalized,
        points: tracker.routePoints,
        segments: tracker.routeSegments
      });
    }
    if (tracker.mapProbeCache[key]) return tracker.mapProbeCache[key];
    tracker.mapProbeCache[key] = fetchText(normalized.data)
      .then(function(text) {
        var parsed = parseMapXml(text);
        return {
          map: normalized,
          points: parsed.points || [],
          segments: parsed.segments || []
        };
      })
      .catch(function(error) {
        return {
          map: normalized,
          points: [],
          segments: [],
          error: error && error.message ? error.message : 'data.xml не прочитан'
        };
      });
    return tracker.mapProbeCache[key];
  }

  function setMapButton() {
    var el = byId('btnPoekhaliMap');
    if (!el) return;
    var map = tracker.currentMap || DEFAULT_MAP;
    var index = tracker.availableMaps.findIndex(function(item) {
      return item.id === map.id;
    });
    var compact = window.innerWidth <= 420;
    el.classList.toggle('is-hidden', tracker.availableMaps.length <= 1);
    el.textContent = tracker.availableMaps.length > 1 && !compact ? 'ЭК ' + (index + 1) : 'ЭК';
    el.title = map.title || 'Карта ЭК';
    el.setAttribute('aria-label', 'Карта ЭК: ' + (map.title || 'Карта ЭК'));
    if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
      renderMapPicker();
    }
  }

  function loadManifest() {
    if (tracker.manifestPromise) return tracker.manifestPromise;

    tracker.manifestPromise = fetchText(ASSET_PATHS.manifest)
      .then(function(text) {
        var manifest = JSON.parse(text);
        var maps = Array.isArray(manifest.maps) ? manifest.maps.map(normalizeMapConfig).filter(Boolean) : [];
        tracker.mapManifestGeneratedAt = manifest && manifest.generatedAt ? String(manifest.generatedAt) : '';
        tracker.remoteMaps = Array.isArray(manifest.remote) ? manifest.remote : [];
        tracker.availableMaps = maps.length ? maps : [DEFAULT_MAP];
        var storedId = '';
        try {
          storedId = localStorage.getItem(MAP_STORAGE_KEY) || '';
        } catch (error) {}
        var selected = tracker.availableMaps.find(function(item) {
          return item.id === storedId;
        }) || tracker.availableMaps[0] || DEFAULT_MAP;
        setCurrentMap(selected);
        return selected;
      })
      .catch(function() {
        tracker.mapManifestGeneratedAt = '';
        tracker.availableMaps = [DEFAULT_MAP];
        tracker.remoteMaps = [];
        setCurrentMap(DEFAULT_MAP);
        return DEFAULT_MAP;
      });

    return tracker.manifestPromise;
  }

  function resetMapData() {
    tracker.assetsLoaded = false;
    tracker.assetsError = '';
    tracker.routePoints = [];
    tracker.routeSegments = [];
    tracker.profilePoints = [];
    tracker.profileBySector = {};
    tracker.trackObjectsByFile = {};
    tracker.speedLimits = [];
    tracker.speedLimitsBySector = {};
    tracker.projection = null;
    tracker.nearestProjection = null;
    tracker.autoPosition = null;
    tracker.lastDirectionProbe = null;
    tracker.previewCoordinate = null;
    tracker.previewSector = null;
    rebuildLearnedProfiles();
  }

  function selectMap(map, options) {
    options = options || {};
    if (!options.keepPicker) closeMapPicker();
    if (!map || map.id === tracker.currentMap.id) return Promise.resolve(false);
    setCurrentMap(map);
    try {
      localStorage.setItem(MAP_STORAGE_KEY, map.id);
    } catch (error) {}
    tracker.assetPromise = null;
    tracker.assetMapId = '';
    resetMapData();
    tracker.status = 'loading';
    var loaded = loadAssets();
    requestDraw();
    return loaded;
  }

  function cycleMap() {
    if (!tracker.availableMaps.length) return;
    var currentIndex = tracker.availableMaps.findIndex(function(item) {
      return item.id === tracker.currentMap.id;
    });
    var nextIndex = (currentIndex + 1) % tracker.availableMaps.length;
    selectMap(tracker.availableMaps[nextIndex]);
  }

  function getMapPicker() {
    if (tracker.mapPicker && tracker.mapPicker.root && tracker.mapPicker.root.parentNode) {
      return tracker.mapPicker;
    }
    var host = document.body;
    if (!host) return null;

    var root = document.createElement('div');
    root.id = 'poekhaliMapSheet';
    root.className = 'poekhali-map-sheet hidden';

    var backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'poekhali-map-sheet-backdrop';
    backdrop.setAttribute('aria-label', 'Закрыть выбор карты');

    var panel = document.createElement('div');
    panel.className = 'poekhali-map-sheet-panel';

    var head = document.createElement('div');
    head.className = 'poekhali-map-sheet-head';

    var titleWrap = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'poekhali-map-sheet-title';
    title.textContent = 'Карта ЭК';
    var subtitle = document.createElement('div');
    subtitle.className = 'poekhali-map-sheet-subtitle';
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'poekhali-map-sheet-close';
    closeBtn.textContent = 'Закрыть';

    var list = document.createElement('div');
    list.className = 'poekhali-map-sheet-list';

    var sectorBlock = document.createElement('div');
    sectorBlock.className = 'poekhali-sector-section hidden';
    var sectorHead = document.createElement('div');
    sectorHead.className = 'poekhali-sector-head';
    var sectorTitle = document.createElement('div');
    sectorTitle.className = 'poekhali-sector-title';
    sectorTitle.textContent = 'Участки';
    var sectorSubtitle = document.createElement('div');
    sectorSubtitle.className = 'poekhali-sector-subtitle';
    sectorHead.appendChild(sectorTitle);
    sectorHead.appendChild(sectorSubtitle);
    var sectorList = document.createElement('div');
    sectorList.className = 'poekhali-sector-list';
    sectorBlock.appendChild(sectorHead);
    sectorBlock.appendChild(sectorList);

    head.appendChild(titleWrap);
    head.appendChild(closeBtn);
    panel.appendChild(head);
    panel.appendChild(list);
    panel.appendChild(sectorBlock);
    root.appendChild(backdrop);
    root.appendChild(panel);
    host.appendChild(root);

    function handleMapSheetClose(event) {
      if (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
      }
      closeMapPicker();
    }

    panel.addEventListener('click', function(event) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    });
    panel.addEventListener('pointerdown', function(event) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    });
    backdrop.addEventListener('click', handleMapSheetClose);
    backdrop.addEventListener('pointerdown', handleMapSheetClose);
    closeBtn.addEventListener('click', handleMapSheetClose);
    closeBtn.addEventListener('pointerdown', handleMapSheetClose);

    tracker.mapPicker = {
      root: root,
      list: list,
      subtitle: subtitle,
      sectorBlock: sectorBlock,
      sectorSubtitle: sectorSubtitle,
      sectorList: sectorList
    };
    return tracker.mapPicker;
  }

  function clearElement(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderRemoteMapCatalogPreview(parent) {
    if (!parent) return;
    var snapshot = getMapCatalogSnapshot();
    if (!snapshot.remoteTotal) return;
    var unavailableItems = snapshot.items.filter(function(item) {
      return item && item.state === 'unavailable';
    });
    var note = document.createElement('div');
    note.className = 'poekhali-map-sheet-note';
    note.textContent = unavailableItems.length
      ? ('Каталог ek_files: ' + snapshot.remoteInstalled + '/' + snapshot.remoteTotal +
        ' доступны, ' + unavailableItems.length + ' недоступно. ' + unavailableItems[0].reason + '.')
      : ('Каталог ek_files: ' + snapshot.remoteInstalled + '/' + snapshot.remoteTotal + ' доступны.');
    parent.appendChild(note);

    var preview = unavailableItems.slice(0, 4);
    for (var i = 0; i < preview.length; i++) {
      var item = preview[i];
      var row = document.createElement('div');
      row.className = 'poekhali-map-option is-unavailable';
      row.title = item.reason || 'Карта недоступна';

      var text = document.createElement('span');
      text.className = 'poekhali-map-option-text';
      var title = document.createElement('strong');
      title.textContent = item.title;
      var source = document.createElement('span');
      source.textContent = (item.sourceName || item.zip || 'remote') + ' · ' + (item.reason || 'недоступно');
      text.appendChild(title);
      text.appendChild(source);

      var status = document.createElement('span');
      status.className = 'poekhali-map-option-status';
      status.textContent = 'Недоступно';

      row.appendChild(text);
      row.appendChild(status);
      parent.appendChild(row);
    }

    if (unavailableItems.length > preview.length) {
      var more = document.createElement('div');
      more.className = 'poekhali-map-sheet-note';
      more.textContent = 'Еще ' + (unavailableItems.length - preview.length) + ' карт с той же проблемой видно в ПР -> Каталог ЭК.';
      parent.appendChild(more);
    }
  }

  function renderMapPicker() {
    var picker = getMapPicker();
    if (!picker) return;
    ensureDownloadedMapsReadiness();
    clearElement(picker.list);

    var maps = tracker.availableMaps.length ? tracker.availableMaps : [DEFAULT_MAP];
    var mapSummary = tracker.assetsLoaded ? getMapReadinessSummary() : null;
    picker.subtitle.textContent = mapSummary
      ? (maps.length + ' загружено · готово ' + mapSummary.ready + '/' + mapSummary.sectors)
      : (maps.length + ' загружено');
    for (var i = 0; i < maps.length; i++) {
      (function(map, index) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'poekhali-map-option';
        if (tracker.currentMap && tracker.currentMap.id === map.id) row.classList.add('is-selected');

        var text = document.createElement('span');
        text.className = 'poekhali-map-option-text';
        var title = document.createElement('strong');
        title.textContent = map.title || ('Карта ' + (index + 1));
        var source = document.createElement('span');
        var readiness = getCachedDownloadedMapReadiness(map);
        source.textContent = (map.sourceName || 'локальная карта') +
          (readiness && readiness.sectors ? ' · готово ' + readiness.ready + '/' + readiness.sectors : '');
        text.appendChild(title);
        text.appendChild(source);

        var status = document.createElement('span');
        status.className = 'poekhali-map-option-status';
        var isSelectedMap = tracker.currentMap && tracker.currentMap.id === map.id;
        var isGpsCandidate = tracker.autoMapCandidate && tracker.autoMapCandidate.map && tracker.autoMapCandidate.map.id === map.id;
        var isRouteCandidate = tracker.routeMapCandidate && tracker.routeMapCandidate.map && tracker.routeMapCandidate.map.id === map.id;
        status.textContent = isSelectedMap
          ? 'Выбрана'
          : isGpsCandidate
            ? 'GPS ближе'
            : isRouteCandidate
              ? 'Маршрут'
              : readiness && readiness.state === 'blocked'
                ? 'Проверить'
                : readiness && readiness.state === 'review'
                  ? 'Нужно сверить'
                  : 'Выбрать';

        row.appendChild(text);
        row.appendChild(status);
        row.addEventListener('click', function() {
          selectMap(map);
        });
        picker.list.appendChild(row);
      })(maps[i], i);
    }

    renderRemoteMapCatalogPreview(picker.list);

    renderSectorPicker(picker);
  }

  function getCurrentDisplaySector() {
    if (tracker.projection && tracker.projection.onTrack && isRealNumber(tracker.projection.sector)) return tracker.projection.sector;
    if (isRealNumber(tracker.previewSector)) return tracker.previewSector;
    var storedPreview = readPreviewProjection();
    if (storedPreview && isRealNumber(storedPreview.sector)) return storedPreview.sector;
    return null;
  }

  function renderSectorPicker(picker) {
    if (!picker || !picker.sectorBlock || !picker.sectorList) return;
    clearElement(picker.sectorList);
    var sectors = getAvailableSectors();
    if ((!tracker.assetsLoaded && !(tracker.userSections && tracker.userSections.length)) || !sectors.length) {
      picker.sectorBlock.classList.add('hidden');
      return;
    }
    picker.sectorBlock.classList.remove('hidden');
    var profileCount = 0;
    for (var i = 0; i < sectors.length; i++) {
      if (hasProfileForSector(sectors[i])) profileCount++;
    }
    picker.sectorSubtitle.textContent = sectors.length + ' участков · профиль ' + profileCount + '/' + sectors.length;
    var activeSector = getCurrentDisplaySector();
    for (var j = 0; j < sectors.length; j++) {
      (function(sector) {
        var counts = getSectorObjectCounts(sector);
        var profileStatus = getProfileStatusForSector(sector);
        var hasProfile = profileStatus !== 'missing';
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'poekhali-sector-option';
        if (isRealNumber(activeSector) && getSectorKey(activeSector) === getSectorKey(sector)) {
          button.classList.add('is-selected');
        }

        var text = document.createElement('span');
        text.className = 'poekhali-sector-option-text';
        var title = document.createElement('strong');
        title.textContent = 'Участок ' + sector;
        var meta = document.createElement('span');
        meta.textContent = formatSectorRange(sector);
        text.appendChild(title);
        text.appendChild(meta);

        var status = document.createElement('span');
        status.className = 'poekhali-sector-option-status';
        var profile = document.createElement('span');
        profile.className = 'poekhali-sector-badge ' + (profileStatus === 'learned' || profileStatus === 'user' ? 'is-learned' : hasProfile ? 'is-ready' : 'is-route-only');
        profile.textContent = profileStatus === 'user'
          ? 'GPS уч.'
          : profileStatus === 'learned'
          ? 'GPS'
          : profileStatus === 'regime'
            ? 'РК'
            : hasProfile
              ? 'Профиль'
              : 'Маршрут';
        var objects = document.createElement('span');
        objects.className = 'poekhali-sector-counts';
        objects.textContent = counts.stations + ' ст · ' + counts.signals + ' св · ' + counts.speeds + ' огр';
        status.appendChild(profile);
        status.appendChild(objects);

        button.appendChild(text);
        button.appendChild(status);
        button.addEventListener('click', function() {
          selectPreviewSector(sector, 'middle');
          closeMapPicker();
        });
        picker.sectorList.appendChild(button);
      })(sectors[j]);
    }
  }

  function showMapPicker() {
    var picker = getMapPicker();
    if (!picker) return null;
    tracker.mapPickerOpen = true;
    renderMapPicker();
    picker.root.classList.remove('hidden');
    return picker;
  }

  function openMapPicker() {
    var picker = showMapPicker();
    if (!picker) return;
    Promise.resolve()
      .then(function() {
        return loadManifest();
      })
      .then(function() {
        return loadAssets();
      })
      .then(function() {
        if (!tracker.mapPickerOpen) return;
        renderMapPicker();
      })
      .catch(function() {
        if (!tracker.mapPickerOpen) return;
        renderMapPicker();
      });
  }

  function closeMapPicker() {
    tracker.mapPickerOpen = false;
    if (tracker.mapPicker && tracker.mapPicker.root) {
      tracker.mapPicker.root.classList.add('hidden');
    }
  }

  function createField(labelText, input) {
    var field = document.createElement('label');
    field.className = 'poekhali-ops-field';
    var label = document.createElement('span');
    label.textContent = labelText;
    field.appendChild(label);
    field.appendChild(input);
    return field;
  }

  function createNumberInput(value, min, max, step) {
    var input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step || 1);
    input.value = String(value);
    return input;
  }

  function getOpsSheet() {
    if (tracker.opsSheet && tracker.opsSheet.root && tracker.opsSheet.root.parentNode) {
      return tracker.opsSheet;
    }
    var shell = byId('poekhaliModeShell');
    if (!shell) return null;

    var root = document.createElement('div');
    root.id = 'poekhaliOpsSheet';
    root.className = 'poekhali-ops-sheet hidden';

    var backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'poekhali-map-sheet-backdrop';
    backdrop.setAttribute('aria-label', 'Закрыть настройки Поехали');

    var panel = document.createElement('div');
    panel.className = 'poekhali-ops-panel';

    var head = document.createElement('div');
    head.className = 'poekhali-map-sheet-head';
    var titleWrap = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'poekhali-map-sheet-title';
    title.textContent = 'Поехали';
    var subtitle = document.createElement('div');
    subtitle.className = 'poekhali-map-sheet-subtitle';
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'poekhali-map-sheet-close';
    closeBtn.textContent = 'Закрыть';
    head.appendChild(titleWrap);
    head.appendChild(closeBtn);

    var content = document.createElement('div');
    content.className = 'poekhali-ops-content';

    panel.appendChild(head);
    panel.appendChild(content);
    root.appendChild(backdrop);
    root.appendChild(panel);
    shell.appendChild(root);

    backdrop.addEventListener('click', closeOpsSheet);
    closeBtn.addEventListener('click', closeOpsSheet);

    tracker.opsSheet = {
      root: root,
      subtitle: subtitle,
      content: content
    };
    return tracker.opsSheet;
  }

  function createShiftInfoCell(labelText, valueText, tone) {
    var cell = document.createElement('div');
    cell.className = 'poekhali-shift-info-cell';
    if (tone) cell.classList.add('is-' + tone);
    var label = document.createElement('span');
    label.textContent = labelText;
    var value = document.createElement('strong');
    value.textContent = valueText || '—';
    cell.appendChild(label);
    cell.appendChild(value);
    return cell;
  }

  function normalizeOpsView(value) {
    var view = String(value || '').trim();
    if (view === 'warnings' || view === 'map') return view;
    if (view === 'service') return isPoekhaliDebugUiEnabled() ? view : 'drive';
    return 'drive';
  }

  function isPoekhaliDebugUiEnabled() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.get('poekhaliDebug') === '1' || params.get('debug') === 'poekhali') return true;
    } catch (error) {
      // Keep the production UI clean even when URL parsing is unavailable.
    }
    return readStringStorage('poekhali.debugUi') === '1';
  }

  function setOpsView(view) {
    tracker.opsView = normalizeOpsView(view);
    writeStringStorage(OPS_VIEW_STORAGE_KEY, tracker.opsView);
    renderOpsSheet();
  }

  function renderOpsTabs(parent) {
    var tabs = [
      { id: 'drive', label: 'Поездка' },
      { id: 'warnings', label: 'ПР' },
      { id: 'map', label: 'Карта' }
    ];
    if (isPoekhaliDebugUiEnabled()) {
      tabs.push({ id: 'service', label: 'Сервис' });
    }
    var wrap = document.createElement('div');
    wrap.className = 'poekhali-ops-tabs';
    wrap.style.setProperty('--poekhali-ops-tab-count', String(tabs.length));
    for (var i = 0; i < tabs.length; i++) {
      (function(tab) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'poekhali-ops-tab';
        if (normalizeOpsView(tracker.opsView) === tab.id) btn.classList.add('is-active');
        btn.textContent = tab.label;
        btn.addEventListener('click', function() {
          setOpsView(tab.id);
        });
        wrap.appendChild(btn);
      })(tabs[i]);
    }
    parent.appendChild(wrap);
  }

  function getUserTripReadiness() {
    var details = getPoekhaliTrainDetails();
    var routeSuggestion = getShiftRouteSuggestion();
    var liveProjection = tracker.projection && tracker.projection.onTrack ? tracker.projection : null;
    var previewProjection = liveProjection ? null : getPreviewProjection();
    var activeRun = getActiveRun();
    var blockers = [];
    var actions = [];

    if (!details.hasShift) {
      blockers.push('Выберите смену');
      actions.push('shift');
    } else if (details.compositionReadiness === 'blocked') {
      blockers.push('Заполните поезд');
      actions.push('shift');
    }
    if (!tracker.assetsLoaded) {
      blockers.push(tracker.assetsError ? 'Карта не открылась' : 'Карта загружается');
      actions.push('map');
    }
    if (!liveProjection && !previewProjection && routeSuggestion.status !== 'ready') {
      blockers.push('Нужен GPS или маршрут');
      actions.push('gps');
    }

    var positionText = liveProjection
      ? formatLineCoordinate(liveProjection.lineCoordinate)
      : previewProjection
        ? formatLineCoordinate(previewProjection.lineCoordinate)
        : routeSuggestion.status === 'ready'
          ? 'маршрут найден'
          : 'ждет GPS';

    return {
      details: details,
      routeSuggestion: routeSuggestion,
      liveProjection: liveProjection,
      previewProjection: previewProjection,
      activeRun: activeRun,
      blockers: blockers,
      actions: actions,
      ready: !blockers.length,
      positionText: positionText
    };
  }

  function focusShiftFromTripPanel(details) {
    closeOpsSheet();
    if (details && details.hasShift && typeof openShiftsForDate === 'function') {
      openShiftsForDate(String(details.shift.start_msk || '').substring(0, 10), details.shift.id || '');
      return;
    }
    if (typeof setActiveTab === 'function') setActiveTab('add');
  }

  function renderUserTripSection(parent) {
    var state = getUserTripReadiness();
    var details = state.details;
    var activeRun = state.activeRun;
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section poekhali-user-ready';
    if (activeRun || state.ready) section.classList.add('is-ready');
    else section.classList.add(details.hasShift ? 'is-waiting' : 'is-blocked');

    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = activeRun ? 'Поездка идет' : state.ready ? 'Можно ехать' : 'Подготовка';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = activeRun ? getRunStatusText(activeRun.status) : state.ready ? 'готово' : state.blockers[0] || 'проверка';
    head.appendChild(title);
    head.appendChild(total);

    var headline = document.createElement('div');
    headline.className = 'poekhali-ready-headline';
    headline.textContent = activeRun
      ? ((activeRun.trainNumber ? 'Поезд № ' + activeRun.trainNumber : 'Поезд') + ' записывается в смену')
      : state.ready
        ? 'Смена, карта и позиция готовы для записи.'
        : state.blockers.join(' · ');

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Смена', details.hasShift ? (details.trainNumber ? '№ ' + details.trainNumber : 'выбрана') : 'нет', details.hasShift ? 'success' : 'danger'));
    grid.appendChild(createShiftInfoCell('Состав', details.hasShift ? formatPoekhaliCompositionLength(details) : '—', details.compositionReadiness === 'ready' ? 'success' : details.compositionReadiness === 'blocked' ? 'danger' : 'warning'));
    grid.appendChild(createShiftInfoCell('Маршрут', state.routeSuggestion.status === 'ready' ? state.routeSuggestion.directionLabel : (details.route || '—'), state.routeSuggestion.status === 'ready' ? 'success' : 'warning'));
    grid.appendChild(createShiftInfoCell('Позиция', state.positionText, state.liveProjection ? 'success' : state.previewProjection || state.routeSuggestion.status === 'ready' ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('Карта', tracker.currentMap && tracker.currentMap.title ? tracker.currentMap.title : '—', tracker.assetsLoaded ? 'success' : 'warning'));
    grid.appendChild(createShiftInfoCell('ПР', String(getCurrentWarnings().length), getCurrentWarnings().length ? 'warning' : 'muted'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (activeRun || state.ready ? 'is-success' : details.hasShift ? 'is-warning' : 'is-danger');
    note.textContent = activeRun
      ? 'Режим пишет пробег, скорость, ограничения, оповещения и GPS-слой в эту смену.'
      : state.ready
        ? 'Нажмите старт, когда готовы записывать поездку. Без живого GPS режим начнет от маршрута смены и переключится на GPS автоматически.'
        : 'Заполните недостающие данные. Режим не подставляет выдуманный поезд и не запускает пустую запись.';

    var actions = document.createElement('div');
    actions.className = 'poekhali-warning-form-actions poekhali-trip-actions';

    var primary = document.createElement('button');
    primary.type = 'button';
    primary.className = activeRun || state.ready ? 'poekhali-primary-action' : 'poekhali-secondary-action';
    primary.textContent = activeRun ? 'Завершить поездку' : state.ready ? 'Начать запись' : details.hasShift ? 'Включить GPS' : 'Открыть смену';
    primary.addEventListener('click', function() {
      if (activeRun) {
        finishActiveRun();
        return;
      }
      if (state.ready) {
        setTimerRunning(true);
        return;
      }
      if (!details.hasShift) {
        focusShiftFromTripPanel(details);
        return;
      }
      startWatchingGps();
    });
    actions.appendChild(primary);

    if (!state.liveProjection && state.routeSuggestion.status === 'ready') {
      var routeBtn = document.createElement('button');
      routeBtn.type = 'button';
      routeBtn.className = 'poekhali-secondary-action';
      routeBtn.textContent = 'Открыть маршрут';
      routeBtn.addEventListener('click', function() {
        applyShiftRouteSuggestion(state.routeSuggestion);
        closeOpsSheet();
      });
      actions.appendChild(routeBtn);
    } else {
      var warnBtn = document.createElement('button');
      warnBtn.type = 'button';
      warnBtn.className = 'poekhali-secondary-action';
      warnBtn.textContent = 'Предупреждения';
      warnBtn.addEventListener('click', function() {
        setOpsView('warnings');
      });
      actions.appendChild(warnBtn);
    }

    section.appendChild(head);
    section.appendChild(headline);
    section.appendChild(grid);
    section.appendChild(note);
    section.appendChild(actions);
    parent.appendChild(section);
  }

  function renderUserTripHistorySection(parent) {
    var visibleRuns = normalizeRunsList(tracker.runs).filter(function(item) {
      return item && !item.deletedAt;
    });
    var activeRun = getActiveRun();
    var run = activeRun || visibleRuns[0] || null;
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Итоги поездки';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = activeRun ? 'сейчас' : visibleRuns.length ? visibleRuns.length + ' зап.' : 'пусто';
    head.appendChild(title);
    head.appendChild(total);
    section.appendChild(head);

    if (!run) {
      var empty = document.createElement('div');
      empty.className = 'poekhali-shift-route is-muted';
      empty.textContent = 'После первой записи здесь будут пробег, скорость, ограничения и цель впереди.';
      section.appendChild(empty);
      parent.appendChild(section);
      return;
    }

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Время', formatTimer(run.status === 'active' ? getTimerElapsed() : run.durationMs)));
    grid.appendChild(createShiftInfoCell('Пробег', formatRunDistance(run.distanceMeters), run.distanceMeters ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Техскорость', formatRunSpeedKmh(run.technicalSpeedKmh), run.technicalSpeedKmh ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Макс.', run.maxSpeedKmh ? run.maxSpeedKmh + ' км/ч' : '—', run.maxSpeedKmh ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Цель', formatRunNavigationTarget(run, true), run.nextTargetLabel ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('Оповещения', run.alertCount ? String(run.alertCount) : '0', run.alertCount ? 'danger' : 'muted'));
    section.appendChild(grid);

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (activeRun ? 'is-success' : 'is-muted');
    note.textContent = (run.trainNumber ? 'Поезд № ' + run.trainNumber : 'Поезд') +
      (run.route ? ' · ' + run.route : '') +
      ' · ' + formatRunDateTime(run.startedAt);
    section.appendChild(note);
    parent.appendChild(section);
  }

  function renderUserMapSection(parent) {
    ensureDownloadedMapsReadiness();
    var mapSummary = getMapReadinessSummary();
    var learning = getLearningSummary();
    var issueCount = (mapSummary.review || 0) + (mapSummary.blocked || 0) + (learning.changedSectors || 0) + (learning.offTrack || 0);
    var needsReview = issueCount > 0;
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section poekhali-user-map';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Карта маршрута';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = !mapSummary.loaded ? 'загрузка' : needsReview ? 'нужно сверить' : 'готово';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Карта', mapSummary.title || '—', mapSummary.loaded ? 'success' : 'warning'));
    grid.appendChild(createShiftInfoCell('Покрытие', mapSummary.sectors ? mapSummary.ready + '/' + mapSummary.sectors : '—', mapSummary.sectors && !mapSummary.blocked ? 'success' : 'warning'));
    grid.appendChild(createShiftInfoCell('Сверка', needsReview ? issueCount + ' мест' : 'ОК', needsReview ? 'warning' : 'success'));
    if (learning.userSections || learning.totalSamples) {
      grid.appendChild(createShiftInfoCell('Свои участки', learning.userSections ? String(learning.userSections) : 'идет запись', learning.userSections ? 'success' : 'muted'));
    }

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (needsReview ? 'is-warning' : learning.totalSamples ? 'is-success' : 'is-muted');
    note.textContent = needsReview
      ? 'Есть места, которые лучше проверить после поездки. Рабочий режим все равно покажет профиль и ограничения.'
      : 'Во время движения приложение сверяет карту с фактическим путем и сохраняет отличия для будущей поездки.';

    var actions = document.createElement('div');
    actions.className = 'poekhali-warning-form-actions poekhali-trip-actions';
    var pickerBtn = document.createElement('button');
    pickerBtn.type = 'button';
    pickerBtn.className = 'poekhali-secondary-action';
    pickerBtn.textContent = 'Сменить карту';
    pickerBtn.addEventListener('click', function() {
      closeOpsSheet();
      openMapPicker();
    });
    actions.appendChild(pickerBtn);

    var refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'poekhali-secondary-action';
    refreshBtn.textContent = tracker.mapsReadinessChecking ? 'Проверяю...' : 'Проверить карту';
    refreshBtn.disabled = !!tracker.mapsReadinessChecking;
    refreshBtn.addEventListener('click', function() {
      refreshDownloadedMapsReadiness(true);
      renderOpsSheet();
    });
    actions.appendChild(refreshBtn);

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);
    section.appendChild(actions);

    if (tracker.rawDrafts && tracker.rawDrafts.length) {
      var draft = tracker.rawDrafts[0];
      var draftRow = document.createElement('div');
      draftRow.className = 'poekhali-map-health-row is-blocked';
      var draftText = document.createElement('span');
      draftText.className = 'poekhali-map-health-text';
      var draftTitle = document.createElement('strong');
      draftTitle.textContent = 'Найден новый участок';
      var draftMeta = document.createElement('span');
      draftMeta.textContent = draft.title + ' · ' + formatDistanceLabel(draft.lengthMeters);
      draftText.appendChild(draftTitle);
      draftText.appendChild(draftMeta);
      var draftBadge = document.createElement('span');
      draftBadge.className = 'poekhali-map-health-badge';
      draftBadge.textContent = 'по поездке';
      draftRow.appendChild(draftText);
      draftRow.appendChild(draftBadge);
      section.appendChild(draftRow);

      var draftActions = document.createElement('div');
      draftActions.className = 'poekhali-warning-form-actions poekhali-trip-actions';
      var openDraftBtn = document.createElement('button');
      openDraftBtn.type = 'button';
      openDraftBtn.className = 'poekhali-secondary-action';
      openDraftBtn.textContent = 'Посмотреть';
      openDraftBtn.addEventListener('click', function() {
        focusRawLearningDraft(draft);
        closeOpsSheet();
      });
      var acceptDraftBtn = document.createElement('button');
      acceptDraftBtn.type = 'button';
      acceptDraftBtn.className = 'poekhali-primary-action';
      acceptDraftBtn.textContent = 'Добавить на карту';
      acceptDraftBtn.addEventListener('click', function() {
        promoteRawLearningDraft(draft);
      });
      draftActions.appendChild(openDraftBtn);
      draftActions.appendChild(acceptDraftBtn);
      section.appendChild(draftActions);
    }

    var currentSector = getCurrentDisplaySector();
    var currentUserSection = isRealNumber(currentSector) ? getUserSectionForSector(currentSector) : null;
    if (currentUserSection) {
      var verifyBtn = document.createElement('button');
      verifyBtn.type = 'button';
      verifyBtn.className = getUserSectionVerificationState(currentUserSection) === 'verified' ? 'poekhali-secondary-action' : 'poekhali-primary-action';
      verifyBtn.textContent = getUserSectionVerificationState(currentUserSection) === 'verified' ? 'Снять подтверждение участка' : 'Подтвердить участок';
      verifyBtn.addEventListener('click', function() {
        setUserLearningSectionVerified(currentUserSection, getUserSectionVerificationState(currentUserSection) !== 'verified');
      });
      section.appendChild(verifyBtn);
    }

    parent.appendChild(section);
  }

  function renderShiftLinkSection(parent) {
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Карточка смены';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    var details = getPoekhaliTrainDetails();
    total.textContent = details.hasShift ? getShiftSourceLabel(details.source) : 'нет смены';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Поезд', details.trainNumber ? '№ ' + details.trainNumber : '—', details.trainNumber ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Локомотив', details.loco || '—', details.loco ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Усл. длина', details.conditionalLength ? details.conditionalLength + ' уд.' : '—', details.conditionalLength ? '' : (details.lengthTone || 'muted')));
    grid.appendChild(createShiftInfoCell('Рабочая длина', formatPoekhaliCompositionLength(details), details.lengthTone));
    grid.appendChild(createShiftInfoCell('Источник длины', details.lengthSource || '—', details.lengthTone || (details.lengthSource ? '' : 'muted')));
    grid.appendChild(createShiftInfoCell('Вес', details.weight ? details.weight + ' т' : '—', details.weight ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Оси', details.axles ? details.axles : '—', details.axles ? '' : 'muted'));
    if (details.shift && details.shift.poekhali_user_section_id) {
      grid.appendChild(createShiftInfoCell('GPS участок', details.shift.poekhali_user_section_title || 'записан', details.shift.poekhali_user_section_ready ? 'success' : 'warning'));
      grid.appendChild(createShiftInfoCell('ЭК привязка', details.shift.poekhali_user_section_reference_sector ? 'уч. ' + details.shift.poekhali_user_section_reference_sector : '—', details.shift.poekhali_user_section_reference_sector ? 'success' : 'warning'));
    }
    if (details.shift && getShiftRunNumber(details.shift.poekhali_warning_rules_count) > 0) {
      grid.appendChild(createShiftInfoCell(
        'ПР смены',
        getShiftRunNumber(details.shift.poekhali_warning_rules_active_count) + '/' + getShiftRunNumber(details.shift.poekhali_warning_rules_count),
        getShiftRunNumber(details.shift.poekhali_warning_rules_active_count) ? 'warning' : 'muted'
      ));
    }

    var route = document.createElement('div');
    route.className = 'poekhali-shift-route';
    if (details.compositionReadiness === 'blocked') route.classList.add('is-danger');
    else if (details.compositionReadiness === 'review') route.classList.add('is-warning');
    else if (details.compositionReadiness === 'ready') route.classList.add('is-success');
    route.textContent = details.hasShift
      ? (details.route + '. ' + (details.compositionNote || ''))
      : (details.compositionNote || 'Сначала сохраните смену и заполните блоки «Локомотив» и «Поезд».');

    var actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'poekhali-secondary-action';
    actionBtn.textContent = details.hasShift ? 'Открыть смену' : 'Добавить смену';
    actionBtn.addEventListener('click', function() {
      closeOpsSheet();
      if (details.hasShift && typeof openShiftsForDate === 'function') {
        openShiftsForDate(String(details.shift.start_msk || '').substring(0, 10), details.shift.id || '');
        return;
      }
      if (typeof setActiveTab === 'function') setActiveTab('add');
    });

    var picker = null;
    var shiftOptions = getPoekhaliCandidateShifts().slice(0, 20);
    if (shiftOptions.length) {
      picker = document.createElement('div');
      picker.className = 'poekhali-shift-picker';
      var select = document.createElement('select');
      var autoOption = document.createElement('option');
      autoOption.value = '';
      autoOption.textContent = 'Автовыбор смены';
      select.appendChild(autoOption);
      var selectedShiftId = details.shift && details.shift.id ? String(details.shift.id) : getSelectedPoekhaliShiftId();
      shiftOptions.forEach(function(item) {
        var option = document.createElement('option');
        option.value = String(item.id || '');
        option.textContent = formatPoekhaliShiftOption(item);
        if (option.value && option.value === selectedShiftId) option.selected = true;
        select.appendChild(option);
      });
      picker.appendChild(createField('Смена для Поехали', select));

      var pickerActions = document.createElement('div');
      pickerActions.className = 'poekhali-warning-form-actions';
      var bindShiftBtn = document.createElement('button');
      bindShiftBtn.type = 'button';
      bindShiftBtn.className = 'poekhali-primary-action';
      bindShiftBtn.textContent = getActiveRun() ? 'Перепривязать запись' : 'Использовать смену';
      bindShiftBtn.addEventListener('click', function() {
        if (select.value) {
          selectPoekhaliShift(select.value);
        } else {
          setSelectedPoekhaliShiftId('');
          tracker.routeMapCandidate = null;
          maybeAutoSelectMapForShiftRoute({ applyPreview: true });
          renderOpsSheet();
          setOpsButton();
          requestDraw();
        }
      });
      pickerActions.appendChild(bindShiftBtn);
      if (getSelectedPoekhaliShiftId()) {
        var resetShiftBtn = document.createElement('button');
        resetShiftBtn.type = 'button';
        resetShiftBtn.className = 'poekhali-secondary-action';
        resetShiftBtn.textContent = 'Снять ручной выбор';
        resetShiftBtn.addEventListener('click', function() {
          setSelectedPoekhaliShiftId('');
          tracker.routeMapCandidate = null;
          maybeAutoSelectMapForShiftRoute({ applyPreview: true });
          renderOpsSheet();
          setOpsButton();
          requestDraw();
        });
        pickerActions.appendChild(resetShiftBtn);
      }
      picker.appendChild(pickerActions);
    }

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(route);
    if (picker) section.appendChild(picker);
    section.appendChild(actionBtn);
    parent.appendChild(section);
  }

  function renderRouteSuggestionSection(parent) {
    var suggestion = getShiftRouteSuggestion();
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Маршрут смены';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = suggestion.status === 'ready'
      ? 'найден в ЭК'
      : tracker.routeMapSelecting
        ? 'ищет ЭК'
        : suggestion.status === 'unmatched' && suggestion.routeMapCandidate && suggestion.routeMapCandidate.status === 'ready'
          ? 'есть другая ЭК'
          : suggestion.status === 'loading'
            ? 'загрузка'
            : 'не привязан';
    head.appendChild(title);
    head.appendChild(total);
    section.appendChild(head);

    if (suggestion.status === 'ready') {
      var currentProgress = resolveRouteProgressForProjection(getCurrentProjectionForForm(), suggestion);
      var grid = document.createElement('div');
      grid.className = 'poekhali-shift-info-grid';
      grid.appendChild(createShiftInfoCell('Откуда', suggestion.fromStation.name || suggestion.fromText));
      grid.appendChild(createShiftInfoCell('Куда', suggestion.toStation.name || suggestion.toText));
      grid.appendChild(createShiftInfoCell('Направление', suggestion.directionLabel, 'success'));
      grid.appendChild(createShiftInfoCell('Путь', suggestion.trackSourceLabel || suggestion.trackLabel || getCurrentTrackLabel(), suggestion.wayNumber ? 'success' : 'muted'));
      grid.appendChild(createShiftInfoCell('Участок', String(suggestion.sector)));
      grid.appendChild(createShiftInfoCell('Старт', formatLineCoordinate(suggestion.coordinate)));
      grid.appendChild(createShiftInfoCell('Длина', formatDistanceLabel(suggestion.distance)));
      if (currentProgress) {
        grid.appendChild(createShiftInfoCell('Пройдено', formatDistanceLabel(currentProgress.passedMeters), currentProgress.status === 'route' ? 'success' : 'warning'));
        grid.appendChild(createShiftInfoCell('Осталось', formatDistanceLabel(currentProgress.remainingMeters), currentProgress.remainingMeters ? '' : 'success'));
        grid.appendChild(createShiftInfoCell('Готово', currentProgress.progressPct + '%', currentProgress.status === 'route' ? 'success' : 'warning'));
      }
      section.appendChild(grid);

      var route = document.createElement('div');
      route.className = 'poekhali-shift-route is-success';
      route.textContent = 'По маршруту карточки можно открыть карту сразу на станции отправления и выставить ' +
        suggestion.directionLabel + (suggestion.wayNumber ? ' / ' + suggestion.trackLabel : '') + '.';
      section.appendChild(route);

      var actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'poekhali-primary-action';
      actionBtn.textContent = 'Применить маршрут';
      actionBtn.addEventListener('click', function() {
        applyShiftRouteSuggestion(suggestion);
        closeOpsSheet();
      });
      section.appendChild(actionBtn);
    } else {
      var message = document.createElement('div');
      message.className = 'poekhali-shift-route ' + (suggestion.status === 'unmatched' ? 'is-danger' : 'is-muted');
      message.textContent = suggestion.message || 'Маршрут смены не удалось связать с текущей картой.';
      section.appendChild(message);
      if (suggestion.fromText || suggestion.toText) {
        var gridFallback = document.createElement('div');
        gridFallback.className = 'poekhali-shift-info-grid';
        gridFallback.appendChild(createShiftInfoCell('Откуда', suggestion.fromText || '—', suggestion.fromMatch ? '' : 'muted'));
        gridFallback.appendChild(createShiftInfoCell('Куда', suggestion.toText || '—', suggestion.toMatch ? '' : 'muted'));
        if (suggestion.fromMatch) gridFallback.appendChild(createShiftInfoCell('Найдено откуда', suggestion.fromMatch.station.name));
        if (suggestion.toMatch) gridFallback.appendChild(createShiftInfoCell('Найдено куда', suggestion.toMatch.station.name));
        if (suggestion.routeMapCandidate && suggestion.routeMapCandidate.status === 'ready') {
          gridFallback.appendChild(createShiftInfoCell('Карта маршрута', formatRouteMapCandidate(suggestion.routeMapCandidate), 'success'));
        }
        section.appendChild(gridFallback);
      }
      if (suggestion.routeMapCandidate && suggestion.routeMapCandidate.status === 'ready' && suggestion.routeMapCandidate.map && !isCurrentMap(suggestion.routeMapCandidate.map)) {
        var routeMapBtn = document.createElement('button');
        routeMapBtn.type = 'button';
        routeMapBtn.className = 'poekhali-primary-action';
        routeMapBtn.textContent = 'Открыть ЭК маршрута';
        routeMapBtn.addEventListener('click', function() {
          selectMap(suggestion.routeMapCandidate.map, { keepPicker: true }).then(function() {
            applyShiftRouteSuggestion();
            renderOpsSheet();
          });
        });
        section.appendChild(routeMapBtn);
      } else if (!tracker.routeMapSelecting && suggestion.status === 'unmatched' && tracker.availableMaps && tracker.availableMaps.length > 1) {
        var searchRouteMapBtn = document.createElement('button');
        searchRouteMapBtn.type = 'button';
        searchRouteMapBtn.className = 'poekhali-secondary-action';
        searchRouteMapBtn.textContent = 'Проверить другие ЭК';
        searchRouteMapBtn.addEventListener('click', function() {
          maybeAutoSelectMapForShiftRoute({ applyPreview: true });
        });
        section.appendChild(searchRouteMapBtn);
      }
    }
    parent.appendChild(section);
  }

  function renderAutoPositionSection(parent) {
    var liveProjection = tracker.projection && tracker.projection.onTrack ? tracker.projection : null;
    var nearestProjection = tracker.nearestProjection || null;
    var routeSuggestion = getShiftRouteSuggestion();
    var previewProjection = liveProjection ? null : getPreviewProjection();
    var displayProjection = liveProjection || nearestProjection || previewProjection;
    var info = tracker.autoPosition || null;

    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Автоопределение';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = liveProjection
      ? 'GPS ведет'
      : tracker.autoMapSelecting
        ? 'ищет ЭК'
        : tracker.status === 'run-blocked'
        ? 'не готово'
        : tracker.status === 'offtrack'
        ? 'вне карты'
        : routeSuggestion.status === 'ready'
          ? 'маршрут'
          : tracker.status === 'loading'
            ? 'загрузка'
            : 'ждет GPS';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    var mapPickText = tracker.autoMapSelecting
      ? 'поиск'
      : tracker.autoMapCandidate && tracker.autoMapCandidate.map
        ? formatMapDistanceCandidate(tracker.autoMapCandidate)
        : tracker.routeMapSelecting
          ? 'маршрут'
          : tracker.routeMapCandidate && tracker.routeMapCandidate.map
            ? formatRouteMapCandidate(tracker.routeMapCandidate)
            : (tracker.availableMaps && tracker.availableMaps.length > 1 ? tracker.availableMaps.length + ' скач.' : '1 скач.');
    var mapPickTone = (tracker.autoMapCandidate && tracker.autoMapCandidate.onTrack) ||
      (tracker.routeMapCandidate && tracker.routeMapCandidate.status === 'ready') ? 'success' : '';
    grid.appendChild(createShiftInfoCell('Карта', (tracker.currentMap && tracker.currentMap.title) || 'Карта ЭК'));
    grid.appendChild(createShiftInfoCell('Подбор ЭК', mapPickText, mapPickTone));
    grid.appendChild(createShiftInfoCell(
      'Источник',
      liveProjection ? 'GPS' : routeSuggestion.status === 'ready' ? 'маршрут смены' : previewProjection ? 'просмотр' : '—',
      liveProjection ? 'success' : previewProjection ? '' : 'muted'
    ));
    grid.appendChild(createShiftInfoCell(
      'Участок',
      displayProjection && isRealNumber(displayProjection.sector) ? formatSectorShortName(displayProjection.sector) : '—',
      displayProjection && isRealNumber(displayProjection.sector) ? '' : 'muted'
    ));
    grid.appendChild(createShiftInfoCell(
      'Координата',
      displayProjection && isRealNumber(displayProjection.lineCoordinate) ? formatLineCoordinate(displayProjection.lineCoordinate) : '—',
      displayProjection && isRealNumber(displayProjection.lineCoordinate) ? '' : 'muted'
    ));
    grid.appendChild(createShiftInfoCell(
      'До линии',
      nearestProjection && isFinite(nearestProjection.distance) ? formatDistanceLabel(nearestProjection.distance) : (liveProjection ? 'на линии' : '—'),
      liveProjection ? 'success' : tracker.status === 'offtrack' ? 'danger' : 'muted'
    ));
    grid.appendChild(createShiftInfoCell(
      'Точность',
      isFinite(tracker.accuracy) && tracker.accuracy > 0 ? Math.round(tracker.accuracy) + ' м' : '—',
      liveProjection ? 'success' : 'muted'
    ));
    grid.appendChild(createShiftInfoCell('Направление', (tracker.even ? 'ЧЕТ' : 'НЕЧЕТ') + ' · ' + getDirectionSourceLabel(), tracker.directionSource === 'gps' ? 'success' : ''));
    grid.appendChild(createShiftInfoCell('Обновлено', info && info.updatedAt ? formatLearningTime(info.updatedAt) : '—', info && info.updatedAt ? '' : 'muted'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route';
    if (liveProjection) {
      note.classList.add('is-success');
      note.textContent = 'Рабочий участок, км/пк и направление обновляются автоматически по GPS. Ручной выбор нужен только для просмотра без координат.';
    } else if (tracker.autoMapSelecting) {
      note.textContent = 'Сравниваю GPS с линиями всех скачанных карт. Если другая ЭК ближе, режим переключит ее автоматически.';
    } else if (tracker.status === 'offtrack') {
      note.classList.add('is-danger');
      note.textContent = info && info.message
        ? info.message
        : 'GPS есть, но точка дальше допустимого допуска от рабочей линии карты.';
    } else if (tracker.status === 'run-blocked') {
      note.classList.add('is-danger');
      note.textContent = tracker.runStartMessage || (info && info.message) || 'Поездку нельзя начать без смены, GPS или маршрута на карте.';
    } else if (routeSuggestion.status === 'ready') {
      note.textContent = 'Пока нет GPS, режим открывает карту по маршруту карточки смены и готов переключиться на фактическую GPS-позицию.';
    } else if (tracker.routeMapSelecting) {
      note.textContent = 'Проверяю станции маршрута по всем скачанным картам, чтобы до GPS открыть правильную ЭК.';
    } else {
      note.classList.add('is-muted');
      note.textContent = tracker.gpsError || 'После получения координат режим сам выберет участок, км/пк и начнет писать GPS-слой для дообучения карты.';
    }

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);

    if (tracker.status === 'offtrack' && nearestProjection && isRealNumber(nearestProjection.sector) && isRealNumber(nearestProjection.lineCoordinate)) {
      var nearestBtn = document.createElement('button');
      nearestBtn.type = 'button';
      nearestBtn.className = 'poekhali-secondary-action';
      nearestBtn.textContent = 'Открыть ближайший участок';
      nearestBtn.addEventListener('click', function() {
        setPreviewProjection({
          sector: nearestProjection.sector,
          lineCoordinate: nearestProjection.lineCoordinate
        }, true);
        closeOpsSheet();
        requestDraw();
      });
      section.appendChild(nearestBtn);
    } else if (!liveProjection && routeSuggestion.status === 'ready') {
      var routeBtn = document.createElement('button');
      routeBtn.type = 'button';
      routeBtn.className = 'poekhali-secondary-action';
      routeBtn.textContent = 'Применить маршрут смены';
      routeBtn.addEventListener('click', function() {
        applyShiftRouteSuggestion(routeSuggestion);
        closeOpsSheet();
      });
      section.appendChild(routeBtn);
    }

    parent.appendChild(section);
  }

  function formatIsoDateLabel(value) {
    if (!value) return '—';
    var date = new Date(String(value));
    if (!isFinite(date.getTime())) return '—';
    return String(date.getDate()).padStart(2, '0') + '.' +
      String(date.getMonth() + 1).padStart(2, '0') + '.' +
      String(date.getFullYear());
  }

  function createProdAuditItem(id, title, detail, state, options) {
    options = options || {};
    return {
      id: id,
      title: title,
      detail: detail || '',
      state: state === 'ready' || state === 'blocked' ? state : 'review',
      badge: options.badge || '',
      sector: options.sector,
      action: options.action || '',
      manual: !!options.manual,
      scope: options.scope === 'trip' ? 'trip' : 'prod',
      updatedAt: options.updatedAt || 0
    };
  }

  function getProdAuditStateLabel(state) {
    if (state === 'ready') return 'OK';
    if (state === 'blocked') return 'Блок';
    return 'Проверить';
  }

  function getProdAuditManualStateLabel(status) {
    if (status === 'ok') return 'OK';
    if (status === 'problem') return 'Проблема';
    return 'Не проверено';
  }

  function getProdAuditManualState(status) {
    if (status === 'ok') return 'ready';
    if (status === 'problem') return 'blocked';
    return 'review';
  }

  function summarizeProdAuditItems(items) {
    var source = Array.isArray(items) ? items : [];
    var result = {
      state: 'ready',
      ready: 0,
      review: 0,
      blocked: 0,
      total: source.length
    };
    for (var i = 0; i < source.length; i++) {
      if (source[i].state === 'ready') result.ready++;
      else if (source[i].state === 'blocked') result.blocked++;
      else result.review++;
    }
    result.state = result.blocked ? 'blocked' : result.review ? 'review' : 'ready';
    return result;
  }

  function findFirstProdAuditAction(items) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].state !== 'ready' && (isRealNumber(items[i].sector) || items[i].action)) return items[i];
    }
    return null;
  }

  function focusProdAuditItem(item) {
    if (!item) return;
    if (item.manual) {
      cycleProdAuditManualCheck(item.id);
      return;
    }
    if (isRealNumber(item.sector)) {
      selectPreviewSector(item.sector, 'middle');
      closeOpsSheet();
      return;
    }
    if (item.action === 'shift') {
      closeOpsSheet();
      var details = getPoekhaliTrainDetails();
      if (details.hasShift && details.shift && typeof openShiftsForDate === 'function') {
        openShiftsForDate(String(details.shift.start_msk || '').substring(0, 10), details.shift.id || '');
      } else if (typeof setActiveTab === 'function') {
        setActiveTab('add');
      }
      return;
    }
    if (item.action === 'mapPicker') {
      closeOpsSheet();
      openMapPicker();
      return;
    }
    if (item.action === 'route') {
      var suggestion = getShiftRouteSuggestion();
      if (suggestion.status === 'ready') {
        applyShiftRouteSuggestion(suggestion);
        closeOpsSheet();
      }
      return;
    }
    if (item.action === 'refreshMaps') {
      refreshDownloadedMapsReadiness(true);
      renderOpsSheet();
    }
  }

  function getProdAuditSnapshot() {
    ensureDownloadedMapsReadiness();
    var details = getPoekhaliTrainDetails();
    var routeSuggestion = getShiftRouteSuggestion();
    var liveProjection = tracker.projection && tracker.projection.onTrack ? tracker.projection : null;
    var previewProjection = getPreviewProjection();
    var mapSummary = getMapReadinessSummary();
    var downloaded = getDownloadedMapsReadinessSnapshot();
    var catalog = getMapCatalogSnapshot();
    var docsSummary = getSpeedDocsSummary();
    var docsConflicts = getSpeedDocsConflictSummary();
    var docsReview = getSpeedDocsReviewSummary(getSpeedDocsConflictItems());
    var regimeSummary = getRegimeMapsSummary();
    var learningSummary = getLearningSummary();
    var warningState = tracker.warningSync && tracker.warningSync.state;
    var runState = tracker.runSync && tracker.runSync.state;
    var activeRun = getActiveRun();
    var warnings = getScopedWarnings(true);
    var manual = getProdAuditState();
    var items = [];

    var shiftState = !details.hasShift || details.compositionReadiness === 'blocked'
      ? 'blocked'
      : details.compositionReadiness === 'review'
        ? 'review'
        : 'ready';
    items.push(createProdAuditItem(
      'shift',
      'Смена и состав',
      details.hasShift
        ? details.route + ' · ' + formatPoekhaliCompositionLength(details) + ' · ' + (details.compositionNote || 'данные взяты из карточки')
        : 'Нет карточки смены: режим не должен стартовать с выдуманным поездом.',
      shiftState,
      { badge: details.hasShift ? 'Смена' : 'Нет', action: 'shift', scope: 'trip' }
    ));

    var routeState = routeSuggestion.status === 'ready'
      ? 'ready'
      : routeSuggestion.status === 'loading'
        ? 'review'
        : 'blocked';
    items.push(createProdAuditItem(
      'route',
      'Маршрут смены на ЭК',
      routeSuggestion.status === 'ready'
        ? routeSuggestion.fromStation.name + ' — ' + routeSuggestion.toStation.name + ' · уч. ' + routeSuggestion.sector + ' · ' + routeSuggestion.directionLabel
        : (routeSuggestion.message || 'Маршрут смены не привязан к скачанной ЭК.'),
      routeState,
      { badge: routeSuggestion.status === 'ready' ? 'ЭК' : 'Маршрут', sector: routeSuggestion.sector, action: 'route', scope: 'trip' }
    ));

    var gpsState = liveProjection
      ? 'ready'
      : tracker.autoMapSelecting
        ? 'review'
        : previewProjection && routeSuggestion.status === 'ready'
          ? 'review'
          : 'blocked';
    items.push(createProdAuditItem(
      'gps-auto',
      'Автоопределение позиции',
      liveProjection
        ? 'GPS ведет по карте: уч. ' + liveProjection.sector + ' · ' + formatLineCoordinate(liveProjection.lineCoordinate) + '.'
        : tracker.autoMapSelecting
          ? 'Идет подбор ЭК по GPS.'
          : previewProjection
            ? 'Без живого GPS открыт просмотр по маршруту. Для прод-приемки нужна реальная поездка.'
            : 'Нет живой GPS-проекции и нет подготовленного просмотра маршрута.',
      gpsState,
      { badge: liveProjection ? 'GPS' : 'Проверка', sector: (liveProjection || previewProjection || {}).sector, scope: 'trip' }
    ));

    items.push(createProdAuditItem(
      'current-map',
      'Текущая карта',
      mapSummary.loaded && mapSummary.sectors
        ? mapSummary.title + ' · участков ' + mapSummary.sectors + ' · профиль ' + mapSummary.profileReady + '/' + mapSummary.sectors
        : (tracker.assetsError || 'Карта не загружена или в ней нет рабочих участков.'),
      mapSummary.loaded && mapSummary.sectors ? 'ready' : 'blocked',
      { badge: mapSummary.sectors ? String(mapSummary.sectors) : 'Нет', action: 'mapPicker' }
    ));

    var firstMapIssue = mapSummary.issues && mapSummary.issues.length ? mapSummary.issues[0] : null;
    items.push(createProdAuditItem(
      'map-layers',
      'Слои по всем участкам',
      mapSummary.sectors
        ? 'готово ' + mapSummary.ready + '/' + mapSummary.sectors +
          ' · проверить ' + (mapSummary.review + mapSummary.blocked) +
          (firstMapIssue ? ' · первый: уч. ' + firstMapIssue.sector + ' · ' + firstMapIssue.issueText : '')
        : 'Нет участков для проверки профиля, скоростей, станций и светофоров.',
      !mapSummary.sectors || mapSummary.blocked ? 'blocked' : mapSummary.review ? 'review' : 'ready',
      { badge: mapSummary.ready + '/' + mapSummary.sectors, sector: firstMapIssue && firstMapIssue.sector }
    ));

    items.push(createProdAuditItem(
      'downloaded-maps',
      'Пакет скачанных ЭК',
      downloaded.total
        ? 'рабочий слой ЭК+GPS+РК+ДОК · проверено ' + downloaded.checked + '/' + downloaded.total + ' · готово ' + downloaded.ready + ' · блок/сверка ' + (downloaded.blocked + downloaded.review)
        : 'Нет скачанных карт для штатного автоопределения.',
      !downloaded.total || downloaded.blocked
        ? 'blocked'
        : tracker.mapsReadinessChecking || downloaded.checked < downloaded.total || downloaded.review
          ? 'review'
          : 'ready',
      { badge: downloaded.checked + '/' + downloaded.total, action: downloaded.checked < downloaded.total ? 'refreshMaps' : 'mapPicker' }
    ));

    items.push(createProdAuditItem(
      'speed-docs',
      'Актуальные скорости ДОК',
      docsSummary.loaded
        ? 'правил ' + docsSummary.activeRules + ' · участков ' + docsSummary.sectors + ' · конфликтов ЭК/ДОК ' + docsConflicts.conflicts +
          ' · сверено ' + docsReview.verified + '/' + docsReview.total +
          (docsReview.problem ? ' · ошибок ' + docsReview.problem : '')
        : (docsSummary.error || 'Документы скоростей не загружены.'),
      docsSummary.loaded && docsSummary.activeRules
        ? (docsReview.problem ? 'blocked' : docsConflicts.conflicts && docsReview.verified < docsReview.total ? 'review' : 'ready')
        : 'review',
      { badge: docsSummary.loaded ? 'ДОК' : 'Нет' }
    ));

    items.push(createProdAuditItem(
      'regime-maps',
      'Режимные карты',
      regimeSummary.loaded
        ? 'участков ' + regimeSummary.sectors + ' · профиль ' + regimeSummary.profileSegments + ' сегм. · сигналы ' + regimeSummary.signalObjects + ' · метки ' + regimeSummary.controlMarks
        : (regimeSummary.error || 'Режимные карты пока не загружены.'),
      regimeSummary.loaded && regimeSummary.sectors ? 'ready' : 'review',
      { badge: regimeSummary.loaded ? 'РК' : 'Нет' }
    ));

    items.push(createProdAuditItem(
      'warnings',
      'Предупреждения ПР',
      'введено ' + warnings.length + ' · сервер ' + getWarningSyncLabel() + ' · ручной, пакетный и файловый ввод пишутся в смену/карту',
      warningState === 'error' ? 'blocked' : 'ready',
      { badge: 'ПР ' + warnings.length }
    ));

    items.push(createProdAuditItem(
      'runs',
      'Запись поездки в смену',
      (activeRun ? 'активная запись есть' : 'активной записи нет') + ' · журнал ' + tracker.runs.length + ' · сервер ' + getRunSyncLabel(),
      runState === 'error' ? 'blocked' : (activeRun || tracker.runs.length ? 'ready' : 'review'),
      { badge: activeRun ? 'RUN' : String(tracker.runs.length), scope: 'trip' }
    ));

    items.push(createProdAuditItem(
      'learning',
      'Дорисовка карты GPS',
      'точек ' + learningSummary.totalSamples + ' · GPS участков ' + learningSummary.userSections +
        ' · проверено ' + learningSummary.verifiedSectors + ' · вне ЭК ' + learningSummary.offTrack +
        ' · сервер ' + getLearningSyncLabel(),
      tracker.learningSync && tracker.learningSync.state === 'error'
        ? 'blocked'
        : learningSummary.userSections || learningSummary.totalSamples
          ? (learningSummary.changedSectors || learningSummary.offTrack ? 'review' : 'ready')
          : 'review',
      { badge: learningSummary.userSections ? 'GPS уч.' : 'GPS' }
    ));

    items.push(createProdAuditItem(
      'catalog',
      'Источники карт',
      catalog.installed
        ? 'локально установлено ' + catalog.installed + ' · внешний источник отключен · недостающие участки закрываются GPS/РК/ДОК'
        : 'Нет локально установленных карт: режиму нужен хотя бы один рабочий слой ЭК/GPS.',
      catalog.installed ? 'ready' : 'blocked',
      { badge: catalog.installed ? 'Лок.' : 'Нет', action: 'mapPicker' }
    ));

    items.push(createProdAuditItem(
      'canvas',
      'Рабочий canvas и оболочка',
      tracker.canvas && tracker.ctx
        ? 'canvas ' + (tracker.width || tracker.canvas.clientWidth || 0) + 'x' + (tracker.height || tracker.canvas.clientHeight || 0) + ' · нижнее меню включено'
        : 'Canvas режима не найден в DOM.',
      tracker.canvas && tracker.ctx ? 'ready' : 'blocked',
      { badge: tracker.canvas && tracker.ctx ? 'UI' : 'Нет' }
    ));

    PROD_AUDIT_MANUAL_CHECKS.forEach(function(config) {
      var check = manual.checks[config.id] || { status: 'pending', updatedAt: 0 };
      var suffix = check.updatedAt ? ' · ' + formatLearningTime(check.updatedAt) : '';
      items.push(createProdAuditItem(
        config.id,
        config.title,
        config.detail + suffix,
        getProdAuditManualState(check.status),
        {
          badge: getProdAuditManualStateLabel(check.status),
          manual: true,
          updatedAt: check.updatedAt
        }
      ));
    });

    var manualOk = 0;
    PROD_AUDIT_MANUAL_CHECKS.forEach(function(config) {
      var check = manual.checks[config.id];
      if (check && check.status === 'ok') manualOk++;
    });
    var prodItems = items.filter(function(item) {
      return item.scope !== 'trip';
    });
    var tripItems = items.filter(function(item) {
      return item.scope === 'trip';
    });
    var prodSummary = summarizeProdAuditItems(prodItems);
    var tripSummary = summarizeProdAuditItems(tripItems);
    var allSummary = summarizeProdAuditItems(items);

    return {
      state: prodSummary.state,
      prodState: prodSummary.state,
      tripState: tripSummary.state,
      items: items,
      prodItems: prodItems,
      tripItems: tripItems,
      ready: prodSummary.ready,
      review: prodSummary.review,
      blocked: prodSummary.blocked,
      total: prodSummary.total,
      tripReady: tripSummary.ready,
      tripReview: tripSummary.review,
      tripBlocked: tripSummary.blocked,
      tripTotal: tripSummary.total,
      allReady: allSummary.ready,
      allReview: allSummary.review,
      allBlocked: allSummary.blocked,
      allTotal: allSummary.total,
      manualOk: manualOk,
      manualTotal: PROD_AUDIT_MANUAL_CHECKS.length,
      firstAction: findFirstProdAuditAction(prodItems) || findFirstProdAuditAction(tripItems)
    };
  }

  function renderProdAuditSection(parent) {
    var audit = getProdAuditSnapshot();
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Контроль prod';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = audit.ready + '/' + audit.total;
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Готово', audit.ready + '/' + audit.total, audit.state === 'ready' ? 'success' : ''));
    grid.appendChild(createShiftInfoCell('Блокеры', String(audit.blocked), audit.blocked ? 'danger' : 'success'));
    grid.appendChild(createShiftInfoCell('Проверить', String(audit.review), audit.review ? 'warning' : 'success'));
    grid.appendChild(createShiftInfoCell('Поездка', audit.tripReady + '/' + audit.tripTotal, audit.tripBlocked ? 'danger' : audit.tripReview ? 'warning' : 'success'));
    grid.appendChild(createShiftInfoCell('Ручные', audit.manualOk + '/' + audit.manualTotal, audit.manualOk === audit.manualTotal ? 'success' : 'warning'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (audit.state === 'blocked' ? 'is-danger' : audit.state === 'ready' ? 'is-success' : '');
    if (audit.state === 'ready') {
      note.textContent = audit.tripState === 'ready'
        ? 'Автопроверки, приемка режима и текущая поездка закрыты.'
        : 'Функционал режима проходит prod-контроль; блокеры текущей поездки показаны отдельно ниже и не считаются недоделкой режима.';
    } else if (audit.blocked) {
      note.textContent = 'Есть production-блокеры режима. Первый блокер можно открыть кнопкой ниже; ручные проверки переключаются нажатием по строке.';
    } else {
      note.textContent = 'Критичных production-блокеров нет, но остались приемочные проверки: ширины экрана, реальный GPS, сверка с APK и визуальные наложения.';
    }

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);

    if (audit.firstAction) {
      var actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = audit.firstAction.state === 'blocked' ? 'poekhali-primary-action' : 'poekhali-secondary-action';
      actionBtn.textContent = audit.firstAction.manual ? 'Отметить проверку' : 'Открыть первый пункт';
      actionBtn.addEventListener('click', function() {
        focusProdAuditItem(audit.firstAction);
      });
      section.appendChild(actionBtn);
    }

    var list = document.createElement('div');
    list.className = 'poekhali-map-health-list';
    var visible = audit.prodItems.filter(function(item) {
      return item.state !== 'ready';
    }).slice(0, 12);
    if (!visible.length) {
      var ok = document.createElement('div');
      ok.className = 'poekhali-map-health-row is-ready';
      var okText = document.createElement('div');
      okText.className = 'poekhali-map-health-text';
      var okTitle = document.createElement('strong');
      okTitle.textContent = 'Все пункты закрыты';
      var okMeta = document.createElement('span');
      okMeta.textContent = 'Автопроверки и приемка режима Поехали отмечены как готовые.';
      okText.appendChild(okTitle);
      okText.appendChild(okMeta);
      var okBadge = document.createElement('span');
      okBadge.className = 'poekhali-map-health-badge';
      okBadge.textContent = 'OK';
      ok.appendChild(okText);
      ok.appendChild(okBadge);
      list.appendChild(ok);
    }
    for (var i = 0; i < visible.length; i++) {
      (function(item) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'poekhali-map-health-row is-' + item.state;
        row.title = item.manual
          ? 'Нажатие переключает: не проверено -> OK -> проблема'
          : 'Открыть связанный пункт';
        row.addEventListener('click', function() {
          focusProdAuditItem(item);
        });

        var text = document.createElement('span');
        text.className = 'poekhali-map-health-text';
        var strong = document.createElement('strong');
        strong.textContent = item.title;
        var meta = document.createElement('span');
        meta.textContent = item.detail;
        text.appendChild(strong);
        text.appendChild(meta);

        var badge = document.createElement('span');
        badge.className = 'poekhali-map-health-badge';
        badge.textContent = item.badge || getProdAuditStateLabel(item.state);

        row.appendChild(text);
        row.appendChild(badge);
        list.appendChild(row);
      })(visible[i]);
    }
    if (audit.prodItems.filter(function(item) { return item.state !== 'ready'; }).length > visible.length) {
      var more = document.createElement('div');
      more.className = 'poekhali-map-health-more';
      more.textContent = 'Еще ' + (audit.prodItems.filter(function(item) { return item.state !== 'ready'; }).length - visible.length) + ' production-пунктов в проверке';
      list.appendChild(more);
    }
    section.appendChild(list);

    if (audit.tripItems.length) {
      var tripNote = document.createElement('div');
      tripNote.className = 'poekhali-shift-route ' + (audit.tripState === 'blocked' ? 'is-danger' : audit.tripState === 'ready' ? 'is-success' : '');
      tripNote.textContent = audit.tripState === 'ready'
        ? 'Текущая поездка готова к запуску: смена, маршрут, GPS/preview и запись согласованы.'
        : 'Готовность текущей поездки: это эксплуатационные условия запуска, а не общий статус готовности режима.';
      section.appendChild(tripNote);

      var tripList = document.createElement('div');
      tripList.className = 'poekhali-map-health-list';
      for (var t = 0; t < audit.tripItems.length; t++) {
        (function(item) {
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'poekhali-map-health-row is-' + item.state;
          row.title = 'Открыть связанный пункт текущей поездки';
          row.addEventListener('click', function() {
            focusProdAuditItem(item);
          });

          var text = document.createElement('span');
          text.className = 'poekhali-map-health-text';
          var strong = document.createElement('strong');
          strong.textContent = item.title;
          var meta = document.createElement('span');
          meta.textContent = item.detail;
          text.appendChild(strong);
          text.appendChild(meta);

          var badge = document.createElement('span');
          badge.className = 'poekhali-map-health-badge';
          badge.textContent = item.badge || getProdAuditStateLabel(item.state);

          row.appendChild(text);
          row.appendChild(badge);
          tripList.appendChild(row);
        })(audit.tripItems[t]);
      }
      section.appendChild(tripList);
    }
    parent.appendChild(section);
  }

  function getPoekhaliDiagnosticsSnapshot() {
    var mapSummary = getMapReadinessSummary();
    var mapsSnapshot = getDownloadedMapsReadinessSnapshot();
    var speedDocsSummary = getSpeedDocsSummary();
    var regimeSummary = getRegimeMapsSummary();
    var learningSummary = getLearningSummary();
    var activeRun = getActiveRun();
    var lastRun = activeRun || normalizeRunsList(tracker.runs).filter(function(item) {
      return item && !item.deletedAt;
    })[0] || null;
    var swState = typeof navigator !== 'undefined' && navigator.serviceWorker
      ? (navigator.serviceWorker.controller ? 'активен' : 'ожидает')
      : 'нет';
    var cacheState = typeof window !== 'undefined' && window.caches ? 'доступен' : 'нет';
    var lastGpsAt = tracker.lastUpdatedAt ? formatLearningTime(tracker.lastUpdatedAt) : '—';
    var lastLearningAt = learningSummary.lastSample && learningSummary.lastSample.ts
      ? formatLearningTime(learningSummary.lastSample.ts)
      : '—';
    var lastRunAt = lastRun && (lastRun.updatedAt || lastRun.startedAt)
      ? formatRunDateTime(lastRun.updatedAt || lastRun.startedAt)
      : '—';
    return {
      appVersion: POEKHALI_DIAGNOSTIC_VERSION,
      mapTitle: tracker.currentMap && tracker.currentMap.title ? tracker.currentMap.title : '—',
      mapId: tracker.currentMap && tracker.currentMap.id ? tracker.currentMap.id : '—',
      manifest: tracker.mapManifestGeneratedAt ? formatIsoDateLabel(tracker.mapManifestGeneratedAt) : '—',
      assets: tracker.assetsLoaded ? 'загружены' : tracker.assetsError ? 'ошибка' : 'загрузка',
      assetsTone: tracker.assetsLoaded ? 'success' : tracker.assetsError ? 'danger' : 'muted',
      mapReady: mapSummary.sectors ? (mapSummary.ready + '/' + mapSummary.sectors) : '—',
      mapReadyTone: mapSummary.sectors && !mapSummary.issues.length ? 'success' : mapSummary.issues.length ? 'warning' : 'muted',
      downloadedMaps: mapsSnapshot.checked + '/' + mapsSnapshot.total,
      downloadedMapsTone: mapsSnapshot.total && mapsSnapshot.checked === mapsSnapshot.total && !mapsSnapshot.blocked && !mapsSnapshot.review ? 'success' : mapsSnapshot.blocked || mapsSnapshot.review ? 'warning' : 'muted',
      remoteMaps: REMOTE_MAP_SOURCE_ENABLED
        ? (tracker.remoteMaps && tracker.remoteMaps.length ? String(tracker.remoteMaps.length) : '0')
        : 'отключен',
      gps: tracker.status === 'gps-live' ? 'живой' : tracker.gpsError ? 'ошибка' : tracker.status || '—',
      gpsTone: tracker.status === 'gps-live' ? 'success' : tracker.gpsError ? 'danger' : 'muted',
      gpsAccuracy: isFinite(tracker.accuracy) && tracker.accuracy > 0 ? Math.round(tracker.accuracy) + ' м' : '—',
      lastGpsAt: lastGpsAt,
      coordinate: tracker.projection && tracker.projection.onTrack
        ? ('уч. ' + tracker.projection.sector + ' · ' + formatLineCoordinate(tracker.projection.lineCoordinate))
        : tracker.nearestProjection
          ? ('рядом уч. ' + tracker.nearestProjection.sector)
          : '—',
      docs: speedDocsSummary.loaded ? (speedDocsSummary.activeRules + ' правил') : '—',
      docsTone: speedDocsSummary.loaded ? 'success' : 'warning',
      regime: regimeSummary.loaded ? (regimeSummary.sectors + ' уч.') : '—',
      regimeTone: regimeSummary.loaded ? 'success' : 'warning',
      warningsSync: getWarningSyncLabel(),
      warningsSyncTone: getWarningSyncTone().replace('is-', ''),
      runsSync: getRunSyncLabel(),
      runsSyncTone: getRunSyncTone().replace('is-', ''),
      learningSync: getLearningSyncLabel(),
      learningSyncTone: getLearningSyncTone().replace('is-', ''),
      learning: learningSummary.totalSamples ? (learningSummary.totalSamples + ' точ.') : '—',
      learningTone: learningSummary.totalSamples ? 'success' : 'muted',
      lastLearningAt: lastLearningAt,
      run: lastRun ? getRunStatusText(lastRun.status) : '—',
      runTone: activeRun ? 'success' : lastRun ? '' : 'muted',
      lastRunAt: lastRunAt,
      sw: swState,
      swTone: swState === 'активен' ? 'success' : 'warning',
      cache: cacheState,
      cacheTone: cacheState === 'доступен' ? 'success' : 'warning',
      blocker: tracker.assetsError || tracker.gpsError || ''
    };
  }

  function renderDiagnosticsSection(parent) {
    var diagnostics = getPoekhaliDiagnosticsSnapshot();
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Диагностика';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = diagnostics.appVersion;
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid poekhali-diagnostics-grid';
    grid.appendChild(createShiftInfoCell('Карта', diagnostics.mapTitle));
    grid.appendChild(createShiftInfoCell('ID', diagnostics.mapId));
    grid.appendChild(createShiftInfoCell('Manifest', diagnostics.manifest, diagnostics.manifest === '—' ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('Ассеты', diagnostics.assets, diagnostics.assetsTone));
    grid.appendChild(createShiftInfoCell('Готовность', diagnostics.mapReady, diagnostics.mapReadyTone));
    grid.appendChild(createShiftInfoCell('ЭК пакет', diagnostics.downloadedMaps, diagnostics.downloadedMapsTone));
    grid.appendChild(createShiftInfoCell('Каталог', diagnostics.remoteMaps, diagnostics.remoteMaps === '0' || diagnostics.remoteMaps === 'отключен' ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('GPS', diagnostics.gps, diagnostics.gpsTone));
    grid.appendChild(createShiftInfoCell('Точность', diagnostics.gpsAccuracy, diagnostics.gpsAccuracy === '—' ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('GPS время', diagnostics.lastGpsAt, diagnostics.lastGpsAt === '—' ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('Координата', diagnostics.coordinate, diagnostics.coordinate === '—' ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('ДОК', diagnostics.docs, diagnostics.docsTone));
    grid.appendChild(createShiftInfoCell('РК', diagnostics.regime, diagnostics.regimeTone));
    grid.appendChild(createShiftInfoCell('ПР sync', diagnostics.warningsSync, diagnostics.warningsSyncTone));
    grid.appendChild(createShiftInfoCell('Run sync', diagnostics.runsSync, diagnostics.runsSyncTone));
    grid.appendChild(createShiftInfoCell('GPS sync', diagnostics.learningSync, diagnostics.learningSyncTone));
    grid.appendChild(createShiftInfoCell('Дообучение', diagnostics.learning, diagnostics.learningTone));
    grid.appendChild(createShiftInfoCell('Последняя GPS', diagnostics.lastLearningAt, diagnostics.lastLearningAt === '—' ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('Поездка', diagnostics.run, diagnostics.runTone));
    grid.appendChild(createShiftInfoCell('Run время', diagnostics.lastRunAt, diagnostics.lastRunAt === '—' ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('SW', diagnostics.sw, diagnostics.swTone));
    grid.appendChild(createShiftInfoCell('Cache API', diagnostics.cache, diagnostics.cacheTone));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (diagnostics.blocker ? 'is-danger' : 'is-success');
    note.textContent = diagnostics.blocker
      ? 'Диагностика: есть ошибка, которая влияет на режим - ' + diagnostics.blocker
      : 'Диагностика собрана локально: карта, GPS, документы, режимки, поездки, дообучение, service worker и кэш видны в одном блоке.';

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);
    parent.appendChild(section);
  }

  function getLearningBackupCounts(store) {
    var learning = normalizeLearningStore(store || tracker.learning);
    var maps = Object.keys(learning.maps || {});
    var samples = 0;
    var rawSamples = 0;
    var userSections = 0;
    for (var i = 0; i < maps.length; i++) {
      var map = learning.maps[maps[i]] || {};
      var sectors = map.sectors || {};
      Object.keys(sectors).forEach(function(key) {
        var bucket = sectors[key];
        samples += bucket && Array.isArray(bucket.samples) ? bucket.samples.length : 0;
      });
      var rawTracks = map.rawTracks || {};
      Object.keys(rawTracks).forEach(function(key) {
        var raw = rawTracks[key];
        rawSamples += raw && Array.isArray(raw.samples) ? raw.samples.length : 0;
      });
      userSections += Object.keys(map.userSections || {}).length;
    }
    return {
      maps: maps.length,
      samples: samples,
      rawSamples: rawSamples,
      userSections: userSections
    };
  }

  function getPoekhaliBackupStats() {
    var learning = getLearningBackupCounts(tracker.learning);
    return {
      warnings: normalizeWarningsList(tracker.warnings).filter(function(item) { return !item.deletedAt; }).length,
      runs: normalizeRunsList(tracker.runs).filter(function(item) { return !item.deletedAt; }).length,
      learningSamples: learning.samples + learning.rawSamples,
      userSections: learning.userSections
    };
  }

  function cloneForBackup(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function buildPoekhaliBackupPackage() {
    ensureDownloadedMapsReadiness();
    var packageData = {
      schema: 'bloknot.poekhali.backup',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: POEKHALI_DIAGNOSTIC_VERSION,
      exportedAt: new Date().toISOString(),
      currentMap: tracker.currentMap ? {
        id: tracker.currentMap.id || '',
        title: tracker.currentMap.title || '',
        sourceName: tracker.currentMap.sourceName || ''
      } : null,
      selectedShiftId: readStringStorage(SELECTED_SHIFT_STORAGE_KEY),
      lastProjection: readJsonStorage(LAST_PROJECTION_STORAGE_KEY, null),
      previewProjection: readJsonStorage(PREVIEW_PROJECTION_STORAGE_KEY, null),
      diagnostics: getPoekhaliDiagnosticsSnapshot(),
      prodAudit: cloneForBackup(getProdAuditState()),
      speedDocReview: cloneForBackup(getSpeedDocReviewState()),
      warnings: normalizeWarningsList(tracker.warnings),
      runs: normalizeRunsList(tracker.runs),
      learning: normalizeLearningStore(tracker.learning),
      mapReadiness: cloneForBackup(getMapReadinessSummary()),
      downloadedMaps: cloneForBackup(getDownloadedMapsReadinessSnapshot()),
      catalog: cloneForBackup(getMapCatalogSnapshot())
    };
    packageData.stats = {
      warnings: packageData.warnings.filter(function(item) { return !item.deletedAt; }).length,
      runs: packageData.runs.filter(function(item) { return !item.deletedAt; }).length,
      learning: getLearningBackupCounts(packageData.learning),
      userSections: getLearningBackupCounts(packageData.learning).userSections
    };
    return packageData;
  }

  function getPoekhaliBackupFileName() {
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return 'poekhali-diagnostic-' + stamp + '.json';
  }

  function downloadJsonFile(fileName, payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportPoekhaliBackupPackage() {
    var payload = buildPoekhaliBackupPackage();
    downloadJsonFile(getPoekhaliBackupFileName(), payload);
    var stats = getPoekhaliBackupStats();
    tracker.backupMessage = 'Пакет собран: ПР ' + stats.warnings + ' · поездок ' + stats.runs + ' · GPS точек ' + stats.learningSamples + ' · GPS участков ' + stats.userSections + '.';
    tracker.backupMessageTone = 'success';
    renderOpsSheet();
  }

  function mergeProdAuditStates(baseRaw, incomingRaw) {
    var base = normalizeProdAuditState(baseRaw);
    var incoming = normalizeProdAuditState(incomingRaw);
    PROD_AUDIT_MANUAL_CHECKS.forEach(function(config) {
      var key = config.id;
      var baseItem = base.checks[key] || { status: 'pending', updatedAt: 0 };
      var incomingItem = incoming.checks[key] || { status: 'pending', updatedAt: 0 };
      if ((incomingItem.updatedAt || 0) >= (baseItem.updatedAt || 0) && incomingItem.status !== 'pending') {
        base.checks[key] = incomingItem;
      }
    });
    base.updatedAt = Math.max(Number(base.updatedAt) || 0, Number(incoming.updatedAt) || 0);
    return normalizeProdAuditState(base);
  }

  function mergeSpeedDocReviewStates(baseRaw, incomingRaw) {
    var base = normalizeSpeedDocReviewState(baseRaw);
    var incoming = normalizeSpeedDocReviewState(incomingRaw);
    Object.keys(incoming.items || {}).forEach(function(key) {
      var current = base.items[key];
      var next = incoming.items[key];
      if (!current || (next.updatedAt || 0) >= (current.updatedAt || 0)) {
        base.items[key] = next;
      }
    });
    base.updatedAt = Math.max(Number(base.updatedAt) || 0, Number(incoming.updatedAt) || 0);
    return normalizeSpeedDocReviewState(base);
  }

  function normalizePoekhaliBackupPayload(raw) {
    var payload = raw && typeof raw === 'object' ? raw : {};
    if (payload.poekhali && typeof payload.poekhali === 'object') payload = payload.poekhali;
    if (payload.data && payload.data.schema === 'bloknot.poekhali.backup') payload = payload.data;
    if (payload.schema && payload.schema !== 'bloknot.poekhali.backup') return null;
    return payload;
  }

  function applyPoekhaliBackupPackage(raw) {
    var payload = normalizePoekhaliBackupPayload(raw);
    if (!payload) throw new Error('Это не пакет Поехали.');
    var importedWarnings = normalizeWarningsList(payload.warnings);
    var importedRuns = normalizeRunsList(payload.runs);
    var importedLearning = normalizeLearningStore(payload.learning);
    var learningCounts = getLearningBackupCounts(importedLearning);

    if (importedWarnings.length) {
      tracker.warnings = mergeWarningsLists(tracker.warnings, importedWarnings);
      saveWarnings();
    }
    if (importedRuns.length) {
      tracker.runs = mergeRunsLists(tracker.runs, importedRuns);
      restoreTimerFromActiveRun();
      saveRuns();
    }
    if (learningCounts.samples || learningCounts.rawSamples || learningCounts.userSections) {
      tracker.learning = mergeLearningStores(tracker.learning, importedLearning);
      saveLearningStore();
      renderAfterLearningSyncChange();
    }
    if (payload.prodAudit) {
      tracker.prodAudit = mergeProdAuditStates(getProdAuditState(), payload.prodAudit);
      saveProdAuditState();
    }
    if (payload.speedDocReview) {
      tracker.speedDocReview = mergeSpeedDocReviewStates(getSpeedDocReviewState(), payload.speedDocReview);
      saveSpeedDocReviewState();
    }

    tracker.backupMessage = 'Импортировано: ПР ' + importedWarnings.length + ' · поездок ' + importedRuns.length +
      ' · GPS точек ' + (learningCounts.samples + learningCounts.rawSamples) + ' · GPS участков ' + learningCounts.userSections + '.';
    tracker.backupMessageTone = 'success';
    renderOpsSheet();
    requestDraw();
  }

  function readTextFile(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(String(reader.result || '')); };
      reader.onerror = function() { reject(reader.error || new Error('Файл не прочитан')); };
      reader.readAsText(file);
    });
  }

  function importPoekhaliBackupFile(file) {
    if (!file) return;
    readTextFile(file).then(function(text) {
      var parsed = JSON.parse(text);
      applyPoekhaliBackupPackage(parsed);
    }).catch(function(error) {
      tracker.backupMessage = 'Импорт не выполнен: ' + (error && error.message ? error.message : 'ошибка файла');
      tracker.backupMessageTone = 'danger';
      renderOpsSheet();
    });
  }

  function renderBackupSection(parent) {
    var stats = getPoekhaliBackupStats();
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Резерв и диагностика';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = 'JSON';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('ПР', String(stats.warnings), stats.warnings ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Поездки', String(stats.runs), stats.runs ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('GPS точки', String(stats.learningSamples), stats.learningSamples ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('GPS участки', String(stats.userSections), stats.userSections ? 'success' : 'muted'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (tracker.backupMessageTone ? 'is-' + tracker.backupMessageTone : 'is-muted');
    note.textContent = tracker.backupMessage || 'Пакет сохраняет поездки, предупреждения, GPS-дообучение, ручную приемку, сверку ДОК и диагностику режима. Внешний источник карт не нужен.';

    var actions = document.createElement('div');
    actions.className = 'poekhali-warning-form-actions poekhali-backup-actions';

    var exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'poekhali-primary-action';
    exportBtn.textContent = 'Скачать пакет';
    exportBtn.addEventListener('click', exportPoekhaliBackupPackage);

    var importFileInput = document.createElement('input');
    importFileInput.type = 'file';
    importFileInput.accept = '.json,application/json';
    importFileInput.className = 'poekhali-warning-file-input';
    importFileInput.addEventListener('change', function() {
      var file = importFileInput.files && importFileInput.files[0] ? importFileInput.files[0] : null;
      importFileInput.value = '';
      importPoekhaliBackupFile(file);
    });

    var importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'poekhali-secondary-action';
    importBtn.textContent = 'Импорт пакета';
    importBtn.addEventListener('click', function() {
      importFileInput.click();
    });

    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);
    actions.appendChild(importFileInput);
    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);
    section.appendChild(actions);
    parent.appendChild(section);
  }

  function renderMapReadinessSection(parent) {
    var summary = getMapReadinessSummary();
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Готовность карты';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = summary.sectors ? ('готово ' + summary.ready + '/' + summary.sectors) : 'нет участков';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Карта', summary.title));
    grid.appendChild(createShiftInfoCell('Участки', summary.sectors ? String(summary.sectors) : '0', summary.sectors ? '' : 'danger'));
    grid.appendChild(createShiftInfoCell('Профиль', summary.profileReady + '/' + summary.sectors +
      (summary.learnedProfiles ? ' · GPS ' + summary.learnedProfiles : '') +
      (summary.regimeProfiles ? ' · РК ' + summary.regimeProfiles : '') +
      (summary.fallbackProfiles ? ' · общ. ' + summary.fallbackProfiles : ''),
      summary.profileReady === summary.sectors && !summary.fallbackProfiles ? '' : 'danger'));
    grid.appendChild(createShiftInfoCell('Скорости', summary.speedReady + '/' + summary.sectors, summary.speedReady === summary.sectors ? '' : 'danger'));
    grid.appendChild(createShiftInfoCell('Объекты', summary.objectReady + '/' + summary.sectors, summary.objectReady === summary.sectors ? '' : 'danger'));
    grid.appendChild(createShiftInfoCell('GPS проверено', summary.gpsVerifiedSectors ? summary.gpsVerifiedSectors + ' уч.' : '—', summary.gpsVerifiedSectors ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('GPS изменено', summary.gpsChangedSectors ? summary.gpsChangedSectors + ' уч.' : '—', summary.gpsChangedSectors ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('GPS/ЭК', summary.gpsConflictSectors ? summary.gpsConflictSectors + ' уч.' : '—', summary.gpsConflictSectors ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('Обновлено', formatIsoDateLabel(summary.generatedAt), summary.generatedAt ? '' : 'muted'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (summary.blocked ? 'is-danger' : summary.review ? '' : 'is-success');
    if (!summary.loaded) {
      note.className = 'poekhali-shift-route is-muted';
      note.textContent = tracker.assetsError || 'Карта еще загружается.';
    } else if (!summary.sectors) {
      note.className = 'poekhali-shift-route is-danger';
      note.textContent = 'В карте нет рабочих участков для режима Поехали.';
    } else if (summary.issues.length) {
      note.textContent = 'Проблемные участки показаны ниже: профиль, скорости, станции, светофоры и GPS-расхождения проверяются отдельно, чтобы не выдавать черновик за готовую карту.';
    } else {
      note.textContent = 'Все участки текущей карты имеют линию, профиль, скорости и объекты для рабочего режима.';
    }

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);

    if (summary.issues.length) {
      var actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'poekhali-secondary-action';
      actionBtn.textContent = 'Открыть первый проблемный';
      actionBtn.addEventListener('click', function() {
        selectPreviewSector(summary.issues[0].sector, 'middle');
        closeOpsSheet();
      });
      section.appendChild(actionBtn);

      var list = document.createElement('div');
      list.className = 'poekhali-map-health-list';
      var visible = summary.issues.slice(0, 8);
      for (var i = 0; i < visible.length; i++) {
        (function(item) {
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'poekhali-map-health-row is-' + item.state;
          row.title = 'Открыть участок ' + item.sector + ' на профиле';
          row.addEventListener('click', function() {
            selectPreviewSector(item.sector, 'middle');
            closeOpsSheet();
          });

          var text = document.createElement('span');
          text.className = 'poekhali-map-health-text';
          var strong = document.createElement('strong');
          strong.textContent = 'Участок ' + item.sector + ' · ' + item.range;
          var meta = document.createElement('span');
          meta.textContent = item.issueText;
          text.appendChild(strong);
          text.appendChild(meta);

          var badge = document.createElement('span');
          badge.className = 'poekhali-map-health-badge';
          badge.textContent = item.learning && item.learning.verificationState === 'changed'
            ? 'GPS изм.'
            : item.learning && item.learning.verificationState !== 'verified' && (item.learning.nearTrack || item.learning.offTrack)
            ? 'GPS/ЭК'
            : getProfileSourceLabel(item.profileStatus);

          row.appendChild(text);
          row.appendChild(badge);
          list.appendChild(row);
        })(visible[i]);
      }
      if (summary.issues.length > visible.length) {
        var more = document.createElement('div');
        more.className = 'poekhali-map-health-more';
        more.textContent = 'Еще ' + (summary.issues.length - visible.length) + ' участков требуют проверки';
        list.appendChild(more);
      }
      section.appendChild(list);
    }

    parent.appendChild(section);
  }

  function renderDownloadedMapsReadinessSection(parent) {
    ensureDownloadedMapsReadiness();
    var snapshot = getDownloadedMapsReadinessSnapshot();
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Скачанные ЭК';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = tracker.mapsReadinessChecking
      ? 'проверка'
      : snapshot.total
        ? ('проверено ' + snapshot.checked + '/' + snapshot.total)
        : 'нет карт';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Скачано', String(snapshot.total), snapshot.total ? '' : 'danger'));
    grid.appendChild(createShiftInfoCell('Проверено', snapshot.checked + '/' + snapshot.total, snapshot.checked === snapshot.total && snapshot.total ? 'success' : ''));
    grid.appendChild(createShiftInfoCell('Готово', String(snapshot.ready), snapshot.ready ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Проверить', String(snapshot.review + snapshot.blocked), snapshot.review + snapshot.blocked ? 'danger' : 'success'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route';
    if (!snapshot.total) {
      note.className = 'poekhali-shift-route is-danger';
      note.textContent = 'Нет установленных ЭК для режима Поехали.';
    } else if (tracker.mapsReadinessChecking && !snapshot.checked) {
      note.className = 'poekhali-shift-route is-muted';
      note.textContent = 'Проверяю рабочую линию, профиль, скорости, станции и светофоры по каждой скачанной карте.';
    } else if (snapshot.checked < snapshot.total) {
      note.textContent = 'Часть карт еще не проверена. Проверка идет фоном и обновит список автоматически.';
    } else if (snapshot.blocked || snapshot.review) {
      note.className = 'poekhali-shift-route is-danger';
      note.textContent = 'Есть карты или участки, где рабочему слою ЭК+GPS+РК+ДОК не хватает профиля, скоростей, станций или светофоров. Ниже видно, что именно требует доводки.';
    } else {
      note.className = 'poekhali-shift-route is-success';
      note.textContent = 'Все скачанные карты прошли проверку рабочего слоя ЭК+GPS+РК+ДОК.';
    }

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);

    if (snapshot.items.length) {
      var list = document.createElement('div');
      list.className = 'poekhali-map-health-list';
      var items = snapshot.items.slice().sort(function(a, b) {
        var aCurrent = isCurrentMap(a.map);
        var bCurrent = isCurrentMap(b.map);
        if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
        if (a.state !== b.state) {
          var order = { blocked: 0, review: 1, ready: 2 };
          return (order[a.state] || 9) - (order[b.state] || 9);
        }
        return String(a.title).localeCompare(String(b.title));
      });
      for (var i = 0; i < items.length; i++) {
        (function(item) {
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'poekhali-map-health-row is-' + item.state;
          row.title = isCurrentMap(item.map) ? 'Текущая карта' : 'Открыть карту ' + item.title;
          row.addEventListener('click', function() {
            if (isCurrentMap(item.map)) return;
            selectMap(item.map, { keepPicker: true }).then(function() {
              renderOpsSheet();
            });
          });

          var text = document.createElement('span');
          text.className = 'poekhali-map-health-text';
          var strong = document.createElement('strong');
          strong.textContent = item.title + (isCurrentMap(item.map) ? ' · сейчас' : '') + (item.workingLayer ? ' · рабочий слой' : '');
          var meta = document.createElement('span');
          var issue = item.errors && item.errors.length ? ' · ' + item.errors[0] : '';
          meta.textContent = item.sectors
            ? ('уч. ' + item.ready + '/' + item.sectors +
              ' · профиль ' + item.profileReady + '/' + item.sectors +
              ' · скорости ' + item.speedReady + '/' + item.sectors +
              ' · объекты ' + item.objectReady + '/' + item.sectors +
              (item.workingLayer && item.rawBlocked ? ' · сырой ЭК блок ' + item.rawBlocked : '') + issue)
            : ('нет рабочих участков' + issue);
          text.appendChild(strong);
          text.appendChild(meta);

          var badge = document.createElement('span');
          badge.className = 'poekhali-map-health-badge';
          badge.textContent = item.sectors ? (item.ready + '/' + item.sectors) : 'нет';

          row.appendChild(text);
          row.appendChild(badge);
          list.appendChild(row);
        })(items[i]);
      }
      section.appendChild(list);
    }

    var actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'poekhali-secondary-action';
    actionBtn.textContent = tracker.mapsReadinessChecking ? 'Проверяю карты...' : 'Обновить проверку ЭК';
    actionBtn.disabled = !!tracker.mapsReadinessChecking;
    actionBtn.addEventListener('click', function() {
      refreshDownloadedMapsReadiness(true);
      renderOpsSheet();
    });
    section.appendChild(actionBtn);

    parent.appendChild(section);
  }

  function renderMapCatalogSection(parent) {
    var snapshot = getMapCatalogSnapshot();
    if (!snapshot.remoteTotal && !snapshot.installed) return;

    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Источники карты';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = snapshot.generatedAt ? ('manifest ' + formatIsoDateLabel(snapshot.generatedAt)) : 'локально';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Локально', String(snapshot.installed), snapshot.installed ? 'success' : 'danger'));
    grid.appendChild(createShiftInfoCell('Внешние', snapshot.remoteDisabled ? 'отключены' : String(snapshot.remoteTotal), snapshot.remoteDisabled || !snapshot.remoteTotal ? 'muted' : ''));
    grid.appendChild(createShiftInfoCell('GPS слой', getLearningSummary().userSections ? (getLearningSummary().userSections + ' уч.') : 'готов к записи', getLearningSummary().userSections ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Недоступно', snapshot.remoteDisabled ? 'не важно' : String(snapshot.unavailable), snapshot.unavailable && !snapshot.remoteDisabled ? 'danger' : 'success'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (snapshot.installed ? 'is-success' : 'is-danger');
    note.textContent = snapshot.installed
      ? 'Внешний источник карт отключен. Рабочий слой режима собирается из локальных ЭК, РК/ДОК и GPS-дорисовки пользователя.'
      : 'Локальной карты нет. Для запуска нужен установленный ЭК или подтвержденный GPS-участок.';

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);

    if (snapshot.items.length) {
      var list = document.createElement('div');
      list.className = 'poekhali-map-health-list';
      var visible = snapshot.items.slice(0, 10);
      for (var i = 0; i < visible.length; i++) {
        (function(item) {
          var row = item.map ? document.createElement('button') : document.createElement('div');
          if (item.map) row.type = 'button';
          row.className = 'poekhali-map-health-row ' + (item.state === 'installed' ? 'is-ready' : 'is-blocked');
          row.title = item.state === 'installed'
            ? (isCurrentMap(item.map) ? 'Текущая карта' : 'Открыть карту ' + item.title)
            : (item.reason || 'Карта недоступна');
          if (item.map) {
            row.addEventListener('click', function() {
              if (isCurrentMap(item.map)) return;
              selectMap(item.map, { keepPicker: true }).then(function() {
                renderOpsSheet();
              });
            });
          }

          var text = document.createElement('span');
          text.className = 'poekhali-map-health-text';
          var strong = document.createElement('strong');
          strong.textContent = item.title + (item.map && isCurrentMap(item.map) ? ' · сейчас' : '');
          var meta = document.createElement('span');
          meta.textContent = item.state === 'installed'
            ? ((item.sourceName || 'локально') + (item.zip ? ' · ' + item.zip : ''))
            : ((item.sourceName || item.zip || 'remote') + ' · ' + (item.reason || 'недоступно'));
          text.appendChild(strong);
          text.appendChild(meta);

          var badge = document.createElement('span');
          badge.className = 'poekhali-map-health-badge';
          badge.textContent = item.state === 'installed' ? 'ЭК' : 'Нет';

          row.appendChild(text);
          row.appendChild(badge);
          list.appendChild(row);
        })(visible[i]);
      }
      if (snapshot.items.length > visible.length) {
        var more = document.createElement('div');
        more.className = 'poekhali-map-health-more';
        more.textContent = 'Еще ' + (snapshot.items.length - visible.length) + ' карт в manifest.';
        list.appendChild(more);
      }
      section.appendChild(list);
    }

    var actionBar = document.createElement('div');
    actionBar.className = 'poekhali-warning-form-actions';

    var pickerBtn = document.createElement('button');
    pickerBtn.type = 'button';
    pickerBtn.className = 'poekhali-secondary-action';
    pickerBtn.textContent = 'Открыть выбор ЭК';
    pickerBtn.addEventListener('click', function() {
      closeOpsSheet();
      openMapPicker();
    });

    var refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'poekhali-secondary-action';
    refreshBtn.textContent = 'Обновить источники';
    refreshBtn.addEventListener('click', function() {
      refreshBtn.disabled = true;
      tracker.manifestPromise = null;
      loadManifest().then(function() {
        return refreshDownloadedMapsReadiness(true);
      }).then(function() {
        renderOpsSheet();
      });
    });

    actionBar.appendChild(pickerBtn);
    actionBar.appendChild(refreshBtn);
    section.appendChild(actionBar);
    parent.appendChild(section);
  }

  function formatRegimeMapCoverageLine(item) {
    var hints = item && item.profileHints ? item.profileHints : {};
    var segmentCount = item && item.profileSegments && item.profileSegments.length ? item.profileSegments.length : 0;
    var signedSegmentCount = 0;
    if (segmentCount) {
      for (var i = 0; i < item.profileSegments.length; i++) {
        if (item.profileSegments[i] && item.profileSegments[i].gradeSigned === true) signedSegmentCount += 1;
      }
    }
    var speedCount = item && item.speedRules && item.speedRules.length ? item.speedRules.length : 0;
    var stationCount = 0;
    var signalCount = 0;
    if (item && item.objects && item.objects.length) {
      for (var j = 0; j < item.objects.length; j++) {
        if (item.objects[j] && String(item.objects[j].type) === '1') signalCount += 1;
        else if (item.objects[j] && String(item.objects[j].type) === '2') stationCount += 1;
      }
    }
    var controlCount = item && item.controlMarks && item.controlMarks.length ? item.controlMarks.length : 0;
    var neutralCount = 0;
    if (controlCount) {
      for (var k = 0; k < item.controlMarks.length; k++) {
        if (item.controlMarks[k] && item.controlMarks[k].kind === 'neutral') neutralCount += 1;
      }
    }
    var parts = [];
    if (segmentCount) parts.push('профиль ' + segmentCount + ' сегм.' + (signedSegmentCount ? ' · знак ' + signedSegmentCount : ''));
    else if (hints.grades && hints.lengths) parts.push('профиль');
    if (speedCount) parts.push('скорости ' + speedCount);
    else if (item && item.speedHints) parts.push('скорости');
    if (signalCount) parts.push('сигналы ' + signalCount);
    if (stationCount) parts.push('станции ' + stationCount);
    else if (item && item.stationHits && item.stationHits.length) parts.push('станции');
    if (controlCount) parts.push('режим ' + controlCount + (neutralCount ? ', НТ ' + neutralCount : ''));
    if (!parts.length) parts.push('данные РК');
    return parts.join(' · ');
  }

  function getRegimeControlMarkKindLabel(kind) {
    if (kind === 'neutral') return 'НТ';
    if (kind === 'throttle') return 'Тяга';
    if (kind === 'power') return 'Мощн.';
    if (kind === 'connection') return 'СОЕД';
    if (kind === 'brake') return 'ЭДТ';
    return 'РК';
  }

  function formatRegimeControlMarkLine(mark) {
    if (!mark) return 'РК';
    var label = getRegimeControlMarkKindLabel(mark.kind) + ' ' + (mark.name || '');
    var source = (mark.sourceCode || 'РК') + (mark.page ? ' · стр. ' + mark.page : '');
    return label.trim() + ' · ' + source;
  }

  function getRegimeControlMarksForPanel(sector, center, limit) {
    var marks = getRegimeControlMarksForSector(sector);
    var seen = {};
    var items = [];
    for (var i = 0; i < marks.length; i++) {
      var mark = marks[i];
      if (!mark || !isFinite(mark.coordinate)) continue;
      var key = [mark.kind || '', normalizeRouteName(mark.name), Math.round(mark.coordinate / 50)].join(':');
      if (seen[key]) continue;
      seen[key] = true;
      items.push({
        sector: mark.sector,
        coordinate: mark.coordinate,
        kind: mark.kind,
        name: mark.name,
        sourceName: mark.sourceName,
        sourceCode: mark.sourceCode,
        sourcePath: mark.sourcePath,
        page: mark.page,
        distance: isFinite(center) ? Math.abs(mark.coordinate - center) : Infinity
      });
    }
    items.sort(function(a, b) {
      var aNeutral = a.kind === 'neutral' ? 0 : 1;
      var bNeutral = b.kind === 'neutral' ? 0 : 1;
      if (isFinite(a.distance) || isFinite(b.distance)) {
        if (aNeutral !== bNeutral) return aNeutral - bNeutral;
        return a.distance - b.distance || a.coordinate - b.coordinate;
      }
      return a.coordinate - b.coordinate;
    });
    return items.slice(0, limit || 8);
  }

  function focusRegimeControlMark(mark) {
    if (!mark) return;
    setPreviewProjection({
      lineCoordinate: mark.coordinate,
      sector: mark.sector
    }, true);
    closeOpsSheet();
    requestDraw();
  }

  function renderRegimeMapsSection(parent) {
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var summary = getRegimeMapsSummary();
    var projection = getCurrentProjectionForForm();
    var activeSector = projection && isRealNumber(projection.sector) ? projection.sector : getCurrentDisplaySector();
    var activeCoordinate = projection && isRealNumber(projection.lineCoordinate) ? projection.lineCoordinate : NaN;
    var coverage = isRealNumber(activeSector) ? getRegimeMapCoverageForSector(activeSector) : [];
    var activeControlMarks = isRealNumber(activeSector) ? getRegimeControlMarksForPanel(activeSector, activeCoordinate, 8) : [];

    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Режимные карты';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = summary.loaded ? ('РК ' + summary.sectors + ' уч.') : 'не загружены';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Источники', summary.sources ? String(summary.sources) : '0', summary.sources ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Страницы', summary.pages ? String(summary.pages) : '0', summary.pages ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Профиль', summary.profilePages ? summary.profilePages + ' стр.' : '—', summary.profilePages ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Сегменты', summary.profileSegments ? String(summary.profileSegments) : '—', summary.profileSegments ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Знак уклона', summary.signedProfileSegments ? String(summary.signedProfileSegments) : '—', summary.signedProfileSegments ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Скорости РК', summary.speedRules ? String(summary.speedRules) : '—', summary.speedRules ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Сигналы РК', summary.signalObjects ? String(summary.signalObjects) : '—', summary.signalObjects ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Метки РК', summary.controlMarks ? String(summary.controlMarks) : '—', summary.controlMarks ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('НТ РК', summary.neutralMarks ? String(summary.neutralMarks) : '—', summary.neutralMarks ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('Объекты РК', summary.objects ? String(summary.objects) : '—', summary.objects ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Участки', summary.sectors ? String(summary.sectors) : '0', summary.sectors ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Дата РК', formatDateLabel(summary.updatedAt), summary.updatedAt ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Индекс', formatIsoDateLabel(summary.generatedAt), summary.generatedAt ? '' : 'muted'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (summary.loaded ? '' : 'is-muted');
    note.textContent = summary.loaded
      ? 'РК подключены как отдельный источник профиля, скоростей, станций, сигналов и режимных меток. Извлеченные данные накладываются на рабочий профиль с пометкой РК.'
      : (summary.error || 'Слой режимных карт пока не загружен.');

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);

    if (summary.loaded && isRealNumber(activeSector)) {
      var list = document.createElement('div');
      list.className = 'poekhali-map-health-list';
      var visible = coverage.slice(0, 4);
      if (!visible.length) {
        var empty = document.createElement('div');
        empty.className = 'poekhali-warning-empty';
        empty.textContent = 'Для участка ' + activeSector + ' РК пока не сопоставлена.';
        list.appendChild(empty);
      }
      for (var i = 0; i < visible.length; i++) {
        (function(item) {
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'poekhali-map-health-row';
          row.title = 'Открыть документ: ' + item.sourceName + ', стр. ' + item.page;
          row.addEventListener('click', function() {
            if (item.sourcePath) {
              window.open(item.sourcePath + '#page=' + item.page, '_blank', 'noopener');
            }
          });

          var text = document.createElement('span');
          text.className = 'poekhali-map-health-text';
          var strong = document.createElement('strong');
          strong.textContent = item.sourceName + ' · стр. ' + item.page;
          var meta = document.createElement('span');
          meta.textContent = formatRegimeMapCoverageLine(item);
          text.appendChild(strong);
          text.appendChild(meta);

          var badge = document.createElement('span');
          badge.className = 'poekhali-map-health-badge';
          badge.textContent = 'РК';

          row.appendChild(text);
          row.appendChild(badge);
          list.appendChild(row);
        })(visible[i]);
      }
      if (coverage.length > visible.length) {
        var more = document.createElement('div');
        more.className = 'poekhali-map-health-more';
        more.textContent = 'Еще ' + (coverage.length - visible.length) + ' страниц РК по участку';
        list.appendChild(more);
      }
      section.appendChild(list);
    }

    if (summary.loaded && isRealNumber(activeSector) && activeControlMarks.length) {
      var marksList = document.createElement('div');
      marksList.className = 'poekhali-map-health-list';

      var marksTitle = document.createElement('div');
      marksTitle.className = 'poekhali-shift-route';
      marksTitle.textContent = 'Ближайшие метки РК по участку ' + activeSector + ': НТ, тяговые позиции, СОЕД, ЭДТ. Нажатие открывает место на профиле.';
      marksList.appendChild(marksTitle);

      for (var m = 0; m < activeControlMarks.length; m++) {
        (function(mark) {
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'poekhali-map-health-row';
          row.title = 'Открыть ' + formatRegimeControlMarkLine(mark) + ' на профиле';
          row.addEventListener('click', function() {
            focusRegimeControlMark(mark);
          });

          var text = document.createElement('span');
          text.className = 'poekhali-map-health-text';
          var strong = document.createElement('strong');
          strong.textContent = formatRegimeControlMarkLine(mark);
          var meta = document.createElement('span');
          meta.textContent = formatLineCoordinate(mark.coordinate) +
            (isFinite(mark.distance) ? ' · от текущей ' + formatDistanceLabel(mark.distance) : '') +
            (mark.sourceName ? ' · ' + mark.sourceName : '');
          text.appendChild(strong);
          text.appendChild(meta);

          var badge = document.createElement('span');
          badge.className = 'poekhali-map-health-badge';
          badge.textContent = getRegimeControlMarkKindLabel(mark.kind);

          row.appendChild(text);
          row.appendChild(badge);
          marksList.appendChild(row);
        })(activeControlMarks[m]);
      }
      section.appendChild(marksList);
    }

    parent.appendChild(section);
  }

  function formatLearningTime(ts) {
    if (!isFinite(Number(ts)) || Number(ts) <= 0) return '—';
    var date = new Date(Number(ts));
    return String(date.getDate()).padStart(2, '0') + '.' +
      String(date.getMonth() + 1).padStart(2, '0') + ' ' +
      String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0');
  }

  function getLearningSyncLabel() {
    var state = tracker.learningSync && tracker.learningSync.state;
    if (state === 'synced') return 'сохранено';
    if (state === 'syncing' || state === 'loading') return 'синхр.';
    if (state === 'local') return 'локально';
    if (state === 'offline') return 'оффлайн';
    if (state === 'error') return 'ошибка';
    if (tracker.learningSync && tracker.learningSync.pending) return 'ожидает';
    return '—';
  }

  function getLearningSyncTone() {
    var state = tracker.learningSync && tracker.learningSync.state;
    if (state === 'synced') return 'success';
    if (state === 'syncing' || state === 'loading' || state === 'pending') return 'warning';
    if (state === 'local') return 'muted';
    if (state === 'offline' || state === 'error') return 'danger';
    if (tracker.learningSync && tracker.learningSync.pending) return 'warning';
    return 'muted';
  }

  function renderLearningSection(parent) {
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Мои участки';
    var summary = getLearningSummary();
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = summary.userSections ? 'GPS участки' : summary.totalSamples ? 'GPS черновик' : 'ждет поездку';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('GPS-точки', summary.totalSamples ? String(summary.totalSamples) : '0', summary.totalSamples ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('На линии', summary.samples ? String(summary.samples) : '0', summary.samples ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Новые точки', summary.rawSamples ? String(summary.rawSamples) : '0', summary.rawSamples ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('Поездки', summary.rawTracks ? String(summary.rawTracks) : '0', summary.rawTracks ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('Черновики', summary.rawDrafts ? String(summary.rawDrafts) : '0', summary.rawDrafts ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('GPS участки', summary.userSections ? String(summary.userSections) : '0', summary.userSections ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Участки', summary.sectors ? String(summary.sectors) : '0', summary.sectors ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Профиль', summary.profileSectors ? summary.profileSectors + ' уч.' : '—', summary.profileSectors ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Проверено', summary.verifiedSectors ? summary.verifiedSectors + ' уч.' : '—', summary.verifiedSectors ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Изменено', summary.changedSectors ? summary.changedSectors + ' уч.' : '—', summary.changedSectors ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('С высотой', (summary.altitudeSamples + summary.rawAltitudeSamples) ? String(summary.altitudeSamples + summary.rawAltitudeSamples) : '0', (summary.altitudeSamples + summary.rawAltitudeSamples) ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('На карте', summary.onTrack ? String(summary.onTrack) : '0', summary.onTrack ? 'success' : 'muted'));
    grid.appendChild(createShiftInfoCell('Рядом', summary.nearTrack ? String(summary.nearTrack) : '0', summary.nearTrack ? 'warning' : 'muted'));
    grid.appendChild(createShiftInfoCell('Расхождения', summary.offTrack ? String(summary.offTrack) : '0', summary.offTrack ? 'danger' : 'muted'));
    grid.appendChild(createShiftInfoCell('Последняя', formatLearningTime(summary.lastSample && summary.lastSample.ts), summary.lastSample ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Сохранение', getLearningSyncLabel(), getLearningSyncTone()));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route ' + (summary.changedSectors || summary.offTrack ? 'is-danger' : summary.samples ? 'is-success' : 'is-muted');
    var syncSuffix = tracker.learningSync && tracker.learningSync.error
      ? ' Сохранение: ' + tracker.learningSync.error + '.'
      : tracker.learningSync && tracker.learningSync.lastSyncAt
        ? ' Последнее сохранение: ' + formatLearningTime(tracker.learningSync.lastSyncAt) + '.'
        : '';
    note.textContent = summary.totalSamples
      ? 'Режим сохраняет точки поездки, собирает из них черновики и дает принять свой участок как рабочую карту. После подтверждения новые точки снова покажут, что участок надо проверить.' + syncSuffix
      : 'Во время поездки режим будет сохранять GPS-точки и высоту, чтобы дополнять карту там, где данных не хватает.';

    var list = document.createElement('div');
    list.className = 'poekhali-map-health-list';
    var currentSector = getCurrentDisplaySector();
    var sectorSummary = isRealNumber(currentSector) ? getLearningSectorSummary(currentSector) : null;
    var currentUserSection = isRealNumber(currentSector) ? getUserSectionForSector(currentSector) : null;
    if (summary.lastSample) {
      var lastIsRaw = summary.lastSample.trackState === 'raw';
      var lastRow = document.createElement('div');
      lastRow.className = 'poekhali-map-health-row ' + (summary.lastSample.trackState === 'offtrack' || lastIsRaw ? 'is-blocked' : summary.lastSample.trackState === 'ontrack' ? 'is-ready' : '');
      var lastText = document.createElement('div');
      lastText.className = 'poekhali-map-health-text';
      var lastTitle = document.createElement('strong');
      lastTitle.textContent = lastIsRaw
        ? 'Последняя сырая GPS-точка · ' + (isRealNumber(summary.lastSample.nearestSector) ? 'рядом с уч. ' + summary.lastSample.nearestSector : 'без привязки к ЭК')
        : 'Последняя GPS-точка · уч. ' + summary.lastSample.sector + ' · ' + formatLineCoordinate(summary.lastSample.coordinate);
      var lastMeta = document.createElement('span');
      lastMeta.textContent = (lastIsRaw ? 'сырой трек' : getLearningTrackStateLabel(summary.lastSample.trackState)) +
        (lastIsRaw ? ' · ' + summary.lastSample.lat.toFixed(5) + ', ' + summary.lastSample.lon.toFixed(5) : '') +
        (isRealNumber(summary.lastSample.nearestCoordinate) ? ' · ближ. ' + formatLineCoordinate(summary.lastSample.nearestCoordinate) : '') +
        (isRealNumber(summary.lastSample.distance) ? ' · ' + formatDistanceLabel(summary.lastSample.distance) + ' до ЭК' : '') +
        (isRealNumber(summary.lastSample.altitude) ? ' · высота ' + Math.round(summary.lastSample.altitude) + ' м' : ' · без высоты');
      lastText.appendChild(lastTitle);
      lastText.appendChild(lastMeta);
      var lastBadge = document.createElement('div');
      lastBadge.className = 'poekhali-map-health-badge';
      lastBadge.textContent = lastIsRaw ? 'сырой GPS' : getLearningTrackStateLabel(summary.lastSample.trackState);
      lastRow.appendChild(lastText);
      lastRow.appendChild(lastBadge);
      list.appendChild(lastRow);
    }
    if (tracker.userSections && tracker.userSections.length) {
      var userSections = tracker.userSections.slice(0, 3);
      for (var us = 0; us < userSections.length; us++) {
        (function(sectionItem) {
          var sectionRow = document.createElement('button');
          sectionRow.type = 'button';
          sectionRow.className = 'poekhali-map-health-row is-ready';
          sectionRow.title = 'Открыть пользовательский GPS-участок на профиле';
          sectionRow.addEventListener('click', function() {
            focusUserLearningSection(sectionItem);
          });
          var sectionText = document.createElement('span');
          sectionText.className = 'poekhali-map-health-text';
          var sectionTitle = document.createElement('strong');
          sectionTitle.textContent = sectionItem.title + ' · ' + formatDistanceLabel((sectionItem.routePoints[sectionItem.routePoints.length - 1].ordinate || 0) - (sectionItem.routePoints[0].ordinate || 0));
          var sectionMeta = document.createElement('span');
          var sectionRefSector = getUserSectionReferenceSector(sectionItem);
          sectionMeta.textContent = sectionItem.routePoints.length + ' точек · профиль ' +
            (sectionItem.profileSegments ? sectionItem.profileSegments.length : 0) + ' сегм. · объекты ' +
            (sectionItem.objects ? sectionItem.objects.length : 0) + ' · скорости ' +
            (sectionItem.speeds ? sectionItem.speeds.length : 0) +
            (isRealNumber(sectionRefSector) ? ' · ЭК уч. ' + sectionRefSector : '');
          sectionText.appendChild(sectionTitle);
          sectionText.appendChild(sectionMeta);
          var sectionBadge = document.createElement('span');
          sectionBadge.className = 'poekhali-map-health-badge';
          sectionBadge.textContent = 'GPS уч.';
          sectionRow.appendChild(sectionText);
          sectionRow.appendChild(sectionBadge);
          list.appendChild(sectionRow);
        })(userSections[us]);
      }
    }
    if (tracker.rawDrafts && tracker.rawDrafts.length) {
      var drafts = tracker.rawDrafts.slice(0, 3);
      for (var d = 0; d < drafts.length; d++) {
        (function(draft) {
          var draftRow = document.createElement('button');
          draftRow.type = 'button';
          draftRow.className = 'poekhali-map-health-row is-blocked';
          draftRow.title = 'Открыть GPS-черновик на профиле';
          draftRow.addEventListener('click', function() {
            focusRawLearningDraft(draft);
          });
          var draftText = document.createElement('span');
          draftText.className = 'poekhali-map-health-text';
          var draftTitle = document.createElement('strong');
          draftTitle.textContent = draft.title + ' · ' + formatDistanceLabel(draft.lengthMeters);
          var draftMeta = document.createElement('span');
          draftMeta.textContent = draft.samples + ' точек · профиль ' +
            (draft.altitudeSamples ? draft.altitudeSamples + ' высот' : 'без высоты') +
            (isRealNumber(draft.referenceSector) ? ' · ЭК уч. ' + draft.referenceSector : '') +
            ' · обновлено ' + formatLearningTime(draft.updatedAt);
          draftText.appendChild(draftTitle);
          draftText.appendChild(draftMeta);
          var draftBadge = document.createElement('span');
          draftBadge.className = 'poekhali-map-health-badge';
          draftBadge.textContent = 'открыть';
          draftRow.appendChild(draftText);
          draftRow.appendChild(draftBadge);
          list.appendChild(draftRow);
          var draftActions = document.createElement('div');
          draftActions.className = 'poekhali-warning-form-actions';
          var promoteBtn = document.createElement('button');
          promoteBtn.type = 'button';
          promoteBtn.className = 'poekhali-primary-action';
          promoteBtn.textContent = 'Принять как GPS-участок';
          promoteBtn.addEventListener('click', function() {
            promoteRawLearningDraft(draft);
          });
          draftActions.appendChild(promoteBtn);
          list.appendChild(draftActions);
        })(drafts[d]);
      }
    }
    if (sectorSummary && sectorSummary.samples) {
      var sectorTone = sectorSummary.verificationState === 'verified' ? 'is-ready' :
        sectorSummary.verificationState === 'draft' || sectorSummary.verificationState === 'changed' || sectorSummary.offTrack ? 'is-blocked' : '';
      var sectorRow = document.createElement('div');
      sectorRow.className = 'poekhali-map-health-row ' + sectorTone;
      var sectorText = document.createElement('div');
      sectorText.className = 'poekhali-map-health-text';
      var sectorTitle = document.createElement('strong');
      sectorTitle.textContent = 'Текущий участок ' + currentSector + ' · GPS-точек ' + sectorSummary.samples;
      var sectorMeta = document.createElement('span');
      sectorMeta.textContent = 'на карте ' + sectorSummary.onTrack +
        ' · рядом ' + sectorSummary.nearTrack +
        ' · вне ' + sectorSummary.offTrack +
        ' · профиль ' + (sectorSummary.profileSegments ? sectorSummary.profileSegments + ' сегм.' : 'нет') +
        ' · ' + getLearningVerificationLabel(sectorSummary.verificationState);
      sectorText.appendChild(sectorTitle);
      sectorText.appendChild(sectorMeta);
      var sectorBadge = document.createElement('div');
      sectorBadge.className = 'poekhali-map-health-badge';
      sectorBadge.textContent = getLearningVerificationLabel(sectorSummary.verificationState);
      sectorRow.appendChild(sectorText);
      sectorRow.appendChild(sectorBadge);
      list.appendChild(sectorRow);

      var verifyBtn = document.createElement('button');
      verifyBtn.type = 'button';
      verifyBtn.className = sectorSummary.verificationState === 'verified' ? 'poekhali-secondary-action' : 'poekhali-primary-action';
      verifyBtn.textContent = sectorSummary.verificationState === 'verified'
        ? 'Снять проверку текущего участка'
        : 'Подтвердить текущий GPS-слой';
      verifyBtn.addEventListener('click', function() {
        setLearningSectorVerified(currentSector, sectorSummary.verificationState !== 'verified');
      });
      list.appendChild(verifyBtn);
    }
    if (currentUserSection) {
      var editorTitle = document.createElement('div');
      editorTitle.className = 'poekhali-shift-route is-success';
      editorTitle.textContent = 'GPS-участок можно довести до рабочей карты: задать реальный км/ПК, править станции, светофоры и скорости без правки файлов ЭК.';
      list.appendChild(editorTitle);

      var firstPoint = currentUserSection.routePoints[0];
      var lastPoint = currentUserSection.routePoints[currentUserSection.routePoints.length - 1];
      var startParts = coordinateToKmPkMeter(firstPoint.ordinate);
      var titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.maxLength = 80;
      titleInput.value = currentUserSection.title || '';
      var startKmInput = createNumberInput(startParts.km, 0, 9999, 1);
      var startPkInput = createNumberInput(startParts.pk, 1, 10, 1);
      var startMeterInput = createNumberInput(startParts.meter, 0, 99, 1);
      var referenceSelect = document.createElement('select');
      var emptyReferenceOption = document.createElement('option');
      emptyReferenceOption.value = '';
      emptyReferenceOption.textContent = 'Не выбран';
      referenceSelect.appendChild(emptyReferenceOption);
      var currentReferenceSector = getUserSectionReferenceSector(currentUserSection);
      getReferenceSectorOptions(currentUserSection).forEach(function(sectorOption) {
        var option = document.createElement('option');
        option.value = String(sectorOption);
        option.textContent = 'Уч. ' + sectorOption;
        if (isRealNumber(currentReferenceSector) && getSectorKey(currentReferenceSector) === getSectorKey(sectorOption)) {
          option.selected = true;
        }
        referenceSelect.appendChild(option);
      });
      var metaGrid = document.createElement('div');
      metaGrid.className = 'poekhali-ops-grid is-user-section-meta';
      metaGrid.appendChild(createField('Название', titleInput));
      metaGrid.appendChild(createField('Опорный ЭК', referenceSelect));
      metaGrid.appendChild(createField('Нач. км', startKmInput));
      metaGrid.appendChild(createField('Нач. ПК', startPkInput));
      metaGrid.appendChild(createField('+ м', startMeterInput));
      list.appendChild(metaGrid);

      var sectionStats = document.createElement('div');
      sectionStats.className = 'poekhali-shift-info-grid';
      sectionStats.appendChild(createShiftInfoCell('Диапазон', formatLineCoordinate(firstPoint.ordinate) + ' — ' + formatLineCoordinate(lastPoint.ordinate)));
      sectionStats.appendChild(createShiftInfoCell('Профиль', currentUserSection.profileSegments.length + ' сегм.'));
      sectionStats.appendChild(createShiftInfoCell('Объекты', String(currentUserSection.objects.length), currentUserSection.objects.length ? 'success' : 'muted'));
      sectionStats.appendChild(createShiftInfoCell('Скорости', String(currentUserSection.speeds.length), currentUserSection.speeds.length ? 'success' : 'muted'));
      sectionStats.appendChild(createShiftInfoCell('Опорный ЭК', isRealNumber(currentReferenceSector) ? 'уч. ' + currentReferenceSector : '—', isRealNumber(currentReferenceSector) ? 'success' : 'warning'));
      sectionStats.appendChild(createShiftInfoCell('Проверка', getUserSectionVerificationLabel(currentUserSection), getUserSectionVerificationState(currentUserSection) === 'verified' ? 'success' : 'warning'));
      list.appendChild(sectionStats);

      var quality = getUserSectionQuality(currentUserSection);
      var qualityRow = document.createElement('div');
      qualityRow.className = 'poekhali-map-health-row ' + (quality.ready ? 'is-ready' : 'is-blocked');
      var qualityText = document.createElement('div');
      qualityText.className = 'poekhali-map-health-text';
      var qualityTitle = document.createElement('strong');
      qualityTitle.textContent = quality.ready ? 'GPS-участок готов к работе' : 'GPS-участок требует доводки';
      var qualityMeta = document.createElement('span');
      qualityMeta.textContent = quality.ready
        ? 'станции ' + quality.stations + ' · светофоры ' + quality.signals + ' · скорости ' + quality.speeds
        : quality.issues.join(' · ');
      qualityText.appendChild(qualityTitle);
      qualityText.appendChild(qualityMeta);
      var qualityBadge = document.createElement('div');
      qualityBadge.className = 'poekhali-map-health-badge';
      qualityBadge.textContent = getUserSectionVerificationLabel(currentUserSection);
      qualityRow.appendChild(qualityText);
      qualityRow.appendChild(qualityBadge);
      list.appendChild(qualityRow);

      var metaActions = document.createElement('div');
      metaActions.className = 'poekhali-warning-form-actions';
      var saveMetaBtn = document.createElement('button');
      saveMetaBtn.type = 'button';
      saveMetaBtn.className = 'poekhali-primary-action';
      saveMetaBtn.textContent = 'Сохранить привязку км/ПК';
      saveMetaBtn.addEventListener('click', function() {
        updateUserLearningSectionMeta(currentUserSection, {
          title: titleInput.value,
          referenceSector: referenceSelect.value,
          startCoordinate: coordinateFromKmPkMeter(startKmInput.value, startPkInput.value, startMeterInput.value)
        });
      });
      metaActions.appendChild(saveMetaBtn);
      var verifyUserSectionBtn = document.createElement('button');
      verifyUserSectionBtn.type = 'button';
      verifyUserSectionBtn.className = getUserSectionVerificationState(currentUserSection) === 'verified' ? 'poekhali-secondary-action' : 'poekhali-primary-action';
      verifyUserSectionBtn.textContent = getUserSectionVerificationState(currentUserSection) === 'verified'
        ? 'Снять проверку участка'
        : 'Подтвердить GPS-участок';
      verifyUserSectionBtn.addEventListener('click', function() {
        setUserLearningSectionVerified(currentUserSection, getUserSectionVerificationState(currentUserSection) !== 'verified');
      });
      metaActions.appendChild(verifyUserSectionBtn);
      var routeForSection = getShiftRouteRequest(getPoekhaliTrainDetails());
      if (routeForSection && routeForSection.from && routeForSection.to) {
        var routeStationsBtn = document.createElement('button');
        routeStationsBtn.type = 'button';
        routeStationsBtn.className = 'poekhali-secondary-action';
        routeStationsBtn.textContent = 'Станции из смены';
        routeStationsBtn.addEventListener('click', function() {
          addShiftRouteStationsToUserSection(currentUserSection);
        });
        metaActions.appendChild(routeStationsBtn);
      }
      list.appendChild(metaActions);

      var referenceSummary = getUserSectionReferenceSummary(currentUserSection);
      var autoRouteSuggestion = isRealNumber(referenceSummary.referenceSector) ? null : getShiftRouteSuggestion();
      var canAutoComplete = isRealNumber(referenceSummary.referenceSector) ||
        (autoRouteSuggestion && autoRouteSuggestion.status === 'ready' && isRealNumber(autoRouteSuggestion.sector));
      if (canAutoComplete) {
        var autoActions = document.createElement('div');
        autoActions.className = 'poekhali-warning-form-actions';
        var autoCompleteBtn = document.createElement('button');
        autoCompleteBtn.type = 'button';
        autoCompleteBtn.className = 'poekhali-primary-action';
        autoCompleteBtn.textContent = 'Собрать участок';
        autoCompleteBtn.addEventListener('click', function() {
          autoCompleteUserLearningSection(currentUserSection);
        });
        autoActions.appendChild(autoCompleteBtn);
        list.appendChild(autoActions);
      }
      if (isRealNumber(referenceSummary.referenceSector)) {
        var referenceStats = document.createElement('div');
        referenceStats.className = 'poekhali-shift-info-grid';
        referenceStats.appendChild(createShiftInfoCell('ЭК объекты', String(referenceSummary.emapObjects), referenceSummary.emapObjects ? '' : 'muted'));
        referenceStats.appendChild(createShiftInfoCell('ЭК скорости', String(referenceSummary.emapSpeeds), referenceSummary.emapSpeeds ? '' : 'muted'));
        referenceStats.appendChild(createShiftInfoCell('РК объекты', String(referenceSummary.regimeObjects), referenceSummary.regimeObjects ? '' : 'muted'));
        referenceStats.appendChild(createShiftInfoCell('РК скорости', String(referenceSummary.regimeSpeeds), referenceSummary.regimeSpeeds ? '' : 'muted'));
        referenceStats.appendChild(createShiftInfoCell('ДОК скорости', String(referenceSummary.documentSpeeds), referenceSummary.documentSpeeds ? 'success' : 'muted'));
        list.appendChild(referenceStats);

        var referenceActions = document.createElement('div');
        referenceActions.className = 'poekhali-warning-form-actions';
        if (referenceSummary.emapObjects) {
          var emapObjectsBtn = document.createElement('button');
          emapObjectsBtn.type = 'button';
          emapObjectsBtn.className = 'poekhali-secondary-action';
          emapObjectsBtn.textContent = 'Объекты ЭК';
          emapObjectsBtn.addEventListener('click', function() {
            addReferenceObjectsToUserSection(currentUserSection, 'emap');
          });
          referenceActions.appendChild(emapObjectsBtn);
        }
        if (referenceSummary.regimeObjects) {
          var regimeObjectsBtn = document.createElement('button');
          regimeObjectsBtn.type = 'button';
          regimeObjectsBtn.className = 'poekhali-secondary-action';
          regimeObjectsBtn.textContent = 'Объекты РК';
          regimeObjectsBtn.addEventListener('click', function() {
            addReferenceObjectsToUserSection(currentUserSection, 'regime');
          });
          referenceActions.appendChild(regimeObjectsBtn);
        }
        if (referenceSummary.emapSpeeds) {
          var emapSpeedsBtn = document.createElement('button');
          emapSpeedsBtn.type = 'button';
          emapSpeedsBtn.className = 'poekhali-secondary-action';
          emapSpeedsBtn.textContent = 'Скорости ЭК';
          emapSpeedsBtn.addEventListener('click', function() {
            addReferenceSpeedsToUserSection(currentUserSection, 'emap');
          });
          referenceActions.appendChild(emapSpeedsBtn);
        }
        if (referenceSummary.regimeSpeeds) {
          var regimeSpeedsBtn = document.createElement('button');
          regimeSpeedsBtn.type = 'button';
          regimeSpeedsBtn.className = 'poekhali-secondary-action';
          regimeSpeedsBtn.textContent = 'Скорости РК';
          regimeSpeedsBtn.addEventListener('click', function() {
            addReferenceSpeedsToUserSection(currentUserSection, 'regime');
          });
          referenceActions.appendChild(regimeSpeedsBtn);
        }
        if (referenceSummary.documentSpeeds) {
          var documentSpeedsBtn = document.createElement('button');
          documentSpeedsBtn.type = 'button';
          documentSpeedsBtn.className = 'poekhali-primary-action';
          documentSpeedsBtn.textContent = 'Скорости ДОК';
          documentSpeedsBtn.addEventListener('click', function() {
            addReferenceSpeedsToUserSection(currentUserSection, 'document');
          });
          referenceActions.appendChild(documentSpeedsBtn);
        }
        if (referenceActions.childNodes.length) list.appendChild(referenceActions);
      } else {
        var referenceMissing = document.createElement('div');
        referenceMissing.className = 'poekhali-shift-route is-muted';
        referenceMissing.textContent = canAutoComplete
          ? 'Опорный ЭК можно взять из маршрута смены кнопкой «Собрать участок», либо выбрать вручную и сохранить привязку.'
          : 'Чтобы подтянуть объекты и скорости из ЭК, РК и документов, выберите опорный участок ЭК и сохраните привязку.';
        list.appendChild(referenceMissing);
      }

      var editingEntity = getEditingUserSectionEntity(currentUserSection);
      var editingItem = editingEntity && editingEntity.item ? editingEntity.item : null;
      var editingKind = editingEntity ? editingEntity.kind : '';
      var editorGrid = document.createElement('div');
      editorGrid.className = 'poekhali-shift-info-grid';
      var entitySelect = document.createElement('select');
      [
        { value: 'station', label: 'Станция' },
        { value: 'signal', label: 'Светофор' },
        { value: 'speed', label: 'Скорость' }
      ].forEach(function(optionConfig) {
        var option = document.createElement('option');
        option.value = optionConfig.value;
        option.textContent = optionConfig.label;
        entitySelect.appendChild(option);
      });
      if (editingKind === 'speed') entitySelect.value = 'speed';
      else if (editingKind === 'signal') entitySelect.value = 'signal';
      else if (editingKind === 'object') entitySelect.value = getLearningUserObjectKind(editingItem);
      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.maxLength = 80;
      nameInput.placeholder = 'Название';
      nameInput.value = editingItem ? String(editingItem.name || '') : '';
      var currentProjection = getCurrentProjectionForForm();
      var defaultCoordinate = currentProjection && getSectorKey(currentProjection.sector) === getSectorKey(currentUserSection.sector) && isRealNumber(currentProjection.lineCoordinate)
        ? Math.round(currentProjection.lineCoordinate)
        : Math.round((currentUserSection.routePoints[0].ordinate + currentUserSection.routePoints[currentUserSection.routePoints.length - 1].ordinate) / 2);
      var entityCoordinate = editingItem ? Number(editingItem.coordinate) : defaultCoordinate;
      var entityParts = coordinateToKmPkMeter(entityCoordinate);
      var coordKmInput = createNumberInput(entityParts.km, 0, 9999, 1);
      var coordPkInput = createNumberInput(entityParts.pk, 1, 10, 1);
      var coordMeterInput = createNumberInput(entityParts.meter, 0, 99, 1);
      var lengthInput = createNumberInput(editingItem ? Math.max(0, Math.round(Number(editingItem.length) || 0)) : 0, 0, 100000, 1);
      var speedInput = createNumberInput(editingItem && editingKind === 'speed' ? Math.round(Number(editingItem.speed) || 60) : 60, 1, 200, 1);
      editorGrid.appendChild(createField('Что добавить', entitySelect));
      editorGrid.appendChild(createField('Название', nameInput));
      editorGrid.appendChild(createField('Км', coordKmInput));
      editorGrid.appendChild(createField('ПК', coordPkInput));
      editorGrid.appendChild(createField('+ м', coordMeterInput));
      editorGrid.appendChild(createField('Длина, м', lengthInput));
      editorGrid.appendChild(createField('Скорость', speedInput));
      list.appendChild(editorGrid);

      var updateEditorFields = function() {
        var isSpeed = entitySelect.value === 'speed';
        speedInput.disabled = !isSpeed;
        speedInput.parentNode.style.display = isSpeed ? '' : 'none';
        nameInput.placeholder = isSpeed ? 'Напр. ОГР 60' : entitySelect.value === 'signal' ? 'Напр. НМ1' : 'Название станции';
        lengthInput.value = isSpeed && Number(lengthInput.value) === 0 ? '1000' : lengthInput.value;
      };
      entitySelect.addEventListener('change', updateEditorFields);
      updateEditorFields();

      var editorActions = document.createElement('div');
      editorActions.className = 'poekhali-warning-form-actions';
      var saveEntityBtn = document.createElement('button');
      saveEntityBtn.type = 'button';
      saveEntityBtn.className = 'poekhali-primary-action';
      saveEntityBtn.textContent = editingItem ? 'Сохранить сущность' : 'Добавить в GPS-участок';
      saveEntityBtn.addEventListener('click', function() {
        addUserSectionEntity(currentUserSection, {
          id: editingItem ? editingItem.id : '',
          type: entitySelect.value,
          name: nameInput.value,
          coordinate: coordinateFromKmPkMeter(coordKmInput.value, coordPkInput.value, coordMeterInput.value),
          length: lengthInput.value,
          speed: speedInput.value
        });
      });
      editorActions.appendChild(saveEntityBtn);
      if (editingItem) {
        var cancelEntityBtn = document.createElement('button');
        cancelEntityBtn.type = 'button';
        cancelEntityBtn.className = 'poekhali-secondary-action';
        cancelEntityBtn.textContent = 'Отмена';
        cancelEntityBtn.addEventListener('click', function() {
          tracker.editingUserSectionEntity = null;
          renderOpsSheet();
        });
        editorActions.appendChild(cancelEntityBtn);
      }
      list.appendChild(editorActions);

      var entityList = document.createElement('div');
      entityList.className = 'poekhali-user-entity-list';
      var entities = [];
      currentUserSection.objects.forEach(function(item) {
        entities.push({
          kind: 'object',
          item: item,
          coordinate: item.coordinate
        });
      });
      currentUserSection.speeds.forEach(function(item) {
        entities.push({
          kind: 'speed',
          item: item,
          coordinate: item.coordinate
        });
      });
      entities.sort(function(a, b) {
        return a.coordinate - b.coordinate || a.kind.localeCompare(b.kind);
      });
      if (!entities.length) {
        var entityEmpty = document.createElement('div');
        entityEmpty.className = 'poekhali-warning-empty';
        entityEmpty.textContent = 'Станции, светофоры и скорости пока не добавлены';
        entityList.appendChild(entityEmpty);
      }
      for (var ue = 0; ue < Math.min(entities.length, 14); ue++) {
        (function(entity) {
          var item = entity.item;
          var kind = entity.kind === 'speed' ? 'speed' : 'object';
          var row = document.createElement('div');
          row.className = 'poekhali-user-entity-row';
          if (editingItem && String(editingItem.id || '') === String(item.id || '')) row.classList.add('is-editing');
          var text = document.createElement('div');
          text.className = 'poekhali-warning-text';
          var strong = document.createElement('strong');
          strong.textContent = getLearningUserEntityKindLabel(kind === 'speed' ? 'speed' : getLearningUserObjectKind(item), item) +
            ' · ' + (kind === 'speed' ? (item.name || ('ОГР ' + item.speed)) : item.name);
          var span = document.createElement('span');
          span.textContent = kind === 'speed'
            ? formatLineCoordinate(item.coordinate) + ' — ' + formatLineCoordinate(item.end) + ' · ' + Math.round(item.speed) + ' км/ч'
            : formatLineCoordinate(item.coordinate) + (item.length ? ' · ' + formatDistanceLabel(item.length) : '');
          span.textContent += ' · ' + getUserSectionEntitySourceLabel(item.source);
          text.appendChild(strong);
          text.appendChild(span);
          var actions = document.createElement('div');
          actions.className = 'poekhali-warning-actions';
          var editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'poekhali-warning-action';
          editBtn.textContent = 'Изм.';
          editBtn.addEventListener('click', function() {
            tracker.editingUserSectionEntity = {
              sectionId: currentUserSection.id,
              kind: kind === 'speed' ? 'speed' : getLearningUserObjectKind(item),
              id: item.id
            };
            renderOpsSheet();
          });
          var deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'poekhali-warning-delete';
          deleteBtn.textContent = 'Убрать';
          deleteBtn.addEventListener('click', function() {
            deleteUserSectionEntity(currentUserSection, kind, item.id);
          });
          actions.appendChild(editBtn);
          actions.appendChild(deleteBtn);
          row.appendChild(text);
          row.appendChild(actions);
          entityList.appendChild(row);
        })(entities[ue]);
      }
      if (entities.length > 14) {
        var moreEntities = document.createElement('div');
        moreEntities.className = 'poekhali-map-health-more';
        moreEntities.textContent = 'Еще ' + (entities.length - 14) + ' сущностей на участке';
        entityList.appendChild(moreEntities);
      }
      list.appendChild(entityList);

      if (currentUserSection.history && currentUserSection.history.length) {
        var historyList = document.createElement('div');
        historyList.className = 'poekhali-user-history-list';
        var historyItems = currentUserSection.history.slice(-5).reverse();
        for (var hi = 0; hi < historyItems.length; hi++) {
          var historyItem = historyItems[hi];
          var historyRow = document.createElement('div');
          historyRow.className = 'poekhali-user-history-row';
          var historyText = document.createElement('span');
          historyText.textContent = historyItem.action + (historyItem.detail ? ' · ' + historyItem.detail : '');
          var historyTime = document.createElement('small');
          historyTime.textContent = formatLearningTime(historyItem.ts);
          historyRow.appendChild(historyText);
          historyRow.appendChild(historyTime);
          historyList.appendChild(historyRow);
        }
        list.appendChild(historyList);
      }
    }

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);
    if (list.childNodes.length) section.appendChild(list);
    parent.appendChild(section);
  }

  function renderSpeedDocsSection(parent) {
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var summary = getSpeedDocsSummary();
    var conflicts = getSpeedDocsConflictSummary();
    var allConflictItems = getSpeedDocsConflictItems();
    var conflictItems = getSpeedDocsConflictItems(8);
    var reviewSummary = getSpeedDocsReviewSummary(allConflictItems);
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Скорости из документов';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    total.textContent = summary.loaded ? 'приоритет выше ЭК' : 'не загружены';
    head.appendChild(title);
    head.appendChild(total);

    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Источники', summary.sources ? String(summary.sources) : '0', summary.sources ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Правила', summary.rules ? String(summary.rules) : '0', summary.rules ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('На карте', summary.activeRules ? String(summary.activeRules) : '0', summary.activeRules ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Участки', summary.sectors ? String(summary.sectors) : '0', summary.sectors ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Конфликты', conflicts.conflicts ? String(conflicts.conflicts) : '0', conflicts.conflicts ? 'danger' : 'muted'));
    grid.appendChild(createShiftInfoCell('Сверено', reviewSummary.verified + '/' + reviewSummary.total, reviewSummary.total && reviewSummary.verified === reviewSummary.total ? 'success' : 'warning'));
    grid.appendChild(createShiftInfoCell('Ошибки', String(reviewSummary.problem), reviewSummary.problem ? 'danger' : 'muted'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route';
    note.textContent = summary.loaded
      ? 'Документные скорости помечаются как ДОК, рисуются на профиле и перекрывают старые ограничения ЭК. ' +
        (conflicts.conflicts ? 'Найдено расхождений ЭК/ДОК: ' + conflicts.conflicts + ' на ' + conflicts.sectors + ' уч. ' : '') +
        'Открытие конфликта показывает исходную строку и страницу PDF для ручной сверки. Дата источников: ' + (summary.updatedAt || '—') + '.'
      : (summary.error || 'Слой актуальных скоростей пока не загружен.');

    section.appendChild(head);
    section.appendChild(grid);
    section.appendChild(note);

    if (summary.loaded && conflictItems.length) {
      var list = document.createElement('div');
      list.className = 'poekhali-conflict-list';
      for (var i = 0; i < conflictItems.length; i++) {
        (function(item) {
          var review = getSpeedDocRuleReview(item.doc);
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'poekhali-conflict-row';
          row.classList.add('is-' + getSpeedDocReviewTone(review));
          row.title = 'Открыть участок ' + item.sector + ' на профиле';
          row.addEventListener('click', function() {
            focusSpeedDocConflict(item);
          });

          var text = document.createElement('div');
          text.className = 'poekhali-conflict-text';
          var strong = document.createElement('strong');
          strong.textContent = 'Участок ' + item.sector + ' · ' + formatLineCoordinate(item.coordinate) + ' — ' + formatLineCoordinate(item.end);
          var span = document.createElement('span');
          span.textContent = formatSpeedDocConflictLine(item);
          var source = document.createElement('small');
          source.textContent = (item.doc.sourceName || 'Документ') +
            (item.doc.sourceUpdatedAt ? ' · ' + item.doc.sourceUpdatedAt : '') +
            (item.doc.page ? ' · стр. ' + item.doc.page : '') +
            ' · ' + getSpeedDocReviewLabel(review);
          text.appendChild(strong);
          text.appendChild(span);
          text.appendChild(source);

          var badge = document.createElement('div');
          badge.className = 'poekhali-conflict-badge';
          badge.textContent = review.status === 'verified'
            ? 'OK'
            : review.status === 'problem'
              ? 'ошибка'
              : item.delta < 0 ? 'строже' : 'выше';

          row.appendChild(text);
          row.appendChild(badge);
          list.appendChild(row);
        })(conflictItems[i]);
      }

      var more = conflicts.conflicts - conflictItems.length;
      if (more > 0) {
        var moreRow = document.createElement('div');
        moreRow.className = 'poekhali-conflict-more';
        moreRow.textContent = 'Еще ' + more + ' конфликтов в других местах карты';
        list.appendChild(moreRow);
      }
      section.appendChild(list);
    }

    parent.appendChild(section);
  }

  function getWarningSyncLabel() {
    var state = tracker.warningSync && tracker.warningSync.state;
    if (state === 'synced') return 'сохранено';
    if (state === 'syncing' || state === 'loading') return 'синхр.';
    if (state === 'local') return 'локально';
    if (state === 'offline') return 'оффлайн';
    if (state === 'error') return 'ошибка';
    if (tracker.warningSync && tracker.warningSync.pending) return 'ожидает';
    return '—';
  }

  function getWarningSyncTone() {
    var state = tracker.warningSync && tracker.warningSync.state;
    if (state === 'synced') return 'is-success';
    if (state === 'syncing' || state === 'loading' || state === 'pending') return 'is-muted';
    if (state === 'offline' || state === 'error') return 'is-danger';
    return 'is-muted';
  }

  function renderRunsSection(parent) {
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Журнал Поехали';
    var total = document.createElement('div');
    total.className = 'poekhali-ops-total';
    var visibleRuns = normalizeRunsList(tracker.runs).filter(function(item) {
      return item && !item.deletedAt;
    });
    var activeRun = getActiveRun();
    total.textContent = activeRun ? 'идет запись' : (visibleRuns.length ? visibleRuns.length + ' зап.' : 'нет записей');
    head.appendChild(title);
    head.appendChild(total);

    var syncNote = document.createElement('div');
    syncNote.className = 'poekhali-shift-route ' + getRunSyncTone();
    syncNote.textContent = 'Сервер: ' + getRunSyncLabel() +
      (tracker.runSync && tracker.runSync.error ? ' · ' + tracker.runSync.error : '') +
      (tracker.runSync && tracker.runSync.lastSyncAt ? ' · ' + formatLearningTime(tracker.runSync.lastSyncAt) : '');

    var summaryRun = activeRun || visibleRuns[0] || null;
    var grid = document.createElement('div');
    grid.className = 'poekhali-shift-info-grid';
    grid.appendChild(createShiftInfoCell('Запись', summaryRun ? formatTimer(summaryRun.status === 'active' ? getTimerElapsed() : summaryRun.durationMs) : formatTimer(getTimerElapsed()), summaryRun ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Дистанция', summaryRun ? formatRunDistance(summaryRun.distanceMeters) : '—', summaryRun ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Тех.', summaryRun ? formatRunSpeedKmh(summaryRun.technicalSpeedKmh) : '—', summaryRun && summaryRun.technicalSpeedKmh ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Средняя', summaryRun ? formatRunSpeedKmh(summaryRun.averageSpeedKmh) : '—', summaryRun && summaryRun.averageSpeedKmh ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Макс.', summaryRun && summaryRun.maxSpeedKmh ? summaryRun.maxSpeedKmh + ' км/ч' : '—', summaryRun && summaryRun.maxSpeedKmh ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Огр.', summaryRun ? formatRunActiveRestriction(summaryRun, true) : '—', summaryRun && summaryRun.activeRestrictionSpeedKmh ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Далее', summaryRun ? formatRunNextRestriction(summaryRun, true) : '—', summaryRun && summaryRun.nextRestrictionSpeedKmh ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Сигнал', summaryRun ? formatRunNextObject(summaryRun, 'nextSignal', true) : '—', summaryRun && summaryRun.nextSignalName ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Станция', summaryRun ? formatRunNextObject(summaryRun, 'nextStation', true) : '—', summaryRun && summaryRun.nextStationName ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Маршрут', summaryRun ? formatRunRouteProgress(summaryRun, true) : '—', summaryRun && summaryRun.routeDistanceMeters ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Цель', summaryRun ? formatRunNavigationTarget(summaryRun, true) : '—', summaryRun && summaryRun.nextTargetLabel ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Прев.', summaryRun && summaryRun.overspeedMaxKmh ? '+' + summaryRun.overspeedMaxKmh + ' км/ч' : '—', summaryRun && summaryRun.overspeedMaxKmh ? 'danger' : 'muted'));
    grid.appendChild(createShiftInfoCell('Опов.', summaryRun && summaryRun.alertCount ? String(summaryRun.alertCount) : '—', summaryRun && summaryRun.alertCount ? 'danger' : 'muted'));
    grid.appendChild(createShiftInfoCell('ПР', summaryRun ? String(summaryRun.warningsCount || 0) : '—', summaryRun ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Смена', summaryRun ? getRunShiftLabel(summaryRun) : '—', summaryRun && findShiftForRun(summaryRun) ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Старт', summaryRun ? formatRunPoint(summaryRun.startPoint) : '—', summaryRun && summaryRun.startPoint ? '' : 'muted'));
    grid.appendChild(createShiftInfoCell('Финиш', summaryRun ? formatRunPoint(summaryRun.endPoint || summaryRun.lastPoint) : '—', summaryRun && (summaryRun.endPoint || summaryRun.lastPoint) ? '' : 'muted'));

    var note = document.createElement('div');
    note.className = 'poekhali-shift-route';
    if (activeRun) {
      note.textContent = getRunStatusText(activeRun.status) + ' · ' +
        (activeRun.trainNumber ? 'поезд № ' + activeRun.trainNumber : 'поезд не указан') +
        (activeRun.route ? ' · ' + activeRun.route : '') +
        ' · ' + formatRunDateTime(activeRun.startedAt);
    } else if (summaryRun) {
      note.textContent = getRunStatusText(summaryRun.status) + ' · ' +
        (summaryRun.trainNumber ? 'поезд № ' + summaryRun.trainNumber : 'поезд не указан') +
        (summaryRun.route ? ' · ' + summaryRun.route : '') +
        ' · ' + formatRunDateTime(summaryRun.startedAt);
    } else {
      note.classList.add('is-muted');
      note.textContent = 'Записей пока нет';
    }

    section.appendChild(head);
    section.appendChild(syncNote);
    section.appendChild(grid);
    section.appendChild(note);

    if (activeRun) {
      var actions = document.createElement('div');
      actions.className = 'poekhali-warning-form-actions';
      var finishBtn = document.createElement('button');
      finishBtn.type = 'button';
      finishBtn.className = 'poekhali-primary-action';
      finishBtn.textContent = 'Завершить поездку';
      finishBtn.addEventListener('click', function() {
        finishActiveRun();
      });
      actions.appendChild(finishBtn);
      section.appendChild(actions);
    }

    var list = document.createElement('div');
    list.className = 'poekhali-map-health-list';
    var rows = visibleRuns.slice(0, 8);
    for (var i = 0; i < rows.length; i++) {
      (function(item) {
        var row = document.createElement(item.lastPoint ? 'button' : 'div');
        if (item.lastPoint) row.type = 'button';
        row.className = 'poekhali-map-health-row ' + (item.status === 'finished' ? 'is-ready' : '');
        if (item.lastPoint) {
          row.title = 'Открыть последнюю точку поездки';
          row.addEventListener('click', function() {
            focusRunPoint(item.lastPoint);
          });
        }

        var text = document.createElement('span');
        text.className = 'poekhali-map-health-text';
        var strong = document.createElement('strong');
        strong.textContent = (item.trainNumber ? '№ ' + item.trainNumber : 'Поезд') + ' · ' + getRunStatusText(item.status);
        var meta = document.createElement('span');
        meta.textContent = formatRunDateTime(item.startedAt) + ' · ' +
          formatRunDistance(item.distanceMeters) + ' · ' +
          'тех ' + formatRunSpeedKmh(item.technicalSpeedKmh) + ' · ' +
          formatTimer(item.status === 'active' ? getTimerElapsed() : item.durationMs) +
          (item.activeRestrictionSpeedKmh ? ' · огр ' + formatRunActiveRestriction(item, true) : '') +
          (item.nextRestrictionSpeedKmh ? ' · далее ' + formatRunNextRestriction(item, true) : '') +
          (item.nextSignalName ? ' · св ' + formatRunNextObject(item, 'nextSignal', true) : '') +
          (item.nextStationName ? ' · ст ' + formatRunNextObject(item, 'nextStation', true) : '') +
          (item.routeDistanceMeters ? ' · маршрут ' + formatRunRouteProgress(item, true) : '') +
          (item.nextTargetLabel ? ' · цель ' + formatRunNavigationTarget(item, true) : '') +
          (item.overspeedMaxKmh ? ' · прев +' + item.overspeedMaxKmh : '') +
          (item.alertCount ? ' · опов ' + item.alertCount : '') +
          (item.lastPoint ? ' · ' + formatRunPoint(item.lastPoint) : '');
        text.appendChild(strong);
        text.appendChild(meta);

        var badge = document.createElement('span');
        badge.className = 'poekhali-map-health-badge';
        badge.textContent = item.maxSpeedKmh ? item.maxSpeedKmh + ' км/ч' : item.direction || '—';

        row.appendChild(text);
        row.appendChild(badge);
        list.appendChild(row);
      })(rows[i]);
    }
    if (visibleRuns.length > rows.length) {
      var more = document.createElement('div');
      more.className = 'poekhali-map-health-more';
      more.textContent = 'Еще ' + (visibleRuns.length - rows.length) + ' записей в журнале';
      list.appendChild(more);
    }
    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'poekhali-map-health-more';
      empty.textContent = 'История появится после первой поездки';
      list.appendChild(empty);
    }
    section.appendChild(list);
    parent.appendChild(section);
  }

  function renderWarningsSection(parent) {
    var section = document.createElement('section');
    section.className = 'poekhali-ops-section';
    var head = document.createElement('div');
    head.className = 'poekhali-ops-section-head';
    var title = document.createElement('div');
    title.textContent = 'Предупреждения';
    var count = document.createElement('div');
    count.className = 'poekhali-ops-total';
    var activeWarnings = getCurrentWarnings();
    var scopedWarnings = getScopedWarnings(true);
    count.textContent = activeWarnings.length
      ? activeWarnings.length + ' активно' + (scopedWarnings.length > activeWarnings.length ? ' · всего ' + scopedWarnings.length : '')
      : scopedWarnings.length ? 'нет активных · всего ' + scopedWarnings.length : 'пусто';
    head.appendChild(title);
    head.appendChild(count);

    var syncNote = document.createElement('div');
    syncNote.className = 'poekhali-shift-route ' + getWarningSyncTone();
    syncNote.textContent = 'Сохранение: ' + getWarningSyncLabel() +
      (tracker.warningSync && tracker.warningSync.error ? ' · ' + tracker.warningSync.error : '') +
      (tracker.warningSync && tracker.warningSync.lastSyncAt ? ' · ' + formatLearningTime(tracker.warningSync.lastSyncAt) : '');

    var projection = getCurrentProjectionForForm();
    var editing = tracker.editingWarningId ? getWarningById(tracker.editingWarningId) : null;
    if (editing && scopedWarnings.indexOf(editing) < 0) {
      editing = null;
      tracker.editingWarningId = '';
    }
    var baseSector = projection && isRealNumber(projection.sector) ? projection.sector : (getAvailableSectors()[0] || 1);
    var baseCoordinate = projection && isRealNumber(projection.lineCoordinate)
      ? projection.lineCoordinate
      : getPreferredSectorCoordinate(baseSector, 'middle');
    if (editing) {
      baseSector = editing.sector;
      baseCoordinate = editing.start;
    }
    var startKmPk = coordinateToKmPk(baseCoordinate);
    var endKmPk = coordinateToKmPk(editing ? editing.end : baseCoordinate + 1000);

    var sectorSelect = document.createElement('select');
    var sectors = getAvailableSectors();
    for (var i = 0; i < sectors.length; i++) {
      var option = document.createElement('option');
      option.value = String(sectors[i]);
      option.textContent = 'Участок ' + sectors[i];
      if (getSectorKey(sectors[i]) === getSectorKey(baseSector)) option.selected = true;
      sectorSelect.appendChild(option);
    }
    var startKmInput = createNumberInput(startKmPk.km, 0, 9999, 1);
    var startPkInput = createNumberInput(startKmPk.pk, 1, 10, 1);
    var endKmInput = createNumberInput(endKmPk.km, 0, 9999, 1);
    var endPkInput = createNumberInput(endKmPk.pk, 1, 10, 1);
    var speedInput = createNumberInput(editing ? editing.speed : 40, 1, 200, 1);
    var noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.maxLength = 40;
    noteInput.placeholder = 'например: работы';
    noteInput.value = editing ? editing.note : '';
    var validUntilInput = document.createElement('input');
    validUntilInput.type = 'date';
    validUntilInput.value = editing ? editing.validUntil : '';

    var grid = document.createElement('div');
    grid.className = 'poekhali-ops-grid is-warning-grid';
    grid.appendChild(createField('Участок', sectorSelect));
    grid.appendChild(createField('Нач. км', startKmInput));
    grid.appendChild(createField('Нач. ПК', startPkInput));
    grid.appendChild(createField('Кон. км', endKmInput));
    grid.appendChild(createField('Кон. ПК', endPkInput));
    grid.appendChild(createField('Скорость', speedInput));
    grid.appendChild(createField('Пометка', noteInput));
    grid.appendChild(createField('Действует до', validUntilInput));

    var formActions = document.createElement('div');
    formActions.className = 'poekhali-warning-form-actions';
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'poekhali-primary-action';
    saveBtn.textContent = editing ? 'Сохранить предупреждение' : 'Добавить предупреждение';
    saveBtn.addEventListener('click', function() {
      saveWarningFromForm(
        editing ? editing.id : '',
        Number(sectorSelect.value),
        coordinateFromKmPk(startKmInput.value, startPkInput.value),
        coordinateFromKmPk(endKmInput.value, endPkInput.value),
        speedInput.value,
        noteInput.value,
        validUntilInput.value
      );
    });
    formActions.appendChild(saveBtn);
    if (editing) {
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'poekhali-secondary-action';
      cancelBtn.textContent = 'Отмена';
      cancelBtn.addEventListener('click', function() {
        tracker.editingWarningId = '';
        renderOpsSheet();
      });
      formActions.appendChild(cancelBtn);
    }

    var bulkInput = document.createElement('textarea');
    bulkInput.rows = 4;
    bulkInput.maxLength = 2000;
    bulkInput.placeholder = '84/1-84/5 40 работы\nуч 9 85км3пк-86км1пк 60 окно';
    var bulkField = createField('Пакет ПР', bulkInput);
    bulkField.classList.add('is-wide');

    var bulkActions = document.createElement('div');
    bulkActions.className = 'poekhali-warning-form-actions';
    var bulkBtn = document.createElement('button');
    bulkBtn.type = 'button';
    bulkBtn.className = 'poekhali-secondary-action';
    bulkBtn.textContent = 'Добавить пакет';
    bulkBtn.addEventListener('click', function() {
      var result = createWarningsFromBulkText(bulkInput.value, Number(sectorSelect.value), validUntilInput.value);
      tracker.warningBulkMessage = result.created.length
        ? 'Добавлено ПР: ' + result.created.length + (result.errors.length ? '. Ошибки: ' + result.errors.slice(0, 2).join(' / ') : '')
        : 'ПР не добавлены' + (result.errors.length ? ': ' + result.errors.slice(0, 2).join(' / ') : '.');
      tracker.editingWarningId = '';
      renderOpsSheet();
      requestDraw();
    });
    bulkActions.appendChild(bulkBtn);

    var importFileInput = document.createElement('input');
    importFileInput.type = 'file';
    importFileInput.accept = '.txt,.csv,.json,text/plain,text/csv,application/json';
    importFileInput.className = 'poekhali-warning-file-input';
    importFileInput.addEventListener('change', function() {
      var file = importFileInput.files && importFileInput.files[0] ? importFileInput.files[0] : null;
      importFileInput.value = '';
      if (!file) return;
      if (file.size > 1024 * 1024) {
        tracker.warningBulkMessage = 'Файл ПР не прочитан: размер больше 1 МБ.';
        renderOpsSheet();
        return;
      }
      var reader = new FileReader();
      reader.onload = function() {
        var text = String(reader.result || '');
        var result = createWarningsFromBulkText(text, Number(sectorSelect.value), validUntilInput.value);
        tracker.warningBulkMessage = result.created.length
          ? 'Импортировано ПР из файла "' + file.name + '": ' + result.created.length + (result.errors.length ? '. Ошибки: ' + result.errors.slice(0, 2).join(' / ') : '')
          : 'ПР из файла "' + file.name + '" не добавлены' + (result.errors.length ? ': ' + result.errors.slice(0, 2).join(' / ') : '.');
        tracker.editingWarningId = '';
        renderOpsSheet();
        requestDraw();
      };
      reader.onerror = function() {
        tracker.warningBulkMessage = 'Файл ПР не прочитан: ошибка чтения.';
        renderOpsSheet();
      };
      reader.readAsText(file);
    });
    var importFileBtn = document.createElement('button');
    importFileBtn.type = 'button';
    importFileBtn.className = 'poekhali-secondary-action';
    importFileBtn.textContent = 'Импорт файла';
    importFileBtn.addEventListener('click', function() {
      importFileInput.click();
    });
    bulkActions.appendChild(importFileBtn);
    bulkActions.appendChild(importFileInput);

    var bulkNote = null;
    if (tracker.warningBulkMessage) {
      bulkNote = document.createElement('div');
      bulkNote.className = 'poekhali-shift-route ' + (tracker.warningBulkMessage.indexOf('Добавлено') === 0 || tracker.warningBulkMessage.indexOf('Импортировано') === 0 ? 'is-success' : 'is-danger');
      bulkNote.textContent = tracker.warningBulkMessage;
    }

    var list = document.createElement('div');
    list.className = 'poekhali-warning-list';
    var warnings = scopedWarnings.slice().sort(function(a, b) {
      var aStatus = getWarningRuntimeStatus(a, projection);
      var bStatus = getWarningRuntimeStatus(b, projection);
      if (aStatus === 'active' && bStatus !== 'active') return -1;
      if (bStatus === 'active' && aStatus !== 'active') return 1;
      if (a.sector !== b.sector) return a.sector - b.sector;
      return a.start - b.start;
    });
    if (!warnings.length) {
      var empty = document.createElement('div');
      empty.className = 'poekhali-warning-empty';
      empty.textContent = 'Нет введенных предупреждений';
      list.appendChild(empty);
    }
    for (var w = 0; w < warnings.length; w++) {
      (function(item) {
        var status = getWarningRuntimeStatus(item, projection);
        var row = document.createElement('div');
        row.className = 'poekhali-warning-row';
        row.classList.add('is-' + status);
        if (editing && item.id === editing.id) row.classList.add('is-editing');
        var text = document.createElement('div');
        text.className = 'poekhali-warning-text';
        var strong = document.createElement('strong');
        strong.textContent = 'Участок ' + item.sector + ' · ПР ' + item.speed;
        var span = document.createElement('span');
        span.textContent = formatWarningRange(item) +
          (item.validUntil ? ' · до ' + formatDateLabel(item.validUntil) : '') +
          (item.note ? ' · ' + item.note : '');
        var statusLine = document.createElement('small');
        statusLine.className = 'poekhali-warning-status';
        statusLine.textContent = getWarningStatusText(status);
        text.appendChild(strong);
        text.appendChild(span);
        text.appendChild(statusLine);
        var actions = document.createElement('div');
        actions.className = 'poekhali-warning-actions';
        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'poekhali-warning-action';
        editBtn.textContent = 'Изм.';
        editBtn.addEventListener('click', function() {
          tracker.editingWarningId = item.id;
          renderOpsSheet();
        });
        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'poekhali-warning-action ' + (item.enabled === false ? 'is-enable' : 'is-disable');
        toggleBtn.textContent = item.enabled === false ? 'Вкл.' : 'Откл.';
        toggleBtn.addEventListener('click', function() {
          toggleWarningEnabled(item);
        });
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'poekhali-warning-delete';
        del.textContent = 'Убрать';
        del.addEventListener('click', function() {
          deleteWarning(item.id);
        });
        actions.appendChild(editBtn);
        actions.appendChild(toggleBtn);
        actions.appendChild(del);
        row.appendChild(text);
        row.appendChild(actions);
        list.appendChild(row);
      })(warnings[w]);
    }

    section.appendChild(head);
    section.appendChild(syncNote);
    section.appendChild(grid);
    section.appendChild(formActions);
    if (isPoekhaliDebugUiEnabled()) {
      section.appendChild(bulkField);
      section.appendChild(bulkActions);
      if (bulkNote) section.appendChild(bulkNote);
    }
    section.appendChild(list);
    parent.appendChild(section);
  }

  function renderOpsSheet() {
    var sheet = getOpsSheet();
    if (!sheet) return;
    clearElement(sheet.content);
    var details = getPoekhaliTrainDetails();
    var warningCount = getCurrentWarnings().length;
    sheet.subtitle.textContent = (details.hasShift ? getShiftSourceLabel(details.source) : 'карточка не найдена') +
      ' · ' + formatPoekhaliCompositionLength(details) + ' · ПР ' + warningCount;
    tracker.opsView = normalizeOpsView(tracker.opsView);
    renderOpsTabs(sheet.content);
    if (tracker.opsView === 'warnings') {
      renderWarningsSection(sheet.content);
    } else if (tracker.opsView === 'map') {
      renderUserMapSection(sheet.content);
    } else if (tracker.opsView === 'service' && isPoekhaliDebugUiEnabled()) {
      renderBackupSection(sheet.content);
      renderDiagnosticsSection(sheet.content);
      renderProdAuditSection(sheet.content);
      renderDownloadedMapsReadinessSection(sheet.content);
      renderMapCatalogSection(sheet.content);
      renderRegimeMapsSection(sheet.content);
      renderSpeedDocsSection(sheet.content);
    } else {
      renderUserTripSection(sheet.content);
      renderUserTripHistorySection(sheet.content);
    }
    setOpsButton();
  }

  function openOpsSheet() {
    closeMapPicker();
    loadAssets().then(function() {
      return maybeAutoSelectMapForShiftRoute({ applyPreview: true });
    }).then(function() {
      var sheet = getOpsSheet();
      if (!sheet) return;
      renderOpsSheet();
      sheet.root.classList.remove('hidden');
    });
  }

  function closeOpsSheet() {
    if (tracker.opsSheet && tracker.opsSheet.root) {
      tracker.opsSheet.root.classList.add('hidden');
    }
  }

  function parseMapXml(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    var parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) throw new Error('Ошибка чтения data.xml');

    var sectorNodes = getElementsByLocalName(doc, 'sector');
    var wpts = [];
    var points = [];

    if (!sectorNodes.length) {
      sectorNodes = [doc];
    }

    for (var sectorIndex = 0; sectorIndex < sectorNodes.length; sectorIndex++) {
      var sectorNode = sectorNodes[sectorIndex];
      var rawSector = sectorNode.getAttribute ? sectorNode.getAttribute('id') : '';
      var sector = parseNumber(rawSector);
      if (!isFinite(sector)) sector = sectorIndex + 1;
      wpts = getElementsByLocalName(sectorNode, 'wpt');

      for (var i = 0; i < wpts.length; i++) {
        var node = wpts[i];
        var lat = parseNumber(node.getAttribute('lat') || getFirstTextByLocalName(node, 'lat'));
        var lon = parseNumber(node.getAttribute('lon') || getFirstTextByLocalName(node, 'lon'));
        var ordinate = normalizeOrdinate(
          getFirstTextByLocalName(node, 'ord') ||
          getFirstTextByLocalName(node, 'name') ||
          node.getAttribute('ord')
        );

        if (!isFinite(lat) || !isFinite(lon) || !isFinite(ordinate)) continue;
        points.push({
          lat: lat,
          lon: lon,
          ordinate: ordinate,
          sector: sector,
          position: points.length
        });
      }
    }

    points.sort(function(a, b) {
      if (a.sector !== b.sector) return a.sector - b.sector;
      return a.ordinate - b.ordinate;
    });

    var unique = [];
    var seen = {};
    for (var j = 0; j < points.length; j++) {
      var key = points[j].sector + ':' + points[j].ordinate;
      if (seen[key]) continue;
      seen[key] = true;
      unique.push(points[j]);
    }

    var segments = [];
    var sectorGroups = {};
    for (var u = 0; u < unique.length; u++) {
      var groupKey = String(unique[u].sector);
      if (!sectorGroups[groupKey]) sectorGroups[groupKey] = [];
      sectorGroups[groupKey].push(unique[u]);
    }

    Object.keys(sectorGroups).forEach(function(sectorKey) {
      var group = sectorGroups[sectorKey];
      for (var k = 0; k < group.length - 1; k++) {
        var a = group[k];
        var b = group[k + 1];
        var ordinateGap = Math.abs(b.ordinate - a.ordinate);
        var geoDistance = haversine(a.lat, a.lon, b.lat, b.lon);
        if (ordinateGap <= 0 || ordinateGap > MAX_SEGMENT_ORDINATE_GAP_M || geoDistance > 2200) continue;
        segments.push({
          start: a,
          end: b,
          sector: a.sector,
          length: geoDistance,
          ordinateGap: ordinateGap
        });
      }
    });

    if (unique.length < 2 || !segments.length) {
      throw new Error('Карта ЭК не содержит рабочих участков');
    }

    return {
      points: unique,
      segments: segments
    };
  }

  function indexProfileElevations(points) {
    points.sort(function(a, b) {
      return a.start - b.start;
    });

    var elevation = 0;
    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      point.elevationStart = elevation;
      point.elevationEnd = elevation + point.grade * point.length / 1000;
      elevation = point.elevationEnd;
    }
    return points;
  }

  function parseProfileXml(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    var parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) throw new Error('Ошибка чтения profile.xml');

    var sectorNodes = getElementsByLocalName(doc, 'sector');
    if (!sectorNodes.length) sectorNodes = [doc];
    var points = [];
    var bySector = {};

    for (var sectorIndex = 0; sectorIndex < sectorNodes.length; sectorIndex++) {
      var sectorNode = sectorNodes[sectorIndex];
      var rawSector = sectorNode.getAttribute ? sectorNode.getAttribute('id') : '';
      var sector = parseNumber(rawSector);
      if (!isFinite(sector)) sector = sectorIndex;
      var sectorKey = String(sector);
      var nodes = getElementsByLocalName(sectorNode, 'pt');

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var start = normalizeOrdinate(getFirstTextByLocalName(node, 'start'));
        var length = Math.round(parseNumber(getFirstTextByLocalName(node, 'len')));
        var grade = parseNumber(getFirstTextByLocalName(node, 'grad'));
        if (!isFinite(start) || !isFinite(length) || length <= 0 || !isFinite(grade)) continue;
        var point = {
          start: start,
          end: start + length,
          length: length,
          grade: grade,
          sector: sector
        };
        points.push(point);
        if (!bySector[sectorKey]) bySector[sectorKey] = [];
        bySector[sectorKey].push(point);
      }
    }

    Object.keys(bySector).forEach(function(sectorKey) {
      indexProfileElevations(bySector[sectorKey]);
    });
    points.sort(function(a, b) {
      if (a.sector !== b.sector) return a.sector - b.sector;
      return a.start - b.start;
    });
    return {
      all: points,
      bySector: bySector
    };
  }

  function parseTrackObjectsXml(xmlText, fileKey) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    var parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) throw new Error('Ошибка чтения ' + fileKey + '.xml');

    var sectorNodes = getElementsByLocalName(doc, 'sector');
    if (!sectorNodes.length) sectorNodes = [doc];
    var all = [];
    var bySector = {};

    for (var sectorIndex = 0; sectorIndex < sectorNodes.length; sectorIndex++) {
      var sectorNode = sectorNodes[sectorIndex];
      var rawSector = sectorNode.getAttribute ? sectorNode.getAttribute('id') : '';
      var sector = parseNumber(rawSector);
      if (!isFinite(sector)) sector = sectorIndex + 1;
      var sectorKey = String(sector);
      var nodes = getElementsByLocalName(sectorNode, 'wpt');

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var coordinate = normalizeOrdinate(getFirstTextByLocalName(node, 'coordinate'));
        var length = Math.max(0, Math.round(parseNumber(getFirstTextByLocalName(node, 'length')) || 0));
        var type = String(getFirstTextByLocalName(node, 'type') || '').trim();
        var name = String(getFirstTextByLocalName(node, 'name') || '').trim();
        var speed = parseNumber(getFirstTextByLocalName(node, 'speed'));
        if (!isFinite(coordinate) || !type || !name) continue;
        var item = {
          fileKey: fileKey,
          sector: sector,
          type: type,
          name: name,
          coordinate: coordinate,
          length: length,
          end: coordinate + length,
          speed: isFinite(speed) ? speed : null
        };
        all.push(item);
        if (!bySector[sectorKey]) bySector[sectorKey] = [];
        bySector[sectorKey].push(item);
      }
    }

    Object.keys(bySector).forEach(function(sectorKey) {
      bySector[sectorKey].sort(function(a, b) {
        if (a.coordinate !== b.coordinate) return a.coordinate - b.coordinate;
        return a.type.localeCompare(b.type);
      });
    });
    all.sort(function(a, b) {
      if (a.sector !== b.sector) return a.sector - b.sector;
      return a.coordinate - b.coordinate;
    });
    return {
      all: all,
      bySector: bySector
    };
  }

  function parseSpeedXml(xmlText) {
    if (!xmlText) return { all: [], bySector: {} };
    var body = String(xmlText).replace(/<\?xml[^>]*\?>/i, '');
    var doc = new DOMParser().parseFromString('<speed-points>' + body + '</speed-points>', 'application/xml');
    var parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) return { all: [], bySector: {} };

    var nodes = getElementsByLocalName(doc, 'wpt');
    var all = [];
    var bySector = {};
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var coordinate = normalizeOrdinate(getFirstTextByLocalName(node, 'coordinate'));
      var length = Math.max(0, Math.round(parseNumber(getFirstTextByLocalName(node, 'length')) || 0));
      var sector = parseNumber(getFirstTextByLocalName(node, 'sector'));
      var wayNumber = Math.round(parseNumber(getFirstTextByLocalName(node, 'way_number')) || 0);
      var speed = parseNumber(getFirstTextByLocalName(node, 'speed'));
      var name = String(getFirstTextByLocalName(node, 'name') || '').trim();
      if (!isFinite(coordinate) || !isFinite(sector) || !isFinite(speed)) continue;
      var item = {
        sector: sector,
        wayNumber: wayNumber || 0,
        name: name || String(Math.round(speed)),
        coordinate: coordinate,
        length: length,
        end: coordinate + length,
        speed: speed
      };
      all.push(item);
      var sectorKey = String(sector);
      if (!bySector[sectorKey]) bySector[sectorKey] = [];
      bySector[sectorKey].push(item);
    }
    Object.keys(bySector).forEach(function(sectorKey) {
      bySector[sectorKey].sort(function(a, b) {
        return a.coordinate - b.coordinate;
      });
    });
    return {
      all: all,
      bySector: bySector
    };
  }

  function loadAssets() {
    if (tracker.assetPromise && tracker.assetMapId === tracker.currentMap.id) return tracker.assetPromise;

    var requestedMap = tracker.currentMap || DEFAULT_MAP;
    tracker.assetMapId = requestedMap.id;
    resetMapData();
    tracker.status = 'loading';
    tracker.assetPromise = loadManifest().then(function(mapConfig) {
      var map = tracker.currentMap || mapConfig || DEFAULT_MAP;
      tracker.assetMapId = map.id;
      var objectEntries = getObjectFileEntries(map);
      var speedPath = getSpeedFilePath(map);
      return Promise.all([
        fetchText(map.data),
        fetchText(map.profile),
        Promise.all(objectEntries.map(function(entry) {
          return fetchText(entry.path).then(function(text) {
            return {
              key: entry.key,
              text: text
            };
          });
        })),
        speedPath ? fetchText(speedPath).catch(function() { return ''; }) : Promise.resolve('')
      ]);
    }).then(function(texts) {
      var map = parseMapXml(texts[0]);
      var profile = parseProfileXml(texts[1]);
      var speed = parseSpeedXml(texts[3]);
      tracker.routePoints = map.points;
      tracker.routeSegments = map.segments;
      tracker.profilePoints = profile.all;
      tracker.profileBySector = profile.bySector;
      tracker.trackObjectsByFile = {};
      for (var i = 0; i < texts[2].length; i++) {
        var parsedObjects = parseTrackObjectsXml(texts[2][i].text, texts[2][i].key);
        tracker.trackObjectsByFile[texts[2][i].key] = parsedObjects;
      }
      tracker.speedLimits = speed.all;
      tracker.speedLimitsBySector = speed.bySector;
      tracker.assetsLoaded = true;
      tracker.assetsError = '';
      if (tracker.lastLocation && tracker.lastLocation.coords) {
        applyTrackProjection(tracker.lastLocation.coords);
      } else if (tracker.status === 'loading') {
        tracker.status = 'waiting';
      }
      if (!tracker.lastLocation || !tracker.lastLocation.coords) {
        maybeAutoSelectMapForShiftRoute({ applyPreview: true });
      }
      requestDraw();
      if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
        renderMapPicker();
      }
    }).catch(function(error) {
      tracker.assetsLoaded = false;
      tracker.assetsError = error && error.message ? error.message : 'Карта ЭК не загружена';
      tracker.status = 'asset-error';
      setGpsStatus('КАРТА', 'is-error');
      requestDraw();
      if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
        renderMapPicker();
      }
    });

    return tracker.assetPromise;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * Math.PI / 180;
    var p2 = lat2 * Math.PI / 180;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function projectToSegment(location, segment) {
    var a = segment.start;
    var b = segment.end;
    var lat0 = ((a.lat + b.lat + location.lat) / 3) * Math.PI / 180;
    var ax = 0;
    var ay = 0;
    var bx = (b.lon - a.lon) * Math.PI / 180 * Math.cos(lat0) * EARTH_RADIUS_M;
    var by = (b.lat - a.lat) * Math.PI / 180 * EARTH_RADIUS_M;
    var px = (location.lon - a.lon) * Math.PI / 180 * Math.cos(lat0) * EARTH_RADIUS_M;
    var py = (location.lat - a.lat) * Math.PI / 180 * EARTH_RADIUS_M;
    var vx = bx - ax;
    var vy = by - ay;
    var lenSq = vx * vx + vy * vy;
    if (lenSq <= 0) return null;
    var t = ((px - ax) * vx + (py - ay) * vy) / lenSq;
    var clamped = Math.max(0, Math.min(1, t));
    var qx = ax + vx * clamped;
    var qy = ay + vy * clamped;
    var distance = Math.sqrt(Math.pow(px - qx, 2) + Math.pow(py - qy, 2));
    var lineCoordinate = a.ordinate + (b.ordinate - a.ordinate) * clamped;

    return {
      distance: distance,
      lineCoordinate: lineCoordinate,
      sector: segment.sector,
      start: a,
      end: b,
      t: clamped
    };
  }

  function findNearestPoint(location) {
    return findNearestPointInList(location, tracker.routePoints);
  }

  function findNearestPointInList(location, points) {
    var best = null;
    var source = Array.isArray(points) ? points : [];
    for (var i = 0; i < source.length; i++) {
      var point = source[i];
      var distance = haversine(location.lat, location.lon, point.lat, point.lon);
      if (!best || distance < best.distance) {
        best = {
          distance: distance,
          lineCoordinate: point.ordinate,
          sector: point.sector,
          start: point,
          end: point,
          t: 0
        };
      }
    }
    return best;
  }

  function findProjectionInRoute(coords, routeSegments, routePoints) {
    var segments = Array.isArray(routeSegments) ? routeSegments : [];
    var points = Array.isArray(routePoints) ? routePoints : [];
    if (!segments.length && !points.length) return null;
    var location = {
      lat: coords.latitude,
      lon: coords.longitude
    };
    var best = null;
    var secondDistance = Infinity;

    for (var i = 0; i < segments.length; i++) {
      var projected = projectToSegment(location, segments[i]);
      if (!projected) continue;
      if (!best || projected.distance < best.distance) {
        secondDistance = best ? best.distance : secondDistance;
        best = projected;
      } else if (projected.distance < secondDistance) {
        secondDistance = projected.distance;
      }
    }

    if (!best) best = findNearestPointInList(location, points);
    if (!best) return null;

    var speedTune = Number(coords.speed) || 0;
    if (!tracker.even) speedTune = -speedTune;
    best.lineCoordinate = Math.round(best.lineCoordinate + speedTune);
    best.secondDistance = secondDistance;
    best.onTrack = best.distance <= MATCH_THRESHOLD_M ||
      (best.distance <= SECOND_POINT_THRESHOLD_M && secondDistance <= SECOND_POINT_THRESHOLD_M);
    if (!isFinite(best.sector)) {
      best.sector = Math.max(0, Math.floor(best.lineCoordinate / 100000));
    }
    return best;
  }

  function findTrackProjection(coords) {
    var mapProjection = null;
    if (tracker.assetsLoaded && (tracker.routeSegments.length || tracker.routePoints.length)) {
      mapProjection = findProjectionInRoute(coords, tracker.routeSegments, tracker.routePoints);
    }
    var userProjection = null;
    if ((tracker.userRouteSegments && tracker.userRouteSegments.length) ||
      (tracker.userRoutePoints && tracker.userRoutePoints.length)) {
      userProjection = findProjectionInRoute(coords, tracker.userRouteSegments, tracker.userRoutePoints);
      if (userProjection) userProjection.userSection = true;
    }
    var rawProjection = null;
    if ((tracker.rawDraftRouteSegments && tracker.rawDraftRouteSegments.length) ||
      (tracker.rawDraftRoutePoints && tracker.rawDraftRoutePoints.length)) {
      rawProjection = findProjectionInRoute(coords, tracker.rawDraftRouteSegments, tracker.rawDraftRoutePoints);
      if (rawProjection) rawProjection.rawDraft = true;
    }
    var bestProjection = mapProjection;
    if (userProjection && (!bestProjection || userProjection.distance + 25 < bestProjection.distance || (!bestProjection.onTrack && userProjection.onTrack))) {
      bestProjection = userProjection;
    }
    if (!bestProjection) return rawProjection;
    if (rawProjection && (!bestProjection.onTrack || bestProjection.distance > LEARNING_NEAR_TRACK_DISTANCE_M) &&
      rawProjection.distance + 50 < bestProjection.distance) {
      return rawProjection;
    }
    return bestProjection;
  }

  function formatMapDistanceCandidate(candidate) {
    if (!candidate || !candidate.map) return '';
    var projection = candidate.projection;
    var title = candidate.map.title || candidate.map.id || 'Карта ЭК';
    if (!projection || !isFinite(projection.distance)) return title + ' · нет линии';
    return title + ' · ' + formatDistanceLabel(projection.distance) + ' до линии';
  }

  function scoreMapForGps(map, coords) {
    return loadMapProbe(map).then(function(probe) {
      if (!probe || !probe.map) return null;
      var projection = findProjectionInRoute(coords, probe.segments, probe.points);
      return {
        map: probe.map,
        projection: projection,
        error: probe.error || '',
        onTrack: !!(projection && projection.onTrack),
        distance: projection && isFinite(projection.distance) ? projection.distance : Infinity
      };
    });
  }

  function chooseBestMapCandidate(candidates) {
    var usable = (candidates || []).filter(function(item) {
      return item && item.map && item.projection && isFinite(item.distance);
    });
    usable.sort(function(a, b) {
      if (a.onTrack !== b.onTrack) return a.onTrack ? -1 : 1;
      if (Math.abs(a.distance - b.distance) > 1) return a.distance - b.distance;
      return String(a.map.title || a.map.id || '').localeCompare(String(b.map.title || b.map.id || ''));
    });
    return usable[0] || null;
  }

  function maybeAutoSelectMapForGps(coords, currentProjection) {
    if (!coords || !tracker.availableMaps || tracker.availableMaps.length <= 1 || tracker.autoMapSelecting) {
      return Promise.resolve(false);
    }
    if (currentProjection && currentProjection.onTrack && currentProjection.distance <= MATCH_THRESHOLD_M) {
      return Promise.resolve(false);
    }
    var maps = tracker.availableMaps.filter(function(map) {
      return getMapDownloadState(map) === 'ready';
    });
    if (maps.length <= 1) return Promise.resolve(false);

    tracker.autoMapSelecting = true;
    tracker.autoMapLastCheckedAt = Date.now();
    updateAutoPositionState('map-search', currentProjection, 'Подбираю ближайшую скачанную карту по GPS.');
    setGpsStatus('ПОИСК ЭК', '');

    return Promise.all(maps.map(function(map) {
      return scoreMapForGps(map, coords);
    })).then(function(candidates) {
      var best = chooseBestMapCandidate(candidates);
      tracker.autoMapCandidate = best;
      var currentDistance = currentProjection && isFinite(currentProjection.distance)
        ? currentProjection.distance
        : Infinity;
      if (!best || !best.map) return false;
      var betterThanCurrent = best.onTrack || best.distance + AUTO_MAP_SWITCH_MARGIN_M < currentDistance;
      if (!isCurrentMap(best.map) && betterThanCurrent) {
        updateAutoPositionState('map-switch', best.projection, 'Переключаю карту: ' + formatMapDistanceCandidate(best) + '.');
        return selectMap(best.map, { keepPicker: true }).then(function() {
          applyTrackProjection(coords);
          if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
            renderMapPicker();
          }
          return true;
        });
      }
      if (best.projection && !currentProjection) {
        updateAutoPositionState(best.onTrack ? 'live' : 'offtrack', best.projection, formatMapDistanceCandidate(best));
      }
      return false;
    }).catch(function(error) {
      tracker.autoMapCandidate = {
        error: error && error.message ? error.message : 'Автоподбор карты не выполнен'
      };
      return false;
    }).then(function(switched) {
      tracker.autoMapSelecting = false;
      requestDraw();
      if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
        renderOpsSheet();
      }
      return switched;
    });
  }

  function applyTrackProjection(coords) {
    var projection = findTrackProjection(coords);
    tracker.projection = projection;
    tracker.nearestProjection = projection || null;
    if (!projection || !projection.onTrack) {
      var draft = projection ? getRawDraftForSector(projection.sector) : null;
      var userSection = projection ? getUserSectionForSector(projection.sector) : null;
      var offtrackDetails = projection && isRealNumber(projection.sector)
        ? 'Ближайший ' + (draft ? draft.title : userSection ? userSection.title : 'участок ' + projection.sector) + ' · ' + formatLineCoordinate(projection.lineCoordinate) +
          (isFinite(projection.distance) ? ' · ' + formatDistanceLabel(projection.distance) + ' до линии' : '')
        : 'Маршрут текущей карты не найден рядом с GPS.';
      tracker.gpsError = projection && isFinite(projection.distance)
        ? 'GPS вне карты: ' + formatDistanceLabel(projection.distance) + ' до линии'
        : 'Не удалось определить местоположение';
      tracker.status = 'offtrack';
      updateAutoPositionState('offtrack', projection, offtrackDetails);
      if (projection && isRealNumber(projection.sector)) {
        setGpsStatus(draft ? 'ВНЕ · GPS' : userSection ? 'ВНЕ · GPS УЧ' : 'ВНЕ · УЧ ' + Math.round(projection.sector), 'is-error');
      } else {
        setGpsStatus('ВНЕ', 'is-error');
      }
      maybeAutoSelectMapForGps(coords, projection);
      return projection;
    }

    inferDirectionFromGpsProjection(projection, coords);
    tracker.gpsError = '';
    tracker.status = 'gps-live';
    var liveDraft = getRawDraftForSector(projection.sector);
    var liveUserSection = getUserSectionForSector(projection.sector);
    updateAutoPositionState('live', projection, liveDraft
      ? 'Положение определено по черновому GPS-участку.'
      : liveUserSection
        ? 'Положение определено по пользовательскому GPS-участку.'
        : 'Участок и км/пк определены автоматически по GPS.');
    setGpsStatus(liveDraft ? 'GPS · ЧЕРН' : liveUserSection ? 'GPS · УЧ' : 'GPS · УЧ ' + Math.round(projection.sector), 'is-live');
    saveLastProjection(projection);
    return projection;
  }

  function saveLastProjection(projection) {
    if (!projection || !projection.onTrack || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return;
    try {
      localStorage.setItem(LAST_PROJECTION_STORAGE_KEY, JSON.stringify({
        mapId: tracker.currentMap && tracker.currentMap.id,
        lineCoordinate: projection.lineCoordinate,
        sector: projection.sector,
        even: !!tracker.even,
        wayNumber: normalizeWayNumber(tracker.wayNumber),
        savedAt: Date.now()
      }));
    } catch (error) {
      // localStorage can be blocked in restricted browser contexts.
    }
  }

  function readLastProjection() {
    try {
      var raw = localStorage.getItem(LAST_PROJECTION_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.mapId !== (tracker.currentMap && tracker.currentMap.id)) return null;
      if (parsed.lineCoordinate === null || parsed.lineCoordinate === undefined || parsed.sector === null || parsed.sector === undefined) return null;
      var lineCoordinate = Number(parsed.lineCoordinate);
      var sector = Number(parsed.sector);
      if (!isRealNumber(lineCoordinate) || !isRealNumber(sector)) return null;
      return {
        lineCoordinate: lineCoordinate,
        sector: sector,
        even: parsed.even,
        wayNumber: parsed.wayNumber,
        onTrack: false,
        preview: true
      };
    } catch (error) {
      return null;
    }
  }

  function savePreviewProjection(projection) {
    if (!projection || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return;
    try {
      localStorage.setItem(PREVIEW_PROJECTION_STORAGE_KEY, JSON.stringify({
        mapId: tracker.currentMap && tracker.currentMap.id,
        lineCoordinate: projection.lineCoordinate,
        sector: projection.sector,
        even: !!tracker.even,
        wayNumber: normalizeWayNumber(tracker.wayNumber),
        savedAt: Date.now()
      }));
    } catch (error) {
      // localStorage can be blocked in restricted browser contexts.
    }
  }

  function readPreviewProjection() {
    try {
      var raw = localStorage.getItem(PREVIEW_PROJECTION_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.mapId !== (tracker.currentMap && tracker.currentMap.id)) return null;
      var lineCoordinate = Number(parsed.lineCoordinate);
      var sector = Number(parsed.sector);
      if (!isRealNumber(lineCoordinate) || !isRealNumber(sector)) return null;
      if (!getSectorCoordinateBounds(sector)) return null;
      return {
        lineCoordinate: lineCoordinate,
        sector: sector,
        even: parsed.even,
        wayNumber: parsed.wayNumber,
        onTrack: false,
        preview: true
      };
    } catch (error) {
      return null;
    }
  }

  function getSectorCoordinateBounds(sector) {
    var key = getSectorKey(sector);
    var min = Infinity;
    var max = -Infinity;
    var profile = getProfilePointsForSector(sector) || [];
    for (var i = 0; i < profile.length; i++) {
      min = Math.min(min, profile[i].start, profile[i].end);
      max = Math.max(max, profile[i].start, profile[i].end);
    }
    if (!isFinite(min) || !isFinite(max)) {
      var routePoints = (tracker.routePoints || []).concat(getUserRoutePointsForSector(sector), (getRawDraftForSector(sector) || {}).routePoints || []);
      for (var j = 0; j < routePoints.length; j++) {
        if (getSectorKey(routePoints[j].sector) !== key) continue;
        min = Math.min(min, routePoints[j].ordinate);
        max = Math.max(max, routePoints[j].ordinate);
      }
    }
    if (!isFinite(min) || !isFinite(max) || min === max) return null;
    return {
      min: min,
      max: max
    };
  }

  function clampPreviewCoordinate(coordinate, sector) {
    var bounds = getSectorCoordinateBounds(sector);
    if (!bounds) return coordinate;
    return clamp(coordinate, bounds.min, bounds.max);
  }

  function setPreviewProjection(projection, persist) {
    if (!projection) return null;
    if (projection.lineCoordinate === null || projection.lineCoordinate === undefined || projection.sector === null || projection.sector === undefined) return null;
    var lineCoordinate = Number(projection.lineCoordinate);
    var sector = Number(projection.sector);
    if (!isRealNumber(lineCoordinate) || !isRealNumber(sector)) return null;
    applyProjectionNavigationState(projection);
    tracker.previewSector = sector;
    tracker.previewCoordinate = clampPreviewCoordinate(lineCoordinate, sector);
    var preview = {
      lineCoordinate: tracker.previewCoordinate,
      sector: tracker.previewSector,
      onTrack: false,
      preview: true
    };
    if (persist) savePreviewProjection(preview);
    return preview;
  }

  function getPreferredSectorCoordinate(sector, mode) {
    var bounds = getSectorCoordinateBounds(sector);
    if (!bounds) return NaN;
    if (mode === 'start') return bounds.min;
    if (mode === 'end') return bounds.max;
    if (mode === 'current' && isRealNumber(tracker.previewSector) && getSectorKey(tracker.previewSector) === getSectorKey(sector) && isRealNumber(tracker.previewCoordinate)) {
      return tracker.previewCoordinate;
    }
    var objects = getTrackObjectsForSector(sector);
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].type === '2' && objects[i].coordinate >= bounds.min && objects[i].coordinate <= bounds.max) {
        return objects[i].coordinate;
      }
    }
    return Math.round((bounds.min + bounds.max) / 2);
  }

  function selectPreviewSector(sector, mode) {
    var coordinate = getPreferredSectorCoordinate(sector, mode || 'middle');
    if (!isRealNumber(coordinate)) return null;
    var preview = setPreviewProjection({
      lineCoordinate: coordinate,
      sector: sector
    }, true);
    requestDraw();
    return preview;
  }

  function getAdjacentSector(sector, direction) {
    var sectors = getAvailableSectors();
    var key = getSectorKey(sector);
    for (var i = 0; i < sectors.length; i++) {
      if (getSectorKey(sectors[i]) !== key) continue;
      var next = i + (direction < 0 ? -1 : 1);
      if (next < 0 || next >= sectors.length) return null;
      return sectors[next];
    }
    return null;
  }

  function getPreviewProjection() {
    if (tracker.projection && tracker.projection.onTrack) return tracker.projection;
    var hasMapPreview = tracker.assetsLoaded && tracker.routePoints.length;
    var hasUserPreview = tracker.userSections && tracker.userSections.length;
    var hasRawPreview = tracker.rawDrafts && tracker.rawDrafts.length;
    if (!hasMapPreview && !hasUserPreview && !hasRawPreview) return null;

    if (tracker.nearestProjection && !tracker.nearestProjection.onTrack && isRealNumber(tracker.nearestProjection.lineCoordinate) && isRealNumber(tracker.nearestProjection.sector)) {
      return setPreviewProjection({
        lineCoordinate: tracker.nearestProjection.lineCoordinate,
        sector: tracker.nearestProjection.sector
      });
    }

    if (isRealNumber(tracker.previewCoordinate) && isRealNumber(tracker.previewSector)) {
      return setPreviewProjection({
        lineCoordinate: tracker.previewCoordinate,
        sector: tracker.previewSector
      });
    }

    var storedPreview = readPreviewProjection();
    if (storedPreview) return setPreviewProjection(storedPreview);

    var stored = readLastProjection();
    if (stored) return setPreviewProjection(stored);

    var routeSuggestion = getShiftRouteSuggestion();
    if (hasMapPreview && routeSuggestion && routeSuggestion.status === 'ready') {
      tracker.even = !!routeSuggestion.even;
      if (!tracker.directionSource) tracker.directionSource = 'route';
      return setPreviewProjection({
        lineCoordinate: routeSuggestion.coordinate,
        sector: routeSuggestion.sector
      }, true);
    }

    if (hasUserPreview && !hasMapPreview) {
      var section = tracker.userSections[0];
      if (section && section.routePoints && section.routePoints.length) {
        return setPreviewProjection({
          lineCoordinate: Math.round((section.routePoints[0].ordinate + section.routePoints[section.routePoints.length - 1].ordinate) / 2),
          sector: section.sector,
          userSection: true
        });
      }
    }

    if (hasRawPreview && !hasMapPreview && !hasUserPreview) {
      var draft = tracker.rawDrafts[0];
      if (draft) {
        return setPreviewProjection({
          lineCoordinate: Math.round((draft.start.ordinate + draft.end.ordinate) / 2),
          sector: draft.sector,
          rawDraft: true
        });
      }
    }

    var point = null;
    for (var i = 0; i < tracker.routePoints.length; i++) {
      if (getProfilePointsForSector(tracker.routePoints[i].sector).length) {
        point = tracker.routePoints[i];
        break;
      }
    }
    point = point || tracker.routePoints[0];
    if (!point) return null;
    return setPreviewProjection({
      lineCoordinate: point.ordinate,
      sector: point.sector
    });
  }

  function formatLineCoordinate(value) {
    if (!isFinite(value)) return '—';
    var coordinate = Math.max(0, Math.round(value));
    var km = Math.floor(coordinate / 1000);
    var meters = coordinate % 1000;
    if (tracker.simpleCoordinate) {
      return km + ' км ' + (Math.floor(meters / 100) + 1) + ' пк';
    }
    return km + '.' + String(meters).padStart(3, '0');
  }

  function formatTimer(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) {
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function getTimerButtonLabel() {
    if (tracker.runStartPreparing) return '...';
    var elapsed = getTimerElapsed();
    if (tracker.timerRunning || elapsed > 0) return formatTimer(elapsed);
    return 'Старт';
  }

  function formatTime(date) {
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date).replace(/\./g, ':');
    } catch (error) {
      var utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
      var msk = new Date(utcMs + 3 * 60 * 60000);
      return String(msk.getHours()).padStart(2, '0') + ':' +
        String(msk.getMinutes()).padStart(2, '0') + ':' +
        String(msk.getSeconds()).padStart(2, '0');
    }
  }

  function getTimerElapsed() {
    var elapsed = tracker.timerElapsedMs;
    if (tracker.timerRunning) {
      elapsed += Date.now() - tracker.timerStartedAt;
    }
    return elapsed;
  }

  function beginPoekhaliRun() {
    if (tracker.timerRunning || tracker.runStartPreparing) return;
    var token = Date.now() + Math.random();
    tracker.runStartPreparing = true;
    tracker.runStartToken = token;
    tracker.runStartMessage = '';
    updateModeButtons();
    requestDraw();

    preparePoekhaliModeEntry()
      .catch(function(error) {
        console.warn('Poekhali run preparation failed:', error);
        return false;
      })
      .then(function() {
        if (!tracker.runStartPreparing || tracker.runStartToken !== token || tracker.timerRunning || !tracker.active) return null;
        var readiness = getRunStartReadiness();
        if (!readiness.ready) {
          blockRunStart(readiness);
          return null;
        }
        tracker.timerStartedAt = Date.now();
        tracker.timerRunning = true;
        var run = startOrResumeRun();
        if (!run) {
          blockRunStart({
            projection: readiness.projection,
            message: 'Не удалось создать рабочую запись Поехали. Проверьте смену и карту.'
          });
        }
        return run;
      })
      .catch(function(error) {
        if (tracker.runStartToken === token) {
          tracker.timerRunning = false;
          tracker.timerStartedAt = 0;
        }
        console.warn('Poekhali run start failed:', error);
      })
      .then(function() {
        if (tracker.runStartToken !== token) return;
        tracker.runStartPreparing = false;
        tracker.runStartToken = 0;
        updateModeButtons();
        requestDraw();
      });
  }

  function setTimerRunning(shouldRun) {
    if (!shouldRun && tracker.runStartPreparing) {
      tracker.runStartPreparing = false;
      tracker.runStartToken = 0;
      updateModeButtons();
      requestDraw();
      return;
    }
    if (shouldRun === tracker.timerRunning) return;
    if (shouldRun) {
      beginPoekhaliRun();
      return;
    } else {
      tracker.timerElapsedMs = getTimerElapsed();
      tracker.timerRunning = false;
      pauseActiveRun();
    }
    updateModeButtons();
    requestDraw();
  }

  function handlePosition(position) {
    if (!position || !position.coords) return;
    tracker.lastLocation = position;
    tracker.speedMps = Number(position.coords.speed) || 0;
    tracker.accuracy = Number(position.coords.accuracy) || 0;
    tracker.lastUpdatedAt = position.timestamp || Date.now();
    tracker.gpsError = '';
    tracker.runStartMessage = '';
    setGpsStatus('GPS', 'is-live');

    if (!tracker.assetsLoaded) {
      tracker.projection = null;
      tracker.status = 'loading';
      updateAutoPositionState('loading', null, 'GPS получен, карта еще загружается.');
      recordRawLearningSample(position, null);
    } else {
      var projection = applyTrackProjection(position.coords);
      recordLearningSample(position, projection);
      updateActiveRunFromProjection(projection, position);
    }
    requestDraw();
  }

  function handleGpsError(error) {
    var code = error && error.code;
    if (code === 1) {
      tracker.gpsError = 'Нет доступа к геолокации';
      tracker.status = 'gps-denied';
      setGpsStatus('НЕТ GPS', 'is-error');
    } else if (code === 3) {
      tracker.gpsError = 'GPS не дал точку';
      tracker.status = 'gps-timeout';
      setGpsStatus('GPS', 'is-error');
    } else {
      tracker.gpsError = 'GPS недоступен';
      tracker.status = 'gps-error';
      setGpsStatus('GPS', 'is-error');
    }
    updateAutoPositionState(tracker.status, tracker.nearestProjection, tracker.gpsError || 'GPS недоступен.');
    requestDraw();
  }

  function startWatchingGps() {
    if (!navigator.geolocation) {
      tracker.gpsError = 'GPS недоступен в браузере';
      tracker.status = 'gps-unsupported';
      setGpsStatus('НЕТ GPS', 'is-error');
      requestDraw();
      return;
    }
    if (tracker.watchId !== null) return;

    tracker.status = tracker.assetsLoaded ? 'waiting' : 'loading';
    tracker.gpsError = '';
    tracker.runStartMessage = '';
    setGpsStatus('GPS', '');
    try {
      tracker.watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleGpsError,
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000
        }
      );
    } catch (error) {
      handleGpsError(error);
    }
  }

  function stopWatchingGps() {
    if (tracker.watchId !== null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(tracker.watchId);
      } catch (error) {}
    }
    tracker.watchId = null;
  }

  function resizeCanvas() {
    var canvas = tracker.canvas || byId('poekhaliCanvas');
    if (!canvas) return false;
    tracker.canvas = canvas;
    tracker.ctx = canvas.getContext('2d');
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    var height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    tracker.width = width;
    tracker.height = height;
    tracker.dpr = dpr;
    tracker.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function drawText(ctx, text, x, y, options) {
    options = options || {};
    ctx.save();
    ctx.font = (options.weight || 700) + ' ' + (options.size || 14) + 'px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = options.color || THEME.text;
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    if (options.maxWidth) ctx.fillText(text, x, y, options.maxWidth);
    else ctx.fillText(text, x, y);
    ctx.restore();
  }

  function getPanelInset(w) {
    return w < 380 ? 12 : 16;
  }

  function getCssInsetVar(name) {
    if (typeof window === 'undefined' || !window.getComputedStyle || !document || !document.documentElement) return 0;
    var value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    var parsed = parseFloat(value);
    return isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function getPoekhaliTopOffset() {
    return Math.max(10, getCssInsetVar('--safe-top'));
  }

  function getPoekhaliRootRect() {
    var host = tracker.canvas || byId('poekhaliCanvas') || byId('poekhaliModeShell');
    if (!host || !host.getBoundingClientRect) return null;
    return host.getBoundingClientRect();
  }

  function getPoekhaliTopControlsBottom() {
    var ids = [
      'btnPoekhaliBack',
      'btnPoekhaliK',
      'btnPoekhaliDirection',
      'btnPoekhaliWay',
      'btnPoekhaliMap',
      'poekhaliGpsStatus'
    ];
    var rootRect = getPoekhaliRootRect();
    var rootTop = rootRect && isFinite(rootRect.top) ? rootRect.top : 0;
    var maxBottom = 0;
    for (var i = 0; i < ids.length; i++) {
      var el = byId(ids[i]);
      if (!el) continue;
      var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (!rect) continue;
      var localBottom = rect.bottom - rootTop;
      if (isFinite(localBottom) && localBottom > maxBottom) {
        maxBottom = localBottom;
      }
    }
    if (maxBottom <= 0) {
      return Math.round(getPoekhaliTopOffset() + 44);
    }
    return Math.round(maxBottom);
  }

  function getPoekhaliTopHudY() {
    return Math.max(78, getPoekhaliTopControlsBottom() + 16);
  }

  function getPoekhaliTopHudBottom() {
    return getPoekhaliTopHudY() + 72;
  }

  function getPoekhaliLiveSummaryTop() {
    return getPoekhaliTopHudBottom() + 14;
  }

  function getPoekhaliTopStackBottom() {
    return getPoekhaliLiveSummaryTop() + 70;
  }

  function roundRectPath(ctx, x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius || 0, width / 2, height / 2));
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function fillRoundRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    roundRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, width, height, radius, stroke) {
    ctx.beginPath();
    roundRectPath(ctx, x, y, width, height, radius);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function drawPanel(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.save();
    ctx.shadowColor = THEME.shadow;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    fillRoundRect(ctx, x, y, width, height, radius, fill || 'rgba(19, 19, 24, 0.82)');
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, radius, stroke || THEME.border);
    ctx.restore();
  }

  function getBottomMetricRect(w, h) {
    var inset = getPanelInset(w);
    var height = h < 560 ? 52 : 58;
    var y = h - height - 74;
    y = Math.max(172, y);
    if (y + height > h - 58) y = Math.max(172, h - height - 58);
    return {
      x: inset,
      y: Math.round(y),
      width: w - inset * 2,
      height: height
    };
  }

  function getProfilePanelRect(w, h) {
    var inset = getPanelInset(w);
    var metrics = getBottomMetricRect(w, h);
    var height = h < 620 ? 104 : 124;
    var y = Math.min(Math.round(h * 0.59), metrics.y - height - 18);
    y = Math.max(150, y);
    if (y + height > metrics.y - 12) {
      y = Math.max(150, metrics.y - height - 12);
    }
    return {
      x: inset,
      y: Math.round(y),
      width: w - inset * 2,
      height: height
    };
  }

  function getRoutePanelRect(w, h) {
    var inset = getPanelInset(w);
    var profile = getProfilePanelRect(w, h);
    var height = h < 620 ? 104 : 142;
    var y = Math.round(h * 0.34);
    if (y + height > profile.y - 18) {
      y = profile.y - height - 18;
    }
    y = Math.max(140, y);
    if (y + height > profile.y - 12) {
      height = Math.max(82, profile.y - y - 12);
    }
    return {
      x: inset,
      y: Math.round(y),
      width: w - inset * 2,
      height: height
    };
  }

  function getJourneyPanelRect(w, h) {
    var inset = getPanelInset(w);
    var metrics = getBottomMetricRect(w, h);
    var y = h < 620 ? 142 : 148;
    var height = Math.max(h < 620 ? 236 : 320, metrics.y - y - 18);
    return {
      x: inset,
      y: Math.round(y),
      width: w - inset * 2,
      height: Math.round(height)
    };
  }

  function drawMetricTile(ctx, label, value, x, y, width, height, tone) {
    var valueSize = String(value).length > 9 ? 13 : 18;
    var valueColor = tone === 'success' ? THEME.green : tone === 'danger' ? THEME.danger : THEME.text;
    drawPanel(ctx, x, y, width, height, 14, 'rgba(19, 19, 24, 0.74)', THEME.border);
    drawText(ctx, label, x + 12, y + 20, {
      size: 10,
      weight: 800,
      color: THEME.sub
    });
    drawText(ctx, String(value), x + 12, y + height - 14, {
      size: valueSize,
      weight: 850,
      color: valueColor
    });
  }

  function getCurrentTrackObjectStore() {
    return tracker.trackObjectsByFile[getCurrentObjectFileKey()] ||
      tracker.trackObjectsByFile[String(tracker.wayNumber)] ||
      tracker.trackObjectsByFile['1'] ||
      null;
  }

  function getLoadedMapSummary() {
    var sectors = {};
    for (var i = 0; i < tracker.routePoints.length; i++) {
      if (isFinite(tracker.routePoints[i].sector)) sectors[String(tracker.routePoints[i].sector)] = true;
    }
    var store = getCurrentTrackObjectStore();
    var objects = store && Array.isArray(store.all) ? store.all : [];
    var stations = 0;
    var signals = 0;
    var speedObjects = 0;
    for (var j = 0; j < objects.length; j++) {
      if (objects[j].type === '2') stations++;
      else if (objects[j].type === '1') signals++;
      else if (objects[j].type === '3') speedObjects++;
    }
    var docsSummary = getSpeedDocsSummary();
    return {
      sectors: Object.keys(sectors).length,
      stations: stations,
      signals: signals,
      speeds: tracker.speedLimits.length + speedObjects + (docsSummary.loaded ? docsSummary.activeRules : 0)
    };
  }

  function setOpsButton() {
    var el = byId('btnPoekhaliOps');
    if (!el) return;
    var details = getPoekhaliTrainDetails();
    var warnings = getCurrentWarnings().length;
    var width = tracker.width || (typeof window !== 'undefined' ? window.innerWidth : 0);
    el.dataset.controlLabel = warnings ? 'ПР' : 'Панель';
    el.textContent = warnings ? String(warnings) : (width && width < 380 ? 'Инфо' : 'Поездка');
    el.classList.toggle('has-warnings', warnings > 0);
    el.title = 'Данные поездки, предупреждения и карта' +
      (details && details.hasShift ? ' · ' + formatPoekhaliCompositionTitle(details) : '') +
      (warnings ? ' · ПР ' + warnings : '');
    el.setAttribute('aria-label', el.title);
  }

  function setTimerButton() {
    var el = byId('btnPoekhaliTimer');
    if (!el) return;
    el.dataset.controlLabel = 'Запись';
    el.textContent = getTimerButtonLabel();
    var title = tracker.runStartPreparing
      ? 'Готовлю карту, смену и GPS для записи поездки'
      : tracker.timerRunning
        ? 'Поставить запись поездки на паузу'
        : getTimerElapsed() > 0
          ? 'Продолжить запись поездки'
          : 'Начать запись поездки';
    el.title = title;
    el.setAttribute('aria-label', title);
  }

  function updateModeButtons() {
    setText('btnPoekhaliDirection', tracker.even ? 'ЧЕТ' : 'НЕЧЕТ');
    setText('btnPoekhaliWay', 'П ' + tracker.wayNumber);
    setText('btnPoekhaliK', tracker.simpleCoordinate ? 'КМ' : 'K 1');
    setTimerButton();
    setMapButton();
    setOpsButton();
    syncGpsStatusDisplay();
  }

  function getAvailableSectors() {
    var seen = {};
    var result = [];
    var points = (tracker.routePoints || []).concat(tracker.userRoutePoints || []);
    for (var i = 0; i < points.length; i++) {
      var sector = Number(points[i].sector);
      if (!isRealNumber(sector)) continue;
      var key = getSectorKey(sector);
      if (!key || seen[key]) continue;
      seen[key] = true;
      result.push(sector);
    }
    result.sort(function(a, b) {
      return a - b;
    });
    return result;
  }

  function getProfileSourceForSector(sector) {
    var direct = getEMapProfilePointsForSector(sector);
    if (direct.length) return direct;
    var user = getUserProfilePointsForSector(sector);
    if (user.length) return user;
    var learned = getLearnedProfilePointsForSector(sector);
    if (learned.length) return learned;
    var regime = getRegimeProfilePointsForSector(sector);
    if (regime.length) return regime;
    var rawDraft = getRawDraftProfilePointsForSector(sector);
    if (rawDraft.length) return rawDraft;
    return getEMapProfilePointsForSector(0);
  }

  function hasProfileForSector(sector) {
    return getProfileSourceForSector(sector).length > 0;
  }

  function getSectorObjectCounts(sector, allFiles) {
    var objects = allFiles ? getAllTrackObjectsForSector(sector) : getTrackObjectsForSector(sector);
    var result = {
      stations: 0,
      signals: 0,
      speeds: 0
    };
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].type === '2') result.stations++;
      else if (objects[i].type === '1') result.signals++;
      else if (objects[i].type === '3') result.speeds++;
    }
    var sectorSpeeds = tracker.speedLimitsBySector[getSectorKey(sector)] || [];
    result.speeds += sectorSpeeds.length;
    result.speeds += getUserSpeedRulesForSector(sector).length;
    result.speeds += getDocumentSpeedRulesForSector(sector).length;
    result.speeds += getRegimeSpeedRulesForSector(sector).length;
    return result;
  }

  function getSectorRoutePointCount(sector) {
    var key = getSectorKey(sector);
    var count = 0;
    for (var i = 0; i < tracker.routePoints.length; i++) {
      if (getSectorKey(tracker.routePoints[i].sector) === key) count++;
    }
    count += getUserRoutePointsForSector(sector).length;
    return count;
  }

  function getSectorRouteSegmentCount(sector) {
    var key = getSectorKey(sector);
    var count = 0;
    for (var i = 0; i < tracker.routeSegments.length; i++) {
      if (getSectorKey(tracker.routeSegments[i].sector) === key) count++;
    }
    count += getUserRouteSegmentsForSector(sector).length;
    return count;
  }

  function getProfileSourceLabel(status) {
    if (status === 'emap') return 'ЭК';
    if (status === 'user') return 'GPS уч.';
    if (status === 'learned') return 'GPS';
    if (status === 'regime') return 'РК';
    if (status === 'raw') return 'GPS черн.';
    if (status === 'fallback') return 'общий';
    return 'нет';
  }

  function getSectorReadiness(sector) {
    var profileStatus = getProfileStatusForSector(sector);
    var counts = getSectorObjectCounts(sector, true);
    var learningSummary = getLearningSectorSummary(sector);
    var regimeProfile = hasRegimeProfileForSector(sector);
    var routePoints = getSectorRoutePointCount(sector);
    var routeSegments = getSectorRouteSegmentCount(sector);
    var bounds = getSectorCoordinateBounds(sector);
    var blocking = [];
    var review = [];

    if (routePoints < 2 || routeSegments < 1) blocking.push('нет рабочей линии маршрута');
    if (!bounds) blocking.push('нет координат');
    if (profileStatus === 'learned' && learningSummary.verificationState === 'verified') {
      // Confirmed GPS layer is still marked as GPS, but it no longer blocks readiness.
    } else if (profileStatus === 'user') {
      review.push('пользовательский GPS-участок');
    } else if (profileStatus === 'learned' && learningSummary.verificationState === 'changed') {
      review.push('GPS профиль изменен после проверки');
    } else if (profileStatus === 'learned') {
      review.push('GPS профиль без подтверждения');
    }
    else if (profileStatus === 'regime') review.push('профиль из РК');
    else if (profileStatus === 'missing' && regimeProfile) review.push('профиль есть в РК');
    else if (profileStatus === 'missing') blocking.push('нет профиля');
    else if (profileStatus === 'fallback') review.push('общий профиль вместо участка');
    if (!counts.speeds) review.push('нет скоростей');
    if (!counts.stations) review.push('нет станций');
    if (!counts.signals) review.push('нет светофоров');
    if (learningSummary.verificationState !== 'verified' && (learningSummary.nearTrack || learningSummary.offTrack)) {
      review.push('GPS/ЭК расходится: рядом ' + learningSummary.nearTrack + ' · вне ' + learningSummary.offTrack);
    }

    var state = blocking.length ? 'blocked' : (review.length ? 'review' : 'ready');
    return {
      sector: sector,
      range: formatSectorRange(sector),
      state: state,
      routePoints: routePoints,
      routeSegments: routeSegments,
      profileStatus: profileStatus,
      regimeProfile: regimeProfile,
      learning: learningSummary,
      counts: counts,
      blocking: blocking,
      review: review,
      issueText: blocking.concat(review).join(' · ') || 'полный слой'
    };
  }

  function getMapReadinessSummary() {
    var sectors = getAvailableSectors();
    var items = [];
    var ready = 0;
    var review = 0;
    var blocked = 0;
    var profileReady = 0;
    var learnedProfiles = 0;
    var regimeProfiles = 0;
    var fallbackProfiles = 0;
    var speedReady = 0;
    var objectReady = 0;
    var gpsConflictSectors = 0;
    var gpsVerifiedSectors = 0;
    var gpsChangedSectors = 0;

    for (var i = 0; i < sectors.length; i++) {
      var item = getSectorReadiness(sectors[i]);
      items.push(item);
      if (item.state === 'ready') ready++;
      else if (item.state === 'review') review++;
      else blocked++;
      if (item.profileStatus === 'emap' || item.profileStatus === 'user' || item.profileStatus === 'learned' || item.profileStatus === 'regime') profileReady++;
      if (item.profileStatus === 'learned') learnedProfiles++;
      if (item.profileStatus === 'user') learnedProfiles++;
      if (item.profileStatus === 'regime') regimeProfiles++;
      if (item.profileStatus === 'fallback') fallbackProfiles++;
      if (item.counts.speeds > 0) speedReady++;
      if (item.counts.stations + item.counts.signals > 0) objectReady++;
      if (item.learning && item.learning.verificationState === 'verified') gpsVerifiedSectors++;
      if (item.learning && item.learning.verificationState === 'changed') gpsChangedSectors++;
      if (item.learning && item.learning.verificationState !== 'verified' && (item.learning.nearTrack || item.learning.offTrack)) gpsConflictSectors++;
    }

    return {
      loaded: tracker.assetsLoaded,
      title: tracker.currentMap && tracker.currentMap.title ? tracker.currentMap.title : 'Карта ЭК',
      sourceName: tracker.currentMap && tracker.currentMap.sourceName ? tracker.currentMap.sourceName : '',
      generatedAt: tracker.mapManifestGeneratedAt,
      sectors: sectors.length,
      ready: ready,
      review: review,
      blocked: blocked,
      profileReady: profileReady,
      learnedProfiles: learnedProfiles,
      regimeProfiles: regimeProfiles,
      fallbackProfiles: fallbackProfiles,
      speedReady: speedReady,
      objectReady: objectReady,
      gpsConflictSectors: gpsConflictSectors,
      gpsVerifiedSectors: gpsVerifiedSectors,
      gpsChangedSectors: gpsChangedSectors,
      items: items,
      issues: items.filter(function(item) {
        return item.state !== 'ready';
      })
    };
  }

  function getDownloadedMaps() {
    return (tracker.availableMaps && tracker.availableMaps.length ? tracker.availableMaps : [DEFAULT_MAP]).filter(function(map) {
      return getMapDownloadState(map) === 'ready';
    });
  }

  function getParsedSectorKeys(mapData, profile, speed, objectStores) {
    var seen = {};
    var result = [];
    function add(value) {
      var sector = Number(value);
      if (!isRealNumber(sector)) return;
      var key = getSectorKey(sector);
      if (!key || seen[key]) return;
      seen[key] = true;
      result.push(sector);
    }
    var points = mapData && Array.isArray(mapData.points) ? mapData.points : [];
    var segments = mapData && Array.isArray(mapData.segments) ? mapData.segments : [];
    for (var i = 0; i < points.length; i++) add(points[i].sector);
    for (var j = 0; j < segments.length; j++) add(segments[j].sector);
    var profileBySector = profile && profile.bySector ? profile.bySector : {};
    Object.keys(profileBySector).forEach(add);
    var speedBySector = speed && speed.bySector ? speed.bySector : {};
    Object.keys(speedBySector).forEach(add);
    var stores = Array.isArray(objectStores) ? objectStores : [];
    for (var s = 0; s < stores.length; s++) {
      var bySector = stores[s] && stores[s].bySector ? stores[s].bySector : {};
      Object.keys(bySector).forEach(add);
    }
    result.sort(function(a, b) {
      return a - b;
    });
    return result;
  }

  function getParsedRouteCounts(mapData, sector) {
    var key = getSectorKey(sector);
    var points = mapData && Array.isArray(mapData.points) ? mapData.points : [];
    var segments = mapData && Array.isArray(mapData.segments) ? mapData.segments : [];
    var pointCount = 0;
    var segmentCount = 0;
    for (var i = 0; i < points.length; i++) {
      if (getSectorKey(points[i].sector) === key) pointCount++;
    }
    for (var j = 0; j < segments.length; j++) {
      if (getSectorKey(segments[j].sector) === key) segmentCount++;
    }
    return {
      points: pointCount,
      segments: segmentCount
    };
  }

  function getParsedObjectCounts(objectStores, sector) {
    var key = getSectorKey(sector);
    var result = {
      stations: 0,
      signals: 0,
      speeds: 0
    };
    var stores = Array.isArray(objectStores) ? objectStores : [];
    for (var s = 0; s < stores.length; s++) {
      var objects = stores[s] && stores[s].bySector && stores[s].bySector[key] ? stores[s].bySector[key] : [];
      for (var i = 0; i < objects.length; i++) {
        if (objects[i].type === '2') result.stations++;
        else if (objects[i].type === '1') result.signals++;
        else if (objects[i].type === '3') result.speeds++;
      }
    }
    return result;
  }

  function buildDownloadedMapReadiness(map, mapData, profile, speed, objectStores, errors) {
    var sectors = getParsedSectorKeys(mapData, profile, speed, objectStores);
    var profileBySector = profile && profile.bySector ? profile.bySector : {};
    var speedBySector = speed && speed.bySector ? speed.bySector : {};
    var items = [];
    var ready = 0;
    var review = 0;
    var blocked = 0;
    var profileReady = 0;
    var speedReady = 0;
    var objectReady = 0;
    var routeReady = 0;

    for (var i = 0; i < sectors.length; i++) {
      var sector = sectors[i];
      var key = getSectorKey(sector);
      var routeCounts = getParsedRouteCounts(mapData, sector);
      var objectCounts = getParsedObjectCounts(objectStores, sector);
      var speedCount = (speedBySector[key] || []).length + objectCounts.speeds;
      var hasProfile = !!(profileBySector[key] && profileBySector[key].length);
      var blocking = [];
      var reviewIssues = [];
      if (routeCounts.points < 2 || routeCounts.segments < 1) blocking.push('нет линии');
      if (!hasProfile) blocking.push('нет профиля');
      if (!speedCount) reviewIssues.push('нет скоростей');
      if (!objectCounts.stations) reviewIssues.push('нет станций');
      if (!objectCounts.signals) reviewIssues.push('нет светофоров');

      var state = blocking.length ? 'blocked' : (reviewIssues.length ? 'review' : 'ready');
      if (state === 'ready') ready++;
      else if (state === 'review') review++;
      else blocked++;
      if (hasProfile) profileReady++;
      if (speedCount) speedReady++;
      if (objectCounts.stations + objectCounts.signals > 0) objectReady++;
      if (routeCounts.points >= 2 && routeCounts.segments >= 1) routeReady++;
      items.push({
        sector: sector,
        state: state,
        routePoints: routeCounts.points,
        routeSegments: routeCounts.segments,
        profileStatus: hasProfile ? 'emap' : 'missing',
        counts: {
          stations: objectCounts.stations,
          signals: objectCounts.signals,
          speeds: speedCount
        },
        blocking: blocking,
        review: reviewIssues,
        issueText: blocking.concat(reviewIssues).join(' · ') || 'полный слой'
      });
    }

    var stateTotal = !sectors.length || errors.length || blocked ? 'blocked' : (review ? 'review' : 'ready');
    return {
      map: map,
      mapId: getMapKey(map),
      title: map && map.title ? map.title : 'Карта ЭК',
      sourceName: map && map.sourceName ? map.sourceName : '',
      state: stateTotal,
      checkedAt: Date.now(),
      sectors: sectors.length,
      ready: ready,
      review: review,
      blocked: blocked,
      routeReady: routeReady,
      profileReady: profileReady,
      speedReady: speedReady,
      objectReady: objectReady,
      errors: errors,
      items: items,
      issues: items.filter(function(item) {
        return item.state !== 'ready';
      })
    };
  }

  function loadDownloadedMapReadiness(map, force) {
    var normalized = normalizeMapConfig(map);
    if (!normalized) return Promise.resolve(null);
    var key = getMapKey(normalized);
    if (!force && tracker.mapReadinessCache[key]) return tracker.mapReadinessCache[key];
    var objectEntries = getObjectFileEntries(normalized);
    var speedPath = getSpeedFilePath(normalized);
    tracker.mapReadinessCache[key] = Promise.all([
      fetchText(normalized.data).then(parseMapXml),
      fetchText(normalized.profile).then(parseProfileXml),
      speedPath ? fetchText(speedPath).then(parseSpeedXml).catch(function(error) {
        return {
          all: [],
          bySector: {},
          error: error && error.message ? error.message : 'speed.xml не прочитан'
        };
      }) : Promise.resolve({ all: [], bySector: {} }),
      Promise.all(objectEntries.map(function(entry) {
        return fetchText(entry.path).then(function(text) {
          return parseTrackObjectsXml(text, entry.key);
        }).catch(function(error) {
          return {
            all: [],
            bySector: {},
            error: error && error.message ? error.message : entry.key + '.xml не прочитан'
          };
        });
      }))
    ]).then(function(parts) {
      var errors = [];
      if (parts[2] && parts[2].error) errors.push(parts[2].error);
      var stores = parts[3] || [];
      for (var i = 0; i < stores.length; i++) {
        if (stores[i] && stores[i].error) errors.push(stores[i].error);
      }
      var summary = buildDownloadedMapReadiness(normalized, parts[0], parts[1], parts[2], stores, errors);
      tracker.mapReadinessCache[key] = summary;
      return summary;
    }).catch(function(error) {
      var summary = {
        map: normalized,
        mapId: key,
        title: normalized.title || 'Карта ЭК',
        sourceName: normalized.sourceName || '',
        state: 'blocked',
        checkedAt: Date.now(),
        sectors: 0,
        ready: 0,
        review: 0,
        blocked: 0,
        routeReady: 0,
        profileReady: 0,
        speedReady: 0,
        objectReady: 0,
        errors: [error && error.message ? error.message : 'карта не прочитана'],
        items: [],
        issues: []
      };
      tracker.mapReadinessCache[key] = summary;
      return summary;
    });
    return tracker.mapReadinessCache[key];
  }

  function refreshDownloadedMapsReadiness(force) {
    if (tracker.mapsReadinessChecking) return Promise.resolve(false);
    var maps = getDownloadedMaps();
    if (!maps.length) return Promise.resolve(false);
    tracker.mapsReadinessChecking = true;
    if (force) {
      for (var i = 0; i < maps.length; i++) {
        delete tracker.mapReadinessCache[getMapKey(maps[i])];
      }
    }
    return Promise.all(maps.map(function(map) {
      return loadDownloadedMapReadiness(map, force);
    })).then(function() {
      tracker.mapsReadinessCheckedAt = Date.now();
      return true;
    }).catch(function() {
      return false;
    }).then(function(result) {
      tracker.mapsReadinessChecking = false;
      if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) {
        renderOpsSheet();
      }
      if (tracker.mapPicker && tracker.mapPicker.root && !tracker.mapPicker.root.classList.contains('hidden')) {
        renderMapPicker();
      }
      return result;
    });
  }

  function getCachedDownloadedMapReadiness(map) {
    var cached = tracker.mapReadinessCache[getMapKey(map)];
    if (!cached || typeof cached.then === 'function') return null;
    return cached;
  }

  function ensureDownloadedMapsReadiness() {
    var maps = getDownloadedMaps();
    if (!maps.length || tracker.mapsReadinessChecking) return;
    var missing = maps.some(function(map) {
      return !getCachedDownloadedMapReadiness(map);
    });
    if (missing) refreshDownloadedMapsReadiness(false);
  }

  function getRuntimeLayerDownloadedReadiness(item) {
    if (!item || !isCurrentMap(item.map) || !tracker.assetsLoaded) return item;
    var summary = getMapReadinessSummary();
    if (!summary.loaded || !summary.sectors) return item;
    return {
      map: item.map,
      mapId: item.mapId,
      title: item.title,
      sourceName: item.sourceName,
      state: summary.blocked ? 'blocked' : summary.review ? 'review' : 'ready',
      checkedAt: item.checkedAt,
      sectors: summary.sectors,
      ready: summary.ready,
      review: summary.review,
      blocked: summary.blocked,
      routeReady: summary.sectors,
      profileReady: summary.profileReady,
      speedReady: summary.speedReady,
      objectReady: summary.objectReady,
      errors: item.errors || [],
      items: summary.items,
      issues: summary.issues,
      workingLayer: true,
      rawState: item.state,
      rawReady: item.ready,
      rawReview: item.review,
      rawBlocked: item.blocked
    };
  }

  function getDownloadedMapsReadinessSnapshot() {
    var maps = getDownloadedMaps();
    var items = maps.map(function(map) {
      return getCachedDownloadedMapReadiness(map);
    }).filter(Boolean).map(getRuntimeLayerDownloadedReadiness);
    var ready = 0;
    var review = 0;
    var blocked = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].state === 'ready') ready++;
      else if (items[i].state === 'review') review++;
      else blocked++;
    }
    return {
      maps: maps,
      items: items,
      checked: items.length,
      total: maps.length,
      ready: ready,
      review: review,
      blocked: blocked
    };
  }

  function formatSectorRange(sector) {
    var bounds = getSectorCoordinateBounds(sector);
    if (!bounds) return 'координаты —';
    return formatLineCoordinate(bounds.min) + ' — ' + formatLineCoordinate(bounds.max);
  }

  function getCurrentProjectionForForm() {
    return (tracker.projection && tracker.projection.onTrack ? tracker.projection : null) ||
      getPreviewProjection() ||
      null;
  }

  function coordinateToKmPk(value) {
    var coordinate = Math.max(0, Math.round(Number(value) || 0));
    return {
      km: Math.floor(coordinate / 1000),
      pk: Math.floor((coordinate % 1000) / 100) + 1
    };
  }

  function coordinateToKmPkMeter(value) {
    var coordinate = Math.max(0, Math.round(Number(value) || 0));
    var base = coordinateToKmPk(coordinate);
    return {
      km: base.km,
      pk: base.pk,
      meter: coordinate % 100
    };
  }

  function coordinateFromKmPk(km, pk) {
    var numericKm = Math.max(0, Math.round(Number(km) || 0));
    var numericPk = Math.max(1, Math.min(10, Math.round(Number(pk) || 1)));
    return numericKm * 1000 + (numericPk - 1) * 100;
  }

  function coordinateFromKmPkMeter(km, pk, meter) {
    var numericMeter = Math.max(0, Math.min(99, Math.round(Number(meter) || 0)));
    return coordinateFromKmPk(km, pk) + numericMeter;
  }

  function formatWarningRange(item) {
    if (!item) return '—';
    return formatLineCoordinate(item.start) + ' — ' + formatLineCoordinate(item.end);
  }

  function formatDistanceLabel(value) {
    if (!isFinite(value)) return '—';
    var distance = Math.max(0, Math.round(value));
    if (distance >= 10000) return (distance / 1000).toFixed(0) + ' км';
    if (distance >= 1000) return (distance / 1000).toFixed(1).replace('.0', '') + ' км';
    return distance + ' м';
  }

  function formatGradeLabel(value) {
    if (!isFinite(value)) return '—';
    var rounded = Math.round(value * 10) / 10;
    return (rounded > 0 ? '+' : '') + rounded.toFixed(1) + '‰';
  }

  function formatProfileGradeLabel(point) {
    if (!point || !isFinite(point.grade)) return '—';
    if (point.gradeSigned === false) {
      return '±' + Math.abs(Math.round(point.grade * 10) / 10).toFixed(1) + '‰';
    }
    return formatGradeLabel(point.grade);
  }

  function drawStatusRow(ctx, x, y, width, label, value, tone) {
    var dotColor = tone === 'danger' ? THEME.danger : tone === 'success' ? THEME.green : THEME.accentStrong;
    ctx.save();
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(x + 8, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, label, x + 20, y, {
      size: 10,
      weight: 850,
      color: THEME.sub,
      maxWidth: Math.max(80, width * 0.42)
    });
    drawText(ctx, value, x + width, y, {
      size: 11,
      weight: 850,
      color: tone === 'danger' ? THEME.danger : THEME.text,
      align: 'right',
      maxWidth: Math.max(110, width * 0.52)
    });
    ctx.restore();
  }

  function drawCenteredStatus(ctx, w, h) {
    var text = '';
    var sub = '';
    var tone = 'info';
    if (tracker.status === 'loading') {
      text = 'Загрузка карты ЭК';
      sub = 'Готовлю профиль, сигналы и скорости';
    } else if (tracker.status === 'asset-error') {
      text = tracker.assetsError || 'Карта ЭК не загружена';
      sub = 'Проверь файлы карты';
      tone = 'danger';
    } else if (tracker.status === 'run-blocked') {
      text = 'Поездка не запущена';
      sub = tracker.runStartMessage || tracker.gpsError || 'Нужна смена, GPS или маршрут на карте';
      tone = 'danger';
    } else if (tracker.status === 'waiting' || tracker.status === 'idle') {
      text = 'Готов к поездке';
      sub = tracker.assetsLoaded ? 'Жду координаты GPS' : '';
    } else if (tracker.gpsError) {
      tone = tracker.status === 'offtrack' ? 'info' : 'danger';
      text = tracker.status === 'gps-denied' ? 'Геолокация выключена' : tracker.gpsError;
      sub = tracker.status === 'gps-denied'
        ? 'Профиль и карта готовы, нужен доступ к GPS'
        : (tracker.status === 'offtrack' ? 'Точка вне загруженной карты' : 'GPS недоступен для текущей сессии');
    }
    var hasMapSummary = tracker.assetsLoaded && tracker.routePoints.length;
    if (sub && tracker.referenceLoaded && !hasMapSummary) sub += ' · ' + getReferenceSummary();
    if (!text) return;

    var panelWidth = Math.min(w - getPanelInset(w) * 2, 360);
    var panelHeight = hasMapSummary ? 168 : (sub ? 122 : 96);
    var x = Math.round((w - panelWidth) / 2);
    var minY = getPoekhaliTopHudY() + 96;
    var y = Math.round(Math.max(minY, Math.min((h - panelHeight) / 2 - 4, h - panelHeight - 250)));
    var accent = tone === 'danger' ? THEME.danger : THEME.accent;
    drawPanel(ctx, x, y, panelWidth, panelHeight, 18, 'rgba(19, 19, 24, 0.88)', THEME.borderHi);
    fillRoundRect(ctx, x + 14, y + 14, 4, panelHeight - 28, 4, accent);

    drawText(ctx, text, x + 30, y + 39, {
      size: Math.min(20, Math.max(17, w / 25)),
      weight: 800,
      color: THEME.text,
      maxWidth: panelWidth - 46
    });
    if (sub) {
      drawText(ctx, sub, x + 30, y + 66, {
        size: 12,
        weight: 700,
        color: THEME.sub,
        maxWidth: panelWidth - 46
      });
    }
    if (hasMapSummary) {
      var summary = getLoadedMapSummary();
      drawStatusRow(ctx, x + 30, y + 98, panelWidth - 52, 'КАРТА', (tracker.currentMap && tracker.currentMap.title) || 'Карта ЭК', 'success');
      drawStatusRow(ctx, x + 30, y + 122, panelWidth - 52, 'ПУТЬ', summary.sectors + ' уч. / ' + summary.stations + ' ст.', 'success');
      drawStatusRow(ctx, x + 30, y + 146, panelWidth - 52, 'ОБЪЕКТЫ', summary.signals + ' св. / ' + summary.speeds + ' огр.', 'success');
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getSectorKey(sector) {
    return isRealNumber(sector) ? String(Math.round(sector)) : '';
  }

  function getCurrentObjectFileKey() {
    return String(tracker.wayNumber) + (tracker.even ? '' : 'n');
  }

  function mergeRegimeTrackObjects(baseObjects, regimeObjects) {
    var result = Array.isArray(baseObjects) ? baseObjects.slice() : [];
    var seen = {};
    for (var i = 0; i < result.length; i++) {
      var base = result[i] || {};
      seen[[base.type || '', normalizeRouteName(base.name), Math.round(Number(base.coordinate || 0) / 50)].join(':')] = true;
    }
    var source = Array.isArray(regimeObjects) ? regimeObjects : [];
    for (var j = 0; j < source.length; j++) {
      var item = source[j] || {};
      var key = [item.type || '', normalizeRouteName(item.name), Math.round(Number(item.coordinate || 0) / 50)].join(':');
      if (seen[key]) continue;
      seen[key] = true;
      result.push(item);
    }
    result.sort(function(a, b) {
      if (a.coordinate !== b.coordinate) return a.coordinate - b.coordinate;
      return String(a.type || '').localeCompare(String(b.type || ''));
    });
    return result;
  }

  function getTrackObjectsForSector(sector) {
    var store = getCurrentTrackObjectStore();
    var key = getSectorKey(sector);
    var base = store && store.bySector && store.bySector[key] ? store.bySector[key] : [];
    return mergeRegimeTrackObjects(base.concat(getUserObjectsForSector(sector)), getRegimeTrackObjectsForSector(sector));
  }

  function getAllTrackObjectsForSector(sector) {
    var key = getSectorKey(sector);
    var result = [];
    Object.keys(tracker.trackObjectsByFile || {}).forEach(function(fileKey) {
      var store = tracker.trackObjectsByFile[fileKey];
      var items = store && store.bySector ? store.bySector[key] : null;
      if (!Array.isArray(items)) return;
      for (var i = 0; i < items.length; i++) {
        result.push(items[i]);
      }
    });
    result = result.concat(getUserObjectsForSector(sector));
    return mergeRegimeTrackObjects(result, getRegimeTrackObjectsForSector(sector));
  }

  function isObjectInRange(item, left, right) {
    var end = item.length > 0 ? item.end : item.coordinate;
    return end >= left && item.coordinate <= right;
  }

  function getVisibleTrackObjects(center, halfWindow, sector) {
    var left = center - halfWindow;
    var right = center + halfWindow;
    return getTrackObjectsForSector(sector).filter(function(item) {
      return isObjectInRange(item, left, right);
    });
  }

  function getVisibleSpeedRules(center, halfWindow, sector, visibleObjects) {
    var left = center - halfWindow;
    var right = center + halfWindow;
    var rules = visibleObjects.filter(function(item) {
      return item.type === '3';
    }).map(function(item) {
      return {
        coordinate: item.coordinate,
        length: item.length,
        end: item.end,
        speed: item.speed,
        name: item.name,
        source: 'object'
      };
    });
    var sectorSpeeds = tracker.speedLimitsBySector[getSectorKey(sector)] || [];
    for (var i = 0; i < sectorSpeeds.length; i++) {
      var speed = sectorSpeeds[i];
      if (speed.wayNumber && speed.wayNumber !== tracker.wayNumber) continue;
      if (!isObjectInRange(speed, left, right)) continue;
      rules.push({
        coordinate: speed.coordinate,
        length: speed.length,
        end: speed.end,
        speed: speed.speed,
        name: speed.name,
        source: 'speed'
      });
    }
    var userSpeeds = getUserSpeedRulesForSector(sector, left, right);
    for (var u = 0; u < userSpeeds.length; u++) {
      var userSpeed = userSpeeds[u];
      if (userSpeed.wayNumber && userSpeed.wayNumber !== tracker.wayNumber) continue;
      rules.push({
        coordinate: userSpeed.coordinate,
        length: userSpeed.length,
        end: userSpeed.end,
        speed: userSpeed.speed,
        name: userSpeed.name,
        source: 'user'
      });
    }
    appendRegimeSpeedRules(rules, left, right, sector);
    appendDocumentSpeedRules(rules, left, right, sector);
    rules.sort(function(a, b) {
      return a.coordinate - b.coordinate;
    });
    return normalizeSpeedRules(rules);
  }

  function isDocumentSpeedRuleUsable(rule) {
    if (!rule) return false;
    if (rule.confidence === 'low') return false;
    return isFinite(rule.coordinate) && isFinite(rule.end) && isFinite(rule.speed);
  }

  function getDocumentSpeedRulesForSector(sector, left, right) {
    var sectorRules = tracker.speedDocsBySector[getSectorKey(sector)] || [];
    var result = [];
    for (var i = 0; i < sectorRules.length; i++) {
      var rule = sectorRules[i];
      if (!isDocumentSpeedRuleUsable(rule)) continue;
      if (isFinite(left) && isFinite(right) && !isObjectInRange(rule, left, right)) continue;
      result.push(rule);
    }
    return result;
  }

  function getEMapSpeedRulesForSector(sector, left, right) {
    var result = [];
    var objects = getTrackObjectsForSector(sector);
    for (var i = 0; i < objects.length; i++) {
      var object = objects[i];
      if (object.type !== '3') continue;
      if (isFinite(left) && isFinite(right) && !isObjectInRange(object, left, right)) continue;
      result.push({
        coordinate: object.coordinate,
        length: object.length,
        end: object.end,
        speed: object.speed,
        name: object.name,
        source: 'object'
      });
    }
    var sectorSpeeds = tracker.speedLimitsBySector[getSectorKey(sector)] || [];
    for (var j = 0; j < sectorSpeeds.length; j++) {
      var speed = sectorSpeeds[j];
      if (speed.wayNumber && speed.wayNumber !== tracker.wayNumber) continue;
      if (isFinite(left) && isFinite(right) && !isObjectInRange(speed, left, right)) continue;
      result.push({
        coordinate: speed.coordinate,
        length: speed.length,
        end: speed.end,
        speed: speed.speed,
        name: speed.name,
        source: 'speed'
      });
    }
    return result;
  }

  function getRuleOverlapLength(a, b) {
    if (!a || !b) return 0;
    var start = Math.max(Number(a.coordinate), Number(b.coordinate));
    var end = Math.min(Number(a.end), Number(b.end));
    return Math.max(0, end - start);
  }

  function findDocumentSpeedConflict(doc, sector) {
    if (!isDocumentSpeedRuleUsable(doc)) return null;
    var baseRules = getEMapSpeedRulesForSector(sector, doc.coordinate, doc.end);
    var best = null;
    for (var i = 0; i < baseRules.length; i++) {
      var base = baseRules[i];
      var overlap = getRuleOverlapLength(doc, base);
      if (overlap <= 0) continue;
      var docSpeed = getSpeedRuleValue(doc);
      var baseSpeed = getSpeedRuleValue(base);
      if (!isFinite(docSpeed) || !isFinite(baseSpeed)) continue;
      if (Math.abs(docSpeed - baseSpeed) < 1) continue;
      if (!best || overlap > best.overlap) {
        best = {
          speed: baseSpeed,
          source: base.source,
          name: base.name,
          overlap: overlap,
          delta: docSpeed - baseSpeed
        };
      }
    }
    return best;
  }

  function getSpeedDocsConflictSummary() {
    var result = {
      checkedRules: 0,
      conflicts: 0,
      sectors: 0
    };
    var bySector = tracker.speedDocsBySector || {};
    var conflictSectors = {};
    Object.keys(bySector).forEach(function(sectorKey) {
      var sectorRules = bySector[sectorKey] || [];
      var sector = Number(sectorKey);
      for (var i = 0; i < sectorRules.length; i++) {
        var doc = sectorRules[i];
        if (!isDocumentSpeedRuleUsable(doc)) continue;
        result.checkedRules++;
        if (findDocumentSpeedConflict(doc, sector)) {
          result.conflicts++;
          conflictSectors[sectorKey] = true;
        }
      }
    });
    result.sectors = Object.keys(conflictSectors).length;
    return result;
  }

  function getSpeedDocsConflictItems(limit) {
    var items = [];
    var bySector = tracker.speedDocsBySector || {};
    var projection = getCurrentProjectionForForm();
    var currentSectorKey = projection && isRealNumber(projection.sector) ? getSectorKey(projection.sector) : '';
    var currentCoordinate = projection && isRealNumber(projection.lineCoordinate) ? projection.lineCoordinate : NaN;
    Object.keys(bySector).forEach(function(sectorKey) {
      var sectorRules = bySector[sectorKey] || [];
      var sector = Number(sectorKey);
      for (var i = 0; i < sectorRules.length; i++) {
        var doc = sectorRules[i];
        if (!isDocumentSpeedRuleUsable(doc)) continue;
        var conflict = findDocumentSpeedConflict(doc, sector);
        if (!conflict) continue;
        var midpoint = (doc.coordinate + doc.end) / 2;
        items.push({
          id: doc.id || (sectorKey + '-' + doc.coordinate + '-' + doc.end + '-' + doc.speed),
          sector: sector,
          sectorKey: sectorKey,
          coordinate: doc.coordinate,
          end: doc.end,
          midpoint: midpoint,
          docSpeed: getSpeedRuleValue(doc),
          ekSpeed: conflict.speed,
          delta: conflict.delta,
          conflict: conflict,
          doc: doc,
          isCurrentSector: currentSectorKey && sectorKey === currentSectorKey,
          distance: isFinite(currentCoordinate) && sectorKey === currentSectorKey ? Math.abs(midpoint - currentCoordinate) : Infinity
        });
      }
    });
    items.sort(function(a, b) {
      if (a.isCurrentSector !== b.isCurrentSector) return a.isCurrentSector ? -1 : 1;
      if (a.isCurrentSector && b.isCurrentSector && Math.abs(a.distance - b.distance) > 1) return a.distance - b.distance;
      if (a.sector !== b.sector) return a.sector - b.sector;
      return a.coordinate - b.coordinate || a.docSpeed - b.docSpeed;
    });
    if (isFinite(Number(limit)) && Number(limit) > 0 && items.length > Number(limit)) {
      return items.slice(0, Number(limit));
    }
    return items;
  }

  function formatSpeedDocConflictLine(item) {
    var direction = item.delta < 0 ? 'строже на ' : 'выше на ';
    return 'ДОК ' + Math.round(item.docSpeed) +
      ' · ЭК ' + Math.round(item.ekSpeed) +
      ' · ' + direction + Math.abs(Math.round(item.delta));
  }

  function getConflictCard() {
    if (tracker.conflictCard && tracker.conflictCard.root && tracker.conflictCard.root.parentNode) {
      return tracker.conflictCard;
    }
    var shell = byId('poekhaliModeShell');
    if (!shell) return null;

    var root = document.createElement('div');
    root.id = 'poekhaliConflictCard';
    root.className = 'poekhali-conflict-card hidden';
    root.setAttribute('aria-live', 'polite');

    var content = document.createElement('div');
    content.className = 'poekhali-conflict-card-content';
    root.appendChild(content);
    shell.appendChild(root);

    tracker.conflictCard = {
      root: root,
      content: content
    };
    return tracker.conflictCard;
  }

  function createConflictMetric(labelText, valueText, tone) {
    var cell = document.createElement('div');
    cell.className = 'poekhali-conflict-metric';
    if (tone) cell.classList.add('is-' + tone);
    var label = document.createElement('span');
    label.textContent = labelText;
    var value = document.createElement('strong');
    value.textContent = valueText || '—';
    cell.appendChild(label);
    cell.appendChild(value);
    return cell;
  }

  function renderActiveSpeedConflictCard() {
    var card = getConflictCard();
    if (!card) return;
    clearElement(card.content);
    var item = tracker.activeSpeedConflict;
    if (!item) {
      card.root.classList.add('hidden');
      return;
    }

    var head = document.createElement('div');
    head.className = 'poekhali-conflict-card-head';
    var titleWrap = document.createElement('div');
    var title = document.createElement('strong');
    title.textContent = 'Конфликт ЭК/ДОК';
    var subtitle = document.createElement('span');
    subtitle.textContent = 'Участок ' + item.sector + ' · ' + formatLineCoordinate(item.coordinate) + ' — ' + formatLineCoordinate(item.end);
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'poekhali-conflict-card-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Закрыть карточку конфликта');
    closeBtn.addEventListener('click', closeActiveSpeedConflict);
    head.appendChild(titleWrap);
    head.appendChild(closeBtn);

    var grid = document.createElement('div');
    grid.className = 'poekhali-conflict-metrics';
    grid.appendChild(createConflictMetric('ДОК', Math.round(item.docSpeed), item.delta < 0 ? 'warning' : 'info'));
    grid.appendChild(createConflictMetric('ЭК', Math.round(item.ekSpeed), 'muted'));
    grid.appendChild(createConflictMetric('Разница', (item.delta > 0 ? '+' : '') + Math.round(item.delta), item.delta < 0 ? 'warning' : 'info'));
    var review = getSpeedDocRuleReview(item.doc);
    grid.appendChild(createConflictMetric('Сверка', getSpeedDocReviewLabel(review), getSpeedDocReviewTone(review)));

    var note = document.createElement('div');
    note.className = 'poekhali-conflict-card-note';
    note.textContent = 'В движении применяется документная скорость: слой ДОК имеет приоритет выше старой карты ЭК.';

    var fragment = document.createElement('div');
    fragment.className = 'poekhali-conflict-card-fragment';
    var fragmentLabel = document.createElement('span');
    fragmentLabel.textContent = 'Исходная строка';
    var fragmentText = document.createElement('b');
    fragmentText.textContent = item.doc.note || 'не сохранена в индексе';
    fragment.appendChild(fragmentLabel);
    fragment.appendChild(fragmentText);

    var source = document.createElement('div');
    source.className = 'poekhali-conflict-card-source';
    source.textContent = (item.doc.sourceName || 'Документ') +
      (item.doc.sourceUpdatedAt ? ' · ' + item.doc.sourceUpdatedAt : '') +
      (item.doc.page ? ' · стр. ' + item.doc.page : '') +
      (review.updatedAt ? ' · сверка ' + formatLearningTime(review.updatedAt) : '');

    var actions = document.createElement('div');
    actions.className = 'poekhali-conflict-card-actions';
    var sourceBtn = document.createElement('button');
    sourceBtn.type = 'button';
    sourceBtn.className = 'poekhali-secondary-action';
    sourceBtn.textContent = item.doc.sourcePath ? 'Открыть PDF' : 'PDF не найден';
    sourceBtn.disabled = !item.doc.sourcePath;
    sourceBtn.addEventListener('click', function() {
      openSpeedDocSource(item.doc);
    });
    var okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = review.status === 'verified' ? 'poekhali-secondary-action' : 'poekhali-primary-action';
    okBtn.textContent = review.status === 'verified' ? 'Снять OK' : 'Сверено OK';
    okBtn.addEventListener('click', function() {
      setSpeedDocRuleReview(item.doc, review.status === 'verified' ? 'pending' : 'verified');
      renderActiveSpeedConflictCard();
      if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) renderOpsSheet();
    });
    var problemBtn = document.createElement('button');
    problemBtn.type = 'button';
    problemBtn.className = 'poekhali-warning-delete';
    problemBtn.textContent = review.status === 'problem' ? 'Снять ошибку' : 'Ошибка парсера';
    problemBtn.addEventListener('click', function() {
      setSpeedDocRuleReview(item.doc, review.status === 'problem' ? 'pending' : 'problem');
      renderActiveSpeedConflictCard();
      if (tracker.opsSheet && tracker.opsSheet.root && !tracker.opsSheet.root.classList.contains('hidden')) renderOpsSheet();
    });
    actions.appendChild(sourceBtn);
    actions.appendChild(okBtn);
    actions.appendChild(problemBtn);

    card.content.appendChild(head);
    card.content.appendChild(grid);
    card.content.appendChild(note);
    card.content.appendChild(fragment);
    card.content.appendChild(source);
    card.content.appendChild(actions);
    card.root.classList.remove('hidden');
  }

  function closeActiveSpeedConflict() {
    tracker.activeSpeedConflict = null;
    renderActiveSpeedConflictCard();
  }

  function focusSpeedDocConflict(item) {
    if (!item) return;
    tracker.activeSpeedConflict = item;
    setPreviewProjection({
      lineCoordinate: item.midpoint,
      sector: item.sector
    }, true);
    closeOpsSheet();
    renderActiveSpeedConflictCard();
    requestDraw();
  }

  function appendDocumentSpeedRules(rules, left, right, sector) {
    var docs = getDocumentSpeedRulesForSector(sector, left, right);
    for (var i = 0; i < docs.length; i++) {
      var doc = docs[i];
      var conflict = findDocumentSpeedConflict(doc, sector);
      rules.push({
        coordinate: doc.coordinate,
        length: doc.length,
        end: doc.end,
        speed: doc.speed,
        name: doc.name,
        note: doc.note,
        source: 'document',
        sourceName: doc.sourceName,
        sourceCode: doc.sourceCode,
        sourceUpdatedAt: doc.sourceUpdatedAt,
        sourcePath: doc.sourcePath,
        appliesTo: doc.appliesTo,
        confidence: doc.confidence,
        page: doc.page,
        conflict: conflict
      });
    }
  }

  function appendRegimeSpeedRules(rules, left, right, sector) {
    var regimeRules = getRegimeSpeedRulesForSector(sector, left, right);
    for (var i = 0; i < regimeRules.length; i++) {
      var rule = regimeRules[i];
      rules.push({
        coordinate: rule.coordinate,
        length: rule.length,
        end: rule.end,
        speed: rule.speed,
        name: rule.name || 'РК',
        note: rule.note,
        source: 'regime',
        sourceName: rule.sourceName,
        sourceCode: rule.sourceCode,
        sourceUpdatedAt: rule.sourceUpdatedAt,
        sourcePath: rule.sourcePath,
        confidence: rule.confidence,
        page: rule.page
      });
    }
  }

  function getEMapProfilePointsForSector(sector) {
    return tracker.profileBySector[getSectorKey(sector)] || [];
  }

  function getProfilePointsForSector(sector) {
    var direct = getEMapProfilePointsForSector(sector);
    if (direct.length) return direct;
    var user = getUserProfilePointsForSector(sector);
    if (user.length) return user;
    var learned = getLearnedProfilePointsForSector(sector);
    if (learned.length) return learned;
    var regime = getRegimeProfilePointsForSector(sector);
    if (regime.length) return regime;
    return getRawDraftProfilePointsForSector(sector);
  }

  function getVisibleProfile(center, halfWindow, sector) {
    var left = center - halfWindow;
    var right = center + halfWindow;
    var source = getProfilePointsForSector(sector);
    var result = [];
    for (var i = 0; i < source.length; i++) {
      var p = source[i];
      if (p.end < left) continue;
      if (p.start > right) break;
      result.push(p);
    }
    return result;
  }

  function getCurrentProfilePoint(lineCoordinate, sector) {
    var source = getProfilePointsForSectorOrFallback(sector);
    for (var i = 0; i < source.length; i++) {
      var p = source[i];
      if (lineCoordinate >= p.start && lineCoordinate <= p.end) return p;
      if (p.start > lineCoordinate) break;
    }
    return null;
  }

  function getProfileElevationAt(lineCoordinate, sector) {
    var point = getCurrentProfilePoint(lineCoordinate, sector);
    if (!point) return null;
    var ratio = clamp((lineCoordinate - point.start) / point.length, 0, 1);
    return point.elevationStart + (point.elevationEnd - point.elevationStart) * ratio;
  }

  function findStationContext(center, objects) {
    var best = null;
    for (var i = 0; i < objects.length; i++) {
      var item = objects[i];
      if (item.type !== '2') continue;
      var distance = center >= item.coordinate && center <= item.end
        ? 0
        : Math.min(Math.abs(center - item.coordinate), Math.abs(center - item.end));
      if (!best || distance < best.distance) {
        best = {
          item: item,
          distance: distance
        };
      }
    }
    return best ? best.item : null;
  }

  function findNextSignal(center, sector) {
    var objects = getTrackObjectsForSector(sector);
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].type === '1' && objects[i].coordinate >= center) return objects[i];
    }
    return null;
  }

  function findActiveSpeedRule(center, speedRules) {
    var best = null;
    for (var i = 0; i < speedRules.length; i++) {
      var rule = speedRules[i];
      if (center < rule.coordinate || center > rule.end) continue;
      if (!best) {
        best = rule;
        continue;
      }
      var rulePriority = getSpeedRulePriority(rule);
      var bestPriority = getSpeedRulePriority(best);
      if (rulePriority > bestPriority) {
        best = rule;
        continue;
      }
      if (rulePriority < bestPriority) continue;
      var ruleSpeed = getSpeedRuleValue(rule);
      var bestSpeed = getSpeedRuleValue(best);
      if (isFinite(ruleSpeed) && isFinite(bestSpeed) && Math.abs(ruleSpeed - bestSpeed) > 0.1) {
        if (ruleSpeed < bestSpeed) best = rule;
        continue;
      }
      if (rule.coordinate > best.coordinate) best = rule;
    }
    return best;
  }

  function getSpeedRulePriority(rule) {
    if (!rule) return 0;
    if (rule.source === 'warning') return 50;
    if (rule.source === 'document') return 40;
    if (rule.source === 'regime') return 30;
    if (rule.source === 'object') return 20;
    if (rule.source === 'speed') return 10;
    return 1;
  }

  function getSpeedRulePrefix(rule) {
    if (!rule) return 'ОГР';
    if (rule.source === 'warning') return 'ПР';
    if (rule.source === 'document') return 'ДОК';
    if (rule.source === 'regime') return 'РК';
    if (rule.source === 'user') return 'GPS';
    return 'СКОР';
  }

  function formatSpeedRuleDisplay(rule) {
    if (!rule) return '—';
    return getSpeedRulePrefix(rule) + ' ' + formatSpeedLabel(rule);
  }

  function xForCoordinate(value, center, centerX) {
    return centerX + (value - center) / TRACK_METERS_PER_PIXEL;
  }

  function formatSpeedLabel(rule) {
    var value = isFinite(rule.speed) ? Math.round(rule.speed) : String(rule.name || '').replace(/\D+/g, '');
    return value ? String(value) : String(rule.name || '');
  }

  function getSpeedRuleValue(rule) {
    if (!rule) return NaN;
    if (isFinite(rule.speed)) return Number(rule.speed);
    return parseNumber(formatSpeedLabel(rule));
  }

  function normalizeActiveRestriction(rule, projection) {
    if (!rule || !projection || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return null;
    var speed = getSpeedRuleValue(rule);
    if (!isFinite(speed) || speed <= 0) return null;
    var start = Math.max(0, Math.round(Number(rule.coordinate) || 0));
    var end = Math.max(start, Math.round(Number(rule.end) || start + Math.max(0, Number(rule.length) || 0)));
    var coordinate = Math.max(0, Math.round(Number(projection.lineCoordinate) || 0));
    var distanceToEnd = tracker.even
      ? Math.max(0, end - coordinate)
      : Math.max(0, coordinate - start);
    var prefix = getSpeedRulePrefix(rule);
    return {
      label: prefix + ' ' + formatSpeedLabel(rule),
      source: String(rule.source || ''),
      sourceLabel: prefix,
      speedKmh: Math.max(0, Math.round(speed)),
      sector: Math.max(0, Math.round(Number(projection.sector) || 0)),
      start: start,
      end: end,
      distanceToEnd: Math.max(0, Math.round(distanceToEnd)),
      conflict: !!rule.conflict,
      updatedAt: new Date().toISOString()
    };
  }

  function resolveActiveRestrictionForProjection(projection) {
    if (!projection || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return null;
    var center = projection.lineCoordinate;
    var sector = projection.sector;
    var left = center - 250;
    var right = center + 250;
    var visibleObjects = getTrackObjectsInWindow(left, right, sector);
    var speedRules = getSpeedRulesInWindow(left, right, sector, visibleObjects);
    return normalizeActiveRestriction(findActiveSpeedRule(center, speedRules), projection);
  }

  function findNextSpeedRule(center, speedRules) {
    var best = null;
    for (var i = 0; i < speedRules.length; i++) {
      var rule = speedRules[i];
      if (!rule || center >= rule.coordinate && center <= rule.end) continue;
      var anchor = tracker.even ? rule.coordinate : rule.end;
      var distance = tracker.even ? anchor - center : center - anchor;
      if (!isFinite(distance) || distance < 0) continue;
      if (!best) {
        best = { rule: rule, anchor: anchor, distance: distance };
        continue;
      }
      if (distance < best.distance - 5) {
        best = { rule: rule, anchor: anchor, distance: distance };
        continue;
      }
      if (Math.abs(distance - best.distance) > 5) continue;
      var rulePriority = getSpeedRulePriority(rule);
      var bestPriority = getSpeedRulePriority(best.rule);
      if (rulePriority > bestPriority) {
        best = { rule: rule, anchor: anchor, distance: distance };
        continue;
      }
      if (rulePriority < bestPriority) continue;
      var ruleSpeed = getSpeedRuleValue(rule);
      var bestSpeed = getSpeedRuleValue(best.rule);
      if (isFinite(ruleSpeed) && isFinite(bestSpeed) && ruleSpeed < bestSpeed) {
        best = { rule: rule, anchor: anchor, distance: distance };
      }
    }
    return best;
  }

  function normalizeNextRestriction(match, projection) {
    if (!match || !match.rule || !projection || !isRealNumber(projection.sector)) return null;
    var rule = match.rule;
    var speed = getSpeedRuleValue(rule);
    if (!isFinite(speed) || speed <= 0) return null;
    var prefix = getSpeedRulePrefix(rule);
    var anchor = Math.max(0, Math.round(Number(match.anchor) || 0));
    var distance = Math.max(0, Math.round(Number(match.distance) || 0));
    return {
      label: prefix + ' ' + formatSpeedLabel(rule),
      source: String(rule.source || ''),
      sourceLabel: prefix,
      speedKmh: Math.max(0, Math.round(speed)),
      sector: Math.max(0, Math.round(Number(projection.sector) || 0)),
      coordinate: anchor,
      distance: distance,
      conflict: !!rule.conflict,
      updatedAt: new Date().toISOString()
    };
  }

  function resolveNextRestrictionForProjection(projection, speedRules) {
    if (!projection || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return null;
    var center = projection.lineCoordinate;
    var sector = projection.sector;
    var rules = speedRules;
    if (!Array.isArray(rules)) {
      var left = tracker.even ? center - 250 : center - NEXT_RESTRICTION_LOOKAHEAD_M;
      var right = tracker.even ? center + NEXT_RESTRICTION_LOOKAHEAD_M : center + 250;
      var visibleObjects = getTrackObjectsInWindow(left, right, sector);
      rules = getSpeedRulesInWindow(left, right, sector, visibleObjects);
    }
    return normalizeNextRestriction(findNextSpeedRule(center, rules), projection);
  }

  function applyActiveRestrictionToRun(run, projection, activeRestriction) {
    if (!run) return null;
    var active = activeRestriction || resolveActiveRestrictionForProjection(projection || getCurrentProjectionForForm());
    run.activeRestrictionLabel = active ? active.label : '';
    run.activeRestrictionSource = active ? active.source : '';
    run.activeRestrictionSpeedKmh = active ? active.speedKmh : 0;
    run.activeRestrictionSector = active ? active.sector : 0;
    run.activeRestrictionStart = active ? active.start : 0;
    run.activeRestrictionEnd = active ? active.end : 0;
    run.activeRestrictionDistanceToEnd = active ? active.distanceToEnd : 0;
    run.activeRestrictionUpdatedAt = active ? active.updatedAt : '';
    return active;
  }

  function applyNextRestrictionToRun(run, projection, nextRestriction) {
    if (!run) return null;
    var next = nextRestriction || resolveNextRestrictionForProjection(projection || getCurrentProjectionForForm());
    run.nextRestrictionLabel = next ? next.label : '';
    run.nextRestrictionSource = next ? next.source : '';
    run.nextRestrictionSpeedKmh = next ? next.speedKmh : 0;
    run.nextRestrictionSector = next ? next.sector : 0;
    run.nextRestrictionCoordinate = next ? next.coordinate : 0;
    run.nextRestrictionDistanceMeters = next ? next.distance : 0;
    run.nextRestrictionUpdatedAt = next ? next.updatedAt : '';
    return next;
  }

  function getTrackObjectSourceLabel(item) {
    var source = String(item && item.source || '').trim();
    if (source === 'regime') return 'РК';
    if (source === 'user') return 'GPS';
    return 'ЭК';
  }

  function getObjectApproachAnchor(item, center) {
    if (!item || !isFinite(item.coordinate)) return null;
    var start = Math.max(0, Math.round(Number(item.coordinate) || 0));
    var end = Math.max(start, Math.round(Number(item.end) || start));
    if (item.type === '2' && center >= start && center <= end) return center;
    return tracker.even ? start : end;
  }

  function findNextTrackObjectForDirection(center, sector, type) {
    if (!isRealNumber(sector) || !isFinite(center)) return null;
    var objects = getTrackObjectsForSector(sector).filter(function(item) {
      return item && item.type === type && isFinite(item.coordinate);
    }).sort(function(a, b) {
      return a.coordinate - b.coordinate;
    });
    var best = null;
    for (var i = 0; i < objects.length; i++) {
      var item = objects[i];
      var anchor = getObjectApproachAnchor(item, center);
      if (anchor === null || !isFinite(anchor)) continue;
      var distance = tracker.even ? anchor - center : center - anchor;
      if (item.type === '2' && center >= item.coordinate && center <= item.end) distance = 0;
      if (!isFinite(distance) || distance < 0) continue;
      if (!best || distance < best.distance) {
        best = {
          item: item,
          anchor: anchor,
          distance: distance
        };
      }
    }
    return best;
  }

  function normalizeNavigationObject(match, projection) {
    if (!match || !match.item || !projection || !isRealNumber(projection.sector)) return null;
    var item = match.item;
    var name = String(item.name || '').trim();
    if (!name) return null;
    var kind = item.type === '1' ? 'signal' : 'station';
    var anchor = Math.max(0, Math.round(Number(match.anchor) || 0));
    var distance = Math.max(0, Math.round(Number(match.distance) || 0));
    return {
      kind: kind,
      name: name,
      source: getTrackObjectSourceLabel(item),
      sector: Math.max(0, Math.round(Number(projection.sector) || 0)),
      coordinate: anchor,
      distance: distance,
      updatedAt: new Date().toISOString()
    };
  }

  function resolveNextSignalForProjection(projection) {
    if (!projection || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return null;
    return normalizeNavigationObject(
      findNextTrackObjectForDirection(projection.lineCoordinate, projection.sector, '1'),
      projection
    );
  }

  function resolveNextStationForProjection(projection) {
    if (!projection || !isRealNumber(projection.lineCoordinate) || !isRealNumber(projection.sector)) return null;
    return normalizeNavigationObject(
      findNextTrackObjectForDirection(projection.lineCoordinate, projection.sector, '2'),
      projection
    );
  }

  function applyNextTrackObjectsToRun(run, projection, nextSignal, nextStation) {
    if (!run) return {
      signal: null,
      station: null
    };
    var sourceProjection = projection || getCurrentProjectionForForm();
    var signal = nextSignal || resolveNextSignalForProjection(sourceProjection);
    var station = nextStation || resolveNextStationForProjection(sourceProjection);
    run.nextSignalName = signal ? signal.name : '';
    run.nextSignalSource = signal ? signal.source : '';
    run.nextSignalSector = signal ? signal.sector : 0;
    run.nextSignalCoordinate = signal ? signal.coordinate : 0;
    run.nextSignalDistanceMeters = signal ? signal.distance : 0;
    run.nextStationName = station ? station.name : '';
    run.nextStationSource = station ? station.source : '';
    run.nextStationSector = station ? station.sector : 0;
    run.nextStationCoordinate = station ? station.coordinate : 0;
    run.nextStationDistanceMeters = station ? station.distance : 0;
    return {
      signal: signal,
      station: station
    };
  }

  function getRouteProgressAnchor(station, even, role) {
    if (!station || !isFinite(station.coordinate)) return null;
    var start = Math.max(0, Math.round(Number(station.coordinate) || 0));
    var end = Math.max(start, Math.round(Number(station.end) || start));
    if (role === 'from') return even ? start : end;
    return even ? start : end;
  }

  function resolveRouteProgressForProjection(projection, suggestion) {
    var item = suggestion || getShiftRouteSuggestion();
    if (!item || item.status !== 'ready' || !projection || !isRealNumber(projection.lineCoordinate)) return null;
    if (isRealNumber(item.sector) && isRealNumber(projection.sector) && getSectorKey(item.sector) !== getSectorKey(projection.sector)) return null;
    var even = !!item.even;
    var start = getRouteProgressAnchor(item.fromStation, even, 'from');
    var finish = getRouteProgressAnchor(item.toStation, even, 'to');
    if (!isFinite(start) || !isFinite(finish) || Math.abs(finish - start) < 1) return null;
    var total = Math.abs(finish - start);
    var current = Math.max(0, Math.round(Number(projection.lineCoordinate) || 0));
    var rawPassed = even ? current - start : start - current;
    var passed = rawPassed;
    var status = 'route';
    var outside = 0;
    if (passed < 0) {
      status = 'before';
      outside = Math.abs(passed);
      passed = 0;
    } else if (passed > total) {
      status = 'after';
      outside = passed - total;
      passed = total;
    }
    var remaining = Math.max(0, total - passed);
    var progress = total > 0 ? Math.max(0, Math.min(100, passed / total * 100)) : 0;
    return {
      fromName: String(item.fromStation && item.fromStation.name || item.fromText || '').trim(),
      toName: String(item.toStation && item.toStation.name || item.toText || '').trim(),
      status: status,
      fromCoordinate: Math.round(start),
      toCoordinate: Math.round(finish),
      currentCoordinate: Math.round(current),
      directionEven: even,
      distanceMeters: Math.round(total),
      passedMeters: Math.round(passed),
      remainingMeters: Math.round(remaining),
      outsideMeters: Math.round(outside),
      progressPct: Math.round(progress * 10) / 10,
      updatedAt: new Date().toISOString()
    };
  }

  function applyRouteProgressToRun(run, projection, routeProgress) {
    if (!run) return null;
    var progress = routeProgress || resolveRouteProgressForProjection(projection || getCurrentProjectionForForm());
    run.routeFromName = progress ? progress.fromName : '';
    run.routeToName = progress ? progress.toName : '';
    run.routeStatus = progress ? progress.status : '';
    run.routeFromCoordinate = progress ? progress.fromCoordinate : 0;
    run.routeToCoordinate = progress ? progress.toCoordinate : 0;
    run.routeDistanceMeters = progress ? progress.distanceMeters : 0;
    run.routePassedMeters = progress ? progress.passedMeters : 0;
    run.routeRemainingMeters = progress ? progress.remainingMeters : 0;
    run.routeOutsideMeters = progress ? progress.outsideMeters : 0;
    run.routeProgressPct = progress ? progress.progressPct : 0;
    return progress;
  }

  function estimateEtaSeconds(distanceMeters, speedKmh) {
    var distance = Math.max(0, Math.round(Number(distanceMeters) || 0));
    var speed = Math.max(0, Number(speedKmh) || 0);
    if (!distance) return 0;
    if (speed < 3) return 0;
    return Math.max(1, Math.round(distance / (speed / 3.6)));
  }

  function getCurrentEtaSpeedKmh(fallbackSpeedKmh) {
    var fallback = Number(fallbackSpeedKmh);
    if (isFinite(fallback) && fallback > 0) return fallback;
    return Math.max(0, (Number(tracker.speedMps) || 0) * 3.6);
  }

  function applyNavigationEtaToRun(run, speedKmh) {
    if (!run) return run;
    var speed = getCurrentEtaSpeedKmh(speedKmh);
    run.nextRestrictionEtaSeconds = estimateEtaSeconds(run.nextRestrictionDistanceMeters, speed);
    run.nextSignalEtaSeconds = estimateEtaSeconds(run.nextSignalDistanceMeters, speed);
    run.nextStationEtaSeconds = estimateEtaSeconds(run.nextStationDistanceMeters, speed);
    var routeDistance = 0;
    if (run.routeStatus === 'before') {
      routeDistance = Math.max(0, Math.round(Number(run.routeOutsideMeters) || 0));
    } else if (run.routeStatus === 'route') {
      routeDistance = Math.max(0, Math.round(Number(run.routeRemainingMeters) || 0));
    }
    run.routeEtaSeconds = estimateEtaSeconds(routeDistance, speed);
    return run;
  }

  function getNavigationTargetPriority(kind) {
    if (kind === 'restriction_end') return 70;
    if (kind === 'warning') return 65;
    if (kind === 'restriction') return 60;
    if (kind === 'signal') return 45;
    if (kind === 'station') return 40;
    if (kind === 'route_start') return 30;
    if (kind === 'route_finish') return 25;
    return 10;
  }

  function normalizeNavigationTargetCandidate(candidate) {
    if (!candidate) return null;
    var label = String(candidate.label || '').trim();
    if (!label) return null;
    var distance = Math.max(0, Math.round(Number(candidate.distanceMeters) || 0));
    var coordinate = Math.max(0, Math.round(Number(candidate.coordinate) || 0));
    return {
      kind: String(candidate.kind || 'target'),
      label: label,
      source: String(candidate.source || ''),
      sector: Math.max(0, Math.round(Number(candidate.sector) || 0)),
      coordinate: coordinate,
      distanceMeters: distance,
      etaSeconds: Math.max(0, Math.round(Number(candidate.etaSeconds) || 0)),
      priority: isFinite(Number(candidate.priority)) ? Number(candidate.priority) : getNavigationTargetPriority(candidate.kind),
      updatedAt: String(candidate.updatedAt || new Date().toISOString())
    };
  }

  function selectNavigationTarget(candidates) {
    var best = null;
    for (var i = 0; i < (candidates || []).length; i++) {
      var item = normalizeNavigationTargetCandidate(candidates[i]);
      if (!item) continue;
      if (!best) {
        best = item;
        continue;
      }
      if (item.distanceMeters < best.distanceMeters - 5) {
        best = item;
        continue;
      }
      if (Math.abs(item.distanceMeters - best.distanceMeters) <= 5 && item.priority > best.priority) {
        best = item;
      }
    }
    return best;
  }

  function getRestrictionTargetLabel(label, speedKmh) {
    var text = String(label || '').trim();
    var speed = Math.max(0, Math.round(Number(speedKmh) || 0));
    if (!text && speed > 0) text = speed + ' км/ч';
    if (speed > 0 && text && text.indexOf('км/ч') < 0) text += ' км/ч';
    return text;
  }

  function resolveNavigationTargetForRun(run, speedKmh) {
    if (!run) return null;
    var speed = getCurrentEtaSpeedKmh(speedKmh);
    var candidates = [];
    var activeLabel = getRestrictionTargetLabel(run.activeRestrictionLabel, run.activeRestrictionSpeedKmh);
    var activeDistance = Math.max(0, Math.round(Number(run.activeRestrictionDistanceToEnd) || 0));
    if (activeLabel && activeDistance > 0) {
      candidates.push({
        kind: 'restriction_end',
        label: 'Конец ' + activeLabel,
        source: run.activeRestrictionSource,
        sector: run.activeRestrictionSector,
        coordinate: tracker.even ? run.activeRestrictionEnd : run.activeRestrictionStart,
        distanceMeters: activeDistance,
        etaSeconds: estimateEtaSeconds(activeDistance, speed),
        updatedAt: run.activeRestrictionUpdatedAt
      });
    }
    var restrictionLabel = getRestrictionTargetLabel(run.nextRestrictionLabel, run.nextRestrictionSpeedKmh);
    if (restrictionLabel) {
      candidates.push({
        kind: run.nextRestrictionSource === 'warning' ? 'warning' : 'restriction',
        label: restrictionLabel,
        source: run.nextRestrictionSource,
        sector: run.nextRestrictionSector,
        coordinate: run.nextRestrictionCoordinate,
        distanceMeters: run.nextRestrictionDistanceMeters,
        etaSeconds: run.nextRestrictionEtaSeconds,
        updatedAt: run.nextRestrictionUpdatedAt
      });
    }
    if (run.nextSignalName) {
      candidates.push({
        kind: 'signal',
        label: run.nextSignalName,
        source: run.nextSignalSource,
        sector: run.nextSignalSector,
        coordinate: run.nextSignalCoordinate,
        distanceMeters: run.nextSignalDistanceMeters,
        etaSeconds: run.nextSignalEtaSeconds
      });
    }
    if (run.nextStationName) {
      candidates.push({
        kind: 'station',
        label: run.nextStationName,
        source: run.nextStationSource,
        sector: run.nextStationSector,
        coordinate: run.nextStationCoordinate,
        distanceMeters: run.nextStationDistanceMeters,
        etaSeconds: run.nextStationEtaSeconds
      });
    }
    var routeSector = (run.lastPoint && run.lastPoint.sector) || (run.endPoint && run.endPoint.sector) || (run.startPoint && run.startPoint.sector) || 0;
    if (run.routeDistanceMeters && run.routeStatus === 'before' && run.routeOutsideMeters > 0) {
      candidates.push({
        kind: 'route_start',
        label: 'Старт ' + (run.routeFromName || 'маршрута'),
        source: 'route',
        sector: routeSector,
        coordinate: run.routeFromCoordinate,
        distanceMeters: run.routeOutsideMeters,
        etaSeconds: run.routeEtaSeconds
      });
    } else if (run.routeDistanceMeters && run.routeStatus === 'route' && run.routeRemainingMeters > 0) {
      candidates.push({
        kind: 'route_finish',
        label: 'Финиш ' + (run.routeToName || 'маршрута'),
        source: 'route',
        sector: routeSector,
        coordinate: run.routeToCoordinate,
        distanceMeters: run.routeRemainingMeters,
        etaSeconds: run.routeEtaSeconds
      });
    }
    return selectNavigationTarget(candidates);
  }

  function applyNavigationTargetToRun(run, speedKmh) {
    if (!run) return null;
    var target = resolveNavigationTargetForRun(run, speedKmh);
    run.nextTargetKind = target ? target.kind : '';
    run.nextTargetLabel = target ? target.label : '';
    run.nextTargetSource = target ? target.source : '';
    run.nextTargetSector = target ? target.sector : 0;
    run.nextTargetCoordinate = target ? target.coordinate : 0;
    run.nextTargetDistanceMeters = target ? target.distanceMeters : 0;
    run.nextTargetEtaSeconds = target ? target.etaSeconds : 0;
    run.nextTargetUpdatedAt = target ? target.updatedAt : '';
    return target;
  }

  function normalizeSpeedRules(rules) {
    var sorted = (rules || []).filter(function(rule) {
      return rule && isFinite(rule.coordinate) && isFinite(rule.end) && rule.end >= rule.coordinate;
    }).slice().sort(function(a, b) {
      return a.coordinate - b.coordinate || getSpeedRuleValue(a) - getSpeedRuleValue(b);
    });
    var result = [];
    for (var i = 0; i < sorted.length; i++) {
      var rule = sorted[i];
      var speed = getSpeedRuleValue(rule);
      var merged = false;
      for (var j = result.length - 1; j >= 0; j--) {
        var existing = result[j];
        var existingSpeed = getSpeedRuleValue(existing);
        if (Math.abs(existingSpeed - speed) > 0.1) continue;
        if (rule.source !== existing.source) continue;
        if (rule.source === 'warning') continue;
        if (rule.coordinate > existing.end + 35 || existing.coordinate > rule.end + 35) continue;
        existing.coordinate = Math.min(existing.coordinate, rule.coordinate);
        existing.end = Math.max(existing.end, rule.end);
        existing.length = Math.max(0, existing.end - existing.coordinate);
        if (!existing.name && rule.name) existing.name = rule.name;
        if (!existing.note && rule.note) existing.note = rule.note;
        if (!existing.sourceName && rule.sourceName) existing.sourceName = rule.sourceName;
        if (!existing.sourceUpdatedAt && rule.sourceUpdatedAt) existing.sourceUpdatedAt = rule.sourceUpdatedAt;
        if (!existing.conflict && rule.conflict) existing.conflict = rule.conflict;
        merged = true;
        break;
      }
      if (!merged) {
        result.push({
          coordinate: rule.coordinate,
          length: rule.length,
          end: rule.end,
          speed: rule.speed,
          name: rule.name,
          note: rule.note,
          source: rule.source,
          sourceName: rule.sourceName,
          sourceCode: rule.sourceCode,
          sourceUpdatedAt: rule.sourceUpdatedAt,
          sourcePath: rule.sourcePath,
          appliesTo: rule.appliesTo,
          confidence: rule.confidence,
          page: rule.page,
          conflict: rule.conflict
        });
      }
    }
    return result;
  }

  function getDirectionMultiplier() {
    return tracker.even ? 1 : -1;
  }

  function getProfilePointsForSectorOrFallback(sector) {
    var source = getProfilePointsForSector(sector);
    if (source.length) return source;
    return getProfilePointsForSector(0);
  }

  function getVisualTrainLengthMeters(trainMeters, isPreview) {
    var lengthMeters = Math.max(1, Math.round(Number(trainMeters) || getTrainLengthMeters()));
    var cap = isPreview ? 260 : 330;
    return Math.min(lengthMeters, cap);
  }

  function getTrainTailGuideLengthMeters(trainMeters, visualMeters, isPreview) {
    var lengthMeters = Math.max(1, Math.round(Number(trainMeters) || getTrainLengthMeters()));
    if (lengthMeters <= visualMeters + 40) return 0;
    return Math.min(lengthMeters, visualMeters + (isPreview ? 220 : 360));
  }

  function getApkTrackerLayout(w, h) {
    var xUnit = Math.max(4.2, Math.min(7.2, w / APK_VISIBLE_PICKETS));
    var viewportWidth = Math.min(w, xUnit * APK_VISIBLE_PICKETS);
    var viewportX = Math.round((w - viewportWidth) / 2);
    var coordBottom = Math.max(124, getPoekhaliTopStackBottom() + 12);
    var navReserve = 118;
    var scaleY = Math.round(Math.min(h - navReserve - 108, Math.max(coordBottom + 308, h * 0.63)));
    if (!isFinite(scaleY) || scaleY < coordBottom + 244) scaleY = Math.round(h * 0.65);

    var profileTop = Math.max(248, coordBottom + 104);
    var profileBottom = scaleY - Math.max(28, xUnit * 5.1);
    if (profileBottom < profileTop + 116) {
      profileBottom = Math.min(scaleY - 72, profileTop + 142);
    }
    if (profileBottom <= profileTop) {
      profileTop = Math.max(182, scaleY - 220);
      profileBottom = scaleY - 78;
    }

    var oneMeter = xUnit / 100;
    var headX = Math.round(viewportX + xUnit * 26);
    var trainWidth = Math.max(xUnit * 14, getVisualTrainLengthMeters(getTrainLengthMeters(), false) * oneMeter);
    var trainHeight = Math.max(16, Math.round(xUnit * 3.2));
    var bottomTextY = Math.min(h - navReserve - 24, scaleY + 88);
    var speedTopY = Math.max(coordBottom + 48, profileTop - 58);
    var speedRailY = speedTopY + 50;

    return {
      canvasWidth: w,
      canvasHeight: h,
      xUnit: xUnit,
      oneMeter: oneMeter,
      viewportX: viewportX,
      viewportWidth: viewportWidth,
      viewportRight: viewportX + viewportWidth,
      direction: getDirectionMultiplier(),
      headX: headX,
      trackY: scaleY,
      profileTop: profileTop,
      profileBottom: profileBottom,
      speedTopY: speedTopY,
      speedRailY: speedRailY,
      bottomTextY: bottomTextY,
      navReserve: navReserve,
      trainWidth: trainWidth,
      trainHeight: trainHeight
    };
  }

  function coordinateToApkX(coordinate, center, layout) {
    return layout.headX + (coordinate - center) * layout.oneMeter * layout.direction;
  }

  function coordinateAtApkX(x, center, layout) {
    return center + (x - layout.headX) / (layout.oneMeter * layout.direction);
  }

  function getApkVisibleBounds(center, layout) {
    var leftCoordinate = coordinateAtApkX(layout.viewportX - layout.xUnit, center, layout);
    var rightCoordinate = coordinateAtApkX(layout.viewportRight + layout.xUnit, center, layout);
    return {
      left: Math.min(leftCoordinate, rightCoordinate),
      right: Math.max(leftCoordinate, rightCoordinate)
    };
  }

  function getTrackObjectsInWindow(left, right, sector) {
    return getTrackObjectsForSector(sector).filter(function(item) {
      return isObjectInRange(item, left, right);
    });
  }

  function getSpeedRulesInWindow(left, right, sector, visibleObjects) {
    var rules = visibleObjects.filter(function(item) {
      return item.type === '3';
    }).map(function(item) {
      return {
        coordinate: item.coordinate,
        length: item.length,
        end: item.end,
        speed: item.speed,
        name: item.name,
        source: 'object'
      };
    });
    var sectorSpeeds = tracker.speedLimitsBySector[getSectorKey(sector)] || [];
    for (var i = 0; i < sectorSpeeds.length; i++) {
      var speed = sectorSpeeds[i];
      if (speed.wayNumber && speed.wayNumber !== tracker.wayNumber) continue;
      if (!isObjectInRange(speed, left, right)) continue;
      rules.push({
        coordinate: speed.coordinate,
        length: speed.length,
        end: speed.end,
        speed: speed.speed,
        name: speed.name,
        source: 'speed'
      });
    }
    appendRegimeSpeedRules(rules, left, right, sector);
    appendDocumentSpeedRules(rules, left, right, sector);
    var warnings = getWarningsForSector(sector, left, right);
    for (var j = 0; j < warnings.length; j++) {
      var warning = warnings[j];
      rules.push({
        coordinate: warning.coordinate,
        length: warning.length,
        end: warning.end,
        speed: warning.speed,
        name: warning.note || 'ПР',
        note: warning.note,
        source: 'warning'
      });
    }
    rules.sort(function(a, b) {
      return a.coordinate - b.coordinate;
    });
    return normalizeSpeedRules(rules);
  }

  function getVisibleProfileSegmentsForWindow(left, right, sector) {
    var source = getProfilePointsForSectorOrFallback(sector);
    var result = [];
    for (var i = 0; i < source.length; i++) {
      var point = source[i];
      if (point.end < left) continue;
      if (point.start > right) break;
      result.push(point);
    }
    return result;
  }

  function getProfileDeltaForLength(grade, length, direction) {
    if (!isFinite(grade) || !isFinite(length) || length <= 0 || grade === 0) return 0;
    var slope = direction / Math.cos(Math.atan(Math.abs(grade)));
    return slope * Math.sign(grade) * APK_ANGLE_MULTIPLIER * (length / 100);
  }

  function getProfileVisualOffsetAt(coordinate, sector, layout) {
    var source = getProfilePointsForSectorOrFallback(sector);
    var total = 0;
    for (var i = 0; i < source.length; i++) {
      var point = source[i];
      if (coordinate <= point.start) break;
      var length = Math.min(coordinate, point.end) - point.start;
      if (length > 0) total += getProfileDeltaForLength(point.grade, length, layout.direction);
      if (coordinate <= point.end) break;
    }
    return total;
  }

  function yForProfileCoordinate(coordinate, center, sector, layout, centerVisual) {
    var height = layout.profileBottom - layout.profileTop;
    var baseline = layout.profileTop + height * 0.44;
    var y = baseline - (getProfileVisualOffsetAt(coordinate, sector, layout) - centerVisual);
    return clamp(y, layout.profileTop + 4, layout.profileBottom - 4);
  }

  function getProfileYAt(coordinate, center, sector, layout) {
    return yForProfileCoordinate(
      coordinate,
      center,
      sector,
      layout,
      getProfileVisualOffsetAt(center, sector, layout)
    );
  }

  function getProfileTangentAngle(coordinate, center, sector, layout) {
    var span = 45;
    var x1 = coordinateToApkX(coordinate - span, center, layout);
    var x2 = coordinateToApkX(coordinate + span, center, layout);
    var y1 = getProfileYAt(coordinate - span, center, sector, layout);
    var y2 = getProfileYAt(coordinate + span, center, sector, layout);
    return Math.atan2(y2 - y1, x2 - x1);
  }

  function collectProfileCoordinates(start, end, sector) {
    var left = Math.min(start, end);
    var right = Math.max(start, end);
    var points = {};
    points[String(Math.round(left))] = left;
    points[String(Math.round(right))] = right;
    var source = getProfilePointsForSectorOrFallback(sector);
    for (var i = 0; i < source.length; i++) {
      if (source[i].end < left) continue;
      if (source[i].start > right) break;
      points[String(Math.round(clamp(source[i].start, left, right)))] = clamp(source[i].start, left, right);
      points[String(Math.round(clamp(source[i].end, left, right)))] = clamp(source[i].end, left, right);
    }
    return Object.keys(points).map(function(key) {
      return points[key];
    }).sort(function(a, b) {
      return a - b;
    });
  }

  function drawProfileRange(ctx, layout, center, sector, start, end, offset, stroke, width) {
    var samples = collectProfileCoordinates(start, end, sector);
    if (samples.length < 2) return false;
    var screenPoints = samples.map(function(coord) {
      return {
        x: coordinateToApkX(coord, center, layout),
        y: getProfileYAt(coord, center, sector, layout) + offset
      };
    }).sort(function(a, b) {
      return a.x - b.x;
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.viewportX, layout.profileTop - 76, layout.viewportWidth, layout.trackY - layout.profileTop + 40);
    ctx.clip();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (var i = 1; i < screenPoints.length; i++) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
    return true;
  }

  function drawApkTrackerHeader(ctx, layout, center, sector, visibleObjects) {
    return;
    var profileStatus = getProfileStatusForSector(sector);
    var hasProfile = profileStatus !== 'missing';
    var statusText = profileStatus === 'emap'
      ? ((tracker.currentMap && tracker.currentMap.title) || 'Карта ЭК')
      : profileStatus === 'user'
        ? 'пользовательский GPS-участок'
      : profileStatus === 'learned'
        ? 'профиль доучен GPS'
        : profileStatus === 'regime'
          ? 'профиль из режимной карты'
          : profileStatus === 'raw'
            ? 'черновой GPS-участок'
          : profileStatus === 'fallback'
            ? 'профиль взят из общего слоя'
            : 'профиль не указан в ЭК';
    var statusColor = profileStatus === 'user'
      ? '#86efac'
      : profileStatus === 'learned'
      ? THEME.green
      : profileStatus === 'raw'
        ? '#c4b5fd'
      : profileStatus === 'regime'
        ? '#facc15'
      : hasProfile
        ? THEME.sub
        : 'rgba(244, 63, 94, 0.72)';
    drawText(ctx, 'ПРОФИЛЬ ПУТИ', layout.viewportX + 10, layout.profileTop - 24, {
      size: 10,
      weight: 850,
      color: THEME.sub
    });
    drawText(ctx, statusText, layout.viewportRight - 10, layout.profileTop - 24, {
      size: 10,
      weight: 850,
      color: statusColor,
      align: 'right',
      maxWidth: Math.max(110, layout.viewportWidth * 0.48)
    });
  }

  function drawApkProfileLegend(ctx, layout) {
    return;
  }

  function drawLiveChip(ctx, x, y, width, label, value, tone) {
    var fill = tone === 'danger'
      ? 'rgba(244, 63, 94, 0.12)'
      : tone === 'warning'
        ? 'rgba(250, 204, 21, 0.12)'
      : tone === 'success'
        ? 'rgba(74, 222, 128, 0.12)'
        : 'rgba(56, 189, 248, 0.11)';
    var stroke = tone === 'danger'
      ? 'rgba(244, 63, 94, 0.24)'
      : tone === 'warning'
        ? 'rgba(250, 204, 21, 0.26)'
      : tone === 'success'
        ? 'rgba(74, 222, 128, 0.24)'
        : 'rgba(56, 189, 248, 0.22)';
    var color = tone === 'success' ? THEME.green : tone === 'danger' ? THEME.danger : tone === 'warning' ? '#facc15' : THEME.accentStrong;
    fillRoundRect(ctx, x, y, width, 32, 10, fill);
    strokeRoundRect(ctx, x + 0.5, y + 0.5, width - 1, 31, 10, stroke);
    drawText(ctx, label, x + width / 2, y + 11, {
      size: 7,
      weight: 850,
      color: THEME.sub,
      align: 'center',
      maxWidth: width - 8
    });
    drawText(ctx, value, x + width / 2, y + 25, {
      size: String(value).length > 5 ? 9 : 10,
      weight: 850,
      color: color,
      align: 'center',
      maxWidth: width - 8
    });
  }

  function makeLabelLayout() {
    return [];
  }

  function reserveLabel(layout, x, y, width, height, padding) {
    padding = isFinite(padding) ? padding : 4;
    var rect = {
      left: x - width / 2 - padding,
      right: x + width / 2 + padding,
      top: y - height / 2 - padding,
      bottom: y + height / 2 + padding
    };
    for (var i = 0; i < layout.length; i++) {
      var item = layout[i];
      if (rect.left < item.right && rect.right > item.left && rect.top < item.bottom && rect.bottom > item.top) {
        return false;
      }
    }
    layout.push(rect);
    return true;
  }

  function getRangeDistanceFromCenter(start, end, center) {
    if (!isFinite(start) || !isFinite(end) || !isFinite(center)) return Infinity;
    var left = Math.min(start, end);
    var right = Math.max(start, end);
    if (center >= left && center <= right) return 0;
    return Math.min(Math.abs(center - left), Math.abs(center - right));
  }

  function isCoordinateNearCenter(coordinate, center, radiusMeters) {
    return isFinite(coordinate) && Math.abs(coordinate - center) <= radiusMeters;
  }

  function isRangeNearCenter(start, end, center, radiusMeters) {
    return getRangeDistanceFromCenter(start, end, center) <= radiusMeters;
  }

  function getRouteProgressName(value, fallback) {
    var text = String(value || '').trim();
    if (text) return text;
    if (fallback === '') return '';
    return fallback || 'маршрут';
  }

  function formatRouteProgressPct(value) {
    var progress = Math.max(0, Math.min(100, Number(value) || 0));
    var rounded = Math.round(progress * 10) / 10;
    return (rounded % 1 === 0 ? String(Math.round(rounded)) : String(rounded)) + '%';
  }

  function formatRouteProgressLiveSubtitle(routeProgress, fallback) {
    if (!routeProgress || !isFinite(routeProgress.distanceMeters)) return fallback;
    var fromName = getRouteProgressName(routeProgress.fromName, 'начало');
    var toName = getRouteProgressName(routeProgress.toName, 'назначение');
    var etaSeconds = estimateEtaSeconds(
      routeProgress.status === 'before' ? routeProgress.outsideMeters : routeProgress.remainingMeters,
      getCurrentEtaSpeedKmh()
    );
    var eta = formatEtaSeconds(etaSeconds, true);
    if (routeProgress.status === 'before') {
      return 'до маршрута ' + formatDistanceLabel(routeProgress.outsideMeters || 0) + (eta ? ' · ' + eta : '') + ' · ' + fromName + ' - ' + toName;
    }
    if (routeProgress.status === 'after') {
      return 'маршрут пройден · +' + formatDistanceLabel(routeProgress.outsideMeters || 0) + ' · ' + toName;
    }
    return 'маршрут ' + formatRouteProgressPct(routeProgress.progressPct) + ' · ост. ' + formatDistanceLabel(routeProgress.remainingMeters || 0) + (eta ? ' · ' + eta : '') + ' · ' + toName;
  }

  function drawLiveRouteProgressRail(ctx, x, y, width, routeProgress, isPreview) {
    if (!routeProgress || !isFinite(routeProgress.distanceMeters)) return;
    var progress = Math.max(0, Math.min(100, Number(routeProgress.progressPct) || 0));
    var railX = x + 13;
    var railY = y + 61;
    var railWidth = Math.max(48, width - 26);
    var fillWidth = railWidth * progress / 100;
    var fill = routeProgress.status === 'after'
      ? 'rgba(74, 222, 128, 0.82)'
      : routeProgress.status === 'before'
        ? 'rgba(136, 146, 164, 0.52)'
        : 'rgba(56, 189, 248, 0.86)';
    ctx.save();
    fillRoundRect(ctx, railX, railY, railWidth, 5, 3, 'rgba(136, 146, 164, 0.16)');
    if (fillWidth > 0) {
      fillRoundRect(ctx, railX, railY, Math.max(5, fillWidth), 5, 3, fill);
    }
    var thumbX = railX + Math.max(0, Math.min(railWidth, fillWidth));
    ctx.fillStyle = fill;
    ctx.shadowColor = isPreview ? 'transparent' : fill;
    ctx.shadowBlur = isPreview ? 0 : 8;
    ctx.beginPath();
    ctx.arc(thumbX, railY + 2.5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function resolveLiveNavigationTarget(projection, activeSpeed, nextWarning, nextRestriction, nextSignal, nextStation, routeProgress) {
    var candidates = [];
    var speed = getCurrentEtaSpeedKmh();
    var projectionSector = projection && isRealNumber(projection.sector) ? projection.sector : 0;
    var projectionCoordinate = projection && isRealNumber(projection.lineCoordinate) ? projection.lineCoordinate : 0;
    var active = activeSpeed ? normalizeActiveRestriction(activeSpeed, projection) : null;
    if (active && active.distanceToEnd > 0) {
      candidates.push({
        kind: 'restriction_end',
        label: 'Конец ' + active.label,
        source: active.source,
        sector: active.sector,
        coordinate: tracker.even ? active.end : active.start,
        distanceMeters: active.distanceToEnd,
        etaSeconds: estimateEtaSeconds(active.distanceToEnd, speed),
        updatedAt: active.updatedAt
      });
    }
    if (nextWarning && nextWarning.item) {
      var warningSpeed = Math.max(0, Math.round(Number(nextWarning.item.speed) || 0));
      candidates.push({
        kind: 'warning',
        label: nextWarning.status === 'active' ? 'ПР действует ' + warningSpeed : 'ПР ' + warningSpeed,
        source: 'warning',
        sector: projectionSector,
        coordinate: nextWarning.anchor,
        distanceMeters: nextWarning.distance,
        etaSeconds: estimateEtaSeconds(nextWarning.distance, speed)
      });
    }
    if (nextRestriction) {
      candidates.push({
        kind: nextRestriction.source === 'warning' ? 'warning' : 'restriction',
        label: nextRestriction.label,
        source: nextRestriction.source,
        sector: nextRestriction.sector,
        coordinate: nextRestriction.coordinate,
        distanceMeters: nextRestriction.distance,
        etaSeconds: estimateEtaSeconds(nextRestriction.distance, speed),
        updatedAt: nextRestriction.updatedAt
      });
    }
    if (nextSignal) {
      candidates.push({
        kind: 'signal',
        label: nextSignal.name,
        source: nextSignal.source,
        sector: nextSignal.sector || projectionSector,
        coordinate: nextSignal.coordinate,
        distanceMeters: isFinite(nextSignal.distance) ? nextSignal.distance : Math.abs(nextSignal.coordinate - projectionCoordinate),
        etaSeconds: estimateEtaSeconds(isFinite(nextSignal.distance) ? nextSignal.distance : Math.abs(nextSignal.coordinate - projectionCoordinate), speed)
      });
    }
    if (nextStation) {
      candidates.push({
        kind: 'station',
        label: nextStation.name,
        source: nextStation.source,
        sector: nextStation.sector || projectionSector,
        coordinate: nextStation.coordinate,
        distanceMeters: isFinite(nextStation.distance) ? nextStation.distance : Math.abs(nextStation.coordinate - projectionCoordinate),
        etaSeconds: estimateEtaSeconds(isFinite(nextStation.distance) ? nextStation.distance : Math.abs(nextStation.coordinate - projectionCoordinate), speed)
      });
    }
    if (routeProgress && isFinite(routeProgress.distanceMeters)) {
      if (routeProgress.status === 'before' && routeProgress.outsideMeters > 0) {
        candidates.push({
          kind: 'route_start',
          label: 'Старт ' + getRouteProgressName(routeProgress.fromName, 'маршрута'),
          source: 'route',
          sector: projectionSector,
          coordinate: routeProgress.fromCoordinate,
          distanceMeters: routeProgress.outsideMeters,
          etaSeconds: estimateEtaSeconds(routeProgress.outsideMeters, speed)
        });
      } else if (routeProgress.status === 'route' && routeProgress.remainingMeters > 0) {
        candidates.push({
          kind: 'route_finish',
          label: 'Финиш ' + getRouteProgressName(routeProgress.toName, 'маршрута'),
          source: 'route',
          sector: projectionSector,
          coordinate: routeProgress.toCoordinate,
          distanceMeters: routeProgress.remainingMeters,
          etaSeconds: estimateEtaSeconds(routeProgress.remainingMeters, speed)
        });
      }
    }
    return selectNavigationTarget(candidates);
  }

  function formatLiveNavigationTargetDistance(target) {
    if (!target) return '—';
    var distance = Math.max(0, Math.round(Number(target.distanceMeters) || 0));
    return distance > 0 ? formatDistanceLabel(distance) : 'ТУТ';
  }

  function getLiveNavigationTargetTone(target, isPreview) {
    if (!target) return isPreview ? 'danger' : 'info';
    var distance = Math.max(0, Math.round(Number(target.distanceMeters) || 0));
    if (target.kind === 'warning' || target.kind === 'restriction' || target.kind === 'restriction_end') {
      if (distance <= 400) return 'danger';
      if (distance <= 1500) return 'warning';
      return 'info';
    }
    if (target.kind === 'station') return distance <= 250 ? 'success' : 'info';
    if (target.kind === 'route_start' || target.kind === 'route_finish') return distance <= 250 ? 'success' : 'info';
    return 'info';
  }

  function formatLiveNavigationTargetTitle(target) {
    if (!target) return '';
    var label = String(target.label || '').trim();
    var shortLabel = getNavigationTargetShortLabel(target.kind, target.source);
    if (target.kind === 'restriction_end' || target.kind === 'route_start' || target.kind === 'route_finish') {
      return label;
    }
    if (target.kind === 'warning') {
      return label.indexOf('ПР') === 0 ? label : 'ПР ' + label;
    }
    if (target.kind === 'restriction') {
      return 'Далее ' + (shortLabel && shortLabel !== 'ОГР' ? shortLabel + ' ' : '') + label;
    }
    if (target.kind === 'signal') return 'Светофор ' + label;
    if (target.kind === 'station') return 'Станция ' + label;
    return label;
  }

  function formatLiveNavigationTargetSubtitle(target, locationTitle) {
    if (!target) return '';
    var distance = Math.max(0, Math.round(Number(target.distanceMeters) || 0));
    var coordinate = Number(target.coordinate);
    var eta = formatEtaSeconds(target.etaSeconds, true);
    var parts = [];
    parts.push(distance > 0 ? 'через ' + formatDistanceLabel(distance) : 'сейчас');
    if (eta) parts.push(eta);
    if (isFinite(coordinate) && coordinate > 0) parts.push(formatLineCoordinate(coordinate));
    var location = String(locationTitle || '').trim();
    if (location && location !== target.label) parts.push(location);
    return parts.join(' · ');
  }

  function drawApkLiveSummary(ctx, layout, center, sector, visibleObjects, activeSpeed, nextSignal, nextStation, nextWarning, nextRestriction, routeProgress, isPreview, projection) {
    var w = layout.canvasWidth || layout.viewportRight;
    var x = getPanelInset(w);
    var y = getPoekhaliLiveSummaryTop();
    var width = w - x * 2;
    var hasRouteProgress = !!(routeProgress && isFinite(routeProgress.distanceMeters));
    var panelHeight = hasRouteProgress ? 70 : 52;
    var chipWidth = w < 360 ? 48 : 56;
    var chipGap = 6;
    var chipsWidth = chipWidth * 3 + chipGap * 2;
    var station = findStationContext(center, visibleObjects);
    var profilePoint = getCurrentProfilePoint(center, sector);
    var hasProfile = hasProfileForSector(sector);
    var rawDraft = getRawDraftForSector(sector);
    var userSection = getUserSectionForSector(sector);
    var blockLabel = isPreview ? 'ОРИЕНТИР' : 'МЕСТО';
    var title = rawDraft ? rawDraft.title : userSection ? userSection.title : (station && station.name ? station.name : 'Участок ' + sector);
    var details = getPoekhaliTrainDetails();
    var subtitle = isPreview
      ? (rawDraft ? ('сырой GPS · ' + formatDistanceLabel(rawDraft.lengthMeters) + ' · ' + formatLineCoordinate(center)) : userSection ? ('GPS участок · ' + formatLineCoordinate(center)) : (((tracker.currentMap && tracker.currentMap.title) || 'Карта ЭК') + ' · ' + formatLineCoordinate(center)))
      : (rawDraft ? ('сырой GPS · ' + formatDistanceLabel(rawDraft.lengthMeters) + ' · ' + formatLineCoordinate(center)) : userSection ? ('GPS участок · ' + formatLineCoordinate(center)) : (details.summary || (((tracker.currentMap && tracker.currentMap.title) || 'Карта ЭК') + ' · ' + formatLineCoordinate(center))));
    if (hasRouteProgress) {
      subtitle = formatRouteProgressLiveSubtitle(routeProgress, subtitle);
    }
    var locationTitle = title;
    var chip1Label = 'ЛИМИТ';
    var chip1Text = activeSpeed ? formatSpeedLabel(activeSpeed) : 'НЕТ';
    var chip1Tone = activeSpeed && activeSpeed.source === 'warning'
      ? 'danger'
      : activeSpeed && activeSpeed.source === 'document' && activeSpeed.conflict
        ? 'warning'
      : activeSpeed && activeSpeed.source === 'document'
        ? 'success'
      : activeSpeed && activeSpeed.source === 'regime'
        ? 'warning'
      : activeSpeed && activeSpeed.source === 'user'
        ? 'success'
        : (activeSpeed ? 'info' : 'info');
    var regimeProfile = profilePoint && profilePoint.regime || (!hasProfile && hasRegimeProfileForSector(sector));
    var chip2Label = rawDraft ? 'GPS' : userSection ? 'GPS' : (profilePoint && profilePoint.regime ? 'РК' : (hasProfile ? 'УКЛОН' : (regimeProfile ? 'РК' : 'ПРОФ')));
    var chip2Text = (rawDraft || userSection) && profilePoint && profilePoint.altitudeMissing ? 'ЛИН.' : (hasProfile && profilePoint ? formatProfileGradeLabel(profilePoint) : (hasProfile ? '—' : (regimeProfile ? 'ЕСТЬ' : 'НЕТ')));
    var chip2Tone = rawDraft ? 'warning' : userSection ? 'success' : (profilePoint && profilePoint.regime ? 'warning' : (hasProfile ? (profilePoint && profilePoint.grade >= 0 ? 'success' : 'info') : (regimeProfile ? 'warning' : 'danger')));
    var navTarget = resolveLiveNavigationTarget(projection, activeSpeed, nextWarning, nextRestriction, nextSignal, nextStation, routeProgress);
    if (navTarget) {
      blockLabel = Math.max(0, Math.round(Number(navTarget.distanceMeters) || 0)) > 0
        ? (isPreview ? 'ДАЛЬШЕ ПО КАРТЕ' : 'ДАЛЬШЕ')
        : 'СЕЙЧАС';
      title = formatLiveNavigationTargetTitle(navTarget) || title;
      subtitle = formatLiveNavigationTargetSubtitle(navTarget, locationTitle) || subtitle;
    }
    var chip3Label = navTarget ? (Math.max(0, Math.round(Number(navTarget.distanceMeters) || 0)) > 0 ? 'ДАЛЕЕ' : 'ТУТ') : (nextRestriction ? 'ДАЛЕЕ' : (nextWarning ? 'ПР' : (isPreview ? 'GPS' : (nextSignal ? 'СВ' : 'ЦЕЛЬ'))));
    var chip3Text = navTarget
        ? formatLiveNavigationTargetDistance(navTarget)
      : nextRestriction
        ? formatDistanceLabel(nextRestriction.distance)
      : nextWarning
        ? (nextWarning.status === 'active' ? 'ТУТ' : formatDistanceLabel(nextWarning.distance))
      : isPreview
        ? (tracker.status === 'offtrack' ? 'ВНЕ' : 'НЕТ')
      : (nextSignal ? formatDistanceLabel(Math.abs(nextSignal.coordinate - center)) : '—');
    var chip3Tone = navTarget
        ? getLiveNavigationTargetTone(navTarget, isPreview)
      : nextRestriction
        ? (nextRestriction.source === 'warning' && nextRestriction.distance <= 400 ? 'danger' : nextRestriction.distance <= 1500 ? 'warning' : nextRestriction.source === 'document' && nextRestriction.conflict ? 'warning' : 'info')
      : nextWarning
        ? (nextWarning.status === 'active' || nextWarning.distance <= 400 ? 'danger' : nextWarning.distance <= 1500 ? 'warning' : 'info')
      : isPreview
        ? 'danger'
        : 'info';

    var liveAlert = isPreview ? null : getCurrentPoekhaliLiveAlert();
    var panelFill = 'rgba(19, 19, 24, 0.70)';
    var panelStroke = 'rgba(255, 255, 255, 0.075)';
    var labelColor = THEME.sub;
    var titleColor = THEME.text;
    var subtitleColor = 'rgba(136, 146, 164, 0.78)';
    var textX = x + 13;
    if (liveAlert) {
      var dangerAlert = liveAlert.level === 'danger';
      blockLabel = dangerAlert ? 'КОНТРОЛЬ' : 'ВНИМАНИЕ';
      title = liveAlert.title || title;
      subtitle = liveAlert.text || subtitle;
      panelFill = dangerAlert ? 'rgba(45, 14, 26, 0.88)' : 'rgba(42, 34, 11, 0.84)';
      panelStroke = dangerAlert ? 'rgba(244, 63, 94, 0.34)' : 'rgba(250, 204, 21, 0.30)';
      labelColor = dangerAlert ? 'rgba(251, 113, 133, 0.86)' : 'rgba(250, 204, 21, 0.82)';
      titleColor = dangerAlert ? '#fecdd3' : '#fef3c7';
      subtitleColor = dangerAlert ? 'rgba(254, 205, 211, 0.84)' : 'rgba(254, 243, 199, 0.82)';
      textX = x + 20;
    }

    drawPanel(ctx, x, y, width, panelHeight, 16, panelFill, panelStroke);
    if (liveAlert) {
      fillRoundRect(ctx, x + 9, y + 10, 4, panelHeight - 20, 4, liveAlert.level === 'danger' ? THEME.danger : '#facc15');
    }
    drawText(ctx, blockLabel, textX, y + 17, {
      size: 8,
      weight: 850,
      color: labelColor
    });
    drawText(ctx, title, textX, y + 35, {
      size: liveAlert && w < 360 ? 12 : (navTarget ? (w < 360 ? 13 : 15) : 13),
      weight: 850,
      color: titleColor,
      maxWidth: Math.max(84, width - chipsWidth - (liveAlert ? 42 : 34))
    });
    drawText(ctx, subtitle, textX, y + 48, {
      size: navTarget ? 8.5 : 8,
      weight: 750,
      color: subtitleColor,
      maxWidth: Math.max(84, width - chipsWidth - (liveAlert ? 42 : 34))
    });

    var chipX = x + width - chipsWidth - 10;
    drawLiveChip(ctx, chipX, y + 10, chipWidth, chip1Label, chip1Text, chip1Tone);
    drawLiveChip(ctx, chipX + chipWidth + chipGap, y + 10, chipWidth, chip2Label, chip2Text, chip2Tone);
    drawLiveChip(ctx, chipX + (chipWidth + chipGap) * 2, y + 10, chipWidth, chip3Label, chip3Text, chip3Tone);
    drawLiveRouteProgressRail(ctx, x, y, width, routeProgress, isPreview);
  }

  function drawApkSceneBackground(ctx, layout) {
    ctx.save();
    var top = layout.profileTop - 58;
    var bottom = layout.trackY + 72;
    var gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, 'rgba(19, 19, 24, 0.00)');
    gradient.addColorStop(0.28, 'rgba(19, 19, 24, 0.30)');
    gradient.addColorStop(0.72, 'rgba(19, 19, 24, 0.34)');
    gradient.addColorStop(1, 'rgba(19, 19, 24, 0.00)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, top, layout.canvasWidth || layout.viewportRight, bottom - top);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.viewportX + 8, top + 8);
    ctx.lineTo(layout.viewportRight - 8, top + 8);
    ctx.moveTo(layout.viewportX + 8, bottom - 8);
    ctx.lineTo(layout.viewportRight - 8, bottom - 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawApkProfileGrid(ctx, layout) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      var y = Math.round(layout.profileTop + 14 + (layout.profileBottom - layout.profileTop - 28) * (i / 3)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(layout.viewportX + 10, y);
      ctx.lineTo(layout.viewportRight - 10, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawApkKmGrid(ctx, layout, center, bounds, sector) {
    var first = Math.ceil(bounds.left / 100) * 100;
    var railY = layout.trackY;
    var kmLabelY = railY + 35;
    var pkLabelY = railY + 18;
    var currentKmStart = Math.floor(center / 1000) * 1000;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = Math.max(5, layout.xUnit * 0.9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(layout.viewportX + 8, railY);
    ctx.lineTo(layout.viewportRight - 8, railY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(238, 242, 248, 0.68)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(layout.viewportX + 8, railY);
    ctx.lineTo(layout.viewportRight - 8, railY);
    ctx.stroke();

    for (var coord = first; coord <= bounds.right + 1; coord += 100) {
      var x = coordinateToApkX(coord, center, layout);
      if (x < layout.viewportX - 2 || x > layout.viewportRight + 2) continue;
      var major = coord % 1000 === 0;
      var half = coord % 500 === 0;
      ctx.strokeStyle = major ? 'rgba(238, 242, 248, 0.72)' : half ? 'rgba(238, 242, 248, 0.52)' : 'rgba(238, 242, 248, 0.30)';
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, railY - (major ? 15 : half ? 12 : 7));
      ctx.lineTo(x, railY + (major ? 15 : half ? 12 : 7));
      ctx.stroke();

      if (major) {
        var y = getProfileYAt(coord, center, sector, layout);
        ctx.setLineDash([4, 7]);
        ctx.strokeStyle = 'rgba(136, 146, 164, 0.22)';
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, y + 14);
        ctx.lineTo(Math.round(x) + 0.5, railY - 18);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (!major && coord >= currentKmStart && coord < currentKmStart + 1000) {
        var pk = Math.floor((coord - currentKmStart) / 100) + 1;
        if (half || (layout.xUnit > 9 && pk % 2)) {
          drawText(ctx, String(pk), x, pkLabelY + (pk % 2 ? 0 : 9), {
          size: 7,
          weight: 850,
          color: 'rgba(238, 242, 248, 0.62)',
          align: 'center'
          });
        }
      } else if (!major && half) {
        drawText(ctx, '5', x, pkLabelY, {
          size: 7,
          weight: 850,
          color: 'rgba(238, 242, 248, 0.42)',
          align: 'center'
        });
      }
      if (major) {
        drawText(ctx, String(Math.floor(coord / 1000)), x, kmLabelY, {
          size: 10,
          weight: 850,
          color: 'rgba(238, 242, 248, 0.68)',
          align: 'center'
        });
      }
    }
    var currentPk = Math.floor(((Math.round(center) % 1000) + 1000) % 1000 / 100) + 1;
    fillRoundRect(ctx, layout.headX - 24, railY - 31, 48, 20, 7, 'rgba(56, 189, 248, 0.18)');
    strokeRoundRect(ctx, layout.headX - 23.5, railY - 30.5, 47, 19, 7, 'rgba(56, 189, 248, 0.42)');
    drawText(ctx, 'ПК ' + currentPk, layout.headX, railY - 17, {
      size: 10,
      weight: 850,
      color: THEME.accentStrong,
      align: 'center'
    });
    ctx.restore();
  }

  function drawApkProfile(ctx, layout, center, sector, bounds) {
    var segments = getVisibleProfileSegmentsForWindow(bounds.left, bounds.right, sector);
    var learnedProfile = segments.length && segments[0].learned;
    var regimeDrawProfile = segments.length && segments[0].regime;
    var rawDraftProfile = segments.length && segments[0].rawDraft;
    var userDrawProfile = segments.length && segments[0].userSection;
    var sampleMap = {};
    function addSample(value) {
      if (!isFinite(value)) return;
      var key = String(Math.round(value));
      sampleMap[key] = value;
    }
    addSample(bounds.left);
    addSample(bounds.right);
    addSample(center);
    for (var i = 0; i < segments.length; i++) {
      addSample(clamp(segments[i].start, bounds.left, bounds.right));
      addSample(clamp(segments[i].end, bounds.left, bounds.right));
    }
    if (!segments.length) {
      var fallbackFirst = Math.ceil(bounds.left / 500) * 500;
      for (var coord = fallbackFirst; coord <= bounds.right; coord += 500) addSample(coord);
    }
    var samples = Object.keys(sampleMap).map(function(key) {
      return sampleMap[key];
    }).sort(function(a, b) {
      return a - b;
    });
    if (samples.length < 2) return false;

    var centerVisual = getProfileVisualOffsetAt(center, sector, layout);
    var points = samples.map(function(coord) {
      return {
        coord: coord,
        x: coordinateToApkX(coord, center, layout),
        y: yForProfileCoordinate(coord, center, sector, layout, centerVisual)
      };
    }).sort(function(a, b) {
      return a.x - b.x;
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.viewportX, layout.profileTop - 34, layout.viewportWidth, layout.trackY - layout.profileTop + 42);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var s = 1; s < points.length; s++) {
      ctx.lineTo(points[s].x, points[s].y);
    }
    ctx.strokeStyle = segments.length
      ? (rawDraftProfile ? 'rgba(196, 181, 253, 0.92)' : userDrawProfile ? 'rgba(134, 239, 172, 0.94)' : learnedProfile ? 'rgba(74, 222, 128, 0.88)' : regimeDrawProfile ? 'rgba(250, 204, 21, 0.86)' : 'rgba(91, 210, 255, 0.96)')
      : 'rgba(91, 210, 255, 0.42)';
    ctx.lineWidth = segments.length ? 3.2 : 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    if (!segments.length || learnedProfile || regimeDrawProfile || rawDraftProfile || userDrawProfile) {
      var regimeProfile = !segments.length && hasRegimeProfileForSector(sector);
      var label = rawDraftProfile ? 'GPS ЧЕРНОВИК' : (userDrawProfile ? 'GPS УЧАСТОК' : learnedProfile ? 'GPS ПРОФИЛЬ' : (regimeDrawProfile ? 'РК ПРОФИЛЬ' : (regimeProfile ? 'ПРОФИЛЬ ЕСТЬ В РК' : 'ПРОФИЛЬ НЕТ В КАРТЕ')));
      var labelWidth = Math.min(layout.viewportWidth - 36, Math.max(132, label.length * 7 + 18));
      var labelX = layout.viewportRight - labelWidth / 2 - 12;
      var labelY = layout.profileTop + 34;
      fillRoundRect(ctx, labelX - labelWidth / 2, labelY - 15, labelWidth, 23, 8, rawDraftProfile ? 'rgba(124, 58, 237, 0.12)' : (userDrawProfile || learnedProfile) ? 'rgba(74, 222, 128, 0.10)' : (regimeDrawProfile || regimeProfile) ? 'rgba(250, 204, 21, 0.10)' : 'rgba(244, 63, 94, 0.10)');
      strokeRoundRect(ctx, labelX - labelWidth / 2 + 0.5, labelY - 14.5, labelWidth - 1, 22, 8, rawDraftProfile ? 'rgba(196, 181, 253, 0.28)' : (userDrawProfile || learnedProfile) ? 'rgba(74, 222, 128, 0.24)' : (regimeDrawProfile || regimeProfile) ? 'rgba(250, 204, 21, 0.24)' : 'rgba(244, 63, 94, 0.22)');
      drawText(ctx, label, labelX, labelY + 1, {
        size: 9,
        weight: 850,
        color: rawDraftProfile ? '#ddd6fe' : (userDrawProfile || learnedProfile) ? THEME.green : (regimeDrawProfile || regimeProfile) ? '#fde68a' : 'rgba(244, 63, 94, 0.82)',
        align: 'center',
        maxWidth: labelWidth - 10
      });
    }
    return true;
  }

  function getObjectXSpan(item, center, layout) {
    var startX = coordinateToApkX(item.coordinate, center, layout);
    var endX = coordinateToApkX(item.length > 0 ? item.end : item.coordinate, center, layout);
    return {
      x1: Math.min(startX, endX),
      x2: Math.max(startX, endX)
    };
  }

  function drawApkStations(ctx, layout, center, sector, objects, isPreview, labelLayout) {
    var stations = objects.filter(function(item) { return item.type === '2'; });
    var labelRight = -Infinity;
    var bounds = getApkVisibleBounds(center, layout);
    ctx.save();
    for (var i = 0; i < stations.length; i++) {
      var station = stations[i];
      var isRegimeStation = station.source === 'regime';
      var start = Math.max(station.coordinate, bounds.left);
      var end = Math.min(station.end, bounds.right);
      if (end < start) continue;

      var mid = (start + end) / 2;
      var span = getObjectXSpan({ coordinate: start, end: end, length: end - start }, center, layout);
      var visibleWidth = span.x2 - span.x1;
      var labelX = clamp(coordinateToApkX(mid, center, layout), layout.viewportX + 30, layout.viewportRight - 30);
      var shouldLabel = visibleWidth > 70 && (isRangeNearCenter(start, end, center, APK_LABEL_CONTEXT_RADIUS_M) || isRegimeStation);
      var minGap = isPreview ? 88 : 112;
      if (shouldLabel && labelX - minGap > labelRight) {
        var stationLabel = String(station.name || '').toUpperCase();
        drawText(ctx, stationLabel, labelX, layout.profileTop + 7, {
          size: 10,
          weight: 850,
          color: isRegimeStation ? 'rgba(251, 146, 60, 0.36)' : 'rgba(238, 242, 248, 0.32)',
          align: 'center',
          maxWidth: Math.min(visibleWidth + 12, 118)
        });
        labelRight = labelX + Math.min(118, stationLabel.length * 6.4) / 2 + 14;
      }
    }
    ctx.restore();
  }

  function drawApkSignals(ctx, layout, center, sector, objects, isPreview, labelLayout) {
    var signals = objects.filter(function(item) { return item.type === '1'; }).sort(function(a, b) {
      return a.coordinate - b.coordinate;
    });
    var lastLabelX = -Infinity;
    var radius = Math.max(2.4, layout.xUnit * 0.42);
    ctx.save();
    ctx.lineWidth = 1.4;
    for (var i = 0; i < signals.length; i++) {
      var signal = signals[i];
      var x = coordinateToApkX(signal.coordinate, center, layout);
      if (x < layout.viewportX - 8 || x > layout.viewportRight + 8) continue;
      var y = getProfileYAt(signal.coordinate, center, sector, layout);
      var signalDistance = Math.abs(signal.coordinate - center);
      var signalFocus = signalDistance <= APK_LABEL_CONTEXT_RADIUS_M;
      ctx.globalAlpha = signalFocus ? 1 : 0.50;
      ctx.strokeStyle = 'rgba(129, 156, 169, 0.84)';
      var stemHeight = isPreview ? 28 : 34;
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x, y - stemHeight);
      ctx.stroke();

      ctx.globalAlpha = signalFocus ? 0.66 : 0.38;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(x, y - 39, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(x, y - 50, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(x, y - 61, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (signalDistance <= APK_LABEL_FOCUS_RADIUS_M && x - lastLabelX > (isPreview ? 76 : 92) && reserveLabel(labelLayout, x, y - 70, 48, 14, isPreview ? 8 : 5)) {
        drawText(ctx, signal.name, x, y - 70, {
          size: 8,
          weight: 850,
          color: 'rgba(238, 242, 248, 0.72)',
          align: 'center',
          maxWidth: 46
        });
        lastLabelX = x;
      }
    }
    ctx.restore();
  }

  function getRegimeControlMarkTone(mark) {
    var kind = mark && mark.kind ? mark.kind : '';
    if (kind === 'neutral') {
      return {
        fill: 'rgba(88, 20, 36, 0.82)',
        stroke: 'rgba(251, 113, 133, 0.54)',
        text: '#fda4af'
      };
    }
    if (kind === 'connection') {
      return {
        fill: 'rgba(8, 47, 73, 0.76)',
        stroke: 'rgba(56, 189, 248, 0.36)',
        text: '#bae6fd'
      };
    }
    if (kind === 'brake') {
      return {
        fill: 'rgba(24, 24, 32, 0.78)',
        stroke: 'rgba(196, 181, 253, 0.34)',
        text: '#ddd6fe'
      };
    }
    if (kind === 'power') {
      return {
        fill: 'rgba(113, 63, 18, 0.74)',
        stroke: 'rgba(250, 204, 21, 0.34)',
        text: '#fde68a'
      };
    }
    return {
      fill: 'rgba(20, 83, 45, 0.72)',
      stroke: 'rgba(74, 222, 128, 0.34)',
      text: '#bbf7d0'
    };
  }

  function drawRegimeControlMarks(ctx, layout, center, sector, marks, isPreview, labelLayout) {
    if (!Array.isArray(marks) || !marks.length) return;
    var drawnLabels = 0;
    var maxLabels = isPreview ? 5 : 6;
    ctx.save();
    for (var i = 0; i < marks.length; i++) {
      var mark = marks[i];
      if (!mark || !isFinite(mark.coordinate)) continue;
      var x = coordinateToApkX(mark.coordinate, center, layout);
      if (x < layout.viewportX - 10 || x > layout.viewportRight + 10) continue;
      var profileY = getProfileYAt(mark.coordinate, center, sector, layout);
      var neutral = mark.kind === 'neutral';
      var tone = getRegimeControlMarkTone(mark);
      var markDistance = Math.abs(mark.coordinate - center);
      var markFocus = markDistance <= (neutral ? APK_LABEL_CONTEXT_RADIUS_M : APK_LABEL_FOCUS_RADIUS_M);
      var stemEnd = neutral ? profileY - (isPreview ? 24 : 30) : profileY + (isPreview ? 18 : 23);
      ctx.globalAlpha = markFocus ? 1 : 0.46;
      ctx.strokeStyle = tone.stroke;
      ctx.lineWidth = neutral ? 1.35 : 1.05;
      ctx.setLineDash(neutral ? [4, 4] : [3, 5]);
      ctx.beginPath();
      ctx.moveTo(x, profileY + (neutral ? -3 : 3));
      ctx.lineTo(x, stemEnd);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = tone.text;
      ctx.beginPath();
      ctx.arc(x, profileY, neutral ? 3.5 : 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (!markFocus || drawnLabels >= maxLabels) continue;
      var label = neutral ? 'НТ' : String(mark.name || '');
      if (!label) continue;
      var width = Math.min(neutral ? 44 : 68, Math.max(neutral ? 28 : 32, label.length * 7 + 12));
      var labelY = neutral ? stemEnd - 7 : stemEnd + 13;
      if (labelY < layout.profileTop + 15) labelY = layout.profileTop + 15;
      if (labelY > layout.profileBottom - 2) labelY = layout.profileBottom - 2;
      if (!reserveLabel(labelLayout, x, labelY - 4, width, 18, isPreview ? 8 : 5)) continue;
      fillRoundRect(ctx, x - width / 2, labelY - 14, width, 18, 6, tone.fill);
      strokeRoundRect(ctx, x - width / 2 + 0.5, labelY - 13.5, width - 1, 17, 6, tone.stroke);
      drawText(ctx, label, x, labelY, {
        size: neutral ? 8 : 7.5,
        weight: 850,
        color: tone.text,
        align: 'center',
        maxWidth: width - 6
      });
      drawnLabels += 1;
    }
    ctx.restore();
  }

  function isSameSpeedRule(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    var aSpeed = getSpeedRuleValue(a);
    var bSpeed = getSpeedRuleValue(b);
    return a.source === b.source
      && Math.abs((Number(a.coordinate) || 0) - (Number(b.coordinate) || 0)) < 1
      && Math.abs((Number(a.end) || 0) - (Number(b.end) || 0)) < 1
      && (!isFinite(aSpeed) || !isFinite(bSpeed) || Math.abs(aSpeed - bSpeed) < 0.1);
  }

  function getSpeedVisualPriority(rule, activeSpeed, center) {
    if (!rule) return 0;
    var priority = getSpeedRulePriority(rule);
    var distance = getRangeDistanceFromCenter(rule.coordinate, rule.end, center);
    var speed = getSpeedRuleValue(rule);
    if (isSameSpeedRule(rule, activeSpeed)) priority += 90;
    if (distance === 0) priority += 42;
    else if (distance <= APK_LABEL_FOCUS_RADIUS_M) priority += 24;
    else if (distance <= APK_LABEL_CONTEXT_RADIUS_M) priority += 9;
    if (rule.conflict) priority += 22;
    if (isFinite(speed) && speed <= 45) priority += 10;
    else if (isFinite(speed) && speed <= 65) priority += 5;
    return priority;
  }

  function getSpeedRuleStroke(rule, isActive, isDimmed, isPreview) {
    var speed = getSpeedRuleValue(rule);
    var alpha = isActive ? (isPreview ? 0.86 : 0.96) : isDimmed ? (isPreview ? 0.22 : 0.26) : (isPreview ? 0.48 : 0.58);
    if (rule.source === 'warning') return 'rgba(251, 113, 133, ' + (isActive ? 0.96 : isDimmed ? 0.38 : 0.82) + ')';
    if (rule.source === 'document' && rule.conflict) return 'rgba(168, 85, 247, ' + (isActive ? 0.96 : isDimmed ? 0.36 : 0.74) + ')';
    if (rule.source === 'document') return 'rgba(56, 189, 248, ' + (isActive ? 0.94 : isDimmed ? 0.34 : 0.70) + ')';
    if (rule.source === 'regime') return 'rgba(251, 146, 60, ' + (isActive ? 0.94 : isDimmed ? 0.30 : 0.62) + ')';
    if (rule.source === 'user') return 'rgba(74, 222, 128, ' + (isActive ? 0.94 : isDimmed ? 0.32 : 0.68) + ')';
    if (isFinite(speed) && speed <= 45) return 'rgba(244, 63, 94, ' + alpha + ')';
    if (isFinite(speed) && speed <= 65) return 'rgba(250, 204, 21, ' + alpha + ')';
    return 'rgba(74, 222, 128, ' + alpha + ')';
  }

  function getSpeedRuleLabelTone(rule, isWarning, isDocConflict, isDocument, isRegime) {
    if (isWarning) {
      return {
        fill: 'rgba(88, 20, 36, 0.84)',
        stroke: 'rgba(251, 113, 133, 0.40)',
        text: '#fecdd3'
      };
    }
    if (isDocConflict) {
      return {
        fill: 'rgba(59, 7, 100, 0.82)',
        stroke: 'rgba(168, 85, 247, 0.42)',
        text: '#e9d5ff'
      };
    }
    if (isDocument) {
      return {
        fill: 'rgba(8, 47, 73, 0.82)',
        stroke: 'rgba(56, 189, 248, 0.42)',
        text: '#bae6fd'
      };
    }
    if (isRegime) {
      return {
        fill: 'rgba(124, 45, 18, 0.80)',
        stroke: 'rgba(251, 146, 60, 0.40)',
        text: '#fed7aa'
      };
    }
    if (rule && rule.source === 'user') {
      return {
        fill: 'rgba(20, 83, 45, 0.78)',
        stroke: 'rgba(74, 222, 128, 0.36)',
        text: '#bbf7d0'
      };
    }
    return {
      fill: 'rgba(9, 10, 15, 0.78)',
      stroke: 'rgba(255, 255, 255, 0.10)',
      text: THEME.text
    };
  }

  function getSpeedRowColor(rule, isDimmed) {
    var speed = getSpeedRuleValue(rule);
    var alpha = isDimmed ? 0.46 : 0.92;
    if (isFinite(speed)) {
      if (speed >= 80) return 'rgba(74, 222, 128, ' + alpha + ')';
      if (speed >= 70) return 'rgba(56, 189, 248, ' + alpha + ')';
      if (speed >= 60) return 'rgba(250, 204, 21, ' + alpha + ')';
      if (speed >= 40) return 'rgba(251, 146, 60, ' + alpha + ')';
      return 'rgba(251, 113, 133, ' + alpha + ')';
    }
    return 'rgba(136, 146, 164, ' + alpha + ')';
  }

  function getSpeedRowTextColor(rule, isActive) {
    if (isActive) return THEME.text;
    var speed = getSpeedRuleValue(rule);
    if (isFinite(speed)) {
      if (speed >= 80) return '#bbf7d0';
      if (speed >= 70) return '#bae6fd';
      if (speed >= 60) return '#fde68a';
      if (speed >= 40) return '#fed7aa';
      return '#fecdd3';
    }
    return 'rgba(238, 242, 248, 0.82)';
  }

  function getSpeedLaneValue(rule) {
    var speed = getSpeedRuleValue(rule);
    if (isFinite(speed)) return Math.round(speed);
    return 0;
  }

  function shouldDrawSpeedBandLabel(rule, activeSpeed, center, priority, drawnLabels, maxLabels) {
    if (!rule || drawnLabels >= maxLabels || isSameSpeedRule(rule, activeSpeed)) return false;
    var distance = getRangeDistanceFromCenter(rule.coordinate, rule.end, center);
    if (rule.source === 'warning' || rule.conflict) return distance <= APK_LABEL_CONTEXT_RADIUS_M;
    if (rule.source === 'document' || rule.source === 'regime') return distance <= APK_LABEL_FOCUS_RADIUS_M;
    return priority >= 44 && distance <= APK_LABEL_FOCUS_RADIUS_M;
  }

  function drawApkSpeedBands(ctx, layout, center, sector, speedRules, activeSpeed, isPreview, labelLayout) {
    var maxLanes = 4;
    var maxLabels = isPreview ? 4 : 5;
    var labelRightByLane = [];
    var drawnLabels = 0;
    ctx.save();
    var bounds = getApkVisibleBounds(center, layout);
    var topY = Math.max(138, layout.profileTop - 54);
    var railBottomY = topY + maxLanes * 14 + 4;
    ctx.strokeStyle = 'rgba(238, 242, 248, 0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(layout.viewportX + 8, railBottomY);
    ctx.lineTo(layout.viewportRight - 8, railBottomY);
    ctx.stroke();
    var prepared = (speedRules || []).map(function(rule) {
      return {
        rule: rule,
        priority: getSpeedVisualPriority(rule, activeSpeed, center)
      };
    });
    var laneValues = [];
    for (var laneSourceIndex = 0; laneSourceIndex < prepared.length; laneSourceIndex++) {
      var laneValue = getSpeedLaneValue(prepared[laneSourceIndex].rule);
      if (laneValue > 0 && laneValues.indexOf(laneValue) < 0) laneValues.push(laneValue);
    }
    laneValues.sort(function(a, b) { return b - a; });
    if (laneValues.length > maxLanes) laneValues = laneValues.slice(0, maxLanes);
    prepared.sort(function(a, b) {
      var aSpeed = getSpeedLaneValue(a.rule);
      var bSpeed = getSpeedLaneValue(b.rule);
      return bSpeed - aSpeed || a.rule.coordinate - b.rule.coordinate || b.priority - a.priority;
    });
    for (var i = 0; i < prepared.length; i++) {
      var rule = prepared[i].rule;
      var priority = prepared[i].priority;
      var isWarning = rule.source === 'warning';
      var isDocument = rule.source === 'document';
      var isDocConflict = isDocument && rule.conflict;
      var isActive = isSameSpeedRule(rule, activeSpeed);
      var start = Math.max(rule.coordinate, bounds.left);
      var end = Math.min(rule.end, bounds.right);
      if (end < start) continue;
      var xSpan = getObjectXSpan({ coordinate: start, end: end, length: end - start }, center, layout);
      var visibleWidth = xSpan.x2 - xSpan.x1;
      var distance = getRangeDistanceFromCenter(rule.coordinate, rule.end, center);
      var isDimmed = !isActive && !isWarning && !isDocConflict && distance > APK_LABEL_CONTEXT_RADIUS_M;
      if (isDimmed && visibleWidth < (isPreview ? 28 : 38)) continue;
      var speedValue = getSpeedLaneValue(rule);
      var lane = laneValues.indexOf(speedValue);
      if (lane < 0) continue;
      var y = topY + lane * 14;
      var width = isActive ? 5 : (isDimmed ? 2.2 : 3.6);
      var stroke = getSpeedRowColor(rule, isDimmed);
      ctx.globalAlpha = isDimmed ? 0.52 : 1;
      ctx.strokeStyle = 'rgba(3, 7, 18, 0.72)';
      ctx.lineWidth = width + 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xSpan.x1, y);
      ctx.lineTo(xSpan.x2, y);
      ctx.stroke();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(xSpan.x1, y);
      ctx.lineTo(xSpan.x2, y);
      ctx.stroke();
      ctx.globalAlpha = 1;

      var mid = (start + end) / 2;
      var labelX = clamp(coordinateToApkX(mid, center, layout), xSpan.x1 + 14, xSpan.x2 - 14);
      var labelGap = isPreview ? 50 : 58;
      var wideEnough = visibleWidth > (isPreview ? 34 : 42);
      var shouldLabel = isActive || shouldDrawSpeedBandLabel(rule, activeSpeed, center, priority, drawnLabels, maxLabels) || (distance <= APK_LABEL_FOCUS_RADIUS_M && wideEnough);
      var labelRight = isFinite(labelRightByLane[lane]) ? labelRightByLane[lane] : -Infinity;
      if (wideEnough && shouldLabel && labelX > labelRight + labelGap && drawnLabels < maxLabels) {
        var speed = getSpeedRuleValue(rule);
        var label = isFinite(speed) ? Math.round(speed) + ' км/ч' : formatSpeedRuleDisplay(rule);
        var labelColor = getSpeedRowTextColor(rule, isActive);
        drawText(ctx, label, labelX, y - 5, {
          size: isActive ? 10 : 9,
          weight: 850,
          color: labelColor,
          align: 'center',
          maxWidth: Math.min(72, visibleWidth + 12)
        });
        labelRightByLane[lane] = labelX + Math.min(72, label.length * 5.5) / 2;
        drawnLabels += 1;
      }
    }
    ctx.restore();
  }

  function computeAvgProfileAngle(center, sector, layout) {
    var trainMeters = getTrainLengthMeters();
    var minCoordinate = tracker.even ? center - trainMeters : center;
    var maxCoordinate = tracker.even ? center : center + trainMeters;
    var source = getVisibleProfileSegmentsForWindow(minCoordinate, maxCoordinate, sector);
    var weighted = 0;
    var length = 0;
    for (var i = 0; i < source.length; i++) {
      var overlap = Math.min(maxCoordinate, source[i].end) - Math.max(minCoordinate, source[i].start);
      if (overlap <= 0) continue;
      weighted += overlap * source[i].grade;
      length += overlap;
    }
    return length > 0 ? layout.direction * weighted / length : 0;
  }

  function collectTrainProfilePath(center, sector, layout, trainMeters) {
    var lengthMeters = Math.max(1, Math.round(Number(trainMeters) || getTrainLengthMeters()));
    var tail = tracker.even ? center - lengthMeters : center + lengthMeters;
    var head = center;
    var left = Math.min(tail, head);
    var right = Math.max(tail, head);
    var points = {};
    function add(value) {
      if (!isFinite(value)) return;
      if (value < left - 1 || value > right + 1) return;
      points[String(Math.round(value))] = clamp(value, left, right);
    }
    add(tail);
    add(head);
    add(center);
    var step = Math.max(45, Math.min(95, lengthMeters / 10));
    for (var coord = left + step; coord < right; coord += step) add(coord);
    var segments = getVisibleProfileSegmentsForWindow(left, right, sector);
    for (var i = 0; i < segments.length; i++) {
      add(segments[i].start);
      add(segments[i].end);
    }
    var coords = Object.keys(points).map(function(key) {
      return points[key];
    });
    coords.sort(function(a, b) {
      return coordinateToApkX(a, center, layout) - coordinateToApkX(b, center, layout);
    });
    return coords.map(function(coordinate) {
      return {
        coordinate: coordinate,
        x: coordinateToApkX(coordinate, center, layout),
        y: getProfileYAt(coordinate, center, sector, layout)
      };
    });
  }

  function strokeTrainProfilePath(ctx, points, width, color, shadow, alpha) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = isFinite(alpha) ? alpha : 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = shadow || 'transparent';
    ctx.shadowBlur = shadow ? 12 : 0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTrainBodyDivisions(ctx, layout, center, sector, trainMeters, bodyHeight, isPreview) {
    var lengthMeters = Math.max(1, Math.round(Number(trainMeters) || 0));
    if (lengthMeters < 120) return;
    var divisionStep = Math.max(120, Math.round(16 / Math.max(0.01, layout.oneMeter)));
    var maxLines = Math.min(12, Math.floor(lengthMeters / divisionStep));
    ctx.save();
    ctx.strokeStyle = isPreview ? 'rgba(3, 7, 18, 0.28)' : 'rgba(3, 7, 18, 0.42)';
    ctx.lineWidth = 1;
    for (var i = 1; i <= maxLines; i++) {
      var offset = Math.min(lengthMeters - 12, i * divisionStep);
      var coordinate = tracker.even ? center - offset : center + offset;
      var x = coordinateToApkX(coordinate, center, layout);
      if (x < layout.viewportX - 14 || x > layout.viewportRight + 14) continue;
      var y = getProfileYAt(coordinate, center, sector, layout);
      var angle = getProfileTangentAngle(coordinate, center, sector, layout);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -bodyHeight / 2 + 2);
      ctx.lineTo(0, bodyHeight / 2 - 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawTrainProfileWheels(ctx, layout, center, sector, trainMeters, bodyHeight, isPreview) {
    var lengthMeters = Math.max(1, Math.round(Number(trainMeters) || 0));
    if (lengthMeters < 80) return;
    var wheelStep = Math.max(150, Math.round(22 / Math.max(0.01, layout.oneMeter)));
    var maxWheels = Math.min(10, Math.floor(lengthMeters / wheelStep) + 1);
    ctx.save();
    ctx.fillStyle = isPreview ? 'rgba(3, 7, 18, 0.50)' : 'rgba(3, 7, 18, 0.74)';
    for (var i = 0; i < maxWheels; i++) {
      var offset = Math.min(lengthMeters - 8, 12 + i * wheelStep);
      var coordinate = tracker.even ? center - offset : center + offset;
      var x = coordinateToApkX(coordinate, center, layout);
      if (x < layout.viewportX - 12 || x > layout.viewportRight + 12) continue;
      var y = getProfileYAt(coordinate, center, sector, layout);
      var angle = getProfileTangentAngle(coordinate, center, sector, layout);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.arc(0, bodyHeight / 2 + 2, Math.max(2, layout.xUnit * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawTrainHead(ctx, layout, center, sector, bodyHeight, bodyColor, isLive, isPreview) {
    var headX = layout.headX;
    var headY = getProfileYAt(center, center, sector, layout);
    var angle = getProfileTangentAngle(center, center, sector, layout);
    var nose = Math.max(9, Math.min(18, layout.xUnit * 2.35));
    var cabWidth = Math.max(14, Math.min(24, layout.xUnit * 3.4));
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(angle);
    ctx.globalAlpha = isPreview ? 0.90 : 1;
    ctx.shadowColor = isLive ? 'rgba(74, 222, 128, 0.42)' : 'rgba(56, 189, 248, 0.24)';
    ctx.shadowBlur = isPreview ? 8 : 12;
    fillRoundRect(ctx, -cabWidth, -bodyHeight / 2, cabWidth + 2, bodyHeight, 4, bodyColor);
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -bodyHeight / 2);
    ctx.lineTo(nose, 0);
    ctx.lineTo(0, bodyHeight / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(3, 7, 18, 0.94)';
    ctx.lineWidth = 2;
    strokeRoundRect(ctx, -cabWidth + 0.5, -bodyHeight / 2 + 0.5, cabWidth + 1, bodyHeight - 1, 4, ctx.strokeStyle);
    ctx.beginPath();
    ctx.moveTo(0, -bodyHeight / 2 + 1);
    ctx.lineTo(nose - 0.5, 0);
    ctx.lineTo(0, bodyHeight / 2 - 1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(238, 242, 248, 0.76)';
    ctx.beginPath();
    ctx.moveTo(-cabWidth + 4, -bodyHeight / 2 + 4);
    ctx.lineTo(-Math.max(5, cabWidth * 0.24), -bodyHeight / 2 + 4);
    ctx.lineTo(-Math.max(7, cabWidth * 0.30), -1);
    ctx.lineTo(-cabWidth + 3, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(3, 7, 18, 0.82)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(3, layout.xUnit * 0.58), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTrainProfileGuide(ctx, layout, center, sector, trainMeters, isLive, isPreview) {
    var span = Math.max(120, Math.min(320, Math.round((Number(trainMeters) || getTrainLengthMeters()) * 0.18)));
    var left = center - span;
    var right = center + span;
    ctx.save();
    drawProfileRange(ctx, layout, center, sector, left, right, 0, 'rgba(3, 7, 18, 0.72)', Math.max(3.2, layout.xUnit * 0.54));
    drawProfileRange(ctx, layout, center, sector, left, right, 0, isLive ? 'rgba(98, 255, 151, 0.90)' : 'rgba(91, 210, 255, 0.90)', Math.max(2.0, layout.xUnit * 0.34));
    ctx.restore();
  }

  function drawApkTrainLengthBlock(ctx, layout, center, sector, trainMeters, isLive, isPreview) {
    var realMeters = Math.max(TRAIN_LOCO_LENGTH_M, Math.round(Number(trainMeters) || TRAIN_LOCO_LENGTH_M));
    var minVisibleMeters = Math.round((isPreview ? 34 : 38) / Math.max(0.01, layout.oneMeter));
    var visualMeters = Math.max(realMeters, minVisibleMeters);
    var points = collectTrainProfilePath(center, sector, layout, visualMeters);
    if (!points || points.length < 2) return;
    var bodyHeight = Math.max(10, Math.min(isPreview ? 15 : 17, layout.xUnit * 2.45));
    var fill = isLive ? 'rgba(74, 222, 128, 0.56)' : 'rgba(56, 189, 248, 0.42)';
    var edge = isLive ? 'rgba(187, 247, 208, 0.80)' : 'rgba(125, 211, 252, 0.86)';
    ctx.save();
    strokeTrainProfilePath(ctx, points, bodyHeight + 5, 'rgba(3, 7, 18, 0.84)', null, isPreview ? 0.76 : 0.88);
    strokeTrainProfilePath(ctx, points, bodyHeight, fill, isLive ? 'rgba(74, 222, 128, 0.18)' : 'rgba(56, 189, 248, 0.16)', isPreview ? 0.82 : 0.94);
    strokeTrainProfilePath(ctx, points, Math.max(2.2, bodyHeight * 0.22), edge, null, isPreview ? 0.56 : 0.72);
    ctx.restore();
  }

  function drawApkTrain(ctx, layout, center, sector, avgAngle, isPreview) {
    var isLive = tracker.status === 'gps-live' && !isPreview;
    var details = getPoekhaliTrainDetails();
    var trainMeters = Math.max(1, Math.round(Number(details && details.lengthMeters) || getTrainLengthMeters()));
    var bodyHeight = Math.max(10, Math.min(isPreview ? 15 : 17, layout.xUnit * 2.45));
    var bodyColor = isLive ? 'rgba(74, 222, 128, 0.88)' : 'rgba(56, 189, 248, 0.84)';
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.viewportX - 18, layout.profileTop - 64, layout.viewportWidth + 36, layout.trackY - layout.profileTop + 58);
    ctx.clip();
    drawTrainProfileGuide(ctx, layout, center, sector, trainMeters, isLive, isPreview);
    drawApkTrainLengthBlock(ctx, layout, center, sector, trainMeters, isLive, isPreview);
    drawTrainHead(ctx, layout, center, sector, bodyHeight, bodyColor, isLive, isPreview);
    ctx.restore();
  }

  function drawApkPreviewCursor(ctx, layout, center, sector) {
    var y = getProfileYAt(center, center, sector, layout);
    ctx.save();
    ctx.strokeStyle = 'rgba(91, 210, 255, 0.54)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(layout.headX, y + 11);
    ctx.lineTo(layout.headX, layout.trackY - 16);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.shadowColor = 'rgba(91, 210, 255, 0.30)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(9, 10, 15, 0.82)';
    ctx.strokeStyle = THEME.accentStrong;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(layout.headX, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.restore();
  }

  function drawApkGradeLabels(ctx, layout, center, sector, bounds, isPreview, labelLayout) {
    var segments = getVisibleProfileSegmentsForWindow(bounds.left, bounds.right, sector);
    var lastX = -Infinity;
    ctx.save();
    for (var i = 0; i < segments.length; i++) {
      var start = Math.max(segments[i].start, bounds.left);
      var end = Math.min(segments[i].end, bounds.right);
      if (end - start < (isPreview ? 260 : 220)) continue;
      var mid = (start + end) / 2;
      var x = coordinateToApkX(mid, center, layout);
      var grade = segments[i].grade;
      var distance = getRangeDistanceFromCenter(start, end, center);
      var meaningful = Math.abs(grade) >= 1.2 || distance <= APK_LABEL_FOCUS_RADIUS_M;
      if (!meaningful || distance > APK_LABEL_CONTEXT_RADIUS_M) continue;
      if (x < layout.viewportX + 18 || x > layout.viewportRight - 18 || x - lastX < (isPreview ? 96 : 118)) continue;
      var avoidLeft = isPreview ? layout.headX - 34 : layout.headX - layout.trainWidth - 26;
      var avoidRight = isPreview ? layout.headX + 34 : layout.headX + 26;
      if (x > avoidLeft && x < avoidRight) continue;
      var label = formatProfileGradeLabel(segments[i]);
      var profileY = getProfileYAt(mid, center, sector, layout);
      var laneLift = isPreview ? 32 : (i % 2 ? 28 : 18);
      var y = clamp(profileY - laneLift, layout.profileTop + 18, layout.profileBottom - 8);
      var width = Math.max(38, label.length * 7 + 8);
      if (!reserveLabel(labelLayout, x, y - 4, width, 20, isPreview ? 8 : 5)) continue;
      fillRoundRect(ctx, x - width / 2, y - 14, width, 20, 6, grade >= 0 ? 'rgba(74, 222, 128, 0.13)' : 'rgba(56, 189, 248, 0.15)');
      strokeRoundRect(ctx, x - width / 2 + 0.5, y - 13.5, width - 1, 19, 6, grade >= 0 ? 'rgba(74, 222, 128, 0.28)' : 'rgba(56, 189, 248, 0.30)');
      drawText(ctx, label, x, y + 1, {
        size: 9,
        weight: 850,
        color: grade >= 0 ? THEME.green : THEME.accentStrong,
        align: 'center',
        maxWidth: width - 5
      });
      lastX = x + width / 2;
    }
    ctx.restore();
  }

  function findNextSignalForDirection(center, sector) {
    var objects = getTrackObjectsForSector(sector).filter(function(item) {
      return item.type === '1';
    }).sort(function(a, b) {
      return a.coordinate - b.coordinate;
    });
    if (tracker.even) {
      for (var i = 0; i < objects.length; i++) {
        if (objects[i].coordinate >= center) return objects[i];
      }
      return null;
    }
    for (var j = objects.length - 1; j >= 0; j--) {
      if (objects[j].coordinate <= center) return objects[j];
    }
    return null;
  }

  function findNextRegimeControlMarkForDirection(center, sector, kind) {
    var marks = getRegimeControlMarksForSector(sector).filter(function(item) {
      return !kind || item.kind === kind;
    }).sort(function(a, b) {
      return a.coordinate - b.coordinate;
    });
    if (tracker.even) {
      for (var i = 0; i < marks.length; i++) {
        if (marks[i].coordinate >= center) return marks[i];
      }
      return null;
    }
    for (var j = marks.length - 1; j >= 0; j--) {
      if (marks[j].coordinate <= center) return marks[j];
    }
    return null;
  }

  function findNextWarningForDirection(center, sector) {
    var sectorKey = getSectorKey(sector);
    var warnings = getCurrentWarnings().filter(function(item) {
      return getSectorKey(item.sector) === sectorKey;
    });
    var best = null;
    for (var i = 0; i < warnings.length; i++) {
      var warning = warnings[i];
      var status = getWarningRuntimeStatus(warning, {
        sector: sector,
        lineCoordinate: center
      });
      if (status !== 'active' && status !== 'ahead') continue;
      var anchor = status === 'active'
        ? center
        : tracker.even
          ? warning.start
          : warning.end;
      var distance = status === 'active' ? 0 : Math.abs(anchor - center);
      if (!best || distance < best.distance) {
        best = {
          item: warning,
          status: status,
          anchor: anchor,
          distance: distance
        };
      }
    }
    return best;
  }

  function drawApkWarningCue(ctx, layout, center, sector, nextWarning, isPreview, labelLayout) {
    return;
    if (!nextWarning) return;
    var item = nextWarning.item;
    if (!item) return;
    var anchor = isFinite(nextWarning.anchor) ? nextWarning.anchor : item.start;
    var x = clamp(coordinateToApkX(anchor, center, layout), layout.viewportX + 42, layout.viewportRight - 42);
    var profileY = getProfileYAt(anchor, center, sector, layout);
    var label = nextWarning.status === 'active'
      ? 'ПР действует'
      : 'ПР через ' + formatDistanceLabel(nextWarning.distance);
    var value = 'до ' + Math.round(item.speed);
    var labelWidth = Math.min(layout.viewportWidth - 34, Math.max(92, label.length * 7 + value.length * 6 + 22));
    var candidates = [
      profileY - 48,
      profileY + 36,
      layout.profileTop + 24,
      layout.profileBottom - 10
    ];
    var y = candidates[0];
    var reserved = false;
    for (var i = 0; i < candidates.length; i++) {
      y = clamp(candidates[i], layout.profileTop + 18, layout.trackY - 42);
      if (reserveLabel(labelLayout, x, y - 4, labelWidth, 30, 6)) {
        reserved = true;
        break;
      }
    }
    if (!reserved) return;

    ctx.save();
    ctx.strokeStyle = nextWarning.status === 'active'
      ? (isPreview ? 'rgba(251, 113, 133, 0.46)' : 'rgba(251, 113, 133, 0.62)')
      : (isPreview ? 'rgba(250, 204, 21, 0.38)' : 'rgba(250, 204, 21, 0.50)');
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, profileY - 4);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    fillRoundRect(
      ctx,
      x - labelWidth / 2,
      y - 17,
      labelWidth,
      30,
      9,
      nextWarning.status === 'active'
        ? (isPreview ? 'rgba(88, 20, 36, 0.78)' : 'rgba(88, 20, 36, 0.88)')
        : (isPreview ? 'rgba(113, 63, 18, 0.76)' : 'rgba(113, 63, 18, 0.86)')
    );
    strokeRoundRect(
      ctx,
      x - labelWidth / 2 + 0.5,
      y - 16.5,
      labelWidth - 1,
      29,
      9,
      nextWarning.status === 'active'
        ? (isPreview ? 'rgba(251, 113, 133, 0.32)' : 'rgba(251, 113, 133, 0.42)')
        : (isPreview ? 'rgba(250, 204, 21, 0.28)' : 'rgba(250, 204, 21, 0.38)')
    );
    drawText(ctx, label, x, y - 3, {
      size: 9,
      weight: 850,
      color: nextWarning.status === 'active' ? '#fda4af' : '#fde68a',
      align: 'center',
      maxWidth: labelWidth - 10
    });
    drawText(ctx, value, x, y + 9, {
      size: 8,
      weight: 850,
      color: THEME.text,
      align: 'center',
      maxWidth: labelWidth - 10
    });
    ctx.restore();
  }

  function getNextRestrictionCueTone(restriction, isPreview) {
    if (!restriction) {
      return {
        fill: 'rgba(9, 10, 15, 0.74)',
        stroke: 'rgba(136, 146, 164, 0.26)',
        text: THEME.text,
        sub: THEME.sub,
        line: 'rgba(136, 146, 164, 0.32)'
      };
    }
    if (restriction.source === 'document') {
      var docConflict = restriction.conflict;
      return {
        fill: docConflict ? 'rgba(113, 63, 18, 0.84)' : 'rgba(8, 47, 73, 0.84)',
        stroke: docConflict ? 'rgba(250, 204, 21, 0.42)' : 'rgba(56, 189, 248, 0.42)',
        text: docConflict ? '#fde68a' : '#7dd3fc',
        sub: THEME.text,
        line: docConflict
          ? (isPreview ? 'rgba(250, 204, 21, 0.36)' : 'rgba(250, 204, 21, 0.52)')
          : (isPreview ? 'rgba(56, 189, 248, 0.36)' : 'rgba(56, 189, 248, 0.54)')
      };
    }
    if (restriction.source === 'regime') {
      return {
        fill: 'rgba(124, 45, 18, 0.84)',
        stroke: 'rgba(251, 146, 60, 0.42)',
        text: '#fed7aa',
        sub: THEME.text,
        line: isPreview ? 'rgba(251, 146, 60, 0.34)' : 'rgba(251, 146, 60, 0.52)'
      };
    }
    return {
      fill: 'rgba(9, 10, 15, 0.78)',
      stroke: 'rgba(250, 204, 21, 0.34)',
      text: '#fde68a',
      sub: THEME.text,
      line: isPreview ? 'rgba(250, 204, 21, 0.30)' : 'rgba(250, 204, 21, 0.44)'
    };
  }

  function drawApkNextRestrictionCue(ctx, layout, center, sector, nextRestriction, isPreview, labelLayout) {
    return;
    if (!nextRestriction || nextRestriction.source === 'warning') return;
    var anchor = Number(nextRestriction.coordinate);
    if (!isFinite(anchor)) return;
    var bounds = getApkVisibleBounds(center, layout);
    var cueCoordinate = clamp(anchor, bounds.left, bounds.right);
    var offscreen = anchor < bounds.left || anchor > bounds.right;
    var x = clamp(coordinateToApkX(cueCoordinate, center, layout), layout.viewportX + 46, layout.viewportRight - 46);
    var profileY = getProfileYAt(cueCoordinate, center, sector, layout);
    var speedText = nextRestriction.speedKmh ? String(Math.round(nextRestriction.speedKmh)) : formatSpeedLabel(nextRestriction);
    var title = 'Далее ' + (nextRestriction.sourceLabel || 'ОГР') + ' ' + speedText;
    var distance = Math.max(0, Math.round(Number(nextRestriction.distance) || 0));
    var eta = formatEtaSeconds(estimateEtaSeconds(distance, getCurrentEtaSpeedKmh()), true);
    var value = formatDistanceLabel(distance) + (eta ? ' · ' + eta : '') + ' · ' + formatLineCoordinate(anchor);
    var labelWidth = Math.min(layout.viewportWidth - 28, Math.max(104, title.length * 7 + 18, value.length * 6 + 18));
    var candidates = offscreen
      ? [layout.profileTop + 24, profileY - 50, profileY + 34, layout.profileBottom - 14]
      : [profileY - 50, profileY + 36, layout.profileTop + 24, layout.profileBottom - 14];
    var y = candidates[0];
    var reserved = false;
    for (var i = 0; i < candidates.length; i++) {
      y = clamp(candidates[i], layout.profileTop + 18, layout.trackY - 42);
      if (reserveLabel(labelLayout, x, y - 4, labelWidth, 31, 6)) {
        reserved = true;
        break;
      }
    }
    if (!reserved) return;

    var tone = getNextRestrictionCueTone(nextRestriction, isPreview);
    ctx.save();
    ctx.strokeStyle = tone.line;
    ctx.lineWidth = 1.1;
    ctx.setLineDash(offscreen ? [3, 5] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, profileY - 5);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tone.text;
    ctx.shadowColor = tone.text;
    ctx.shadowBlur = isPreview ? 0 : 8;
    ctx.beginPath();
    ctx.arc(x, profileY, offscreen ? 3.5 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    fillRoundRect(ctx, x - labelWidth / 2, y - 17, labelWidth, 31, 9, tone.fill);
    strokeRoundRect(ctx, x - labelWidth / 2 + 0.5, y - 16.5, labelWidth - 1, 30, 9, tone.stroke);
    drawText(ctx, title, x, y - 3, {
      size: 9,
      weight: 850,
      color: tone.text,
      align: 'center',
      maxWidth: labelWidth - 10
    });
    drawText(ctx, value, x, y + 10, {
      size: 8,
      weight: 850,
      color: tone.sub,
      align: 'center',
      maxWidth: labelWidth - 10
    });
    ctx.restore();
  }

  function drawApkRouteTargetCue(ctx, layout, center, sector, routeProgress, isPreview, labelLayout) {
    return;
    if (!routeProgress || !isFinite(routeProgress.distanceMeters)) return;
    if (routeProgress.status === 'after') return;
    var targetCoordinate = routeProgress.status === 'before'
      ? Number(routeProgress.fromCoordinate)
      : Number(routeProgress.toCoordinate);
    if (!isFinite(targetCoordinate)) return;
    var distance = routeProgress.status === 'before'
      ? Number(routeProgress.outsideMeters) || 0
      : Number(routeProgress.remainingMeters) || 0;
    var bounds = getApkVisibleBounds(center, layout);
    var offscreen = targetCoordinate < bounds.left || targetCoordinate > bounds.right;
    if (offscreen && distance > 2500) return;

    var cueCoordinate = clamp(targetCoordinate, bounds.left, bounds.right);
    var x = clamp(coordinateToApkX(cueCoordinate, center, layout), layout.viewportX + 50, layout.viewportRight - 50);
    var profileY = getProfileYAt(cueCoordinate, center, sector, layout);
    var title = routeProgress.status === 'before' ? 'Старт маршрута' : 'Финиш маршрута';
    var targetName = getRouteProgressName(routeProgress.status === 'before' ? routeProgress.fromName : routeProgress.toName, '');
    var eta = formatEtaSeconds(estimateEtaSeconds(distance, getCurrentEtaSpeedKmh()), true);
    var value = (targetName ? targetName + ' · ' : '') + formatDistanceLabel(distance) + (eta ? ' · ' + eta : '');
    var labelWidth = Math.min(layout.viewportWidth - 28, Math.max(118, title.length * 7 + 18, value.length * 6 + 18));
    var candidates = offscreen
      ? [layout.profileTop + 24, layout.profileBottom - 18, profileY + 38, profileY - 50]
      : [profileY + 38, profileY - 50, layout.profileTop + 24, layout.profileBottom - 18];
    var y = candidates[0];
    var reserved = false;
    for (var i = 0; i < candidates.length; i++) {
      y = clamp(candidates[i], layout.profileTop + 18, layout.trackY - 42);
      if (reserveLabel(labelLayout, x, y - 4, labelWidth, 31, 6)) {
        reserved = true;
        break;
      }
    }
    if (!reserved) return;

    var marker = routeProgress.status === 'before' ? '#7dd3fc' : '#86efac';
    ctx.save();
    ctx.strokeStyle = isPreview ? 'rgba(125, 211, 252, 0.30)' : 'rgba(125, 211, 252, 0.46)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash(offscreen ? [3, 5] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, profileY - 5);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = marker;
    ctx.shadowColor = marker;
    ctx.shadowBlur = isPreview ? 0 : 9;
    ctx.beginPath();
    ctx.moveTo(x, profileY - 8);
    ctx.lineTo(x + 8, profileY);
    ctx.lineTo(x, profileY + 8);
    ctx.lineTo(x - 8, profileY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    fillRoundRect(ctx, x - labelWidth / 2, y - 17, labelWidth, 31, 9, 'rgba(9, 10, 15, 0.82)');
    strokeRoundRect(ctx, x - labelWidth / 2 + 0.5, y - 16.5, labelWidth - 1, 30, 9, 'rgba(125, 211, 252, 0.34)');
    drawText(ctx, title, x, y - 3, {
      size: 9,
      weight: 850,
      color: marker,
      align: 'center',
      maxWidth: labelWidth - 10
    });
    drawText(ctx, value, x, y + 10, {
      size: 8,
      weight: 850,
      color: THEME.text,
      align: 'center',
      maxWidth: labelWidth - 10
    });
    ctx.restore();
  }

  function drawReferenceBadge(ctx, panel, center) {
    if (!tracker.referenceLoaded) return;
    var context = getReferenceContext(center);
    var label = context ? context.haul.name : getReferenceSummary();
    var value = context
      ? (context.station.name + ' · ' + context.km + ' км')
      : 'справочник';

    drawText(ctx, label, panel.x + panel.width - 14, panel.y + 24, {
      size: 10,
      weight: 850,
      color: context ? THEME.accentStrong : THEME.sub,
      align: 'right',
      maxWidth: Math.max(110, panel.width - 170)
    });
    drawText(ctx, value, panel.x + panel.width - 14, panel.y + 44, {
      size: 11,
      weight: 800,
      color: context ? THEME.text : THEME.muted,
      align: 'right',
      maxWidth: Math.max(110, panel.width - 170)
    });
  }

  function drawKmGrid(ctx, panel, plotTop, speedBottom, trackY, center, halfWindow) {
    var centerX = panel.x + panel.width / 2;
    var left = center - halfWindow;
    var right = center + halfWindow;
    var firstKm = Math.floor(left / 1000) * 1000;
    ctx.save();
    ctx.strokeStyle = 'rgba(136, 146, 164, 0.16)';
    ctx.lineWidth = 1;
    for (var km = firstKm; km <= right + 1000; km += 1000) {
      var x = Math.round(xForCoordinate(km, center, centerX));
      if (x < panel.x + 12 || x > panel.x + panel.width - 12) continue;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, speedBottom);
      ctx.stroke();
      drawText(ctx, String(Math.floor(km / 1000)), x, trackY + 36, {
        size: 10,
        weight: 750,
        color: 'rgba(238, 242, 248, 0.62)',
        align: 'center'
      });
    }
    ctx.restore();
  }

  function drawProfileLine(ctx, panel, plotTop, plotBottom, center, halfWindow, sector) {
    var visible = getVisibleProfile(center, halfWindow, sector);
    if (!visible.length) {
      ctx.strokeStyle = 'rgba(136, 146, 164, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panel.x + 16, Math.round((plotTop + plotBottom) / 2));
      ctx.lineTo(panel.x + panel.width - 16, Math.round((plotTop + plotBottom) / 2));
      ctx.stroke();
      drawText(ctx, 'ПРОФИЛЬ', panel.x + 14, panel.y + 48, {
        size: 10,
        weight: 850,
        color: THEME.muted
      });
      return null;
    }

    var centerX = panel.x + panel.width / 2;
    var minElevation = Infinity;
    var maxElevation = -Infinity;
    for (var i = 0; i < visible.length; i++) {
      minElevation = Math.min(minElevation, visible[i].elevationStart, visible[i].elevationEnd);
      maxElevation = Math.max(maxElevation, visible[i].elevationStart, visible[i].elevationEnd);
    }
    var range = Math.max(8, maxElevation - minElevation);
    var yForElevation = function(elevation) {
      return plotBottom - ((elevation - minElevation) / range) * (plotBottom - plotTop);
    };

    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, panel.x + 12, plotTop - 8, panel.width - 24, plotBottom - plotTop + 16, 12);
    ctx.clip();

    ctx.strokeStyle = 'rgba(136, 146, 164, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panel.x + 16, yForElevation((minElevation + maxElevation) / 2));
    ctx.lineTo(panel.x + panel.width - 16, yForElevation((minElevation + maxElevation) / 2));
    ctx.stroke();

    ctx.strokeStyle = 'rgba(91, 210, 255, 0.90)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var started = false;
    for (var p = 0; p < visible.length; p++) {
      var point = visible[p];
      var x1 = xForCoordinate(point.start, center, centerX);
      var x2 = xForCoordinate(point.end, center, centerX);
      var y1 = yForElevation(point.elevationStart);
      var y2 = yForElevation(point.elevationEnd);
      if (!started) {
        ctx.moveTo(x1, y1);
        started = true;
      } else {
        ctx.lineTo(x1, y1);
      }
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.restore();

    drawText(ctx, 'ПРОФИЛЬ', panel.x + 14, panel.y + 48, {
      size: 10,
      weight: 850,
      color: THEME.sub
    });

    var elevation = getProfileElevationAt(center, sector);
    return elevation === null ? Math.round((plotTop + plotBottom) / 2) : yForElevation(elevation);
  }

  function drawStations(ctx, panel, trackY, center, objects) {
    var centerX = panel.x + panel.width / 2;
    var stations = objects.filter(function(item) { return item.type === '2'; });
    ctx.save();
    for (var i = 0; i < stations.length; i++) {
      var station = stations[i];
      var x1 = clamp(xForCoordinate(station.coordinate, center, centerX), panel.x + 16, panel.x + panel.width - 16);
      var x2 = clamp(xForCoordinate(station.end, center, centerX), panel.x + 16, panel.x + panel.width - 16);
      var width = Math.max(34, x2 - x1);
      fillRoundRect(ctx, x1, trackY - 58, width, 22, 8, 'rgba(56, 189, 248, 0.14)');
      strokeRoundRect(ctx, x1 + 0.5, trackY - 57.5, width - 1, 21, 8, 'rgba(56, 189, 248, 0.34)');
      drawText(ctx, station.name, x1 + width / 2, trackY - 43, {
        size: 10,
        weight: 850,
        color: THEME.accentStrong,
        align: 'center',
        maxWidth: width - 8
      });
    }
    ctx.restore();
  }

  function drawSignals(ctx, panel, trackY, center, objects) {
    var centerX = panel.x + panel.width / 2;
    var signals = objects.filter(function(item) { return item.type === '1'; }).slice(0, 28);
    ctx.save();
    ctx.strokeStyle = 'rgba(238, 242, 248, 0.62)';
    ctx.fillStyle = THEME.text;
    for (var i = 0; i < signals.length; i++) {
      var signal = signals[i];
      var x = xForCoordinate(signal.coordinate, center, centerX);
      if (x < panel.x + 12 || x > panel.x + panel.width - 12) continue;
      ctx.beginPath();
      ctx.moveTo(x, trackY - 24);
      ctx.lineTo(x, trackY + 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, trackY - 27, 4, 0, Math.PI * 2);
      ctx.fill();
      if (i % 2 === 0) {
        drawText(ctx, signal.name, x, trackY - 36, {
          size: 9,
          weight: 800,
          color: THEME.text,
          align: 'center',
          maxWidth: 46
        });
      }
    }
    ctx.restore();
  }

  function drawSpeedBands(ctx, panel, y, center, speedRules) {
    var centerX = panel.x + panel.width / 2;
    ctx.save();
    drawText(ctx, 'СКОРОСТИ', panel.x + 14, y - 7, {
      size: 10,
      weight: 850,
      color: THEME.sub
    });
    for (var i = 0; i < speedRules.length; i++) {
      var rule = speedRules[i];
      var x1 = clamp(xForCoordinate(rule.coordinate, center, centerX), panel.x + 16, panel.x + panel.width - 16);
      var x2 = clamp(xForCoordinate(rule.end, center, centerX), panel.x + 16, panel.x + panel.width - 16);
      var width = Math.max(24, x2 - x1);
      var speed = isFinite(rule.speed) ? rule.speed : 0;
      var fill = speed <= 40 ? 'rgba(244, 63, 94, 0.28)' : speed <= 60 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(74, 222, 128, 0.18)';
      var stroke = speed <= 40 ? 'rgba(244, 63, 94, 0.52)' : speed <= 60 ? 'rgba(250, 204, 21, 0.45)' : 'rgba(74, 222, 128, 0.42)';
      fillRoundRect(ctx, x1, y, width, 18, 7, fill);
      strokeRoundRect(ctx, x1 + 0.5, y + 0.5, width - 1, 17, 7, stroke);
      drawText(ctx, formatSpeedLabel(rule), x1 + width / 2, y + 13, {
        size: 10,
        weight: 850,
        color: THEME.text,
        align: 'center',
        maxWidth: width - 6
      });
    }
    ctx.restore();
  }

  function drawTrainMarker(ctx, x, y) {
    var trainColor = tracker.status === 'gps-live' ? THEME.green : THEME.danger;
    ctx.save();
    ctx.shadowColor = tracker.status === 'gps-live' ? 'rgba(74, 222, 128, 0.42)' : 'rgba(244, 63, 94, 0.32)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = trainColor;
    ctx.strokeStyle = THEME.bg;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 27);
    ctx.lineTo(x + 17, y + 18);
    ctx.lineTo(x - 17, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }

  function drawRouteStrip(ctx, w, h, displayProjection) {
    var projection = displayProjection || tracker.projection;
    if (!projection || (!projection.onTrack && !projection.preview)) {
      tracker.activeRestriction = null;
      tracker.nextRestriction = null;
      return;
    }

    var center = projection.lineCoordinate;
    var sector = projection.sector;
    var isPreview = !!projection.preview;
    var layout = getApkTrackerLayout(w, h);
    var bounds = getApkVisibleBounds(center, layout);
    var visibleObjects = getTrackObjectsInWindow(bounds.left, bounds.right, sector);
    var visibleControlMarks = getRegimeControlMarksInWindow(bounds.left, bounds.right, sector);
    var speedRules = getSpeedRulesInWindow(bounds.left, bounds.right, sector, visibleObjects);
    var nextSignal = resolveNextSignalForProjection(projection);
    var nextStation = resolveNextStationForProjection(projection);
    var nextNeutralMark = findNextRegimeControlMarkForDirection(center, sector, 'neutral');
    var nextWarning = findNextWarningForDirection(center, sector);
    var activeSpeed = findActiveSpeedRule(center, speedRules);
    var nextRestriction = resolveNextRestrictionForProjection(projection);
    var routeProgress = resolveRouteProgressForProjection(projection);
    tracker.activeRestriction = normalizeActiveRestriction(activeSpeed, projection);
    tracker.nextRestriction = nextRestriction;
    var avgAngle = computeAvgProfileAngle(center, sector, layout);
    var labelLayout = makeLabelLayout();

    ctx.save();
    drawApkLiveSummary(ctx, layout, center, sector, visibleObjects, activeSpeed, nextSignal, nextStation, nextWarning, nextRestriction, routeProgress, isPreview, projection);
    drawApkSceneBackground(ctx, layout);
    drawApkProfileGrid(ctx, layout);
    drawApkTrackerHeader(ctx, layout, center, sector, visibleObjects);
    drawApkProfileLegend(ctx, layout);
    drawApkKmGrid(ctx, layout, center, bounds, sector);
    drawApkProfile(ctx, layout, center, sector, bounds);

    drawApkStations(ctx, layout, center, sector, visibleObjects, isPreview, labelLayout);
    drawApkSignals(ctx, layout, center, sector, visibleObjects, isPreview, labelLayout);
    drawApkSpeedBands(ctx, layout, center, sector, speedRules, activeSpeed, isPreview, labelLayout);
    drawRegimeControlMarks(ctx, layout, center, sector, visibleControlMarks, isPreview, labelLayout);
    drawApkWarningCue(ctx, layout, center, sector, nextWarning, isPreview, labelLayout);
    drawApkNextRestrictionCue(ctx, layout, center, sector, nextRestriction, isPreview, labelLayout);
    drawApkRouteTargetCue(ctx, layout, center, sector, routeProgress, isPreview, labelLayout);
    drawApkGradeLabels(ctx, layout, center, sector, bounds, isPreview, labelLayout);

    var currentProfileY = getProfileYAt(center, center, sector, layout);
    ctx.strokeStyle = isPreview ? 'rgba(136, 146, 164, 0.40)' : 'rgba(74, 222, 128, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(layout.headX, currentProfileY + 18);
    ctx.lineTo(layout.headX, layout.trackY + 32);
    ctx.stroke();
    ctx.setLineDash([]);
    if (isPreview) {
      drawApkPreviewCursor(ctx, layout, center, sector);
      drawApkTrain(ctx, layout, center, sector, avgAngle, true);
    } else {
      drawApkTrain(ctx, layout, center, sector, avgAngle, false);
    }

    if (!activeSpeed && !nextWarning && nextNeutralMark && !isPreview) {
      var neutralDistance = Math.abs(nextNeutralMark.coordinate - center);
      var neutralText = 'РК НТ · ' + Math.round(neutralDistance) + ' м';
      var neutralWidth = Math.min(124, Math.max(74, neutralText.length * 6 + 18));
      var neutralX = layout.viewportRight - neutralWidth - 8;
      var neutralY = layout.trackY - 48;
      fillRoundRect(ctx, neutralX, neutralY, neutralWidth, 23, 8, 'rgba(88, 20, 36, 0.80)');
      strokeRoundRect(ctx, neutralX + 0.5, neutralY + 0.5, neutralWidth - 1, 22, 8, 'rgba(251, 113, 133, 0.34)');
      drawText(ctx, neutralText, neutralX + neutralWidth / 2, neutralY + 16, {
        size: 9,
        weight: 850,
        color: '#fda4af',
        align: 'center',
        maxWidth: neutralWidth - 8
      });
    } else if (!activeSpeed && !nextWarning && nextSignal && !isPreview) {
      var distance = Math.abs(nextSignal.coordinate - center);
      var signalText = nextSignal.name + ' · ' + Math.round(distance) + ' м';
      var signalWidth = Math.min(132, Math.max(74, signalText.length * 6 + 18));
      var signalX = layout.viewportRight - signalWidth - 8;
      var signalY = layout.trackY - 48;
      fillRoundRect(ctx, signalX, signalY, signalWidth, 23, 8, 'rgba(9, 10, 15, 0.72)');
      strokeRoundRect(ctx, signalX + 0.5, signalY + 0.5, signalWidth - 1, 22, 8, 'rgba(136, 146, 164, 0.22)');
      drawText(ctx, signalText, signalX + signalWidth / 2, signalY + 16, {
        size: 9,
        weight: 800,
        color: THEME.sub,
        align: 'center',
        maxWidth: signalWidth - 8
      });
    }
    ctx.restore();
  }

  function drawBottomBar(ctx, w, h, displayProjection) {
    var projection = displayProjection || tracker.projection;
    var layout = getApkTrackerLayout(w, h);
    var isPreview = !!(projection && projection.preview);
    var speed = tracker.speedMps * 3.6;
    var speedText = tracker.speedMeters ? speed.toFixed(2) : String(Math.round(speed));
    var sector = projection && isRealNumber(projection.sector) ? projection.sector : '—';
    var coordinate = projection && isRealNumber(projection.lineCoordinate) ? projection.lineCoordinate : NaN;
    var km = isRealNumber(coordinate) ? String(Math.floor(coordinate / 1000)) : '—';
    var pk = isRealNumber(coordinate) ? String(Math.floor((((Math.round(coordinate) % 1000) + 1000) % 1000) / 100) + 1) : '—';
    var sats = tracker.satellites || '—';
    var accuracy = isFinite(tracker.accuracy) && tracker.accuracy > 0 ? Math.round(tracker.accuracy) : '—';
    var accuracyText = accuracy === '—' ? '—' : accuracy + ' м';
    var activeRestriction = tracker.activeRestriction || resolveActiveRestrictionForProjection(projection);
    var restrictionText = activeRestriction ? activeRestriction.label : '—';
    var restrictionColor = activeRestriction && activeRestriction.source === 'warning'
      ? THEME.danger
      : activeRestriction && activeRestriction.source === 'document'
        ? (activeRestriction.conflict ? '#facc15' : THEME.accentStrong)
      : activeRestriction && activeRestriction.source === 'regime'
        ? '#fb923c'
      : activeRestriction
        ? THEME.text
        : THEME.sub;
    var isOverspeed = activeRestriction && activeRestriction.speedKmh > 0 && speed > activeRestriction.speedKmh + 1;
    var x = getPanelInset(w);
    var panelHeight = 50;
    var panelWidth = w - x * 2;
    var y = Math.min(layout.trackY + 58, h - layout.navReserve - 88);
    y = Math.max(layout.trackY + 46, y);
    if (y + panelHeight > h - layout.navReserve - 30) {
      y = Math.max(layout.trackY + 38, h - layout.navReserve - panelHeight - 30);
    }
    var colWidth = panelWidth / 4;
    var compact = w < 360;

    ctx.save();
    drawPanel(ctx, x, y, panelWidth, panelHeight, 14, 'rgba(19, 19, 24, 0.78)', 'rgba(255, 255, 255, 0.08)');
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 4; i++) {
      var dividerX = Math.round(x + colWidth * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(dividerX, y + 10);
      ctx.lineTo(dividerX, y + panelHeight - 10);
      ctx.stroke();
    }
    function drawMetric(index, label, value, color) {
      var cellX = x + colWidth * index;
      var centerX = cellX + colWidth / 2;
      drawText(ctx, label, centerX, y + 18, {
        size: compact ? 7 : 8,
        weight: 850,
        color: THEME.sub,
        align: 'center',
        maxWidth: colWidth - 8
      });
      drawText(ctx, value, centerX, y + 39, {
        size: compact && String(value).length > 4 ? 13 : 15,
        weight: 850,
        color: color || THEME.text,
        align: 'center',
        maxWidth: colWidth - 8
      });
    }
    if (isPreview) {
      drawMetric(0, 'УЧ.', formatSectorShortName(sector), THEME.text);
      drawMetric(1, 'КМ', km, THEME.text);
      drawMetric(2, 'ПК', pk, THEME.accentStrong);
      drawMetric(3, 'GPS', tracker.status === 'offtrack' ? 'ВНЕ' : 'НЕТ', THEME.danger);
    } else {
      drawMetric(0, compact ? 'СКОР.' : 'СКОРОСТЬ', speedText, isOverspeed ? THEME.danger : THEME.text);
      drawMetric(1, compact ? 'УЧ.' : 'УЧАСТОК', formatSectorShortName(sector), THEME.text);
      drawMetric(2, compact ? 'ТОЧН.' : 'ТОЧНОСТЬ', accuracyText, tracker.status === 'gps-live' ? THEME.green : THEME.text);
      drawMetric(3, 'ОГР.', restrictionText, restrictionColor);
    }
    ctx.restore();
  }

  function drawTopHud(ctx, w, displayProjection) {
    var now = new Date();
    var inset = getPanelInset(w);
    var x = inset;
    var y = getPoekhaliTopHudY();
    var width = w - inset * 2;
    var height = 72;
    var liveProjection = tracker.projection && tracker.projection.onTrack ? tracker.projection : null;
    var previewProjection = displayProjection && displayProjection.preview ? displayProjection : null;
    var topSector = (liveProjection || previewProjection || tracker.nearestProjection || {}).sector;
    var topDraft = getRawDraftForSector(topSector);
    var topUserSection = getUserSectionForSector(topSector);
    var label = liveProjection
      ? (topDraft ? 'GPS ЧЕРНОВИК' : topUserSection ? 'GPS УЧАСТОК' : 'КООРДИНАТА')
      : tracker.status === 'offtrack' && tracker.nearestProjection
        ? (topDraft || topUserSection ? 'БЛИЖ. GPS' : 'БЛИЖАЙШИЙ УЧ.')
        : (topDraft ? 'GPS ЧЕРНОВИК' : topUserSection ? 'GPS УЧАСТОК' : 'ПРОСМОТР ЭК');
    drawPanel(ctx, x, y, width, height, 18, 'rgba(19, 19, 24, 0.72)', THEME.border);
    drawText(ctx, label, x + 14, y + 24, {
      size: 10,
      weight: 850,
      color: THEME.sub
    });
    drawText(ctx, 'МСК', x + width - 14, y + 24, {
      size: 8,
      weight: 850,
      color: THEME.sub,
      align: 'right'
    });
    drawText(ctx, formatTime(now), x + width - 14, y + 44, {
      size: 13,
      weight: 850,
      color: THEME.text,
      align: 'right'
    });
    if (liveProjection) {
      var liveText = formatLineCoordinate(liveProjection.lineCoordinate);
      var liveLong = liveText.length > 11;
      drawText(ctx, liveText, liveLong ? x + 14 : x + width / 2, y + 47, {
        size: liveLong ? 18 : 22,
        weight: 850,
        color: THEME.accentStrong,
        align: liveLong ? 'left' : 'center',
        maxWidth: liveLong ? width - 118 : width - 96
      });
    } else if (previewProjection) {
      var previewText = formatLineCoordinate(previewProjection.lineCoordinate);
      var previewLong = previewText.length > 11;
      drawText(ctx, previewText, previewLong ? x + 14 : x + width / 2, y + 47, {
        size: previewLong ? 17 : 20,
        weight: 850,
        color: THEME.accentStrong,
        align: previewLong ? 'left' : 'center',
        maxWidth: previewLong ? width - 118 : width - 108
      });
    } else {
      drawText(ctx, '—', x + width / 2, y + 47, {
        size: 22,
        weight: 850,
        color: THEME.muted,
        align: 'center'
      });
    }
  }

  function drawCanvas() {
    if (!resizeCanvas()) return;
    var ctx = tracker.ctx;
    var w = tracker.width;
    var h = tracker.height;

    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#11131B');
    bg.addColorStop(0.52, THEME.bg);
    bg.addColorStop(1, THEME.bgDeep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var displayProjection = getPreviewProjection();
    tracker.activeRestriction = null;
    tracker.nextRestriction = null;
    drawTopHud(ctx, w, displayProjection);
    drawRouteStrip(ctx, w, h, displayProjection);
    if (!displayProjection) {
      drawCenteredStatus(ctx, w, h);
    }
    drawBottomBar(ctx, w, h, displayProjection);
    setText('btnPoekhaliDirection', tracker.even ? 'ЧЕТ' : 'НЕЧЕТ');
    setText('btnPoekhaliWay', 'П ' + tracker.wayNumber);
    setText('btnPoekhaliK', tracker.simpleCoordinate ? 'КМ' : 'K 1');
    setTimerButton();
    setMapButton();
    setOpsButton();
    syncGpsStatusDisplay();
  }

  function requestDraw() {
    if (!tracker.active) {
      drawCanvas();
    }
  }

  function drawLoop() {
    if (!tracker.active) {
      tracker.frameId = null;
      return;
    }
    drawCanvas();
    tracker.frameId = window.requestAnimationFrame(drawLoop);
  }

  function startDrawLoop() {
    if (tracker.frameId !== null) return;
    tracker.frameId = window.requestAnimationFrame(drawLoop);
  }

  function stopDrawLoop() {
    if (tracker.frameId !== null) {
      window.cancelAnimationFrame(tracker.frameId);
      tracker.frameId = null;
    }
  }

  function canBrowsePreview() {
    return ((tracker.assetsLoaded && tracker.routePoints.length > 0) ||
      (tracker.userSections && tracker.userSections.length > 0) ||
      (tracker.rawDrafts && tracker.rawDrafts.length > 0)) &&
      (!tracker.projection || !tracker.projection.onTrack);
  }

  function browsePreviewByPixels(deltaX) {
    if (!canBrowsePreview()) return;
    var projection = getPreviewProjection();
    if (!projection) return;
    var layout = getApkTrackerLayout(tracker.width || window.innerWidth || 360, tracker.height || window.innerHeight || 760);
    var deltaMeters = -deltaX / (layout.oneMeter * layout.direction);
    var targetCoordinate = projection.lineCoordinate + deltaMeters;
    var bounds = getSectorCoordinateBounds(projection.sector);
    if (bounds && targetCoordinate < bounds.min - 40) {
      var previousSector = getAdjacentSector(projection.sector, -1);
      if (previousSector !== null) {
        selectPreviewSector(previousSector, 'end');
        return;
      }
    }
    if (bounds && targetCoordinate > bounds.max + 40) {
      var nextSector = getAdjacentSector(projection.sector, 1);
      if (nextSector !== null) {
        selectPreviewSector(nextSector, 'start');
        return;
      }
    }
    setPreviewProjection({
      lineCoordinate: targetCoordinate,
      sector: projection.sector
    }, true);
    requestDraw();
  }

  function bindCanvasBrowse() {
    if (!tracker.canvas) return;
    tracker.canvas.addEventListener('pointerdown', function(event) {
      if (!canBrowsePreview()) return;
      tracker.previewDragActive = true;
      tracker.previewDragX = event.clientX;
      try {
        tracker.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture is optional.
      }
    });
    tracker.canvas.addEventListener('pointermove', function(event) {
      if (!tracker.previewDragActive) return;
      var deltaX = event.clientX - tracker.previewDragX;
      tracker.previewDragX = event.clientX;
      browsePreviewByPixels(deltaX);
    });
    function stopBrowseDrag(event) {
      tracker.previewDragActive = false;
      try {
        tracker.canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture is optional.
      }
    }
    tracker.canvas.addEventListener('pointerup', stopBrowseDrag);
    tracker.canvas.addEventListener('pointercancel', stopBrowseDrag);
    tracker.canvas.addEventListener('pointerleave', function() {
      tracker.previewDragActive = false;
    });
  }

  function startPoekhaliTrackerMode() {
    var wasActive = tracker.active;
    tracker.active = true;
    loadReference();
    loadSpeedDocs();
    loadRegimeMaps();
    preparePoekhaliModeEntry();
    startWatchingGps();
    resizeCanvas();
    drawCanvas();
    if (wasActive) {
      requestDraw();
    }
    startDrawLoop();
  }

  function stopPoekhaliTrackerMode() {
    tracker.active = false;
    tracker.runStartPreparing = false;
    tracker.runStartToken = 0;
    resetPoekhaliLiveAlert();
    stopWatchingGps();
    stopDrawLoop();
    if (!tracker.timerRunning) setTimerButton();
  }

  function syncPoekhaliTrackerMode(shouldRun) {
    if (shouldRun) startPoekhaliTrackerMode();
    else stopPoekhaliTrackerMode();
  }

  function isPoekhaliPanelActive() {
    var activePanel = document.querySelector('.tab-panel.active');
    return !!(activePanel && activePanel.getAttribute('data-tab') === 'poekhali');
  }

  function bindControls() {
    var directionBtn = byId('btnPoekhaliDirection');
    if (directionBtn) {
      directionBtn.addEventListener('click', function() {
        tracker.even = !tracker.even;
        tracker.directionSource = 'manual';
        tracker.manualDirectionLockedUntil = Date.now() + GPS_DIRECTION_MANUAL_LOCK_MS;
        if (tracker.lastLocation && tracker.lastLocation.coords) {
          applyTrackProjection(tracker.lastLocation.coords);
        }
        updateActiveRunNavigationState();
        requestDraw();
      });
    }

    var wayBtn = byId('btnPoekhaliWay');
    if (wayBtn) {
      wayBtn.addEventListener('click', function() {
        tracker.wayNumber = tracker.wayNumber === 1 ? 2 : 1;
        updateActiveRunNavigationState();
        requestDraw();
      });
    }

    var kBtn = byId('btnPoekhaliK');
    if (kBtn) {
      kBtn.addEventListener('click', function() {
        tracker.simpleCoordinate = !tracker.simpleCoordinate;
        requestDraw();
      });
    }

    var mapBtn = byId('btnPoekhaliMap');
    if (mapBtn) {
      mapBtn.addEventListener('click', function() {
        closeOpsSheet();
        openMapPicker();
      });
    }

    var opsBtn = byId('btnPoekhaliOps');
    if (opsBtn) {
      opsBtn.addEventListener('click', function() {
        closeMapPicker();
        openOpsSheet();
      });
    }

    var gpsBtn = byId('poekhaliGpsStatus');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', function() {
        startWatchingGps();
      });
    }

    var timerBtn = byId('btnPoekhaliTimer');
    if (timerBtn) {
      timerBtn.addEventListener('click', function() {
        setTimerRunning(!tracker.timerRunning);
      });
    }

    var backBtn = byId('btnPoekhaliBack');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        closeMapPicker();
        closeOpsSheet();
        if (typeof setActiveTab === 'function') setActiveTab('home');
      });
    }

    window.addEventListener('resize', function() {
      resizeCanvas();
      requestDraw();
    });
  }

  function init() {
    tracker.canvas = byId('poekhaliCanvas');
    bindCanvasBrowse();
    bindControls();
    loadWarnings();
    bindWarningSyncEvents();
    loadLearningStore();
    bindLearningSyncEvents();
    loadRuns();
    bindRunSyncEvents();
    updateModeButtons();
    loadManifest();
    loadSpeedDocs();
    loadRegimeMaps();
    resizeCanvas();
    drawCanvas();
    if (isPoekhaliPanelActive() || (document.body && document.body.classList.contains('is-poekhali-mode'))) {
      startPoekhaliTrackerMode();
    }
    scheduleWarningSync(1400);
    scheduleLearningSync(1800);
    scheduleRunSync(1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.startPoekhaliTrackerMode = startPoekhaliTrackerMode;
  window.stopPoekhaliTrackerMode = stopPoekhaliTrackerMode;
  window.syncPoekhaliTrackerMode = syncPoekhaliTrackerMode;
  window.openPoekhaliForShift = openPoekhaliForShift;
  window.preparePoekhaliModeEntry = preparePoekhaliModeEntry;
})();
