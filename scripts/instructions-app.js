    function stripHtmlToText(content) {
      var temp = document.createElement('div');
      temp.innerHTML = String(content || '');
      return String(temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeInstructionTextBlock(value) {
      return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    var SEARCH_STOP_WORDS = {
      'и': 1, 'в': 1, 'во': 1, 'на': 1, 'по': 1, 'к': 1, 'ко': 1, 'о': 1, 'об': 1, 'обо': 1,
      'с': 1, 'со': 1, 'у': 1, 'за': 1, 'из': 1, 'от': 1, 'до': 1, 'для': 1, 'при': 1, 'под': 1,
      'над': 1, 'не': 1, 'ни': 1, 'а': 1, 'но': 1, 'или': 1, 'ли': 1, 'же': 1, 'бы': 1, 'что': 1,
      'как': 1, 'где': 1, 'когда': 1, 'какой': 1, 'какая': 1, 'какие': 1, 'какое': 1
    };

    var RU_PERFECTIVEGROUND_1 = /(ив|ивши|ившись|ыв|ывши|ывшись)$/;
    var RU_PERFECTIVEGROUND_2 = /([ая])(в|вши|вшись)$/;
    var RU_REFLEXIVE = /(с[яь])$/;
    var RU_ADJECTIVE = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
    var RU_PARTICIPLE_1 = /([ая])(ем|нн|вш|ющ|щ)$/;
    var RU_PARTICIPLE_2 = /(ивш|ывш|ующ)$/;
    var RU_VERB_1 = /([ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)$/;
    var RU_VERB_2 = /(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)$/;
    var RU_NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ию|ью|ю|ия|ья|я)$/;
    var RU_DERIVATIONAL = /[^аеиоуыэюя]+[аеиоуыэюя].*ость?$/;
    var RU_SUPERLATIVE = /(ейш|ейше)$/;
    var RU_VOWELS = 'аеёиоуыэюя';

    function normalizeSearchText(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/[«»"“”„`']/g, ' ')
        .replace(/[_.,;:!?(){}\[\]|<>]+/g, ' ')
        .replace(/[^a-zа-я0-9%№\/+\-\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function splitSearchTerms(query, options) {
      var opts = options || {};
      var normalized = normalizeSearchText(query);
      if (!normalized) return [];
      var parts = normalized.split(' ');
      var terms = [];
      var minLength = Math.max(1, parseInt(opts.minLength, 10) || 1);
      var keepStopWords = opts.keepStopWords !== false;
      for (var i = 0; i < parts.length; i++) {
        var token = String(parts[i] || '').replace(/^[^a-zа-я0-9]+|[^a-zа-я0-9]+$/gi, '');
        if (!token) continue;
        var isNumeric = /^\d+$/.test(token);
        if (!isNumeric && token.length < minLength) continue;
        if (!keepStopWords && !isNumeric && SEARCH_STOP_WORDS[token]) continue;
        terms.push(token);
      }
      return terms;
    }

    function uniqueArray(values) {
      var seen = {};
      var result = [];
      for (var i = 0; i < (values || []).length; i++) {
        var item = values[i];
        if (!item || seen[item]) continue;
        seen[item] = true;
        result.push(item);
      }
      return result;
    }

    function isCyrillicToken(token) {
      return /[а-я]/i.test(String(token || ''));
    }

    function getRussianRvIndex(word) {
      var value = String(word || '');
      for (var i = 0; i < value.length; i++) {
        if (RU_VOWELS.indexOf(value.charAt(i)) !== -1) {
          return i + 1;
        }
      }
      return -1;
    }

    function stemRussianToken(token) {
      var value = String(token || '').toLowerCase().replace(/ё/g, 'е').trim();
      if (!value || value.length <= 3 || !isCyrillicToken(value)) {
        return value;
      }

      var rvIndex = getRussianRvIndex(value);
      if (rvIndex < 0 || rvIndex >= value.length) return value;
      var start = value.slice(0, rvIndex);
      var rv = value.slice(rvIndex);

      var replaced = rv.replace(RU_PERFECTIVEGROUND_1, '');
      if (replaced === rv) replaced = rv.replace(RU_PERFECTIVEGROUND_2, '$1');
      if (replaced !== rv) {
        rv = replaced;
      } else {
        rv = rv.replace(RU_REFLEXIVE, '');
        var adjectiveRemoved = rv.replace(RU_ADJECTIVE, '');
        if (adjectiveRemoved !== rv) {
          rv = adjectiveRemoved.replace(RU_PARTICIPLE_1, '$1').replace(RU_PARTICIPLE_2, '');
        } else {
          var verbRemoved = rv.replace(RU_VERB_1, '$1');
          if (verbRemoved === rv) verbRemoved = rv.replace(RU_VERB_2, '');
          if (verbRemoved !== rv) rv = verbRemoved;
          else rv = rv.replace(RU_NOUN, '');
        }
      }

      rv = rv.replace(/и$/, '');
      if (RU_DERIVATIONAL.test(rv)) {
        rv = rv.replace(/ость?$/, '');
      }
      if (/ь$/.test(rv)) {
        rv = rv.replace(/ь$/, '');
      } else {
        rv = rv.replace(RU_SUPERLATIVE, '').replace(/нн$/, 'н');
      }

      var stem = (start + rv).trim();
      return stem.length >= 3 ? stem : value;
    }

    function normalizeStemToken(token) {
      var normalized = normalizeSearchText(token);
      if (!normalized) return '';
      var stem = stemRussianToken(normalized);
      if (!stem) return normalized;
      if (stem.length >= 3) return stem;
      return normalized;
    }

    function buildTokenStems(tokens) {
      var stems = [];
      for (var i = 0; i < (tokens || []).length; i++) {
        var stem = normalizeStemToken(tokens[i]);
        if (!stem) continue;
        stems.push(stem);
      }
      return uniqueArray(stems);
    }

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
      return uniqueArray(grams);
    }

    function buildTextChargramSet(tokens, maxSize) {
      var set = {};
      var limit = Math.max(32, parseInt(maxSize, 10) || 320);
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

    function computeChargramOverlapScore(queryGrams, targetGramSet) {
      if (!queryGrams || !queryGrams.length || !targetGramSet) return 0;
      var hits = 0;
      for (var i = 0; i < queryGrams.length; i++) {
        if (targetGramSet[queryGrams[i]]) hits += 1;
      }
      if (!hits) return 0;
      return hits / queryGrams.length;
    }

    function hasPrefixMatch(stems, queryStem) {
      var source = String(queryStem || '');
      if (!source || source.length < 2) return false;
      for (var i = 0; i < (stems || []).length; i++) {
        var candidate = stems[i];
        if (!candidate) continue;
        if (candidate.indexOf(source) === 0 || source.indexOf(candidate) === 0) return true;
      }
      return false;
    }

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
      for (var j = 0; j <= right.length; j++) {
        prev[j] = j;
      }
      for (var i = 1; i <= left.length; i++) {
        curr[0] = i;
        var rowMin = curr[0];
        for (var k = 1; k <= right.length; k++) {
          var cost = left.charAt(i - 1) === right.charAt(k - 1) ? 0 : 1;
          curr[k] = Math.min(
            prev[k] + 1,
            curr[k - 1] + 1,
            prev[k - 1] + cost
          );
          if (curr[k] < rowMin) rowMin = curr[k];
        }
        if (rowMin > threshold) return threshold + 1;
        var swap = prev;
        prev = curr;
        curr = swap;
      }
      return prev[right.length];
    }

    function bestFuzzyStemDistance(queryStem, candidates, maxDistance) {
      var token = String(queryStem || '');
      if (!token || token.length < 3) return maxDistance + 1;
      var threshold = Math.max(1, parseInt(maxDistance, 10) || 1);
      var best = threshold + 1;
      var firstChar = token.charAt(0);
      for (var i = 0; i < (candidates || []).length; i++) {
        var candidate = candidates[i];
        if (!candidate) continue;
        if (candidate.charAt(0) !== firstChar && token.length >= 4) continue;
        var dist = boundedLevenshteinDistance(token, candidate, threshold);
        if (dist < best) best = dist;
        if (best === 1) break;
      }
      return best;
    }

    function inferSearchEntityType(nodeType, title, body) {
      var sectionType = String(nodeType || '').toLowerCase();
      var source = normalizeSearchText((title || '') + ' ' + (body || ''));
      if (/(определен|термин|под\s+.*\s+понима|называется)/.test(source)) return 'definition';
      if (/(порядок|действи|выполня|производ|следует|необходимо|разрешается|запрещается)/.test(source)) {
        return 'procedure';
      }
      if (sectionType === 'point' || sectionType === 'subpoint' || sectionType === 'item') return 'rule';
      if (sectionType === 'chapter' || sectionType === 'section' || sectionType === 'subsection') return sectionType;
      return 'section';
    }

    function buildSearchQueryProfile(query) {
      var normalized = normalizeSearchText(query);
      var allTokens = splitSearchTerms(normalized, { minLength: 1, keepStopWords: true });
      var meaningfulTokens = splitSearchTerms(normalized, { minLength: 2, keepStopWords: false });
      var tokens = meaningfulTokens.length ? meaningfulTokens : allTokens;
      tokens = tokens.slice(0, 8);
      var stems = buildTokenStems(tokens);
      var tokenProfiles = [];
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        var stem = normalizeStemToken(token) || token;
        tokenProfiles.push({
          token: token,
          stem: stem,
          grams: buildTokenChargrams(stem || token)
        });
      }
      var wantsSpeedNorm = /(скорост|км\/?ч|кмч)/.test(normalized);
      var wantsDefinition = /(что такое|определен|термин|что значит)/.test(normalized);
      var wantsProcedure = /(что делать|как|порядок|действия|при\s)/.test(normalized);
      var wantsRule = wantsProcedure || /(должен|обязан|запрещ|разреш|можно|нельзя)/.test(normalized);
      var wantsNumericNorm = wantsSpeedNorm || /(норма|огранич|не более|не менее|максимум|минимум)/.test(normalized);

      var chargramSet = buildTextChargramSet(stems.length ? stems : tokens, 196);

      return {
        normalized: normalized,
        allTokens: allTokens,
        tokens: tokens,
        stems: stems,
        tokenProfiles: tokenProfiles,
        chargramSet: chargramSet,
        chargrams: Object.keys(chargramSet),
        wantsSpeedNorm: wantsSpeedNorm,
        wantsDefinition: wantsDefinition,
        wantsProcedure: wantsProcedure,
        wantsRule: wantsRule,
        wantsNumericNorm: wantsNumericNorm
      };
    }

    function escapeRegExpText(value) {
      return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function formatIsoDateLabel(isoString) {
      if (!isoString) return '';
      var date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function getInstructionsPreviewSeed() {
      return [
        {
          id: 'pte',
          title: 'ПТЭ',
          shortDescription: 'Правила технической эксплуатации железных дорог Российской Федерации',
          sortOrder: 0,
          nodes: []
        },
        {
          id: 'isi',
          title: 'ИСИ',
          shortDescription: 'Инструкция по сигнализации на железнодорожном транспорте',
          sortOrder: 1,
          nodes: []
        },
        {
          id: 'idp',
          title: 'ИДП',
          shortDescription: 'Инструкция по организации движения поездов и маневровой работы',
          sortOrder: 2,
          nodes: []
        }
      ];
    }

    function getInstructionOrderWeight(instruction) {
      var item = instruction || {};
      var explicitOrder = parseInt(item.sortOrder, 10);
      if (!isNaN(explicitOrder) && explicitOrder >= 0) return explicitOrder;

      var id = normalizeSearchText(item.id || '');
      if (id === 'pte') return 0;
      if (id === 'isi') return 1;
      if (id === 'idp') return 2;

      var title = normalizeSearchText(item.title || '');
      if (title === 'птэ') return 0;
      if (title === 'иси') return 1;
      if (title === 'идп') return 2;

      return 1000;
    }

    function sortInstructionsForDisplay(instructions) {
      var source = Array.isArray(instructions) ? instructions : [];
      if (!source.length) return [];
      var ordered = source.slice();
      ordered.sort(function(a, b) {
        var aWeight = getInstructionOrderWeight(a);
        var bWeight = getInstructionOrderWeight(b);
        if (aWeight !== bWeight) return aWeight - bWeight;
        if ((a.title || '') !== (b.title || '')) {
          return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
        }
        return String(a.id || '').localeCompare(String(b.id || ''), 'ru');
      });
      return ordered;
    }

    function normalizeInstructionNode(rawNode, instructionId, index) {
      var safe = rawNode || {};
      var nodeId = String(safe.id || (instructionId + '-node-' + (index + 1)));
      var rawContent = safe.content !== undefined && safe.content !== null
        ? String(safe.content)
        : String(safe.plainText || '');
      var plainText = safe.plainText !== undefined && safe.plainText !== null
        ? String(safe.plainText)
        : stripHtmlToText(rawContent);
      var normalizedType = String(safe.type || '').toLowerCase();
      if (
        normalizedType !== 'document' &&
        normalizedType !== 'chapter' &&
        normalizedType !== 'section' &&
        normalizedType !== 'subsection' &&
        normalizedType !== 'point' &&
        normalizedType !== 'subpoint' &&
        normalizedType !== 'item'
      ) {
        normalizedType = 'section';
      }
      var source = safe.source && typeof safe.source === 'object' ? safe.source : {};
      return {
        id: nodeId,
        instructionId: instructionId,
        parentId: safe.parentId !== undefined && safe.parentId !== null && String(safe.parentId)
          ? String(safe.parentId)
          : null,
        type: normalizedType,
        order: Math.max(0, parseInt(safe.order, 10) || 0),
        number: safe.number !== undefined && safe.number !== null ? String(safe.number) : '',
        title: String(safe.title || ('Раздел ' + (index + 1))),
        content: rawContent,
        plainText: String(plainText || '').replace(/\r\n/g, '\n').trim(),
        source: {
          url: source.url ? String(source.url) : (safe.sourceUrl ? String(safe.sourceUrl) : ''),
          path: source.path ? String(source.path) : '',
          fetchedAt: source.fetchedAt ? String(source.fetchedAt) : ''
        }
      };
    }

    function compareInstructionNodeOrder(a, b) {
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

    function normalizeInstructionsPayload(payload) {
      return {
        updatedAt: payload && payload.updatedAt ? String(payload.updatedAt) : new Date().toISOString(),
        version: payload && payload.version ? String(payload.version) : '1',
        instructions: []
      };
    }

    function getInstructionStructure(instruction) {
      var emptyStructure = {
        root: null,
        nodeById: {},
        childrenByParent: {},
        traversal: [],
        depthById: {}
      };
      if (!instruction || !Array.isArray(instruction.nodes) || !instruction.nodes.length) {
        return emptyStructure;
      }

      var cacheKey = instruction.nodes.length + '::' + (instruction.nodes[0].id || '') + '::' + (instruction.nodes[instruction.nodes.length - 1].id || '');
      if (instruction._nodeStructureCache && instruction._nodeStructureCache.key === cacheKey) {
        return instruction._nodeStructureCache.value;
      }

      var nodeById = {};
      for (var i = 0; i < instruction.nodes.length; i++) {
        nodeById[instruction.nodes[i].id] = instruction.nodes[i];
      }

      var root = null;
      for (var r = 0; r < instruction.nodes.length; r++) {
        if (instruction.nodes[r].type === 'document' && !instruction.nodes[r].parentId) {
          root = instruction.nodes[r];
          break;
        }
      }
      if (!root) {
        for (var rr = 0; rr < instruction.nodes.length; rr++) {
          if (!instruction.nodes[rr].parentId) {
            root = instruction.nodes[rr];
            break;
          }
        }
      }
      if (!root) root = instruction.nodes[0];

      var childrenByParent = {};
      for (var c = 0; c < instruction.nodes.length; c++) {
        var current = instruction.nodes[c];
        if (current.id === root.id) continue;
        var parentId = current.parentId && nodeById[current.parentId] ? current.parentId : root.id;
        if (!childrenByParent[parentId]) {
          childrenByParent[parentId] = [];
        }
        childrenByParent[parentId].push(current);
      }

      var parentKeys = Object.keys(childrenByParent);
      for (var pk = 0; pk < parentKeys.length; pk++) {
        childrenByParent[parentKeys[pk]].sort(compareInstructionNodeOrder);
      }

      var traversal = [];
      var depthById = {};
      function walk(node, depth, seen) {
        if (!node || seen[node.id]) return;
        seen[node.id] = true;
        depthById[node.id] = depth;
        traversal.push({
          node: node,
          depth: depth
        });
        var children = childrenByParent[node.id] || [];
        for (var j = 0; j < children.length; j++) {
          walk(children[j], depth + 1, seen);
        }
      }
      walk(root, 0, {});

      var result = {
        root: root,
        nodeById: nodeById,
        childrenByParent: childrenByParent,
        traversal: traversal,
        depthById: depthById
      };
      instruction._nodeStructureCache = {
        key: cacheKey,
        value: result
      };
      return result;
    }

    function getNodeSearchText(node) {
      if (!node) return '';
      var raw = node.plainText || '';
      if (!raw) raw = stripHtmlToText(node.content || '');
      return normalizeInstructionTextBlock(raw);
    }

    function buildPointAnswerText(node, structure) {
      if (!node) return '';
      var parts = [];

      function appendPointBlock(current, isRoot) {
        if (!current) return;
        var heading = formatInstructionNodeLabel(current, '').trim();
        var content = normalizeInstructionTextBlock(
          normalizeNodeContentForDisplay(current, { suppressDuplicateHeading: true }) || getNodeSearchText(current)
        );
        var block = '';
        if (isRoot) {
          if (heading) block = heading;
          if (content) {
            block += (block ? '\n' : '') + content;
          }
        } else {
          if (heading && content) block = heading + ' ' + content;
          else block = heading || content;
        }
        if (block) parts.push(block.trim());
        var children = (structure && structure.childrenByParent && structure.childrenByParent[current.id]) || [];
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (!child || (child.type !== 'point' && child.type !== 'subpoint' && child.type !== 'item')) continue;
          appendPointBlock(child, false);
        }
      }

      appendPointBlock(node, true);
      return normalizeInstructionTextBlock(parts.join('\n'));
    }

    function buildNodeAnswerText(node, structure) {
      if (!node) return '';
      var isPointLike = node.type === 'point' || node.type === 'subpoint' || node.type === 'item';
      if (isPointLike) {
        return buildPointAnswerText(node, structure);
      }

      var content = normalizeInstructionTextBlock(
        normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true }) || getNodeSearchText(node)
      );
      if (content) return content;
      return formatInstructionNodeLabel(node, '').trim();
    }

    function formatSearchNodeReference(sectionType, sectionNumber) {
      var number = String(sectionNumber || '').trim();
      if (!number) return '';
      var clean = number.replace(/\s+/g, ' ').replace(/\.$/, '');
      if (!clean) return '';
      if (sectionType === 'point' || sectionType === 'subpoint' || sectionType === 'item') {
        return 'п. ' + clean;
      }
      return clean;
    }

    function buildInstructionNodePath(instruction, node, structure) {
      if (!instruction || !node || !structure) return '';
      var path = [];
      var rootId = structure.root ? structure.root.id : '';
      var current = node;
      var guard = 0;
      while (current && guard < 28 && current.id !== rootId) {
        path.push(formatInstructionNodeLabel(current, current.title || 'Раздел'));
        if (!current.parentId || !structure.nodeById[current.parentId]) break;
        current = structure.nodeById[current.parentId];
        guard += 1;
      }
      path.reverse();
      return path.join(' > ');
    }

    function buildInstructionsSearchIndex(instructions) {
      return [];
    }

    function readInstructionsCache() {
      return Promise.resolve({
        meta: {},
        instructions: [],
        searchDocs: []
      });
    }

    function saveInstructionsCache(payload) {
      return Promise.resolve(false);
    }

    function processInstructionsDataset(payload) {
      var source = payload || {};
      var meta = source.meta || {};
      var instructions = sortInstructionsForDisplay(source.instructions || []);
      var rawSearchDocs = Array.isArray(source.searchDocs) ? source.searchDocs : [];
      var searchDocs = rawSearchDocs.length
        ? rawSearchDocs.slice()
        : buildInstructionsSearchIndex(instructions);

      return {
        meta: meta,
        instructions: instructions,
        searchDocs: searchDocs
      };
    }

    function hydrateInstructionsState(payload, sourceLabel) {
      var processed = processInstructionsDataset(payload);
      var instructions = processed.instructions;
      var searchDocs = processed.searchDocs;
      var meta = processed.meta;
      instructionsStore.instructions = instructions;
      instructionsStore.searchDocs = searchDocs;
      instructionsStore.preparedSearchDocs = [];
      instructionsStore.preparedSearchDocsKey = '';
      instructionsStore.searchAnswer = null;
      instructionsStore.hasCache = instructions.length > 0;
      instructionsStore.dataSource = sourceLabel || 'cache';
      instructionsStore.lastUpdated = meta.updatedAt || '';
      if (normalizeSearchText(instructionsStore.searchQuery)) {
        instructionsStore.searchResults = performInstructionsSearch(instructionsStore.searchQuery);
        instructionsStore.searchAnswer = instructionsStore.searchResults.length ? instructionsStore.searchResults[0] : null;
      } else {
        instructionsStore.searchResults = [];
        instructionsStore.searchAnswer = null;
      }
      if (instructionsStore.status !== 'error') {
        instructionsStore.status = instructions.length ? 'ready' : instructionsStore.status;
      }
      if (!findInstructionById(instructionsStore.selectedInstructionId)) {
        instructionsStore.selectedInstructionId = '';
        instructionsStore.selectedSectionId = '';
        if (instructionsStore.view !== 'list') {
          instructionsStore.view = 'list';
        }
      }
    }

    function fetchInstructionsFromNetwork() {
      return fetch(INSTRUCTIONS_DATA_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      }).then(function(response) {
        if (!response.ok) {
          throw new Error('Не удалось загрузить инструкции');
        }
        return response.json();
      }).then(function(payload) {
        return normalizeInstructionsPayload(payload);
      });
    }

    function ensureInstructionsReady(forceRefresh, silent) {
      if (instructionsStore.loadPromise) return instructionsStore.loadPromise;

      var shouldForce = !!forceRefresh;
      if (!silent && (!instructionsStore.instructions.length || shouldForce)) {
        instructionsStore.status = 'loading';
        instructionsStore.errorMessage = '';
        renderInstructionsScreen();
      }

      instructionsStore.loadPromise = readInstructionsCache()
        .then(function(cachePayload) {
          if (cachePayload && Array.isArray(cachePayload.instructions) && cachePayload.instructions.length) {
            hydrateInstructionsState(cachePayload, 'cache');
            if (!silent) renderInstructionsScreen();
          }

          if (!navigator.onLine) {
            if (!instructionsStore.instructions.length) {
              instructionsStore.status = 'offline';
              instructionsStore.errorMessage = 'Нет сети и локальная база ещё не загружена.';
            }
            return null;
          }

          return fetchInstructionsFromNetwork()
            .then(function(networkPayload) {
              var instructions = networkPayload.instructions || [];
              var searchDocs = buildInstructionsSearchIndex(instructions);
              var meta = {
                updatedAt: networkPayload.updatedAt || new Date().toISOString(),
                version: networkPayload.version || '1'
              };
              instructionsStore.status = instructions.length ? 'ready' : 'error';
              instructionsStore.errorMessage = instructions.length ? '' : 'Не удалось подготовить инструкции.';
              hydrateInstructionsState({
                meta: meta,
                instructions: instructions,
                searchDocs: searchDocs
              }, 'network');
              saveInstructionsCache({
                meta: meta,
                instructions: instructions,
                searchDocs: searchDocs
              });
            })
            .catch(function(err) {
              if (!instructionsStore.instructions.length) {
                instructionsStore.status = navigator.onLine ? 'error' : 'offline';
                instructionsStore.errorMessage = err && err.message ? err.message : 'Не удалось загрузить инструкции.';
              } else {
                instructionsStore.status = 'ready';
              }
            });
        })
        .catch(function(err) {
          if (!instructionsStore.instructions.length) {
            instructionsStore.status = 'error';
            instructionsStore.errorMessage = err && err.message ? err.message : 'Ошибка чтения локальной базы.';
          }
        })
        .finally(function() {
          instructionsStore.loadPromise = null;
          renderInstructionsScreen();
        });

      return instructionsStore.loadPromise;
    }

    function findInstructionById(instructionId) {
      if (!instructionId) return null;
      for (var i = 0; i < instructionsStore.instructions.length; i++) {
        if (instructionsStore.instructions[i].id === instructionId) {
          return instructionsStore.instructions[i];
        }
      }
      return null;
    }

    function normalizeInstructionAlias(value) {
  var raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'pte' || raw === 'птэ') return 'pte';
  if (raw === 'isi' || raw === 'иси') return 'isi';
  if (raw === 'idp' || raw === 'идп') return 'idp';
  return raw;
}

function normalizeInstructionNodeNumber(value) {
  return String(value || '')
    .trim()
    .replace(/[.)]+$/g, '')
    .replace(/\s+/g, '');
}

function findInstructionByAlias(alias) {
  var normalized = normalizeInstructionAlias(alias);
  if (!normalized) return null;

  for (var i = 0; i < instructionsStore.instructions.length; i++) {
    var instruction = instructionsStore.instructions[i];
    if (!instruction) continue;

    var byId = normalizeInstructionAlias(instruction.id);
    var byTitle = normalizeInstructionAlias(instruction.title);

    if (byId === normalized || byTitle === normalized) {
      return instruction;
    }
  }

  return null;
}

function findInstructionNodeByNumber(instruction, targetNumber) {
  if (!instruction || !targetNumber) return null;
  var structure = getInstructionStructure(instruction);
  var wanted = normalizeInstructionNodeNumber(targetNumber);
  if (!wanted) return null;

  for (var i = 0; i < instruction.nodes.length; i++) {
    var node = instruction.nodes[i];
    if (!node) continue;
    var nodeNumber = normalizeInstructionNodeNumber(node.number);
    if (nodeNumber === wanted) {
      return node;
    }
  }

  return null;
}

function buildInstructionRefButtonHtml(label, instructionAlias, targetNumber) {
  return '<button class="instruction-inline-link" type="button" data-action="open-ref" data-instruction-id="' +
    escapeHtml(String(instructionAlias || '')) +
    '" data-target-number="' +
    escapeHtml(String(targetNumber || '')) +
    '">' +
    escapeHtml(String(label || '')) +
    '</button>';
}

function linkifyInstructionReferences(text) {
  var source = String(text || '');
  if (!source) return '';

  var re = /\b((?:п\.|пункт)\s*)(\d+(?:\.\d+)*)(\.?)(\s+)(ПТЭ|ИСИ|ИДП)\b/gi;
  var html = '';
  var lastIndex = 0;
  var match;

  while ((match = re.exec(source))) {
    html += escapeHtml(source.slice(lastIndex, match.index));

    var label = match[0];
    var targetNumber = match[2];
    var instructionAlias = normalizeInstructionAlias(match[5]);

    html += buildInstructionRefButtonHtml(label, instructionAlias, targetNumber);
    lastIndex = re.lastIndex;
  }

  html += escapeHtml(source.slice(lastIndex));
  return html.replace(/\n/g, '<br />');
}

function formatInstructionNodeContentHtml(node, options) {
  var opts = options || {};
  if (!node) {
    return '<p class="instruction-paragraph instruction-paragraph--muted">Текст раздела пока недоступен.</p>';
  }

  var blocks = Array.isArray(node.contentBlocks) ? node.contentBlocks : [];
  if (!blocks.length) {
    return formatInstructionContentHtml(node.content || node.plainText || '', opts);
  }

  var isTruncated = false;
  if (opts.maxParagraphs && blocks.length > opts.maxParagraphs) {
    blocks = blocks.slice(0, opts.maxParagraphs);
    isTruncated = true;
  }

  var html = [];
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (!block) continue;

    if (block.type === 'point') {
      html.push(
        '<p class="instruction-paragraph instruction-paragraph--point">' +
          '<span class="instruction-point-number">' + escapeHtml(String(block.number || '')) + '</span> ' +
          '<span class="instruction-point-text">' + linkifyInstructionReferences(String(block.text || '')) + '</span>' +
        '</p>'
      );
      continue;
    }

    html.push(
      '<p class="instruction-paragraph">' +
        linkifyInstructionReferences(String(block.text || '')) +
      '</p>'
    );
  }

  if (isTruncated || opts.forceHint) {
    html.push('<p class="instruction-paragraph instruction-paragraph--hint">Откройте нужный пункт ниже, чтобы увидеть полный текст без перегруза.</p>');
  }

  return html.join('');
}

function openInstructionReference(instructionAlias, targetNumber) {
  var instruction = findInstructionByAlias(instructionAlias);
  if (!instruction) return;

  var targetNode = findInstructionNodeByNumber(instruction, targetNumber);
  if (targetNode) {
    openInstructionSection(instruction.id, targetNode.id);
    return;
  }

  openInstructionDetail(instruction.id);
}
    function findInstructionNodeById(instruction, nodeId) {
      if (!instruction || !nodeId) return null;
      var structure = getInstructionStructure(instruction);
      return structure.nodeById[nodeId] || null;
    }

    // ── Presentation Layer Helpers ────────────────────────────────────────────

    // Renders a list of previewLines as an emoji-annotated norm list.
    // query is optional — used for highlight, pass '' when not in search context.
    function buildNormListHtml(previewLines, query) {
      if (!previewLines || !previewLines.length) return '';
      var html = '<ul class="instruction-norm-list">';
      for (var i = 0; i < previewLines.length; i++) {
        var line = previewLines[i];
        var markerHtml = escapeHtml(String(line.marker || ''));
        var textHtml = query
          ? highlightSearchText(String(line.text || ''), query)
          : escapeHtml(String(line.text || ''));
        html += '<li class="instruction-norm-item">' +
          '<span class="instruction-norm-marker">' + markerHtml + '</span>' +
          '<span class="instruction-norm-text">' + textHtml + '</span>' +
          '</li>';
      }
      html += '</ul>';
      return html;
    }

    // Renders extracted footnotes as a "Примечания" block.
    function buildFootnotesHtml(footnotes) {
      if (!footnotes || !footnotes.length) return '';
      var html = '<div class="instruction-footnotes">' +
        '<div class="instruction-footnotes-label">Примечания</div>' +
        '<ul class="instruction-footnotes-list">';
      for (var i = 0; i < footnotes.length; i++) {
        var fn = footnotes[i];
        html += '<li class="instruction-footnote-item">' +
          '<span class="instruction-footnote-marker">' + escapeHtml(String(fn.marker || '')) + '</span>' +
          '<span class="instruction-footnote-text">' + escapeHtml(String(fn.text || '')) + '</span>' +
          '</li>';
      }
      html += '</ul></div>';
      return html;
    }

    // ── End Presentation Layer Helpers ────────────────────────────────────────

    function formatInstructionNodeLabel(node, fallbackTitle) {
      var title = String((node && node.title) || fallbackTitle || '').trim();
      var number = String((node && node.number) || '').trim();
      if (!number) return title;
      if (!title) return number;
      if (/^приложение/i.test(number) || /^[ivxlcdm]+$/i.test(number) || /^\d+(\.\d+)*$/.test(number)) {
        return number + '. ' + title;
      }
      return number + ' ' + title;
    }

    function getInstructionNodeTypeLabel(type) {
      if (type === 'document') return 'документ';
      if (type === 'chapter') return 'глава';
      if (type === 'section') return 'раздел';
      if (type === 'subsection') return 'раздел';
      if (type === 'point') return 'пункт';
      if (type === 'subpoint') return 'подпункт';
      if (type === 'item') return 'элемент';
      return '';
    }

    function splitTextIntoSearchLines(text) {
      var source = normalizeInstructionTextBlock(text);
      if (!source) return [];
      var rawLines = source.split('\n');
      var lines = [];
      for (var i = 0; i < rawLines.length; i++) {
        var line = String(rawLines[i] || '').replace(/\s+/g, ' ').trim();
        if (!line) continue;
        lines.push(line);
      }
      return lines;
    }

    function buildSearchSnippet(text, queryTerms, options) {
      var opts = options || {};
      var minLines = Math.max(2, Math.min(5, parseInt(opts.minLines, 10) || 2));
      var maxLines = Math.max(minLines, Math.min(8, parseInt(opts.maxLines, 10) || 5));
      var lines = splitTextIntoSearchLines(text);
      if (!lines.length) return '';
      if (lines.length <= maxLines) {
        return lines.join('\n');
      }

      var matchLineIndex = -1;
      for (var i = 0; i < lines.length; i++) {
        var lineNorm = normalizeSearchText(lines[i]);
        for (var t = 0; t < queryTerms.length; t++) {
          if (lineNorm.indexOf(queryTerms[t]) !== -1) {
            matchLineIndex = i;
            break;
          }
        }
        if (matchLineIndex !== -1) break;
      }

      var start = 0;
      if (matchLineIndex > 0) {
        start = Math.max(0, matchLineIndex - 1);
      }
      var end = Math.min(lines.length, start + maxLines);
      if ((end - start) < minLines) {
        start = Math.max(0, end - minLines);
      }
      return lines.slice(start, end).join('\n');
    }

    function highlightSearchText(text, query) {
      var terms = splitSearchTerms(query);
      if (!terms.length) return escapeHtml(text);
      var html = escapeHtml(text);
      for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        if (term.length < 2) continue;
        var rx = new RegExp('(' + escapeRegExpText(term) + ')', 'gi');
        html = html.replace(rx, '<mark class="search-highlight">$1</mark>');
      }
      return html;
    }

    function createTokenLookup(tokens) {
      var lookup = {};
      for (var i = 0; i < (tokens || []).length; i++) {
        var token = tokens[i];
        if (!token) continue;
        lookup[token] = 1;
      }
      return lookup;
    }

    function mergeTokenLookups(target, source) {
      var out = target || {};
      var keys = Object.keys(source || {});
      for (var i = 0; i < keys.length; i++) {
        out[keys[i]] = 1;
      }
      return out;
    }

    function getPreparedSearchDocsKey(searchDocs) {
      if (!searchDocs || !searchDocs.length) return 'empty';
      var first = searchDocs[0];
      var last = searchDocs[searchDocs.length - 1];
      return [
        searchDocs.length,
        first ? (first.id || '') : '',
        last ? (last.id || '') : '',
        first ? (first.searchVersion || '0') : '0'
      ].join('::');
    }

    function prepareSearchDoc(doc) {
      var titleText = normalizeInstructionTextBlock(
        [
          doc.instructionTitle || '',
          doc.sectionTitle || '',
          doc.sectionRef || ''
        ].join(' ')
      );
      var pathText = normalizeInstructionTextBlock(doc.path || '');
      var bodyText = normalizeInstructionTextBlock(doc.body || doc.answerText || doc.text || '');
      var titleTokens = splitSearchTerms(titleText, { minLength: 1, keepStopWords: true });
      var pathTokens = splitSearchTerms(pathText, { minLength: 1, keepStopWords: true });
      var bodyTokens = splitSearchTerms(bodyText, { minLength: 1, keepStopWords: true });
      var titleStems = buildTokenStems(titleTokens);
      var pathStems = buildTokenStems(pathTokens);
      var bodyStems = buildTokenStems(bodyTokens);
      var allTokens = uniqueArray(titleTokens.concat(pathTokens, bodyTokens));
      var allStems = uniqueArray(titleStems.concat(pathStems, bodyStems));
      var titleTokenLookup = createTokenLookup(titleTokens);
      var bodyTokenLookup = createTokenLookup(bodyTokens);
      var pathTokenLookup = createTokenLookup(pathTokens);
      var titleStemLookup = createTokenLookup(titleStems);
      var bodyStemLookup = createTokenLookup(bodyStems);
      var pathStemLookup = createTokenLookup(pathStems);

      return {
        raw: doc,
        instructionId: doc.instructionId,
        instructionTitle: doc.instructionTitle || '',
        sectionId: doc.sectionId,
        sectionTitle: doc.sectionTitle || '',
        sectionRef: doc.sectionRef || '',
        sectionType: doc.sectionType || '',
        entityType: doc.entityType || inferSearchEntityType(doc.sectionType, doc.sectionTitle, bodyText),
        isPointLike: !!doc.isPointLike,
        depth: parseInt(doc.depth, 10) || 0,
        path: pathText,
        titleText: titleText,
        bodyText: bodyText,
        answerText: normalizeInstructionTextBlock(doc.answerText || bodyText),
        titleNormalized: normalizeSearchText(titleText),
        pathNormalized: normalizeSearchText(pathText),
        bodyNormalized: normalizeSearchText(bodyText),
        normalized: normalizeSearchText([titleText, pathText, bodyText].join(' ')),
        titleTokens: titleTokens,
        pathTokens: pathTokens,
        bodyTokens: bodyTokens,
        titleStems: titleStems,
        pathStems: pathStems,
        bodyStems: bodyStems,
        allTokens: allTokens,
        allStems: allStems,
        titleTokenLookup: titleTokenLookup,
        bodyTokenLookup: bodyTokenLookup,
        pathTokenLookup: pathTokenLookup,
        titleStemLookup: titleStemLookup,
        bodyStemLookup: bodyStemLookup,
        pathStemLookup: pathStemLookup,
        allTokenLookup: mergeTokenLookups(mergeTokenLookups({}, createTokenLookup(allTokens)), createTokenLookup(allStems)),
        titleGramSet: buildTextChargramSet(uniqueArray(titleStems.concat(titleTokens)), 220),
        pathGramSet: buildTextChargramSet(uniqueArray(pathStems.concat(pathTokens)), 180),
        bodyGramSet: buildTextChargramSet(uniqueArray(bodyStems.concat(bodyTokens)), 380),
        allGramSet: buildTextChargramSet(uniqueArray(allStems.concat(allTokens)), 520),
        fuzzyStemCandidates: uniqueArray(titleStems.concat(pathStems, bodyStems)).slice(0, 240),
        hasNumericNorm: !!doc.hasNumericNorm || /\b\d{1,3}\s*(?:км\/ч|кмч|км ч|процент|%|мм|м|ч)\b/.test(normalizeSearchText(bodyText)),
        hasSpeedNorm: !!doc.hasSpeedNorm || /\b\d{1,3}\s*(?:км\/ч|кмч|км ч)\b/.test(normalizeSearchText(bodyText))
      };
    }

    function ensurePreparedSearchDocs() {
      var key = getPreparedSearchDocsKey(instructionsStore.searchDocs);
      if (
        instructionsStore.preparedSearchDocsKey === key &&
        instructionsStore.preparedSearchDocs &&
        instructionsStore.preparedSearchDocs.length === instructionsStore.searchDocs.length
      ) {
        return instructionsStore.preparedSearchDocs;
      }

      var prepared = [];
      for (var i = 0; i < instructionsStore.searchDocs.length; i++) {
        prepared.push(prepareSearchDoc(instructionsStore.searchDocs[i]));
      }
      instructionsStore.preparedSearchDocs = prepared;
      instructionsStore.preparedSearchDocsKey = key;
      return prepared;
    }

    function scoreQueryTokenAgainstDoc(doc, tokenProfile) {
      var token = tokenProfile.token;
      var stem = tokenProfile.stem || token;
      var grams = tokenProfile.grams || [];
      var isNumeric = /^\d+$/.test(token);

      if (doc.titleTokenLookup[token] || doc.titleStemLookup[stem]) {
        return { matched: true, score: 320, bucket: 'title_exact', strong: true, title: true };
      }
      if (doc.pathTokenLookup[token] || doc.pathStemLookup[stem]) {
        return { matched: true, score: 260, bucket: 'path_exact', strong: true, title: true };
      }
      if (doc.bodyTokenLookup[token] || doc.bodyStemLookup[stem]) {
        return { matched: true, score: 190, bucket: 'body_exact', strong: true, title: false };
      }

      if (!isNumeric && stem.length >= 2) {
        if (hasPrefixMatch(doc.titleStems, stem) || hasPrefixMatch(doc.pathStems, stem)) {
          return { matched: true, score: 180, bucket: 'title_prefix', strong: true, title: true };
        }
        if (hasPrefixMatch(doc.bodyStems, stem)) {
          return { matched: true, score: 130, bucket: 'body_prefix', strong: false, title: false };
        }
      }

      if (grams.length) {
        var titleGramScore = Math.max(
          computeChargramOverlapScore(grams, doc.titleGramSet),
          computeChargramOverlapScore(grams, doc.pathGramSet)
        );
        var bodyGramScore = computeChargramOverlapScore(grams, doc.bodyGramSet);
        if (titleGramScore >= 0.62) {
          return { matched: true, score: Math.round(120 + titleGramScore * 90), bucket: 'title_fuzzy', strong: false, title: true };
        }
        if (bodyGramScore >= 0.62) {
          return { matched: true, score: Math.round(90 + bodyGramScore * 70), bucket: 'body_fuzzy', strong: false, title: false };
        }
      }

      if (!isNumeric && stem.length >= 4) {
        var maxDistance = stem.length >= 7 ? 2 : 1;
        var bestDist = bestFuzzyStemDistance(stem, doc.fuzzyStemCandidates, maxDistance);
        if (bestDist <= maxDistance) {
          return {
            matched: true,
            score: bestDist === 1 ? 95 : 70,
            bucket: 'edit_fuzzy',
            strong: false,
            title: false
          };
        }
      }

      return { matched: false, score: 0, bucket: 'none', strong: false, title: false };
    }

    function getQueryProximityScore(doc, queryProfile) {
      var stems = queryProfile.stems || [];
      if (stems.length < 2) return 0;
      var body = doc.bodyNormalized || '';
      if (!body) return 0;
      var positions = [];
      for (var i = 0; i < stems.length && i < 5; i++) {
        var idx = body.indexOf(stems[i]);
        if (idx >= 0) positions.push(idx);
      }
      if (positions.length < 2) return 0;
      positions.sort(function(a, b) { return a - b; });
      var span = positions[positions.length - 1] - positions[0];
      if (span <= 100) return 160;
      if (span <= 220) return 110;
      if (span <= 360) return 55;
      return 20;
    }

    function evaluatePreparedSearchDoc(doc, queryProfile) {
      var tokenProfiles = queryProfile.tokenProfiles || [];
      if (!tokenProfiles.length) return null;

      var score = 0;
      var matchedTokens = 0;
      var strongMatches = 0;
      var titleMatches = 0;
      var fuzzyMatches = 0;

      for (var i = 0; i < tokenProfiles.length; i++) {
        var tokenResult = scoreQueryTokenAgainstDoc(doc, tokenProfiles[i]);
        if (!tokenResult.matched) continue;
        matchedTokens += 1;
        score += tokenResult.score;
        if (tokenResult.strong) strongMatches += 1;
        if (tokenResult.title) titleMatches += 1;
        if (tokenResult.bucket.indexOf('fuzzy') !== -1) fuzzyMatches += 1;
      }

      var coverage = matchedTokens / tokenProfiles.length;
      if (tokenProfiles.length <= 2 && matchedTokens === 0) return null;
      if (tokenProfiles.length >= 3 && coverage < 0.45 && strongMatches === 0) {
        var gramCoverage = computeChargramOverlapScore(queryProfile.chargrams || [], doc.allGramSet);
        if (gramCoverage < 0.4) return null;
        score += Math.round(gramCoverage * 120);
      }

      var normalizedQuery = queryProfile.normalized || '';
      var phraseInTitle = normalizedQuery.length >= 3 && doc.titleNormalized.indexOf(normalizedQuery) !== -1;
      var phraseInPath = normalizedQuery.length >= 3 && doc.pathNormalized.indexOf(normalizedQuery) !== -1;
      var phraseInBodyIndex = normalizedQuery.length >= 3 ? doc.bodyNormalized.indexOf(normalizedQuery) : -1;

      if (phraseInTitle) score += 520;
      if (phraseInPath) score += 360;
      if (phraseInBodyIndex === 0) score += 330;
      else if (phraseInBodyIndex > 0) score += Math.max(130, 290 - Math.min(phraseInBodyIndex, 320));

      score += Math.round(coverage * 380);
      score += strongMatches * 70;
      score += titleMatches * 95;
      score -= fuzzyMatches * 6;
      score += getQueryProximityScore(doc, queryProfile);

      if (queryProfile.wantsSpeedNorm && doc.hasSpeedNorm) score += 230;
      if (queryProfile.wantsNumericNorm && doc.hasNumericNorm) score += 150;
      if (queryProfile.wantsDefinition && doc.entityType === 'definition') score += 190;
      if (queryProfile.wantsProcedure && doc.entityType === 'procedure') score += 140;
      if (queryProfile.wantsRule && (doc.entityType === 'rule' || doc.entityType === 'procedure')) score += 120;
      if (doc.isPointLike) score += 55;

      var headingTokenCoverage = tokenProfiles.length
        ? (titleMatches / tokenProfiles.length)
        : 0;
      var confidence = Math.max(0, Math.min(1,
        coverage * 0.52 +
        Math.min(0.3, strongMatches * 0.1) +
        Math.min(0.18, headingTokenCoverage * 0.3) +
        (phraseInTitle ? 0.2 : 0) +
        (phraseInBodyIndex >= 0 ? 0.08 : 0)
      ));
      var shouldShowFullByHeading = !!(doc.isPointLike && (phraseInTitle || titleMatches >= Math.max(1, Math.ceil(tokenProfiles.length * 0.5))));
      var snippet = buildSearchSnippet(doc.answerText || doc.bodyText || '', queryProfile.tokens, { minLines: 2, maxLines: 5 });

      return {
        instructionId: doc.instructionId,
        instructionTitle: doc.instructionTitle,
        sectionId: doc.sectionId,
        sectionTitle: doc.sectionTitle,
        sectionRef: doc.sectionRef || formatSearchNodeReference(doc.sectionType || '', ''),
        sectionType: doc.sectionType || '',
        entityType: doc.entityType || '',
        isPointLike: doc.isPointLike,
        path: doc.path || '',
        answerText: doc.answerText || doc.bodyText || '',
        answerIncludesHeading: doc.isPointLike,
        snippet: snippet,
        score: score,
        confidence: confidence,
        shouldShowFullByHeading: shouldShowFullByHeading,
        matchedTokens: matchedTokens,
        coverage: coverage,
        depth: doc.depth || 0,
        textIndex: phraseInBodyIndex < 0 ? 9999 : phraseInBodyIndex
      };
    }

    function markExpandedAnswerResults(results) {
      var expandedCount = 0;
      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        var isStrongAnswer = !!(
          item.shouldShowFullByHeading ||
          item.confidence >= 0.67 ||
          (item.coverage >= 0.72 && item.score >= 900)
        );
        var isExpandedAnswer = false;
        if (item.shouldShowFullByHeading) {
          isExpandedAnswer = true;
        } else if (expandedCount < 3 && isStrongAnswer) {
          isExpandedAnswer = true;
        } else if (expandedCount === 0 && i === 0) {
          isExpandedAnswer = true;
        }
        if (isExpandedAnswer) expandedCount += 1;
        item.isExpandedAnswer = isExpandedAnswer;
        item.displayText = isExpandedAnswer
          ? (item.answerText || item.snippet || item.sectionTitle || '')
          : (item.snippet || item.answerText || item.sectionTitle || '');
      }
      return results;
    }

    function performInstructionsSearch(query) {
      return [];
    }

    function setInstructionsSearchQuery(query) {
      instructionsStore.searchQuery = String(query || '');
      instructionsStore.view = 'list';
      if (instructionsStore.searchTimer) {
        window.clearTimeout(instructionsStore.searchTimer);
      }

      var normalizedQuery = normalizeSearchText(instructionsStore.searchQuery);
      if (!normalizedQuery) {
        instructionsStore.searchResults = [];
        instructionsStore.searchAnswer = null;
        renderInstructionsScreen();
        return;
      }

      instructionsStore.searchTimer = window.setTimeout(function() {
        instructionsStore.searchResults = performInstructionsSearch(instructionsStore.searchQuery);
        instructionsStore.searchAnswer = instructionsStore.searchResults.length ? instructionsStore.searchResults[0] : null;
        renderInstructionsScreen();
      }, 190);
    }

    function toDomSafeId(value) {
      return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    function normalizeInstructionParagraphs(content) {
      var text = String(content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      if (!text) return [];

      var chunks = text.split(/\n{2,}/);
      var paragraphs = [];
      for (var i = 0; i < chunks.length; i++) {
        var paragraph = String(chunks[i] || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
        if (!paragraph) continue;
        if (/^[-=_—–]{6,}$/.test(paragraph)) continue;
        paragraphs.push(paragraph);
      }
      return paragraphs;
    }

    function formatInstructionContentHtml(content, options) {
      var opts = options || {};
      var paragraphs = normalizeInstructionParagraphs(content);
      if (!paragraphs.length) {
        return '<p class="instruction-paragraph instruction-paragraph--muted">Текст раздела пока недоступен.</p>';
      }

      var isTruncated = false;
      if (opts.maxParagraphs && paragraphs.length > opts.maxParagraphs) {
        paragraphs = paragraphs.slice(0, opts.maxParagraphs);
        isTruncated = true;
      }

      var html = [];
      for (var i = 0; i < paragraphs.length; i++) {
        var paragraph = paragraphs[i];
        var classes = ['instruction-paragraph'];
        var pointMatch = paragraph.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.*)$/);

        if (pointMatch) {
          classes.push('instruction-paragraph--point');
          var numberLabel = escapeHtml(pointMatch[1] + '.');
          var pointBody = escapeHtml(pointMatch[2]).replace(/\n/g, '<br />');
          html.push(
            '<p class="' + classes.join(' ') + '">' +
              '<span class="instruction-point-number">' + numberLabel + '</span> ' +
              '<span class="instruction-point-text">' + pointBody + '</span>' +
            '</p>'
          );
          continue;
        }

        if (/^(?:Приложение\s+N\s*\d+|[IVXLCDM]+\.)/i.test(paragraph)) {
          classes.push('instruction-paragraph--heading');
        }
        html.push('<p class="' + classes.join(' ') + '">' + escapeHtml(paragraph).replace(/\n/g, '<br />') + '</p>');
      }

      if (isTruncated || opts.forceHint) {
        html.push('<p class="instruction-paragraph instruction-paragraph--hint">Откройте нужный пункт ниже, чтобы увидеть полный текст без перегруза.</p>');
      }

      return html.join('');
    }

    function scrollToInstructionNodeAnchor(sectionId) {
      var targetId = 'instruction-anchor-' + toDomSafeId(sectionId);
      var target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function normalizeNodeContentForDisplay(node, options) {
      var opts = options || {};
      if (!node) return '';
      var text = String(node.content || node.plainText || '').trim();
      if (!text) return '';

      var headingLabel = formatInstructionNodeLabel(node, '').trim();
      var titleOnly = String(node.title || '').trim();
      var textNorm = normalizeSearchText(text);
      var headingNorm = normalizeSearchText(headingLabel);
      var titleNorm = normalizeSearchText(titleOnly);

      if (opts.suppressDuplicateHeading) {
        if (titleNorm && textNorm === titleNorm) return '';
        if (headingNorm && textNorm === headingNorm) return '';
      }
      return text;
    }

    function buildPointLineText(node) {
      if (!node) return '';
      var number = String(node.number || '').trim();
      var body = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
      var fallback = String(node.title || '').trim();
      if (!body) body = fallback;
      if (!body && number) return number;
      if (!body) return '';
      var bodyNorm = normalizeSearchText(body);
      var numberNorm = normalizeSearchText(number);
      if (!number) return body;
      if (bodyNorm === numberNorm || bodyNorm.indexOf(numberNorm + ' ') === 0) {
        return body;
      }
      return number + ' ' + body;
    }

    function appendInlineChildPointLines(node, structure, out, includeSelfHeading) {
      if (!node || !structure || !out) return;

      if (includeSelfHeading) {
        var heading = formatInstructionNodeLabel(node, '').trim();
        var ownContent = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
        if (ownContent) {
          var ownNorm = normalizeSearchText(ownContent);
          var headingNorm = normalizeSearchText(heading);
          if (headingNorm && ownNorm.indexOf(headingNorm) === 0) {
            out.push(ownContent);
          } else if (heading) {
            out.push(heading + '\n' + ownContent);
          } else {
            out.push(ownContent);
          }
        } else if (heading) {
          out.push(heading);
        }
      } else {
        var pointLine = buildPointLineText(node);
        if (pointLine) out.push(pointLine);
      }

      var children = (structure.childrenByParent && structure.childrenByParent[node.id]) || [];
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (!child || !isInlineChildNode(child)) continue;
        appendInlineChildPointLines(child, structure, out, false);
      }
    }

    function buildPointContentWithInlineChildren(node, structure) {
      if (!node || !structure || !isPointLikeNode(node)) return '';
      var lines = [];
      appendInlineChildPointLines(node, structure, lines, true);
      return normalizeInstructionTextBlock(lines.join('\n'));
    }

    function isNodeContentSameAsHeading(node) {
      if (!node) return false;
      var text = String(node.content || node.plainText || '').trim();
      if (!text) return false;
      var headingLabel = formatInstructionNodeLabel(node, '').trim();
      var titleOnly = String(node.title || '').trim();
      var textNorm = normalizeSearchText(text);
      if (!textNorm) return false;
      if (titleOnly && textNorm === normalizeSearchText(titleOnly)) return true;
      if (headingLabel && textNorm === normalizeSearchText(headingLabel)) return true;
      return false;
    }

    function getInstructionNodeParent(structure, node) {
      if (!structure || !node || !node.parentId) return null;
      return structure.nodeById[node.parentId] || null;
    }

    function getInstructionNodePathNodes(structure, node, options) {
      var opts = options || {};
      if (!structure || !node) return [];
      var rootId = structure.root ? structure.root.id : '';
      var path = [];
      var current = node;
      var guard = 0;
      while (current && guard < 32) {
        if (current.id === rootId) {
          if (opts.includeRoot) path.push(current);
          break;
        }
        path.push(current);
        current = getInstructionNodeParent(structure, current);
        guard += 1;
      }
      path.reverse();
      return path;
    }

    function truncateInstructionLabel(text, maxLength) {
      var limit = Math.max(4, parseInt(maxLength, 10) || 28);
      var value = String(text || '').replace(/\s+/g, ' ').trim();
      if (!value) return '';
      if (value.length <= limit) return value;
      return value.slice(0, Math.max(1, limit - 1)).trim() + '…';
    }

    function buildCompactNodeNavLabel(node, maxLength) {
      if (!node) return '';
      var number = String(node.number || '').trim();
      var title = String(node.title || '').replace(/\s+/g, ' ').trim();
      var heading = formatInstructionNodeLabel(node, '').trim();
      var content = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
      var fallback = '';
      if (content) {
        fallback = String(content).replace(/\s+/g, ' ').trim();
      }

      if (title && number && normalizeSearchText(title) === normalizeSearchText(number)) {
        title = '';
      }
      if (!title && fallback) title = fallback;
      if (!title) title = heading;
      title = truncateInstructionLabel(title, maxLength || 24);

      if (!number) return title || 'Раздел';
      if (!title || normalizeSearchText(title) === normalizeSearchText(number)) return number;
      if (normalizeSearchText(title).indexOf(normalizeSearchText(number)) === 0) return title;
      return number + ' ' + title;
    }

    function buildInstructionSectionBreadcrumbHtml(instruction, structure, displayNode, focusedNode) {
      var parts = [];
      if (instruction && instruction.title) {
        parts.push({
          text: instruction.title,
          isCurrent: false
        });
      }

      var path = getInstructionNodePathNodes(structure, displayNode);
      for (var i = 0; i < path.length; i++) {
        parts.push({
          text: truncateInstructionLabel(formatInstructionNodeLabel(path[i], 'Раздел'), 44),
          isCurrent: false
        });
      }

      if (focusedNode && (!displayNode || focusedNode.id !== displayNode.id)) {
        parts.push({
          text: truncateInstructionLabel(buildCompactNodeNavLabel(focusedNode, 44), 44),
          isCurrent: true
        });
      } else if (parts.length) {
        parts[parts.length - 1].isCurrent = true;
      }

      var html = '';
      for (var p = 0; p < parts.length; p++) {
        if (p > 0) html += '<span class="instruction-breadcrumb-sep">→</span>';
        html += '<span class="instruction-breadcrumb-item' + (parts[p].isCurrent ? ' is-current' : '') + '">' + escapeHtml(parts[p].text) + '</span>';
      }
      return html;
    }

    function isPointLikeNode(node) {
      if (!node) return false;
      return node.type === 'point' || node.type === 'subpoint' || node.type === 'item';
    }

    function isInlineChildNode(node) {
      if (!node) return false;
      return node.type === 'subpoint' || node.type === 'item';
    }

    function shouldRenderSubpointInline(node, structure) {
      if (!isInlineChildNode(node)) return false;
      var parent = getInstructionNodeParent(structure, node);
      if (!parent) return true;
      if (isPointLikeNode(parent)) return true;
      return true;
    }

    function buildFocusedSubpointCalloutHtml(node) {
      if (!node) return '';
      var heading = String(node.number || '').trim();
      if (!heading) heading = buildCompactNodeNavLabel(node, 72);
      var content = normalizeNodeContentForDisplay(node, { suppressDuplicateHeading: true });
      var merged = heading;
      if (content) {
        var contentNorm = normalizeSearchText(content);
        var headingNorm = normalizeSearchText(heading);
        if (!merged) {
          merged = content;
        } else if (contentNorm && contentNorm !== headingNorm && contentNorm.indexOf(headingNorm) !== 0) {
          merged += ' ' + content;
        }
      }
      return '<div class="instruction-focus-callout">' +
        '<div class="instruction-focus-kicker">' + (node.type === 'item' ? 'Текущий элемент' : 'Текущий подпункт') + '</div>' +
        '<div class="instruction-focus-text">' + escapeHtml(merged).replace(/\n/g, '<br />') + '</div>' +
      '</div>';
    }

    function openInstructionDetail(instructionId) {
      if (!findInstructionById(instructionId)) return;
      instructionsStore.selectedInstructionId = instructionId;
      instructionsStore.selectedSectionId = '';
      instructionsStore.view = 'detail';
      renderInstructionsScreen();
    }

    function openInstructionSection(instructionId, sectionId) {
      var instruction = findInstructionById(instructionId);
      if (!instruction) return;
      var section = findInstructionNodeById(instruction, sectionId);
      if (!section) return;
      instructionsStore.selectedInstructionId = instructionId;
      instructionsStore.selectedSectionId = sectionId;
      instructionsStore.view = 'section';
      renderInstructionsScreen();
    }

    function getInstructionNodeCounters(instruction) {
      var structure = getInstructionStructure(instruction);
      var counters = {
        structural: 0,
        points: 0
      };
      for (var i = 0; i < structure.traversal.length; i++) {
        var node = structure.traversal[i].node;
        if (!node || node.type === 'document') continue;
        if (isPointLikeNode(node)) counters.points += 1;
        else counters.structural += 1;
      }
      return counters;
    }

    function renderInstructionsCards(isPaywalled) {
      var listEl = document.getElementById('instructionsCards');
      if (!listEl) return;
      var items = instructionsStore.instructions.length
        ? instructionsStore.instructions
        : getInstructionsPreviewSeed();
      if (!items.length) {
        listEl.innerHTML = '';
        return;
      }

      var html = '';
      for (var i = 0; i < items.length; i++) {
        var instruction = items[i];
        var counters = getInstructionNodeCounters(instruction);
        var metaText = 'Содержание внутри';
        if (counters.structural || counters.points) {
          metaText = counters.structural + ' разделов';
          if (counters.points) {
            metaText += ' · ' + counters.points + ' пунктов';
          }
        }
        html += '<button class="instruction-card" type="button" data-action="open-instruction" data-instruction-id="' + escapeHtml(instruction.id) + '">' +
          '<div class="instruction-card-title">' + escapeHtml(instruction.title) + '</div>' +
          '<div class="instruction-card-description">' + escapeHtml(instruction.shortDescription || '') + '</div>' +
          '<div class="instruction-card-meta">' + escapeHtml(metaText) + '</div>' +
        '</button>';
      }
      listEl.innerHTML = html;

      if (isPaywalled) {
        var query = document.getElementById('instructionsSearchInput');
        if (query) query.value = '';
      }
    }

    function renderInstructionsSearchResults() {
      var resultsEl = document.getElementById('instructionsSearchResults');
      var answerEl = document.getElementById('instructionsAnswerCard');
      if (!resultsEl || !answerEl) return;
      if (!instructionsStore.searchResults.length) {
        resultsEl.innerHTML = '';
        answerEl.innerHTML = '';
        answerEl.classList.add('hidden');
        return;
      }

      var topAnswer = instructionsStore.searchResults[0] || null;
      if (topAnswer) {
        // Prefer the clean one-sentence summary over the raw multi-paragraph previewText.
        var topPreview = (topAnswer.summary && topAnswer.summary.length > 20 ? topAnswer.summary : null)
          || topAnswer.snippet || topAnswer.displayText || '';
        // Hide sectionTitle when it duplicates what the preview already says.
        var sectionTitleNorm = (topAnswer.sectionTitle || '').toLowerCase().slice(0, 60);
        var previewNorm = topPreview.toLowerCase().slice(0, 60);
        var titleDuplicatesPreview = sectionTitleNorm && previewNorm.indexOf(sectionTitleNorm) !== -1;
        var answerSection = (topAnswer.sectionTitle && !titleDuplicatesPreview)
          ? '<div class="search-result-section">' + highlightSearchText(topAnswer.sectionTitle, instructionsStore.searchQuery) + '</div>'
          : '';
        // Use previewLines when available — they give the answer at a glance
        var answerBodyHtml;
        if (topAnswer.previewLines && topAnswer.previewLines.length >= 2) {
          answerBodyHtml = '<div class="search-answer-norms">' +
            buildNormListHtml(topAnswer.previewLines.slice(0, 6), instructionsStore.searchQuery) +
            '</div>';
        } else {
          answerBodyHtml = '<div class="search-answer-preview">' +
            highlightSearchText(topPreview, instructionsStore.searchQuery) +
            '</div>';
        }
        answerEl.innerHTML =
          '<button class="search-answer-card" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(topAnswer.instructionId) + '" data-section-id="' + escapeHtml(topAnswer.sectionId) + '">' +
            '<div class="search-answer-kicker">Наиболее вероятный ответ</div>' +
            '<div class="search-result-top">' +
              '<span class="search-result-instruction">' + escapeHtml(topAnswer.instructionTitle) + '</span>' +
              (topAnswer.sectionRef ? '<span class="search-result-point">' + escapeHtml(topAnswer.sectionRef) + '</span>' : '') +
            '</div>' +
            answerSection +
            answerBodyHtml +
            '<div class="search-answer-actions">' +
              '<span class="search-answer-action-btn">Открыть пункт</span>' +
            '</div>' +
          '</button>';
        answerEl.classList.remove('hidden');
      } else {
        answerEl.innerHTML = '';
        answerEl.classList.add('hidden');
      }

      var html = '';
      for (var i = 1; i < instructionsStore.searchResults.length; i++) {
        var item = instructionsStore.searchResults[i];
        var cardClass = 'search-result-card' + (item.isExpandedAnswer ? ' is-answer' : '');
        var showSectionTitle = !!item.sectionTitle && !(item.isExpandedAnswer && item.answerIncludesHeading);
        // For secondary results: show previewLines (compact, 3 items) or snippet
        var snippetHtml;
        if (item.previewLines && item.previewLines.length >= 2) {
          snippetHtml = '<div class="search-result-norms">' +
            buildNormListHtml(item.previewLines.slice(0, 3), instructionsStore.searchQuery) +
            '</div>';
        } else {
          var snippetText = (item.summary && item.summary.length > 20 ? item.summary : null)
            || item.snippet || item.displayText || '';
          snippetHtml = '<div class="search-result-snippet' + (item.isExpandedAnswer ? ' is-expanded' : '') + '">' +
            highlightSearchText(snippetText, instructionsStore.searchQuery) +
            '</div>';
        }
        html += '<button class="' + cardClass + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(item.instructionId) + '" data-section-id="' + escapeHtml(item.sectionId) + '">' +
          '<div class="search-result-top">' +
            '<span class="search-result-instruction">' + escapeHtml(item.instructionTitle) + '</span>' +
            (item.sectionRef ? '<span class="search-result-point">' + escapeHtml(item.sectionRef) + '</span>' : '') +
          '</div>' +
          (showSectionTitle
            ? '<div class="search-result-section">' + highlightSearchText(item.sectionTitle, instructionsStore.searchQuery) + '</div>'
            : '') +
          snippetHtml +
        '</button>';
      }
      resultsEl.innerHTML = html;
    }

    function renderInstructionDetailScreen() {
      var titleEl = document.getElementById('instructionDetailTitle');
      var descriptionEl = document.getElementById('instructionDetailDescription');
      var sectionsEl = document.getElementById('instructionSectionsList');
      var quickNavEl = document.getElementById('instructionDetailQuickNav');
      if (!titleEl || !descriptionEl || !sectionsEl || !quickNavEl) return;

      var instruction = findInstructionById(instructionsStore.selectedInstructionId);
      if (!instruction) {
        instructionsStore.view = 'list';
        return;
      }

      titleEl.textContent = instruction.title || '';
      descriptionEl.textContent = instruction.shortDescription || '';

      var structure = getInstructionStructure(instruction);
      var rootId = structure.root ? structure.root.id : '';
      var html = '';
      for (var i = 0; i < structure.traversal.length; i++) {
        var entry = structure.traversal[i];
        var section = entry.node;
        if (!section || section.id === rootId || isPointLikeNode(section)) continue;
        var depthClass = ' instruction-section-depth-' + Math.min(6, Math.max(1, entry.depth));
        var label = formatInstructionNodeLabel(section, 'Раздел');
        var childCount = (structure.childrenByParent[section.id] || []).length;
        var metaParts = [];
        if (section.type) metaParts.push(getInstructionNodeTypeLabel(section.type));
        if (childCount) metaParts.push(childCount + ' подпунктов');
        html += '<button class="instruction-section-item' + depthClass + '" id="instruction-anchor-' + escapeHtml(toDomSafeId(section.id)) + '" data-node-anchor="' + escapeHtml(section.id) + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(instruction.id) + '" data-section-id="' + escapeHtml(section.id) + '">' +
          '<span class="instruction-section-item-title">' + escapeHtml(label) + '</span>' +
          '<span class="instruction-section-item-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>' +
        '</button>';
      }

      sectionsEl.innerHTML = html || '<div class="instructions-state">Разделы пока не загружены.</div>';

      var topNodes = structure.childrenByParent[rootId] || [];
      var quickNavHtml = '';
      for (var q = 0; q < topNodes.length; q++) {
        var node = topNodes[q];
        if (!node || isPointLikeNode(node)) continue;
        var fullLabel = formatInstructionNodeLabel(node, 'Раздел');
        var chipLabel = buildCompactNodeNavLabel(node, 26) || ('Раздел ' + (q + 1));
        quickNavHtml += '<button class="instruction-detail-jump-btn" type="button" data-action="scroll-node" data-section-id="' + escapeHtml(node.id) + '" title="' + escapeHtml(fullLabel) + '">' + escapeHtml(chipLabel) + '</button>';
      }
      quickNavEl.innerHTML = quickNavHtml;
      quickNavEl.classList.toggle('hidden', !quickNavHtml);
    }

    function renderInstructionSectionScreen() {
      var breadcrumbEl = document.getElementById('instructionSectionBreadcrumb');
      var sectionTitleEl = document.getElementById('instructionSectionTitle');
      var sectionMetaEl = document.getElementById('instructionSectionMeta');
      var quickJumpEl = document.getElementById('instructionQuickJump');
      var contentEl = document.getElementById('instructionSectionContent');
      var childNodesEl = document.getElementById('instructionChildNodes');
      if (!sectionTitleEl || !sectionMetaEl || !quickJumpEl || !contentEl) return;

      var instruction = findInstructionById(instructionsStore.selectedInstructionId);
      if (!instruction) {
        instructionsStore.view = 'list';
        return;
      }
      var structure = getInstructionStructure(instruction);
      var requestedSection = findInstructionNodeById(instruction, instructionsStore.selectedSectionId);
      if (!requestedSection) {
        instructionsStore.view = 'detail';
        return;
      }

      var displaySection = requestedSection;
      var focusedSubpoint = null;
      var requestedParent = getInstructionNodeParent(structure, requestedSection);
      if (isInlineChildNode(requestedSection) && requestedParent) {
        focusedSubpoint = requestedSection;
        if (shouldRenderSubpointInline(requestedSection, structure)) {
          displaySection = requestedParent;
          while (displaySection && isInlineChildNode(displaySection)) {
            var upperParent = getInstructionNodeParent(structure, displaySection);
            if (!upperParent) break;
            displaySection = upperParent;
          }
          if (isPointLikeNode(displaySection)) {
            focusedSubpoint = null;
          }
        }
      }

      var children = structure.childrenByParent[displaySection.id] || [];
      var hasChildren = !!children.length;
      var isHeadingDuplicate = isNodeContentSameAsHeading(displaySection);
      var headingLabel = formatInstructionNodeLabel(displaySection, instruction.title || '');
      if (
        isHeadingDuplicate &&
        !hasChildren &&
        displaySection.type === 'point' &&
        displaySection.number
      ) {
        sectionTitleEl.textContent = String(displaySection.number).trim();
      } else {
        sectionTitleEl.textContent = headingLabel;
      }

      var metaParts = [instruction.title];
      if (displaySection.type) metaParts.push(getInstructionNodeTypeLabel(displaySection.type));
      if (focusedSubpoint) metaParts.push(focusedSubpoint.type === 'item' ? 'контекст элемента' : 'контекст подпункта');
      if (instruction.version) metaParts.push(instruction.version);
      sectionMetaEl.textContent = metaParts.join(' · ');

      var breadcrumbHtml = buildInstructionSectionBreadcrumbHtml(
        instruction,
        structure,
        displaySection,
        focusedSubpoint
      );
      if (breadcrumbEl) {
        breadcrumbEl.innerHTML = breadcrumbHtml;
        breadcrumbEl.classList.toggle('hidden', !breadcrumbHtml);
      }

      var jumpNodes = [];
      var activeJumpId = requestedSection.id;
      if (focusedSubpoint && displaySection.id !== requestedSection.id) {
        for (var c = 0; c < children.length; c++) {
          var childNode = children[c];
          if (!childNode || !isPointLikeNode(childNode)) continue;
          jumpNodes.push(childNode);
        }
      } else {
        var parentId = displaySection.parentId && structure.nodeById[displaySection.parentId]
          ? displaySection.parentId
          : (structure.root ? structure.root.id : '');
        var siblings = structure.childrenByParent[parentId] || [];
        for (var i = 0; i < siblings.length; i++) {
          var jumpSection = siblings[i];
          if (!jumpSection) continue;
          var currentIsPointLike = isPointLikeNode(displaySection);
          var siblingIsPointLike = isPointLikeNode(jumpSection);
          if (!currentIsPointLike && siblingIsPointLike) continue;
          jumpNodes.push(jumpSection);
        }
        activeJumpId = displaySection.id;
      }

      var jumpHtml = '';
      for (var j = 0; j < jumpNodes.length; j++) {
        var navNode = jumpNodes[j];
        var activeClass = navNode.id === activeJumpId ? ' is-active' : '';
        var fullLabel = formatInstructionNodeLabel(navNode, 'Раздел');
        var compactLabel = buildCompactNodeNavLabel(
          navNode,
          isInlineChildNode(navNode) ? 18 : 24
        );
        jumpHtml += '<button class="instruction-jump-btn' + activeClass + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(instruction.id) + '" data-section-id="' + escapeHtml(navNode.id) + '" title="' + escapeHtml(fullLabel) + '">' + escapeHtml(compactLabel) + '</button>';
      }
      quickJumpEl.innerHTML = jumpHtml;
      quickJumpEl.classList.toggle('hidden', !jumpHtml);

      var shouldInlinePointChildren = isPointLikeNode(displaySection);
      if (childNodesEl) {
        if (!children.length || shouldInlinePointChildren) {
          childNodesEl.innerHTML = '';
          childNodesEl.classList.add('hidden');
        } else {
          var showSubpoints = isPointLikeNode(displaySection) || (focusedSubpoint && requestedParent && isPointLikeNode(requestedParent));
          var childHeader = showSubpoints ? 'Подпункты и элементы' : 'Подразделы и пункты';
          var childHtml = '<div class="section-header">' + childHeader + '</div>';
          for (var ch = 0; ch < children.length; ch++) {
            var child = children[ch];
            var isActiveChild = !!(focusedSubpoint && child.id === focusedSubpoint.id);
            var fullChildLabel = formatInstructionNodeLabel(child, 'Пункт');
            var compactChildLabel = buildCompactNodeNavLabel(child, isInlineChildNode(child) ? 64 : 84);
            childHtml += '<button class="instruction-child-item' + (isActiveChild ? ' is-active' : '') + '" type="button" data-action="open-section" data-instruction-id="' + escapeHtml(instruction.id) + '" data-section-id="' + escapeHtml(child.id) + '" title="' + escapeHtml(fullChildLabel) + '">' +
              '<span class="instruction-child-title">' + escapeHtml(compactChildLabel) + '</span>' +
              '<span class="instruction-child-meta">' + escapeHtml(getInstructionNodeTypeLabel(child.type)) + '</span>' +
            '</button>';
          }
          childNodesEl.innerHTML = childHtml;
          childNodesEl.classList.remove('hidden');
        }
      }

      var hasVisibleChildren = childNodesEl && !childNodesEl.classList.contains('hidden');
      var shouldCompactText = hasChildren && !isPointLikeNode(displaySection);
      if (focusedSubpoint) shouldCompactText = false;
      var contentText = shouldInlinePointChildren
        ? buildPointContentWithInlineChildren(displaySection, structure)
        : normalizeNodeContentForDisplay(displaySection, {
            suppressDuplicateHeading: hasVisibleChildren
          });
var contentHtml = formatInstructionNodeContentHtml(
  displaySection,
  shouldCompactText ? { maxParagraphs: 2, forceHint: true } : {}
);

      var contextHtml = '';
      if (focusedSubpoint) {
        if (displaySection.id === requestedSection.id && requestedParent) {
          var parentLabel = formatInstructionNodeLabel(requestedParent, 'Пункт');
          contextHtml += '<div class="instruction-parent-context">' +
            '<div class="instruction-parent-context-label">Родительский пункт</div>' +
            '<div class="instruction-parent-context-value">' + escapeHtml(truncateInstructionLabel(parentLabel, 140)) + '</div>' +
          '</div>';
        }
        contextHtml += buildFocusedSubpointCalloutHtml(focusedSubpoint);
      }

      // Presentation layer: previewLines block + footnotes
      // Use the assembled body (includes child node text) for point-type nodes
      // so that enumerated items stored as child nodes are visible to the parser.
      var presentationHtml = '';
      var footnotesHtml = '';

      // Show norm list OR raw text — not both. Footnotes always appear separately.
      var bodyHtml = presentationHtml || contentHtml;
      contentEl.innerHTML = contextHtml + bodyHtml + footnotesHtml;
    }
