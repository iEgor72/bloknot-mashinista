(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  function boundedLevenshteinDistance(a, b, maxDistance) {
    var left = String(a || '');
    var right = String(b || '');
    var threshold = Math.max(0, parseInt(maxDistance, 10) || 0);
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    if (Math.abs(left.length - right.length) > threshold) return threshold + 1;

    var prev = [];
    var curr = [];
    for (var j = 0; j <= right.length; j++) prev[j] = j;

    for (var i = 1; i <= left.length; i++) {
      curr[0] = i;
      var rowMin = curr[0];
      for (var k = 1; k <= right.length; k++) {
        var cost = left.charAt(i - 1) === right.charAt(k - 1) ? 0 : 1;
        curr[k] = Math.min(prev[k] + 1, curr[k - 1] + 1, prev[k - 1] + cost);
        if (curr[k] < rowMin) rowMin = curr[k];
      }
      if (rowMin > threshold) return threshold + 1;
      var swap = prev;
      prev = curr;
      curr = swap;
    }

    return prev[right.length];
  }

  function fuzzySimilarity(a, b) {
    var left = String(a || '').trim();
    var right = String(b || '').trim();
    if (!left || !right) return 0;
    if (left === right) return 1;
    var maxLen = Math.max(left.length, right.length);
    var maxDistance = maxLen >= 8 ? 3 : (maxLen >= 5 ? 2 : 1);
    var dist = boundedLevenshteinDistance(left, right, maxDistance);
    if (dist > maxDistance) return 0;
    return Math.max(0, 1 - (dist / maxLen));
  }

  function bestFuzzySimilarity(token, candidates, minScore) {
    var source = String(token || '');
    if (!source) return 0;
    var threshold = minScore === undefined ? 0.5 : Math.max(0, Math.min(1, minScore));
    var best = 0;
    var firstChar = source.charAt(0);
    for (var i = 0; i < (candidates || []).length; i++) {
      var candidate = String(candidates[i] || '');
      if (!candidate) continue;
      if (source.length >= 4 && candidate.charAt(0) !== firstChar) continue;
      var score = fuzzySimilarity(source, candidate);
      if (score > best) best = score;
      if (best >= 0.99) break;
    }
    return best >= threshold ? best : 0;
  }

  core.boundedLevenshteinDistance = boundedLevenshteinDistance;
  core.fuzzySimilarity = fuzzySimilarity;
  core.bestFuzzySimilarity = bestFuzzySimilarity;
})(window);
