(function(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoekhaliStationNames = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Legacy EK/RK sources store many station names in a six-character field.
  // Keep the imported evidence untouched and expand it only at the UI boundary.
  var STATION_NAME_OVERRIDES = {
    '197 км': 'Блок-пост 197 км',
    '303 км': 'Разъезд 303 км',
    'n 18': 'Разъезд 18 км',
    '№18': 'Разъезд 18 км',
    '№21': 'Разъезд 21 км',
    '18 разъезд': 'Разъезд 18 км',
    '21 разъезд': 'Разъезд 21 км',
    '303 разъезд': 'Разъезд 303 км',
    'аксака': 'Аксака',
    'амгунь': 'Амгунь',
    'амурск': 'Амурский разъезд',
    'апкан': 'Апкан',
    'баджал': 'Баджал',
    'блокпо': 'Блок-пост 9 км',
    'болен': 'Болен',
    'болонь': 'Болонь',
    'бп 9км': 'Блок-пост 9 км',
    'бп 9 км': 'Блок-пост 9 км',
    'бп 197км': 'Блок-пост 197 км',
    'бп 197 км': 'Блок-пост 197 км',
    'вандан': 'Вандан',
    'волоча': 'Волочаевка II',
    'гайтер': 'Гайтер',
    'галицк': 'Галицкий',
    'герби': 'Герби',
    'горин': 'Горин',
    'гурско': 'Гурская',
    'дальне': 'Дальневосточный',
    'двост разъезд': 'Дальневосточный',
    'джамку': 'Джамку',
    'джарме': 'Джармен',
    'джелюм': 'Джелюмкен',
    'дземги': 'Дзёмги',
    'дуки': 'Дуки',
    'дуссе-': 'Дуссе-Алинь',
    'картел': 'Картель',
    'катама': 'Катама',
    'кенай': 'Кенай',
    'косгра': 'Косграмбо',
    'ксм-груз': 'Комсомольск-Грузовой',
    'ксм-сорт': 'Комсомольск-Сортировочный',
    'кузнец': 'Кузнецовский',
    'кумтэ': 'Кумтэ',
    'кун': 'Кун',
    'кун, бп 197км': 'Кун, блок-пост 197 км',
    'кун, бп 197 км': 'Кун, блок-пост 197 км',
    'лиан': 'Лиан',
    'литовк': 'Литовко',
    'маврин': 'Мавринский',
    'менгон': 'Менгон',
    'могды': 'Могды',
    'мони': 'Мони',
    'мугуле': 'Мугуле',
    'мукунг': 'Мукунга',
    'мылки': 'Мылки',
    'нальды': 'Налды',
    'нов кузнецовский': 'Новый Кузнецовский',
    'нусхи': 'Нусхи',
    'орокот': 'Орокот',
    'партиз': 'Партизанские Сопки',
    'партизанск. сопки': 'Партизанские Сопки',
    'пивань': 'Пивань',
    'пиль': 'Пиль',
    'подали': 'Подали',
    'пони': 'Пони',
    'постыш': 'Постышево',
    'почепт': 'Почепта',
    'сагдже': 'Сагджему',
    'санбол': 'Санболи',
    'сектал': 'Сектали',
    'селихи': 'Селихин',
    'сельго': 'Сельгон',
    'силинк': 'Силинка',
    'солони': 'Солони',
    'сонах': 'Сонах',
    'сулук': 'Сулук',
    'талидж': 'Талиджак',
    'тейсин': 'Тейсин',
    'тудур': 'Тудур',
    'удоми': 'Удоми',
    'уктур': 'Уктур',
    'ургал': 'Ургал I',
    'уркаль': 'Уркальту',
    'утиный': 'Утиный',
    'форель': 'Форель',
    'хальга': 'Хальгасо',
    'хальгас': 'Хальгасо',
    'харпич': 'Харпичан',
    'хевчен': 'Хевчен',
    'холони': 'Холони',
    'хумма': 'Хумма',
    'хурму': 'Хурмули',
    'хурмул': 'Хурмули',
    'чемчук': 'Чемчуко',
    'эанга': 'Эанга',
    'эбгунь': 'Эбгунь',
    'эворон': 'Эворон',
    'эльбан': 'Эльбан',
    'эльдиг': 'Эльдиган'
  };

  function normalizeKey(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^ст\.?\s+/i, '')
      .toLowerCase();
  }

  function resolveKomsomolskStationName(coordinate) {
    var numericCoordinate = Math.max(0, Math.round(Number(coordinate) || 0));
    if (numericCoordinate >= 3810000 && numericCoordinate <= 3816500) return 'Комсомольск-2';
    if (numericCoordinate >= 350000 && numericCoordinate <= 365000) return 'Комсомольск-Грузовой';
    return 'Комсомольск-Сортировочный';
  }

  function resolveNewStationName(coordinate) {
    var numericCoordinate = Math.max(0, Math.round(Number(coordinate) || 0));
    if (numericCoordinate >= 3200000 && numericCoordinate <= 3400000) return 'Новый Ургал';
    if (numericCoordinate >= 180000 && numericCoordinate <= 215000) return 'Новый Кузнецовский';
    if (numericCoordinate <= 30000) return 'Новый Мир';
    return 'Новый';
  }

  function formatHumanObjectName(value, kind, coordinate) {
    var text = String(value || '').replace(/\s+/g, ' ').trim().replace(/^ст\.?\s+/i, '');
    if (!text) return '';
    var key = normalizeKey(text);
    if (kind === 'station' || !kind) {
      if (key === 'комсом' || key === 'комсомольск') text = resolveKomsomolskStationName(coordinate);
      else if (key === 'новый') text = resolveNewStationName(coordinate);
      else if (STATION_NAME_OVERRIDES[key]) text = STATION_NAME_OVERRIDES[key];
    }
    if (key === 'скоро') text = 'Огр.';
    return text.replace(/\s+\(/g, '(').replace(/,\s*/g, ', ').replace(/\s+/g, ' ').trim();
  }

  return {
    overrides: STATION_NAME_OVERRIDES,
    formatHumanObjectName: formatHumanObjectName,
    normalizeKey: normalizeKey
  };
});

if (typeof registerShiftTrackerRuntimeModule === 'function') {
  registerShiftTrackerRuntimeModule('poekhali-station-names', 'v410');
}
