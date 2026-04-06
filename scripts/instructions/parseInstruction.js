(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  function mapLegacySectionType(level) {
    var numericLevel = Math.max(1, parseInt(level, 10) || 1);
    if (numericLevel <= 1) return 'chapter';
    if (numericLevel === 2) return 'section';
    if (numericLevel === 3) return 'point';
    return 'subpoint';
  }

  function normalizeLegacySections(sections, instructionId) {
    var list = [];
    for (var i = 0; i < (sections || []).length; i++) {
      var section = sections[i] || {};
      list.push({
        id: section.id || (instructionId + '-section-' + (i + 1)),
        instructionId: instructionId,
        parentId: section.parentId !== undefined ? section.parentId : null,
        type: mapLegacySectionType(section.level),
        order: i + 1,
        number: section.number || '',
        title: section.title || '',
        content: section.content || section.plainText || '',
        plainText: section.plainText || section.content || ''
      });
    }
    return list;
  }

  function parseInstruction(rawInstruction, index) {
    var safe = rawInstruction || {};
    var instructionId = String(safe.id || ('instruction-' + (index + 1)));
    var title = String(safe.title || instructionId.toUpperCase());
    var sortOrder = parseInt(safe.sortOrder, 10);
    if (isNaN(sortOrder) || sortOrder < 0) sortOrder = index;
    var nodesSource = [];

    if (Array.isArray(safe.nodes) && safe.nodes.length) {
      nodesSource = safe.nodes;
    } else if (Array.isArray(safe.sections) && safe.sections.length) {
      nodesSource = normalizeLegacySections(safe.sections, instructionId);
    }

    var nodes = core.parseHierarchy
      ? core.parseHierarchy(nodesSource, {
        instructionId: instructionId,
        instructionTitle: title,
        sourceUrl: safe.sourceUrl || ''
      })
      : [];

    return {
      id: instructionId,
      title: title,
      shortDescription: String(safe.shortDescription || ''),
      sortOrder: Math.max(0, sortOrder),
      version: safe.version ? String(safe.version) : '',
      sourceUrl: safe.sourceUrl ? String(safe.sourceUrl) : '',
      updatedAt: safe.updatedAt ? String(safe.updatedAt) : '',
      nodes: nodes
    };
  }

  function parseCatalogPayload(payload) {
    var source = payload || {};
    var listSource = [];

    if (source && Array.isArray(source.instructions)) listSource = source.instructions;
    else if (Array.isArray(source)) listSource = source;

    var instructions = [];
    for (var i = 0; i < listSource.length; i++) {
      instructions.push(parseInstruction(listSource[i], i));
    }

    return {
      updatedAt: source && source.updatedAt ? String(source.updatedAt) : new Date().toISOString(),
      version: source && source.version ? String(source.version) : '1',
      instructions: instructions
    };
  }

  core.parseInstruction = parseInstruction;
  core.parseCatalogPayload = parseCatalogPayload;
})(window);
