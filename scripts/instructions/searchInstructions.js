(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  var preparedEntitiesCache = null;
  var preparedEntitiesKey = '';

  function getPreparedEntitiesKey(entities) {
    if (!entities || !entities.length) return 'empty';
    var first = entities[0];
    var last = entities[entities.length - 1];
    return [
      entities.length,
      first ? String(first.id || '') : '',
      last ? String(last.id || '') : '',
      last ? String(last.instructionId || '') : ''
    ].join('::');
  }

  function ensurePreparedEntities(entities) {
    var key = getPreparedEntitiesKey(entities);
    if (preparedEntitiesCache && preparedEntitiesKey === key) return preparedEntitiesCache;
    preparedEntitiesCache = core.prepareSearchEntities ? core.prepareSearchEntities(entities || []) : [];
    preparedEntitiesKey = key;
    return preparedEntitiesCache;
  }

  function splitLines(text) {
    var source = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(text) : String(text || '').trim();
    if (!source) return [];
    var lines = source.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = String(lines[i] || '').replace(/\s+/g, ' ').trim();
      if (!line) continue;
      out.push(line);
    }
    return out;
  }

  function buildSnippet(text, queryTokens) {
    var lines = splitLines(text);
    if (!lines.length) return '';
    if (lines.length <= 5) return lines.join('\n');

    var start = 0;
    var normalizedTokens = queryTokens || [];
    for (var i = 0; i < lines.length; i++) {
      var normalizedLine = core.normalizeText ? core.normalizeText(lines[i]) : String(lines[i] || '').toLowerCase();
      var found = false;
      for (var t = 0; t < normalizedTokens.length; t++) {
        if (normalizedLine.indexOf(normalizedTokens[t]) !== -1) {
          found = true;
          break;
        }
      }
      if (found) {
        start = Math.max(0, i - 1);
        break;
      }
    }
    return lines.slice(start, Math.min(lines.length, start + 5)).join('\n');
  }

  function formatSectionRef(rawNumber, nodeType) {
    var number = String(rawNumber || '').trim();
    if (!number) return '';
    if (nodeType === 'point' || nodeType === 'subpoint' || nodeType === 'item') {
      return 'п. ' + number.replace(/\.$/, '');
    }
    return number.replace(/\.$/, '');
  }

  function searchInstructions(query, searchEntities, options) {
    var opts = options || {};
    var normalizedQuery = core.normalizeText ? core.normalizeText(query) : String(query || '').toLowerCase().trim();
    if (!normalizedQuery) return [];

    var entities = Array.isArray(searchEntities) ? searchEntities : [];
    if (!entities.length) return [];

    var prepared = ensurePreparedEntities(entities);
    var queryProfile = core.buildSearchQueryProfile ? core.buildSearchQueryProfile(query) : null;
    if (!queryProfile || !queryProfile.normalized) return [];

    var ranked = core.rankResults ? core.rankResults(prepared, queryProfile, opts.limit || 40) : [];
    var results = [];
    for (var i = 0; i < ranked.length; i++) {
      var entity = ranked[i].entity.raw;
      var answerText = core.normalizeInstructionBlock
        ? core.normalizeInstructionBlock(entity.body || '')
        : String(entity.body || '').trim();
      var snippet = buildSnippet(answerText, queryProfile.tokens || []);
      var sectionRef = formatSectionRef(entity.number, entity.nodeType);
      var isAnswer = i === 0;

      results.push({
        instructionId: entity.instructionId,
        instructionTitle: entity.instructionTitle || '',
        sectionId: entity.nodeId,
        sectionTitle: entity.title || '',
        sectionRef: sectionRef,
        sectionType: entity.nodeType || '',
        entityType: entity.type || '',
        path: entity.path || '',
        answerText: answerText,
        snippet: snippet || answerText,
        score: ranked[i].score,
        confidence: ranked[i].confidence,
        isExpandedAnswer: isAnswer,
        answerIncludesHeading: true,
        displayText: isAnswer ? answerText : (snippet || answerText)
      });
    }

    return results;
  }

  core.searchInstructions = searchInstructions;
  core.resetPreparedSearchEntitiesCache = function() {
    preparedEntitiesCache = null;
    preparedEntitiesKey = '';
  };
})(window);
