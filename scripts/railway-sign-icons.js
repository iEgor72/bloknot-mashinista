if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('railway-sign-icons', 'v413');

(function initRailwaySignIcons(global) {
  'use strict';

  var LIGHT = '#eef2f8';
  var INK = '#071019';
  var SURFACE = '#101923';
  var SURFACE_RAISED = '#182536';
  var BLUE = '#38bdf8';
  var CYAN = '#22d3ee';
  var VIOLET = '#a78bfa';
  var RED = '#fb7185';
  var GREEN = '#34d399';
  var YELLOW = '#fbbf24';
  var MUTED = '#94a3b8';
  var listeners = [];
  var imageCache = Object.create(null);

  function text(value, x, y, size, color, weight) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="middle" fill="' +
      (color || INK) + '" font-family="Arial, sans-serif" font-size="' + size + '" font-weight="' + (weight || 800) + '">' + value + '</text>';
  }

  function station() {
    return '<rect x="5" y="7" width="38" height="34" rx="10" fill="' + SURFACE + '" stroke="' + BLUE + '" stroke-width="2"/>' +
      '<path d="M11 34h26M14 30l6 4 5-4 5 4 4-4" fill="none" stroke="' + MUTED + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="11" y="12" width="26" height="13" rx="4" fill="' + BLUE + '"/>' + text('СТ', 24, 18.8, 8.5, INK, 900);
  }

  function signal(kind) {
    var plate = kind === 'signal_input' ? 'ВХ' : kind === 'signal_output' ? 'ВЫХ' : 'ПР';
    if (kind === 'signal_output') {
      return '<path d="M12 40h24M18 12v28M30 12v28" stroke="' + MUTED + '" stroke-width="2.2" stroke-linecap="round"/>' +
        '<rect x="12" y="3" width="12" height="25" rx="6" fill="' + SURFACE + '" stroke="' + BLUE + '" stroke-width="1.5"/>' +
        '<rect x="24" y="3" width="12" height="25" rx="6" fill="' + SURFACE + '" stroke="' + BLUE + '" stroke-width="1.5"/>' +
        '<circle cx="18" cy="10" r="3" fill="' + GREEN + '"/><circle cx="18" cy="18" r="3" fill="' + RED + '"/>' +
        '<circle cx="30" cy="10" r="3" fill="' + YELLOW + '"/><circle cx="30" cy="18" r="3" fill="' + RED + '"/>' + text('ВЫХ', 24, 33.5, 5.2, LIGHT, 900);
    }
    var top = kind === 'signal_input' ? GREEN : YELLOW;
    return '<path d="M14 41h20M24 7v34" stroke="' + MUTED + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect x="17" y="3" width="14" height="25" rx="7" fill="' + SURFACE + '" stroke="' + BLUE + '" stroke-width="1.5"/>' +
      '<circle cx="24" cy="9" r="3.3" fill="' + top + '"/><circle cx="24" cy="17" r="3.3" fill="' + RED + '"/>' +
      '<rect x="14" y="29" width="20" height="9" rx="4.5" fill="' + SURFACE_RAISED + '" stroke="' + BLUE + '" stroke-width="1"/>' + text(plate, 24, 33.7, 5.5, LIGHT, 900);
  }

  function signC() {
    return '<circle cx="24" cy="23" r="17" fill="' + SURFACE + '" stroke="' + CYAN + '" stroke-width="2.5"/>' +
      text('С', 24, 23.5, 15, LIGHT, 900) + '<path d="M24 40v4" stroke="' + MUTED + '" stroke-width="2" stroke-linecap="round"/>';
  }

  function whistle() {
    return '<circle cx="24" cy="24" r="19" fill="' + SURFACE + '" stroke="' + YELLOW + '" stroke-width="2"/>' +
      '<path d="M14 21h9l10-7v20l-10-7h-9zM11 18v12" fill="none" stroke="' + YELLOW + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M35 19c3 2 3 8 0 10" fill="none" stroke="' + LIGHT + '" stroke-width="1.8" stroke-linecap="round"/>';
  }

  function appPlate(label, wide, accent) {
    var x = wide ? 3 : 9;
    var width = wide ? 42 : 30;
    var fontSize = wide ? 7.5 : 13;
    return '<path d="M24 38v6" stroke="' + MUTED + '" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="' + x + '" y="9" width="' + width + '" height="29" rx="9" fill="' + SURFACE + '" stroke="' + accent + '" stroke-width="2.5"/>' +
      '<path d="M' + (x + 6) + ' 33h' + (width - 12) + '" stroke="' + accent + '" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>' +
      text(label, 24, 22.5, fontSize, LIGHT, 900);
  }

  function neutral() {
    return '<path d="M24 4 43 23 24 42 5 23Z" fill="' + SURFACE + '" stroke="' + VIOLET + '" stroke-width="2.5"/>' +
      '<path d="M17 14l14 18M31 14 17 32" stroke="' + VIOLET + '" stroke-width="2"/>' + text('ОМ', 24, 23, 7, LIGHT, 900);
  }

  function throttle() {
    return '<rect x="6" y="6" width="36" height="36" rx="12" fill="' + SURFACE + '" stroke="' + YELLOW + '" stroke-width="2"/>' +
      '<path d="M11 36h26M15 36V25l9-10 9 10v11" fill="none" stroke="' + LIGHT + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<circle cx="24" cy="14" r="5" fill="' + YELLOW + '" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<path d="M24 25v10M19 30h10" stroke="' + YELLOW + '" stroke-width="2.2" stroke-linecap="round"/>';
  }

  function connection() {
    return '<rect x="5" y="8" width="38" height="32" rx="12" fill="' + SURFACE + '" stroke="' + BLUE + '" stroke-width="2"/>' +
      '<circle cx="13" cy="24" r="5" fill="' + SURFACE_RAISED + '" stroke="' + BLUE + '" stroke-width="2.5"/>' +
      '<circle cx="35" cy="24" r="5" fill="' + SURFACE_RAISED + '" stroke="' + BLUE + '" stroke-width="2.5"/>' +
      '<path d="M18 24h12M24 17v14" stroke="' + LIGHT + '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="24" cy="17" r="2.5" fill="' + YELLOW + '"/>';
  }

  function brakeNote() {
    return '<circle cx="24" cy="22" r="16" fill="' + SURFACE + '" stroke="' + RED + '" stroke-width="2.5"/>' +
      '<path d="M17 14v16M31 14v16M17 22h14" stroke="' + RED + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M12 41h24" stroke="' + MUTED + '" stroke-width="2" stroke-linecap="round"/>';
  }

  function positionNote() {
    return '<rect x="6" y="7" width="36" height="34" rx="10" fill="' + SURFACE + '" stroke="' + YELLOW + '" stroke-width="2"/>' +
      '<path d="M13 33V23h6v10M24 33V17h6v16M35 33V12" fill="none" stroke="' + YELLOW + '" stroke-width="2" stroke-linecap="round"/>';
  }

  function note() {
    return '<path d="M6 7h36v28H23l-9 8v-8H6z" fill="' + SURFACE + '" stroke="' + BLUE + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M14 16h20M14 22h15M14 28h11" stroke="' + LIGHT + '" stroke-width="2" stroke-linecap="round"/>';
  }

  function shape(kind) {
    if (kind === 'station') return station();
    if (kind === 'signal_input' || kind === 'signal_output' || kind === 'signal_passage') return signal(kind);
    if (kind === 'sign_c') return signC();
    if (kind === 'whistle') return whistle();
    if (kind === 'ktsm') return appPlate('КТСМ', true, VIOLET);
    if (kind === 'brake_start') return appPlate('НТ', false, RED);
    if (kind === 'brake_end') return appPlate('КТ', false, GREEN);
    if (kind === 'neutral') return neutral();
    if (kind === 'throttle') return throttle();
    if (kind === 'connection') return connection();
    if (kind === 'brake_note') return brakeNote();
    if (kind === 'position_note') return positionNote();
    return note();
  }

  function svgMarkup(kind, className) {
    var safeClass = String(className || '').replace(/[^a-zA-Z0-9 _-]/g, '');
    return '<svg' + (safeClass ? ' class="' + safeClass + '"' : '') + ' viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + shape(kind) + '</svg>';
  }

  function createIcon(kind, className) {
    var template = document.createElement('template');
    template.innerHTML = svgMarkup(kind, className).trim();
    return template.content.firstElementChild;
  }

  function notifyReady() {
    listeners.slice().forEach(function(listener) {
      try { listener(); } catch (error) {}
    });
  }

  function getImage(kind) {
    var key = String(kind || 'note');
    if (imageCache[key]) return imageCache[key];
    var image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', notifyReady, { once: true });
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup(key, ''));
    imageCache[key] = image;
    return image;
  }

  function drawCanvas(ctx, kind, centerX, centerY, size, options) {
    if (!ctx) return false;
    var image = getImage(kind);
    if (!image.complete || !image.naturalWidth) return false;
    var iconSize = Math.max(18, Number(size) || 32);
    var settings = options || {};
    ctx.save();
    ctx.globalAlpha = Number.isFinite(Number(settings.alpha)) ? Number(settings.alpha) : 1;
    if (settings.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,.7)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
    }
    ctx.drawImage(image, Number(centerX) - iconSize / 2, Number(centerY) - iconSize / 2, iconSize, iconSize);
    ctx.restore();
    return true;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function() {};
    listeners.push(listener);
    return function() {
      var index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  global.RailwaySignIcons = Object.freeze({
    createIcon: createIcon,
    drawCanvas: drawCanvas,
    getSvgMarkup: svgMarkup,
    subscribe: subscribe,
  });
})(window);
