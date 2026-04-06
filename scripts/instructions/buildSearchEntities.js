(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  function formatNodeLabel(node) {
    var title = String((node && node.title) || '').trim();
    var number = String((node && node.number) || '').trim();
    if (!number) return title;
    if (!title) return number;
    if (/^приложение/i.test(number) || /^[ivxlcdm]+$/i.test(number) || /^\d+(\.\d+)*$/.test(number)) {
      return number + '. ' + title;
    }
    return number + ' ' + title;
  }

  function buildInstructionStructure(instruction) {
    var nodes = Array.isArray(instruction && instruction.nodes) ? instruction.nodes : [];
    var nodeById = {};
    var childrenByParent = {};
    var root = null;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      nodeById[node.id] = node;
      if (!root && node.type === 'document' && !node.parentId) root = node;
    }
    if (!root) {
      for (var r = 0; r < nodes.length; r++) {
        if (!nodes[r].parentId) {
          root = nodes[r];
          break;
        }
      }
    }
    if (!root && nodes.length) root = nodes[0];

    for (var c = 0; c < nodes.length; c++) {
      var current = nodes[c];
      if (!current.parentId || !nodeById[current.parentId]) continue;
      if (!childrenByParent[current.parentId]) childrenByParent[current.parentId] = [];
      childrenByParent[current.parentId].push(current);
    }

    var parentKeys = Object.keys(childrenByParent);
    for (var p = 0; p < parentKeys.length; p++) {
      childrenByParent[parentKeys[p]].sort(function(a, b) {
        var aOrder = parseInt(a.order, 10) || 0;
        var bOrder = parseInt(b.order, 10) || 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        if ((a.number || '') !== (b.number || '')) {
          return String(a.number || '').localeCompare(String(b.number || ''), 'ru');
        }
        return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
      });
    }

    return {
      root: root,
      nodeById: nodeById,
      childrenByParent: childrenByParent
    };
  }

  function getParentNode(structure, node) {
    if (!structure || !node || !node.parentId) return null;
    return structure.nodeById[node.parentId] || null;
  }

  function buildNodePath(instruction, node, structure) {
    if (!node || !structure) return '';
    var rootId = structure.root ? structure.root.id : '';
    var path = [];
    var current = node;
    var guard = 0;
    while (current && guard < 28) {
      if (current.id === rootId) break;
      path.push(formatNodeLabel(current));
      current = getParentNode(structure, current);
      guard += 1;
    }
    path.reverse();
    return path.join(' > ');
  }

  function normalizeBody(node) {
    return core.normalizeInstructionBlock
      ? core.normalizeInstructionBlock(node && (node.content || node.plainText || ''))
      : String(node && (node.content || node.plainText || '') || '').trim();
  }

  function appendPointBodyLines(node, structure, out, isRoot) {
    if (!node) return;
    var heading = formatNodeLabel(node);
    var body = normalizeBody(node);

    if (isRoot) {
      if (heading && body) {
        var headingNorm = core.normalizeText ? core.normalizeText(heading) : heading.toLowerCase();
        var bodyNorm = core.normalizeText ? core.normalizeText(body) : body.toLowerCase();
        if (bodyNorm.indexOf(headingNorm) === 0) out.push(body);
        else out.push(heading + '\n' + body);
      } else if (heading) {
        out.push(heading);
      } else if (body) {
        out.push(body);
      }
    } else {
      var line = '';
      if (node.number) line += String(node.number).trim() + ' ';
      line += body || node.title || '';
      line = line.replace(/\s+\n/g, '\n').trim();
      if (line) out.push(line);
    }

    var children = (structure.childrenByParent && structure.childrenByParent[node.id]) || [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!child) continue;
      if (child.type !== 'subpoint' && child.type !== 'item') continue;
      appendPointBodyLines(child, structure, out, false);
    }
  }

  function buildPointBody(node, structure) {
    var parts = [];
    appendPointBodyLines(node, structure, parts, true);
    var text = parts.join('\n');
    return core.normalizeInstructionBlock ? core.normalizeInstructionBlock(text) : text.trim();
  }

  function hasPointDescendants(nodeId, structure) {
    var queue = [];
    var initial = (structure.childrenByParent && structure.childrenByParent[nodeId]) || [];
    for (var i = 0; i < initial.length; i++) queue.push(initial[i]);

    var guard = 0;
    while (queue.length && guard < 2000) {
      var node = queue.shift();
      if (!node) continue;
      if (node.type === 'point') return true;
      var children = (structure.childrenByParent && structure.childrenByParent[node.id]) || [];
      for (var c = 0; c < children.length; c++) queue.push(children[c]);
      guard += 1;
    }
    return false;
  }

  function inferEntityType(nodeType, title, body) {
    var source = (core.normalizeText ? core.normalizeText((title || '') + ' ' + (body || '')) : '').trim();
    if (/(определен|термин|под\s+.*\s+понима|называется)/.test(source)) return 'definition';
    if (/(порядок|действи|выполня|производ|следует|необходимо|разрешается|запрещается)/.test(source)) {
      return 'procedure';
    }
    if (nodeType === 'point') return 'rule';
    return 'point';
  }

  function shouldIndexNode(node, structure) {
    if (!node || node.type === 'document') return false;
    if (node.type === 'item') return false;
    if (node.type === 'subpoint') return false;
    if (node.type === 'point') return true;

    var body = normalizeBody(node);
    if (body.length < 24 && hasPointDescendants(node.id, structure)) return false;
    if (hasPointDescendants(node.id, structure) && body.length < 42) return false;
    return !!(node.title || body);
  }

  function collectAllTokens(title, body) {
    var source = [title || '', body || ''].join(' ').trim();
    var tokens = core.tokenize ? core.tokenize(source, { minLength: 1, keepStopWords: true, maxTokens: 320 }) : [];
    return core.uniqueArray ? core.uniqueArray(tokens) : tokens;
  }

  function collectAllStems(tokens) {
    return core.buildStems ? core.buildStems(tokens) : [];
  }

  function collectChargrams(tokens, stems) {
    var all = [];
    for (var i = 0; i < (tokens || []).length; i++) all.push(tokens[i]);
    for (var s = 0; s < (stems || []).length; s++) all.push(stems[s]);
    if (core.uniqueArray) all = core.uniqueArray(all);
    return core.buildChargrams ? core.buildChargrams(all, 520) : [];
  }

  function buildNodeDepthMap(structure) {
    var depthById = {};
    if (!structure || !structure.root) return depthById;
    var queue = [{ node: structure.root, depth: 0 }];
    while (queue.length) {
      var item = queue.shift();
      if (!item || !item.node || depthById[item.node.id] !== undefined) continue;
      depthById[item.node.id] = item.depth;
      var children = (structure.childrenByParent && structure.childrenByParent[item.node.id]) || [];
      for (var i = 0; i < children.length; i++) {
        queue.push({ node: children[i], depth: item.depth + 1 });
      }
    }
    return depthById;
  }

  function createSearchEntity(instruction, node, structure, depthById) {
    var nodeType = node.type;
    var title = formatNodeLabel(node);
    var body = nodeType === 'point' ? buildPointBody(node, structure) : normalizeBody(node);
    var normalizedTitle = core.normalizeText ? core.normalizeText(title) : String(title || '').toLowerCase();
    var normalizedBody = core.normalizeText ? core.normalizeText(body) : String(body || '').toLowerCase();
    var tokens = collectAllTokens(title, body);
    var stems = collectAllStems(tokens);
    var chargrams = collectChargrams(tokens, stems);
    var path = buildNodePath(instruction, node, structure);
    var entityType = inferEntityType(nodeType, title, body);
    var sectionRef = String(node.number || '').trim();

    return {
      id: instruction.id + '::' + node.id,
      instructionId: instruction.id,
      nodeId: node.id,
      path: path,
      type: entityType,
      number: sectionRef,
      title: title || String(node.title || ''),
      body: body,
      normalizedTitle: normalizedTitle,
      normalizedBody: normalizedBody,
      tokens: tokens,
      stems: stems,
      chargrams: chargrams,
      instructionTitle: instruction.title || '',
      nodeType: nodeType,
      depth: depthById[node.id] === undefined ? 0 : depthById[node.id]
    };
  }

  function buildSearchEntities(instructions) {
    var entities = [];
    for (var i = 0; i < (instructions || []).length; i++) {
      var instruction = instructions[i];
      if (!instruction || !Array.isArray(instruction.nodes) || !instruction.nodes.length) continue;
      var structure = buildInstructionStructure(instruction);
      var depthById = buildNodeDepthMap(structure);
      for (var n = 0; n < instruction.nodes.length; n++) {
        var node = instruction.nodes[n];
        if (!shouldIndexNode(node, structure)) continue;
        entities.push(createSearchEntity(instruction, node, structure, depthById));
      }
    }
    return entities;
  }

  core.buildSearchEntities = buildSearchEntities;
})(window);
