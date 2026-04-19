(function() {
  var STOPWATCH_STAGES = [
    { id: 'kvt', at: 35, time: '00:35', label: 'КВТ', hint: 'МОЖНО ОТПУСТИТЬ КВТ', sound: 'tiny' },
    { id: 'nabor', at: 60, time: '01:00', label: 'Набор', hint: 'МОЖНО НАБИРАТЬСЯ', sound: 'tiny' },
    { id: 'move', at: 180, time: '03:00', label: 'Движение', hint: 'МОЖНО НАЧАТЬ ДВИЖЕНИЕ', sound: 'tiny' },
    { id: 'spravka', at: 300, time: '05:00', label: 'Справка / I-Е', hint: 'ОТМЕТЬ СПРАВКУ И ПОСТАВЬ В I-Е', sound: 'attention' },
    { id: 'probe', at: 1800, time: '30:00', label: 'Технология', hint: 'ВЫПОЛНИ ТЕХНОЛОГИЮ', sound: 'danger' }
  ];

  var timerValueEl = document.getElementById('timerValue');
  var timerStageTitleEl = document.getElementById('timerStageTitle');
  var timerStageSubtitleEl = document.getElementById('timerStageSubtitle');
  var timerMainBtn = document.getElementById('timerMainBtn');
  var timerMainBtnLabel = document.getElementById('timerMainBtnLabel');
  var timerMainBtnHint = document.getElementById('timerMainBtnHint');
  var timerStageListEl = document.getElementById('timerStageList');
  var timerStageMetaEl = document.getElementById('timerStageMeta');
  var timerModeLabelEl = document.getElementById('timerModeLabel');
  var timerProgressFillEl = document.getElementById('timerProgressFill');
  var timerDisplayCardEl = document.querySelector('.timer-display-card');
  var timerMarkerMap = {
    kvt: document.getElementById('timerMarkerKvt'),
    nabor: document.getElementById('timerMarkerNabor'),
    move: document.getElementById('timerMarkerMove'),
    spravka: document.getElementById('timerMarkerSpravka'),
    probe: document.getElementById('timerMarkerProbe')
  };

  if (!timerValueEl || !window.createStopwatchEngine) return;

  var audioCtx = null;
  var engine = window.createStopwatchEngine({ stages: STOPWATCH_STAGES });

  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }

  function playTone(config) {
    config = config || {};
    if (!audioCtx) return;
    var now = audioCtx.currentTime + (config.delay || 0);
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = config.type || 'sine';
    osc.frequency.setValueAtTime(config.frequency || 440, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(config.volume || 0.02, now + (config.attack || 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (config.duration || 0.06) + (config.release || 0.06));
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + (config.duration || 0.06) + (config.release || 0.06) + 0.03);
  }

  function playStageSound(kind) {
    ensureAudio();
    if (kind === 'danger') {
      playTone({ frequency: 420, duration: 0.09, volume: 0.032, delay: 0 });
      playTone({ frequency: 360, duration: 0.09, volume: 0.026, delay: 0.12 });
      return;
    }
    if (kind === 'attention') {
      playTone({ frequency: 540, duration: 0.08, volume: 0.024 });
      return;
    }
    playTone({ frequency: 620, duration: 0.03, volume: 0.016, attack: 0.004, release: 0.04 });
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function formatTime(totalSeconds) {
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function getStageStatus(state) {
    var elapsed = state.elapsedSeconds;
    if (elapsed >= 1800) {
      return { title: 'ВЫПОЛНИ ТЕХНОЛОГИЮ', subtitle: '' };
    }
    if (elapsed >= 300) {
      return { title: 'ОТМЕТЬ СПРАВКУ И ПОСТАВЬ В I-Е', subtitle: '' };
    }
    if (elapsed >= 180) {
      return { title: 'МОЖНО НАЧАТЬ ДВИЖЕНИЕ', subtitle: '' };
    }
    if (elapsed >= 60) {
      return { title: 'МОЖНО НАБИРАТЬСЯ', subtitle: '' };
    }
    if (elapsed >= 35) {
      return { title: 'МОЖНО ОТПУСТИТЬ КВТ', subtitle: '' };
    }
    if (state.isRunning) {
      return { title: 'ТАЙМЕР ЗАПУЩЕН', subtitle: '' };
    }
    return { title: 'ГОТОВ К ЗАПУСКУ', subtitle: '' };
  }

  function getModeLabel(mode) {
    if (mode === 'danger') return 'КРИТИЧНЫЙ';
    if (mode === 'attention') return 'ВНИМАНИЕ';
    return 'ОБЫЧНЫЙ';
  }

  function mapTimelineProgress(seconds) {
    var clamped = Math.max(0, Math.min(1800, seconds || 0));
    if (clamped <= 300) {
      return (clamped / 300) * 68;
    }
    return 68 + ((clamped - 300) / 1500) * 32;
  }

  function renderProgress(state) {
    if (timerProgressFillEl) {
      timerProgressFillEl.style.width = mapTimelineProgress(state.elapsedSeconds) + '%';
    }

    for (var i = 0; i < STOPWATCH_STAGES.length; i++) {
      var stage = STOPWATCH_STAGES[i];
      var marker = timerMarkerMap[stage.id];
      if (!marker) continue;
      marker.style.left = mapTimelineProgress(stage.at) + '%';
      marker.classList.toggle('is-done', state.elapsedSeconds >= stage.at);
      marker.classList.toggle('is-next', !!state.nextStage && state.nextStage.id === stage.id);
    }
  }

  function renderStageList(state) {
    if (!timerStageListEl) return;
    var triggeredMap = Object.create(null);
    for (var i = 0; i < state.triggeredIds.length; i++) {
      triggeredMap[state.triggeredIds[i]] = true;
    }

    var html = '';
    for (var j = 0; j < STOPWATCH_STAGES.length; j++) {
      var stage = STOPWATCH_STAGES[j];
      var isDone = !!triggeredMap[stage.id];
      var isNext = !!state.nextStage && state.nextStage.id === stage.id;
      html += '<div class="dashboard-meta-item timer-stage-item' + (isDone ? ' is-done' : '') + (isNext ? ' is-next' : '') + '">' +
        '<div class="timer-stage-row">' +
          '<span class="timer-stage-name">' + escapeHtml(stage.label) + '</span>' +
          '<span class="timer-stage-time">' + stage.time + '</span>' +
        '</div>' +
        '<div class="timer-stage-caption">' + escapeHtml(stage.hint) + '</div>' +
      '</div>';
    }
    timerStageListEl.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render(state) {
    var stageStatus = getStageStatus(state);
    timerValueEl.textContent = formatTime(state.elapsedSeconds);
    timerStageTitleEl.textContent = stageStatus.title;
    if (timerStageSubtitleEl) {
      timerStageSubtitleEl.textContent = stageStatus.subtitle || '';
      timerStageSubtitleEl.style.display = stageStatus.subtitle ? 'block' : 'none';
    }
    if (timerDisplayCardEl) {
      timerDisplayCardEl.setAttribute('data-timer-mode', state.mode || 'normal');
    }
    if (timerMainBtnLabel) {
      timerMainBtnLabel.textContent = state.isRunning ? 'Пауза' : (state.elapsedSeconds > 0 ? 'Продолжить' : 'Старт');
    }
    if (timerMainBtnHint) {
      timerMainBtnHint.textContent = state.elapsedSeconds > 0 ? 'Удерживай для сброса' : 'Нажми, чтобы начать';
    }
    if (timerStageMetaEl) {
      timerStageMetaEl.textContent = state.nextStage ? state.nextStage.time : 'ГОТОВО';
    }
    if (timerModeLabelEl) {
      timerModeLabelEl.textContent = getModeLabel(state.mode);
    }
    renderProgress(state);
    renderStageList(state);
  }

  function handleStage(stage) {
    if (!stage) return;
    playStageSound(stage.sound);
    if (stage.id === 'probe') {
      if (typeof triggerHapticWarning === 'function') triggerHapticWarning();
      vibrate([20, 60, 20]);
      return;
    }
    if (stage.id === 'spravka') {
      if (typeof triggerHapticActionMedium === 'function') triggerHapticActionMedium();
      vibrate(18);
      return;
    }
    if (typeof triggerHapticSelection === 'function') triggerHapticSelection();
    vibrate(10);
  }

  engine.subscribe(function(event) {
    var state = event.state || engine.getState();
    render(state);
    if (event.type === 'stage') {
      handleStage(event.stage);
    }
  });

  if (timerMainBtn) {
    var holdTimeout = null;
    var holdStart = 0;
    var holdRaf = null;
    var suppressClick = false;
    var holdArmed = false;
    var HOLD_MS = 700;

    function cleanupHold() {
      holdArmed = false;
      if (holdTimeout) {
        window.clearTimeout(holdTimeout);
        holdTimeout = null;
      }
      if (holdRaf) {
        window.cancelAnimationFrame(holdRaf);
        holdRaf = null;
      }
      timerMainBtn.classList.remove('is-holding');
      timerMainBtn.style.setProperty('--timer-hold-fill', '0%');
      timerMainBtn.style.setProperty('--timer-hold-progress', '0');
    }

    function updateHoldProgress() {
      if (!holdArmed) return;
      var progress = Math.min(100, ((Date.now() - holdStart) / HOLD_MS) * 100);
      timerMainBtn.style.setProperty('--timer-hold-fill', progress + '%');
      timerMainBtn.style.setProperty('--timer-hold-progress', String(progress / 100));
      if (progress >= 100) return;
      holdRaf = window.requestAnimationFrame(updateHoldProgress);
    }

    function triggerResetFromHold() {
      suppressClick = true;
      cleanupHold();
      if (typeof triggerHapticWarning === 'function') triggerHapticWarning();
      vibrate([18, 40, 18]);
      engine.reset();
    }

    timerMainBtn.addEventListener('pointerdown', function(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      suppressClick = false;
      if (typeof triggerHapticTapSoft === 'function') triggerHapticTapSoft();
      if (!engine.getState().elapsedSeconds) {
        cleanupHold();
        return;
      }
      holdArmed = true;
      holdStart = Date.now();
      timerMainBtn.classList.add('is-holding');
      holdTimeout = window.setTimeout(triggerResetFromHold, HOLD_MS);
      updateHoldProgress();
    });

    function cancelHold() {
      cleanupHold();
    }

    timerMainBtn.addEventListener('pointerup', cancelHold);
    timerMainBtn.addEventListener('pointerleave', cancelHold);
    timerMainBtn.addEventListener('pointercancel', cancelHold);

    timerMainBtn.addEventListener('click', function() {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (typeof triggerHapticTapSoft === 'function') triggerHapticTapSoft();
      engine.toggle();
    });
  }

  window.renderStopwatchScreen = function() {
    if (typeof isStopwatchProLocked === 'function' && isStopwatchProLocked()) {
      if (typeof renderStopwatchProGate === 'function') renderStopwatchProGate();
      return;
    }
    render(engine.getState());
  };
})();
