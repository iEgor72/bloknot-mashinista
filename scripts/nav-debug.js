(function() {
  function getParam(name) {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return params.get(name);
    } catch (e) {
      return null;
    }
  }

  var explicit = getParam('navDebug');
  if (explicit === '1') {
    try { window.localStorage.setItem('navDebug', '1'); } catch (e) {}
  }
  if (explicit === '0') {
    try { window.localStorage.removeItem('navDebug'); } catch (e) {}
  }

  var enabled = explicit === '1';
  if (!enabled) {
    try { enabled = window.localStorage.getItem('navDebug') === '1'; } catch (e) {}
  }
  if (!enabled) return;

  var root = document.documentElement;
  var nav = document.querySelector('.bottom-nav');
  var fill = document.querySelector('.bottom-safe-fill');
  if (!nav) return;

  var panel = document.createElement('pre');
  panel.setAttribute('aria-live', 'polite');
  panel.style.cssText = [
    'position:fixed',
    'top:8px',
    'left:8px',
    'right:8px',
    'z-index:9999',
    'max-height:44vh',
    'overflow:auto',
    'white-space:pre-wrap',
    'font:11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'padding:8px 10px',
    'border-radius:10px',
    'background:rgba(8,10,20,0.85)',
    'border:1px solid rgba(255,255,255,0.18)',
    'color:#dce5ff',
    'box-shadow:0 10px 30px rgba(0,0,0,0.4)',
    'pointer-events:none'
  ].join(';');
  document.body.appendChild(panel);

  var history = [];

  function toNum(value) {
    var n = parseFloat(value);
    return isFinite(n) ? n : 0;
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function takeSnapshot(label) {
    var rootCss = window.getComputedStyle(root);
    var navCss = window.getComputedStyle(nav);
    var fillCss = fill ? window.getComputedStyle(fill) : null;
    var rect = nav.getBoundingClientRect();
    var vv = window.visualViewport;
    var snap = {
      at: new Date().toISOString().slice(11, 23),
      label: label,
      navReady: root.classList.contains('nav-ready'),
      safeBottom: round(toNum(rootCss.getPropertyValue('--safe-bottom'))),
      navSafeBottom: round(toNum(rootCss.getPropertyValue('--bottom-nav-safe-bottom'))),
      navOffsetVar: rootCss.getPropertyValue('--bottom-nav-offset').trim(),
      navBottom: round(toNum(navCss.bottom)),
      navOpacity: navCss.opacity,
      fillHeight: fillCss ? round(toNum(fillCss.height)) : 0,
      innerH: window.innerHeight || 0,
      vvH: vv && vv.height ? round(vv.height) : 0,
      vvTop: vv && vv.offsetTop ? round(vv.offsetTop) : 0,
      navTop: round(rect.top),
      navBottomPx: round(rect.bottom),
      navGap: round((window.innerHeight || 0) - rect.bottom)
    };
    history.push(snap);
    if (history.length > 12) history.shift();
    return snap;
  }

  function renderPanel() {
    var lines = ['NAV DEBUG (navDebug=1, navDebug=0 to disable)'];
    for (var i = history.length - 1; i >= 0; i--) {
      var h = history[i];
      lines.push(
        h.at + ' [' + h.label + '] ' +
        'safe=' + h.safeBottom + ' navSafe=' + h.navSafeBottom +
        ' bottom=' + h.navBottom + ' gap=' + h.navGap +
        ' fill=' + h.fillHeight + ' navReady=' + h.navReady +
        ' vv=' + h.vvH + '/' + h.vvTop
      );
    }
    panel.textContent = lines.join('\n');
  }

  function sample(label) {
    takeSnapshot(label);
    renderPanel();
  }

  var scheduleToken = 0;
  function scheduleSample(label) {
    if (scheduleToken) window.cancelAnimationFrame(scheduleToken);
    scheduleToken = window.requestAnimationFrame(function() {
      scheduleToken = 0;
      sample(label);
    });
  }

  window.__navDebugSample = sample;
  window.__navDebugHistory = history;

  sample('init');
  setTimeout(function() { sample('t+80'); }, 80);
  setTimeout(function() { sample('t+220'); }, 220);
  setTimeout(function() { sample('t+520'); }, 520);

  window.addEventListener('load', function() { sample('load'); });
  window.addEventListener('pageshow', function() { sample('pageshow'); });
  window.addEventListener('resize', function() { scheduleSample('resize'); });
  window.addEventListener('orientationchange', function() { scheduleSample('orientation'); });
  document.addEventListener('visibilitychange', function() {
    sample(document.hidden ? 'hidden' : 'visible');
  });
  document.addEventListener('pointerdown', function() { scheduleSample('pointerdown'); }, true);
  document.addEventListener('click', function(event) {
    var tabBtn = event.target && event.target.closest ? event.target.closest('.tab-btn[data-tab]') : null;
    if (tabBtn) {
      scheduleSample('tab:' + (tabBtn.getAttribute('data-tab') || ''));
      setTimeout(function() { sample('tab+120'); }, 120);
    }
  }, true);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() { scheduleSample('vv-resize'); });
    window.visualViewport.addEventListener('scroll', function() { scheduleSample('vv-scroll'); });
  }

  if (window.MutationObserver) {
    new MutationObserver(function() {
      scheduleSample('class-change');
    }).observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
  }
})();
