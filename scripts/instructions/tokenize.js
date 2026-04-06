(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

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

  function uniqueArray(values) {
    var out = [];
    var seen = {};
    for (var i = 0; i < (values || []).length; i++) {
      var item = String(values[i] || '').trim();
      if (!item || seen[item]) continue;
      seen[item] = 1;
      out.push(item);
    }
    return out;
  }

  function isCyrillicToken(token) {
    return /[а-я]/i.test(String(token || ''));
  }

  function getRussianRvIndex(word) {
    var value = String(word || '');
    for (var i = 0; i < value.length; i++) {
      if (RU_VOWELS.indexOf(value.charAt(i)) !== -1) return i + 1;
    }
    return -1;
  }

  function stemRussianToken(token) {
    var value = String(token || '').toLowerCase().replace(/ё/g, 'е').trim();
    if (!value || value.length <= 3 || !isCyrillicToken(value)) return value;

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
    if (RU_DERIVATIONAL.test(rv)) rv = rv.replace(/ость?$/, '');
    if (/ь$/.test(rv)) rv = rv.replace(/ь$/, '');
    else rv = rv.replace(RU_SUPERLATIVE, '').replace(/нн$/, 'н');

    var stem = (start + rv).trim();
    return stem.length >= 3 ? stem : value;
  }

  function stemToken(token) {
    var normalized = core.normalizeText ? core.normalizeText(token) : String(token || '').toLowerCase();
    if (!normalized) return '';
    var stem = stemRussianToken(normalized);
    if (!stem || stem.length < 3) return normalized;
    return stem;
  }

  function tokenize(text, options) {
    var opts = options || {};
    var source = core.normalizeText ? core.normalizeText(text) : String(text || '');
    if (!source) return [];

    var parts = source.split(' ');
    var minLength = Math.max(1, parseInt(opts.minLength, 10) || 1);
    var keepStopWords = opts.keepStopWords !== false;
    var maxTokens = Math.max(4, parseInt(opts.maxTokens, 10) || 300);
    var out = [];

    for (var i = 0; i < parts.length; i++) {
      var token = String(parts[i] || '').replace(/^[^a-zа-я0-9]+|[^a-zа-я0-9]+$/gi, '');
      if (!token) continue;
      var isNumeric = /^\d+$/.test(token);
      if (!isNumeric && token.length < minLength) continue;
      if (!keepStopWords && !isNumeric && SEARCH_STOP_WORDS[token]) continue;
      out.push(token);
      if (out.length >= maxTokens) break;
    }

    return out;
  }

  function buildStems(tokens) {
    var stems = [];
    for (var i = 0; i < (tokens || []).length; i++) {
      var stem = stemToken(tokens[i]);
      if (!stem) continue;
      stems.push(stem);
    }
    return uniqueArray(stems);
  }

  core.searchStopWords = SEARCH_STOP_WORDS;
  core.uniqueArray = core.uniqueArray || uniqueArray;
  core.tokenize = tokenize;
  core.stemToken = stemToken;
  core.buildStems = buildStems;
})(window);
