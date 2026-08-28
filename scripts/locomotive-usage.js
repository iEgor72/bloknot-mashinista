(function() {
  'use strict';

  var STORAGE_KEY = 'shift_tracker_locomotive_usage_v1';
  var MAX_COUNT = 100000;

  function canonicalKey(key) {
    key = String(key || '').trim();
    return key === '2ТЭ25КМ' ? '2ТЭ25' : key;
  }

  function readUsage() {
    try {
      var value = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      var parsed = value ? JSON.parse(value) : {};
      if (!parsed || typeof parsed !== 'object') return {};
      var locomotive = parsed.locomotive;
      if (locomotive && locomotive['2ТЭ25КМ']) {
        var legacy = locomotive['2ТЭ25КМ'];
        var current = locomotive['2ТЭ25'] || {};
        locomotive['2ТЭ25'] = {
          count: Math.min(MAX_COUNT, (Number(current.count) || 0) + (Number(legacy.count) || 0)),
          lastUsed: Math.max(Number(current.lastUsed) || 0, Number(legacy.lastUsed) || 0)
        };
        delete locomotive['2ТЭ25КМ'];
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch (migrationError) {}
      }
      return parsed;
    } catch (error) {
      return {};
    }
  }

  function writeUsage(usage) {
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    } catch (error) {}
  }

  function record(scope, key) {
    scope = String(scope || '').trim();
    key = canonicalKey(key);
    if (!scope || !key) return;
    var usage = readUsage();
    var scoped = usage[scope] && typeof usage[scope] === 'object' ? usage[scope] : {};
    var previous = scoped[key] && typeof scoped[key] === 'object' ? scoped[key] : {};
    scoped[key] = {
      count: Math.min(MAX_COUNT, Math.max(0, Number(previous.count) || 0) + 1),
      lastUsed: Date.now ? Date.now() : new Date().getTime()
    };
    usage[scope] = scoped;
    writeUsage(usage);
  }

  function top(scope, candidates, limit) {
    var usage = readUsage();
    var scoped = usage[String(scope || '')] || {};
    var seen = {};
    return (Array.isArray(candidates) ? candidates : [])
      .filter(function(candidate) {
        if (!candidate || !candidate.value || !candidate.key || candidate.exclude) return false;
        candidate.key = canonicalKey(candidate.key);
        if (seen[candidate.value]) return false;
        seen[candidate.value] = true;
        return scoped[candidate.key] && Number(scoped[candidate.key].count) > 0;
      })
      .sort(function(a, b) {
        var aUsage = scoped[a.key] || {};
        var bUsage = scoped[b.key] || {};
        return (Number(bUsage.count) || 0) - (Number(aUsage.count) || 0)
          || (Number(bUsage.lastUsed) || 0) - (Number(aUsage.lastUsed) || 0);
      })
      .slice(0, Math.max(1, Number(limit) || 4))
      .map(function(candidate) { return candidate.value; });
  }

  window.LocomotiveUsage = { record: record, top: top };
})();
