// Reusable "glass-select" dropdown — the styled list used for loco series,
// generalised so any hidden <select> can get the same look.
//
// Markup contract (root carries data-glass-auto to be enhanced on load):
//   <div class="glass-select" data-glass-auto data-placeholder="…">
//     <button class="glass-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
//       <span class="glass-select-value is-placeholder">…</span>
//       <span class="glass-select-chevron">…chevron…</span>
//     </button>
//     <div class="glass-select-menu hidden" role="listbox"></div>
//     <select class="hidden" tabindex="-1" aria-hidden="true">…options…</select>
//   </div>
//
// The hidden <select> stays the source of truth (value + change events); the
// menu is rebuilt from it. Call GlassSelect.refresh(root) after repopulating
// the <select> options dynamically.
(function () {
  var OPEN = null;

  function q(root, sel) { return root ? root.querySelector(sel) : null; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function placeholderFor(root) {
    return root.getAttribute('data-placeholder') || '—';
  }

  // Initials + a deterministic colour from a name, for mini avatars.
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  function hueOf(s) {
    var h = 0; s = String(s || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function avatarHtml(name) {
    var ini = initials(name);
    if (!ini) return '<span class="glass-select-avatar is-empty" aria-hidden="true"></span>';
    var h = hueOf(name);
    return '<span class="glass-select-avatar" aria-hidden="true" style="background:hsl(' + h +
      ' 42% 30%);color:hsl(' + h + ' 65% 85%)">' + esc(ini) + '</span>';
  }

  function emitOption(opt, withAvatars) {
    if (!opt) return '';
    // Skip the hidden placeholder option (value="" + disabled/hidden).
    if (!opt.value && (opt.disabled || opt.hidden)) return '';
    var label = opt.textContent;
    var avatar = withAvatars ? avatarHtml(opt.value ? label : '') : '';
    return '<button type="button" class="glass-select-option' + (withAvatars ? ' has-avatar' : '') +
      '" role="option" aria-selected="false" data-value="' + esc(opt.value) + '">' +
      avatar + '<span class="glass-select-option-label">' + esc(label) + '</span></button>';
  }

  function buildMenu(root) {
    var sel = q(root, 'select');
    var menu = q(root, '.glass-select-menu');
    if (!sel || !menu) return;
    var withAvatars = root.hasAttribute('data-option-avatars');
    var html = '';
    var kids = sel.children;
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      var tag = (node.tagName || '').toUpperCase();
      if (tag === 'OPTGROUP') {
        html += '<div class="glass-select-group" role="presentation">' + esc(node.label || '') + '</div>';
        for (var j = 0; j < node.children.length; j++) html += emitOption(node.children[j], withAvatars);
      } else if (tag === 'OPTION') {
        html += emitOption(node, withAvatars);
      }
    }
    menu.innerHTML = html;
    sync(root);
  }

  function sync(root) {
    var sel = q(root, 'select');
    var valueEl = q(root, '.glass-select-value');
    var trigger = q(root, '.glass-select-trigger');
    var menu = q(root, '.glass-select-menu');
    if (!sel) return;
    var selected = sel.options[sel.selectedIndex];
    var hasValue = !!sel.value;
    if (valueEl) {
      valueEl.textContent = (hasValue && selected) ? selected.textContent : placeholderFor(root);
      valueEl.classList.toggle('is-placeholder', !hasValue);
    }
    if (trigger) trigger.classList.toggle('is-placeholder', !hasValue);
    if (menu) {
      var btns = menu.querySelectorAll('.glass-select-option');
      for (var i = 0; i < btns.length; i++) {
        var active = btns[i].getAttribute('data-value') === sel.value;
        btns[i].classList.toggle('is-active', active);
        btns[i].setAttribute('aria-selected', active ? 'true' : 'false');
      }
    }
  }

  function open(root) {
    close();
    OPEN = root;
    var menu = q(root, '.glass-select-menu');
    var trigger = q(root, '.glass-select-trigger');
    if (menu) menu.classList.remove('hidden');
    if (trigger) { trigger.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); }
    root.classList.add('is-open');
    // Let an enclosing sheet/card grow so the absolute menu is not clipped.
    var holder = root.closest && root.closest('.bottom-sheet, .settings-card, .shift-share-row');
    if (holder) holder.classList.add('has-open-glass-select');
  }

  function close() {
    if (!OPEN) return;
    var root = OPEN;
    OPEN = null;
    var menu = q(root, '.glass-select-menu');
    var trigger = q(root, '.glass-select-trigger');
    if (menu) menu.classList.add('hidden');
    if (trigger) { trigger.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); }
    root.classList.remove('is-open');
    var holders = document.querySelectorAll('.has-open-glass-select');
    for (var i = 0; i < holders.length; i++) holders[i].classList.remove('has-open-glass-select');
  }

  function setValue(root, value) {
    var sel = q(root, 'select');
    if (!sel) return;
    sel.value = String(value == null ? '' : value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    sync(root);
    close();
  }

  function enhance(root) {
    if (!root || root.__glassEnhanced) return;
    var trigger = q(root, '.glass-select-trigger');
    var menu = q(root, '.glass-select-menu');
    var sel = q(root, 'select');
    if (!trigger || !menu || !sel) return;
    root.__glassEnhanced = true;
    buildMenu(root);
    var toggleAt = 0;
    trigger.addEventListener('pointerup', function (e) {
      e.preventDefault();
      toggleAt = Date.now ? Date.now() : new Date().getTime();
      if (OPEN === root) close(); else open(root);
    });
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      var now = Date.now ? Date.now() : new Date().getTime();
      if (now - toggleAt < 500) return; // pointerup already handled it
      if (OPEN === root) close(); else open(root);
    });
    menu.addEventListener('click', function (e) {
      var opt = e.target.closest && e.target.closest('.glass-select-option');
      if (!opt) return;
      setValue(root, opt.getAttribute('data-value'));
    });
    sel.addEventListener('change', function () { sync(root); });
  }

  function enhanceAll() {
    var roots = document.querySelectorAll('.glass-select[data-glass-auto]');
    for (var i = 0; i < roots.length; i++) enhance(roots[i]);
  }

  // Global dismissers (only act on the currently open instance).
  document.addEventListener('pointerdown', function (e) {
    if (OPEN && !OPEN.contains(e.target)) close();
  });
  document.addEventListener('click', function (e) {
    if (OPEN && !OPEN.contains(e.target)) close();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', function () { close(); });
  document.addEventListener('scroll', function () { close(); }, true);

  window.GlassSelect = { enhance: enhance, enhanceAll: enhanceAll, refresh: buildMenu, sync: sync, close: close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceAll);
  } else {
    enhanceAll();
  }
})();
