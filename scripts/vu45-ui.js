(function() {
  'use strict';

  var STORAGE_KEY = 'shift_tracker_vu45_draft_v1';
  var MAX_GROUPS = 12;
  var calculator = window.Vu45Calculator;
  if (!calculator) return;

  var elements = {};
  var state = createDefaultState();

  function createDefaultState() {
    return {
      type: 'loaded',
      normPer100Tf: 33,
      weightTf: '',
      totalAxles: '',
      gradientPermille: '',
      locomotive: { enabled: false, presetId: '3te25k2m', mode: 'loaded', manualSeries: '', weightTf: 441, brakeForceTf: 180 },
      groups: [{ id: createId(), presetId: 'composite-loaded', axles: '', forcePerAxle: 8.5 }]
    };
  }

  function createId() {
    return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function sanitizeDecimalInput(value) {
    return String(value == null ? '' : value).replace(/[^0-9,.]/g, '').replace(/([,.].*)[,.]/g, '$1').slice(0, 10);
  }

  function sanitizeSeriesInput(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 40);
  }

  function finitePositive(value) {
    var number = calculator.toNumber(value);
    return number >= 0 && Number.isFinite(number) ? number : 0;
  }

  function getPreset(id) {
    for (var i = 0; i < calculator.BRAKE_PRESETS.length; i++) {
      if (calculator.BRAKE_PRESETS[i].id === id) return calculator.BRAKE_PRESETS[i];
    }
    return calculator.BRAKE_PRESETS[0];
  }

  function getLocomotivePreset(id) {
    id = calculator.LOCOMOTIVE_PRESET_ALIASES[id] || id;
    for (var i = 0; i < calculator.LOCOMOTIVE_PRESETS.length; i++) {
      if (calculator.LOCOMOTIVE_PRESETS[i].id === id) return calculator.LOCOMOTIVE_PRESETS[i];
    }
    return calculator.LOCOMOTIVE_PRESETS[0];
  }

  function isManualLocomotivePreset(id) {
    return getLocomotivePreset(id).manual === true;
  }

  function locomotivePresetFromLegacy(locomotive) {
    var requestedId = String(locomotive && locomotive.presetId || '');
    if (requestedId) return getLocomotivePreset(requestedId).id;
    var legacySeries = sanitizeSeriesInput(locomotive && locomotive.series).trim().toLocaleUpperCase('ru-RU');
    if (!legacySeries) return '3te25k2m';
    var legacyAliases = {
      '3ТЭ28': '3te25k2m',
      '2ТЭ10': '2te116',
      '2ТЭ10 (КРОМЕ 2ТЭ10Л)': '2te116',
      'ВЛ85': '3es5k',
      'ВЛ80Р': '2es5k',
      'ВЛ80С': '2es5k',
      'ВЛ80Т': '2es5k',
      'ТЭМ2': 'tem2-tem18',
      'ТЭМ18': 'tem2-tem18',
      'ТЭМ7': 'tem7',
      'ТЭМ7А': 'tem7',
      '2ТЭ25': '2te25km',
      '2ТЭ25КМ': '2te25km',
      'ТЭМ': 'manual',
      'ТЭП': 'manual'
    };
    if (legacyAliases[legacySeries]) return legacyAliases[legacySeries];
    for (var i = 0; i < calculator.LOCOMOTIVE_PRESETS.length; i++) {
      if (calculator.LOCOMOTIVE_PRESETS[i].label.toLocaleUpperCase('ru-RU') === legacySeries) return calculator.LOCOMOTIVE_PRESETS[i].id;
    }
    return 'manual';
  }

  function syncLocomotiveValues(locomotive) {
    if (isManualLocomotivePreset(locomotive.presetId)) return locomotive;
    var values = calculator.locomotiveValues(locomotive.presetId, locomotive.mode);
    locomotive.weightTf = values.weightTf;
    locomotive.brakeForceTf = values.brakeForceTf;
    return locomotive;
  }

  function locomotiveLabel() {
    return isManualLocomotivePreset(state.locomotive.presetId)
      ? state.locomotive.manualSeries || 'Свои данные'
      : getLocomotivePreset(state.locomotive.presetId).label;
  }

  function locomotiveWarningText() {
    if (isManualLocomotivePreset(state.locomotive.presetId)) {
      return 'Серии нет в справочнике: введите массу и нажатие из действующей инструкции.';
    }
    var preset = getLocomotivePreset(state.locomotive.presetId);
    if (preset.forceBasis === 'default-diesel') {
      return 'Нажатие рассчитано по нормативной строке «остальные тепловозы»: 10 тс/ось на гружёном и 5 тс/ось на порожнем режиме. Сверьте местную таблицу.';
    }
    if (preset.forceBasis === 'ptr-explicit') {
      return 'Масса и нажатие подставлены из расчётных таблиц для этой группы ТЭМ. Проверьте применимость к своей модификации.';
    }
    return 'Масса и нажатие подставлены из таблиц для выбранной серии и режима. Проверьте их применимость по действующей инструкции.';
  }

  function normalizeState(candidate) {
    if (!candidate || typeof candidate !== 'object') return createDefaultState();
    var normalizedType = ['loaded', 'empty', 'manual'].indexOf(candidate.type) >= 0 ? candidate.type : 'loaded';
    var groups = Array.isArray(candidate.groups) ? candidate.groups.slice(0, MAX_GROUPS).map(function(group) {
      var preset = getPreset(String(group && group.presetId || ''));
      var presetId = preset.id;
      var force = presetId === 'custom' ? finitePositive(group && group.forcePerAxle) : preset.forcePerAxle;
      return {
        id: createId(),
        presetId: presetId,
        axles: sanitizeDecimalInput(group && group.axles),
        forcePerAxle: force
      };
    }) : [];
    if (!groups.length) groups = createDefaultState().groups;
    var locomotive = candidate.locomotive && typeof candidate.locomotive === 'object' ? candidate.locomotive : {};
    var locomotivePresetId = locomotivePresetFromLegacy(locomotive);
    var locomotiveMode = ['loaded', 'medium', 'empty'].indexOf(locomotive.mode) >= 0 ? locomotive.mode : 'loaded';
    var manualLocomotivePreset = getLocomotivePreset(locomotivePresetId);
    var manualLocomotive = manualLocomotivePreset.manual === true;
    var normalizedLocomotive = {
      enabled: locomotive.enabled === true,
      presetId: locomotivePresetId,
      mode: locomotiveMode,
      manualSeries: sanitizeSeriesInput(locomotive.manualSeries || (manualLocomotive ? locomotive.series || manualLocomotivePreset.manualSeries : '')),
      weightTf: manualLocomotive ? sanitizeDecimalInput(locomotive.weightTf) : '',
      brakeForceTf: manualLocomotive ? sanitizeDecimalInput(locomotive.brakeForceTf) : ''
    };
    syncLocomotiveValues(normalizedLocomotive);
    return {
      type: normalizedType,
      normPer100Tf: normalizedType === 'loaded' ? 33 : normalizedType === 'empty' ? 55 : finitePositive(candidate.normPer100Tf),
      weightTf: sanitizeDecimalInput(candidate.weightTf),
      totalAxles: sanitizeDecimalInput(candidate.totalAxles),
      gradientPermille: sanitizeDecimalInput(candidate.gradientPermille),
      locomotive: normalizedLocomotive,
      groups: groups
    };
  }

  function loadDraft() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) state = normalizeState(JSON.parse(saved));
    } catch (error) {
      state = createDefaultState();
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function formatNumber(value, digits) {
    var number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return number.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits == null ? 2 : digits
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function showFeedback(message, tone) {
    if (typeof window.showSaveToast === 'function') {
      window.showSaveToast(message, tone || 'info');
      return;
    }
    var button = elements.copy;
    if (!button) return;
    var previous = button.textContent;
    button.textContent = message;
    window.setTimeout(function() { button.textContent = previous; }, 1600);
  }

  function presetOptions(selectedId) {
    return calculator.BRAKE_PRESETS.map(function(preset) {
      return '<option value="' + preset.id + '"' + (preset.id === selectedId ? ' selected' : '') + '>' + preset.label + '</option>';
    }).join('');
  }

  function renderGroups() {
    elements.groups.innerHTML = state.groups.map(function(group, index) {
      var preset = getPreset(group.presetId);
      var custom = preset.id === 'custom';
      var force = finitePositive(group.forcePerAxle);
      var groupForce = finitePositive(group.axles) * force;
      return '<div class="vu45-group" data-vu45-group="' + group.id + '">' +
        '<div class="vu45-group-type"><span>Тип и состояние</span>' +
          '<div class="glass-select vu45-preset-select" data-placeholder="Выберите тип">' +
            '<button class="glass-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">' +
              '<span class="glass-select-value">' + preset.label + '</span>' +
              '<span class="glass-select-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l5 5 5-5"></path></svg></span>' +
            '</button>' +
            '<div class="glass-select-menu hidden" role="listbox" aria-label="Тип колодок группы ' + (index + 1) + '"></div>' +
            '<select class="hidden" tabindex="-1" aria-hidden="true" data-vu45-field="preset" aria-label="Тип колодок группы ' + (index + 1) + '">' + presetOptions(group.presetId) + '</select>' +
          '</div>' +
        '</div>' +
        '<label><span>Оси</span><input data-vu45-field="axles" type="text" inputmode="numeric" autocomplete="off" value="' + group.axles + '" placeholder="0" aria-label="Тормозные оси группы ' + (index + 1) + '"></label>' +
        '<button class="vu45-group-remove" data-vu45-remove type="button" aria-label="Удалить группу ' + (index + 1) + '">×</button>' +
        '<div class="vu45-group-force"><span class="vu45-group-force-label">Нажатие: <b>' + formatNumber(groupForce) + ' тс</b> · ' + formatNumber(force) + ' тс/ось</span>' +
        (custom ? '<input class="vu45-group-custom-force" data-vu45-field="force" type="text" inputmode="decimal" autocomplete="off" value="' + (force || '') + '" placeholder="тс/ось" aria-label="Нажатие на одну ось группы ' + (index + 1) + '">' : '') + '</div>' +
      '</div>';
    }).join('');
    if (window.GlassSelect && typeof window.GlassSelect.enhance === 'function') {
      var presetSelects = elements.groups.querySelectorAll('.vu45-preset-select');
      for (var i = 0; i < presetSelects.length; i++) window.GlassSelect.enhance(presetSelects[i]);
    }
    elements.addGroup.disabled = state.groups.length >= MAX_GROUPS;
    elements.addGroup.textContent = state.groups.length >= MAX_GROUPS ? 'Достигнут максимум: 12 групп' : '+ Добавить группу осей';
  }

  function currentNorm() {
    if (state.type === 'loaded') return 33;
    if (state.type === 'empty') return 55;
    return finitePositive(state.normPer100Tf);
  }

  function groupAxlesTotal() {
    return state.groups.reduce(function(total, group) { return total + finitePositive(group.axles); }, 0);
  }

  function updateAxleCheck() {
    var counted = groupAxlesTotal();
    var total = finitePositive(state.totalAxles);
    if (!counted && !total) {
      elements.axleCheck.hidden = true;
      return;
    }
    elements.axleCheck.hidden = false;
    elements.axleCheck.classList.toggle('is-error', total > 0 && counted > total);
    if (total > 0 && counted > total) {
      elements.axleCheck.textContent = 'В группах ' + formatNumber(counted, 0) + ' ос., а всего указано ' + formatNumber(total, 0) + '. Проверьте ввод.';
    } else if (total > 0) {
      elements.axleCheck.textContent = 'В расчёте ' + formatNumber(counted, 0) + ' из ' + formatNumber(total, 0) + ' осей состава.';
    } else {
      elements.axleCheck.textContent = 'В расчёте ' + formatNumber(counted, 0) + ' тормозных осей.';
    }
  }

  function calculate() {
    return calculator.calculate({
      weightTf: state.weightTf,
      normPer100Tf: currentNorm(),
      gradientPermille: state.gradientPermille,
      locomotive: state.locomotive,
      groups: state.groups
    });
  }

  function updateResult() {
    var result = calculate();
    var hasWeight = result.compositionWeightTf > 0;
    var hasNorm = result.normPer100Tf > 0;
    var hasActual = result.actualForceTf > 0;
    var locomotiveComplete = !state.locomotive.enabled || (result.locomotiveWeightTf > 0 && result.locomotiveBrakeForceTf > 0);
    var isComplete = hasWeight && hasNorm && hasActual && locomotiveComplete;
    elements.result.classList.toggle('is-ok', isComplete && result.meetsEnteredNorm);
    elements.result.classList.toggle('is-short', isComplete && !result.meetsEnteredNorm);
    elements.required.textContent = hasWeight && hasNorm ? formatNumber(result.requiredForceTf) : '—';
    elements.actual.textContent = formatNumber(result.actualForceTf);
    elements.per100.textContent = hasWeight && hasActual ? formatNumber(result.actualPer100Tf) + ' тс' : '—';
    elements.margin.textContent = isComplete ? (result.marginTf > 0 ? '+' : '') + formatNumber(result.marginTf) + ' тс' : '—';
    elements.manual.textContent = state.gradientPermille !== '' && hasWeight
      ? (result.manualCalculationRequired ? 'по местной норме' : formatNumber(result.requiredManualBrakeAxles, 0) + ' ос.')
      : '—';

    if (!hasWeight) {
      elements.status.textContent = 'Укажите массу состава';
      elements.badge.textContent = 'не заполнено';
    } else if (!hasNorm) {
      elements.status.textContent = 'Укажите свою норму';
      elements.badge.textContent = 'не заполнено';
    } else if (state.locomotive.enabled && !locomotiveComplete) {
      elements.status.textContent = 'Заполните массу и нажатие локомотива';
      elements.badge.textContent = 'не заполнено';
    } else if (!hasActual) {
      elements.status.textContent = 'Добавьте тормозные оси';
      elements.badge.textContent = 'не заполнено';
    } else if (result.meetsEnteredNorm) {
      elements.status.textContent = 'Нажатие не ниже введённой нормы';
      elements.badge.textContent = 'сходится';
    } else {
      elements.status.textContent = 'Нажатия недостаточно по введённым данным';
      elements.badge.textContent = 'дефицит';
    }

    if (result.manualCalculationRequired) {
      elements.note.textContent = 'Уклон свыше 20‰: число ручных тормозных осей определите по местной инструкции. Расчёт не заменяет подписанную ВУ‑45.';
    } else if (result.localRuleWarning) {
      elements.note.textContent = 'На уклоне свыше 12‰ проверьте местную норму ручных тормозных осей. Расчёт не заменяет подписанную ВУ‑45.';
    } else {
      elements.note.textContent = 'Сверьте исходные данные с осмотрщиком. Расчёт не заменяет проверенную и подписанную справку ВУ‑45.';
    }
    elements.locomotiveResult.hidden = !state.locomotive.enabled;
    if (state.locomotive.enabled) {
      var locomotiveName = locomotiveLabel();
      elements.locomotiveResult.innerHTML = '<span>' + escapeHtml(locomotiveName) + ' · ' + escapeHtml(state.locomotive.mode === 'loaded' ? 'гружёный' : state.locomotive.mode === 'medium' ? 'средний' : 'порожний') + '</span><strong>+' + formatNumber(result.locomotiveWeightTf) + ' т · +' + formatNumber(result.locomotiveBrakeForceTf) + ' тс</strong>';
    }
    elements.copy.disabled = !isComplete;
    updateAxleCheck();
    saveDraft();
  }

  function syncFormFromState() {
    var typeButtons = document.querySelectorAll('[data-vu45-type]');
    for (var i = 0; i < typeButtons.length; i++) {
      var active = typeButtons[i].getAttribute('data-vu45-type') === state.type;
      typeButtons[i].classList.toggle('is-active', active);
      typeButtons[i].setAttribute('aria-checked', active ? 'true' : 'false');
    }
    elements.customNormField.hidden = state.type !== 'manual';
    elements.customNorm.value = state.type === 'manual' ? state.normPer100Tf || '' : '';
    elements.weight.value = state.weightTf;
    elements.totalAxles.value = state.totalAxles;
    elements.gradient.value = state.gradientPermille;
    elements.locomotive.classList.toggle('is-enabled', state.locomotive.enabled);
    elements.locomotiveToggle.setAttribute('aria-expanded', state.locomotive.enabled ? 'true' : 'false');
    elements.locomotiveToggleMark.textContent = state.locomotive.enabled ? '−' : '+';
    elements.locomotiveFields.hidden = !state.locomotive.enabled;
    elements.locomotivePreset.value = state.locomotive.presetId;
    elements.locomotiveMode.value = state.locomotive.mode;
    if (window.GlassSelect) {
      window.GlassSelect.sync(elements.locomotivePresetRoot);
      window.GlassSelect.sync(elements.locomotiveModeRoot);
    }
    var manualLocomotive = isManualLocomotivePreset(state.locomotive.presetId);
    elements.locomotiveManualSeriesField.hidden = !manualLocomotive;
    elements.locomotiveSeries.value = state.locomotive.manualSeries;
    elements.locomotiveWeight.readOnly = !manualLocomotive;
    elements.locomotiveForce.readOnly = !manualLocomotive;
    elements.locomotiveWeight.value = String(state.locomotive.weightTf == null ? '' : state.locomotive.weightTf).replace('.', ',');
    elements.locomotiveForce.value = String(state.locomotive.brakeForceTf == null ? '' : state.locomotive.brakeForceTf).replace('.', ',');
    elements.locomotiveWarning.textContent = locomotiveWarningText();
    renderGroups();
    updateResult();
  }

  function setType(type) {
    if (['loaded', 'empty', 'manual'].indexOf(type) < 0) return;
    var onlyEmptyDefaultGroup = state.groups.length === 1 && !finitePositive(state.groups[0].axles) && state.groups[0].presetId !== 'custom';
    state.type = type;
    state.normPer100Tf = type === 'loaded' ? 33 : type === 'empty' ? 55 : state.normPer100Tf || '';
    if (onlyEmptyDefaultGroup) {
      state.groups[0].presetId = type === 'empty' ? 'composite-empty' : 'composite-loaded';
      state.groups[0].forcePerAxle = type === 'empty' ? 3.5 : 8.5;
    }
    syncFormFromState();
    if (type === 'manual') elements.customNorm.focus();
  }

  function findGroup(groupId) {
    for (var i = 0; i < state.groups.length; i++) if (state.groups[i].id === groupId) return state.groups[i];
    return null;
  }

  function handleGroupInput(event) {
    var row = event.target.closest('[data-vu45-group]');
    if (!row) return;
    var group = findGroup(row.getAttribute('data-vu45-group'));
    if (!group) return;
    var field = event.target.getAttribute('data-vu45-field');
    if (field === 'axles') {
      event.target.value = sanitizeDecimalInput(event.target.value).replace(/[,.].*$/, '');
      group.axles = event.target.value;
      var label = row.querySelector('.vu45-group-force-label');
      if (label) label.innerHTML = 'Нажатие: <b>' + formatNumber(finitePositive(group.axles) * finitePositive(group.forcePerAxle)) + ' тс</b> · ' + formatNumber(group.forcePerAxle) + ' тс/ось';
      updateResult();
    } else if (field === 'force') {
      event.target.value = sanitizeDecimalInput(event.target.value);
      group.forcePerAxle = finitePositive(event.target.value);
      var forceLabel = row.querySelector('.vu45-group-force-label');
      if (forceLabel) forceLabel.innerHTML = 'Нажатие: <b>' + formatNumber(finitePositive(group.axles) * group.forcePerAxle) + ' тс</b> · ' + formatNumber(group.forcePerAxle) + ' тс/ось';
      updateResult();
    }
  }

  function handleGroupChange(event) {
    if (event.target.getAttribute('data-vu45-field') !== 'preset') return;
    var row = event.target.closest('[data-vu45-group]');
    var group = row && findGroup(row.getAttribute('data-vu45-group'));
    if (!group) return;
    var preset = getPreset(event.target.value);
    group.presetId = preset.id;
    group.forcePerAxle = preset.forcePerAxle == null ? group.forcePerAxle || 0 : preset.forcePerAxle;
    renderGroups();
    updateResult();
  }

  function addGroup() {
    if (state.groups.length >= MAX_GROUPS) return;
    state.groups.push({ id: createId(), presetId: 'custom', axles: '', forcePerAxle: 0 });
    renderGroups();
    updateResult();
    var rows = elements.groups.querySelectorAll('.vu45-group');
    var last = rows[rows.length - 1];
    if (last) last.querySelector('select').focus();
  }

  function removeGroup(groupId) {
    if (state.groups.length === 1) {
      state.groups[0].axles = '';
      state.groups[0].forcePerAxle = getPreset(state.groups[0].presetId).forcePerAxle || 0;
    } else {
      state.groups = state.groups.filter(function(group) { return group.id !== groupId; });
    }
    renderGroups();
    updateResult();
  }

  function resultText() {
    var result = calculate();
    var typeLabel = state.type === 'loaded' ? 'гружёный' : state.type === 'empty' ? 'порожний' : 'своя норма';
    var lines = [
      'Расчёт ВУ-45',
      'Грузовой поезд: ' + typeLabel,
      'Масса состава: ' + formatNumber(result.compositionWeightTf) + ' т',
      'Норма: ' + formatNumber(result.normPer100Tf) + ' тс/100 т',
      'Требуется: ' + formatNumber(result.requiredForceTf) + ' тс',
      'Фактически: ' + formatNumber(result.actualForceTf) + ' тс',
      'Запас/дефицит: ' + (result.marginTf > 0 ? '+' : '') + formatNumber(result.marginTf) + ' тс',
      'Фактически на 100 т: ' + formatNumber(result.actualPer100Tf) + ' тс'
    ];
    if (state.locomotive.enabled) {
      lines.splice(3, 0,
        'Локомотив: ' + locomotiveLabel(),
        'Учётная масса локомотива: ' + formatNumber(result.locomotiveWeightTf) + ' т',
        'Нажатие локомотива: ' + formatNumber(result.locomotiveBrakeForceTf) + ' тс',
        'Расчётная масса с локомотивом: ' + formatNumber(result.weightTf) + ' т'
      );
    }
    if (state.gradientPermille !== '') {
      lines.push('Наибольший спуск: ' + formatNumber(finitePositive(state.gradientPermille)) + '‰');
      lines.push('Ручных тормозных осей: ' + (result.manualCalculationRequired ? 'по местной норме' : formatNumber(result.requiredManualBrakeAxles, 0)));
    }
    lines.push('Черновой расчёт. Сверить с проверенной и подписанной справкой ВУ-45.');
    return lines.join('\n');
  }

  function copyResult() {
    var text = resultText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() { showFeedback('Расчёт скопирован', 'success'); }).catch(function() { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showFeedback('Расчёт скопирован', 'success');
    } catch (error) {
      showFeedback('Не удалось скопировать', 'error');
    }
    textarea.remove();
  }

  function openCalculator() {
    // Локомотив — редкая дополнительная часть расчёта. Сохраняем выбранную
    // серию в черновике, но подключаем её только после явного нажатия каждый раз.
    state.locomotive.enabled = false;
    syncFormFromState();
    if (typeof window.openOverlay === 'function') window.openOverlay('overlayVu45');
    else if (typeof openOverlay === 'function') openOverlay('overlayVu45');
    var scroll = elements.overlay.querySelector('.vu45-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function closeCalculator() {
    if (typeof window.closeOverlay === 'function') window.closeOverlay('overlayVu45');
    else if (typeof closeOverlay === 'function') closeOverlay('overlayVu45');
  }

  function bindElements() {
    elements.overlay = document.getElementById('overlayVu45');
    elements.groups = document.getElementById('vu45Groups');
    if (!elements.overlay || !elements.groups) return false;
    elements.weight = document.getElementById('vu45Weight');
    elements.totalAxles = document.getElementById('vu45TotalAxles');
    elements.gradient = document.getElementById('vu45Gradient');
    elements.locomotive = document.getElementById('vu45Locomotive');
    elements.locomotiveToggle = document.getElementById('btnVu45Locomotive');
    elements.locomotiveToggleMark = elements.locomotiveToggle.querySelector('.vu45-locomotive-toggle-mark');
    elements.locomotiveFields = document.getElementById('vu45LocomotiveFields');
    elements.locomotivePresetRoot = document.getElementById('vu45LocomotivePresetRoot');
    elements.locomotivePreset = document.getElementById('vu45LocomotivePreset');
    elements.locomotiveModeRoot = document.getElementById('vu45LocomotiveModeRoot');
    elements.locomotiveMode = document.getElementById('vu45LocomotiveMode');
    elements.locomotiveManualSeriesField = document.getElementById('vu45LocomotiveManualSeriesField');
    elements.locomotiveSeries = document.getElementById('vu45LocomotiveSeries');
    elements.locomotiveWeight = document.getElementById('vu45LocomotiveWeight');
    elements.locomotiveForce = document.getElementById('vu45LocomotiveForce');
    elements.locomotiveWarning = document.getElementById('vu45LocomotiveWarning');
    elements.customNorm = document.getElementById('vu45CustomNorm');
    elements.customNormField = document.getElementById('vu45CustomNormField');
    elements.addGroup = document.getElementById('btnVu45AddGroup');
    elements.axleCheck = document.getElementById('vu45AxleCheck');
    elements.result = document.getElementById('vu45Result');
    elements.status = document.getElementById('vu45ResultStatus');
    elements.badge = document.getElementById('vu45ResultBadge');
    elements.required = document.getElementById('vu45RequiredForce');
    elements.actual = document.getElementById('vu45ActualForce');
    elements.per100 = document.getElementById('vu45ActualPer100');
    elements.margin = document.getElementById('vu45Margin');
    elements.manual = document.getElementById('vu45ManualAxles');
    elements.locomotiveResult = document.getElementById('vu45ResultLocomotive');
    elements.note = document.getElementById('vu45ResultNote');
    elements.copy = document.getElementById('btnCopyVu45');
    return true;
  }

  function init() {
    if (!bindElements()) return;
    loadDraft();
    if (window.GlassSelect) {
      window.GlassSelect.enhance(elements.locomotivePresetRoot);
      window.GlassSelect.enhance(elements.locomotiveModeRoot);
    }
    syncFormFromState();

    document.getElementById('btnOpenVu45').addEventListener('click', openCalculator);
    document.getElementById('btnCloseVu45').addEventListener('click', closeCalculator);
    document.getElementById('btnResetVu45').addEventListener('click', function() {
      state = createDefaultState();
      syncFormFromState();
      showFeedback('Расчёт очищен', 'info');
    });
    elements.copy.addEventListener('click', copyResult);
    elements.locomotiveToggle.addEventListener('click', function() {
      state.locomotive.enabled = !state.locomotive.enabled;
      syncFormFromState();
      if (state.locomotive.enabled) elements.locomotivePresetRoot.querySelector('.glass-select-trigger').focus();
    });
    elements.addGroup.addEventListener('click', addGroup);
    elements.groups.addEventListener('input', handleGroupInput);
    elements.groups.addEventListener('change', handleGroupChange);
    elements.groups.addEventListener('click', function(event) {
      var remove = event.target.closest('[data-vu45-remove]');
      var row = remove && remove.closest('[data-vu45-group]');
      if (row) removeGroup(row.getAttribute('data-vu45-group'));
    });
    document.querySelector('.vu45-type-switch').addEventListener('click', function(event) {
      var button = event.target.closest('[data-vu45-type]');
      if (button) setType(button.getAttribute('data-vu45-type'));
    });

    [elements.weight, elements.totalAxles, elements.gradient, elements.customNorm].forEach(function(input) {
      input.addEventListener('input', function() {
        input.value = sanitizeDecimalInput(input.value);
        if (input === elements.weight) state.weightTf = input.value;
        if (input === elements.totalAxles) state.totalAxles = input.value.replace(/[,.].*$/, '');
        if (input === elements.gradient) state.gradientPermille = input.value;
        if (input === elements.customNorm) state.normPer100Tf = input.value;
        updateResult();
      });
    });
    elements.locomotivePreset.addEventListener('change', function() {
      state.locomotive.presetId = getLocomotivePreset(elements.locomotivePreset.value).id;
      var selectedLocomotivePreset = getLocomotivePreset(state.locomotive.presetId);
      if (selectedLocomotivePreset.manual) {
        state.locomotive.manualSeries = selectedLocomotivePreset.manualSeries || '';
        state.locomotive.weightTf = '';
        state.locomotive.brakeForceTf = '';
      } else {
        syncLocomotiveValues(state.locomotive);
      }
      syncFormFromState();
      if (selectedLocomotivePreset.manual) elements.locomotiveSeries.focus();
    });
    elements.locomotiveMode.addEventListener('change', function() {
      state.locomotive.mode = ['loaded', 'medium', 'empty'].indexOf(elements.locomotiveMode.value) >= 0 ? elements.locomotiveMode.value : 'loaded';
      syncLocomotiveValues(state.locomotive);
      syncFormFromState();
    });
    elements.locomotiveSeries.addEventListener('input', function() {
      elements.locomotiveSeries.value = sanitizeSeriesInput(elements.locomotiveSeries.value);
      state.locomotive.manualSeries = elements.locomotiveSeries.value;
      updateResult();
    });
    [elements.locomotiveWeight, elements.locomotiveForce].forEach(function(input) {
      input.addEventListener('input', function() {
        if (!isManualLocomotivePreset(state.locomotive.presetId)) return;
        input.value = sanitizeDecimalInput(input.value);
        if (input === elements.locomotiveWeight) state.locomotive.weightTf = input.value;
        if (input === elements.locomotiveForce) state.locomotive.brakeForceTf = input.value;
        updateResult();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
