    // ── Constants ──
    var MONTH_NAMES = [
      'Январь','Февраль','Март','Апрель','Май','Июнь',
      'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
    ];

    // Производственный календарь РФ, 40-часовая неделя
    // 2025: КонсультантПлюс, 2026: Минтруд утвержденный
    // 2027: предварительный (переносы не утверждены)
    var WORK_NORMS = {
      '2025-01': 136, '2025-02': 160, '2025-03': 167,
      '2025-04': 175, '2025-05': 144, '2025-06': 151,
      '2025-07': 184, '2025-08': 168, '2025-09': 176,
      '2025-10': 184, '2025-11': 151, '2025-12': 176,

      '2026-01': 120, '2026-02': 152, '2026-03': 168,
      '2026-04': 175, '2026-05': 151, '2026-06': 167,
      '2026-07': 184, '2026-08': 168, '2026-09': 176,
      '2026-10': 176, '2026-11': 159, '2026-12': 176
    };

    // Производственный календарь (переносы + сокращенные дни) для точного расчета нормы.
    // Источник: holidays-calendar-ru (данные за 2025-2026).
    var PRODUCTION_NON_WORKING_DAY_KEYS = [
      '2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07', '2025-01-08',
      '2025-02-22', '2025-02-23', '2025-03-08', '2025-03-09',
      '2025-05-01', '2025-05-02', '2025-05-08', '2025-05-09',
      '2025-06-12', '2025-06-13',
      '2025-11-03', '2025-11-04',
      '2025-12-31',
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
      '2026-02-23', '2026-03-09',
      '2026-05-01', '2026-05-11',
      '2026-06-12',
      '2026-11-04',
      '2026-12-31'
    ];

    var PRODUCTION_SHORT_DAY_KEYS = [
      '2025-03-07', '2025-04-30', '2025-06-11', '2025-11-01',
      '2026-04-30', '2026-05-08', '2026-06-11', '2026-11-03'
    ];

    var PRODUCTION_WORKING_DAY_KEYS = [
      '2025-11-01'
    ];

    function buildDateKeyLookup(keys) {
      var out = Object.create(null);
      var list = keys || [];
      for (var i = 0; i < list.length; i++) {
        out[list[i]] = true;
      }
      return out;
    }

    function buildYearLookupFromDateKeys(keys) {
      var out = Object.create(null);
      var list = keys || [];
      for (var i = 0; i < list.length; i++) {
        var year = String(list[i]).slice(0, 4);
        if (year.length === 4) out[year] = true;
      }
      return out;
    }

    var PRODUCTION_NON_WORKING_DAY_MAP = buildDateKeyLookup(PRODUCTION_NON_WORKING_DAY_KEYS);
    var PRODUCTION_SHORT_DAY_MAP = buildDateKeyLookup(PRODUCTION_SHORT_DAY_KEYS);
    var PRODUCTION_WORKING_DAY_MAP = buildDateKeyLookup(PRODUCTION_WORKING_DAY_KEYS);
    var PRODUCTION_CALENDAR_YEAR_MAP = buildYearLookupFromDateKeys(
      PRODUCTION_NON_WORKING_DAY_KEYS.concat(PRODUCTION_SHORT_DAY_KEYS, PRODUCTION_WORKING_DAY_KEYS)
    );

    function getLocalDateKey(date) {
      if (!(date instanceof Date) || !isFinite(date.getTime())) return '';
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function getNormDayMinutesLocal(date) {
      if (!(date instanceof Date) || !isFinite(date.getTime())) return 0;
      var dayOfWeek = date.getDay();
      var key = getLocalDateKey(date);
      var hasProductionYear = !!PRODUCTION_CALENDAR_YEAR_MAP[String(date.getFullYear())];

      if (PRODUCTION_WORKING_DAY_MAP[key]) {
        return PRODUCTION_SHORT_DAY_MAP[key] ? (7 * 60) : (8 * 60);
      }

      if (hasProductionYear) {
        if (PRODUCTION_NON_WORKING_DAY_MAP[key]) return 0;
        if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
        return PRODUCTION_SHORT_DAY_MAP[key] ? (7 * 60) : (8 * 60);
      }

      if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
      if (isNonWorkingHolidayLocalDate(date)) return 0;
      return 8 * 60;
    }

    function isNonWorkingHolidayLocalDate(date) {
      var month = date.getMonth();
      var day = date.getDate();

      if (month === 0) return day >= 1 && day <= 8;
      if (month === 1) return day === 23;
      if (month === 2) return day === 8;
      if (month === 4) return day === 1 || day === 9;
      if (month === 5) return day === 12;
      if (month === 10) return day === 4;
      return false;
    }

    var STORAGE_KEY = 'shifts';
    var MSK_OFFSET = 3; // Moscow = UTC+3
    var SHORT_REST_THRESHOLD_MIN = 8 * 60;
    var MIN_SHIFTS_FOR_AVERAGE = 2;
