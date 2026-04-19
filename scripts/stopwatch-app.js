(function() {
  var STORAGE_SOUND_KEY = 'shift_tracker_stopwatch_sound_v1';
  var STORAGE_VIBRATION_KEY = 'shift_tracker_stopwatch_vibration_v1';

  var STOPWATCH_STAGES = [
    { id: 'kvt', at: 35, time: '00:35', label: 'КВТ', hint: 'Можно отпустить КВТ', sound: 'tiny' },
    { id: 'nabor', at: 60, time: '01:00', label: 'Набор', hint: 'Можно набираться', sound: 'tiny' },
    { id: 'move', at: 180, time: '03:00', label: 'Движение', hint: 'Можно начать движение', sound: 'tiny' },
    { id: 'spravka', at: 300, time: '05:00', label: 'Справка / I-ое', hint: 'Нужно сделать справку и I-ое', sound: 'attention' },
    { id: 'probe', at: 1800, time: '30:00', label: 'Проба', hint: 'Нужно делать пробу', sound: 'danger' }
  ];

  var timerValueEl = document.getElementById('timerValue');
  var timerStageTitleEl = document.getElementById('timerStageTitle');
  var timerStageSubtitleEl = document.getElementById('timerStageSubtitle');
  var timerMainBtn = document.getElementById('timerMainBtn');
  var timerMainBtnLabel = document.getElementById('timerMainBtnLabel');
  var timerMainBtnHint = document.getElementById('timerMainBtnHint');
  var timerResetBtn = document.getElementById('timerResetBtn');
  var timerMarkBtn = document.getElementById('timerMarkBtn');
  var timerSoundToggle = document.getElementById('timerSoundToggle');
  var timerVibrationToggle = document.getElementById('timerVibrationToggle');
  var timerStageListEl = document.getElementById('timerStageList');
  var timerStageMetaEl = document.getElementById('timerStageMeta');
  var timerDisplayCardEl = document.querySelector('.timer-display-card');

  if (!timerValueEl || !window.createStopwatchEngine) return;

  var stopwatchPrefs = {
    sound: readBool(STORAGE_SOUND_KEY, true),
    vibration: readBool(STORAGE_VIBRATION_KEY, true)
  };

  var audioCtx = null;
  var engine = window.createStopwatchEngine({ stages: STOPWATCH_STAGES });

  function readBool(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch (e) {}
    return fallback;
  }

  function writeBool(key, value) {
    try {
      window.localStorage.setItem(key, value ? '1' : '0');
    } catch (e) {}
  }

  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }

  function playTone(config) {
    config = config || {};
    if (!stopwatchPrefs.sound || !audioCtx) return;
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
      playTone({ frequency: 420, duration: 0.09, volume: 0.024, delay: 0 });
      playTone({ frequency: 360, duration: 0.09, volume: 0.02, delay: 0.12 });
      return;
    }
    if (kind === 'attention') {
      playTone({ frequency: 540, duration: 0.08, volume: 0.018 });
      return;
    }
    playTone({ frequency: 620, duration: 0.03, volume: 0.012, attack: 0.004, release: 0.04 });
  }

  function vibrate(pattern) {
    if (!stopwatchPrefs.vibration) return;
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
      return { title: 'Нужно делать пробу', subtitle: 'Пора переходить к обязательному действию' };
    }
    if (elapsed >= 300) {
      return { title: 'Сделай справку и I-ое', subtitle: 'Этап уже наступил, лучше не тянуть' };
    }
    if (elapsed >= 180) {
      return { title: 'Можно начать движение', subtitle: 'Следи за следующим этапом и сигналами' };
    }
    if (elapsed >= 60) {
      return { title: 'Можно набираться', subtitle: 'Второй этап уже достигнут' };
    }
    if (elapsed >= 35) {
      return { title: 'Можно отпустить КВТ', subtitle: 'Первый этап выполнен' };
    }
    if (state.isRunning) {
      return { title: 'Таймер запущен', subtitle: 'Следи за этапами и сигналами' };
    }
    return { title: 'Готов к запуску', subtitle: 'Запусти таймер, чтобы получать подсказки по этапам' };
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
      var isNext = state.nextStage && state.nextStage.id === stage.id;
      html += '<div class="timer-stage-item' + (isDone ? ' is-done' : '') + (isNext ? ' is-next' : '') + '">' +
        '<span class="timer-stage-dot" aria-hidden="true"></span>' +
        '<div class="timer-stage-copy">' +
          '<div class="timer-stage-name">' + escapeHtml(stage.label) + '</div>' +
          '<div class="timer-stage-caption">' + escapeHtml(stage.hint) + '</div>' +
        '</div>' +
        '<span class="timer-stage-time">' + stage.time + '</span>' +
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
    timerStageSubtitleEl.textContent = stageStatus.subtitle;
    if (timerDisplayCardEl) {
      timerDisplayCardEl.setAttribute('data-timer-mode', state.mode || 'normal');
    }
    if (timerMainBtnLabel) {
      timerMainBtnLabel.textContent = state.isRunning ? 'Пауза' : (state.elapsedSeconds > 0 ? 'Продолжить' : 'Старт');
    }
    if (timerMainBtnHint) {
      timerMainBtnHint.textContent = state.isRunning ? 'Остановить таймер' : (state.elapsedSeconds > 0 ? 'Продолжить отсчёт' : 'Запустить таймер');
    }
    if (timerStageMetaEl) {
      timerStageMetaEl.textContent = state.nextStage ? ('Следующий этап: ' + state.nextStage.time) : 'Все этапы пройдены';
    }
    renderStageList(state);
    syncToggleButtons();
  }

  function syncToggleButtons() {
    syncToggleButton(timerSoundToggle, stopwatchPrefs.sound);
    syncToggleButton(timerVibrationToggle, stopwatchPrefs.vibration);
  }

  function syncToggleButton(button, isActive) {
    if (!button) return;
    button.classList.toggle('is-active', !!isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }

  function handleStage(stage) {
    if (!stage) return;
    playStageSound(stage.sound);
    if (stage.id === 'spravka') vibrate(18);
    else if (stage.id === 'probe') vibrate([20, 60, 20]);
    else vibrate(10);
  }

  engine.subscribe(function(event) {
    var state = event.state || engine.getState();
    render(state);
    if (event.type === 'stage') {
      handleStage(event.stage);
    }
  });

  if (timerMainBtn) {
    timerMainBtn.addEventListener('click', function() {
      if (typeof triggerHapticTapSoft === 'function') triggerHapticTapSoft();
      engine.toggle();
    });
  }

  if (timerResetBtn) {
    timerResetBtn.addEventListener('click', function() {
      if (typeof triggerHapticWarning === 'function') triggerHapticWarning();
      vibrate([18, 40, 18]);
      engine.reset();
    });
  }

  if (timerMarkBtn) {
    timerMarkBtn.addEventListener('click', function() {
      ensureAudio();
      playStageSound('tiny');
      vibrate(10);
      if (typeof triggerHapticSelection === 'function') triggerHapticSelection();
    });
  }

  if (timerSoundToggle) {
    timerSoundToggle.addEventListener('click', function() {
      stopwatchPrefs.sound = !stopwatchPrefs.sound;
      writeBool(STORAGE_SOUND_KEY, stopwatchPrefs.sound);
      if (typeof triggerHapticSelection === 'function') triggerHapticSelection();
      if (stopwatchPrefs.sound) {
        ensureAudio();
        playStageSound('tiny');
      }
      syncToggleButtons();
    });
  }

  if (timerVibrationToggle) {
    timerVibrationToggle.addEventListener('click', function() {
      stopwatchPrefs.vibration = !stopwatchPrefs.vibration;
      writeBool(STORAGE_VIBRATION_KEY, stopwatchPrefs.vibration);
      if (typeof triggerHapticSelection === 'function') triggerHapticSelection();
      if (stopwatchPrefs.vibration) vibrate(10);
      syncToggleButtons();
    });
  }

  window.renderStopwatchScreen = function() {
    render(engine.getState());
  };
})();
