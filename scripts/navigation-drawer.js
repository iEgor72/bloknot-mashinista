(function bindNavigationDrawer() {
  if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('navigation-drawer', 'v413');

  var drawer = document.getElementById('navigationDrawer');
  var backdrop = document.getElementById('navigationDrawerBackdrop');
  var openButton = document.getElementById('btnOpenNavigationDrawer');
  var closeButton = document.getElementById('btnCloseNavigationDrawer');
  var searchInput = document.getElementById('navigationDrawerSearch');
  var emptySearch = document.getElementById('navigationDrawerEmpty');
  var lastFocused = null;
  var openStateKey = 'shift_tracker_navigation_groups_v1';
  var searchOpenSnapshot = null;
  var currentNavigationKey = '';

  if (!drawer || !backdrop || !openButton || !closeButton) return;

  function normalizeText(value) {
    return String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function matchesSearch(value, query) {
    var haystack = normalizeText(value);
    var needle = normalizeText(query);
    if (!needle) return true;
    var compactHaystack = haystack.replace(/[^a-zа-я0-9]+/gi, '');
    var compactNeedle = needle.replace(/[^a-zа-я0-9]+/gi, '');
    if (compactNeedle && compactHaystack.indexOf(compactNeedle) >= 0) return true;
    return needle.split(' ').filter(Boolean).every(function(token) { return haystack.indexOf(token) >= 0; });
  }

  function getNavigationKey(button) {
    if (!button) return '';
    var action = button.dataset.navAction || '';
    if (action === 'tab') return 'tab:' + (button.dataset.tab || 'home');
    if (action === 'docs') return 'docs:' + (button.dataset.docsEntry || 'instructions');
    if (action === 'salary') return 'salary:' + (button.dataset.salaryAnchor || 'top');
    return action;
  }

  function findNavigationButton(key) {
    var buttons = drawer.querySelectorAll('[data-nav-action]');
    for (var i = 0; i < buttons.length; i++) {
      if (getNavigationKey(buttons[i]) === key) return buttons[i];
    }
    return null;
  }

  function setActiveNavigation(key) {
    var button = typeof key === 'string' ? findNavigationButton(key) : key;
    if (!button) return;
    currentNavigationKey = getNavigationKey(button);
    drawer.querySelectorAll('[data-nav-action]').forEach(function(item) {
      var active = item === button;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function clearActiveNavigation() {
    currentNavigationKey = '';
    drawer.querySelectorAll('[data-nav-action]').forEach(function(item) {
      item.classList.remove('is-active');
      item.removeAttribute('aria-current');
    });
  }

  function getFocusable() {
    return Array.prototype.filter.call(
      drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'),
      function(element) { return element.offsetParent !== null; }
    );
  }

  function persistGroups() {
    try {
      var state = {};
      drawer.querySelectorAll('[data-nav-group]').forEach(function(group) {
        state[group.dataset.navGroup] = group.open;
      });
      localStorage.setItem(openStateKey, JSON.stringify(state));
    } catch (error) {}
  }

  function restoreGroups() {
    try {
      var state = JSON.parse(localStorage.getItem(openStateKey) || '{}');
      drawer.querySelectorAll('[data-nav-group]').forEach(function(group) {
        if (typeof state[group.dataset.navGroup] === 'boolean') group.open = state[group.dataset.navGroup];
      });
    } catch (error) {}
  }

  function openDrawer() {
    if (document.body.classList.contains('is-navigation-drawer-open')) return;
    lastFocused = document.activeElement;
    document.body.classList.add('is-navigation-drawer-open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    openButton.setAttribute('aria-expanded', 'true');
    window.setTimeout(function() {
      if (searchInput) searchInput.focus({ preventScroll: true });
      else drawer.focus({ preventScroll: true });
    }, 60);
  }

  function closeDrawer(options) {
    options = options || {};
    if (!document.body.classList.contains('is-navigation-drawer-open')) return;
    document.body.classList.remove('is-navigation-drawer-open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
    openButton.setAttribute('aria-expanded', 'false');
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      applySearch('');
    }
    if (options.restoreFocus !== false && lastFocused && typeof lastFocused.focus === 'function') {
      window.setTimeout(function() { lastFocused.focus({ preventScroll: true }); }, 40);
    }
  }

  function switchTab(tab) {
    if (typeof setActiveTab === 'function') setActiveTab(tab);
  }

  function openAddShift() {
    if (typeof openAddTabAndFocusForm === 'function') openAddTabAndFocusForm();
    else switchTab('add');
  }

  function getLatestShiftId() {
    try {
      if (window.getPoekhaliTrainDetails) {
        var details = window.getPoekhaliTrainDetails();
        if (details && details.shift && details.shift.id) return String(details.shift.id);
      }
    } catch (error) {}
    var button = document.querySelector('.shift-poekhali-btn[data-id]');
    if (button) return String(button.getAttribute('data-id') || '');
    try {
      var candidates = [];
      Object.keys(localStorage).forEach(function(key) {
        if (key.indexOf('shift_tracker_shifts_cache_v1_') !== 0) return;
        var parsed = JSON.parse(localStorage.getItem(key) || '{}');
        if (parsed && Array.isArray(parsed.shifts)) candidates = candidates.concat(parsed.shifts);
      });
      candidates = candidates.filter(function(shift) { return shift && shift.id && !shift.schedule_generated && !shift.isScheduleDerived; });
      candidates.sort(function(a, b) { return String(b.start_msk || '').localeCompare(String(a.start_msk || '')); });
      return candidates.length ? String(candidates[0].id) : '';
    } catch (error2) {
      return '';
    }
  }

  function openPoekhali(mode) {
    var shiftId = getLatestShiftId();
    if (!shiftId) {
      if (typeof enqueueAppToast === 'function') enqueueAppToast('Сначала добавьте смену', 'neutral', 2200);
      openAddShift();
      return;
    }
    if (mode === 'preview' && typeof window.openPoekhaliPreparationForShift === 'function') {
      window.openPoekhaliPreparationForShift(shiftId);
      return;
    }
    if (typeof window.openPoekhaliForShift === 'function') {
      window.openPoekhaliForShift(shiftId);
      return;
    }
    switchTab('poekhali');
  }

  function openDocs(entry) {
    switchTab('instructions');
    window.setTimeout(function() {
      var tile = document.querySelector('[data-docs-entry="' + entry + '"]');
      if (tile && typeof tile.click === 'function') tile.click();
    }, 70);
  }

  function openSalary(anchor) {
    switchTab('salary');
    window.setTimeout(function() {
      renderSalaryPage();
      var target = anchor === 'shifts' ? document.getElementById('salaryPageShiftsSection') : document.querySelector('.salary-page');
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 60);
  }

  function handleAction(button) {
    var action = button.dataset.navAction || '';
    if (['tab', 'add-shift', 'poekhali-live', 'poekhali-preview', 'docs', 'salary', 'profile-edit'].indexOf(action) >= 0) {
      setActiveNavigation(button);
    }
    closeDrawer({ restoreFocus: false });
    if (action === 'tab') switchTab(button.dataset.tab || 'home');
    else if (action === 'add-shift') openAddShift();
    else if (action === 'poekhali-live') openPoekhali('live');
    else if (action === 'poekhali-preview') openPoekhali('preview');
    else if (action === 'docs') openDocs(button.dataset.docsEntry || 'instructions');
    else if (action === 'salary') openSalary(button.dataset.salaryAnchor || 'top');
    else if (action === 'profile-edit') {
      switchTab('profile');
      window.setTimeout(function() {
        var profileEdit = document.getElementById('btnProfileEdit');
        if (profileEdit) profileEdit.click();
      }, 50);
    } else if (action === 'add-map') {
      if (typeof window.openDepotProposal === 'function') window.openDepotProposal({ source: 'navigation', mode: 'materials' });
    }
  }

  function applySearch(value) {
    var query = normalizeText(value);
    var groups = drawer.querySelectorAll('[data-nav-group]');
    var directRows = drawer.querySelectorAll('.navigation-drawer-home, .navigation-drawer-direct');
    if (query && !searchOpenSnapshot) {
      searchOpenSnapshot = {};
      Array.prototype.forEach.call(groups, function(group) { searchOpenSnapshot[group.dataset.navGroup] = group.open; });
    } else if (!query && searchOpenSnapshot) {
      Array.prototype.forEach.call(groups, function(group) {
        if (typeof searchOpenSnapshot[group.dataset.navGroup] === 'boolean') group.open = searchOpenSnapshot[group.dataset.navGroup];
      });
      searchOpenSnapshot = null;
    }

    var visibleRows = 0;

    Array.prototype.forEach.call(directRows, function(row) {
      var matches = matchesSearch(row.dataset.navSearch + ' ' + row.textContent, query);
      row.dataset.searchHidden = matches ? 'false' : 'true';
      if (matches) visibleRows++;
    });

    Array.prototype.forEach.call(groups, function(group) {
      var summary = group.querySelector(':scope > summary');
      var children = group.querySelectorAll('.navigation-drawer-children > *');
      var groupMatches = matchesSearch((summary && summary.dataset.navSearch) + ' ' + (summary && summary.textContent), query);
      var visibleChildren = 0;
      Array.prototype.forEach.call(children, function(child) {
        var matches = !query || groupMatches || matchesSearch(child.dataset.navSearch + ' ' + child.textContent, query);
        child.dataset.searchHidden = matches ? 'false' : 'true';
        if (matches) visibleChildren++;
      });
      var groupVisible = !query || groupMatches || visibleChildren;
      group.dataset.searchHidden = groupVisible ? 'false' : 'true';
      if (groupVisible) visibleRows++;
      if (query && visibleChildren) group.open = true;
    });
    if (emptySearch) emptySearch.hidden = !query || visibleRows > 0;
  }

  function syncActiveTab(tab) {
    var activeTab = tab || (document.querySelector('.tab-panel.active') && document.querySelector('.tab-panel.active').dataset.tab) || 'home';
    var groupByTab = { shifts: 'shifts', add: 'shifts', poekhali: 'poekhali', instructions: 'documents', salary: 'salary', profile: 'profile' };
    drawer.querySelectorAll('[data-nav-group]').forEach(function(group) {
      group.dataset.active = group.dataset.navGroup === groupByTab[activeTab] ? 'true' : 'false';
    });
    var home = drawer.querySelector('.navigation-drawer-home');
    if (home) home.classList.toggle('is-active', activeTab === 'home');
    var currentButton = findNavigationButton(currentNavigationKey);
    var currentGroup = currentButton && currentButton.closest('[data-nav-group]');
    var expectedGroup = groupByTab[activeTab] || '';
    if (activeTab === 'home') setActiveNavigation('tab:home');
    else if (!currentButton || !currentGroup || currentGroup.dataset.navGroup !== expectedGroup) {
      var defaults = {
        shifts: 'tab:shifts',
        add: 'add-shift',
        poekhali: document.body.classList.contains('is-poekhali-preview') ? 'poekhali-preview' : 'poekhali-live',
        instructions: 'docs:instructions',
        salary: 'salary:top',
        profile: 'profile-edit'
      };
      if (defaults[activeTab]) setActiveNavigation(defaults[activeTab]);
    }
  }

  function formatRubles(value) {
    if (typeof formatRub === 'function') return formatRub(Number(value) || 0);
    try { return Math.round(Number(value) || 0).toLocaleString('ru-RU') + ' ₽'; }
    catch (error) { return Math.round(Number(value) || 0) + ' ₽'; }
  }

  function formatHours(value) {
    var hours = Math.max(0, Number(value) || 0);
    var whole = Math.floor(hours);
    var minutes = Math.round((hours - whole) * 60);
    if (minutes >= 60) { whole++; minutes = 0; }
    return whole + ' ч' + (minutes ? ' ' + minutes + ' м' : '');
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function buildSalaryRows(rootId, rows) {
    var root = document.getElementById(rootId);
    if (!root) return;
    root.textContent = '';
    rows.filter(function(row) { return Math.abs(Number(row.value) || 0) >= .5; }).forEach(function(row) {
      var item = document.createElement('div');
      item.className = 'salary-row';
      var label = document.createElement('span');
      label.className = 'salary-row-label';
      var title = document.createElement('span');
      title.textContent = row.label;
      label.appendChild(title);
      if (row.note) {
        var note = document.createElement('small');
        note.textContent = row.note;
        label.appendChild(note);
      }
      var amount = document.createElement('strong');
      amount.className = 'salary-row-value';
      amount.textContent = formatRubles(row.value);
      item.appendChild(label);
      item.appendChild(amount);
      root.appendChild(item);
    });
    if (!root.children.length) {
      var empty = document.createElement('div');
      empty.className = 'salary-empty';
      empty.textContent = 'Здесь появятся суммы после добавления смен.';
      root.appendChild(empty);
    }
  }

  function renderSalaryPage() {
    if (!document.querySelector('.salary-page')) return;
    var monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    var year = typeof currentYear === 'number' ? currentYear : new Date().getFullYear();
    var month = typeof currentMonth === 'number' ? currentMonth : new Date().getMonth();
    setText('salaryMonthTitle', monthNames[month] + ' ' + year);
    setText('salaryMonthQuarter', (Math.floor(month / 3) + 1) + ' квартал');

    var summary = null;
    var visibleShifts = [];
    var incomeMap = {};
    var bounds = null;
    try {
      bounds = getMonthBounds(year, month);
      var sets = buildMonthCalculationShifts(year, month, bounds);
      visibleShifts = (sets.actualShifts || []).filter(function(shift) {
        return !(typeof isScheduleMaterializedShift === 'function' && isScheduleMaterializedShift(shift));
      });
      summary = buildSalarySummary(sets.calculationShifts || visibleShifts, bounds);
      incomeMap = buildMonthShiftIncomeMap(visibleShifts, bounds) || {};
    } catch (error) {
      try { summary = calculateSalarySummaryByMinutes(0, 0, 0, 0, 0); } catch (fallbackError) {}
    }
    if (!summary) return;

    var deductions = (summary.ndflBase || 0) + (summary.ndflCoeffs || 0) + (summary.alimonyAmount || 0) + (summary.unionAmount || 0) + (summary.welfareAmount || 0);
    setText('salaryPageNet', formatRubles(summary.netAmount));
    setText('salaryPageWorked', formatHours(summary.workedHours));
    setText('salaryPageShiftCount', String(visibleShifts.length));
    setText('salaryPageAccrued', formatRubles(summary.accruedAmount));
    setText('salaryPageDeductions', '−' + formatRubles(deductions));

    var accrualRows = [
      { label: 'Тарифная часть', note: formatHours(summary.regularHours), value: summary.tariffAmount },
      { label: 'Ночные часы', note: formatHours(summary.nightHours), value: summary.nightAmount },
      { label: 'Праздничные часы', note: formatHours(summary.holidayHours), value: summary.holidayAmount },
      { label: 'Сверх нормы', note: formatHours(summary.overNormHours), value: (summary.overtimeAmount || 0) + (summary.extraOvertimeAmount || 0) + (summary.travelOvertimeAmount || 0) },
      { label: 'Классность', value: summary.classAmount },
      { label: 'Вредные условия', value: summary.harmfulConditionsAmount },
      { label: 'Зональная и БАМ', value: (summary.zoneAmount || 0) + (summary.bamAmount || 0) },
      { label: 'Районные коэффициенты', value: summary.coeffTotal },
      { label: 'Командировочные', value: summary.komAmount }
    ];
    var deductionRows = [
      { label: 'НДФЛ', value: (summary.ndflBase || 0) + (summary.ndflCoeffs || 0) },
      { label: 'Алименты', value: summary.alimonyAmount },
      { label: 'Профсоюз', value: summary.unionAmount },
      { label: 'НПФ «Благосостояние»', value: summary.welfareAmount }
    ];
    buildSalaryRows('salaryPageAccrualRows', accrualRows);
    buildSalaryRows('salaryPageDeductionRows', deductionRows);

    var stack = document.getElementById('salaryPageStack');
    var legend = document.getElementById('salaryPageLegend');
    if (stack && legend) {
      stack.textContent = '';
      legend.textContent = '';
      var segments = [
        { label: 'Тариф', value: summary.tariffAmount, color: 'var(--accent)' },
        { label: 'Доплаты', value: Math.max(0, summary.baseAmount - summary.tariffAmount), color: 'var(--night)' },
        { label: 'Коэффициенты', value: summary.coeffTotal, color: 'var(--good)' },
        { label: 'Удержания', value: deductions, color: 'var(--holiday)' }
      ];
      var total = segments.reduce(function(sum, segment) { return sum + Math.max(0, Number(segment.value) || 0); }, 0) || 1;
      segments.forEach(function(segment) {
        var bar = document.createElement('span');
        bar.style.width = (Math.max(0, Number(segment.value) || 0) / total * 100).toFixed(2) + '%';
        bar.style.background = segment.color;
        stack.appendChild(bar);
        var row = document.createElement('div');
        row.className = 'salary-hero-legend-row';
        var dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = segment.color;
        var label = document.createElement('span');
        label.textContent = segment.label;
        var value = document.createElement('span');
        value.className = 'v';
        value.textContent = formatRubles(segment.value);
        row.appendChild(dot); row.appendChild(label); row.appendChild(value);
        legend.appendChild(row);
      });
    }

    var shiftsRoot = document.getElementById('salaryPageShiftRows');
    if (shiftsRoot) {
      shiftsRoot.textContent = '';
      visibleShifts.slice().sort(function(a, b) { return String(b.start_msk || '').localeCompare(String(a.start_msk || '')); }).forEach(function(shift) {
        var item = document.createElement('div');
        item.className = 'salary-shift-item';
        var copy = document.createElement('span');
        var title = document.createElement('strong');
        title.textContent = typeof getShiftTitle === 'function' ? getShiftTitle(shift) : 'Смена';
        var note = document.createElement('small');
        var date = String(shift.start_msk || '').slice(0, 10).split('-').reverse().join('.');
        var minutes = bounds && typeof shiftMinutesInRange === 'function' ? shiftMinutesInRange(shift, bounds.start, bounds.end) : 0;
        note.textContent = date + (minutes ? ' · ' + formatHours(minutes / 60) : '');
        var amount = document.createElement('b');
        amount.textContent = formatRubles(incomeMap[String(shift.id)] || 0);
        copy.appendChild(title); copy.appendChild(note);
        item.appendChild(copy); item.appendChild(amount);
        shiftsRoot.appendChild(item);
      });
      if (!shiftsRoot.children.length) {
        var shiftsEmpty = document.createElement('div');
        shiftsEmpty.className = 'salary-empty';
        shiftsEmpty.textContent = 'Добавьте смену — здесь появится её вклад в зарплату.';
        shiftsRoot.appendChild(shiftsEmpty);
      }
    }
  }

  function shiftSalaryMonth(delta) {
    if (typeof currentMonth !== 'number' || typeof currentYear !== 'number') return;
    currentMonth += delta;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    if (typeof render === 'function') render();
    renderSalaryPage();
  }

  function syncProfileFooter() {
    var sourceName = document.getElementById('profileName');
    var sourceSub = document.getElementById('profileSub');
    var name = document.getElementById('navigationDrawerUserName');
    var meta = document.getElementById('navigationDrawerUserMeta');
    var avatar = document.getElementById('navigationDrawerAvatar');
    var value = sourceName && sourceName.textContent.trim() !== '—' ? sourceName.textContent.trim() : 'Профиль';
    if (name) name.textContent = value;
    if (meta) meta.textContent = sourceSub && sourceSub.textContent.trim() ? sourceSub.textContent.trim() : 'Блокнот машиниста';
    if (avatar) avatar.textContent = value === 'Профиль' ? 'БМ' : value.slice(0, 1).toLocaleUpperCase('ru-RU');
  }

  restoreGroups();
  syncActiveTab();
  syncProfileFooter();

  openButton.addEventListener('click', openDrawer);
  closeButton.addEventListener('click', function() { closeDrawer(); });
  backdrop.addEventListener('click', function() { closeDrawer(); });
  drawer.addEventListener('toggle', function() {
    if (!searchInput || !searchInput.value) persistGroups();
  }, true);
  drawer.addEventListener('click', function(event) {
    var action = event.target.closest && event.target.closest('[data-nav-action]');
    if (action && drawer.contains(action)) handleAction(action);
  });
  if (searchInput) searchInput.addEventListener('input', function() { applySearch(searchInput.value); });

  document.addEventListener('keydown', function(event) {
    if (!document.body.classList.contains('is-navigation-drawer-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = getFocusable();
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });

  var incomeOpen = document.getElementById('dashboardMonthIncomeOpen');
  if (incomeOpen) incomeOpen.addEventListener('click', function() { openSalary('top'); });
  var settingsOpen = document.getElementById('btnSalaryPageSettings');
  if (settingsOpen) settingsOpen.addEventListener('click', function() {
    var settingsButton = document.getElementById('btnProfileSalarySettings');
    if (settingsButton) settingsButton.click();
  });
  var prevSalary = document.getElementById('btnPrevSalaryMonth');
  var nextSalary = document.getElementById('btnNextSalaryMonth');
  if (prevSalary) prevSalary.addEventListener('click', function() { shiftSalaryMonth(-1); });
  if (nextSalary) nextSalary.addEventListener('click', function() { shiftSalaryMonth(1); });

  window.addEventListener('app:tabchange', function(event) {
    var tab = event && event.detail ? event.detail.tab : '';
    syncActiveTab(tab);
    if (tab === 'salary') window.setTimeout(renderSalaryPage, 0);
  });
  document.addEventListener('click', function(event) {
    var docsEntry = event.target && event.target.closest ? event.target.closest('#docsShell [data-docs-entry]') : null;
    if (docsEntry) {
      setActiveNavigation('docs:' + (docsEntry.dataset.docsEntry || 'instructions'));
      return;
    }
    var docsBack = event.target && event.target.closest ? event.target.closest('#docsBackButton, #docsFavoritesBack') : null;
    if (docsBack) clearActiveNavigation();
  });
  window.addEventListener('storage', syncProfileFooter);
  var profileName = document.getElementById('profileName');
  if (profileName && window.MutationObserver) new MutationObserver(syncProfileFooter).observe(profileName, { childList: true, characterData: true, subtree: true });

  window.NavigationDrawer = {
    open: openDrawer,
    close: closeDrawer,
    renderSalary: renderSalaryPage
  };
})();
