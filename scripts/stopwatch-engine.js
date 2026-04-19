(function() {
  function createStopwatchEngine(options) {
    options = options || {};
    var stages = Array.isArray(options.stages) ? options.stages.slice() : [];
    var listeners = [];
    var triggeredMap = Object.create(null);
    var intervalId = null;
    var running = false;
    var elapsedMs = 0;
    var startedAt = 0;
    var lastElapsedSeconds = 0;

    function emit(event) {
      for (var i = 0; i < listeners.length; i++) {
        try {
          listeners[i](event);
        } catch (e) {}
      }
    }

    function getElapsedMs() {
      if (!running) return elapsedMs;
      return Math.max(0, Date.now() - startedAt);
    }

    function getElapsedSeconds() {
      return Math.floor(getElapsedMs() / 1000);
    }

    function getMode(elapsedSeconds) {
      if (elapsedSeconds >= 1800) return 'danger';
      if (elapsedSeconds >= 300) return 'attention';
      return 'normal';
    }

    function getState() {
      var elapsedSeconds = getElapsedSeconds();
      var nextStage = null;
      for (var i = 0; i < stages.length; i++) {
        if (!triggeredMap[stages[i].id]) {
          nextStage = stages[i];
          break;
        }
      }
      return {
        elapsedMs: getElapsedMs(),
        elapsedSeconds: elapsedSeconds,
        isRunning: running,
        mode: getMode(elapsedSeconds),
        stages: stages.slice(),
        triggeredIds: Object.keys(triggeredMap),
        nextStage: nextStage
      };
    }

    function markTriggered(stage) {
      if (!stage || triggeredMap[stage.id]) return;
      triggeredMap[stage.id] = true;
      emit({ type: 'stage', stage: stage, state: getState() });
    }

    function processStages() {
      var elapsedSeconds = getElapsedSeconds();
      for (var i = 0; i < stages.length; i++) {
        if (elapsedSeconds >= stages[i].at) {
          markTriggered(stages[i]);
        }
      }
    }

    function tick() {
      var elapsedSeconds = getElapsedSeconds();
      processStages();
      if (elapsedSeconds !== lastElapsedSeconds) {
        lastElapsedSeconds = elapsedSeconds;
        emit({ type: 'tick', state: getState() });
      }
    }

    function ensureTimer() {
      if (intervalId) return;
      intervalId = window.setInterval(tick, 250);
    }

    function clearTimer() {
      if (!intervalId) return;
      window.clearInterval(intervalId);
      intervalId = null;
    }

    return {
      subscribe: function(listener) {
        if (typeof listener !== 'function') return function() {};
        listeners.push(listener);
        listener({ type: 'init', state: getState() });
        return function() {
          var next = [];
          for (var i = 0; i < listeners.length; i++) {
            if (listeners[i] !== listener) next.push(listeners[i]);
          }
          listeners = next;
        };
      },
      start: function() {
        if (running) return getState();
        startedAt = Date.now() - elapsedMs;
        running = true;
        ensureTimer();
        tick();
        emit({ type: 'start', state: getState() });
        return getState();
      },
      pause: function() {
        if (!running) return getState();
        elapsedMs = getElapsedMs();
        running = false;
        clearTimer();
        emit({ type: 'pause', state: getState() });
        return getState();
      },
      toggle: function() {
        return running ? this.pause() : this.start();
      },
      reset: function() {
        running = false;
        clearTimer();
        elapsedMs = 0;
        startedAt = 0;
        lastElapsedSeconds = 0;
        triggeredMap = Object.create(null);
        emit({ type: 'reset', state: getState() });
        return getState();
      },
      getState: getState
    };
  }

  window.createStopwatchEngine = createStopwatchEngine;
})();
