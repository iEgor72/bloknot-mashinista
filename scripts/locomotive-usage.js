(function() {
  'use strict';

  var STORAGE_KEY = 'shift_tracker_locomotive_usage_v1';
  var MAX_COUNT = 100000;

  function readUsage() {
    try {
      var value = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      var parsed = value ? JSON.parse(value) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
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
    key = String(key || '').trim();
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
