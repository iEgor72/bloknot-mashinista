(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  function buildTokenChargrams(token) {
    var value = String(token || '').trim();
    if (!value) return [];
    if (value.length <= 2) return [value];

    var grams = [];
    var minGram = value.length >= 5 ? 3 : 2;
    var maxGram = Math.min(4, value.length);
    for (var n = minGram; n <= maxGram; n++) {
      for (var i = 0; i <= value.length - n; i++) {
        grams.push(value.slice(i, i + n));
      }
    }
    return core.uniqueArray ? core.uniqueArray(grams) : grams;
  }

  function buildChargramLookup(tokens, maxSize) {
    var set = {};
    var limit = Math.max(32, parseInt(maxSize, 10) || 420);
    var added = 0;
    for (var i = 0; i < (tokens || []).length; i++) {
      var grams = buildTokenChargrams(tokens[i]);
      for (var g = 0; g < grams.length; g++) {
        var gram = grams[g];
        if (!gram || set[gram]) continue;
        set[gram] = 1;
        added += 1;
        if (added >= limit) return set;
      }
    }
    return set;
  }

  function buildChargrams(tokens, maxSize) {
    return Object.keys(buildChargramLookup(tokens, maxSize));
  }

  function chargramOverlap(queryGrams, targetLookup) {
    if (!queryGrams || !queryGrams.length || !targetLookup) return 0;
    var hits = 0;
    for (var i = 0; i < queryGrams.length; i++) {
      if (targetLookup[queryGrams[i]]) hits += 1;
    }
    if (!hits) return 0;
    return hits / queryGrams.length;
  }

  core.buildTokenChargrams = buildTokenChargrams;
  core.buildChargrams = buildChargrams;
  core.buildChargramLookup = buildChargramLookup;
  core.chargramOverlap = chargramOverlap;
})(window);
