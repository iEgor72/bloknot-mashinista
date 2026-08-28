if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('community-geometry-editor', 'v413');

(function bindCommunityGeometryEditor() {
  'use strict';

  var openButton = document.getElementById('btnCommunityGeometryEditor');
  var overlay = document.getElementById('overlayCommunityGeometryEditor');
  var canvas = document.getElementById('communityGeometryCanvas');
  var canvasWrap = document.getElementById('communityGeometryCanvasWrap');
  if (!openButton || !overlay || !canvas || !canvasWrap) return;

  var API_BASE = (window.SHIFT_API_BASE_URL || '') + '/api/community';
  var DRAFT_PREFIX = 'shift_tracker_community_geometry_draft_v1:';
  var MAX_FRAGMENT_M = 20000;
  var MAX_CONTROL_POINTS = 24;
  var SNAP_M = 100;
  var POINT_SNAP_M = 10;
  var ctx = canvas.getContext('2d');
  var sectionSelect = document.getElementById('communityGeometrySection');
  var captureSelect = document.getElementById('communityGeometryCapture');
  var startInput = document.getElementById('communityGeometryStart');
  var endInput = document.getElementById('communityGeometryEnd');
  var evidenceInput = document.getElementById('communityGeometryEvidence');
  var commentInput = document.getElementById('communityGeometryComment');
  var submitButton = document.getElementById('btnCommunityGeometrySubmit');
  var deletePointButton = document.getElementById('btnCommunityGeometryDeletePoint');
  var useTrackButton = document.getElementById('btnCommunityGeometryUseTrack');

  var state = {
    dashboard: null,
    section: null,
    sectionId: '',
    paths: [],
    captures: [],
    capture: null,
    pathId: '',
    pathPoints: [],
    trackPoints: [],
    proposalPoints: [],
    startM: 0,
    endM: 0,
    selectedPointIndex: -1,
    pointerId: null,
    dragging: false,
    projection: null,
    submitting: false,
    previewProposal: null,
    communityVersion: 0,
  };

  function request(path, options, timeoutMs) {
    var transport = window.shiftTrackerFetchJson || window.fetchJson;
    if (typeof transport !== 'function') return Promise.reject(new Error('Сначала войдите в приложение'));
    return transport(API_BASE + path, options || { method: 'GET' }, timeoutMs || 10000);
  }

  function number(value) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function snap(value, step) { return Math.round(number(value) / step) * step; }
  function formatChainage(meters) {
    var value = Math.max(0, Math.round(number(meters)));
    var km = Math.floor(value / 1000);
    var remainder = value - km * 1000;
    return km + ' км ' + (Math.floor(remainder / 100) + 1) + ' пк' + (remainder % 100 ? ' +' + (remainder % 100) + ' м' : '');
  }
  function formatLength(meters) {
    var value = Math.max(0, Math.round(number(meters)));
    return value >= 1000 ? (Math.round(value / 100) / 10) + ' км' : value + ' м';
  }
  function geoDistance(a, b) {
    if (!a || !b) return Infinity;
    var toRad = Math.PI / 180;
    var dLat = (number(b.lat) - number(a.lat)) * toRad;
    var dLon = (number(b.lon) - number(a.lon)) * toRad;
    var latA = number(a.lat) * toRad;
    var latB = number(b.lat) * toRad;
    var hav = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(Math.max(0, 1 - hav)));
  }
  function pathPointChainage(point) {
    if (!point) return NaN;
    if (Number.isFinite(Number(point.chainage_m))) return Number(point.chainage_m);
    if (Number.isFinite(Number(point.coordinate_m))) return Number(point.coordinate_m);
    return Number(point.ordinate);
  }
  function normalizePath(path) {
    return {
      id: String(path && path.path_id || ''),
      sector: Number(path && path.sector),
      points: (path && Array.isArray(path.points) ? path.points : []).map(function(point) {
        return {
          chainageM: pathPointChainage(point),
          ordinate: Number(point && point.ordinate),
          lat: Number(point && point.lat),
          lon: Number(point && point.lon),
        };
      }).filter(function(point) {
        return Number.isFinite(point.chainageM) && Number.isFinite(point.lat) && Number.isFinite(point.lon);
      }).sort(function(a, b) { return a.chainageM - b.chainageM; }),
    };
  }
  function interpolate(points, coordinate, key) {
    var list = (points || []).slice().sort(function(a, b) { return number(a[key]) - number(b[key]); });
    if (!list.length) return null;
    if (coordinate <= number(list[0][key])) return { lat: list[0].lat, lon: list[0].lon, chainageM: list[0].chainageM, ordinate: list[0].ordinate };
    if (coordinate >= number(list[list.length - 1][key])) {
      var last = list[list.length - 1];
      return { lat: last.lat, lon: last.lon, chainageM: last.chainageM, ordinate: last.ordinate };
    }
    for (var i = 1; i < list.length; i++) {
      if (number(list[i][key]) < coordinate) continue;
      var left = list[i - 1];
      var right = list[i];
      var span = number(right[key]) - number(left[key]);
      var ratio = span ? (coordinate - number(left[key])) / span : 0;
      return {
        lat: left.lat + (right.lat - left.lat) * ratio,
        lon: left.lon + (right.lon - left.lon) * ratio,
        chainageM: left.chainageM + (right.chainageM - left.chainageM) * ratio,
        ordinate: Number.isFinite(left.ordinate) && Number.isFinite(right.ordinate)
          ? left.ordinate + (right.ordinate - left.ordinate) * ratio : coordinate,
      };
    }
    return null;
  }
  function interpolateCurrent(coordinate) { return interpolate(state.pathPoints, coordinate, 'chainageM'); }
  function chainageForSample(sample, path) {
    var raw = Number(sample && sample.nearestCoordinate);
    if (!Number.isFinite(raw)) return NaN;
    var hasOrdinates = path.points.some(function(point) { return Number.isFinite(point.ordinate); });
    var matched = interpolate(path.points, raw, hasOrdinates ? 'ordinate' : 'chainageM');
    return matched ? snap(matched.chainageM, POINT_SNAP_M) : NaN;
  }

  function capturePackage() {
    try {
      return typeof window.buildPoekhaliGpsCapturePackage === 'function'
        ? window.buildPoekhaliGpsCapturePackage() : { captures: [] };
    } catch (error) {
      return { captures: [] };
    }
  }
  function captureDate(value) {
    var date = new Date(number(value));
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU') : 'без даты';
  }
  function captureLabel(capture) {
    var route = [capture.routeFrom, capture.routeTo].filter(Boolean).join(' — ') || capture.mapTitle || 'GPS-поездка';
    return route + ' · ' + captureDate(capture.startedAt) + ' · ' + (capture.samples || []).length + ' точек';
  }
  function normalizedCapture(capture) {
    var byPath = {};
    (capture && Array.isArray(capture.samples) ? capture.samples : []).forEach(function(sample) {
      var lat = Number(sample && sample.lat);
      var lon = Number(sample && sample.lon);
      var accuracy = Number(sample && sample.accuracy);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 80) return;
      var requestedPath = String(sample.nearestPathId || '');
      var path = state.paths.find(function(item) { return item.id === requestedPath; });
      if (!path) {
        path = state.paths.find(function(item) {
          var ordinates = item.points.map(function(point) { return point.ordinate; }).filter(Number.isFinite);
          var coordinate = Number(sample.nearestCoordinate);
          return ordinates.length && Number.isFinite(coordinate) && coordinate >= Math.min.apply(Math, ordinates) && coordinate <= Math.max.apply(Math, ordinates);
        });
      }
      if (!path) return;
      var chainageM = chainageForSample(sample, path);
      if (!Number.isFinite(chainageM)) return;
      if (!byPath[path.id]) byPath[path.id] = new Map();
      var existing = byPath[path.id].get(chainageM);
      var point = { chainageM: chainageM, lat: lat, lon: lon, accuracyM: Math.round(accuracy), ts: number(sample.ts) };
      if (!existing || point.accuracyM < existing.accuracyM) byPath[path.id].set(chainageM, point);
    });
    var bestPathId = '';
    var bestPoints = [];
    Object.keys(byPath).forEach(function(pathId) {
      var points = Array.from(byPath[pathId].values()).sort(function(a, b) { return a.chainageM - b.chainageM; });
      if (points.length > bestPoints.length) { bestPathId = pathId; bestPoints = points; }
    });
    return { source: capture, pathId: bestPathId, points: bestPoints };
  }

  function currentFragment() {
    if (!state.pathPoints.length || state.endM <= state.startM) return [];
    var points = state.pathPoints.filter(function(point) { return point.chainageM > state.startM && point.chainageM < state.endM; });
    var start = interpolateCurrent(state.startM);
    var end = interpolateCurrent(state.endM);
    return [start].concat(points, [end]).filter(Boolean);
  }
  function proposedFragment() {
    var start = interpolateCurrent(state.startM);
    var end = interpolateCurrent(state.endM);
    return [start].concat(state.proposalPoints.slice().sort(function(a, b) { return a.chainageM - b.chainageM; }), [end]).filter(Boolean);
  }
  function maxDeviation() {
    return state.proposalPoints.reduce(function(max, point) {
      return Math.max(max, geoDistance(interpolateCurrent(point.chainageM), point));
    }, 0);
  }
  function thinPoints(points, maxItems) {
    var source = (points || []).slice().sort(function(a, b) { return a.chainageM - b.chainageM; });
    if (source.length <= maxItems) return source;
    var result = [];
    var used = new Set();
    for (var i = 0; i < maxItems; i++) {
      var index = Math.round(i * (source.length - 1) / Math.max(1, maxItems - 1));
      if (used.has(index)) continue;
      result.push(source[index]); used.add(index);
    }
    return result;
  }
  function useTrackPoints(save) {
    state.proposalPoints = thinPoints(state.trackPoints.filter(function(point) {
      return point.chainageM > state.startM && point.chainageM < state.endM;
    }), MAX_CONTROL_POINTS).map(function(point) { return { ...point }; });
    state.selectedPointIndex = -1;
    updateUi();
    if (save !== false) saveDraft();
  }
  function chooseAutomaticFragment() {
    if (!state.trackPoints.length) return;
    var mostDifferent = state.trackPoints.reduce(function(best, point) {
      var distance = geoDistance(interpolateCurrent(point.chainageM), point);
      return !best || distance > best.distance ? { point: point, distance: distance } : best;
    }, null);
    var pathStart = state.pathPoints[0].chainageM;
    var pathEnd = state.pathPoints[state.pathPoints.length - 1].chainageM;
    var trackStart = state.trackPoints[0].chainageM;
    var trackEnd = state.trackPoints[state.trackPoints.length - 1].chainageM;
    var min = Math.max(pathStart, snap(trackStart, SNAP_M));
    var max = Math.min(pathEnd, snap(trackEnd, SNAP_M));
    var center = mostDifferent ? mostDifferent.point.chainageM : (min + max) / 2;
    state.startM = clamp(snap(center - 1000, SNAP_M), min, Math.max(min, max - 200));
    state.endM = clamp(snap(center + 1000, SNAP_M), state.startM + 200, Math.min(max, state.startM + MAX_FRAGMENT_M));
    if (state.endM <= state.startM) { state.startM = min; state.endM = Math.min(max, min + 1000); }
    syncRangeInputs();
    useTrackPoints(false);
  }

  function draftKey() { return DRAFT_PREFIX + (state.sectionId || 'none') + ':' + String(state.capture && state.capture.captureId || 'none'); }
  function saveDraft() {
    if (!state.sectionId || state.previewProposal) return;
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        startM: state.startM,
        endM: state.endM,
        pathId: state.pathId,
        points: state.proposalPoints,
        evidence: evidenceInput.value,
        comment: commentInput.value,
        communityVersion: state.communityVersion,
      }));
      document.getElementById('communityGeometrySaveState').textContent = 'Черновик сохранён · версия ' + state.communityVersion;
    } catch (error) {}
  }
  function restoreDraft() {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (error) {}
    if (!draft || draft.pathId !== state.pathId || number(draft.communityVersion) !== state.communityVersion) return false;
    var min = state.pathPoints[0].chainageM;
    var max = state.pathPoints[state.pathPoints.length - 1].chainageM;
    var start = clamp(snap(draft.startM, SNAP_M), min, max - 200);
    var end = clamp(snap(draft.endM, SNAP_M), start + 200, Math.min(max, start + MAX_FRAGMENT_M));
    var points = Array.isArray(draft.points) ? draft.points.filter(function(point) {
      return Number.isFinite(Number(point.chainageM)) && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) && point.chainageM > start && point.chainageM < end;
    }).slice(0, MAX_CONTROL_POINTS) : [];
    if (!points.length) return false;
    state.startM = start; state.endM = end; state.proposalPoints = points;
    evidenceInput.value = String(draft.evidence || '').slice(0, 240);
    commentInput.value = String(draft.comment || '').slice(0, 1000);
    syncRangeInputs(); updateUi();
    return true;
  }
  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (error) {} }

  function syncRangeInputs() {
    if (!state.pathPoints.length) return;
    var min = snap(state.pathPoints[0].chainageM, SNAP_M);
    var max = snap(state.pathPoints[state.pathPoints.length - 1].chainageM, SNAP_M);
    [startInput, endInput].forEach(function(input) { input.min = String(min); input.max = String(max); input.step = String(SNAP_M); });
    startInput.value = String(state.startM); endInput.value = String(state.endM);
  }
  function updateLabels() {
    document.getElementById('communityGeometryStartLabel').textContent = state.startM ? formatChainage(state.startM) : '—';
    document.getElementById('communityGeometryEndLabel').textContent = state.endM ? formatChainage(state.endM) : '—';
    document.getElementById('communityGeometryLengthLabel').textContent = state.endM > state.startM ? formatLength(state.endM - state.startM) : 'Фрагмент не выбран';
    document.getElementById('communityGeometryTrackCount').textContent = String(state.trackPoints.filter(function(point) { return point.chainageM >= state.startM && point.chainageM <= state.endM; }).length);
    document.getElementById('communityGeometryPointCount').textContent = String(state.proposalPoints.length);
    var deviation = maxDeviation();
    document.getElementById('communityGeometryDeviation').textContent = deviation ? Math.round(deviation) + ' м' : '—';
    deletePointButton.disabled = state.previewProposal || state.selectedPointIndex < 0 || state.proposalPoints.length <= 1;
    useTrackButton.disabled = state.previewProposal || !state.trackPoints.length;
  }
  function validationMessage() {
    if (!state.section) return { text: 'Загружаю участок…', tone: '' };
    if (!state.pathId || !state.pathPoints.length) return { text: 'В участке нет GPS-линии для сравнения', tone: 'error' };
    if (!state.previewProposal && !state.capture) return { text: 'Сначала запишите поездку с GPS в режиме «Поехали»', tone: 'error' };
    if (state.endM <= state.startM || state.endM - state.startM > MAX_FRAGMENT_M) return { text: 'Выберите фрагмент длиной до 20 км', tone: 'error' };
    if (!state.proposalPoints.length) return { text: 'На выбранном фрагменте недостаточно точек GPS', tone: 'error' };
    if (maxDeviation() < 3) return { text: 'Предлагаемая линия почти совпадает с опубликованной', tone: 'error' };
    if (!String(evidenceInput.value || '').trim()) return { text: 'Укажите поездку или другой источник', tone: 'error' };
    return { text: state.previewProposal ? 'Сравните серую и зелёную линии перед голосованием' : 'Готово: коллеги увидят только этот фрагмент', tone: 'ready' };
  }
  function updateValidation() {
    var result = validationMessage();
    var root = document.getElementById('communityGeometryValidation');
    root.textContent = result.text;
    root.classList.toggle('is-error', result.tone === 'error');
    root.classList.toggle('is-ready', result.tone === 'ready');
    submitButton.disabled = state.submitting || result.tone !== 'ready';
    if (state.previewProposal) submitButton.disabled = false;
  }

  function canvasSize() {
    var rect = canvasWrap.getBoundingClientRect();
    var width = Math.max(280, Math.round(rect.width));
    var height = Math.max(250, Math.round(rect.height));
    var ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: width, height: height };
  }
  function createProjection(size, sources) {
    var points = [].concat.apply([], sources).filter(Boolean);
    if (!points.length) return null;
    var meanLat = points.reduce(function(sum, point) { return sum + point.lat; }, 0) / points.length;
    var lonScale = Math.max(.15, Math.cos(meanLat * Math.PI / 180));
    var xs = points.map(function(point) { return point.lon * lonScale; });
    var ys = points.map(function(point) { return point.lat; });
    var minX = Math.min.apply(Math, xs); var maxX = Math.max.apply(Math, xs);
    var minY = Math.min.apply(Math, ys); var maxY = Math.max.apply(Math, ys);
    var spanX = Math.max(.00002, maxX - minX); var spanY = Math.max(.00002, maxY - minY);
    var pad = 24;
    var scale = Math.min((size.width - pad * 2) / spanX, (size.height - pad * 2) / spanY);
    var usedW = spanX * scale; var usedH = spanY * scale;
    var offsetX = (size.width - usedW) / 2; var offsetY = (size.height - usedH) / 2;
    return {
      point: function(value) { return { x: offsetX + (value.lon * lonScale - minX) * scale, y: size.height - offsetY - (value.lat - minY) * scale }; },
      inverse: function(x, y) { return { lon: ((x - offsetX) / scale + minX) / lonScale, lat: (size.height - offsetY - y) / scale + minY }; },
    };
  }
  function strokeLine(points, color, width, dash) {
    if (!points || points.length < 2 || !state.projection) return;
    ctx.beginPath(); ctx.setLineDash(dash || []); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    points.forEach(function(point, index) {
      var p = state.projection.point(point); if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    });
    ctx.stroke(); ctx.setLineDash([]);
  }
  function draw() {
    var size = canvasSize();
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = '#081018'; ctx.fillRect(0, 0, size.width, size.height);
    var current = currentFragment();
    var recorded = state.trackPoints.filter(function(point) { return point.chainageM >= state.startM - 500 && point.chainageM <= state.endM + 500; });
    var proposed = proposedFragment();
    state.projection = createProjection(size, [current, recorded, proposed]);
    if (!state.projection) return;
    ctx.strokeStyle = 'rgba(148,163,184,.08)'; ctx.lineWidth = 1;
    for (var x = 24; x < size.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.height); ctx.stroke(); }
    for (var y = 24; y < size.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.width, y); ctx.stroke(); }
    strokeLine(current, 'rgba(148,163,184,.85)', 4, [8, 7]);
    strokeLine(recorded, 'rgba(56,189,248,.62)', 2, []);
    strokeLine(proposed, '#34d399', 4, []);
    state.proposalPoints.forEach(function(point, index) {
      var p = state.projection.point(point);
      ctx.beginPath(); ctx.arc(p.x, p.y, index === state.selectedPointIndex ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = index === state.selectedPointIndex ? '#f8fafc' : '#34d399'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#052e2b'; ctx.stroke();
    });
  }
  function updateUi() { updateLabels(); updateValidation(); window.requestAnimationFrame(draw); }

  function setLoading(text, visible) {
    var root = document.getElementById('communityGeometryLoading');
    root.textContent = text || '';
    root.classList.toggle('hidden', !visible);
  }
  function setCapture(captureId) {
    var entry = state.captures.find(function(item) { return String(item.source.captureId) === String(captureId); }) || null;
    state.capture = entry && entry.source || null;
    state.pathId = entry && entry.pathId || '';
    state.pathPoints = state.paths.find(function(path) { return path.id === state.pathId; })?.points || [];
    state.trackPoints = entry && entry.points || [];
    state.proposalPoints = [];
    state.selectedPointIndex = -1;
    if (!entry) {
      setLoading('Нет подходящей GPS-поездки на этом участке', true); updateUi(); return;
    }
    setLoading('', false);
    chooseAutomaticFragment();
    var accuracy = entry.points.reduce(function(sum, point) { return sum + point.accuracyM; }, 0) / Math.max(1, entry.points.length);
    evidenceInput.value = ('GPS-поездка ' + captureDate(entry.source.startedAt) + ', ' +
      ([entry.source.routeFrom, entry.source.routeTo].filter(Boolean).join(' — ') || entry.source.mapTitle || state.sectionId) +
      ', ' + entry.points.length + ' точек, средняя точность ' + Math.round(accuracy) + ' м').slice(0, 240);
    if (!restoreDraft()) updateUi();
  }
  function populateCaptures() {
    var raw = capturePackage().captures || [];
    state.captures = raw.map(normalizedCapture).filter(function(item) { return item.pathId && item.points.length >= 2; });
    captureSelect.textContent = '';
    if (!state.captures.length) {
      captureSelect.appendChild(new Option('Нет записанных поездок для этого участка', ''));
      setCapture(''); return;
    }
    state.captures.slice().sort(function(a, b) { return number(b.source.startedAt) - number(a.source.startedAt); }).forEach(function(item) {
      captureSelect.appendChild(new Option(captureLabel(item.source), item.source.captureId));
    });
    setCapture(captureSelect.value);
  }
  function loadSection(sectionId) {
    var safeId = String(sectionId || '').trim();
    setLoading('Загружаю линию участка…', true);
    return request('/sections/' + encodeURIComponent(safeId) + '/effective', { method: 'GET', headers: { Accept: 'application/json' } }, 12000)
      .then(function(result) {
        if (!result || !result.ok || !result.body || !result.body.section) throw new Error(result && result.body && result.body.error || 'Участок не загружен');
        state.section = result.body.section;
        state.sectionId = safeId;
        state.communityVersion = number(state.section.community && state.section.community.version);
        state.paths = (state.section.geometry && Array.isArray(state.section.geometry.paths) ? state.section.geometry.paths : []).map(normalizePath).filter(function(path) { return path.id && path.points.length >= 2; });
        state.capture = null; state.pathId = ''; state.pathPoints = []; state.trackPoints = []; state.proposalPoints = [];
        if (state.previewProposal) applyPreview(state.previewProposal);
        else populateCaptures();
      }).catch(function(error) {
        setLoading(error && error.message || 'Линия недоступна', true); updateUi(); throw error;
      });
  }
  function populateSections(dashboard) {
    var ids = dashboard && dashboard.context && dashboard.context.pack && dashboard.context.pack.sectionIds || [];
    sectionSelect.textContent = '';
    ids.forEach(function(id) { sectionSelect.appendChild(new Option(String(id), String(id))); });
    if (!ids.length) throw new Error('В пакете депо пока нет участков');
    return String(ids[0]);
  }
  function applyPreview(proposal) {
    var change = proposal && proposal.change || {};
    var path = state.paths.find(function(item) { return item.id === String(change.pathId || ''); });
    if (!path) throw new Error('Путь из предложения больше не найден');
    state.pathId = path.id; state.pathPoints = path.points; state.capture = null; state.trackPoints = [];
    state.startM = number(change.startM); state.endM = number(change.endM);
    var all = Array.isArray(change.points) ? change.points : [];
    state.proposalPoints = all.slice(1, -1).map(function(point) {
      return { chainageM: number(point.chainageM == null ? point.chainage_m : point.chainageM), lat: number(point.lat), lon: number(point.lon), accuracyM: number(point.accuracyM) };
    });
    evidenceInput.value = proposal.evidence && (proposal.evidence.sourceReference || proposal.evidence.orderNumber) || '';
    commentInput.value = proposal.summary || '';
    captureSelect.textContent = ''; captureSelect.appendChild(new Option('Фрагмент из предложения коллеги', 'preview'));
    sectionSelect.value = state.sectionId;
    syncRangeInputs();
    document.getElementById('communityGeometryTitle').textContent = 'Проверка GPS-линии';
    document.getElementById('communityGeometryHint').textContent = 'Серая линия опубликована сейчас. Зелёную линию предлагает коллега.';
    document.getElementById('communityGeometrySaveState').textContent = 'Только просмотр · версия ' + state.communityVersion;
    submitButton.textContent = 'Вернуться к голосованию';
    [sectionSelect, captureSelect, startInput, endInput, evidenceInput, commentInput].forEach(function(input) { input.disabled = true; });
    setLoading('', false); updateUi();
  }
  function setPreviewControls(preview) {
    if (!preview) {
      document.getElementById('communityGeometryTitle').textContent = 'Линия пути по GPS';
      document.getElementById('communityGeometryHint').textContent = 'Выберите проблемный фрагмент. Зелёные точки можно перетаскивать пальцем.';
      document.getElementById('communityGeometrySaveState').textContent = 'Черновик хранится на телефоне';
      submitButton.textContent = 'Отправить линию на проверку';
    }
    [sectionSelect, captureSelect, startInput, endInput, evidenceInput, commentInput].forEach(function(input) { input.disabled = !!preview; });
  }
  function openInternal() {
    if (typeof closeOverlay === 'function') closeOverlay('overlayCommunity');
    if (typeof openOverlay === 'function') openOverlay('overlayCommunityGeometryEditor');
    setPreviewControls(!!state.previewProposal);
    request('/dashboard', { method: 'GET', headers: { Accept: 'application/json' } }, 10000).then(function(result) {
      if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось открыть редактор');
      state.dashboard = result.body;
      if (!result.body.context || !result.body.context.configured) throw new Error('Сначала выберите дорогу и депо в профиле');
      var first = populateSections(result.body);
      var requested = state.previewProposal && state.previewProposal.change && state.previewProposal.change.sectionId;
      var target = requested && Array.prototype.some.call(sectionSelect.options, function(option) { return option.value === requested; }) ? requested : first;
      sectionSelect.value = target;
      return loadSection(target);
    }).catch(function(error) {
      setLoading(error && error.message || 'Редактор недоступен', true);
      if (typeof enqueueAppToast === 'function') enqueueAppToast(error && error.message || 'Редактор недоступен', 'danger', 3000);
    });
  }
  function openEditor() { state.previewProposal = null; setPreviewControls(false); openInternal(); }
  function previewProposal(proposal) {
    if (!proposal || proposal.kind !== 'geometry' || !proposal.change || proposal.change.editor !== 'visual-v1') return;
    state.previewProposal = proposal; setPreviewControls(true); openInternal();
  }

  function pointerPosition(event) {
    var rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  canvas.addEventListener('pointerdown', function(event) {
    if (state.previewProposal || !state.projection) return;
    var pointer = pointerPosition(event); var nearest = null;
    state.proposalPoints.forEach(function(point, index) {
      var p = state.projection.point(point); var distance = Math.hypot(pointer.x - p.x, pointer.y - p.y);
      if (distance <= 28 && (!nearest || distance < nearest.distance)) nearest = { index: index, distance: distance };
    });
    if (!nearest) { state.selectedPointIndex = -1; updateUi(); return; }
    state.selectedPointIndex = nearest.index; state.pointerId = event.pointerId; state.dragging = true;
    try { canvas.setPointerCapture(event.pointerId); } catch (error) {}
    updateUi(); event.preventDefault();
  });
  canvas.addEventListener('pointermove', function(event) {
    if (!state.dragging || state.pointerId !== event.pointerId || state.selectedPointIndex < 0 || !state.projection) return;
    var pointer = pointerPosition(event); var geo = state.projection.inverse(pointer.x, pointer.y);
    state.proposalPoints[state.selectedPointIndex].lat = clamp(geo.lat, -90, 90);
    state.proposalPoints[state.selectedPointIndex].lon = clamp(geo.lon, -180, 180);
    updateUi(); event.preventDefault();
  });
  function endPointer(event) {
    if (state.pointerId !== event.pointerId) return;
    state.pointerId = null; state.dragging = false; saveDraft();
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  function rangeChanged(source) {
    if (!state.pathPoints.length) return;
    var min = snap(state.pathPoints[0].chainageM, SNAP_M);
    var max = snap(state.pathPoints[state.pathPoints.length - 1].chainageM, SNAP_M);
    if (source === 'start') state.startM = clamp(snap(startInput.value, SNAP_M), min, state.endM - 200);
    else state.endM = clamp(snap(endInput.value, SNAP_M), state.startM + 200, Math.min(max, state.startM + MAX_FRAGMENT_M));
    syncRangeInputs(); useTrackPoints(false); saveDraft();
  }
  startInput.addEventListener('input', function() { rangeChanged('start'); });
  endInput.addEventListener('input', function() { rangeChanged('end'); });
  captureSelect.addEventListener('change', function() { if (!state.previewProposal) setCapture(this.value); });
  sectionSelect.addEventListener('change', function() { if (!state.previewProposal) loadSection(this.value).catch(function() {}); });
  deletePointButton.addEventListener('click', function() {
    if (state.selectedPointIndex < 0 || state.proposalPoints.length <= 1) return;
    state.proposalPoints.splice(state.selectedPointIndex, 1); state.selectedPointIndex = -1; updateUi(); saveDraft();
  });
  useTrackButton.addEventListener('click', function() { useTrackPoints(true); });
  evidenceInput.addEventListener('input', updateValidation); evidenceInput.addEventListener('change', saveDraft);
  commentInput.addEventListener('input', updateValidation); commentInput.addEventListener('change', saveDraft);
  openButton.addEventListener('click', openEditor);
  document.getElementById('btnCommunityGeometryReset').addEventListener('click', function() { useTrackPoints(true); });
  document.getElementById('btnCommunityGeometryClose').addEventListener('click', function() {
    if (!state.previewProposal) saveDraft();
    if (typeof closeOverlay === 'function') closeOverlay('overlayCommunityGeometryEditor');
    if (typeof openOverlay === 'function') openOverlay('overlayCommunity');
    state.previewProposal = null; setPreviewControls(false);
  });
  window.addEventListener('resize', function() { window.requestAnimationFrame(draw); });

  submitButton.addEventListener('click', function() {
    if (state.previewProposal) {
      if (typeof closeOverlay === 'function') closeOverlay('overlayCommunityGeometryEditor');
      if (typeof openOverlay === 'function') openOverlay('overlayCommunity');
      state.previewProposal = null; setPreviewControls(false); return;
    }
    var validation = validationMessage();
    if (validation.tone !== 'ready' || state.submitting) return;
    var points = state.proposalPoints.map(function(point) {
      return {
        chainageM: snap(point.chainageM, POINT_SNAP_M),
        lat: Math.round(point.lat * 1e7) / 1e7,
        lon: Math.round(point.lon * 1e7) / 1e7,
        accuracyM: Math.round(number(point.accuracyM)),
      };
    });
    var change = {
      editor: 'visual-v1', sectionId: state.sectionId, action: 'replace_fragment', pathId: state.pathId,
      startM: state.startM, endM: state.endM, points: points,
      source: {
        schemaVersion: String(state.section.schema_version || ''),
        profileStatus: String(state.section.runtime && state.section.runtime.profile_status || ''),
        communityVersion: state.communityVersion,
      },
    };
    state.submitting = true; updateValidation();
    request('/proposals', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        kind: 'geometry',
        title: 'Исправить GPS-линию, ' + formatChainage(state.startM) + ' — ' + formatChainage(state.endM),
        summary: String(commentInput.value || '').trim(),
        baseVersion: String(state.section.schema_version || '') + ':' + String(state.section.runtime && state.section.runtime.profile_status || ''),
        scope: { level: 'section', sectionId: state.sectionId },
        change: change,
        evidence: { sourceReference: String(evidenceInput.value || '').trim() },
      }),
    }, 12000).then(function(result) {
      if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось отправить линию');
      clearDraft();
      if (typeof closeOverlay === 'function') closeOverlay('overlayCommunityGeometryEditor');
      if (typeof enqueueAppToast === 'function') enqueueAppToast('Фрагмент GPS-линии отправлен коллегам', 'success', 3000);
      window.dispatchEvent(new CustomEvent('community:proposal-created', { detail: { proposal: result.body && result.body.proposal } }));
    }).catch(function(error) {
      if (typeof enqueueAppToast === 'function') enqueueAppToast(error && error.message || 'Не удалось отправить линию', 'danger', 3200);
    }).then(function() { state.submitting = false; updateValidation(); });
  });

  window.CommunityGeometryEditor = {
    open: openEditor,
    preview: previewProposal,
    getState: function() {
      return {
        sectionId: state.sectionId, pathId: state.pathId, startM: state.startM, endM: state.endM,
        trackPoints: state.trackPoints.length, proposalPoints: state.proposalPoints.length,
      };
    },
  };
})();
