    if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('time-utils', 'v392');

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

    function getLatestManualShiftId(shifts) {
      if (!Array.isArray(shifts) || !shifts.length) return '';
      var latest = null;
      for (var i = 0; i < shifts.length; i++) {
        var candidate = shifts[i];
        if (!candidate || candidate.id === null || candidate.id === undefined || candidate.id === '') continue;
        if (typeof isLegacyGeneratedShift === 'function' && isLegacyGeneratedShift(candidate)) continue;
        if (!latest) {
          latest = candidate;
          continue;
        }
        var byStart = compareShiftsByStartDesc(candidate, latest);
        if (byStart < 0) {
          latest = candidate;
          continue;
        }
        if (byStart !== 0) continue;
        var candidateCreated = new Date(candidate.created_at || 0).getTime();
        var latestCreated = new Date(latest.created_at || 0).getTime();
        if ((isFinite(candidateCreated) ? candidateCreated : 0) > (isFinite(latestCreated) ? latestCreated : 0)) {
          latest = candidate;
        }
      }
      return latest ? String(latest.id) : '';
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
      if (typeof editingShiftId !== 'undefined' && editingShiftId) return;

      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');
      if (!startDateEl || !startTimeEl || !endDateEl || !endTimeEl) return;

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

      if (typeof renderDraftShiftSummary === 'function') renderDraftShiftSummary();
    }

    function syncEndFromStart() {
      if (typeof editingShiftId !== 'undefined' && editingShiftId) return;

      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');
      if (!startDateEl || !startTimeEl || !endDateEl || !endTimeEl) return;
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
      if (iconName === 'sun') {
        return '<svg ' + common + '><circle cx="10" cy="10" r="3.2"></circle><path d="M10 2.5v1.5"></path><path d="M10 16v1.5"></path><path d="M2.5 10H4"></path><path d="M16 10h1.5"></path><path d="M4.5 4.5l1 1"></path><path d="M14.5 14.5l1 1"></path><path d="M15.5 4.5l-1 1"></path><path d="M5.5 14.5l-1 1"></path></svg>';
      }
      if (iconName === 'moon') {
        return '<svg ' + common + '><path d="M16.5 11.8A6.6 6.6 0 1 1 8.2 3.5a5.1 5.1 0 0 0 8.3 8.3Z"></path></svg>';
      }
      if (iconName === 'star') {
        return '<svg ' + common + '><path d="m10 3 2.2 5 5.3.5-4 3.6 1.2 5.3L10 14.4 5.3 17.4l1.2-5.3-4-3.6 5.3-.5Z"></path></svg>';
      }
      if (iconName === 'length') {
        return '<svg ' + common + '><path d="M3.5 10h13"></path><path d="M5 7.5v5"></path><path d="M15 7.5v5"></path><path d="M9 8.5v3"></path><path d="M11 8.5v3"></path></svg>';
      }
      if (iconName === 'flag') {
        return '<svg ' + common + '><path d="M5 17V3"></path><path d="M5 3h9l-2 3.5L14 10H5"></path></svg>';
      }
      if (iconName === 'up') {
        return '<svg ' + common + '><path d="m6 14 4-6 4 6"></path><path d="M10 8v9"></path></svg>';
      }
      if (iconName === 'percent') {
        return '<svg ' + common + '><path d="M5 15 15 5"></path><circle cx="6.5" cy="6.5" r="1.8"></circle><circle cx="13.5" cy="13.5" r="1.8"></circle></svg>';
      }
      if (iconName === 'snow') {
        return '<svg ' + common + '><path d="M10 2v16"/><path d="M2 10h16"/><path d="M4.5 4.5l11 11"/><path d="M15.5 4.5l-11 11"/><path d="M7.5 4l2.5 2 2.5-2"/><path d="M7.5 16l2.5-2 2.5 2"/><path d="M4 7.5l2 2.5-2 2.5"/><path d="M16 7.5l-2 2.5 2 2.5"/></svg>';
      }
      return '<svg ' + common + '><rect x="3.5" y="4.5" width="13" height="12" rx="2.2"></rect><path d="M7 3.5v2"></path><path d="M13 3.5v2"></path><path d="M3.5 8h13"></path></svg>';
    }

    function getShiftConsistDescriptor(shift) {
      if (!shift) return null;
      var loco = '';
      // Shifts are saved with locomotive_series/_number; keep loco_series/_number
      // as a fallback for any older records.
      var locoSeries = shift.locomotive_series || shift.loco_series || '';
      var locoNumber = shift.locomotive_number || shift.loco_number || '';
      if (locoSeries && locoNumber) {
        loco = String(locoSeries) + ' № ' + String(locoNumber);
      } else if (locoSeries) {
        loco = String(locoSeries);
      } else if (locoNumber) {
        loco = '№ ' + String(locoNumber);
      }
      var weight = shift.train_weight ? Number(shift.train_weight) : 0;
      var axles = shift.train_axles ? Number(shift.train_axles) : 0;
      var length = shift.train_length ? Number(shift.train_length) : 0;
      var trainNumber = shift.train_number ? String(shift.train_number) : '';
      return {
        loco: loco,
        weight: weight > 0 ? weight : 0,
        axles: axles > 0 ? axles : 0,
        length: length > 0 ? length : 0,
        trainNumber: trainNumber
      };
    }

    function buildShiftMarkHtml(shift, isHoliday) {
      var code = inferShiftWorkCodeByLocalTime(shift);
      var icon = 'sun';
      var mark = '';
      if (isHoliday) { icon = 'star'; mark = 'hol'; }
      else if (code === 'N') { icon = 'moon'; mark = 'night'; }
      return '<div class="shift-type-mark' + (mark ? ' ' + mark : '') + '" aria-hidden="true">' + getShiftInlineIconSvg(icon) + '</div>';
    }

    function ruNum(n) {
      try { return Number(n).toLocaleString('ru-RU'); }
      catch (e) { return String(n); }
    }

    function buildShiftConsistHtml(shift, incomeText, durationText) {
      // Calm labelled key→value grid (two columns). Every value gets a small
      // label so nothing needs to be guessed by icon, and all fields read with
      // equal weight. Only Время (accent) and Доход (green) carry a colour, as a
      // quiet summary pair at the bottom; everything else stays neutral.
      var c = getShiftConsistDescriptor(shift) || {};
      var rows = [];
      function pushRow(label, value, cls) {
        rows.push('<div class="sc-row"><span class="sc-lab">' + escapeHtml(label) + '</span>' +
          '<span class="sc-val' + (cls ? ' ' + cls : '') + '">' + escapeHtml(value) + '</span></div>');
      }
      if (c.loco) pushRow('Лок.', c.loco);
      if (c.trainNumber) pushRow('Поезд', '№ ' + c.trainNumber);
      if (c.weight > 0) pushRow('Вес', ruNum(c.weight) + ' т');
      if (c.length > 0) pushRow('Длина', ruNum(c.length) + ' усл.');
      if (c.axles > 0) pushRow('Оси', ruNum(c.axles));
      // Fuel consumption — neutral, like any other data point.
      try {
        if (typeof hasFuelData === 'function' && hasFuelData(shift) && typeof getFuelConsumptionTotalsFromShift === 'function') {
          var ft = getFuelConsumptionTotalsFromShift(shift);
          if (ft && ft.consumptionKg > 0) {
            pushRow('Расход', ruNum(ft.consumptionKg) + ' кг');
          }
        }
      } catch (e) {}
      // Время + Доход close the grid as the accented summary pair.
      var durStr = (durationText && String(durationText).trim() && String(durationText).trim() !== '—') ? String(durationText).trim() : '';
      if (durStr) pushRow('Время', durStr, 'is-time');
      var incomeStr = (incomeText && String(incomeText).trim() && String(incomeText).trim() !== '—') ? String(incomeText).trim() : '';
      if (incomeStr) pushRow('Доход', incomeStr, 'is-income');

      if (!rows.length) return '';
      return '<div class="shift-consist-grid">' + rows.join('') + '</div>';
    }

    function buildShiftCompactDateLine(shift) {
      try {
        var s = parseMsk(shift && shift.start_msk);
        var e = parseMsk(shift && shift.end_msk);
        if (!s || !e) return '';
        var months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
        // parseMsk returns the UTC instant; read MSK clock by shifting +MSK_OFFSET
        // and using UTC getters, so the display is Moscow time on any device.
        function mskParts(dt) {
          var x = new Date(dt.getTime() + MSK_OFFSET * 3600000);
          return { d: x.getUTCDate(), mo: x.getUTCMonth(), dow: x.getUTCDay(), h: x.getUTCHours(), mi: x.getUTCMinutes() };
        }
        function hhmm(p) { return String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0'); }
        var sp = mskParts(s);
        var ep = mskParts(e);
        var startHM = hhmm(sp);
        var endHM = hhmm(ep);
        // Overnight shift: show the end date too, so it's clear work ends next day.
        var sameDay = sp.d === ep.d && sp.mo === ep.mo;
        var endLabel = sameDay ? endHM : (ep.d + ' ' + months[ep.mo] + ' ' + endHM);
        return sp.d + ' ' + months[sp.mo] + ' · ' + startHM + ' → ' + endLabel;
      } catch (err) { return ''; }
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

    function formatPoekhaliTargetEta(value) {
      return String(formatShiftPoekhaliEta(value, true) || '').replace(/^~/, '').trim();
    }

    var POEKHALI_STATION_NAME_OVERRIDES = {
      'постыш': 'Постышево',
      'силинк': 'Силинка',
      'хальга': 'Хальгасо',
      'хальгас': 'Хальгасо',
      'лиан': 'Лиан',
      'холони': 'Холони',
      'хурму': 'Хурмули',
      'хурмул': 'Хурмули',
      'маврин': 'Мавринский',
      'пиль': 'Пиль',
      'горин': 'Горин',
      'харпич': 'Харпичан',
      'катама': 'Катама',
      'эворон': 'Эворон',
      'мони': 'Мони',
      'апкан': 'Апкан',
      'болен': 'Болен',
      'дуки': 'Дуки'
    };

    function resolvePoekhaliKomsomolskStationName(coordinate) {
      var numericCoordinate = Math.max(0, Math.round(Number(coordinate) || 0));
      if (numericCoordinate >= 3810000 && numericCoordinate <= 3816500) return 'Комсомольск-2';
      if (numericCoordinate >= 350000 && numericCoordinate <= 365000) return 'Комсомольск Грузовой';
      if ((numericCoordinate >= 320000 && numericCoordinate < 350000) || numericCoordinate <= 5000) return 'Комсомольск-Сортировочный';
      return 'Комсомольск-Сортировочный';
    }

    function formatPoekhaliHumanObjectName(value, kind, coordinate) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      text = text.replace(/^ст\.?\s+/i, '');
      var lowerText = text.toLowerCase();
      if (lowerText === 'комсом' || lowerText === 'комсомольск') text = resolvePoekhaliKomsomolskStationName(coordinate);
      else if (POEKHALI_STATION_NAME_OVERRIDES[lowerText]) text = POEKHALI_STATION_NAME_OVERRIDES[lowerText];
      else if (lowerText === 'скоро') text = 'Огр.';
      text = text.replace(/\s+\(/g, '(').replace(/,\s*/g, ', ').replace(/\s+/g, ' ').trim();
      return text;
    }

    function formatPoekhaliTargetTitle(target) {
      if (!target) return '';
      var label = String(target.label || target.name || '').trim();
      var kind = String(target.kind || '');
      if (!label) return '';
      var humanLabel = formatPoekhaliHumanObjectName(label, kind, target.coordinate || target.coordinateMeters);
      if (kind === 'station') return 'ст ' + humanLabel;
      if (kind === 'signal') return humanLabel.indexOf('Светофор ') === 0 ? humanLabel : 'Светофор ' + humanLabel;
      return humanLabel;
    }

    function formatPoekhaliNavigationTargetDisplay(target) {
      if (!target) return '';
      var title = formatPoekhaliTargetTitle(target);
      if (!title) return '';
      var distance = Math.max(0, Math.round(Number(target.distanceMeters) || 0));
      var eta = formatPoekhaliTargetEta(target.etaSeconds);
      var text = distance > 0 ? title + ' через ' + formatShiftPoekhaliDistance(distance) : title;
      if (eta && distance > 0) text += ' | ' + eta;
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
      return (isFinite(numericSector) && numericSector > 0 ? 'уч. ' + Math.round(numericSector) + ', ' : '') + km + ' км ' + pk + ' пк';
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

    function formatShiftPoekhaliNavigationTarget(shift) {
      if (!shift) return '';
      return formatPoekhaliNavigationTargetDisplay({
        kind: shift.poekhali_next_target_kind,
        label: shift.poekhali_next_target_label,
        distanceMeters: getShiftPoekhaliNumber(shift, 'poekhali_next_target_distance_m'),
        etaSeconds: getShiftPoekhaliNumber(shift, 'poekhali_next_target_eta_s'),
        coordinate: getShiftPoekhaliNumber(shift, 'poekhali_next_target_coordinate')
      });
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

    function getShiftCardDigitsValue(shift, primaryKey, fallbackKey, maxLen) {
      var raw = getShiftCardTextValue(shift, primaryKey, fallbackKey);
      var digits = String(raw || '').replace(/\D+/g, '');
      var limit = Math.max(0, Math.round(Number(maxLen) || 0));
      if (limit) digits = digits.slice(0, limit);
      return Number(digits) > 0 ? digits : '';
    }

    function isShiftCardPlaceholderText(value) {
      var text = String(value || '').trim().toLowerCase();
      return !text ||
        text === 'локомотив' ||
        text === 'нет данных' ||
        text === 'нет смены' ||
        text === 'нет состава' ||
        text === 'только лок.' ||
        text === 'только локомотив';
    }

    function getShiftCardTrainLengthText(shift) {
      var direct = getShiftCardDigitsValue(shift, 'train_length', 'poekhali_train_wagons', 3);
      if (direct) return direct + ' ваг';
      var compositionType = String(shift && shift.poekhali_train_composition_type || '').trim();
      var label = String(shift && shift.poekhali_train_length_label || '').trim();
      if ((compositionType === 'train' || compositionType === 'estimated' || /\d/.test(label)) &&
        !isShiftCardPlaceholderText(label)) {
        return label.replace(/\s*уд\./i, ' ваг.');
      }
      var meters = getShiftPoekhaliNumber(shift, 'poekhali_train_length_m');
      if ((compositionType === 'train' || compositionType === 'estimated' || meters > 51) && meters > 0) return meters + ' м';
      return '';
    }

    function formatShiftCardPoekhaliTrainLength(shift) {
      var compositionType = String(shift && shift.poekhali_train_composition_type || '').trim();
      var label = String(shift && shift.poekhali_train_length_label || '').trim();
      var meters = getShiftPoekhaliNumber(shift, 'poekhali_train_length_m');
      var hasActualComposition = compositionType === 'train' || compositionType === 'estimated' ||
        (/\d/.test(label) && !isShiftCardPlaceholderText(label)) ||
        meters > 51;
      if (!hasActualComposition || !meters) return '';
      var source = String(shift && shift.poekhali_train_length_source || '').trim();
      var text = meters + ' м';
      if (source === 'по осям') text = '~' + text;
      if (label && label !== text && !isShiftCardPlaceholderText(label)) text += ' · ' + label.replace(/\s*уд\./i, ' ваг.');
      if (source && !isShiftCardPlaceholderText(source)) text += ' · ' + source;
      return text;
    }

    function getShiftTechnicalRows(shift) {
      var rows = [];
      if (!shift) return rows;
      var loco = getLocoSummary(shift) || getShiftCardTextValue(shift, 'locomotive_summary', 'poekhali_loco');
      if (isShiftCardPlaceholderText(loco)) loco = '';
      var trainNumber = getShiftCardDigitsValue(shift, 'train_number', 'poekhali_train_number', 4);
      var trainWeight = getShiftCardDigitsValue(shift, 'train_weight', 'poekhali_train_weight', 4);
      var trainAxles = getShiftCardDigitsValue(shift, 'train_axles', 'poekhali_train_axles', 3);
      var trainLength = getShiftCardTrainLengthText(shift);
      var identityItems = [];
      var compositionItems = [];
      if (loco) identityItems.push({ icon: 'locomotive', text: loco.replace('№ ', '№') });
      if (trainNumber) identityItems.push({ icon: 'train', text: '№' + trainNumber });
      if (trainWeight) compositionItems.push({ icon: 'train', text: trainWeight + ' т' });
      if (trainAxles) compositionItems.push({ icon: 'axles', text: trainAxles + ' оси' });
      if (trainLength) compositionItems.push({ icon: 'wagon', text: trainLength });
      if (identityItems.length) rows.push(identityItems);
      if (compositionItems.length) rows.push(compositionItems);
      return rows;
    }

    function buildShiftTechnicalHtml(shift) {
      var rows = getShiftTechnicalRows(shift);
      if (!rows.length) return '';

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

      var html = '<div class="shift-tech-line">';
      for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        html += '<div class="shift-tech-row shift-tech-row-' + (rowIndex + 1) + '">' + renderTechRow(rows[rowIndex]) + '</div>';
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

    function getShiftDetailValueLines(displayText, options) {
      var text = getShiftDetailValue(displayText);
      var lines = [];
      var rawLines = options && Array.isArray(options.lines) ? options.lines : null;
      if (rawLines) {
        for (var i = 0; i < rawLines.length; i++) {
          var prepared = getShiftDetailValue(rawLines[i]);
          if (prepared) lines.push(prepared);
        }
      } else if (text && !(options && options.split === false) && text.indexOf(' · ') !== -1 && text.length > 26) {
        var parts = text.split(/\s+·\s+/);
        for (var j = 0; j < parts.length; j++) {
          var part = getShiftDetailValue(parts[j]);
          if (part) lines.push(part);
        }
      }
      if (!lines.length && text) lines.push(text);
      return lines;
    }

    function shouldStackShiftDetailValue(displayText, lines, options) {
      if (options && options.stacked === true) return true;
      if (options && options.inline === true) return false;
      if (lines && lines.length > 1) return true;
      return getShiftDetailValue(displayText).length > 34;
    }

    function buildShiftDetailValueHtml(lines) {
      var source = Array.isArray(lines) ? lines : [];
      if (source.length <= 1) return escapeHtml(source[0] || '');
      var html = '';
      for (var i = 0; i < source.length; i++) {
        html += '<span class="shift-detail-value-line' + (i === 0 ? ' is-primary' : '') + '">' + escapeHtml(source[i]) + '</span>';
      }
      return '<span class="shift-detail-value-lines">' + html + '</span>';
    }

    function buildShiftDetailRowHtml(label, value, emptyText, options) {
      if (emptyText && typeof emptyText === 'object') {
        options = emptyText;
        emptyText = '';
      }
      var prepared = getShiftDetailValue(value);
      var hasValue = !!prepared;
      var displayText = hasValue ? prepared : (emptyText || '—');
      var lines = hasValue ? getShiftDetailValueLines(displayText, options) : [displayText];
      var isStacked = hasValue && shouldStackShiftDetailValue(displayText, lines, options);
      return '' +
        '<div class="shift-detail-row' + (isStacked ? ' is-stacked' : '') + '">' +
          '<span class="shift-detail-key">' + escapeHtml(label) + '</span>' +
          '<span class="shift-detail-value' + (hasValue ? '' : ' is-empty') + (lines.length > 1 ? ' has-lines' : '') + '">' + buildShiftDetailValueHtml(lines) + '</span>' +
        '</div>';
    }

    function buildShiftDetailOptionalRowHtml(label, value, options) {
      return getShiftDetailValue(value) ? buildShiftDetailRowHtml(label, value, '', options) : '';
    }

    function buildShiftDetailPayoutBreakdownHtml(shift) {
      if (!shift) return '';
      var settings = (typeof appSettings === 'object' && appSettings) ? appSettings : {};
      var tariff = Number(settings.tariffRate) || 0;
      if (tariff <= 0) return ''; // no point showing breakdown without tariff configured

      // Minutes
      var totalMin = (typeof shiftTotalMinutes === 'function') ? shiftTotalMinutes(shift) : 0;
      var nightMin = (typeof shiftNightMinutesInRange === 'function')
        ? shiftNightMinutesInRange(shift, -8640000000000000, 8640000000000000) : 0;
      var holidayMin = (typeof shiftHolidayMinutesInRange === 'function')
        ? shiftHolidayMinutesInRange(shift, -8640000000000000, 8640000000000000) : 0;
      if (totalMin <= 0) return '';

      var nightPct = Number(settings.nightPercent) || 0;
      var classPct = Number(settings.classPercent) || 0;

      var hours = totalMin / 60;
      var nightHours = nightMin / 60;
      var holidayHours = holidayMin / 60;

      function fmtRub(n) {
        var v = Math.round(Number(n) || 0);
        try { return v.toLocaleString('ru-RU') + ' ₽'; }
        catch (e) { return v + ' ₽'; }
      }
      function fmtHM(min) {
        if (!isFinite(min) || min <= 0) return '0 ч';
        var h = Math.floor(min / 60);
        var m = Math.round(min % 60);
        if (h && m) return h + ' ч ' + m + ' м';
        if (h) return h + ' ч';
        return m + ' м';
      }

      var oklad = hours * tariff;
      var nightSum = nightHours * tariff * (nightPct / 100);
      var holidaySum = holidayHours * tariff;  // двойная оплата → +1× тарифа
      var classSum = hours * tariff * (classPct / 100);

      function row(icon, name, sub, val, sign) {
        var prefix = sign === '+' ? '+ ' : '';
        return '<div class="brk-row">' +
          '<div class="brk-ico ' + (icon.tone || '') + '">' + getShiftInlineIconSvg(icon.name) + '</div>' +
          '<div><div class="brk-name">' + escapeHtml(name) + '</div>' +
          (sub ? '<div class="brk-sub">' + escapeHtml(sub) + '</div>' : '') +
          '</div>' +
          '<div class="brk-val num">' + prefix + fmtRub(val) + '</div>' +
        '</div>';
      }

      var rows = '';
      rows += row({ name: 'sun' }, 'Оклад · ' + fmtHM(totalMin), 'по тарифу ' + fmtRub(tariff).replace(' ₽','') + ' ₽/ч', oklad);
      if (nightMin > 0 && nightPct > 0) {
        rows += row({ name: 'moon', tone: 'n' }, 'Ночные · ' + fmtHM(nightMin), 'надбавка ' + nightPct + '%', nightSum, '+');
      }
      if (holidayMin > 0) {
        rows += row({ name: 'star', tone: 'h' }, 'Праздничные · ' + fmtHM(holidayMin), 'двойная оплата', holidaySum, '+');
      }
      if (classPct > 0) {
        rows += row({ name: 'star', tone: 'h' }, 'Классная квалификация', '+' + classPct + '% к тарифу', classSum, '+');
      }
      var total = oklad + nightSum + holidaySum + classSum;
      rows += '<div class="brk-row brk-total">' +
        '<div class="brk-ico b">' + getShiftInlineIconSvg('income') + '</div>' +
        '<div><div class="brk-name">Итого по смене</div><div class="brk-sub">до коэффициентов</div></div>' +
        '<div class="brk-val num" style="color:var(--good)">' + fmtRub(total) + '</div>' +
      '</div>';

      return '' +
        '<div class="shift-detail-section-title" style="margin-top:14px;">Расчёт</div>' +
        '<div class="brk">' + rows + '</div>';
    }

    function buildShiftDetailMetricGridHtml(items) {
      var source = Array.isArray(items) ? items : [];
      var cells = '';
      for (var i = 0; i < source.length; i++) {
        var item = source[i] || {};
        var value = getShiftDetailValue(item.value);
        if (!value) continue;
        var tone = item.tone ? ' is-' + item.tone : '';
        cells += '' +
          '<div class="shift-detail-metric' + tone + '">' +
            '<span class="shift-detail-metric-label">' + escapeHtml(item.label || '') + '</span>' +
            '<strong class="shift-detail-metric-value">' + escapeHtml(value) + '</strong>' +
          '</div>';
      }
      return cells ? '<div class="shift-detail-metrics">' + cells + '</div>' : '';
    }

    function buildShiftDetailSubsectionHtml(title, rowsHtml) {
      var body = getShiftDetailValue(rowsHtml);
      if (!body) return '';
      return '' +
        '<div class="shift-detail-subsection">' +
          '<div class="shift-detail-subsection-title">' + escapeHtml(title || '') + '</div>' +
          '<div class="shift-detail-list">' + rowsHtml + '</div>' +
        '</div>';
    }

    function buildShiftDetailDisclosureHtml(title, hint, bodyHtml) {
      var body = getShiftDetailValue(bodyHtml);
      if (!body) return '';
      var hintHtml = hint ? '<span class="shift-detail-disclosure-hint">' + escapeHtml(hint) + '</span>' : '';
      return '' +
        '<details class="shift-detail-disclosure">' +
          '<summary class="shift-detail-disclosure-summary">' +
            '<span class="shift-detail-disclosure-title">' + escapeHtml(title || '') + '</span>' +
            hintHtml +
            '<span class="shift-detail-disclosure-icon" aria-hidden="true"></span>' +
          '</summary>' +
          '<div class="shift-detail-disclosure-body">' + bodyHtml + '</div>' +
        '</details>';
    }

    function buildShiftDetailHeroCardHtml(shift, shiftIncomeMap) {
      if (!shift) return '';
      var f = fmtShift(shift);
      var p = getShiftDisplayParts(shift);
      var shiftPending = isShiftPending(shift);
      var directionText = getShiftDirectionLineText(shift);
      var dateTimeText = getShiftDateTimeLineLabel(p);
      var durationText = getShiftDurationLabelText(f.dur);
      var incomeVm = getShiftIncomeViewModel(shift, shiftIncomeMap);
      var holidayMin = (typeof shiftHolidayMinutesInRange === 'function')
        ? shiftHolidayMinutesInRange(shift, -8640000000000000, 8640000000000000) : 0;
      var isHolidayShift = holidayMin > 0;
      var markHtml = buildShiftMarkHtml(shift, isHolidayShift);
      var c = getShiftConsistDescriptor(shift) || {};
      var heroLines = [];
      heroLines.push('<div class="ln"><span class="ln-ico">' + getShiftInlineIconSvg('duration') + '</span><span>' + escapeHtml(dateTimeText) + ' · <span class="num" style="color:var(--ink)">' + escapeHtml(durationText) + '</span></span></div>');
      if (c.loco) {
        heroLines.push('<div class="ln"><span class="ln-ico">' + getShiftInlineIconSvg('locomotive') + '</span><span class="num">' + escapeHtml(c.loco) + (c.trainNumber ? ' · поезд № ' + escapeHtml(c.trainNumber) : '') + '</span></div>');
      } else if (c.trainNumber) {
        heroLines.push('<div class="ln"><span class="ln-ico">' + getShiftInlineIconSvg('train') + '</span><span class="num">поезд № ' + escapeHtml(c.trainNumber) + '</span></div>');
      }
      if (c.weight > 0 || c.axles > 0) {
        var wParts = [];
        if (c.weight > 0) wParts.push(ruNum(c.weight) + ' т');
        if (c.axles > 0) wParts.push(c.axles + ' осей');
        heroLines.push('<div class="ln"><span class="ln-ico">' + getShiftInlineIconSvg('axles') + '</span><span class="num">' + wParts.join(' · ') + '</span></div>');
      }
      if (c.length > 0) {
        heroLines.push('<div class="ln"><span class="ln-ico">' + getShiftInlineIconSvg('length') + '</span><span class="num">' + ruNum(c.length) + ' усл. длина</span></div>');
      }
      var fuelTotalsText = '';
      try {
        if (typeof hasFuelData === 'function' && hasFuelData(shift) && typeof getFuelConsumptionInlineText === 'function' && typeof getFuelConsumptionTotalsFromShift === 'function') {
          fuelTotalsText = getFuelConsumptionInlineText(getFuelConsumptionTotalsFromShift(shift));
        }
      } catch (e) { fuelTotalsText = ''; }
      if (fuelTotalsText) {
        heroLines.push('<div class="ln"><span class="ln-ico">' + getShiftInlineIconSvg('fuel') + '</span><span>' + escapeHtml(fuelTotalsText) + '</span></div>');
      }
      var incomeAmount = incomeVm && incomeVm.hasValue ? escapeHtml(String(incomeVm.amountText || incomeVm.label).trim()) : '';
      var shiftIdAttr = escapeHtml(String(shift.id || ''));
      var pendingHtml = shiftPending ? '<span class="shift-sync-inline" aria-label="Не синхронизировано" title="Не синхронизировано">' + docOnlineOnlyIcon + '</span>' : '';
      return '' +
        '<div class="sd-hero" data-shift-id="' + shiftIdAttr + '">' +
          '<div class="sd-hero-head">' +
            markHtml +
            '<div class="sd-hero-title-wrap">' +
              '<div class="eyebrow">Смена</div>' +
              '<div class="sd-route">' + escapeHtml(directionText || 'Смена') + pendingHtml + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="sd-info">' + heroLines.join('') + '</div>' +
          (incomeAmount ? '<div class="sd-income"><div class="l">Доход за смену</div><div class="v num">' + incomeAmount + '</div></div>' : '') +
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
      var hasPoekhaliDetails = false;

      var html = '';

      if (!hasPoekhaliDetails) {
        html += '<section class="shift-detail-section shift-detail-section-main">';
        // 4-cell metric grid: Длительность · Поезд · Топливо · Доход
        var fuelText = (typeof hasFuelData === 'function' && hasFuelData(shift) && typeof getFuelConsumptionInlineText === 'function')
          ? (function(){ try { return getFuelConsumptionInlineText(fuelTotals); } catch(e){ return ''; } })()
          : '';
        var trainShort = (shift && shift.train_number) ? ('№ ' + shift.train_number) : '';
        html += buildShiftDetailMetricGridHtml([
          { label: 'Длительность', value: (durationLabel === '—' ? periodLabel : durationLabel) },
          { label: 'Поезд',        value: trainShort },
          { label: 'Топливо',      value: fuelText },
          { label: 'Доход',        value: salaryText, tone: 'success' }
        ]);
        html += '<div class="shift-detail-section-title">Главное</div>';
        html += '<div class="shift-detail-list">';
        html += buildShiftDetailRowHtml('Начало', formatLocalDateTimeFromMsk(shift.start_msk));
        html += buildShiftDetailRowHtml('Конец', formatLocalDateTimeFromMsk(shift.end_msk));
        html += buildShiftDetailRowHtml('Маршрут', direction || shiftType);
        html += buildShiftDetailRowHtml('Локомотив', locoSummary);
        html += buildShiftDetailRowHtml('Состав', trainSummary);
        html += '</div>';
        // ── Breakdown расчёта выплаты ──
        try {
          var breakdownHtml = buildShiftDetailPayoutBreakdownHtml(shift);
          if (breakdownHtml) html += breakdownHtml;
        } catch (e) {}
        html += '</section>';
      }

      if (hasPoekhaliDetails) {
        var restrictionText = formatShiftPoekhaliActiveRestriction(shift);
        var nextRestrictionText = formatShiftPoekhaliNextRestriction(shift);
        var nextSignalText = formatShiftPoekhaliNextObject(shift, 'next_signal');
        var nextStationText = formatShiftPoekhaliNextObject(shift, 'next_station');
        var routeProgressText = formatShiftPoekhaliRouteProgress(shift);
        var targetText = formatShiftPoekhaliNavigationTarget(shift);
        var lastAlertText = formatShiftPoekhaliLastAlert(shift);
        var warningRulesText = formatShiftPoekhaliWarningRules(shift);
        var startPointText = formatShiftPoekhaliPoint(shift, 'start');
        var endPointText = formatShiftPoekhaliPoint(shift, 'end');
        var overspeedMax = getShiftPoekhaliNumber(shift, 'poekhali_overspeed_max_kmh');
        var alertCount = getShiftPoekhaliNumber(shift, 'poekhali_alert_count');
        var warningsCount = getShiftPoekhaliNumber(shift, 'poekhali_warnings_count');
        var currentTargetText = targetText || nextRestrictionText || nextSignalText || nextStationText || routeProgressText;
        var poekhaliDetailsHtml = '';
        var poekhaliRouteRows = '';
        var poekhaliAlertRows = '';
        var poekhaliGpsRows = '';

        html += '<section class="shift-detail-section shift-detail-section-poekhali">';
        html += '<div class="shift-detail-section-title">Поездка</div>';
        html += buildShiftDetailMetricGridHtml([
          { label: 'Статус', value: getShiftPoekhaliStatusLabel(shift.poekhali_status), tone: shift.poekhali_status === 'active' ? 'success' : '' },
          { label: 'Дистанция', value: formatShiftPoekhaliDistance(shift.poekhali_distance_m) },
          { label: 'Техскорость', value: formatShiftPoekhaliSpeed(shift.poekhali_technical_speed_kmh), tone: 'accent' },
          { label: 'Максимум', value: formatShiftPoekhaliSpeed(shift.poekhali_max_speed_kmh) }
        ]);
        html += '<div class="shift-detail-list">';
        html += buildShiftDetailOptionalRowHtml('Сейчас', currentTargetText);
        html += buildShiftDetailOptionalRowHtml('Ограничение', restrictionText);
        html += buildShiftDetailOptionalRowHtml('Последнее', lastAlertText);
        html += '</div>';
        html += '</section>';

        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Карта', shift.poekhali_map_title || shift.poekhali_map_id || shift.poekhali_warning_rules_map_title || shift.poekhali_warning_rules_map_id);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Направление', shift.poekhali_direction);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Путь', shift.poekhali_track);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Состав', formatShiftCardPoekhaliTrainLength(shift));
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Старт', formatShiftPoekhaliDateTime(shift.poekhali_started_at));
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Финиш', formatShiftPoekhaliDateTime(shift.poekhali_ended_at));
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Время', formatShiftPoekhaliDuration(shift.poekhali_duration_ms));
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('В движении', formatShiftPoekhaliDuration(shift.poekhali_moving_ms));
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Стоянки', formatShiftPoekhaliDuration(shift.poekhali_idle_ms));
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Средняя', formatShiftPoekhaliSpeed(shift.poekhali_average_speed_kmh));
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Следующее ограничение', nextRestrictionText);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Следующий светофор', nextSignalText);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Следующая станция', nextStationText);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Маршрут', routeProgressText);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Впереди', targetText);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Откуда', startPointText);
        poekhaliRouteRows += buildShiftDetailOptionalRowHtml('Куда', endPointText);
        poekhaliDetailsHtml += buildShiftDetailSubsectionHtml('Навигация', poekhaliRouteRows);

        poekhaliAlertRows += buildShiftDetailRowHtml('Оповещения', alertCount > 0 ? String(alertCount) : '0');
        poekhaliAlertRows += buildShiftDetailOptionalRowHtml('Превышение', overspeedMax > 0 ? '+' + overspeedMax + ' км/ч' : '');
        poekhaliAlertRows += buildShiftDetailOptionalRowHtml('Время превышения', formatShiftPoekhaliDuration(shift.poekhali_overspeed_duration_ms));
        poekhaliAlertRows += buildShiftDetailOptionalRowHtml('Путь превышения', formatShiftPoekhaliDistance(shift.poekhali_overspeed_distance_m));
        poekhaliAlertRows += buildShiftDetailRowHtml('Предупреждения', String(warningsCount));
        poekhaliAlertRows += buildShiftDetailOptionalRowHtml('ПР смены', warningRulesText);
        poekhaliAlertRows += buildShiftDetailOptionalRowHtml('Список ПР', shift.poekhali_warning_rules_summary || '');
        poekhaliDetailsHtml += buildShiftDetailSubsectionHtml('Оповещения', poekhaliAlertRows);

        if (shift.poekhali_user_section_id || shift.poekhali_user_section_title) {
          poekhaliGpsRows += buildShiftDetailOptionalRowHtml('Участок', shift.poekhali_user_section_title || shift.poekhali_user_section_id);
          poekhaliGpsRows += buildShiftDetailOptionalRowHtml('Статус', getShiftPoekhaliSectionStatusLabel(shift.poekhali_user_section_status));
          poekhaliGpsRows += buildShiftDetailOptionalRowHtml('Опорный ЭК', shift.poekhali_user_section_reference_sector ? 'уч. ' + shift.poekhali_user_section_reference_sector : '');
          poekhaliGpsRows += buildShiftDetailOptionalRowHtml('Объекты', shift.poekhali_user_section_id ? String(getShiftPoekhaliNumber(shift, 'poekhali_user_section_objects_count')) : '');
          poekhaliGpsRows += buildShiftDetailOptionalRowHtml('Скорости', shift.poekhali_user_section_id ? String(getShiftPoekhaliNumber(shift, 'poekhali_user_section_speeds_count')) : '');
          poekhaliDetailsHtml += buildShiftDetailSubsectionHtml('GPS участок', poekhaliGpsRows);
        }

        html += buildShiftDetailDisclosureHtml('Данные Поехали', 'карта, события, GPS', poekhaliDetailsHtml);
      }

      if (hasFuelData(shift)) {
        var fuelRows = '';
        fuelRows += buildShiftDetailOptionalRowHtml('Приём', fuelReceiveSummary);
        fuelRows += buildShiftDetailOptionalRowHtml('Сдача', fuelHandoverSummary);
        html += buildShiftDetailDisclosureHtml('Топливо подробно', 'приём и сдача', '<div class="shift-detail-list">' + fuelRows + '</div>');
      }

      html += buildShiftDetailDisclosureHtml('Служебное', 'расчёт и синхронизация', '' +
        '<div class="shift-detail-list">' +
          buildShiftDetailRowHtml('Тип', shiftType) +
          buildShiftDetailRowHtml('Синхронизация', syncStatus) +
        '</div>'
      );

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

