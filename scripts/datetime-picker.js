(function() {
  'use strict';

  var overlay = document.getElementById('overlayDateTimePicker');
  var sheet = overlay ? overlay.querySelector('.datetime-picker-sheet') : null;
  var titleEl = document.getElementById('dateTimePickerTitle');
  var kickerEl = document.getElementById('dateTimePickerKicker');
  var datePanel = document.getElementById('dateTimePickerDatePanel');
  var timePanel = document.getElementById('dateTimePickerTimePanel');
  var monthTitleEl = document.getElementById('dateTimePickerMonthTitle');
  var daysEl = document.getElementById('dateTimePickerDays');
  var hoursEl = document.getElementById('dateTimePickerHours');
  var minutesEl = document.getElementById('dateTimePickerMinutes');
  var timePreviewEl = document.getElementById('dateTimePickerTimePreview');
  var confirmBtn = document.getElementById('btnConfirmDateTimePicker');
  var controls = document.querySelectorAll('[data-datetime-target]');
  var inputIds = ['inputStartDate', 'inputStartTime', 'inputEndDate', 'inputEndTime'];
  var activeInput = null;
  var activeTrigger = null;
  var pickerKind = 'date';
  var calendarMonth = null;
  var selectedDate = '';
  var selectedHour = 0;
  var selectedMinute = 0;
  var lastValues = {};
  var monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
  var dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  if (!overlay || !sheet || !controls.length) return;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function parseDateValue(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (
      date.getFullYear() !== Number(match[1]) ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[3])
    ) return null;
    return date;
  }

  function formatDateValue(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function getMskToday() {
    var now = new Date();
    var msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return new Date(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate());
  }

  function isPickerHolidayDate(date, dateKey) {
    if (
      typeof PRODUCTION_NON_WORKING_DAY_MAP !== 'undefined' &&
      PRODUCTION_NON_WORKING_DAY_MAP[dateKey]
    ) {
      return true;
    }
    if (typeof isNonWorkingHolidayLocalDate === 'function') {
      return !!isNonWorkingHolidayLocalDate(date);
    }
    return false;
  }

  function formatDisplay(input) {
    if (!input || !input.value) return input && input.type === 'time' ? '—' : 'Не выбрано';
    if (input.type === 'date') {
      var parsed = parseDateValue(input.value);
      return parsed ? dateFormatter.format(parsed) : input.value;
    }
    return input.value;
  }

  function syncControl(inputId) {
    var input = document.getElementById(inputId);
    var display = document.querySelector('[data-datetime-display="' + inputId + '"]');
    var trigger = document.querySelector('[data-datetime-target="' + inputId + '"]');
    if (!input || !display || !trigger) return;
    var value = input.value || '';
    if (lastValues[inputId] === value) return;
    lastValues[inputId] = value;
    display.textContent = formatDisplay(input);
    trigger.classList.toggle('is-empty', !value);
    trigger.setAttribute(
      'aria-label',
      (input.type === 'date' ? 'Выбрать дату: ' : 'Выбрать время: ') + formatDisplay(input)
    );
  }

  function syncAllControls() {
    for (var i = 0; i < inputIds.length; i++) syncControl(inputIds[i]);
  }

  window.syncDateTimePickerControls = syncAllControls;

  function setOverlayOpen(open) {
    if (open && typeof window.openOverlay === 'function') {
      window.openOverlay('overlayDateTimePicker');
      return;
    }
    if (!open && typeof window.closeOverlay === 'function') {
      window.closeOverlay('overlayDateTimePicker');
      return;
    }
    overlay.classList.toggle('is-open', open);
    overlay.classList.toggle('visible', open);
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (document.body) document.body.classList.toggle('has-open-overlay', open);
  }

  function closePicker(restoreFocus) {
    setOverlayOpen(false);
    if (restoreFocus && activeTrigger && activeTrigger.focus) activeTrigger.focus();
    activeInput = null;
  }

  function renderCalendar() {
    if (!calendarMonth || !daysEl) return;
    monthTitleEl.textContent = monthFormatter.format(calendarMonth);
    daysEl.innerHTML = '';

    var year = calendarMonth.getFullYear();
    var month = calendarMonth.getMonth();
    var firstDay = new Date(year, month, 1);
    var leading = (firstDay.getDay() + 6) % 7;
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var selected = parseDateValue(selectedDate);
    var today = getMskToday();

    for (var blank = 0; blank < leading; blank++) {
      var spacer = document.createElement('span');
      spacer.className = 'datetime-picker-day-spacer';
      daysEl.appendChild(spacer);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var date = new Date(year, month, day);
      var button = document.createElement('button');
      var value = formatDateValue(date);
      var isWeekend = date.getDay() === 0 || date.getDay() === 6;
      var isHoliday = isPickerHolidayDate(date, value);
      var ariaLabel = dateFormatter.format(date);
      button.type = 'button';
      button.className = 'datetime-picker-day';
      button.textContent = String(day);
      button.dataset.dateValue = value;
      if (isWeekend) button.classList.add('is-weekend');
      if (isHoliday) button.classList.add('is-holiday');
      if (isHoliday) ariaLabel += ', праздничный день';
      else if (isWeekend) ariaLabel += ', выходной день';
      button.setAttribute('aria-label', ariaLabel);
      if (selected && formatDateValue(selected) === value) {
        button.classList.add('is-selected');
        button.setAttribute('aria-pressed', 'true');
      } else {
        button.setAttribute('aria-pressed', 'false');
      }
      if (formatDateValue(today) === value) button.classList.add('is-today');
      daysEl.appendChild(button);
    }
  }

  function renderTimeSelection(scrollSelected) {
    var preview = pad(selectedHour) + ':' + pad(selectedMinute);
    timePreviewEl.textContent = preview;
    var hourOptions = hoursEl.querySelectorAll('.datetime-picker-wheel-option');
    var minuteOptions = minutesEl.querySelectorAll('.datetime-picker-wheel-option');

    for (var i = 0; i < hourOptions.length; i++) {
      var hourSelected = Number(hourOptions[i].dataset.value) === selectedHour;
      hourOptions[i].classList.toggle('is-selected', hourSelected);
      hourOptions[i].setAttribute('aria-selected', hourSelected ? 'true' : 'false');
      if (scrollSelected && hourSelected) {
        hourOptions[i].scrollIntoView({ block: 'center' });
      }
    }
    for (var j = 0; j < minuteOptions.length; j++) {
      var minuteSelected = Number(minuteOptions[j].dataset.value) === selectedMinute;
      minuteOptions[j].classList.toggle('is-selected', minuteSelected);
      minuteOptions[j].setAttribute('aria-selected', minuteSelected ? 'true' : 'false');
      if (scrollSelected && minuteSelected) {
        minuteOptions[j].scrollIntoView({ block: 'center' });
      }
    }
  }

  function buildTimeOptions(container, count, unit) {
    if (!container || container.children.length) return;
    for (var value = 0; value < count; value++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'datetime-picker-wheel-option';
      button.textContent = pad(value);
      button.dataset.value = String(value);
      button.dataset.unit = unit;
      button.setAttribute('role', 'option');
      container.appendChild(button);
    }
  }

  function openPicker(trigger) {
    var input = document.getElementById(trigger.dataset.datetimeTarget);
    if (!input) return;
    if (
      (input.id === 'inputStartDate' || input.id === 'inputStartTime') &&
      typeof window.setDefaultShiftTimeInputs === 'function'
    ) {
      window.setDefaultShiftTimeInputs();
    }

    syncAllControls();
    activeInput = input;
    activeTrigger = trigger;
    pickerKind = input.type === 'date' ? 'date' : 'time';
    var isStart = input.id.indexOf('Start') !== -1;
    kickerEl.textContent = isStart ? 'Начало смены' : 'Окончание смены';
    titleEl.textContent = pickerKind === 'date' ? 'Выберите дату' : 'Выберите время';
    datePanel.classList.toggle('hidden', pickerKind !== 'date');
    timePanel.classList.toggle('hidden', pickerKind !== 'time');

    if (pickerKind === 'date') {
      var initialDate = parseDateValue(input.value) || getMskToday();
      selectedDate = formatDateValue(initialDate);
      calendarMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
      renderCalendar();
    } else {
      var match = /^(\d{2}):(\d{2})$/.exec(input.value || '');
      selectedHour = match ? Number(match[1]) : 0;
      selectedMinute = match ? Number(match[2]) : 0;
      renderTimeSelection(false);
    }

    setOverlayOpen(true);
    window.requestAnimationFrame(function() {
      if (pickerKind === 'time') renderTimeSelection(true);
      if (sheet && sheet.focus) sheet.focus({ preventScroll: true });
    });
  }

  function commitSelection() {
    if (!activeInput) return;
    var nextValue = pickerKind === 'date'
      ? selectedDate
      : pad(selectedHour) + ':' + pad(selectedMinute);
    activeInput.value = nextValue;
    activeInput.defaultValue = nextValue;
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    syncAllControls();
    if (typeof window.triggerHapticSelection === 'function') window.triggerHapticSelection();
    closePicker(true);
  }

  buildTimeOptions(hoursEl, 24, 'hour');
  buildTimeOptions(minutesEl, 60, 'minute');
  syncAllControls();

  for (var i = 0; i < controls.length; i++) {
    controls[i].addEventListener('click', function(event) {
      openPicker(event.currentTarget);
    });
  }

  for (var j = 0; j < inputIds.length; j++) {
    var watchedInput = document.getElementById(inputIds[j]);
    if (!watchedInput) continue;
    watchedInput.addEventListener('input', syncAllControls);
    watchedInput.addEventListener('change', syncAllControls);
  }

  daysEl.addEventListener('click', function(event) {
    var dayButton = event.target.closest('.datetime-picker-day');
    if (!dayButton) return;
    selectedDate = dayButton.dataset.dateValue;
    renderCalendar();
  });

  document.getElementById('btnDateTimePickerPrevMonth').addEventListener('click', function() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  document.getElementById('btnDateTimePickerNextMonth').addEventListener('click', function() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  function handleWheelSelection(event) {
    var option = event.target.closest('.datetime-picker-wheel-option');
    if (!option) return;
    var value = Number(option.dataset.value);
    if (option.dataset.unit === 'hour') selectedHour = value;
    if (option.dataset.unit === 'minute') selectedMinute = value;
    renderTimeSelection(false);
    option.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  hoursEl.addEventListener('click', handleWheelSelection);
  minutesEl.addEventListener('click', handleWheelSelection);
  confirmBtn.addEventListener('click', commitSelection);
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      closePicker(true);
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape' || overlay.getAttribute('aria-hidden') === 'true') return;
    event.preventDefault();
    closePicker(true);
  });

  window.setInterval(syncAllControls, 250);
}());
