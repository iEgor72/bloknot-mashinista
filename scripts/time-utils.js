    // ── Time helpers ──

    // Parse "YYYY-MM-DDTHH:MM" as MSK → returns UTC Date
    function parseMsk(dtStr) {
      var raw = typeof dtStr === 'string' ? dtStr.trim() : '';
      if (!raw) return null;

      var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      if (!match) return null;

      var year = parseInt(match[1], 10);
      var month = parseInt(match[2], 10);
      var day = parseInt(match[3], 10);
      var hour = parseInt(match[4], 10);
      var min = parseInt(match[5], 10);
      if (
        !isFinite(year) ||
        !isFinite(month) ||
        !isFinite(day) ||
        !isFinite(hour) ||
        !isFinite(min) ||
        month < 1 || month > 12 ||
        day < 1 || day > 31 ||
        hour < 0 || hour > 23 ||
        min < 0 || min > 59
      ) {
        return null;
      }

      var utcTs = Date.UTC(year, month - 1, day, hour - MSK_OFFSET, min, 0, 0);
      if (!isFinite(utcTs)) return null;

      // Reject impossible dates like 2026-02-30.
      var check = new Date(utcTs + MSK_OFFSET * 60 * 60 * 1000);
      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() + 1 !== month ||
        check.getUTCDate() !== day ||
        check.getUTCHours() !== hour ||
        check.getUTCMinutes() !== min
      ) {
        return null;
      }

      return new Date(utcTs);
    }

    function getShiftStartTimestamp(shift) {
      var start = parseMsk(shift && shift.start_msk);
      return start ? start.getTime() : NaN;
    }

    function compareShiftsByStartDesc(a, b) {
      var aStartTs = getShiftStartTimestamp(a);
      var bStartTs = getShiftStartTimestamp(b);
      var aValid = isFinite(aStartTs);
      var bValid = isFinite(bStartTs);

      if (aValid && bValid) {
        if (aStartTs > bStartTs) return -1;
        if (aStartTs < bStartTs) return 1;
      } else if (aValid) {
        return -1;
      } else if (bValid) {
        return 1;
      }

      var aRaw = a && a.start_msk ? String(a.start_msk) : '';
      var bRaw = b && b.start_msk ? String(b.start_msk) : '';
      if (aRaw > bRaw) return -1;
      if (aRaw < bRaw) return 1;
      return 0;
    }

    function formatMskDatePart(date) {
      var msk = new Date(date.getTime() + MSK_OFFSET * 60 * 60 * 1000);
      var year = msk.getUTCFullYear();
      var month = String(msk.getUTCMonth() + 1).padStart(2, '0');
      var day = String(msk.getUTCDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }

    function formatMskTimePart(date) {
      var msk = new Date(date.getTime() + MSK_OFFSET * 60 * 60 * 1000);
      var hour = String(msk.getUTCHours()).padStart(2, '0');
      var min = String(msk.getUTCMinutes()).padStart(2, '0');
      return hour + ':' + min;
    }

    function composeMskDateTime(dateValue, timeValue) {
      if (!dateValue || !timeValue) return null;
      return dateValue + 'T' + timeValue;
    }

    function setDefaultShiftTimeInputs() {
      if (editingShiftId) return;

      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');

      if (!startDateEl.value) {
        var now = new Date();
        startDateEl.value = formatMskDatePart(now);
        startDateEl.defaultValue = startDateEl.value;
        startTimeEl.value = formatMskTimePart(now);
        startTimeEl.defaultValue = startTimeEl.value;
      }

      if (!endDateEl.value || !endTimeEl.value) {
        syncEndFromStart();
      }

      renderDraftShiftSummary();
    }

    function syncEndFromStart() {
      if (editingShiftId) return;

      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');
      var startDate = parseMsk(composeMskDateTime(startDateEl.value, startTimeEl.value));
      if (!startDate) return;

      var endDate = new Date(startDate.getTime() + 12 * 60 * 60 * 1000);
      endDateEl.value = formatMskDatePart(endDate);
      endDateEl.defaultValue = endDateEl.value;
      endTimeEl.value = formatMskTimePart(endDate);
      endTimeEl.defaultValue = endTimeEl.value;
    }

    // Get UTC timestamp for start of a day in device timezone
    function getLocalDayStartUTC(year, month0, day) {
      // Create a date string and parse it in device timezone
      var m = String(month0 + 1).padStart(2, '0');
      var dd = String(day).padStart(2, '0');
      var str = year + '-' + m + '-' + dd + 'T00:00:00';

      // Use the device's local timezone to interpret this
      // We need to find what UTC time corresponds to midnight local time
      // Strategy: create Date from components (local timezone)
      var local = new Date(year, month0, day, 0, 0, 0);
      return local.getTime();
    }

    // Get UTC timestamps for start/end of a month in device timezone
    function getMonthBounds(year, month0) {
      var start = getLocalDayStartUTC(year, month0, 1);
      var nextMonth = month0 + 1;
      var nextYear = year;
      if (nextMonth > 11) { nextMonth = 0; nextYear++; }
      var end = getLocalDayStartUTC(nextYear, nextMonth, 1);
      return { start: start, end: end };
    }

    // How many minutes of a shift fall within [boundsStart, boundsEnd)
    function shiftMinutesInRange(shift, boundsStart, boundsEnd) {
      var s = parseMsk(shift.start_msk);
      var e = parseMsk(shift.end_msk);
      if (!s || !e) return 0;
      var st = s.getTime();
      var et = e.getTime();
      var effStart = Math.max(st, boundsStart);
      var effEnd = Math.min(et, boundsEnd);
      if (effEnd <= effStart) return 0;
      return Math.round((effEnd - effStart) / 60000);
    }

    function minutesInOverlap(startTs, endTs, boundsStart, boundsEnd) {
      var effStart = Math.max(startTs, boundsStart);
      var effEnd = Math.min(endTs, boundsEnd);
      if (effEnd <= effStart) return 0;
      return Math.round((effEnd - effStart) / 60000);
    }

    // Night hours are counted in the user's local timezone, 22:00-06:00
    function shiftNightMinutesInRange(shift, boundsStart, boundsEnd) {
      var s = parseMsk(shift.start_msk);
      var e = parseMsk(shift.end_msk);
      if (!s || !e) return 0;

      var st = s.getTime();
      var et = e.getTime();
      if (et <= st) return 0;

      // Start one local day earlier so shifts that begin before 06:00 are counted correctly.
      var cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1, 0, 0, 0);
      var lastDay = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0, 0, 0);
      var total = 0;

      while (cursor.getTime() <= lastDay.getTime()) {
        var nightStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 22, 0, 0).getTime();
        var nightEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 6, 0, 0).getTime();
        total += minutesInOverlap(st, et, Math.max(boundsStart, nightStart), Math.min(boundsEnd, nightEnd));
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0);
      }

      return total;
    }

    function inferShiftWorkCodeByLocalTime(shift) {
      if (!shift) return '';
      var explicitRawCode = String((shift && (shift.code || shift.schedule_code)) || '').trim().toUpperCase();
      if (explicitRawCode === 'Д') explicitRawCode = 'D';
      if (explicitRawCode === 'Н') explicitRawCode = 'N';
      if (explicitRawCode === 'В') explicitRawCode = 'V';
      var explicitCode = (explicitRawCode === 'D' || explicitRawCode === 'N' || explicitRawCode === 'V' || explicitRawCode === 'AUTO')
        ? explicitRawCode
        : '';
      if (explicitCode === 'V') return 'V';
      var totalMin = shiftTotalMinutes(shift);
      if (totalMin <= 0) return explicitCode;
      var nightMin = shiftNightMinutesInRange(shift, -8640000000000000, 8640000000000000);
      var dayMin = Math.max(0, totalMin - nightMin);
      return nightMin >= dayMin ? 'N' : 'D';
    }

    function shiftHolidayMinutesInRange(shift, boundsStart, boundsEnd) {
      var s = parseMsk(shift.start_msk);
      var e = parseMsk(shift.end_msk);
      if (!s || !e) return 0;

      var st = s.getTime();
      var et = e.getTime();
      if (et <= st) return 0;

      var cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0);
      var lastDay = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0, 0, 0);
      var total = 0;

      while (cursor.getTime() <= lastDay.getTime()) {
        if (isNonWorkingHolidayLocalDate(cursor)) {
          var dayStart = cursor.getTime();
          var dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0).getTime();
          total += minutesInOverlap(st, et, Math.max(boundsStart, dayStart), Math.min(boundsEnd, dayEnd));
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0);
      }

      return total;
    }

    // Total duration of a shift in minutes
    function shiftTotalMinutes(shift) {
      var s = parseMsk(shift && shift.start_msk);
      var e = parseMsk(shift && shift.end_msk);
      if (!s || !e) return 0;
      var diff = Math.round((e.getTime() - s.getTime()) / 60000);
      return diff > 0 ? diff : 0;
    }

    function getShiftMinutesForDisplay(shift, durationBounds) {
      if (
        durationBounds &&
        isFinite(durationBounds.start) &&
        isFinite(durationBounds.end)
      ) {
        return shiftMinutesInRange(shift, durationBounds.start, durationBounds.end);
      }
      return shiftTotalMinutes(shift);
    }

    // Format minutes → "Xч" or "Xч Yм"
    function fmtMin(totalMin) {
      if (totalMin <= 0) return '0ч';
      var h = Math.floor(totalMin / 60);
      var m = totalMin % 60;
      if (h === 0) return m + 'м';
      if (m === 0) return h + 'ч';
      return h + 'ч ' + m + 'м';
    }


    function formatDurationReadable(totalMin) {
      var minutes = Math.max(0, Math.round(totalMin || 0));
      if (minutes === 0) return '0 мин';

      var days = Math.floor(minutes / 1440);
      var dayRemainder = minutes % 1440;
      var hours = Math.floor(dayRemainder / 60);
      var mins = dayRemainder % 60;
      var parts = [];

      if (days > 0) parts.push(days + ' д');
      if (hours > 0) parts.push(hours + ' ч');
      if (mins > 0 && (days === 0 || parts.length < 2)) parts.push(mins + ' мин');
      return parts.join(' ');
    }

    function formatHoursAndMinutes(totalMin) {
      var minutes = Math.max(0, Math.round(totalMin || 0));
      if (minutes === 0) return '0 мин';

      var hours = Math.floor(minutes / 60);
      var mins = minutes % 60;
      if (hours === 0) return mins + ' мин';
      if (mins === 0) return hours + ' ч';
      return hours + ' ч ' + mins + ' мин';
    }

    function compareYearMonth(yearA, monthA, yearB, monthB) {
      if (yearA > yearB) return 1;
      if (yearA < yearB) return -1;
      if (monthA > monthB) return 1;
      if (monthA < monthB) return -1;
      return 0;
    }

    function getMonthNormSnapshot(year, month0, monthNormMin) {
      var nowDate = new Date();
      var relation = compareYearMonth(year, month0, nowDate.getFullYear(), nowDate.getMonth());
      var monthDays = new Date(year, month0 + 1, 0).getDate();
      var totalWorkingDays = 0;
      var elapsedWorkingDays = 0;
      var calculatedMonthNormMin = 0;
      var elapsedNormMin = 0;
      var hasProductionYear = !!PRODUCTION_CALENDAR_YEAR_MAP[String(year)];

      for (var day = 1; day <= monthDays; day++) {
        var date = new Date(year, month0, day, 12, 0, 0);
        var dayNormMin = getNormDayMinutesLocal(date);
        if (dayNormMin <= 0) continue;
        totalWorkingDays += 1;
        calculatedMonthNormMin += dayNormMin;
        if (relation < 0 || (relation === 0 && day <= nowDate.getDate())) {
          elapsedWorkingDays += 1;
          elapsedNormMin += dayNormMin;
        }
      }

      var safeMonthNormMin = Math.max(0, Number(monthNormMin) || 0);
      if (hasProductionYear && calculatedMonthNormMin > 0) {
        safeMonthNormMin = calculatedMonthNormMin;
      }

      var todayNormMin = 0;
      if (safeMonthNormMin <= 0) {
        todayNormMin = 0;
      } else if (relation < 0) {
        todayNormMin = safeMonthNormMin;
      } else if (relation > 0) {
        todayNormMin = 0;
      } else {
        todayNormMin = elapsedNormMin;
      }

      return {
        relation: relation,
        monthNormMin: safeMonthNormMin,
        todayNormMin: todayNormMin,
        totalWorkingDays: totalWorkingDays,
        elapsedWorkingDays: elapsedWorkingDays,
        calculatedMonthNormMin: calculatedMonthNormMin
      };
    }

    function setProgressMarkerPosition(markerEl, valueMin, maxMin) {
      if (!markerEl) return;
      var value = Number(valueMin);
      var maxValue = Number(maxMin);
      if (!isFinite(value) || value <= 0 || !isFinite(maxValue) || maxValue <= 0) {
        markerEl.classList.add('hidden');
        markerEl.style.removeProperty('left');
        return;
      }
      var pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
      markerEl.classList.remove('hidden');
      markerEl.style.left = pct + '%';
    }

    function getShiftRangeState(shift) {
      var rawStart = shift && shift.start_msk ? String(shift.start_msk) : '';
      var rawEnd = shift && shift.end_msk ? String(shift.end_msk) : '';
      var start = parseMsk(rawStart);
      var end = parseMsk(rawEnd);
      var startMs = start ? start.getTime() : NaN;
      var endMs = end ? end.getTime() : NaN;
      var hasStart = isFinite(startMs);
      var hasEnd = isFinite(endMs);

      return {
        hasStartValue: !!rawStart,
        hasEndValue: !!rawEnd,
        hasStart: hasStart,
        hasEnd: hasEnd,
        startMs: hasStart ? startMs : 0,
        endMs: hasEnd ? endMs : 0,
        hasValidInterval: hasStart && hasEnd && endMs > startMs
      };
    }

    function getRestGapInfo(newerShift, olderShift) {
      if (!newerShift || !olderShift) return null;

      var newer = getShiftRangeState(newerShift);
      var older = getShiftRangeState(olderShift);

      if (
        (newer.hasStartValue && !newer.hasStart) ||
        (newer.hasEndValue && !newer.hasEnd) ||
        (older.hasStartValue && !older.hasStart) ||
        (older.hasEndValue && !older.hasEnd)
      ) {
        return {
          kind: 'invalid',
          label: 'Отдых: ошибка времени'
        };
      }

      if ((newer.hasStart && newer.hasEnd && !newer.hasValidInterval) || (older.hasStart && older.hasEnd && !older.hasValidInterval)) {
        return {
          kind: 'invalid',
          label: 'Отдых: ошибка времени'
        };
      }

      if (!older.hasEndValue) {
        return {
          kind: 'unavailable',
          label: 'Отдых: нет конца смены'
        };
      }

      if (!newer.hasStartValue) {
        return {
          kind: 'unavailable',
          label: 'Отдых: нет начала смены'
        };
      }

      var restMin = Math.round((newer.startMs - older.endMs) / 60000);
      if (!isFinite(restMin)) {
        return {
          kind: 'unavailable',
          label: 'Отдых: нет данных'
        };
      }

      if (restMin < 0) {
        return {
          kind: 'overlap',
          label: 'Пересечение ' + formatDurationReadable(Math.abs(restMin))
        };
      }

      return {
        kind: 'ok',
        isShort: restMin < SHORT_REST_THRESHOLD_MIN,
        label: 'Отдых ' + formatDurationReadable(restMin)
      };
    }

    // Format shift for display
    function fmtShift(shift) {
      var s = shift && shift.start_msk ? String(shift.start_msk) : '';
      var e = shift && shift.end_msk ? String(shift.end_msk) : '';
      var sd = s.length >= 10 ? s.substring(0, 10) : '';
      var st = s.length >= 16 ? s.substring(11, 16) : '--:--';
      var ed = e.length >= 10 ? e.substring(0, 10) : '';
      var et = e.length >= 16 ? e.substring(11, 16) : '--:--';

      // Format dates as DD.MM.YYYY
      var startDate = sd ? (sd.substring(8,10) + '.' + sd.substring(5,7) + '.' + sd.substring(0,4)) : '—';
      var endDate = ed ? (ed.substring(8,10) + '.' + ed.substring(5,7) + '.' + ed.substring(0,4)) : '—';

      var range = getShiftRangeState(shift);
      var dur = range.hasValidInterval ? fmtMin(shiftTotalMinutes(shift)) : '—';

      if (sd && ed && sd === ed) {
        return { text: startDate + ', ' + st + ' → ' + et, dur: dur };
      } else if (sd && ed) {
        return { text: startDate + ', ' + st + ' → ' + endDate + ', ' + et, dur: dur };
      }
      return { text: startDate + ', ' + st + ' → ' + et, dur: dur };
    }

    function formatMskShortDate(dateStr) {
      if (!dateStr || dateStr.length < 10) return '';
      var monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      var day = dateStr.substring(8, 10);
      var monthIndex = parseInt(dateStr.substring(5, 7), 10) - 1;
      var month = monthNames[monthIndex] || '';
      return day + ' ' + month;
    }

    function getShiftDisplayParts(shift) {
      var s = shift && shift.start_msk ? shift.start_msk : '';
      var e = shift && shift.end_msk ? shift.end_msk : '';
      var startTime = s.length >= 16 ? s.substring(11, 16) : '--:--';
      var endTime = e.length >= 16 ? e.substring(11, 16) : '--:--';
      var startDate = formatMskShortDate(s.substring(0, 10)) || '—';
      var endDate = formatMskShortDate(e.substring(0, 10)) || '—';
      return {
        startTime: startTime,
        endTime: endTime,
        startDate: startDate,
        endDate: endDate
      };
    }

    function getShiftIncomeViewModel(shift, shiftIncomeMap) {
      var incomeData = shiftIncomeMap ? shiftIncomeMap[String(shift.id)] : null;
      if (!incomeData) {
        return {
          hasValue: false,
          level: 'none',
          amountText: '—'
        };
      }
      var incomeLevel = incomeData.level === 'low' || incomeData.level === 'high'
        ? incomeData.level
        : 'medium';
      var incomeAmount = Number(incomeData.amount);
      var hasAmount = isFinite(incomeAmount);
      return {
        hasValue: hasAmount,
        level: hasAmount ? incomeLevel : 'none',
        amountText: hasAmount ? formatRub(incomeAmount) : '—'
      };
    }

    function getShiftIncomeChipHtml(incomeViewModel) {
      var vm = incomeViewModel || { hasValue: false, level: 'none', amountText: '—' };
      var chipClass = vm.hasValue ? ('shift-income-chip--' + vm.level) : 'shift-income-chip--empty';
      return '<div class="shift-income-chip ' + chipClass + '">' + escapeHtml(vm.amountText) + '</div>';
    }

    function getShiftDateTimeLineLabel(displayParts) {
      if (!displayParts) return '—';
      var start = (displayParts.startDate || '—') + ', ' + (displayParts.startTime || '--:--');
      var end = (displayParts.endDate || '—') + ', ' + (displayParts.endTime || '--:--');
      return start + ' → ' + end;
    }

    function getShiftInlineIconSvg(iconName) {
      var common = 'class="shift-inline-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
      if (iconName === 'calendar') {
        return '<svg ' + common + '><rect x="3.5" y="5" width="13" height="11" rx="2"></rect><path d="M7 3.8v2.4"></path><path d="M13 3.8v2.4"></path><path d="M3.5 8.5h13"></path></svg>';
      }
      if (iconName === 'depot') {
        return '<svg ' + common + '><path d="M3.5 16.5h13"></path><path d="M5 16.5V7.8L10 5l5 2.8v8.7"></path><path d="M8 16.5v-3h4v3"></path></svg>';
      }
      if (iconName === 'route') {
        return '<svg ' + common + '><path d="M7 16s4-3.4 4-6.5A4 4 0 1 0 3 9.5C3 12.6 7 16 7 16Z"></path><circle cx="7" cy="9" r="1.3"></circle><path d="M12 13h4"></path><path d="M14.5 11.5 16 13l-1.5 1.5"></path></svg>';
      }
      if (iconName === 'duration') {
        return '<svg ' + common + '><circle cx="10" cy="10" r="6"></circle><path d="M10 7.2v3.2l2.1 1.2"></path></svg>';
      }
      if (iconName === 'locomotive') {
        return '<svg ' + common + '><path d="M4 13V6.5A2.5 2.5 0 0 1 6.5 4h6A2.5 2.5 0 0 1 15 6.5V13"></path><path d="M4 11h11"></path><path d="M7 8h3"></path><circle cx="6.5" cy="14.5" r="1"></circle><circle cx="12.5" cy="14.5" r="1"></circle></svg>';
      }
      if (iconName === 'train') {
        return '<svg ' + common + '><rect x="3.5" y="6" width="13" height="7" rx="2"></rect><path d="M6.5 8.5h2"></path><path d="M11.5 8.5h2"></path><path d="M6.5 13v2"></path><path d="M13.5 13v2"></path></svg>';
      }
      if (iconName === 'speed') {
        return '<svg ' + common + '><path d="M4.2 13.5a6.3 6.3 0 1 1 11.6 0"></path><path d="M10 10.4l3.2-2.5"></path><path d="M6.3 12.7h.1"></path><path d="M13.6 12.7h.1"></path><path d="M10 5.8v.1"></path></svg>';
      }
      if (iconName === 'wagon') {
        return '<svg ' + common + '><rect x="4" y="6.5" width="12" height="6.5" rx="1.8"></rect><path d="M8 6.5v6.5"></path><path d="M12 6.5v6.5"></path><circle cx="7" cy="14.5" r="0.9"></circle><circle cx="13" cy="14.5" r="0.9"></circle></svg>';
      }
      if (iconName === 'axles') {
        return '<svg ' + common + '><circle cx="10" cy="10" r="2.7"></circle><path d="M10 4.2v1.6"></path><path d="M10 14.2v1.6"></path><path d="M4.2 10h1.6"></path><path d="M14.2 10h1.6"></path><path d="M5.8 5.8 7 7"></path><path d="M13 13l1.2 1.2"></path><path d="M14.2 5.8 13 7"></path><path d="M7 13l-1.2 1.2"></path></svg>';
      }
      if (iconName === 'fuel') {
        return '<svg ' + common + '><path d="M8 6.2h5a1.6 1.6 0 0 1 1.6 1.6v6.7A1.6 1.6 0 0 1 13 16.1H8a1.6 1.6 0 0 1-1.6-1.6V7.8A1.6 1.6 0 0 1 8 6.2Z"></path><path d="M14.6 8.7h1.2a1.1 1.1 0 0 1 1.1 1.1V12a1.1 1.1 0 0 1-1.1 1.1h-1.2"></path><path d="M9.3 8.7h2.4"></path><path d="M9.3 11.1h2.4"></path><path d="M6.4 8.6 4.7 7"></path><path d="M4.7 7 3.6 8.3"></path></svg>';
      }
      if (iconName === 'income') {
        return '<svg ' + common + '><path d="M4 7.5h12a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5Z"></path><circle cx="10" cy="11" r="1.7"></circle><path d="M5.2 11h.1"></path><path d="M14.7 11h.1"></path></svg>';
      }
      return '<svg ' + common + '><rect x="3.5" y="4.5" width="13" height="12" rx="2.2"></rect><path d="M7 3.5v2"></path><path d="M13 3.5v2"></path><path d="M3.5 8h13"></path></svg>';
    }

    function getShiftTypeLabel(shift) {
      if (!shift) return 'Смена';
      if (shift.route_kind === 'trip') return 'Поездка';
      if (shift.route_kind === 'depot') return 'Смена';
      return 'Смена';
    }

    function getShiftTypeIconName(shift) {
      if (shift && shift.route_kind === 'trip') return 'train';
      if (shift && shift.route_kind === 'depot') return 'shift';
      return 'shift';
    }

    function getShiftDirectionLineText(shift) {
      if (!shift) return '';
      var from = shift.route_from ? String(shift.route_from).trim() : '';
      var to = shift.route_to ? String(shift.route_to).trim() : '';
      if (!from || !to) return '';
      return from + ' → ' + to;
    }

    function getShiftDurationLabelText(rawDuration) {
      var text = rawDuration ? String(rawDuration) : '—';
      return text
        .replace(/(\d)\s+д/g, '$1д')
        .replace(/(\d)\s+ч/g, '$1ч')
        .replace(/(\d)\s+мин/g, '$1м');
    }

    function buildShiftSyncInlineIconHtml() {
      return '<span class="shift-sync-inline" role="img" aria-label="Не синхронизировано" title="Не синхронизировано">' + docOnlineOnlyIcon + '</span>';
    }

    function buildShiftTypeHtml(shift, typeLabel, showSyncIcon) {
      var syncIconHtml = showSyncIcon ? buildShiftSyncInlineIconHtml() : '';
      return '' +
        '<div class="shift-type">' +
          '<span class="shift-type-content">' +
            '<span class="shift-type-icon" aria-hidden="true">' + getShiftInlineIconSvg(getShiftTypeIconName(shift)) + '</span>' +
            '<span class="shift-type-text">' + escapeHtml(typeLabel) + '</span>' +
            syncIconHtml +
          '</span>' +
        '</div>';
    }

    function buildShiftDirectionHtml(directionText) {
      if (!directionText) return '';
      return '' +
        '<div class="shift-direction-row">' +
          '<span class="shift-direction-icon" aria-hidden="true">' + getShiftInlineIconSvg('route') + '</span>' +
          '<span class="shift-direction-text">' + escapeHtml(directionText) + '</span>' +
        '</div>';
    }

    function buildShiftDurationHtml(durationText) {
      return '' +
        '<div class="shift-duration">' +
          '<span class="shift-duration-icon" aria-hidden="true">' + getShiftInlineIconSvg('duration') + '</span>' +
          '<span class="shift-duration-text">' + escapeHtml(durationText || '—') + '</span>' +
        '</div>';
    }

    function buildShiftDateTimeHtml(dateTimeText) {
      return '' +
        '<div class="shift-datetime-line">' +
          '<span class="shift-datetime-icon" aria-hidden="true">' + getShiftInlineIconSvg('calendar') + '</span>' +
          '<span class="shift-datetime-text">' + escapeHtml(dateTimeText || '—') + '</span>' +
        '</div>';
    }

    function buildShiftIncomeLabelHtml() {
      return '' +
        '<span class="shift-income-row-label">' +
          '<span class="shift-income-row-label-content">' +
            '<span class="shift-income-row-label-icon" aria-hidden="true">' + getShiftInlineIconSvg('income') + '</span>' +
            '<span class="shift-income-row-label-text">Доход за смену</span>' +
          '</span>' +
        '</span>';
    }

    function getShiftPoekhaliNumber(shift, key) {
      var value = Number(shift && shift[key]);
      return isFinite(value) ? Math.max(0, value) : 0;
    }

    function hasShiftPoekhaliData(shift) {
      return !!(shift && (
        shift.poekhali_run_id ||
        shift.poekhali_user_section_id ||
        getShiftPoekhaliNumber(shift, 'poekhali_warning_rules_count') > 0 ||
        getShiftPoekhaliNumber(shift, 'poekhali_active_restriction_speed_kmh') > 0 ||
        getShiftPoekhaliNumber(shift, 'poekhali_next_restriction_speed_kmh') > 0 ||
        shift.poekhali_next_signal_name ||
        shift.poekhali_next_station_name ||
        shift.poekhali_next_target_label ||
        getShiftPoekhaliNumber(shift, 'poekhali_route_distance_m') > 0 ||
        getShiftPoekhaliNumber(shift, 'poekhali_route_eta_s') > 0 ||
        getShiftPoekhaliNumber(shift, 'poekhali_overspeed_max_kmh') > 0 ||
        getShiftPoekhaliNumber(shift, 'poekhali_alert_count') > 0 ||
        shift.poekhali_last_alert_title ||
        getShiftPoekhaliNumber(shift, 'poekhali_distance_m') > 0 ||
        getShiftPoekhaliNumber(shift, 'poekhali_duration_ms') > 0 ||
        getShiftPoekhaliNumber(shift, 'poekhali_technical_speed_kmh') > 0
      ));
    }

    function formatShiftPoekhaliSpeed(value) {
      var speed = Number(value);
      if (!isFinite(speed) || speed <= 0) return '';
      return (Math.round(speed * 10) / 10).toString().replace('.', ',') + ' км/ч';
    }

    function formatShiftPoekhaliEta(value, compact) {
      var seconds = Math.max(0, Math.round(Number(value) || 0));
      if (!seconds) return '';
      var minutes = Math.max(1, Math.round(seconds / 60));
      if (minutes < 60) return (compact ? '~' : 'примерно ') + minutes + ' мин';
      var hours = Math.floor(minutes / 60);
      var rest = minutes % 60;
      if (compact) return '~' + hours + 'ч' + (rest ? ' ' + rest + 'м' : '');
      return 'примерно ' + hours + ' ч' + (rest ? ' ' + rest + ' мин' : '');
    }

    function formatShiftPoekhaliDistance(value) {
      var meters = Math.max(0, Math.round(Number(value) || 0));
      if (meters >= 10000) return (meters / 1000).toFixed(1).replace('.', ',') + ' км';
      if (meters >= 1000) return (meters / 1000).toFixed(2).replace('.', ',') + ' км';
      return meters ? meters + ' м' : '';
    }

    function formatShiftPoekhaliTrainLength(shift) {
      var meters = getShiftPoekhaliNumber(shift, 'poekhali_train_length_m');
      if (!meters) return '';
      var source = String(shift && shift.poekhali_train_length_source || '').trim();
      var label = String(shift && shift.poekhali_train_length_label || '').trim();
      var text = meters + ' м';
      if (source === 'по осям') text = '~' + text;
      if (label && label !== text) text += ' · ' + label;
      if (source) text += ' · ' + source;
      return text;
    }

    function formatShiftPoekhaliDuration(value) {
      var ms = Math.max(0, Math.round(Number(value) || 0));
      if (!ms) return '';
      return formatHoursAndMinutes(Math.round(ms / 60000));
    }

    function formatShiftPoekhaliDateTime(value) {
      var ts = Date.parse(value || '');
      if (!isFinite(ts)) return '';
      var date = new Date(ts);
      try {
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ', ' +
          date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      } catch (error) {
        return '';
      }
    }

    function formatShiftPoekhaliCoordinate(sector, coordinate) {
      var numericSector = Number(sector);
      var numericCoordinate = Number(coordinate);
      if (!isFinite(numericCoordinate) || numericCoordinate < 0) return '';
      var rounded = Math.max(0, Math.round(numericCoordinate));
      var meters = ((rounded % 1000) + 1000) % 1000;
      var km = Math.floor(rounded / 1000);
      var pk = Math.floor(meters / 100) + 1;
      return (isFinite(numericSector) && numericSector > 0 ? 'уч. ' + Math.round(numericSector) + ' · ' : '') + km + ' км ' + pk + ' пк';
    }

    function formatShiftPoekhaliPoint(shift, prefix) {
      return formatShiftPoekhaliCoordinate(
        shift && shift['poekhali_' + prefix + '_sector'],
        shift && shift['poekhali_' + prefix + '_coordinate']
      );
    }

    function getShiftPoekhaliStatusLabel(status) {
      if (status === 'active') return 'идет запись';
      if (status === 'paused') return 'пауза';
      if (status === 'finished') return 'завершено';
      return '';
    }

    function getShiftPoekhaliSectionStatusLabel(status) {
      if (status === 'verified') return 'проверено';
      if (status === 'changed') return 'изменено';
      if (status === 'draft') return 'на проверку';
      return '';
    }

    function formatShiftPoekhaliWarningRules(shift) {
      var total = getShiftPoekhaliNumber(shift, 'poekhali_warning_rules_count');
      if (!total) return '';
      var active = getShiftPoekhaliNumber(shift, 'poekhali_warning_rules_active_count');
      var disabled = getShiftPoekhaliNumber(shift, 'poekhali_warning_rules_disabled_count');
      var text = active + '/' + total;
      if (disabled > 0) text += ' · неакт. ' + disabled;
      return text;
    }

    function formatShiftPoekhaliActiveRestriction(shift, compact) {
      if (!shift) return '';
      var label = String(shift.poekhali_active_restriction_label || '').trim();
      var speed = getShiftPoekhaliNumber(shift, 'poekhali_active_restriction_speed_kmh');
      if (!label && speed > 0) label = formatShiftPoekhaliSpeed(speed);
      if (!label) return '';
      if (speed > 0 && !/км\/ч/i.test(label)) label += ' км/ч';
      if (compact) return label;
      var sector = shift.poekhali_active_restriction_sector;
      var start = formatShiftPoekhaliCoordinate(sector, shift.poekhali_active_restriction_start);
      var end = formatShiftPoekhaliCoordinate(sector, shift.poekhali_active_restriction_end);
      var range = start && end && start !== end ? start + ' - ' + end : (start || end);
      var distance = getShiftPoekhaliNumber(shift, 'poekhali_active_restriction_distance_m');
      var parts = [label];
      if (range) parts.push(range);
      if (distance > 0) parts.push('до конца ' + formatShiftPoekhaliDistance(distance));
      return parts.join(' · ');
    }

    function formatShiftPoekhaliNextRestriction(shift, compact) {
      if (!shift) return '';
      var label = String(shift.poekhali_next_restriction_label || '').trim();
      var speed = getShiftPoekhaliNumber(shift, 'poekhali_next_restriction_speed_kmh');
      if (!label && speed > 0) label = formatShiftPoekhaliSpeed(speed);
      if (!label) return '';
      if (speed > 0 && !/км\/ч/i.test(label)) label += ' км/ч';
      var distance = getShiftPoekhaliNumber(shift, 'poekhali_next_restriction_distance_m');
      var eta = formatShiftPoekhaliEta(shift.poekhali_next_restriction_eta_s, compact);
      if (compact) return distance > 0 ? label + ' через ' + formatShiftPoekhaliDistance(distance) + (eta ? ' / ' + eta : '') : label;
      var point = formatShiftPoekhaliCoordinate(
        shift.poekhali_next_restriction_sector,
        shift.poekhali_next_restriction_coordinate
      );
      var parts = [label];
      if (distance > 0) parts.push('через ' + formatShiftPoekhaliDistance(distance));
      if (eta) parts.push(eta);
      if (point) parts.push(point);
      return parts.join(' · ');
    }

    function formatShiftPoekhaliNextObject(shift, prefix, compact) {
      if (!shift || !prefix) return '';
      var name = String(shift['poekhali_' + prefix + '_name'] || '').trim();
      if (!name) return '';
      var source = String(shift['poekhali_' + prefix + '_source'] || '').trim();
      var distance = getShiftPoekhaliNumber(shift, 'poekhali_' + prefix + '_distance_m');
      var eta = formatShiftPoekhaliEta(shift['poekhali_' + prefix + '_eta_s'], compact);
      if (compact) return distance > 0 ? name + ' через ' + formatShiftPoekhaliDistance(distance) + (eta ? ' / ' + eta : '') : name;
      var point = formatShiftPoekhaliCoordinate(
        shift['poekhali_' + prefix + '_sector'],
        shift['poekhali_' + prefix + '_coordinate']
      );
      var parts = [name];
      if (distance > 0) parts.push('через ' + formatShiftPoekhaliDistance(distance));
      if (eta) parts.push(eta);
      if (point) parts.push(point);
      if (source) parts.push(source);
      return parts.join(' · ');
    }

    function formatShiftPoekhaliRouteProgress(shift, compact) {
      if (!shift) return '';
      var total = getShiftPoekhaliNumber(shift, 'poekhali_route_distance_m');
      if (!total) return '';
      var remaining = getShiftPoekhaliNumber(shift, 'poekhali_route_remaining_m');
      var progress = Number(shift.poekhali_route_progress_pct);
      if (!isFinite(progress)) progress = 0;
      progress = Math.max(0, Math.min(100, Math.round(progress * 10) / 10));
      var eta = formatShiftPoekhaliEta(shift.poekhali_route_eta_s, compact);
      if (compact) return Math.round(progress) + '% · ост. ' + formatShiftPoekhaliDistance(remaining) + (eta ? ' / ' + eta : '');
      var from = String(shift.poekhali_route_from_name || '').trim();
      var to = String(shift.poekhali_route_to_name || '').trim();
      var parts = [];
      if (from || to) parts.push((from || 'старт') + ' → ' + (to || 'финиш'));
      parts.push(progress + '%');
      parts.push('осталось ' + formatShiftPoekhaliDistance(remaining));
      if (eta) parts.push(eta);
      parts.push('из ' + formatShiftPoekhaliDistance(total));
      return parts.join(' · ');
    }

    function getShiftPoekhaliTargetShortLabel(kind, source) {
      if (kind === 'restriction_end') return 'КОНЕЦ';
      if (kind === 'warning') return 'ПР';
      if (kind === 'restriction') {
        if (source === 'document') return 'ДОК';
        if (source === 'regime') return 'РК';
        if (source === 'user') return 'GPS';
        return 'ОГР';
      }
      if (kind === 'signal') return 'СВ';
      if (kind === 'station') return 'СТ';
      if (kind === 'route_start') return 'СТАРТ';
      if (kind === 'route_finish') return 'ФИН';
      return 'ЦЕЛЬ';
    }

    function formatShiftPoekhaliNavigationTarget(shift, compact) {
      if (!shift) return '';
      var label = String(shift.poekhali_next_target_label || '').trim();
      if (!label) return '';
      var distance = getShiftPoekhaliNumber(shift, 'poekhali_next_target_distance_m');
      var eta = formatShiftPoekhaliEta(shift.poekhali_next_target_eta_s, compact);
      if (compact) return label + (distance > 0 ? ' через ' + formatShiftPoekhaliDistance(distance) : ' тут') + (eta ? ' / ' + eta : '');
      var point = formatShiftPoekhaliCoordinate(
        shift.poekhali_next_target_sector,
        shift.poekhali_next_target_coordinate
      );
      var parts = [label];
      if (distance > 0) parts.push('через ' + formatShiftPoekhaliDistance(distance));
      else parts.push('тут');
      if (eta) parts.push(eta);
      if (point) parts.push(point);
      parts.push(getShiftPoekhaliTargetShortLabel(shift.poekhali_next_target_kind, shift.poekhali_next_target_source));
      return parts.join(' · ');
    }

    function formatShiftPoekhaliLastAlert(shift, compact) {
      if (!shift) return '';
      var title = String(shift.poekhali_last_alert_title || '').trim();
      var text = String(shift.poekhali_last_alert_text || '').trim();
      if (!title && !text) return '';
      var distance = getShiftPoekhaliNumber(shift, 'poekhali_last_alert_distance_m');
      var time = formatShiftPoekhaliDateTime(shift.poekhali_last_alert_at);
      if (compact) {
        return (title || text) +
          (distance > 0 ? ' · ' + formatShiftPoekhaliDistance(distance) : '') +
          (time ? ' · ' + time : '');
      }
      var parts = [title || text];
      if (text && text !== title) parts.push(text);
      if (distance > 0) parts.push(formatShiftPoekhaliDistance(distance));
      if (time) parts.push(time);
      return parts.join(' · ');
    }

    function getShiftCardTextValue(shift, primaryKey, fallbackKey) {
      var primary = shift && shift[primaryKey] !== undefined && shift[primaryKey] !== null
        ? String(shift[primaryKey]).trim()
        : '';
      if (primary) return primary;
      return shift && shift[fallbackKey] !== undefined && shift[fallbackKey] !== null
        ? String(shift[fallbackKey]).trim()
        : '';
    }

    function getShiftCardTrainLengthText(shift) {
      var direct = getShiftCardTextValue(shift, 'train_length', 'poekhali_train_wagons');
      if (direct) return direct + ' ваг';
      var label = String(shift && shift.poekhali_train_length_label || '').trim();
      if (label) return label.replace(/\s*уд\./i, ' ваг.');
      var meters = getShiftPoekhaliNumber(shift, 'poekhali_train_length_m');
      return meters > 0 ? meters + ' м' : '';
    }

    function getShiftTechnicalItems(shift) {
      var items = [];
      if (!shift) return items;
      var loco = getLocoSummary(shift) || getShiftCardTextValue(shift, 'locomotive_summary', 'poekhali_loco');
      var trainNumber = getShiftCardTextValue(shift, 'train_number', 'poekhali_train_number');
      var trainWeight = getShiftCardTextValue(shift, 'train_weight', 'poekhali_train_weight');
      var trainAxles = getShiftCardTextValue(shift, 'train_axles', 'poekhali_train_axles');
      var trainLength = getShiftCardTrainLengthText(shift);
      if (loco) items.push({ icon: 'locomotive', text: loco.replace('№ ', '№') });
      if (hasShiftPoekhaliData(shift)) {
        var techSpeed = getShiftPoekhaliNumber(shift, 'poekhali_technical_speed_kmh');
        var averageSpeed = getShiftPoekhaliNumber(shift, 'poekhali_average_speed_kmh');
        var distance = getShiftPoekhaliNumber(shift, 'poekhali_distance_m');
        if (techSpeed > 0) {
          items.push({ icon: 'speed', text: 'Тех ' + formatShiftPoekhaliSpeed(techSpeed) });
        } else if (averageSpeed > 0) {
          items.push({ icon: 'speed', text: 'Ср ' + formatShiftPoekhaliSpeed(averageSpeed) });
        } else if (distance > 0) {
          items.push({ icon: 'route', text: formatShiftPoekhaliDistance(distance) });
        }
      }
      if (trainNumber) items.push({ icon: 'train', text: '№' + trainNumber });
      if (trainWeight) items.push({ icon: 'train', text: trainWeight + ' т' });
      if (trainLength) items.push({ icon: 'wagon', text: trainLength });
      if (trainAxles) items.push({ icon: 'axles', text: trainAxles + ' оси' });
      return items;
    }

    function buildShiftTechnicalHtml(shift) {
      var items = getShiftTechnicalItems(shift);
      if (!items.length) return '';

      function renderTechRow(rowItems) {
        var rowHtml = '';
        for (var i = 0; i < rowItems.length; i++) {
          if (i > 0) rowHtml += '<span class="shift-tech-sep" aria-hidden="true">·</span>';
          rowHtml += '' +
            '<span class="shift-tech-part">' +
              '<span class="shift-tech-part-icon" aria-hidden="true">' + getShiftInlineIconSvg(rowItems[i].icon) + '</span>' +
              '<span class="shift-tech-part-text">' + escapeHtml(rowItems[i].text) + '</span>' +
            '</span>';
        }
        return rowHtml;
      }

      var primaryItems = items.slice(0, 2);
      var secondaryItems = items.slice(2);
      var html = '<div class="shift-tech-line">' +
        '<div class="shift-tech-row shift-tech-row-primary">' + renderTechRow(primaryItems) + '</div>';
      if (secondaryItems.length) {
        html += '<div class="shift-tech-row shift-tech-row-secondary">' + renderTechRow(secondaryItems) + '</div>';
      }
      html += '</div>';
      return html;
    }

    function buildConfirmShiftCardHtml(shift, shiftIncomeMap) {
      if (!shift) return '';
      var f = fmtShift(shift);
      var p = getShiftDisplayParts(shift);
      var typeLabel = getShiftTypeLabel(shift);
      var shiftPending = isShiftPending(shift);
      var directionText = getShiftDirectionLineText(shift);
      var dateTimeText = getShiftDateTimeLineLabel(p);
      var durationText = getShiftDurationLabelText(f.dur);
      var typeHtml = buildShiftTypeHtml(shift, typeLabel, shiftPending);
      var directionHtml = buildShiftDirectionHtml(directionText);
      var dateTimeHtml = buildShiftDateTimeHtml(dateTimeText);
      var durationHtml = buildShiftDurationHtml(durationText);
      var technicalHtml = buildShiftTechnicalHtml(shift);
      var fuelNoteHtml = buildShiftFuelConsumptionHtml(shift);
      var incomeLabelHtml = buildShiftIncomeLabelHtml();
      var incomeVm = getShiftIncomeViewModel(shift, shiftIncomeMap);
      var incomeHtml = getShiftIncomeChipHtml(incomeVm);
      var itemClass = 'shift-item compact-shift shift-item-confirm';
      if (shift.route_kind === 'trip') itemClass += ' has-trip';
      if (shiftPending) itemClass += ' is-pending';
      itemClass += ' income-' + incomeVm.level;
      var shiftIdAttr = escapeHtml(String(shift.id || ''));

      return '' +
        '<div class="' + itemClass + '" data-shift-id="' + shiftIdAttr + '">' +
          '<div class="shift-card-top">' +
            typeHtml +
          '</div>' +
          '<div class="shift-card-body">' +
            '<div class="shift-main-row">' +
              dateTimeHtml +
              durationHtml +
            '</div>' +
            directionHtml +
            technicalHtml +
            fuelNoteHtml +
            '<div class="shift-income-row">' +
              incomeLabelHtml +
              incomeHtml +
            '</div>' +
          '</div>' +
          '</div>';
    }

    function formatLocalDateTimeFromMsk(mskDateTime) {
      var parsed = parseMsk(mskDateTime);
      if (!parsed) return '—';
      try {
        var dateText = parsed.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        var timeText = parsed.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return dateText + ' ' + timeText;
      } catch (e) {
        var fallback = String(mskDateTime || '');
        if (fallback.length >= 16) {
          return fallback.substring(8, 10) + '.' + fallback.substring(5, 7) + '.' + fallback.substring(0, 4) + ' ' + fallback.substring(11, 16);
        }
        return fallback || '—';
      }
    }

    function getShiftDetailValue(value) {
      if (value === null || value === undefined) return '';
      var text = String(value).trim();
      return text;
    }

    function buildShiftDetailRowHtml(label, value, emptyText) {
      var prepared = getShiftDetailValue(value);
      var hasValue = !!prepared;
      var displayText = hasValue ? prepared : (emptyText || '—');
      return '' +
        '<div class="shift-detail-row">' +
          '<span class="shift-detail-key">' + escapeHtml(label) + '</span>' +
          '<span class="shift-detail-value' + (hasValue ? '' : ' is-empty') + '">' + escapeHtml(displayText) + '</span>' +
        '</div>';
    }

    function buildShiftDetailHeroCardHtml(shift, shiftIncomeMap) {
      if (!shift) return '';
      var f = fmtShift(shift);
      var p = getShiftDisplayParts(shift);
      var typeLabel = getShiftTypeLabel(shift);
      var shiftPending = isShiftPending(shift);
      var directionText = getShiftDirectionLineText(shift);
      var dateTimeText = getShiftDateTimeLineLabel(p);
      var durationText = getShiftDurationLabelText(f.dur);
      var typeHtml = buildShiftTypeHtml(shift, typeLabel, shiftPending);
      var directionHtml = buildShiftDirectionHtml(directionText);
      var dateTimeHtml = buildShiftDateTimeHtml(dateTimeText);
      var durationHtml = buildShiftDurationHtml(durationText);
      var technicalHtml = buildShiftTechnicalHtml(shift);
      var fuelNoteHtml = buildShiftFuelConsumptionHtml(shift);
      var incomeLabelHtml = buildShiftIncomeLabelHtml();
      var incomeVm = getShiftIncomeViewModel(shift, shiftIncomeMap);
      var incomeHtml = getShiftIncomeChipHtml(incomeVm);
      var itemClass = 'shift-item shift-item-confirm shift-item-detail';
      if (shift.route_kind === 'trip') itemClass += ' has-trip';
      if (shiftPending) itemClass += ' is-pending';
      itemClass += ' income-' + incomeVm.level;
      var shiftIdAttr = escapeHtml(String(shift.id || ''));

      return '' +
        '<div class="' + itemClass + '" data-shift-id="' + shiftIdAttr + '">' +
          '<div class="shift-card-top">' +
            typeHtml +
          '</div>' +
          '<div class="shift-card-body">' +
            '<div class="shift-main-row">' +
              dateTimeHtml +
              durationHtml +
            '</div>' +
            directionHtml +
            technicalHtml +
            fuelNoteHtml +
            '<div class="shift-income-row">' +
              incomeLabelHtml +
              incomeHtml +
            '</div>' +
          '</div>' +
        '</div>';
    }

    function buildShiftDetailContentHtml(shift, shiftIncomeMap) {
      if (!shift) return '';
      var parsedStart = parseMsk(shift.start_msk);
      var parsedEnd = parseMsk(shift.end_msk);
      var durationLabel = getShiftDurationLabelText(fmtShift(shift).dur);
      var incomeVm = getShiftIncomeViewModel(shift, shiftIncomeMap);
      var shiftType = getShiftTypeLabel(shift);
      var direction = getShiftDirectionLineText(shift);
      var locoSummary = getLocoSummary(shift);
      var trainSummary = getTrainSummary(shift);
      var fuelTotals = getFuelConsumptionTotalsFromShift(shift);
      var fuelReceiveSummary = buildFuelSideSummary(shift, 'receive');
      var fuelHandoverSummary = buildFuelSideSummary(shift, 'handover');
      var syncStatus = isShiftPending(shift) ? 'Не синхронизировано' : 'Синхронизировано';
      var periodLabel = parsedStart && parsedEnd
        ? formatHoursAndMinutes(Math.max(0, Math.round((parsedEnd.getTime() - parsedStart.getTime()) / 60000)))
        : '—';
      var salaryText = incomeVm && incomeVm.hasValue ? incomeVm.amountText : '—';

      var html = '';
      var shiftIdAttr = escapeHtml(String(shift.id || ''));
      var poekhaliActionSummary = [direction, trainSummary].filter(function(item) {
        return item && item !== '—';
      }).join(' · ');
      if (shiftIdAttr) {
        html += '<section class="shift-detail-section shift-detail-poekhali-action-section">';
        html += '<button type="button" class="shift-detail-poekhali-btn" data-poekhali-shift-id="' + shiftIdAttr + '">';
        html += '<span class="shift-detail-poekhali-btn-main">Открыть в Поехали</span>';
        if (poekhaliActionSummary) {
          html += '<span class="shift-detail-poekhali-btn-sub">' + escapeHtml(poekhaliActionSummary) + '</span>';
        }
        html += '</button>';
        html += '</section>';
      }

      html += '<section class="shift-detail-section">';
      html += '<div class="shift-detail-section-title">Время</div>';
      html += '<div class="shift-detail-list">';
      html += buildShiftDetailRowHtml('Начало', formatLocalDateTimeFromMsk(shift.start_msk));
      html += buildShiftDetailRowHtml('Конец', formatLocalDateTimeFromMsk(shift.end_msk));
      html += buildShiftDetailRowHtml('Длительность', durationLabel === '—' ? periodLabel : durationLabel);
      html += '</div>';
      html += '</section>';

      html += '<section class="shift-detail-section">';
      html += '<div class="shift-detail-section-title">Маршрут</div>';
      html += '<div class="shift-detail-list">';
      html += buildShiftDetailRowHtml('Тип', shiftType);
      html += buildShiftDetailRowHtml('Участок', direction);
      html += '</div>';
      html += '</section>';

      html += '<section class="shift-detail-section">';
      html += '<div class="shift-detail-section-title">Техника</div>';
      html += '<div class="shift-detail-list">';
      html += buildShiftDetailRowHtml('Локомотив', locoSummary);
      html += buildShiftDetailRowHtml('Поезд', trainSummary);
      html += '</div>';
      html += '</section>';

      if (hasShiftPoekhaliData(shift)) {
        html += '<section class="shift-detail-section">';
        html += '<div class="shift-detail-section-title">Поехали</div>';
        html += '<div class="shift-detail-list">';
        html += buildShiftDetailRowHtml('Статус', getShiftPoekhaliStatusLabel(shift.poekhali_status));
        html += buildShiftDetailRowHtml('Карта', shift.poekhali_map_title || shift.poekhali_map_id || shift.poekhali_warning_rules_map_title || shift.poekhali_warning_rules_map_id);
        html += buildShiftDetailRowHtml('Направление', shift.poekhali_direction);
        html += buildShiftDetailRowHtml('Путь', shift.poekhali_track);
        html += buildShiftDetailRowHtml('Состав', formatShiftPoekhaliTrainLength(shift));
        html += buildShiftDetailRowHtml('Старт', formatShiftPoekhaliDateTime(shift.poekhali_started_at));
        html += buildShiftDetailRowHtml('Финиш', formatShiftPoekhaliDateTime(shift.poekhali_ended_at));
        html += buildShiftDetailRowHtml('Время', formatShiftPoekhaliDuration(shift.poekhali_duration_ms));
        html += buildShiftDetailRowHtml('В движении', formatShiftPoekhaliDuration(shift.poekhali_moving_ms));
        html += buildShiftDetailRowHtml('Стоянки', formatShiftPoekhaliDuration(shift.poekhali_idle_ms));
        html += buildShiftDetailRowHtml('Дистанция', formatShiftPoekhaliDistance(shift.poekhali_distance_m));
        html += buildShiftDetailRowHtml('Техническая', formatShiftPoekhaliSpeed(shift.poekhali_technical_speed_kmh));
        html += buildShiftDetailRowHtml('Средняя', formatShiftPoekhaliSpeed(shift.poekhali_average_speed_kmh));
        html += buildShiftDetailRowHtml('Максимальная', formatShiftPoekhaliSpeed(shift.poekhali_max_speed_kmh));
        html += buildShiftDetailRowHtml('Ограничение', formatShiftPoekhaliActiveRestriction(shift));
        html += buildShiftDetailRowHtml('Следующее ограничение', formatShiftPoekhaliNextRestriction(shift));
        html += buildShiftDetailRowHtml('Следующий светофор', formatShiftPoekhaliNextObject(shift, 'next_signal'));
        html += buildShiftDetailRowHtml('Следующая станция', formatShiftPoekhaliNextObject(shift, 'next_station'));
        html += buildShiftDetailRowHtml('Маршрут Поехали', formatShiftPoekhaliRouteProgress(shift));
        html += buildShiftDetailRowHtml('Цель впереди', formatShiftPoekhaliNavigationTarget(shift));
        html += buildShiftDetailRowHtml('Оповещения', getShiftPoekhaliNumber(shift, 'poekhali_alert_count') > 0 ? String(getShiftPoekhaliNumber(shift, 'poekhali_alert_count')) : '');
        html += buildShiftDetailRowHtml('Последнее оповещение', formatShiftPoekhaliLastAlert(shift));
        html += buildShiftDetailRowHtml('Превышение', getShiftPoekhaliNumber(shift, 'poekhali_overspeed_max_kmh') > 0 ? '+' + getShiftPoekhaliNumber(shift, 'poekhali_overspeed_max_kmh') + ' км/ч' : '');
        html += buildShiftDetailRowHtml('Время превышения', formatShiftPoekhaliDuration(shift.poekhali_overspeed_duration_ms));
        html += buildShiftDetailRowHtml('Путь превышения', formatShiftPoekhaliDistance(shift.poekhali_overspeed_distance_m));
        html += buildShiftDetailRowHtml('Предупреждения', hasShiftPoekhaliData(shift) ? String(getShiftPoekhaliNumber(shift, 'poekhali_warnings_count')) : '');
        html += buildShiftDetailRowHtml('ПР смены', formatShiftPoekhaliWarningRules(shift));
        html += buildShiftDetailRowHtml('Список ПР', shift.poekhali_warning_rules_summary || '');
        html += buildShiftDetailRowHtml('Откуда', formatShiftPoekhaliPoint(shift, 'start'));
        html += buildShiftDetailRowHtml('Куда', formatShiftPoekhaliPoint(shift, 'end'));
        html += buildShiftDetailRowHtml('GPS участок', shift.poekhali_user_section_title || shift.poekhali_user_section_id);
        html += buildShiftDetailRowHtml('Статус участка', getShiftPoekhaliSectionStatusLabel(shift.poekhali_user_section_status));
        html += buildShiftDetailRowHtml('Опорный ЭК', shift.poekhali_user_section_reference_sector ? 'уч. ' + shift.poekhali_user_section_reference_sector : '');
        html += buildShiftDetailRowHtml('Объекты участка', shift.poekhali_user_section_id ? String(getShiftPoekhaliNumber(shift, 'poekhali_user_section_objects_count')) : '');
        html += buildShiftDetailRowHtml('Скорости участка', shift.poekhali_user_section_id ? String(getShiftPoekhaliNumber(shift, 'poekhali_user_section_speeds_count')) : '');
        html += '</div>';
        html += '</section>';
      }

      html += '<section class="shift-detail-section">';
      html += '<div class="shift-detail-section-title">Топливо</div>';
      html += '<div class="shift-detail-list">';
      html += buildShiftDetailRowHtml('Расход', hasFuelData(shift) ? getFuelConsumptionInlineText(fuelTotals) : '');
      html += buildShiftDetailRowHtml('Приём', fuelReceiveSummary);
      html += buildShiftDetailRowHtml('Сдача', fuelHandoverSummary);
      html += '</div>';
      html += '</section>';

      html += '<section class="shift-detail-section">';
      html += '<div class="shift-detail-section-title">Расчёт</div>';
      html += '<div class="shift-detail-list">';
      html += buildShiftDetailRowHtml('Доход за эту смену', salaryText);
      html += buildShiftDetailRowHtml('Синхронизация', syncStatus);
      html += '</div>';
      html += '<div class="shift-detail-note">Время вы указываете в МСК, а часы приложение пересчитывает по локальному времени устройства.</div>';
      html += '</section>';

      return html;
    }

    function renderShiftDetailById(shiftId) {
      if (!SHIFT_DETAIL_HERO_SLOT || !SHIFT_DETAIL_CONTENT || !SHIFT_DETAIL_TITLE) return;
      var shift = findShiftById(shiftId);
      if (!shift) {
        SHIFT_DETAIL_HERO_SLOT.innerHTML = '';
        SHIFT_DETAIL_CONTENT.innerHTML = '';
        SHIFT_DETAIL_TITLE.textContent = 'Запись не найдена';
        return;
      }
      var shiftTitle = getShiftTitle(shift);
      SHIFT_DETAIL_TITLE.textContent = shiftTitle || 'Подробности смены';
      SHIFT_DETAIL_HERO_SLOT.innerHTML = buildShiftDetailHeroCardHtml(shift, currentMonthShiftIncomeMap);
      SHIFT_DETAIL_CONTENT.innerHTML = buildShiftDetailContentHtml(shift, currentMonthShiftIncomeMap);
    }

    function buildRestGapHtml(restInfo, compact) {
      if (!restInfo) return '';
      var classes = 'shift-rest-gap' + (compact ? ' is-compact' : '');
      if (restInfo.kind === 'ok' && restInfo.isShort) classes += ' is-short';
      if (restInfo.kind === 'overlap' || restInfo.kind === 'invalid') classes += ' is-problem';
      if (restInfo.kind === 'unavailable') classes += ' is-muted';

      return '' +
        '<div class="' + classes + '" aria-label="' + escapeHtml(restInfo.label) + '">' +
          '<span class="shift-rest-gap-line" aria-hidden="true"></span>' +
          '<span class="shift-rest-gap-label">' + escapeHtml(restInfo.label) + '</span>' +
          '<span class="shift-rest-gap-line" aria-hidden="true"></span>' +
        '</div>';
    }

