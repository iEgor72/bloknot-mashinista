(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  function toLookup(values) {
    var out = {};
    for (var i = 0; i < (values || []).length; i++) {
      var key = String(values[i] || '').trim();
      if (!key) continue;
      out[key] = 1;
    }
    return out;
  }

  function hasPrefixMatch(candidates, token) {
    var source = String(token || '');
    if (!source || source.length < 2) return false;
    for (var i = 0; i < (candidates || []).length; i++) {
      var candidate = String(candidates[i] || '');
      if (!candidate) continue;
      if (candidate.indexOf(source) === 0 || source.indexOf(candidate) === 0) return true;
    }
    return false;
  }

  function overlapRatio(queryLookup, targetLookup, queryKeys) {
    var keys = queryKeys || Object.keys(queryLookup || {});
    if (!keys.length) return 0;
    var hits = 0;
    for (var i = 0; i < keys.length; i++) {
      if (targetLookup[keys[i]]) hits += 1;
    }
    return hits / keys.length;
  }

  function extractQueryNumbers(tokens) {
    var out = [];
    for (var i = 0; i < (tokens || []).length; i++) {
      var token = String(tokens[i] || '').trim();
      if (/^\d+(?:\.\d+)*$/.test(token)) out.push(token);
    }
    return core.uniqueArray ? core.uniqueArray(out) : out;
  }

  function buildSearchQueryProfile(query) {
    var normalized = core.normalizeText ? core.normalizeText(query) : String(query || '').toLowerCase();
    var allTokens = core.tokenize ? core.tokenize(normalized, { minLength: 1, keepStopWords: true, maxTokens: 20 }) : [];
    var meaningfulTokens = core.tokenize ? core.tokenize(normalized, { minLength: 2, keepStopWords: false, maxTokens: 20 }) : [];
    var tokens = meaningfulTokens.length ? meaningfulTokens : allTokens;
    if (tokens.length > 8) tokens = tokens.slice(0, 8);
    var stems = core.buildStems ? core.buildStems(tokens) : [];
    var grams = core.buildChargrams ? core.buildChargrams(stems.length ? stems : tokens, 196) : [];
    var tokenLookup = toLookup(tokens);
    var stemLookup = toLookup(stems);
    var numberTokens = extractQueryNumbers(tokens);
    var wantsDefinition = /(что такое|определен|термин|что значит)/.test(normalized);
    var wantsProcedure = /(что делать|как|порядок|действия|при\s)/.test(normalized);
    var wantsRule = wantsProcedure || /(должен|обязан|запрещ|разреш|можно|нельзя)/.test(normalized);

    return {
      normalized: normalized,
      tokens: tokens,
      stems: stems,
      chargrams: grams,
      tokenLookup: tokenLookup,
      stemLookup: stemLookup,
      numberTokens: numberTokens,
      wantsDefinition: wantsDefinition,
      wantsProcedure: wantsProcedure,
      wantsRule: wantsRule
    };
  }

  function prepareSearchEntities(entities) {
    var out = [];
    for (var i = 0; i < (entities || []).length; i++) {
      var entity = entities[i];
      if (!entity) continue;
      var titleTokens = core.tokenize ? core.tokenize(entity.normalizedTitle || entity.title || '', {
        minLength: 1,
        keepStopWords: true,
        maxTokens: 80
      }) : [];
      var bodyTokens = core.tokenize ? core.tokenize(entity.normalizedBody || entity.body || '', {
        minLength: 1,
        keepStopWords: true,
        maxTokens: 220
      }) : [];
      var titleStems = core.buildStems ? core.buildStems(titleTokens) : [];
      var bodyStems = core.buildStems ? core.buildStems(bodyTokens) : [];
      var allStems = core.uniqueArray ? core.uniqueArray(titleStems.concat(bodyStems, entity.stems || [])) : titleStems.concat(bodyStems);
      var allTokens = core.uniqueArray ? core.uniqueArray(titleTokens.concat(bodyTokens, entity.tokens || [])) : titleTokens.concat(bodyTokens);
      var gramLookup = toLookup(entity.chargrams || []);

      out.push({
        raw: entity,
        normalizedTitle: entity.normalizedTitle || '',
        normalizedBody: entity.normalizedBody || '',
        titleTokens: titleTokens,
        bodyTokens: bodyTokens,
        titleStems: titleStems,
        bodyStems: bodyStems,
        allTokens: allTokens,
        allStems: allStems,
        titleTokenLookup: toLookup(titleTokens),
        bodyTokenLookup: toLookup(bodyTokens),
        titleStemLookup: toLookup(titleStems),
        bodyStemLookup: toLookup(bodyStems),
        allTokenLookup: toLookup(allTokens),
        allStemLookup: toLookup(allStems),
        chargramLookup: gramLookup
      });
    }
    return out;
  }

  function calcProximityScore(prepared, queryProfile) {
    var stems = queryProfile.stems || [];
    if (stems.length < 2) return 0;
    var body = prepared.normalizedBody || '';
    if (!body) return 0;

    var positions = [];
    for (var i = 0; i < stems.length; i++) {
      var pos = body.indexOf(stems[i]);
      if (pos >= 0) positions.push(pos);
    }
    if (positions.length < 2) return 0;
    positions.sort(function(a, b) { return a - b; });
    var span = positions[positions.length - 1] - positions[0];
    if (span <= 80) return 1;
    if (span <= 180) return 0.7;
    if (span <= 320) return 0.4;
    return 0.2;
  }

  function calcFuzzyScore(prepared, queryProfile) {
    var stems = queryProfile.stems || [];
    if (!stems.length || !core.bestFuzzySimilarity) return 0;
    var candidates = prepared.allStems || [];
    if (!candidates.length) return 0;
    var sum = 0;
    var matched = 0;
    for (var i = 0; i < stems.length; i++) {
      var score = core.bestFuzzySimilarity(stems[i], candidates, 0.55);
      if (score <= 0) continue;
      sum += score;
      matched += 1;
    }
    if (!matched) return 0;
    return sum / stems.length;
  }

  function hasNumberMatch(prepared, queryProfile) {
    if (!queryProfile.numberTokens || !queryProfile.numberTokens.length) return false;
    var number = String(prepared.raw.number || '').replace(/\s+/g, '');
    if (!number) return false;
    for (var i = 0; i < queryProfile.numberTokens.length; i++) {
      var token = String(queryProfile.numberTokens[i] || '').trim();
      if (!token) continue;
      if (number.indexOf(token) !== -1) return true;
    }
    return false;
  }

  function rankPreparedEntity(prepared, queryProfile) {
    var profile = queryProfile;
    if (!profile || !profile.normalized) return null;

    var normalizedQuery = profile.normalized;
    var titleHasExactPhrase = normalizedQuery.length > 1 && prepared.normalizedTitle.indexOf(normalizedQuery) !== -1;
    var bodyHasExactPhrase = normalizedQuery.length > 1 && prepared.normalizedBody.indexOf(normalizedQuery) !== -1;

    var titleTokenOverlap = overlapRatio(profile.tokenLookup, prepared.titleTokenLookup, profile.tokens);
    var bodyTokenOverlap = overlapRatio(profile.tokenLookup, prepared.bodyTokenLookup, profile.tokens);
    var titleStemOverlap = overlapRatio(profile.stemLookup, prepared.titleStemLookup, profile.stems);
    var bodyStemOverlap = overlapRatio(profile.stemLookup, prepared.bodyStemLookup, profile.stems);
    var tokenOverlap = Math.max(titleTokenOverlap, bodyTokenOverlap);
    var stemOverlap = Math.max(titleStemOverlap, bodyStemOverlap);

    var titlePrefixHits = 0;
    var bodyPrefixHits = 0;
    for (var i = 0; i < (profile.stems || []).length; i++) {
      var stem = profile.stems[i];
      if (!stem) continue;
      if (hasPrefixMatch(prepared.titleStems, stem) || hasPrefixMatch(prepared.titleTokens, stem)) titlePrefixHits += 1;
      if (hasPrefixMatch(prepared.bodyStems, stem) || hasPrefixMatch(prepared.bodyTokens, stem)) bodyPrefixHits += 1;
    }

    var fuzzyScore = calcFuzzyScore(prepared, profile);
    var chargramScore = core.chargramOverlap ? core.chargramOverlap(profile.chargrams || [], prepared.chargramLookup || {}) : 0;
    var proximityScore = calcProximityScore(prepared, profile);
    var numberMatch = hasNumberMatch(prepared, profile);

    var score = 0;
    if (titleHasExactPhrase) score += 680;
    if (bodyHasExactPhrase) score += 340;
    score += Math.round(titleTokenOverlap * 300);
    score += Math.round(stemOverlap * 260);
    score += Math.round(bodyTokenOverlap * 170);
    score += titlePrefixHits * 90;
    score += bodyPrefixHits * 55;
    score += Math.round(fuzzyScore * 180);
    score += Math.round(chargramScore * 170);
    score += Math.round(proximityScore * 150);
    if (numberMatch) score += 170;

    if (profile.wantsDefinition && prepared.raw.type === 'definition') score += 180;
    if (profile.wantsProcedure && prepared.raw.type === 'procedure') score += 120;
    if (profile.wantsRule && (prepared.raw.type === 'rule' || prepared.raw.type === 'procedure')) score += 100;

    if (prepared.raw.nodeType === 'point') score += 35;
    if (prepared.raw.depth !== undefined) score += Math.max(0, 24 - Math.min(24, prepared.raw.depth * 3));

    if (!titleHasExactPhrase && tokenOverlap < 0.18 && chargramScore < 0.3 && fuzzyScore < 0.5) {
      return null;
    }

    var confidence = Math.max(0, Math.min(1,
      (titleHasExactPhrase ? 0.33 : 0) +
      Math.min(0.28, tokenOverlap * 0.28) +
      Math.min(0.2, stemOverlap * 0.2) +
      Math.min(0.12, fuzzyScore * 0.12) +
      Math.min(0.12, chargramScore * 0.12) +
      (numberMatch ? 0.08 : 0) +
      (bodyHasExactPhrase ? 0.07 : 0)
    ));

    return {
      score: score,
      confidence: confidence,
      features: {
        titleHasExactPhrase: titleHasExactPhrase,
        bodyHasExactPhrase: bodyHasExactPhrase,
        tokenOverlap: tokenOverlap,
        stemOverlap: stemOverlap,
        fuzzyScore: fuzzyScore,
        chargramScore: chargramScore,
        numberMatch: numberMatch,
        proximityScore: proximityScore
      }
    };
  }

  function rankResults(preparedEntities, queryProfile, limit) {
    var max = Math.max(1, parseInt(limit, 10) || 40);
    var ranked = [];

    for (var i = 0; i < (preparedEntities || []).length; i++) {
      var prepared = preparedEntities[i];
      if (!prepared) continue;
      var scoreInfo = rankPreparedEntity(prepared, queryProfile);
      if (!scoreInfo) continue;
      ranked.push({
        entity: prepared,
        score: scoreInfo.score,
        confidence: scoreInfo.confidence,
        features: scoreInfo.features
      });
    }

    ranked.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if ((a.entity.raw.depth || 0) !== (b.entity.raw.depth || 0)) {
        return (a.entity.raw.depth || 0) - (b.entity.raw.depth || 0);
      }
      if ((a.entity.raw.instructionTitle || '') !== (b.entity.raw.instructionTitle || '')) {
        return String(a.entity.raw.instructionTitle || '').localeCompare(String(b.entity.raw.instructionTitle || ''), 'ru');
      }
      return String(a.entity.raw.title || '').localeCompare(String(b.entity.raw.title || ''), 'ru');
    });

    return ranked.slice(0, max);
  }

  core.buildSearchQueryProfile = buildSearchQueryProfile;
  core.prepareSearchEntities = prepareSearchEntities;
  core.rankResults = rankResults;
})(window);
