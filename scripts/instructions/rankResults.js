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

  function overlapRatioWithPrefix(queryLookup, targetLookup, queryKeys, targetValues) {
    var keys = queryKeys || Object.keys(queryLookup || {});
    if (!keys.length) return 0;
    var hits = 0;
    for (var i = 0; i < keys.length; i++) {
      var key = String(keys[i] || '').trim();
      if (!key) continue;
      if (targetLookup[key]) {
        hits += 1;
        continue;
      }
      if (hasPrefixMatch(targetValues || [], key)) {
        hits += 1;
      }
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
    var allTokens = core.tokenize
      ? core.tokenize(normalized, { minLength: 1, keepStopWords: true, maxTokens: 20 })
      : [];
    var meaningfulTokens = core.tokenize
      ? core.tokenize(normalized, { minLength: 2, keepStopWords: false, maxTokens: 20 })
      : [];
    var tokens = meaningfulTokens.length ? meaningfulTokens : allTokens;
    if (tokens.length > 8) tokens = tokens.slice(0, 8);

    var stems = core.buildStems ? core.buildStems(tokens) : [];
    var intentRoots = core.buildIntentRoots ? core.buildIntentRoots(stems.length ? stems : tokens) : [];
    if (!intentRoots.length && core.buildIntentRoots) intentRoots = core.buildIntentRoots(tokens);

    var gramSource = [];
    if (stems.length) gramSource = gramSource.concat(stems);
    if (tokens.length) gramSource = gramSource.concat(tokens);
    if (intentRoots.length) gramSource = gramSource.concat(intentRoots);
    if (core.uniqueArray) gramSource = core.uniqueArray(gramSource);

    var grams = core.buildChargrams
      ? core.buildChargrams(gramSource.length ? gramSource : tokens, 196)
      : [];

    var tokenLookup = toLookup(tokens);
    var stemLookup = toLookup(stems);
    var rootLookup = toLookup(intentRoots);
    var numberTokens = extractQueryNumbers(tokens);

    var wantsDefinition = /(что такое|определен|термин|что значит)/.test(normalized);
    var wantsProcedure = /(что делать|как|порядок|действия|при\s)/.test(normalized);
    var wantsRule = wantsProcedure || /(должен|обязан|запрещ|разреш|можно|нельзя)/.test(normalized);

    return {
      normalized: normalized,
      tokens: tokens,
      stems: stems,
      intentRoots: intentRoots,
      intentPhrase: intentRoots.join(' '),
      chargrams: grams,
      tokenLookup: tokenLookup,
      stemLookup: stemLookup,
      rootLookup: rootLookup,
      numberTokens: numberTokens,
      wantsDefinition: wantsDefinition,
      wantsProcedure: wantsProcedure,
      wantsRule: wantsRule
    };
  }

  function buildIntentText(tokens) {
    if (!core.buildIntentRoot) return '';
    var out = [];
    for (var i = 0; i < (tokens || []).length; i++) {
      var root = core.buildIntentRoot(tokens[i]);
      if (!root) continue;
      out.push(root);
    }
    return out.join(' ');
  }

  function prepareSearchEntities(entities) {
    var out = [];
    for (var i = 0; i < (entities || []).length; i++) {
      var entity = entities[i];
      if (!entity) continue;

      var titleTokens = core.tokenize
        ? core.tokenize(entity.normalizedTitle || entity.title || '', {
          minLength: 1,
          keepStopWords: true,
          maxTokens: 80
        })
        : [];
      var bodyTokens = core.tokenize
        ? core.tokenize(entity.normalizedBody || entity.body || '', {
          minLength: 1,
          keepStopWords: true,
          maxTokens: 220
        })
        : [];

      var titleStems = core.buildStems ? core.buildStems(titleTokens) : [];
      var bodyStems = core.buildStems ? core.buildStems(bodyTokens) : [];

      var titleRoots = core.buildIntentRoots ? core.buildIntentRoots(titleStems.concat(titleTokens)) : [];
      var bodyRoots = core.buildIntentRoots ? core.buildIntentRoots(bodyStems.concat(bodyTokens)) : [];
      var allRoots = core.uniqueArray ? core.uniqueArray(titleRoots.concat(bodyRoots)) : titleRoots.concat(bodyRoots);

      var allStems = core.uniqueArray
        ? core.uniqueArray(titleStems.concat(bodyStems, entity.stems || []))
        : titleStems.concat(bodyStems, entity.stems || []);
      var allTokens = core.uniqueArray
        ? core.uniqueArray(titleTokens.concat(bodyTokens, entity.tokens || []))
        : titleTokens.concat(bodyTokens, entity.tokens || []);

      out.push({
        raw: entity,
        normalizedTitle: entity.normalizedTitle || '',
        normalizedBody: entity.normalizedBody || '',
        titleIntentText: buildIntentText(titleTokens),
        bodyIntentText: buildIntentText(bodyTokens),
        titleTokens: titleTokens,
        bodyTokens: bodyTokens,
        titleStems: titleStems,
        bodyStems: bodyStems,
        titleRoots: titleRoots,
        bodyRoots: bodyRoots,
        allRoots: allRoots,
        allTokens: allTokens,
        allStems: allStems,
        titleTokenLookup: toLookup(titleTokens),
        bodyTokenLookup: toLookup(bodyTokens),
        titleStemLookup: toLookup(titleStems),
        bodyStemLookup: toLookup(bodyStems),
        titleRootLookup: toLookup(titleRoots),
        bodyRootLookup: toLookup(bodyRoots),
        allRootLookup: toLookup(allRoots),
        allTokenLookup: toLookup(allTokens),
        allStemLookup: toLookup(allStems),
        chargramLookup: toLookup(entity.chargrams || [])
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

    var intentPhrase = profile.intentPhrase || '';
    var titleHasIntentPhrase = intentPhrase.length > 2 && prepared.titleIntentText.indexOf(intentPhrase) !== -1;
    var bodyHasIntentPhrase = intentPhrase.length > 2 && prepared.bodyIntentText.indexOf(intentPhrase) !== -1;

    var titleTokenOverlap = overlapRatio(profile.tokenLookup, prepared.titleTokenLookup, profile.tokens);
    var bodyTokenOverlap = overlapRatio(profile.tokenLookup, prepared.bodyTokenLookup, profile.tokens);
    var titleStemOverlap = overlapRatio(profile.stemLookup, prepared.titleStemLookup, profile.stems);
    var bodyStemOverlap = overlapRatio(profile.stemLookup, prepared.bodyStemLookup, profile.stems);
    var titleRootOverlap = overlapRatioWithPrefix(
      profile.rootLookup,
      prepared.titleRootLookup,
      profile.intentRoots,
      prepared.titleRoots
    );
    var bodyRootOverlap = overlapRatioWithPrefix(
      profile.rootLookup,
      prepared.bodyRootLookup,
      profile.intentRoots,
      prepared.bodyRoots
    );

    var tokenOverlap = Math.max(titleTokenOverlap, bodyTokenOverlap);
    var stemOverlap = Math.max(titleStemOverlap, bodyStemOverlap);
    var rootOverlap = Math.max(titleRootOverlap, bodyRootOverlap);

    var titlePrefixHits = 0;
    var bodyPrefixHits = 0;
    var prefixSource = profile.intentRoots && profile.intentRoots.length ? profile.intentRoots : (profile.stems || []);
    for (var i = 0; i < prefixSource.length; i++) {
      var token = prefixSource[i];
      if (!token) continue;

      if (
        hasPrefixMatch(prepared.titleStems, token) ||
        hasPrefixMatch(prepared.titleTokens, token) ||
        hasPrefixMatch(prepared.titleRoots, token)
      ) {
        titlePrefixHits += 1;
      }
      if (
        hasPrefixMatch(prepared.bodyStems, token) ||
        hasPrefixMatch(prepared.bodyTokens, token) ||
        hasPrefixMatch(prepared.bodyRoots, token)
      ) {
        bodyPrefixHits += 1;
      }
    }

    var fuzzyScore = calcFuzzyScore(prepared, profile);
    var chargramScore = core.chargramOverlap ? core.chargramOverlap(profile.chargrams || [], prepared.chargramLookup || {}) : 0;
    var proximityScore = calcProximityScore(prepared, profile);
    var numberMatch = hasNumberMatch(prepared, profile);
    var singleIntentQuery = (profile.intentRoots || []).length <= 1;
    var allowRawPhraseBoost = !singleIntentQuery && (profile.tokens || []).length >= 2;
    var allowIntentPhraseBoost = (profile.intentRoots || []).length >= 1;

    var score = 0;
    if (allowRawPhraseBoost && titleHasExactPhrase) score += 180;
    if (allowRawPhraseBoost && bodyHasExactPhrase) score += 110;
    if (allowIntentPhraseBoost && titleHasIntentPhrase) score += (singleIntentQuery ? 140 : 260);
    if (allowIntentPhraseBoost && bodyHasIntentPhrase) score += (singleIntentQuery ? 90 : 150);

    score += Math.round(titleTokenOverlap * (singleIntentQuery ? 0 : 220));
    score += Math.round(stemOverlap * (singleIntentQuery ? 0 : 230));
    score += Math.round(rootOverlap * (singleIntentQuery ? 520 : 330));
    score += Math.round(bodyTokenOverlap * (singleIntentQuery ? 0 : 140));
    score += titlePrefixHits * (singleIntentQuery ? 72 : 64);
    score += bodyPrefixHits * (singleIntentQuery ? 50 : 42);
    score += Math.round(fuzzyScore * (singleIntentQuery ? 0 : 130));
    score += Math.round(chargramScore * (singleIntentQuery ? 0 : 120));
    score += Math.round(proximityScore * (singleIntentQuery ? 40 : 150));
    if (numberMatch) score += 170;

    if (profile.wantsDefinition && prepared.raw.type === 'definition') score += 180;
    if (profile.wantsProcedure && prepared.raw.type === 'procedure') score += 120;
    if (profile.wantsRule && (prepared.raw.type === 'rule' || prepared.raw.type === 'procedure')) score += 100;

    if (prepared.raw.nodeType === 'point') score += 35;
    if (prepared.raw.depth !== undefined) score += Math.max(0, 24 - Math.min(24, prepared.raw.depth * 3));

    if (
      !(allowRawPhraseBoost && titleHasExactPhrase) &&
      !(allowIntentPhraseBoost && titleHasIntentPhrase) &&
      tokenOverlap < (singleIntentQuery ? 0.06 : 0.16) &&
      rootOverlap < (singleIntentQuery ? 0.16 : 0.2) &&
      chargramScore < (singleIntentQuery ? 0.0 : 0.26) &&
      fuzzyScore < (singleIntentQuery ? 0.0 : 0.46)
    ) {
      return null;
    }

    var confidence = Math.max(0, Math.min(1,
      (allowRawPhraseBoost && titleHasExactPhrase ? 0.14 : 0) +
      (allowIntentPhraseBoost && titleHasIntentPhrase ? (singleIntentQuery ? 0.14 : 0.22) : 0) +
      Math.min(singleIntentQuery ? 0 : 0.22, tokenOverlap * (singleIntentQuery ? 0 : 0.22)) +
      Math.min(singleIntentQuery ? 0 : 0.2, stemOverlap * (singleIntentQuery ? 0 : 0.2)) +
      Math.min(singleIntentQuery ? 0.32 : 0.24, rootOverlap * (singleIntentQuery ? 0.32 : 0.24)) +
      Math.min(0.08, fuzzyScore * 0.08) +
      Math.min(0.08, chargramScore * 0.08) +
      (numberMatch ? 0.08 : 0) +
      ((allowRawPhraseBoost && bodyHasExactPhrase) || (allowIntentPhraseBoost && bodyHasIntentPhrase) ? 0.06 : 0)
    ));

    return {
      score: score,
      confidence: confidence,
      features: {
        titleHasExactPhrase: titleHasExactPhrase,
        bodyHasExactPhrase: bodyHasExactPhrase,
        titleHasIntentPhrase: titleHasIntentPhrase,
        bodyHasIntentPhrase: bodyHasIntentPhrase,
        tokenOverlap: tokenOverlap,
        stemOverlap: stemOverlap,
        rootOverlap: rootOverlap,
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
      if ((a.entity.raw.depth || 0) !== (b.entity.raw.depth || 0)) {
        return (a.entity.raw.depth || 0) - (b.entity.raw.depth || 0);
      }
      if ((a.entity.raw.instructionTitle || '') !== (b.entity.raw.instructionTitle || '')) {
        return String(a.entity.raw.instructionTitle || '').localeCompare(String(b.entity.raw.instructionTitle || ''), 'ru');
      }
      if ((a.entity.raw.title || '') !== (b.entity.raw.title || '')) {
        return String(a.entity.raw.title || '').localeCompare(String(b.entity.raw.title || ''), 'ru');
      }
      return String(a.entity.raw.id || '').localeCompare(String(b.entity.raw.id || ''), 'ru');
    });

    return ranked.slice(0, max);
  }

  core.buildSearchQueryProfile = buildSearchQueryProfile;
  core.prepareSearchEntities = prepareSearchEntities;
  core.rankResults = rankResults;
})(window);
