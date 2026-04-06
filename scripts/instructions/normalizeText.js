(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  function normalizeInstructionBlock(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeText(value) {
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

  function stripHtmlToText(content) {
    if (content === null || content === undefined) return '';
    var temp = document.createElement('div');
    temp.innerHTML = String(content);
    return normalizeInstructionBlock(String(temp.textContent || temp.innerText || ''));
  }

  core.normalizeText = normalizeText;
  core.normalizeInstructionBlock = normalizeInstructionBlock;
  core.stripHtmlToText = stripHtmlToText;
})(window);
