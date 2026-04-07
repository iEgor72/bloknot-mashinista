(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  // Fixed emoji markers — no random emojis, only these 7
  var MARKERS = {
    speed:       '🚄',
    restriction: '⚠️',
    danger:      '🛑',
    coupling:    '🔗',
    people:      '👥',
    condition:   '📍',
    note:        'ℹ️'
  };

  // ---------------------------------------------------------------------------
  // Footnote extraction
  // Separates inline <N> reference markers from footnote definition blocks.
  // Returns { clean: text without footnotes, footnotes: [{marker, text}] }
  // ---------------------------------------------------------------------------
  function extractFootnotes(text) {
    if (!text) return { clean: '', footnotes: [] };

    var footnotes = [];
    var fnSectionStart = -1;

    // Footnote definitions appear as "\n\n<N> text" after the main body.
    // Find the first such occurrence to split main body from footnotes.
    var scanRe = /\n\n(<\d+>)/g;
    var m = scanRe.exec(text);
    if (m) {
      fnSectionStart = m.index;
    }

    var mainText = fnSectionStart >= 0 ? text.slice(0, fnSectionStart) : text;
    var fnSection = fnSectionStart >= 0 ? text.slice(fnSectionStart) : '';

    // Parse individual footnote definitions from the footnote block
    if (fnSection) {
      var fnRe = /(<\d+>)\s*([^\n<][^\n]*(?:\n(?!<\d+>)[^\n]*)*)/g;
      var fm;
      while ((fm = fnRe.exec(fnSection)) !== null) {
        var content = fm[2].replace(/\s+/g, ' ').trim();
        if (content && content.length > 8) {
          footnotes.push({ marker: fm[1], text: content });
        }
      }
    }

    // Remove inline reference markers like <1> from the main text
    var clean = mainText.replace(/<\d+>/g, '').replace(/  +/g, ' ').replace(/ +\n/g, '\n').trim();

    return { clean: clean, footnotes: footnotes };
  }

  // ---------------------------------------------------------------------------
  // Display mode detection
  // ---------------------------------------------------------------------------
  function detectDisplayMode(cleanText) {
    if (!cleanText) return 'plain';
    var hasNumberedItems = /(?:^|\n)\s*\d+\)\s+\S/.test(cleanText);
    var hasLetterItems   = /(?:^|\n)\s*[а-яёa-z]\)\s+\S/i.test(cleanText);
    var hasSpeedNorms    = /\d{1,3}\s*км\s*[\/\\]?\s*ч/i.test(cleanText);
    var lc = cleanText.toLowerCase();
    if (hasNumberedItems || hasLetterItems || hasSpeedNorms) return 'rule-list';
    if (/(определен|термин|под\s+.{1,20}\s+понима|называется|понимается)/.test(lc)) return 'definition';
    if (/(порядок\s+|действи[яе]\s|следует\s+|необходимо\s+)/.test(lc)) return 'procedure';
    return 'plain';
  }

  // ---------------------------------------------------------------------------
  // Enumerated item parser — 1), 2) or а), б)
  // ---------------------------------------------------------------------------
  function parseEnumeratedItems(text) {
    if (!text) return [];
    var items = [];
    var m;

    // Try numbered first: 1), 2), 3)
    var re1 = /(?:^|\n)\s*(\d+)\)\s*([^\n]+)/g;
    var found = false;
    while ((m = re1.exec(text)) !== null) {
      found = true;
      items.push({ number: m[1] + ')', text: m[2].replace(/\s+/g, ' ').trim() });
    }
    if (found) return items;

    // Russian letter items: а), б), в) …
    var re2 = /(?:^|\n)\s*([а-яё])\)\s*([^\n]+)/gi;
    while ((m = re2.exec(text)) !== null) {
      items.push({ number: m[1].toLowerCase() + ')', text: m[2].replace(/\s+/g, ' ').trim() });
    }
    return items;
  }

  // ---------------------------------------------------------------------------
  // Emoji marker assignment (strict rules, no random emojis)
  // ---------------------------------------------------------------------------
  function assignMarker(text) {
    if (!text) return MARKERS.note;
    var t = text.toLowerCase();
    // No \b around Cyrillic — it's not in \w class in JS regex
    if (/\d{1,3}\s*км\s*[\/\\]?\s*ч/.test(t))                return MARKERS.speed;
    if (/(запрещ|нельзя|не допуск|опасн|не разреш)/.test(t)) return MARKERS.danger;
    if (/(не более|ограничен|осторожн|особой осторожн)/.test(t)) return MARKERS.restriction;
    if (/(сцеплен|отцеп|соединен|вагон[а-я]* вперед)/.test(t)) return MARKERS.coupling;
    if (/(пассаж|людьми|проводник|вагон[а-я]* с людьми)/.test(t)) return MARKERS.people;
    if (/^(при\s|в случае|если\s|при наличии)/.test(t))      return MARKERS.condition;
    return MARKERS.note;
  }

  // ---------------------------------------------------------------------------
  // Build previewLines from cleaned text
  // Returns array of { marker, text, number? }
  // ---------------------------------------------------------------------------
  function buildPreviewLines(cleanText, options) {
    var opts = options || {};
    var maxLines = Math.max(2, parseInt(opts.maxLines, 10) || 6);
    if (!cleanText) return [];

    // Strategy 1: parse enumerated items (1), 2) or а), б))
    var items = parseEnumeratedItems(cleanText);
    if (items.length >= 2) {
      var lines = [];
      for (var i = 0; i < Math.min(items.length, maxLines); i++) {
        var t = items[i].text;
        if (t.length > 92) t = t.slice(0, 89) + '…';
        lines.push({ marker: assignMarker(t), text: t, number: items[i].number });
      }
      return lines;
    }

    // Strategy 2: split by newline, pick meaningful lines
    var rawLines = cleanText.split('\n');
    var result = [];
    for (var l = 0; l < rawLines.length && result.length < maxLines; l++) {
      var line = rawLines[l].replace(/\s+/g, ' ').trim();
      if (!line || line.length < 12) continue;
      if (line.length > 92) line = line.slice(0, 89) + '…';
      result.push({ marker: assignMarker(line), text: line });
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Summary generation
  // ---------------------------------------------------------------------------
  function generateSummary(node, cleanText) {
    var title = String((node && node.title) || '').trim();
    // Use title if it looks complete (not a truncated preview ending with ellipsis)
    if (title && title.length >= 20 && title.length <= 180 && !/[….]$/.test(title)) {
      return title;
    }
    if (!cleanText) return title || '';

    var firstPara = cleanText.split(/\n{2,}/)[0] || cleanText;
    var sentence = firstPara.replace(/\s+/g, ' ').trim();
    if (sentence.length <= 200) return sentence;

    // Find first sentence boundary
    var m = sentence.match(/^(.{40,180}[.!?])\s/);
    if (m) return m[1];
    return sentence.slice(0, 160) + '…';
  }

  // ---------------------------------------------------------------------------
  // Main entry point: build presentation data for a node.
  // bodyText — optional pre-assembled body (e.g. point text with children
  //   concatenated). When provided it overrides the raw node content so that
  //   enumerated sub-items authored as child nodes are visible to the parser.
  // ---------------------------------------------------------------------------
  function buildPresentation(node, bodyText) {
    var rawText = (typeof bodyText === 'string' && bodyText.trim())
      ? bodyText.trim()
      : String((node && (node.content || node.plainText)) || '').trim();
    if (!rawText) {
      return {
        summary:      String((node && node.title) || ''),
        previewLines: [],
        footnotes:    [],
        displayMode:  'plain',
        cleanText:    ''
      };
    }

    var extracted = extractFootnotes(rawText);
    return {
      summary:      generateSummary(node, extracted.clean),
      previewLines: buildPreviewLines(extracted.clean),
      footnotes:    extracted.footnotes,
      displayMode:  detectDisplayMode(extracted.clean),
      cleanText:    extracted.clean
    };
  }

  // Public API
  core.buildPresentation    = buildPresentation;
  core.extractFootnotes     = extractFootnotes;
  core.detectDisplayMode    = detectDisplayMode;
  core.buildPreviewLines    = buildPreviewLines;
  core.assignMarker         = assignMarker;
  core.PRESENTATION_MARKERS = MARKERS;
})(window);
