(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  var TYPE_MAP = {
    document: 'document',
    chapter: 'chapter',
    section: 'section',
    subsection: 'section',
    point: 'point',
    subpoint: 'subpoint',
    item: 'item'
  };

  var LIST_ITEM_PREFIX_RE = /^(\(?\d+\)|\d+\)|[а-яa-z]\)|[-—–])\s*(.+)$/i;

  function normalizeNodeType(type) {
    var normalized = String(type || '').toLowerCase().trim();
    return TYPE_MAP[normalized] || 'section';
  }

  function compareNodeOrder(a, b) {
    var aOrder = parseInt(a.order, 10) || 0;
    var bOrder = parseInt(b.order, 10) || 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if ((a.number || '') !== (b.number || '')) {
      return String(a.number || '').localeCompare(String(b.number || ''), 'ru');
    }
    return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
  }

  function flattenRawInstructionNodes(rawNodes, instructionId) {
    var source = Array.isArray(rawNodes) ? rawNodes : [];
    if (!source.length) return [];
    var out = [];
    var autoId = 0;

    function ensureRawNodeId(node, parentId, index) {
      if (node && node.id !== undefined && node.id !== null && String(node.id).trim()) {
        return String(node.id);
      }
      autoId += 1;
      var parentPart = parentId ? String(parentId) : (instructionId + '-document');
      return parentPart + '-auto-' + index + '-' + autoId;
    }

    function visit(list, parentId) {
      if (!Array.isArray(list)) return;
      for (var i = 0; i < list.length; i++) {
        var rawNode = list[i];
        if (!rawNode || typeof rawNode !== 'object') continue;
        var nodeId = ensureRawNodeId(rawNode, parentId, i + 1);
        var clone = {};
        var keys = Object.keys(rawNode);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (key === 'children') continue;
          clone[key] = rawNode[key];
        }
        clone.id = nodeId;
        if (
          (clone.parentId === undefined || clone.parentId === null || clone.parentId === '') &&
          parentId
        ) {
          clone.parentId = parentId;
        }
        if (clone.order === undefined || clone.order === null || isNaN(parseInt(clone.order, 10))) {
          clone.order = i + 1;
        }
        out.push(clone);
        if (Array.isArray(rawNode.children) && rawNode.children.length) {
          visit(rawNode.children, nodeId);
        }
      }
    }

    visit(source, null);
    return out;
  }

  function buildFallbackTitle(nodeType, number, content, index) {
    var cleanNumber = String(number || '').trim();
    if (cleanNumber) return cleanNumber;
    var plain = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(content) : String(content || '').trim();
    if (plain) {
      var line = plain.split('\n')[0] || '';
      if (line.length > 96) line = line.slice(0, 93).trim() + '...';
      return line;
    }
    if (nodeType === 'chapter') return 'Глава ' + (index + 1);
    if (nodeType === 'section') return 'Раздел ' + (index + 1);
    if (nodeType === 'point') return 'Пункт ' + (index + 1);
    if (nodeType === 'subpoint' || nodeType === 'item') return 'Подпункт ' + (index + 1);
    return 'Раздел ' + (index + 1);
  }

  function normalizeInstructionNode(rawNode, instructionId, index) {
    var safe = rawNode || {};
    var nodeType = normalizeNodeType(safe.type);
    var rawContent = safe.content !== undefined && safe.content !== null
      ? String(safe.content)
      : String(safe.plainText || '');
    var plainText = safe.plainText !== undefined && safe.plainText !== null
      ? String(safe.plainText)
      : (core.stripHtmlToText ? core.stripHtmlToText(rawContent) : String(rawContent || ''));
    var normalizedContent = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(rawContent) : String(rawContent || '').trim();
    var normalizedPlain = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(plainText) : String(plainText || '').trim();
    var number = safe.number !== undefined && safe.number !== null ? String(safe.number).trim() : '';
    var title = String(safe.title || '').trim();
    if (!title) title = buildFallbackTitle(nodeType, number, normalizedPlain || normalizedContent, index);
    var source = safe.source && typeof safe.source === 'object' ? safe.source : {};

    return {
      id: String(safe.id || (instructionId + '-node-' + (index + 1))),
      instructionId: instructionId,
      parentId: safe.parentId !== undefined && safe.parentId !== null && String(safe.parentId).trim()
        ? String(safe.parentId)
        : null,
      type: nodeType,
      order: Math.max(0, parseInt(safe.order, 10) || 0),
      number: number,
      title: title,
      content: normalizedContent,
      plainText: normalizedPlain,
      source: {
        url: source.url ? String(source.url) : (safe.sourceUrl ? String(safe.sourceUrl) : ''),
        path: source.path ? String(source.path) : '',
        fetchedAt: source.fetchedAt ? String(source.fetchedAt) : ''
      }
    };
  }

  function ensureDocumentNode(nodes, instructionId, instructionTitle, sourceUrl) {
    var documentNodeId = '';
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].type === 'document' && !nodes[i].parentId) {
        documentNodeId = nodes[i].id;
        break;
      }
    }
    if (documentNodeId) return documentNodeId;

    documentNodeId = instructionId + '-document';
    nodes.unshift({
      id: documentNodeId,
      instructionId: instructionId,
      parentId: null,
      type: 'document',
      order: 0,
      number: '',
      title: String(instructionTitle || instructionId.toUpperCase()),
      content: '',
      plainText: '',
      source: {
        url: sourceUrl ? String(sourceUrl) : '',
        path: '',
        fetchedAt: ''
      }
    });

    return documentNodeId;
  }

  function ensureUniqueNodeIds(nodes) {
    var seen = {};
    for (var i = 0; i < nodes.length; i++) {
      var base = String(nodes[i].id || ('node-' + (i + 1)));
      var candidate = base;
      var seq = 2;
      while (seen[candidate]) {
        candidate = base + '-' + seq;
        seq += 1;
      }
      nodes[i].id = candidate;
      seen[candidate] = 1;
    }
  }

  function buildNodeMap(nodes) {
    var out = {};
    for (var i = 0; i < nodes.length; i++) {
      out[nodes[i].id] = nodes[i];
    }
    return out;
  }

  function nearestPointLikeSiblingBefore(nodes, parentId, order, excludeId) {
    var candidate = null;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || node.id === excludeId) continue;
      if (String(node.parentId || '') !== String(parentId || '')) continue;
      if (parseInt(node.order, 10) >= parseInt(order, 10)) continue;
      if (node.type !== 'point' && node.type !== 'subpoint') continue;
      if (!candidate || compareNodeOrder(candidate, node) < 0) {
        candidate = node;
      }
    }
    return candidate;
  }

  function splitParagraphs(text) {
    var block = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(text) : String(text || '').trim();
    if (!block) return [];
    var raw = block.split(/\n{2,}/);
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var part = String(raw[i] || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
      if (!part) continue;
      out.push(part);
    }
    return out;
  }

  function splitIntroAndInlineItems(text) {
    var paragraphs = splitParagraphs(text);
    if (!paragraphs.length) {
      return {
        intro: '',
        items: []
      };
    }

    var intro = [];
    var items = [];
    var current = null;

    function pushCurrent() {
      if (!current) return;
      var body = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(current.body) : String(current.body || '').trim();
      if (body) {
        current.body = body;
        items.push(current);
      }
      current = null;
    }

    for (var i = 0; i < paragraphs.length; i++) {
      var paragraph = paragraphs[i];
      var match = LIST_ITEM_PREFIX_RE.exec(paragraph);
      if (match) {
        pushCurrent();
        var marker = String(match[1] || '').trim();
        var body = String(match[2] || '').trim();
        if (!body) body = marker;
        current = {
          number: marker,
          body: body
        };
      } else if (current) {
        current.body += '\n' + paragraph;
      } else {
        intro.push(paragraph);
      }
    }

    pushCurrent();
    if (items.length < 2) {
      return {
        intro: core.normalizeInstructionBlock ? core.normalizeInstructionBlock(text) : String(text || '').trim(),
        items: []
      };
    }

    return {
      intro: core.normalizeInstructionBlock ? core.normalizeInstructionBlock(intro.join('\n\n')) : intro.join('\n\n').trim(),
      items: items
    };
  }

  function buildItemTitle(number, body) {
    var normalized = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(body) : String(body || '').trim();
    var single = normalized.split('\n')[0] || '';
    if (!single) return String(number || '').trim();
    if (single.length > 112) single = single.slice(0, 109).trim() + '...';
    return single;
  }

  function expandInlineItems(nodes, instructionId) {
    var nodeMap = buildNodeMap(nodes);
    var hasChildPointLike = {};
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node.parentId) continue;
      if (node.type === 'subpoint' || node.type === 'item') {
        hasChildPointLike[node.parentId] = 1;
      }
    }

    var extra = [];
    var idSet = {};
    for (var s = 0; s < nodes.length; s++) idSet[nodes[s].id] = 1;

    for (var n = 0; n < nodes.length; n++) {
      var parent = nodes[n];
      if (!parent) continue;
      if (parent.type !== 'point' && parent.type !== 'subpoint') continue;
      if (hasChildPointLike[parent.id]) continue;
      var sourceText = parent.content || parent.plainText || '';
      if (!sourceText) continue;

      var parsed = splitIntroAndInlineItems(sourceText);
      if (!parsed.items.length) continue;

      parent.content = parsed.intro;
      parent.plainText = parsed.intro;

      var maxOrder = 0;
      for (var c = 0; c < nodes.length; c++) {
        if (nodes[c].parentId === parent.id) {
          maxOrder = Math.max(maxOrder, parseInt(nodes[c].order, 10) || 0);
        }
      }

      for (var it = 0; it < parsed.items.length; it++) {
        var itemInfo = parsed.items[it];
        var baseId = parent.id + '-item-' + (it + 1);
        var nextId = baseId;
        var seq = 2;
        while (idSet[nextId]) {
          nextId = baseId + '-' + seq;
          seq += 1;
        }
        idSet[nextId] = 1;
        var body = core.normalizeInstructionBlock ? core.normalizeInstructionBlock(itemInfo.body) : String(itemInfo.body || '').trim();
        extra.push({
          id: nextId,
          instructionId: instructionId,
          parentId: parent.id,
          type: 'item',
          order: maxOrder + it + 1,
          number: itemInfo.number,
          title: buildItemTitle(itemInfo.number, body),
          content: body,
          plainText: body,
          source: parent.source || {}
        });
      }
    }

    if (extra.length) {
      for (var e = 0; e < extra.length; e++) nodes.push(extra[e]);
    }
  }

  function reparentDetachedSubnodes(nodes, nodeMap, documentNodeId) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || (node.type !== 'subpoint' && node.type !== 'item')) continue;
      var parent = node.parentId ? nodeMap[node.parentId] : null;
      var parentIsPointLike = !!(parent && (parent.type === 'point' || parent.type === 'subpoint' || parent.type === 'item'));
      if (parentIsPointLike) continue;

      var siblingPoint = nearestPointLikeSiblingBefore(nodes, node.parentId, node.order, node.id);
      if (siblingPoint) {
        node.parentId = siblingPoint.id;
        node.type = 'item';
        continue;
      }

      if (!parent || parent.id === documentNodeId || parent.type === 'chapter' || parent.type === 'section') {
        node.type = 'point';
      }
    }
  }

  function orderNodesDepthFirst(nodes, rootId) {
    var nodeMap = buildNodeMap(nodes);
    var childrenByParent = {};
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var parentId = node.parentId && nodeMap[node.parentId] ? node.parentId : null;
      if (!parentId) continue;
      if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
      childrenByParent[parentId].push(node);
    }

    var parentKeys = Object.keys(childrenByParent);
    for (var p = 0; p < parentKeys.length; p++) {
      childrenByParent[parentKeys[p]].sort(compareNodeOrder);
    }

    var root = nodeMap[rootId] || null;
    if (!root && nodes.length) root = nodes[0];
    if (!root) return nodes;

    var out = [];
    var seen = {};

    function walk(node) {
      if (!node || seen[node.id]) return;
      seen[node.id] = 1;
      out.push(node);
      var children = childrenByParent[node.id] || [];
      for (var i = 0; i < children.length; i++) walk(children[i]);
    }

    walk(root);
    for (var i = 0; i < nodes.length; i++) {
      if (!seen[nodes[i].id]) out.push(nodes[i]);
    }

    return out;
  }

  function parseHierarchy(rawNodes, options) {
    var opts = options || {};
    var instructionId = String(opts.instructionId || 'instruction');
    var instructionTitle = String(opts.instructionTitle || instructionId.toUpperCase());
    var sourceUrl = String(opts.sourceUrl || '');

    var flat = flattenRawInstructionNodes(rawNodes, instructionId);
    var nodes = [];
    for (var i = 0; i < flat.length; i++) {
      nodes.push(normalizeInstructionNode(flat[i], instructionId, i));
    }

    var documentNodeId = ensureDocumentNode(nodes, instructionId, instructionTitle, sourceUrl);
    ensureUniqueNodeIds(nodes);
    for (var d = 0; d < nodes.length; d++) {
      if (nodes[d].type === 'document' && !nodes[d].parentId) {
        documentNodeId = nodes[d].id;
        break;
      }
    }

    var nodeMap = buildNodeMap(nodes);
    for (var n = 0; n < nodes.length; n++) {
      nodes[n].instructionId = instructionId;
      if (!nodes[n].parentId || !nodeMap[nodes[n].parentId] || nodes[n].parentId === nodes[n].id) {
        nodes[n].parentId = nodes[n].id === documentNodeId ? null : documentNodeId;
      }
    }

    nodeMap = buildNodeMap(nodes);
    reparentDetachedSubnodes(nodes, nodeMap, documentNodeId);
    expandInlineItems(nodes, instructionId);
    ensureUniqueNodeIds(nodes);

    nodeMap = buildNodeMap(nodes);
    for (var k = 0; k < nodes.length; k++) {
      if (!nodes[k].parentId || !nodeMap[nodes[k].parentId] || nodes[k].parentId === nodes[k].id) {
        nodes[k].parentId = nodes[k].id === documentNodeId ? null : documentNodeId;
      }
    }

    return orderNodesDepthFirst(nodes, documentNodeId);
  }

  core.parseHierarchy = parseHierarchy;
})(window);
