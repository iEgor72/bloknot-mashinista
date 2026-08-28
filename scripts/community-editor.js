if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('community-editor', 'v413');

(function bindCommunityVisualEditor() {
  var openButton = document.getElementById('btnCommunityVisualEditor');
  var overlay = document.getElementById('overlayCommunityEditor');
  var canvas = document.getElementById('communityEditorCanvas');
  var canvasWrap = document.getElementById('communityEditorCanvasWrap');
  if (!openButton || !overlay || !canvas || !canvasWrap) return;

  var API_BASE = (window.SHIFT_API_BASE_URL || '') + '/api/community';
  var SECTION_BASE = '/assets/tracker/sections/';
  var DRAFT_PREFIX = 'shift_tracker_community_visual_draft_v1:';
  var WINDOW_TARGET_M = 6000;
  var MAX_SELECTION_M = 20000;
  var SNAP_M = 100;
  var OBJECT_TYPES = {
    station: { label: 'Станция', shortLabel: 'Станция', symbol: 'СТ', collection: 'stations', defaultName: 'Станция' },
    signal_input: { label: 'Входной светофор', shortLabel: 'Входной', symbol: 'ВХ', collection: 'signals', defaultName: 'Входной' },
    signal_output: { label: 'Выходной светофор', shortLabel: 'Выходной', symbol: 'ВЫХ', collection: 'signals', defaultName: 'Выходной' },
    signal_passage: { label: 'Проходной светофор', shortLabel: 'Проходной', symbol: 'ПР', collection: 'signals', defaultName: 'Проходной' },
    sign_c: { label: 'Знак «С»', shortLabel: 'Знак «С»', symbol: 'С', collection: 'whistle_points', defaultName: 'С' },
    whistle: { label: 'Точка подачи свистка', shortLabel: 'Свисток', symbol: 'СВ', collection: 'whistle_points', defaultName: 'Подать свисток' },
    ktsm: { label: 'КТСМ', shortLabel: 'КТСМ', symbol: 'КТСМ', collection: 'infrastructure', defaultName: 'КТСМ' },
    brake_start: { label: 'НТ — начало торможения', shortLabel: 'НТ', symbol: 'НТ', collection: 'control_marks', defaultName: 'НТ' },
    brake_end: { label: 'КТ — конец торможения', shortLabel: 'КТ', symbol: 'КТ', collection: 'control_marks', defaultName: 'КТ' },
    neutral: { label: 'Нейтральная вставка / ОМ', shortLabel: 'Нейтраль', symbol: 'ОМ', collection: 'control_marks', defaultName: 'ОМ' },
    throttle: { label: 'Тяговая позиция', shortLabel: 'Позиция', symbol: 'ПОЗ', collection: 'control_marks', defaultName: 'Позиция' },
    connection: { label: 'Соединение схемы', shortLabel: 'Схема', symbol: 'СХ', collection: 'control_marks', defaultName: 'Соединение' },
    brake_note: { label: 'Пометка о торможении', shortLabel: 'Торможение', symbol: 'ТОРМ', collection: 'annotations', defaultName: 'Торможение' },
    position_note: { label: 'Пометка о количестве позиций', shortLabel: 'Позиции', symbol: 'ПОЗ', collection: 'annotations', defaultName: 'Позиции' },
    note: { label: 'Пометка под профилем', shortLabel: 'Пометка', symbol: 'ЗАМ', collection: 'annotations', defaultName: 'Пометка' },
  };
  var state = {
    dashboard: null,
    section: null,
    sectionId: '',
    elements: [],
    minM: 0,
    maxM: 0,
    windowStartM: 0,
    windowSpanM: WINDOW_TARGET_M,
    selectionStartM: 0,
    selectionEndM: 0,
    mode: 'profile',
    grade: 0,
    gradeTouched: false,
    selectedSpeed: 0,
    speedTouched: false,
    removeLimit: false,
    objects: [],
    objectAction: 'add',
    objectType: 'station',
    objectName: '',
    objectDirection: 'both',
    selectedObjectKey: '',
    dragHandle: '',
    pointerId: null,
    submitting: false,
    rollbackSubmitting: false,
    previewProposal: null,
    communityVersion: 0,
    releaseHistory: [],
    speedChanges: [],
  };

  var ctx = canvas.getContext('2d');
  var sectionSelect = document.getElementById('communityEditorSection');
  var positionInput = document.getElementById('communityEditorPosition');
  var gradeInput = document.getElementById('communityEditorGrade');
  var currentSpeedInput = document.getElementById('communityEditorCurrentSpeed');
  var evidenceInput = document.getElementById('communityEditorEvidence');
  var commentInput = document.getElementById('communityEditorComment');
  var objectTypeInput = document.getElementById('communityEditorObjectType');
  var objectPaletteRoot = document.getElementById('communityEditorObjectPalette');
  var objectNameInput = document.getElementById('communityEditorObjectName');
  var objectDirectionInput = document.getElementById('communityEditorObjectDirection');
  var nearbyObjectsRoot = document.getElementById('communityEditorNearbyObjects');
  var submitButton = document.getElementById('btnCommunityEditorSubmit');

  if (window.RailwaySignIcons && typeof window.RailwaySignIcons.subscribe === 'function') {
    window.RailwaySignIcons.subscribe(function() { window.requestAnimationFrame(draw); });
  }

  function request(path, options, timeoutMs) {
    var transport = window.shiftTrackerFetchJson || window.fetchJson;
    if (typeof transport !== 'function') return Promise.reject(new Error('Сначала войдите в приложение'));
    return transport(API_BASE + path, options || { method: 'GET' }, timeoutMs || 10000);
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function snapMeters(value) { return Math.round(Number(value) / SNAP_M) * SNAP_M; }
  function number(value) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function formatGrade(value) {
    var grade = Math.round(number(value) * 10) / 10;
    if (Math.abs(grade) < 0.05) return '0.0‰';
    return (grade > 0 ? '+' : '−') + Math.abs(grade).toFixed(1) + '‰';
  }
  function formatChainage(meters) {
    var value = Math.max(0, Math.round(number(meters)));
    var km = Math.floor(value / 1000);
    var remainder = value - km * 1000;
    var picket = Math.floor(remainder / 100) + 1;
    var within = remainder % 100;
    return km + ' км ' + picket + ' пк' + (within ? ' +' + within + ' м' : '');
  }
  function formatLength(meters) {
    var value = Math.max(0, Math.round(number(meters)));
    return value >= 1000 ? (Math.round(value / 100) / 10).toFixed(value % 1000 ? 1 : 0) + ' км' : value + ' м';
  }
  function objectCoordinate(item) {
    if (!item || typeof item !== 'object') return NaN;
    if (Number.isFinite(Number(item.coordinate_m))) return Math.round(Number(item.coordinate_m));
    if (Number.isFinite(Number(item.chainage_m))) return Math.round(Number(item.chainage_m));
    if (Number.isFinite(Number(item.coordinate))) return Math.round(Number(item.coordinate));
    if (Number.isFinite(Number(item.km))) return Math.round(Number(item.km) * 1000);
    return NaN;
  }
  function inferObjectKind(collection, item) {
    var rawType = String(item && (item.object_kind || item.type || item.kind) || '').toLowerCase();
    var name = String(item && (item.name || item.note) || '').trim().toUpperCase();
    if (collection === 'stations') return 'station';
    if (collection === 'signals') {
      if (rawType.indexOf('input') >= 0 || rawType.indexOf('вход') >= 0) return 'signal_input';
      if (rawType.indexOf('output') >= 0 || rawType.indexOf('выход') >= 0) return 'signal_output';
      return 'signal_passage';
    }
    if (collection === 'whistle_points') return name === 'С' || rawType === 'sign_c' ? 'sign_c' : 'whistle';
    if (collection === 'infrastructure') return rawType === 'ktsm' || name.indexOf('КТСМ') >= 0 ? 'ktsm' : 'note';
    if (collection === 'control_marks') {
      if (rawType === 'brake' || rawType === 'brake_start' || name === 'НТ') return 'brake_start';
      if (rawType === 'brake_end' || name === 'КТ') return 'brake_end';
      if (rawType === 'neutral' || name === 'ОМ') return 'neutral';
      if (rawType === 'connection') return 'connection';
      return 'throttle';
    }
    if (rawType === 'brake_note') return 'brake_note';
    if (rawType === 'position_note') return 'position_note';
    return 'note';
  }
  function collectSectionObjects(section) {
    var result = [];
    [
      ['stations', section && section.stations],
      ['signals', section && section.signals],
      ['whistle_points', section && section.whistle_points],
      ['infrastructure', section && section.infrastructure],
      ['control_marks', section && (section.control_marks || section.runtime && section.runtime.control_marks)],
      ['annotations', section && section.annotations],
    ].forEach(function(source) {
      var collection = source[0];
      var items = Array.isArray(source[1]) ? source[1] : [];
      items.forEach(function(item, index) {
        var coordinateM = objectCoordinate(item);
        if (!Number.isFinite(coordinateM)) return;
        var kind = inferObjectKind(collection, item);
        var type = OBJECT_TYPES[kind] || OBJECT_TYPES.note;
        result.push({
          key: String(item && (item.community_key || item.object_key) || collection + ':' + index),
          collection: collection,
          index: index,
          objectKey: String(item && (item.community_key || item.object_key) || collection + ':' + index),
          coordinateM: coordinateM,
          kind: kind,
          name: String(item && (item.name || item.note) || type.defaultName).trim(),
          direction: ['even', 'odd'].indexOf(String(item && item.direction || '').toLowerCase()) >= 0
            ? String(item.direction).toLowerCase() : 'both',
        });
      });
    });
    return result.sort(function(a, b) { return a.coordinateM - b.coordinateM; });
  }
  function selectedObject() {
    return state.objects.find(function(item) { return item.key === state.selectedObjectKey; }) || null;
  }
  function getObjectType(kind) { return OBJECT_TYPES[kind] || OBJECT_TYPES.note; }
  function createObjectIcon(kind, className) {
    if (window.RailwaySignIcons && typeof window.RailwaySignIcons.createIcon === 'function') {
      return window.RailwaySignIcons.createIcon(kind, className || '');
    }
    var fallback = document.createElement('span');
    fallback.className = className || '';
    fallback.textContent = getObjectType(kind).symbol;
    return fallback;
  }
  function isSafetyObjectKind(kind) {
    return ['station', 'signal_input', 'signal_output', 'signal_passage', 'sign_c', 'whistle', 'ktsm', 'brake_start', 'brake_end', 'neutral'].indexOf(kind) >= 0;
  }
  function draftKey() { return DRAFT_PREFIX + (state.sectionId || 'none') + ':' + state.mode; }

  function saveDraft() {
    if (!state.sectionId) return;
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        startM: state.selectionStartM,
        endM: state.selectionEndM,
        grade: state.grade,
        selectedSpeed: state.selectedSpeed,
        removeLimit: state.removeLimit,
        currentSpeed: currentSpeedInput ? currentSpeedInput.value : '',
        objectAction: state.objectAction,
        objectType: state.objectType,
        objectName: objectNameInput ? objectNameInput.value : '',
        objectDirection: objectDirectionInput ? objectDirectionInput.value : 'both',
        selectedObjectKey: state.selectedObjectKey,
        evidence: evidenceInput ? evidenceInput.value : '',
        comment: commentInput ? commentInput.value : '',
      }));
      var saveState = document.getElementById('communityEditorSaveState');
      if (saveState) saveState.textContent = 'Черновик сохранён · версия ' + state.communityVersion;
    } catch (error) {}
  }

  function restoreDraft() {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (error) {}
    if (!draft || typeof draft !== 'object') return false;
    var start = snapMeters(number(draft.startM));
    var end = snapMeters(number(draft.endM));
    if (start >= state.minM && end <= state.maxM && end > start && end - start <= MAX_SELECTION_M) {
      state.selectionStartM = start;
      state.selectionEndM = end;
      state.grade = clamp(number(draft.grade), -40, 40);
      state.gradeTouched = true;
      state.selectedSpeed = clamp(number(draft.selectedSpeed), 0, 160);
      state.removeLimit = draft.removeLimit === true;
      if (currentSpeedInput) currentSpeedInput.value = draft.currentSpeed || '';
      state.objectAction = ['add', 'update', 'remove'].indexOf(draft.objectAction) >= 0 ? draft.objectAction : 'add';
      state.objectType = OBJECT_TYPES[draft.objectType] ? draft.objectType : 'station';
      state.objectName = String(draft.objectName || '').slice(0, 80);
      state.objectDirection = ['both', 'odd', 'even'].indexOf(draft.objectDirection) >= 0 ? draft.objectDirection : 'both';
      state.selectedObjectKey = state.objects.some(function(item) { return item.key === draft.selectedObjectKey; }) ? draft.selectedObjectKey : '';
      if (!state.selectedObjectKey && state.objectAction !== 'add') state.objectAction = 'add';
      if (objectTypeInput) objectTypeInput.value = state.objectType;
      if (objectNameInput) objectNameInput.value = state.objectName;
      if (objectDirectionInput) objectDirectionInput.value = state.objectDirection;
      if (evidenceInput) evidenceInput.value = draft.evidence || '';
      if (commentInput) commentInput.value = draft.comment || '';
      centerWindowOn((start + end) / 2, false);
      return true;
    }
    return false;
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (error) {}
  }

  function safeSectionId(value) {
    var id = String(value || '');
    return /^[a-z0-9][a-z0-9-]{1,159}$/.test(id) ? id : '';
  }

  function sectionBounds(section) {
    var elements = Array.isArray(section && section.elements) ? section.elements : [];
    var min = Number(section && section.km_start) * 1000;
    var max = Number(section && section.km_end) * 1000;
    if (!Number.isFinite(min) && elements.length) min = Math.min.apply(null, elements.map(function(item) { return number(item.start_m); }));
    if (!Number.isFinite(max) && elements.length) max = Math.max.apply(null, elements.map(function(item) { return number(item.start_m) + number(item.len_m); }));
    var coverage = section && section.runtime && Array.isArray(section.runtime.profile_coverage) ? section.runtime.profile_coverage[0] : null;
    if (coverage && Number.isFinite(Number(coverage.start_m)) && Number.isFinite(Number(coverage.end_m))) {
      min = Number(coverage.start_m);
      max = Number(coverage.end_m);
    }
    return { min: snapMeters(min), max: snapMeters(max) };
  }

  function gradeAt(coordinate) {
    var target = number(coordinate);
    for (var i = 0; i < state.elements.length; i++) {
      var item = state.elements[i];
      var start = number(item.start_m);
      var end = start + number(item.len_m);
      if (target >= start && target < end) return number(item.grad_permille);
    }
    return 0;
  }

  function averageSelectedGrade() {
    var start = state.selectionStartM;
    var end = state.selectionEndM;
    var weighted = 0;
    var length = 0;
    state.elements.forEach(function(item) {
      var itemStart = number(item.start_m);
      var itemEnd = itemStart + number(item.len_m);
      var overlap = Math.max(0, Math.min(end, itemEnd) - Math.max(start, itemStart));
      if (!overlap) return;
      weighted += number(item.grad_permille) * overlap;
      length += overlap;
    });
    return length ? weighted / length : gradeAt((start + end) / 2);
  }

  function effectiveSpeedForSelection() {
    var center = (state.selectionStartM + state.selectionEndM) / 2;
    var latest = null;
    state.speedChanges.forEach(function(change) {
      if (center < number(change.startM) || center >= number(change.endM)) return;
      if (!latest || number(change.version) >= number(latest.version)) latest = change;
    });
    return latest && latest.action === 'set' && number(latest.toSpeed) > 0 ? number(latest.toSpeed) : 0;
  }

  function syncEffectiveSpeed() {
    if (state.mode !== 'speed' || state.speedTouched || !currentSpeedInput) return;
    var speed = effectiveSpeedForSelection();
    currentSpeedInput.value = speed ? String(speed) : '';
  }

  function renderSectionHistory() {
    var versionLabel = document.getElementById('communityEditorVersionLabel');
    var historyCount = document.getElementById('communityEditorHistoryCount');
    var historyRoot = document.getElementById('communityEditorHistoryList');
    if (versionLabel) versionLabel.textContent = state.communityVersion > 0
      ? 'Версия сообщества ' + state.communityVersion
      : 'Исходная карта';
    if (historyCount) historyCount.textContent = state.releaseHistory.length
      ? state.releaseHistory.length + ' ' + (state.releaseHistory.length === 1 ? 'запись' : state.releaseHistory.length < 5 ? 'записи' : 'записей')
      : 'История пуста';
    if (!historyRoot) return;
    historyRoot.textContent = '';
    if (!state.releaseHistory.length) {
      var empty = document.createElement('div');
      empty.className = 'community-editor-history-empty';
      empty.textContent = 'Коллеги ещё не публиковали изменения этого участка.';
      historyRoot.appendChild(empty);
      return;
    }
    state.releaseHistory.slice().reverse().forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'community-editor-history-item' + (item.state === 'rolled_back' ? ' is-rolled-back' : '') + (item.kind === 'rollback' ? ' is-rollback' : '');
      var version = document.createElement('span');
      version.className = 'community-editor-history-version';
      version.textContent = 'v' + number(item.version);
      var copy = document.createElement('span');
      copy.className = 'community-editor-history-copy';
      var title = document.createElement('strong');
      title.textContent = String(item.title || 'Изменение участка');
      var meta = document.createElement('span');
      var kindLabel = item.kind === 'profile' ? 'Профиль'
        : item.kind === 'speed' ? 'Скорость'
        : item.kind === 'geometry' ? 'GPS-линия'
        : item.kind === 'rollback' ? 'Отмена версии v' + number(item.targetVersion)
        : 'Объект карты';
      meta.textContent = item.state === 'rolled_back'
        ? kindLabel + ' · отменена версией v' + number(item.rolledBackBy && item.rolledBackBy.version)
        : kindLabel;
      copy.appendChild(title); copy.appendChild(meta);
      row.appendChild(version); row.appendChild(copy);
      if (item.kind !== 'rollback' && item.state !== 'rolled_back' && !state.previewProposal) {
        var rollbackButton = document.createElement('button');
        rollbackButton.type = 'button';
        rollbackButton.className = 'community-editor-history-rollback';
        rollbackButton.textContent = 'Отменить';
        rollbackButton.addEventListener('click', function() { openRollbackForm(item, row, rollbackButton); });
        row.appendChild(rollbackButton);
      }
      historyRoot.appendChild(row);
    });
  }

  function openRollbackForm(item, row, trigger) {
    var historyList = document.getElementById('communityEditorHistoryList');
    var existing = row.querySelector('.community-editor-rollback-form');
    if (existing) {
      existing.remove();
      if (historyList) historyList.classList.remove('has-rollback-form');
      trigger.setAttribute('aria-expanded', 'false');
      return;
    }
    document.querySelectorAll('.community-editor-rollback-form').forEach(function(form) { form.remove(); });
    if (historyList) historyList.classList.add('has-rollback-form');
    document.querySelectorAll('.community-editor-history-rollback').forEach(function(button) { button.setAttribute('aria-expanded', 'false'); });
    trigger.setAttribute('aria-expanded', 'true');
    var form = document.createElement('div');
    form.className = 'community-editor-rollback-form';
    var heading = document.createElement('strong');
    heading.textContent = 'Отменить версию v' + number(item.version);
    var hint = document.createElement('p');
    hint.textContent = 'Это создаст новое предложение для коллег. История не удалится.';
    var reason = document.createElement('textarea');
    reason.maxLength = 1000;
    reason.rows = 2;
    reason.placeholder = 'Почему правка ошибочна?';
    reason.setAttribute('aria-label', 'Причина отмены правки');
    var source = document.createElement('input');
    source.type = 'text';
    source.maxLength = 240;
    source.placeholder = item.riskLevel === 'safety_restriction' ? 'Приказ или другое основание — обязательно' : 'Приказ или другое основание, если есть';
    source.setAttribute('aria-label', 'Основание для отмены правки');
    var actions = document.createElement('div');
    actions.className = 'community-editor-rollback-actions';
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Не отменять';
    var submit = document.createElement('button');
    submit.type = 'button'; submit.textContent = 'Отправить коллегам';
    cancel.addEventListener('click', function() { form.remove(); if (historyList) historyList.classList.remove('has-rollback-form'); trigger.setAttribute('aria-expanded', 'false'); });
    submit.addEventListener('click', function() {
      var reasonText = String(reason.value || '').trim();
      var sourceText = String(source.value || '').trim();
      if (!reasonText) {
        reason.focus();
        if (typeof enqueueAppToast === 'function') enqueueAppToast('Напишите, почему правку нужно отменить', 'danger', 2600);
        return;
      }
      if (item.riskLevel === 'safety_restriction' && !sourceText) {
        source.focus();
        if (typeof enqueueAppToast === 'function') enqueueAppToast('Для отмены ограничения укажите приказ или другое основание', 'danger', 3000);
        return;
      }
      if (state.rollbackSubmitting) return;
      state.rollbackSubmitting = true;
      submit.disabled = true;
      submit.textContent = 'Отправляю…';
      request('/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          kind: 'section',
          title: 'Отменить v' + number(item.version) + ': ' + String(item.title || 'правку участка'),
          summary: reasonText,
          scope: { level: 'section', sectionId: state.sectionId },
          change: {
            editor: 'rollback-v1', action: 'rollback', sectionId: state.sectionId,
            targetReleaseId: String(item.id || ''), source: { communityVersion: state.communityVersion },
          },
          evidence: sourceText ? { sourceReference: sourceText } : {},
        }),
      }, 12000).then(function(result) {
        if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось отправить отмену');
        form.remove();
        if (historyList) historyList.classList.remove('has-rollback-form');
        trigger.disabled = true;
        trigger.textContent = 'На проверке';
        if (typeof enqueueAppToast === 'function') enqueueAppToast('Предложение об отмене отправлено коллегам', 'success', 3200);
        window.dispatchEvent(new CustomEvent('community:proposal-created', { detail: { proposal: result.body && result.body.proposal } }));
      }).catch(function(error) {
        submit.disabled = false;
        submit.textContent = 'Отправить коллегам';
        if (typeof enqueueAppToast === 'function') enqueueAppToast(error && error.message || 'Не удалось отправить отмену', 'danger', 3200);
      }).then(function() { state.rollbackSubmitting = false; });
    });
    actions.appendChild(cancel); actions.appendChild(submit);
    form.appendChild(heading); form.appendChild(hint); form.appendChild(reason); form.appendChild(source); form.appendChild(actions);
    row.appendChild(form);
    reason.focus();
  }

  function centerWindowOn(centerM, moveSelection) {
    var span = Math.min(WINDOW_TARGET_M, Math.max(SNAP_M, state.maxM - state.minM));
    state.windowSpanM = span;
    state.windowStartM = clamp(snapMeters(centerM - span / 2), state.minM, Math.max(state.minM, state.maxM - span));
    if (moveSelection) {
      var selectionLength = clamp(state.selectionEndM - state.selectionStartM || 1000, SNAP_M, Math.min(3000, span));
      var selectionStart = snapMeters(centerM - selectionLength / 2);
      selectionStart = clamp(selectionStart, state.windowStartM, state.windowStartM + span - selectionLength);
      state.selectionStartM = selectionStart;
      state.selectionEndM = selectionStart + selectionLength;
      state.gradeTouched = false;
    }
    syncPositionInput();
  }

  function syncPositionInput() {
    if (!positionInput) return;
    var travel = Math.max(0, state.maxM - state.minM - state.windowSpanM);
    positionInput.value = travel ? String(Math.round((state.windowStartM - state.minM) / travel * 1000)) : '0';
    var label = document.getElementById('communityEditorWindowLabel');
    if (label) label.textContent = formatChainage(state.windowStartM).replace(' 1 пк', '') + ' — ' + Math.floor((state.windowStartM + state.windowSpanM) / 1000) + ' км';
  }

  function buildProfilePoints() {
    var start = state.windowStartM;
    var end = start + state.windowSpanM;
    var boundaries = [start, end];
    state.elements.forEach(function(item) {
      var itemStart = number(item.start_m);
      var itemEnd = itemStart + number(item.len_m);
      if (itemStart > start && itemStart < end) boundaries.push(itemStart);
      if (itemEnd > start && itemEnd < end) boundaries.push(itemEnd);
    });
    boundaries.sort(function(a, b) { return a - b; });
    var unique = boundaries.filter(function(value, index) { return index === 0 || value !== boundaries[index - 1]; });
    var elevation = 0;
    return unique.map(function(coordinate, index) {
      if (index > 0) {
        var previous = unique[index - 1];
        elevation += gradeAt((previous + coordinate) / 2) * (coordinate - previous) / 1000;
      }
      return { coordinate: coordinate, elevation: elevation };
    });
  }

  function canvasMetrics() {
    var rect = canvasWrap.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var width = Math.max(280, rect.width);
    var height = Math.max(180, rect.height);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: width, height: height, top: 22, bottom: height - 34, left: 12, right: width - 12 };
  }

  function xFor(coordinate, layout) {
    return layout.left + (number(coordinate) - state.windowStartM) / state.windowSpanM * (layout.right - layout.left);
  }
  function coordinateForX(x, layout) {
    return snapMeters(state.windowStartM + clamp((x - layout.left) / (layout.right - layout.left), 0, 1) * state.windowSpanM);
  }

  function drawObjectMarker(item, layout, proposed, profileY, lane) {
    if (!item || item.coordinateM < state.windowStartM || item.coordinateM > state.windowStartM + state.windowSpanM) return;
    var type = getObjectType(item.kind);
    var anchorX = xFor(item.coordinateM, layout);
    var markerLane = clamp(Math.round(number(lane)), 0, 2);
    var markerX = anchorX + (markerLane === 1 ? -17 : markerLane === 2 ? 17 : 0);
    var selected = item.key && item.key === state.selectedObjectKey;
    var removing = proposed === 'remove';
    var changed = proposed === 'change';
    var iconSize = item.kind.indexOf('signal_') === 0 ? 36 : 32;
    var targetProfileY = number(profileY);
    var markerBaseline = clamp(targetProfileY - markerLane * 30, layout.top + iconSize + 2, layout.bottom - 1);
    var markerY = markerBaseline - iconSize / 2;
    ctx.save();
    if (Math.abs(markerBaseline - targetProfileY) > 2 || Math.abs(markerX - anchorX) > 2) {
      ctx.strokeStyle = 'rgba(148,163,184,.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(markerX, markerBaseline); ctx.lineTo(anchorX, targetProfileY); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = removing ? '#fb7185' : changed ? '#38bdf8' : selected ? '#a78bfa' : 'rgba(148,163,184,.55)';
    ctx.fillStyle = removing ? 'rgba(251,113,133,.18)' : changed ? 'rgba(56,189,248,.18)' : selected ? 'rgba(167,139,250,.18)' : 'rgba(15,23,42,.45)';
    ctx.lineWidth = proposed || selected ? 2 : 1;
    if (proposed || selected || removing) {
      ctx.beginPath(); ctx.arc(markerX, markerY, iconSize / 2 + 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    var imageDrawn = window.RailwaySignIcons && typeof window.RailwaySignIcons.drawCanvas === 'function' &&
      window.RailwaySignIcons.drawCanvas(ctx, item.kind, markerX, markerY, iconSize, { alpha: removing ? .5 : 1, shadow: true });
    if (!imageDrawn) {
      ctx.fillStyle = removing ? '#fecdd3' : changed ? '#bae6fd' : selected ? '#ddd6fe' : '#cbd5e1';
      ctx.font = '800 8px Golos Text, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(type.symbol, markerX, markerY + 3, 26);
    }
    if (removing) {
      ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(markerX - 12, markerY - 12); ctx.lineTo(markerX + 12, markerY + 12);
      ctx.moveTo(markerX + 12, markerY - 12); ctx.lineTo(markerX - 12, markerY + 12); ctx.stroke();
    }
    if (state.mode === 'object' && selected) {
      ctx.fillStyle = selected || proposed ? '#e7edf5' : 'rgba(199,210,254,.82)';
      ctx.font = '700 9px Golos Text, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.name || type.label).slice(0, 18), markerX, Math.max(layout.top + 9, markerY - iconSize / 2 - 5), 96);
    }
    ctx.restore();
  }

  function draw() {
    if (!state.section || !ctx) return;
    var layout = canvasMetrics();
    var points = buildProfilePoints();
    var elevations = points.map(function(point) { return point.elevation; });
    var minElevation = Math.min.apply(null, elevations);
    var maxElevation = Math.max.apply(null, elevations);
    var proposedStartElevation = points[0].elevation;
    for (var pointIndex = 1; pointIndex < points.length; pointIndex++) {
      if (state.selectionStartM <= points[pointIndex].coordinate) {
        var previousPoint = points[pointIndex - 1];
        proposedStartElevation = previousPoint.elevation + gradeAt((previousPoint.coordinate + state.selectionStartM) / 2) *
          (state.selectionStartM - previousPoint.coordinate) / 1000;
        break;
      }
    }
    var proposedEndElevation = proposedStartElevation + state.grade * (state.selectionEndM - state.selectionStartM) / 1000;
    minElevation = Math.min(minElevation, proposedEndElevation);
    maxElevation = Math.max(maxElevation, proposedEndElevation);
    var padding = Math.max(5, (maxElevation - minElevation) * 0.2);
    minElevation -= padding;
    maxElevation += padding;
    function yFor(elevation) {
      var range = Math.max(1, maxElevation - minElevation);
      return layout.bottom - (elevation - minElevation) / range * (layout.bottom - layout.top);
    }
    function profileYFor(coordinate) {
      var target = number(coordinate);
      for (var index = 1; index < points.length; index++) {
        var previous = points[index - 1];
        var currentPoint = points[index];
        if (target <= currentPoint.coordinate) {
          var segment = Math.max(1, currentPoint.coordinate - previous.coordinate);
          var progress = clamp((target - previous.coordinate) / segment, 0, 1);
          return yFor(previous.elevation + (currentPoint.elevation - previous.elevation) * progress);
        }
      }
      return yFor(points.length ? points[points.length - 1].elevation : 0);
    }

    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(0, 0, layout.width, layout.height);

    var firstKm = Math.ceil(state.windowStartM / 1000);
    var lastKm = Math.floor((state.windowStartM + state.windowSpanM) / 1000);
    ctx.font = '10px Golos Text, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (var km = firstKm; km <= lastKm; km++) {
      var gridX = xFor(km * 1000, layout);
      ctx.strokeStyle = 'rgba(148,163,184,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gridX, layout.top); ctx.lineTo(gridX, layout.bottom + 7); ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,.7)';
      ctx.fillText(km + ' км', gridX, layout.height - 11);
    }

    var selectionX1 = xFor(state.selectionStartM, layout);
    var selectionX2 = xFor(state.selectionEndM, layout);
    if (state.mode === 'object') {
      ctx.fillStyle = 'rgba(56,189,248,.12)';
      ctx.fillRect(selectionX1 - 2, layout.top, 4, layout.bottom - layout.top);
    } else {
      ctx.fillStyle = state.mode === 'speed' ? 'rgba(251,191,36,.10)' : 'rgba(56,189,248,.12)';
      ctx.fillRect(selectionX1, layout.top, Math.max(2, selectionX2 - selectionX1), layout.bottom - layout.top);
    }

    ctx.beginPath();
    points.forEach(function(point, index) {
      var x = xFor(point.coordinate, layout);
      var y = yFor(point.elevation);
      if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#e7edf5';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (state.mode === 'profile') {
      var startY = yFor(proposedStartElevation);
      var endY = yFor(proposedEndElevation);
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(selectionX1, startY); ctx.lineTo(selectionX2, endY);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3; ctx.stroke();
      ctx.setLineDash([]);
    } else if (state.mode === 'speed') {
      ctx.fillStyle = 'rgba(251,191,36,.18)';
      ctx.fillRect(selectionX1, layout.top + 4, Math.max(2, selectionX2 - selectionX1), 6);
    }

    var markerLaneLastX = [-Infinity, -Infinity, -Infinity];
    var markerLaneByKey = Object.create(null);
    function takeMarkerLane(markerX) {
      for (var lane = 0; lane < markerLaneLastX.length; lane++) {
        if (markerX - markerLaneLastX[lane] >= 34) {
          markerLaneLastX[lane] = markerX;
          return lane;
        }
      }
      markerLaneLastX[markerLaneLastX.length - 1] = markerX;
      return markerLaneLastX.length - 1;
    }
    state.objects.slice().sort(function(a, b) { return a.coordinateM - b.coordinateM; }).forEach(function(item) {
      var lane = takeMarkerLane(xFor(item.coordinateM, layout));
      markerLaneByKey[item.key] = lane;
      drawObjectMarker(item, layout, false, profileYFor(item.coordinateM), lane);
    });
    if (state.mode === 'object' && (state.objectAction === 'add' || state.objectAction === 'update')) {
      var proposedLane = takeMarkerLane(xFor(state.selectionStartM, layout));
      drawObjectMarker({
        coordinateM: state.selectionStartM,
        kind: state.objectType,
        name: String(objectNameInput && objectNameInput.value || getObjectType(state.objectType).defaultName),
      }, layout, 'change', profileYFor(state.selectionStartM), proposedLane);
    } else if (state.mode === 'object' && state.objectAction === 'remove' && selectedObject()) {
      drawObjectMarker(selectedObject(), layout, 'remove', profileYFor(selectedObject().coordinateM), number(markerLaneByKey[selectedObject().key]));
    }

    (state.mode === 'object' ? [selectionX1] : [selectionX1, selectionX2]).forEach(function(handleX) {
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(handleX, layout.top); ctx.lineTo(handleX, layout.bottom); ctx.stroke();
      ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(handleX, layout.top + 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0a1018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(handleX - 2.5, layout.top - 1); ctx.lineTo(handleX - 2.5, layout.top + 5); ctx.moveTo(handleX + 2.5, layout.top - 1); ctx.lineTo(handleX + 2.5, layout.top + 5); ctx.stroke();
    });
  }

  function updateLabels() {
    var currentGrade = averageSelectedGrade();
    if (state.mode === 'profile' && !state.gradeTouched) {
      state.grade = Math.round(currentGrade * 10) / 10;
      if (gradeInput) gradeInput.value = String(state.grade);
    }
    var start = document.getElementById('communityEditorStartLabel');
    var end = document.getElementById('communityEditorEndLabel');
    var length = document.getElementById('communityEditorLengthLabel');
    var current = document.getElementById('communityEditorCurrentGrade');
    var next = document.getElementById('communityEditorNextGrade');
    if (start) start.textContent = formatChainage(state.selectionStartM);
    if (end) end.textContent = formatChainage(state.selectionEndM);
    if (length) length.textContent = state.mode === 'object'
      ? formatChainage(state.selectionStartM)
      : formatLength(state.selectionEndM - state.selectionStartM);
    if (current) current.textContent = formatGrade(currentGrade);
    if (next) next.textContent = formatGrade(state.grade);
    var objectPosition = document.getElementById('communityEditorObjectPosition');
    if (objectPosition) objectPosition.textContent = formatChainage(state.selectionStartM);
    syncEffectiveSpeed();
    renderNearbyObjects();
    updateValidation();
    draw();
  }

  function renderNearbyObjects() {
    if (!nearbyObjectsRoot) return;
    nearbyObjectsRoot.textContent = '';
    var windowEnd = state.windowStartM + state.windowSpanM;
    var visible = state.objects.filter(function(item) {
      return item.coordinateM >= state.windowStartM && item.coordinateM <= windowEnd;
    }).slice(0, 14);
    if (!visible.length) {
      var empty = document.createElement('div');
      empty.className = 'community-editor-nearby-empty';
      empty.textContent = 'В этом окне пока нет объектов. Коснитесь профиля, чтобы добавить.';
      nearbyObjectsRoot.appendChild(empty);
      return;
    }
    visible.forEach(function(item) {
      var type = getObjectType(item.kind);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'community-editor-nearby-item' + (item.key === state.selectedObjectKey ? ' is-selected' : '');
      button.dataset.objectKey = item.key;
      var symbol = document.createElement('span');
      symbol.className = 'community-editor-object-symbol';
      symbol.appendChild(createObjectIcon(item.kind, 'community-editor-object-symbol-svg'));
      var copy = document.createElement('span');
      copy.className = 'community-editor-nearby-copy';
      var name = document.createElement('strong'); name.textContent = item.name || type.label;
      var meta = document.createElement('span'); meta.textContent = type.label + ' · ' + formatChainage(item.coordinateM);
      copy.appendChild(name); copy.appendChild(meta);
      var action = document.createElement('span'); action.textContent = item.key === state.selectedObjectKey ? 'выбрано' : 'выбрать';
      button.appendChild(symbol); button.appendChild(copy); button.appendChild(action);
      nearbyObjectsRoot.appendChild(button);
    });
  }

  function syncObjectActionUi() {
    var hasSelected = !!selectedObject();
    document.querySelectorAll('[data-object-action]').forEach(function(button) {
      var action = button.dataset.objectAction;
      button.disabled = !!state.previewProposal || (action !== 'add' && !hasSelected);
      button.classList.toggle('is-active', action === state.objectAction);
    });
    var remove = state.objectAction === 'remove';
    if (objectTypeInput) objectTypeInput.disabled = !!state.previewProposal || remove;
    if (objectNameInput) objectNameInput.disabled = !!state.previewProposal || remove;
    if (objectDirectionInput) objectDirectionInput.disabled = !!state.previewProposal || remove;
    syncObjectPalette();
  }

  function renderObjectPalette() {
    if (!objectPaletteRoot) return;
    objectPaletteRoot.textContent = '';
    Object.keys(OBJECT_TYPES).forEach(function(kind) {
      var type = OBJECT_TYPES[kind];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'community-editor-object-palette-item';
      button.dataset.objectKind = kind;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-label', type.label);
      button.appendChild(createObjectIcon(kind, 'community-editor-object-palette-icon'));
      var label = document.createElement('span'); label.textContent = type.shortLabel || type.label;
      button.appendChild(label);
      objectPaletteRoot.appendChild(button);
    });
    syncObjectPalette();
  }

  function syncObjectPalette() {
    if (!objectPaletteRoot) return;
    var disabled = !!state.previewProposal || state.objectAction === 'remove';
    objectPaletteRoot.querySelectorAll('[data-object-kind]').forEach(function(button) {
      var active = button.dataset.objectKind === state.objectType;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.disabled = disabled;
    });
  }

  function selectMapObject(item) {
    if (!item) return;
    state.selectedObjectKey = item.key;
    state.objectAction = 'update';
    state.objectType = item.kind;
    state.objectName = item.name;
    state.objectDirection = item.direction || 'both';
    state.selectionStartM = clamp(snapMeters(item.coordinateM), state.minM, state.maxM);
    state.selectionEndM = Math.min(state.maxM, state.selectionStartM + SNAP_M);
    if (objectTypeInput) objectTypeInput.value = state.objectType;
    if (objectNameInput) objectNameInput.value = state.objectName;
    if (objectDirectionInput) objectDirectionInput.value = state.objectDirection;
    centerWindowOn(item.coordinateM, false);
    syncObjectActionUi(); updateLabels(); saveDraft();
  }

  function setObjectAction(action) {
    if (['add', 'update', 'remove'].indexOf(action) < 0) return;
    if (action !== 'add' && !selectedObject()) return;
    state.objectAction = action;
    if (action === 'add') {
      state.selectedObjectKey = '';
      if (!String(objectNameInput && objectNameInput.value || '').trim()) {
        state.objectName = getObjectType(state.objectType).defaultName;
        if (objectNameInput) objectNameInput.value = state.objectName;
      }
    }
    syncObjectActionUi(); updateValidation(); draw(); saveDraft();
  }

  function updateModeUi() {
    var profileInspector = document.getElementById('communityEditorProfileInspector');
    var speedInspector = document.getElementById('communityEditorSpeedInspector');
    var objectInspector = document.getElementById('communityEditorObjectInspector');
    if (profileInspector) profileInspector.classList.toggle('hidden', state.mode !== 'profile');
    if (speedInspector) speedInspector.classList.toggle('hidden', state.mode !== 'speed');
    if (objectInspector) objectInspector.classList.toggle('hidden', state.mode !== 'object');
    var sheet = overlay.querySelector('.community-editor-sheet');
    if (sheet) sheet.classList.toggle('is-object-mode', state.mode === 'object');
    document.querySelectorAll('[data-editor-mode]').forEach(function(button) {
      var active = button.dataset.editorMode === state.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (!state.previewProposal) {
      var gestureHint = document.querySelector('.community-editor-gesture-hint');
      if (gestureHint) gestureHint.textContent = state.mode === 'object'
        ? 'Коснитесь профиля, чтобы поставить объект. Коснитесь метки, чтобы изменить или удалить её.'
        : 'Перетащите синие границы. Коснитесь профиля, чтобы перенести выделение.';
    }
    updateSpeedButtons();
    syncObjectActionUi();
    updateLabels();
  }

  function updateSpeedButtons() {
    document.querySelectorAll('#communityEditorSpeedGrid [data-speed]').forEach(function(button) {
      button.classList.toggle('is-active', !state.removeLimit && number(button.dataset.speed) === state.selectedSpeed);
    });
    var remove = document.getElementById('btnCommunityEditorRemoveLimit');
    if (remove) remove.classList.toggle('is-active', state.removeLimit);
  }

  function validationMessage() {
    if (!state.section) return { text: 'Профиль ещё не загружен', tone: 'error' };
    var length = state.selectionEndM - state.selectionStartM;
    if (state.mode !== 'object' && length < SNAP_M) return { text: 'Выберите хотя бы 100 метров', tone: 'error' };
    if (state.mode !== 'object' && length > MAX_SELECTION_M) return { text: 'Одна правка может быть не длиннее 20 км', tone: 'error' };
    if (state.mode === 'profile') {
      if (Math.abs(averageSelectedGrade() - state.grade) < 0.05) return { text: 'Измените уклон или выберите другой фрагмент', tone: 'error' };
      return { text: 'Будет отправлено изменение уклона на ' + formatLength(length), tone: 'ready' };
    }
    if (state.mode === 'object') {
      var currentObject = selectedObject();
      if (state.objectAction !== 'add' && !currentObject) return { text: 'Сначала выберите существующий объект', tone: 'error' };
      var objectName = String(objectNameInput && objectNameInput.value || '').trim();
      if (state.objectAction !== 'remove' && !objectName) return { text: 'Укажите подпись, которую увидит машинист', tone: 'error' };
      var safetyChange = state.objectAction !== 'add' && currentObject && isSafetyObjectKind(currentObject.kind);
      if (safetyChange && !String(evidenceInput && evidenceInput.value || '').trim()) {
        return { text: 'Для изменения или удаления важного объекта нужен приказ или источник', tone: 'error' };
      }
      var verb = state.objectAction === 'add' ? 'добавлен' : state.objectAction === 'update' ? 'изменён' : 'удалён';
      var kind = state.objectAction === 'remove' && currentObject ? currentObject.kind : state.objectType;
      return { text: getObjectType(kind).label + ' будет ' + verb, tone: 'ready' };
    }
    var fromSpeed = number(currentSpeedInput && currentSpeedInput.value);
    if (fromSpeed <= 0) return { text: 'Укажите действующую скорость', tone: 'error' };
    if (!state.removeLimit && state.selectedSpeed <= 0) return { text: 'Выберите новую скорость', tone: 'error' };
    var increase = state.removeLimit || state.selectedSpeed > fromSpeed;
    if (increase && !String(evidenceInput && evidenceInput.value || '').trim()) return { text: 'Для повышения скорости или отмены ограничения нужен приказ', tone: 'error' };
    return { text: state.removeLimit ? 'Будет предложена отмена ограничения' : 'Будет предложено ' + state.selectedSpeed + ' км/ч', tone: 'ready' };
  }

  function updateValidation() {
    if (state.previewProposal) {
      var previewValidation = document.getElementById('communityEditorValidation');
      if (previewValidation) {
        previewValidation.textContent = state.mode === 'object'
          ? 'Показано точное изменение объекта'
          : 'Показан точный фрагмент предложения коллеги';
        previewValidation.classList.remove('is-error');
        previewValidation.classList.add('is-ready');
      }
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Вернуться к проверке'; }
      return;
    }
    var result = validationMessage();
    var validation = document.getElementById('communityEditorValidation');
    if (validation) {
      validation.textContent = result.text;
      validation.classList.toggle('is-error', result.tone === 'error');
      validation.classList.toggle('is-ready', result.tone === 'ready');
    }
    if (submitButton) submitButton.disabled = state.submitting || result.tone !== 'ready';
    if (submitButton) submitButton.textContent = 'Отправить на проверку';
    var fromSpeed = number(currentSpeedInput && currentSpeedInput.value);
    var evidenceHint = document.getElementById('communityEditorEvidenceHint');
    var objectNeedsEvidence = state.mode === 'object' && state.objectAction !== 'add' && selectedObject() && isSafetyObjectKind(selectedObject().kind);
    if (evidenceHint) evidenceHint.textContent = (state.mode === 'speed' && (state.removeLimit || state.selectedSpeed > fromSpeed)) || objectNeedsEvidence ? 'обязательно' : 'если есть';
  }

  function resetSelection() {
    if (!state.section) return;
    var center = state.windowStartM + state.windowSpanM / 2;
    state.selectionStartM = snapMeters(center - 500);
    state.selectionEndM = snapMeters(center + 500);
    state.gradeTouched = false;
    state.selectedSpeed = 0;
    state.speedTouched = false;
    state.removeLimit = false;
    state.objectAction = 'add';
    state.selectedObjectKey = '';
    state.objectType = 'station';
    state.objectName = OBJECT_TYPES.station.defaultName;
    state.objectDirection = 'both';
    if (currentSpeedInput) currentSpeedInput.value = '';
    if (objectTypeInput) objectTypeInput.value = state.objectType;
    if (objectNameInput) objectNameInput.value = state.objectName;
    if (objectDirectionInput) objectDirectionInput.value = state.objectDirection;
    if (evidenceInput) evidenceInput.value = '';
    if (commentInput) commentInput.value = '';
    clearDraft();
    updateModeUi();
  }

  function loadSection(sectionId) {
    var safeId = safeSectionId(sectionId);
    if (!safeId) return Promise.reject(new Error('Некорректный идентификатор участка'));
    var loading = document.getElementById('communityEditorLoading');
    if (loading) { loading.textContent = 'Загружаю профиль…'; loading.classList.remove('hidden'); }
    return request('/sections/' + encodeURIComponent(safeId) + '/effective', { method: 'GET', headers: { Accept: 'application/json' } }, 12000)
      .then(function(result) {
        if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Профиль участка недоступен');
        return result.body && result.body.section;
      }).then(function(section) {
        if (!section || String(section.id || '') !== safeId || !Array.isArray(section.elements) || !section.elements.length) throw new Error('В участке пока нет профиля');
        var bounds = sectionBounds(section);
        if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max) || bounds.max <= bounds.min) throw new Error('Не определены границы участка');
        state.section = section;
        state.sectionId = safeId;
        state.elements = section.elements.slice().sort(function(a, b) { return number(a.start_m) - number(b.start_m); });
        state.objects = collectSectionObjects(section);
        state.communityVersion = number(section.community && section.community.version);
        state.releaseHistory = Array.isArray(section.community && section.community.history) ? section.community.history.slice() : [];
        state.speedChanges = Array.isArray(section.community && section.community.speedChanges) ? section.community.speedChanges.slice() : [];
        state.minM = bounds.min;
        state.maxM = bounds.max;
        state.windowSpanM = Math.min(WINDOW_TARGET_M, bounds.max - bounds.min);
        state.windowStartM = bounds.min;
        state.selectionStartM = bounds.min + Math.min(500, state.windowSpanM / 4);
        state.selectionEndM = Math.min(bounds.max, state.selectionStartM + 1000);
        state.gradeTouched = false;
        state.selectedSpeed = 0;
        state.removeLimit = false;
        state.objectAction = 'add';
        state.selectedObjectKey = '';
        state.objectType = OBJECT_TYPES[objectTypeInput && objectTypeInput.value] ? objectTypeInput.value : 'station';
        state.objectName = getObjectType(state.objectType).defaultName;
        state.objectDirection = 'both';
        state.speedTouched = false;
        if (objectNameInput) objectNameInput.value = state.objectName;
        if (objectDirectionInput) objectDirectionInput.value = state.objectDirection;
        if (!state.previewProposal && restoreDraft()) {
          // Restored draft already centered its window.
        } else {
          centerWindowOn(state.selectionStartM + 500, false);
        }
        if (loading) loading.classList.add('hidden');
        renderSectionHistory();
        var saveState = document.getElementById('communityEditorSaveState');
        if (saveState && !state.previewProposal) saveState.textContent = state.communityVersion
          ? 'Актуальная версия участка ' + state.communityVersion
          : 'Исходная карта · правок пока нет';
        updateModeUi();
        window.requestAnimationFrame(draw);
        return section;
      }).catch(function(error) {
        if (loading) { loading.textContent = error && error.message || 'Не удалось загрузить профиль'; loading.classList.remove('hidden'); }
        throw error;
      });
  }

  function populateSections(dashboard) {
    var ids = dashboard && dashboard.context && dashboard.context.pack && dashboard.context.pack.sectionIds || [];
    sectionSelect.textContent = '';
    ids.forEach(function(id) {
      var option = document.createElement('option');
      option.value = id; option.textContent = id;
      sectionSelect.appendChild(option);
    });
    if (!ids.length) {
      var empty = document.createElement('option');
      empty.value = ''; empty.textContent = 'В пакете депо пока нет участков';
      sectionSelect.appendChild(empty);
      sectionSelect.disabled = true;
      throw new Error('В пакете депо пока нет участков');
    }
    sectionSelect.disabled = false;
    return Promise.all(ids.map(function(id) {
      return fetch(SECTION_BASE + encodeURIComponent(id) + '.json', { headers: { Accept: 'application/json' } })
        .then(function(response) { return response.ok ? response.json() : null; })
        .catch(function() { return null; });
    })).then(function(sections) {
      sections.forEach(function(section, index) {
        if (section && sectionSelect.options[index]) sectionSelect.options[index].textContent = section.section_name || ids[index];
      });
      return ids[0];
    });
  }

  function setPreviewControls(preview) {
    overlay.classList.toggle('is-preview', !!preview);
    sectionSelect.disabled = !!preview;
    [gradeInput, currentSpeedInput, evidenceInput, commentInput, positionInput, objectTypeInput, objectNameInput, objectDirectionInput].forEach(function(input) { if (input) input.disabled = !!preview; });
    document.querySelectorAll('[data-editor-mode],[data-grade-step],[data-grade-value],[data-speed],#btnCommunityEditorRemoveLimit,[data-object-action],[data-object-move]')
      .forEach(function(button) { button.disabled = !!preview; });
    var title = document.getElementById('communityEditorTitle');
    var saveState = document.getElementById('communityEditorSaveState');
    var reset = document.getElementById('btnCommunityEditorReset');
    var gestureHint = document.querySelector('.community-editor-gesture-hint');
    if (title) title.textContent = preview ? 'Проверка фрагмента' : 'Редактор участка';
    if (saveState) saveState.textContent = preview
      ? 'Предложение коллеги · исходные данные не изменены'
      : state.communityVersion ? 'Актуальная версия участка ' + state.communityVersion : 'Исходная карта · правок пока нет';
    if (reset) reset.disabled = !!preview;
    if (gestureHint) gestureHint.textContent = preview
      ? 'Синими границами отмечен точный фрагмент предложения.'
      : 'Перетащите синие границы. Коснитесь профиля, чтобы перенести выделение.';
  }

  function applyPreviewProposal(proposal) {
    var change = proposal && proposal.change || {};
    state.previewProposal = proposal;
    state.mode = proposal.kind === 'speed' ? 'speed' : proposal.kind === 'object' ? 'object' : 'profile';
    var previewCoordinate = state.mode === 'object' ? number(change.coordinateM) : number(change.startM);
    state.selectionStartM = clamp(snapMeters(previewCoordinate), state.minM, state.maxM - SNAP_M);
    state.selectionEndM = state.mode === 'object'
      ? Math.min(state.maxM, state.selectionStartM + SNAP_M)
      : clamp(snapMeters(change.endM), state.selectionStartM + SNAP_M, state.maxM);
    if (state.mode === 'profile') {
      state.grade = clamp(number(change.toGrade), -40, 40);
      state.gradeTouched = true;
      gradeInput.value = String(state.grade);
    } else if (state.mode === 'speed') {
      currentSpeedInput.value = String(change.fromSpeed || '');
      state.removeLimit = change.action === 'remove';
      state.selectedSpeed = state.removeLimit ? 0 : number(change.toSpeed);
    } else {
      state.objectAction = ['add', 'update', 'remove'].indexOf(change.action) >= 0 ? change.action : 'add';
      var previewObject = change.object || change.sourceObject || {};
      state.objectType = OBJECT_TYPES[previewObject.kind] ? previewObject.kind : 'note';
      state.objectName = String(previewObject.name || getObjectType(state.objectType).defaultName);
      state.objectDirection = ['both', 'odd', 'even'].indexOf(previewObject.direction) >= 0 ? previewObject.direction : 'both';
      state.selectedObjectKey = change.sourceObject
        ? String(change.sourceObject.objectKey || change.sourceObject.communityKey || String(change.sourceObject.collection || '') + ':' + String(change.sourceObject.index))
        : '';
      if (objectTypeInput) objectTypeInput.value = state.objectType;
      if (objectNameInput) objectNameInput.value = state.objectName;
      if (objectDirectionInput) objectDirectionInput.value = state.objectDirection;
    }
    if (evidenceInput) evidenceInput.value = proposal.evidence && (proposal.evidence.sourceReference || proposal.evidence.orderNumber) || '';
    if (commentInput) commentInput.value = proposal.summary || '';
    centerWindowOn((state.selectionStartM + state.selectionEndM) / 2, false);
    setPreviewControls(true);
    var previewTitle = document.getElementById('communityEditorTitle');
    var previewHint = document.querySelector('.community-editor-gesture-hint');
    if (state.mode === 'object') {
      if (previewTitle) previewTitle.textContent = 'Проверка объекта';
      if (previewHint) previewHint.textContent = 'На схеме показано место и действие, предложенное коллегой.';
    }
    updateModeUi();
  }

  function openEditorInternal() {
    if (typeof closeOverlay === 'function') closeOverlay('overlayCommunity');
    if (typeof openOverlay === 'function') openOverlay('overlayCommunityEditor');
    request('/dashboard', { method: 'GET', headers: { Accept: 'application/json' } }, 10000).then(function(result) {
      if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось открыть редактор');
      state.dashboard = result.body;
      if (!result.body.context || !result.body.context.configured) throw new Error('Сначала выберите дорогу и депо в профиле');
      return populateSections(result.body);
    }).then(function(firstSectionId) {
      var previewSectionId = state.previewProposal && state.previewProposal.change && state.previewProposal.change.sectionId;
      var targetSectionId = safeSectionId(previewSectionId) || firstSectionId;
      sectionSelect.value = targetSectionId;
      return loadSection(targetSectionId);
    }).then(function() {
      if (state.previewProposal) applyPreviewProposal(state.previewProposal);
      else setPreviewControls(false);
    }).catch(function(error) {
      var loading = document.getElementById('communityEditorLoading');
      if (loading) { loading.textContent = error && error.message || 'Редактор недоступен'; loading.classList.remove('hidden'); }
      if (typeof enqueueAppToast === 'function') enqueueAppToast(error && error.message || 'Редактор недоступен', 'danger', 3000);
    });
  }

  function openEditor() {
    state.previewProposal = null;
    setPreviewControls(false);
    openEditorInternal();
  }

  function openProposalPreview(proposal) {
    if (!proposal || !proposal.change || proposal.change.editor !== 'visual-v1') return;
    state.previewProposal = proposal;
    setPreviewControls(true);
    openEditorInternal();
  }

  function pointerCoordinate(event) {
    var rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', function(event) {
    if (!state.section || state.previewProposal) return;
    var point = pointerCoordinate(event);
    var layout = canvasMetrics();
    if (state.mode === 'object') {
      var nearest = null;
      state.objects.forEach(function(item) {
        if (item.coordinateM < state.windowStartM || item.coordinateM > state.windowStartM + state.windowSpanM) return;
        var distance = Math.abs(point.x - xFor(item.coordinateM, layout));
        if (distance <= 28 && (!nearest || distance < nearest.distance)) nearest = { item: item, distance: distance };
      });
      if (nearest) {
        selectMapObject(nearest.item);
        return;
      }
      state.selectionStartM = clamp(coordinateForX(point.x, layout), state.windowStartM, state.windowStartM + state.windowSpanM - SNAP_M);
      state.selectionEndM = state.selectionStartM + SNAP_M;
      if (state.objectAction === 'remove') state.objectAction = selectedObject() ? 'update' : 'add';
      state.dragHandle = 'point';
      state.pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      syncObjectActionUi(); updateLabels();
      event.preventDefault();
      return;
    }
    var startX = xFor(state.selectionStartM, layout);
    var endX = xFor(state.selectionEndM, layout);
    var distanceStart = Math.abs(point.x - startX);
    var distanceEnd = Math.abs(point.x - endX);
    if (Math.min(distanceStart, distanceEnd) <= 34) state.dragHandle = distanceStart <= distanceEnd ? 'start' : 'end';
    else {
      var length = state.selectionEndM - state.selectionStartM;
      var center = coordinateForX(point.x, layout);
      var newStart = clamp(snapMeters(center - length / 2), state.windowStartM, state.windowStartM + state.windowSpanM - length);
      state.selectionStartM = newStart;
      state.selectionEndM = newStart + length;
      state.gradeTouched = false;
      state.dragHandle = distanceStart <= distanceEnd ? 'start' : 'end';
      updateLabels();
    }
    state.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', function(event) {
    if (state.pointerId !== event.pointerId || !state.dragHandle) return;
    var layout = canvasMetrics();
    var coordinate = coordinateForX(pointerCoordinate(event).x, layout);
    if (state.dragHandle === 'point') {
      state.selectionStartM = clamp(coordinate, state.windowStartM, state.windowStartM + state.windowSpanM - SNAP_M);
      state.selectionEndM = state.selectionStartM + SNAP_M;
    } else if (state.dragHandle === 'start') state.selectionStartM = clamp(coordinate, state.windowStartM, state.selectionEndM - SNAP_M);
    else state.selectionEndM = clamp(coordinate, state.selectionStartM + SNAP_M, state.windowStartM + state.windowSpanM);
    state.gradeTouched = false;
    updateLabels();
    event.preventDefault();
  });

  function endPointer(event) {
    if (state.pointerId !== event.pointerId) return;
    state.pointerId = null; state.dragHandle = '';
    saveDraft();
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  positionInput.addEventListener('input', function() {
    if (!state.section) return;
    var travel = Math.max(0, state.maxM - state.minM - state.windowSpanM);
    state.windowStartM = snapMeters(state.minM + travel * number(this.value) / 1000);
    if (state.selectionStartM < state.windowStartM || state.selectionEndM > state.windowStartM + state.windowSpanM) {
      var center = state.windowStartM + state.windowSpanM / 2;
      var length = clamp(state.selectionEndM - state.selectionStartM || 1000, SNAP_M, 3000);
      state.selectionStartM = snapMeters(center - length / 2);
      state.selectionEndM = state.selectionStartM + length;
      state.gradeTouched = false;
    }
    syncPositionInput(); updateLabels();
  });
  positionInput.addEventListener('change', saveDraft);

  document.querySelectorAll('[data-editor-mode]').forEach(function(button) {
    button.addEventListener('click', function() {
      state.mode = ['profile', 'speed', 'object'].indexOf(this.dataset.editorMode) >= 0 ? this.dataset.editorMode : 'profile';
      restoreDraft();
      updateModeUi();
    });
  });
  document.querySelectorAll('[data-grade-step]').forEach(function(button) {
    button.addEventListener('click', function() {
      state.grade = clamp(Math.round((state.grade + number(this.dataset.gradeStep) * 0.1) * 10) / 10, -40, 40);
      state.gradeTouched = true; gradeInput.value = String(state.grade); updateLabels(); saveDraft();
    });
  });
  document.querySelectorAll('[data-grade-value]').forEach(function(button) {
    button.addEventListener('click', function() {
      state.grade = clamp(number(this.dataset.gradeValue), -40, 40);
      state.gradeTouched = true; gradeInput.value = String(state.grade); updateLabels(); saveDraft();
    });
  });
  gradeInput.addEventListener('input', function() { state.grade = clamp(number(this.value), -40, 40); state.gradeTouched = true; updateLabels(); });
  gradeInput.addEventListener('change', saveDraft);
  document.getElementById('communityEditorSpeedGrid').addEventListener('click', function(event) {
    var button = event.target.closest('[data-speed]');
    if (!button) return;
    state.selectedSpeed = number(button.dataset.speed); state.removeLimit = false; updateSpeedButtons(); updateValidation(); saveDraft();
  });
  document.getElementById('btnCommunityEditorRemoveLimit').addEventListener('click', function() {
    state.removeLimit = !state.removeLimit; if (state.removeLimit) state.selectedSpeed = 0; updateSpeedButtons(); updateValidation(); saveDraft();
  });
  document.querySelectorAll('[data-object-action]').forEach(function(button) {
    button.addEventListener('click', function() { setObjectAction(this.dataset.objectAction); });
  });
  document.querySelectorAll('[data-object-move]').forEach(function(button) {
    button.addEventListener('click', function() {
      var next = clamp(snapMeters(state.selectionStartM + number(this.dataset.objectMove)), state.minM, state.maxM - SNAP_M);
      state.selectionStartM = next; state.selectionEndM = Math.min(state.maxM, next + SNAP_M);
      centerWindowOn(next, false); updateLabels(); saveDraft();
    });
  });
  if (objectTypeInput) objectTypeInput.addEventListener('change', function() {
    var previousType = getObjectType(state.objectType);
    var currentName = String(objectNameInput && objectNameInput.value || '').trim();
    state.objectType = OBJECT_TYPES[this.value] ? this.value : 'note';
    if (!currentName || currentName === previousType.defaultName) {
      state.objectName = getObjectType(state.objectType).defaultName;
      if (objectNameInput) objectNameInput.value = state.objectName;
    }
    syncObjectPalette(); updateValidation(); draw(); saveDraft();
  });
  if (objectPaletteRoot) objectPaletteRoot.addEventListener('click', function(event) {
    var button = event.target.closest('[data-object-kind]');
    if (!button || button.disabled || !OBJECT_TYPES[button.dataset.objectKind] || !objectTypeInput) return;
    objectTypeInput.value = button.dataset.objectKind;
    objectTypeInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (objectNameInput) objectNameInput.addEventListener('input', function() {
    state.objectName = this.value; updateValidation(); draw();
  });
  if (objectNameInput) objectNameInput.addEventListener('change', saveDraft);
  if (objectDirectionInput) objectDirectionInput.addEventListener('change', function() {
    state.objectDirection = this.value; updateValidation(); saveDraft();
  });
  if (nearbyObjectsRoot) nearbyObjectsRoot.addEventListener('click', function(event) {
    var button = event.target.closest('[data-object-key]');
    if (!button) return;
    var item = state.objects.find(function(candidate) { return candidate.key === button.dataset.objectKey; });
    if (item) selectMapObject(item);
  });
  renderObjectPalette();
  if (currentSpeedInput) {
    currentSpeedInput.addEventListener('input', function() { state.speedTouched = true; updateValidation(); });
    currentSpeedInput.addEventListener('change', saveDraft);
  }
  [evidenceInput, commentInput].forEach(function(input) {
    input.addEventListener('input', updateValidation); input.addEventListener('change', saveDraft);
  });
  sectionSelect.addEventListener('change', function() { loadSection(this.value).catch(function() {}); });
  openButton.addEventListener('click', openEditor);
  document.getElementById('btnCommunityEditorClose').addEventListener('click', function() {
    if (!state.previewProposal) saveDraft();
    if (typeof closeOverlay === 'function') closeOverlay('overlayCommunityEditor');
    if (state.previewProposal && typeof openOverlay === 'function') openOverlay('overlayCommunity');
    state.previewProposal = null;
    setPreviewControls(false);
  });
  document.getElementById('btnCommunityEditorReset').addEventListener('click', resetSelection);
  window.addEventListener('resize', function() { window.requestAnimationFrame(draw); });

  submitButton.addEventListener('click', function() {
    if (state.previewProposal) {
      if (typeof closeOverlay === 'function') closeOverlay('overlayCommunityEditor');
      if (typeof openOverlay === 'function') openOverlay('overlayCommunity');
      state.previewProposal = null;
      setPreviewControls(false);
      return;
    }
    var validation = validationMessage();
    if (validation.tone !== 'ready' || state.submitting) return;
    var currentGrade = Math.round(averageSelectedGrade() * 10) / 10;
    var currentSpeed = number(currentSpeedInput && currentSpeedInput.value);
    var change = {
      editor: 'visual-v1',
      sectionId: state.sectionId,
      startM: state.selectionStartM,
      endM: state.selectionEndM,
      source: {
        schemaVersion: String(state.section.schema_version || ''),
        profileStatus: String(state.section.runtime && state.section.runtime.profile_status || ''),
        communityVersion: state.communityVersion,
      },
    };
    var title;
    if (state.mode === 'profile') {
      change.fromGrade = currentGrade;
      change.toGrade = Math.round(state.grade * 10) / 10;
      title = 'Уклон ' + formatGrade(currentGrade) + ' → ' + formatGrade(state.grade) + ', ' + formatChainage(state.selectionStartM);
    } else if (state.mode === 'speed') {
      change.fromSpeed = currentSpeed;
      change.toSpeed = state.removeLimit ? currentSpeed : state.selectedSpeed;
      change.action = state.removeLimit ? 'remove' : 'set';
      title = state.removeLimit ? 'Отменить ограничение ' + currentSpeed + ' км/ч' : 'Скорость ' + currentSpeed + ' → ' + state.selectedSpeed + ' км/ч';
    } else {
      var mapObject = selectedObject();
      var objectType = getObjectType(state.objectType);
      change.coordinateM = state.selectionStartM;
      change.action = state.objectAction;
      if (state.objectAction !== 'remove') {
        change.object = {
          kind: state.objectType,
          collection: objectType.collection,
          name: String(objectNameInput && objectNameInput.value || '').trim(),
          direction: String(objectDirectionInput && objectDirectionInput.value || 'both'),
        };
      }
      if (state.objectAction !== 'add' && mapObject) {
        change.sourceObject = {
          collection: mapObject.collection,
          index: mapObject.index,
          objectKey: mapObject.objectKey || mapObject.key,
          coordinateM: mapObject.coordinateM,
          kind: mapObject.kind,
          name: mapObject.name,
          direction: mapObject.direction,
        };
      }
      var namedObject = state.objectAction === 'remove' && mapObject ? mapObject : change.object;
      var actionLabel = state.objectAction === 'add' ? 'Добавить' : state.objectAction === 'update' ? 'Изменить' : 'Удалить';
      title = actionLabel + ': ' + getObjectType(namedObject.kind).label + ' · ' + String(namedObject.name || '') + ', ' + formatChainage(state.selectionStartM);
    }
    state.submitting = true;
    updateValidation();
    request('/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        kind: state.mode === 'profile' ? 'profile' : state.mode === 'speed' ? 'speed' : 'object',
        title: title,
        summary: String(commentInput && commentInput.value || '').trim(),
        baseVersion: String(state.section.schema_version || '') + ':' + String(state.section.runtime && state.section.runtime.profile_status || ''),
        scope: { level: 'section', sectionId: state.sectionId },
        change: change,
        evidence: String(evidenceInput && evidenceInput.value || '').trim() ? { sourceReference: String(evidenceInput.value).trim() } : {},
      }),
    }, 12000).then(function(result) {
      if (!result || !result.ok) throw new Error(result && result.body && result.body.error || 'Не удалось отправить изменение');
      clearDraft();
      if (typeof closeOverlay === 'function') closeOverlay('overlayCommunityEditor');
      if (typeof enqueueAppToast === 'function') enqueueAppToast('Фрагмент отправлен коллегам на проверку', 'success', 3000);
      window.dispatchEvent(new CustomEvent('community:proposal-created', { detail: { proposal: result.body && result.body.proposal } }));
    }).catch(function(error) {
      if (typeof enqueueAppToast === 'function') enqueueAppToast(error && error.message || 'Не удалось отправить изменение', 'danger', 3200);
    }).then(function() { state.submitting = false; updateValidation(); });
  });

  window.CommunityVisualEditor = {
    open: openEditor,
    preview: openProposalPreview,
    getState: function() { return {
      sectionId: state.sectionId,
      mode: state.mode,
      windowStartM: state.windowStartM,
      selectionStartM: state.selectionStartM,
      selectionEndM: state.selectionEndM,
      grade: state.grade,
    }; },
    formatChainage: formatChainage,
  };
})();
