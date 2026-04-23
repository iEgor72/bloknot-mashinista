    // ── Delete handler ──
    function handleDeleteClick(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      var id = e.currentTarget.getAttribute('data-id');
      var shift = null;
      for (var i = 0; i < allShifts.length; i++) {
        if (allShifts[i].id === id) { shift = allShifts[i]; break; }
      }
      if (!shift) return;

      triggerHapticWarning();
      pendingDeleteId = id;
      render();
      openOverlay('overlayConfirm');
    }

    function findShiftById(id) {
      for (var i = 0; i < allShifts.length; i++) {
        if (allShifts[i].id === id) return allShifts[i];
      }
      if (typeof buildMonthCalculationShifts === 'function' && typeof getMonthBounds === 'function') {
        var bounds = getMonthBounds(currentYear, currentMonth);
        var monthShiftSets = buildMonthCalculationShifts(currentYear, currentMonth, bounds);
        var shifts = monthShiftSets && Array.isArray(monthShiftSets.calculationShifts) ? monthShiftSets.calculationShifts : [];
        for (var j = 0; j < shifts.length; j++) {
          if (shifts[j].id === id) return shifts[j];
        }
      }
      return null;
    }

    var editFormHomeParent = null;
    var editFormHomeNextSibling = null;

    function getShiftFormElement(id) {
      return document.getElementById(id);
    }

    function setShiftFormText(id, value) {
      var el = getShiftFormElement(id);
      if (el) el.textContent = value;
      return el;
    }

    function setShiftFormValue(id, value) {
      var el = getShiftFormElement(id);
      if (el) el.value = value;
      return el;
    }

    function toggleShiftFormClass(id, className, enabled) {
      var el = getShiftFormElement(id);
      if (el) el.classList.toggle(className, enabled !== false);
      return el;
    }

    function isOverlayOpen(id) {
      var overlay = document.getElementById(id);
      return !!(overlay && (overlay.classList.contains('is-open') || overlay.classList.contains('visible')));
    }

    function mountEditFormIntoOverlay() {
      var formSection = document.getElementById('shiftFormSection');
      var mount = document.getElementById('editShiftMount');
      if (!formSection || !mount) return;
      if (!editFormHomeParent) {
        editFormHomeParent = formSection.parentNode;
        editFormHomeNextSibling = formSection.nextSibling;
      }
      if (formSection.parentNode !== mount) {
        mount.appendChild(formSection);
      }
    }

    function restoreEditFormToHome() {
      var formSection = document.getElementById('shiftFormSection');
      if (!formSection || !editFormHomeParent) return;
      if (editFormHomeNextSibling && editFormHomeNextSibling.parentNode === editFormHomeParent) {
        editFormHomeParent.insertBefore(formSection, editFormHomeNextSibling);
      } else {
        editFormHomeParent.appendChild(formSection);
      }
    }

    function enterEditMode(shift, options) {
      if (!shift) return;
      var opts = options || {};
      var returnTab = opts.returnTab || (activeTab || 'home');
      if (returnTab === 'add') returnTab = 'home';
      editReturnTab = returnTab;

      editingShiftId = shift.id;
      clearRecentAddHighlight();
      mountEditFormIntoOverlay();
      setFormMode('edit');
      setShiftFormText('formTitle', 'Редактировать смену');
      toggleShiftFormClass('editBadge', 'visible', true);
      setShiftFormValue('inputStartDate', shift.start_msk.substring(0, 10));
      setShiftFormValue('inputStartTime', shift.start_msk.substring(11, 16));
      setShiftFormValue('inputEndDate', shift.end_msk.substring(0, 10));
      setShiftFormValue('inputEndTime', shift.end_msk.substring(11, 16));
      applyOptionalShiftData(shift);
      setOptionalCardOpen('optionalRouteCard', false);
      setOptionalCardOpen('optionalTrainCard', false);
      setOptionalCardOpen('optionalNotesCard', false);
      setOptionalCardOpen('optionalLocoCard', false);
      setOptionalCardOpen('optionalFuelCard', false);
      setAddDetailsExpanded(true);
      setShiftFormText('btnAdd', 'Сохранить изменения');
      toggleShiftFormClass('btnCancelEdit', 'hidden', false);
      toggleShiftFormClass('btnDeleteEdit', 'hidden', false);
      clearErrors();
      renderDraftShiftSummary();
      openOverlay('overlayEditShift');
      render();
    }

    function exitEditMode(nextTab) {
      editingShiftId = null;
      closeOverlay('overlayEditShift');
      restoreEditFormToHome();
      setFormMode('add');
      setShiftFormText('formTitle', 'Новая смена');
      toggleShiftFormClass('editBadge', 'visible', false);
      setShiftFormText('btnAdd', 'Сохранить смену');
      toggleShiftFormClass('btnCancelEdit', 'hidden', true);
      toggleShiftFormClass('btnDeleteEdit', 'hidden', true);
      clearErrors();
      setShiftFormValue('inputStartDate', '');
      setShiftFormValue('inputStartTime', '');
      setShiftFormValue('inputEndDate', '');
      setShiftFormValue('inputEndTime', '');
      clearOptionalShiftData();
      setAddDetailsExpanded(false);
      setDefaultShiftTimeInputs();
      if (typeof pendingAddShiftScheduleOrigin !== 'undefined') pendingAddShiftScheduleOrigin = null;
      renderDraftShiftSummary();
      var targetTab = nextTab || editReturnTab || 'home';
      editReturnTab = 'shifts';
      setActiveTab(targetTab);
      render();
    }

    function handleEditClick(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      var id = e.currentTarget.getAttribute('data-id');
      var shift = findShiftById(id);
      if (!shift) return;
      triggerHapticTapLight();
      enterEditMode(shift, { returnTab: activeTab });
    }

    function bindClickById(id, handler) {
      var el = document.getElementById(id);
      if (!el || typeof handler !== 'function') return null;
      el.addEventListener('click', handler);
      return el;
    }

    bindClickById('btnConfirmDelete', function() {
      if (pendingScheduleDeletePeriodId) {
        triggerHapticWarning();
        var deletedPeriodId = pendingScheduleDeletePeriodId;
        var shouldResetPlanner = !!(selectedSchedulePeriodId && selectedSchedulePeriodId === String(deletedPeriodId));
        var wasOnline = !!navigator.onLine;
        clearScheduleConflictState();
        deleteSchedulePeriod(deletedPeriodId, function(err) {
          if (err) {
            triggerHapticError();
            showSaveToast('Не получилось удалить период графика', 'danger');
            return;
          }
          pendingScheduleDeletePeriodId = null;
          closeOverlay('overlayConfirm');
          render();
          showSaveToast(wasOnline ? 'Период графика удалён' : 'Период графика удалён. Когда интернет появится, всё синхронизируется автоматически', 'neutral');
          if (shouldResetPlanner && typeof resetSchedulePlannerForm === 'function') {
            resetSchedulePlannerForm();
          }
        });
        return;
      }
      if (!pendingDeleteId) return;
      triggerHapticActionMedium();
      var newShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (allShifts[i].id !== pendingDeleteId) newShifts.push(allShifts[i]);
      }
      allShifts = newShifts;
      pendingMutationIds = [];
      if (editingShiftId === pendingDeleteId) {
        exitEditMode();
      }
      pendingDeleteId = null;
      closeOverlay('overlayConfirm');

      // Optimistic render — remove shift from UI immediately, before network
      render();

      saveShifts(function(err) {
        if (err) {
          triggerHapticError();
          loadShifts(function() {
            render();
          });
          return;
        }
        triggerHapticSuccess();
        showActionToast('deleted');
        render();
      });
    });

    bindClickById('btnCancelDelete', function() {
      pendingDeleteId = null;
      pendingScheduleDeletePeriodId = null;
      closeOverlay('overlayConfirm');
      showActionToast('canceled');
      render();
    });

    function shiftCurrentMonthBy(delta) {
      if (delta === 0) return;
      if (delta > 0) {
        if (currentMonth === 11) { currentMonth = 0; currentYear++; }
        else currentMonth++;
        return;
      }
      if (currentMonth === 0) { currentMonth = 11; currentYear--; }
      else currentMonth--;
    }

    function bindCurrentMonthNavButton(buttonId, delta) {
      var button = document.getElementById(buttonId);
      if (!button) return;
      button.addEventListener('click', function() {
        triggerHapticSelection();
        shiftCurrentMonthBy(delta);
        render();
      });
    }

    // ── Month navigation ──
    bindCurrentMonthNavButton('btnPrevMonth', -1);
    bindCurrentMonthNavButton('btnNextMonth', 1);
    bindCurrentMonthNavButton('btnPrevShiftsMonth', -1);
    bindCurrentMonthNavButton('btnNextShiftsMonth', 1);
    bindCurrentMonthNavButton('btnPrevSalaryMonth', -1);
    bindCurrentMonthNavButton('btnNextSalaryMonth', 1);

    // ── Add shift form ──
    function clearErrors() {
      setShiftFormText('errStart', '');
      setShiftFormText('errEnd', '');
      toggleShiftFormClass('inputStartDate', 'input-error', false);
      toggleShiftFormClass('inputStartTime', 'input-error', false);
      toggleShiftFormClass('inputEndDate', 'input-error', false);
      toggleShiftFormClass('inputEndTime', 'input-error', false);
      setShiftFormText('formSuccess', '');
    }

    var inputStartDateEl = document.getElementById('inputStartDate');
    var inputStartTimeEl = document.getElementById('inputStartTime');
    var inputEndDateEl = document.getElementById('inputEndDate');
    var inputEndTimeEl = document.getElementById('inputEndTime');
    var routeTypeButtons = document.querySelectorAll('#routeTypeSegmented .segmented-btn');
    var addDetailsToggleBtn = document.getElementById('btnToggleAddDetails');
    var addDetailsSection = document.getElementById('addDetailsSection');

    function setAddDetailsExpanded(expanded) {
      if (!addDetailsSection || !addDetailsToggleBtn) return;
      var isExpanded = expanded === true;
      var titleEl = addDetailsToggleBtn.querySelector('.details-disclosure-title');
      var noteEl = document.getElementById('addDetailsNote');
      var iconEl = addDetailsToggleBtn.querySelector('.details-disclosure-icon');
      addDetailsSection.classList.toggle('hidden', !isExpanded);
      addDetailsToggleBtn.classList.toggle('is-expanded', isExpanded);
      addDetailsToggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      if (titleEl) {
        titleEl.textContent = isExpanded ? 'Скрыть детали смены' : 'Открыть детали смены';
      }
      if (noteEl) {
        noteEl.textContent = isExpanded
          ? 'Все поля ниже необязательные. Заполняйте только то, что хотите сохранить в записи.'
          : 'Маршрут, локомотив, поезд, топливо и заметки доступны в полном виде.';
      }
      if (iconEl) {
        iconEl.textContent = '⌄';
      }
    }
    setFormMode('add');
    clearOptionalShiftData();
    setAddDetailsExpanded(false);

    setDefaultShiftTimeInputs();
    renderDraftShiftSummary();
    resetViewportBaselines();
    updateViewportMetrics();
    scheduleBottomNavHeightSync();
    settleSafeAreaInsets();
    scheduleKeyboardSync();
    telegramLayoutBindRetries = 0;
    scheduleTelegramLayoutBinding();
    requestTelegramLayoutMetrics();
    window.addEventListener('load', function() {
      setDefaultShiftTimeInputs();
      telegramLayoutBindRetries = 0;
      scheduleTelegramLayoutBinding();
      requestTelegramLayoutMetrics();
      scheduleViewportMetricsUpdate();
      settleSafeAreaInsets();
    });
    setTimeout(setDefaultShiftTimeInputs, 0);
    setTimeout(setDefaultShiftTimeInputs, 250);

    window.addEventListener('resize', function() {
      requestTelegramLayoutMetrics();
      scheduleViewportMetricsUpdate();
      scheduleBottomNavHeightSync();
      scheduleKeyboardSync();
    });
    window.addEventListener('orientationchange', function() {
      requestTelegramLayoutMetrics();
      resetViewportBaselines();
      settleSafeAreaInsets();
      scheduleViewportMetricsUpdate();
      scheduleBottomNavHeightSync();
      scheduleKeyboardSync();
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        requestTelegramLayoutMetrics();
        scheduleViewportMetricsUpdate();
        scheduleBottomNavHeightSync();
        scheduleKeyboardSync();
      });
      window.visualViewport.addEventListener('scroll', scheduleKeyboardSync);
    }
    window.setTimeout(function() {
      suppressInitialListReveal = false;
    }, 900);
    document.addEventListener('pointerdown', function() {
      suppressInitialListReveal = false;
    }, { once: true, passive: true });
    document.addEventListener('focusin', function(e) {
      if (!isKeyboardInputElement(e.target) || !isKeyboardFieldEligible(e.target)) return;
      scheduleKeyboardSync();
    });
    document.addEventListener('focusout', function(e) {
      if (!isKeyboardInputElement(e.target) || !isKeyboardFieldEligible(e.target)) return;
      window.setTimeout(scheduleKeyboardSync, 80);
    });

    inputStartDateEl.addEventListener('pointerdown', setDefaultShiftTimeInputs);
    inputStartTimeEl.addEventListener('pointerdown', setDefaultShiftTimeInputs);
    inputStartDateEl.addEventListener('touchstart', setDefaultShiftTimeInputs, { passive: true });
    inputStartTimeEl.addEventListener('touchstart', setDefaultShiftTimeInputs, { passive: true });
    inputStartDateEl.addEventListener('focus', setDefaultShiftTimeInputs);
    inputStartTimeEl.addEventListener('focus', setDefaultShiftTimeInputs);
    inputStartDateEl.addEventListener('click', setDefaultShiftTimeInputs);
    inputStartTimeEl.addEventListener('click', setDefaultShiftTimeInputs);
    inputStartDateEl.addEventListener('input', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputStartTimeEl.addEventListener('input', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputStartDateEl.addEventListener('change', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputStartTimeEl.addEventListener('change', function() {
      syncEndFromStart();
      renderDraftShiftSummary();
    });
    inputEndDateEl.addEventListener('input', renderDraftShiftSummary);
    inputEndTimeEl.addEventListener('input', renderDraftShiftSummary);
    inputEndDateEl.addEventListener('change', renderDraftShiftSummary);
    inputEndTimeEl.addEventListener('change', renderDraftShiftSummary);

    wireNumericInput('inputLocoNumber', 4);
    wireNumericInput('inputTrainNumber', 4);
    wireNumericInput('inputTrainWeight', 4);
    wireNumericInput('inputTrainAxles', 3);
    wireNumericInput('inputTrainLength', 3);
    wireNumericInput('inputFuelReceiveLitersA', 4);
    wireNumericInput('inputFuelReceiveLitersB', 4);
    wireNumericInput('inputFuelReceiveLitersV', 4);
    wireNumericInput('inputFuelHandoverLitersA', 4);
    wireNumericInput('inputFuelHandoverLitersB', 4);
    wireNumericInput('inputFuelHandoverLitersV', 4);
    wireFuelCoeffInput('inputFuelReceiveCoeffA');
    wireFuelCoeffInput('inputFuelReceiveCoeffB');
    wireFuelCoeffInput('inputFuelReceiveCoeffV');
    wireFuelCoeffInput('inputFuelHandoverCoeffA');
    wireFuelCoeffInput('inputFuelHandoverCoeffB');
    wireFuelCoeffInput('inputFuelHandoverCoeffV');
    updateFuelKgOutputs();

    var inputLocoSeriesEl = document.getElementById('inputLocoSeries');
    if (inputLocoSeriesEl) {
      inputLocoSeriesEl.addEventListener('change', function(e) {
        updateSelectPlaceholderState(e.currentTarget);
        renderDraftShiftSummary();
      });
    }
    buildLocoSeriesMenu();
    syncLocoSeriesTrigger();
    var locoSeriesTriggerEl = document.getElementById('locoSeriesTrigger');
    var locoSeriesMenuEl = document.getElementById('locoSeriesMenu');
    if (locoSeriesTriggerEl) {
      locoSeriesTriggerEl.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleLocoSeriesMenu();
      });
    }
    if (locoSeriesMenuEl) {
      locoSeriesMenuEl.addEventListener('click', function(e) {
        var option = e.target.closest('.glass-select-option');
        if (!option) return;
        setLocoSeriesValue(option.getAttribute('data-value'));
      });
    }
    if (SHIFT_ACTIONS_MENU) {
      SHIFT_ACTIONS_MENU.addEventListener('pointerup', function(e) {
        var item = e.target.closest('.shift-actions-item');
        if (!item) return;
        handleShiftActionsItemClick(item, e);
      });
      SHIFT_ACTIONS_MENU.addEventListener('click', function(e) {
        var item = e.target.closest('.shift-actions-item');
        if (!item) return;
        handleShiftActionsItemClick(item, e);
      });
      SHIFT_ACTIONS_MENU.addEventListener('touchend', function(e) {
        var item = e.target.closest('.shift-actions-item');
        if (!item) return;
        handleShiftActionsItemClick(item, e);
      }, { passive: false });
    }
    document.addEventListener('pointerdown', function(e) {
      var els = getLocoSeriesMenuEls();
      if (!els.menuEl || els.menuEl.classList.contains('hidden')) return;
      var clickedTrigger = !!(els.triggerEl && els.triggerEl.contains(e.target));
      var clickedMenu = !!els.menuEl.contains(e.target);
      if (!clickedTrigger && !clickedMenu) closeLocoSeriesMenu();
    });
    document.addEventListener('pointerdown', function(e) {
      if (activeShiftMenuId === null) return;
      var clickedTrigger = !!e.target.closest('.shift-actions-trigger');
      var clickedMenu = !!(SHIFT_ACTIONS_MENU && SHIFT_ACTIONS_MENU.contains(e.target));
      if (!clickedTrigger && !clickedMenu) closeShiftActionsMenu(true);
    });
    document.addEventListener('click', function(e) {
      if (activeShiftMenuId === null) return;
      var clickedTrigger = !!e.target.closest('.shift-actions-trigger');
      var clickedMenu = !!(SHIFT_ACTIONS_MENU && SHIFT_ACTIONS_MENU.contains(e.target));
      if (!clickedTrigger && !clickedMenu) closeShiftActionsMenu(true);
    }, true);
    document.addEventListener('scroll', function() {
      if (LOCO_SERIES_MENU_OPEN) updateLocoSeriesMenuPosition();
      if (activeShiftMenuId !== null) closeShiftActionsMenu(true);
    }, true);
    window.addEventListener('resize', function() {
      if (LOCO_SERIES_MENU_OPEN) updateLocoSeriesMenuPosition();
      if (activeShiftMenuId !== null) closeShiftActionsMenu(true);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLocoSeriesMenu();
      if (e.key === 'Escape') closeShiftActionsMenu(true);
      if (e.key === 'Escape') closeDocsViewerUI();
      if (e.key === 'Escape') closeShiftDetail();
    });
    window.addEventListener('popstate', function() {
      if (shiftDetailState.skipNextPopstateClose) {
        shiftDetailState.skipNextPopstateClose = false;
        return;
      }
      if (shiftDetailState.isOpen || shiftDetailState.isAnimating) {
        closeShiftDetail({ fromPopstate: true, skipHistoryBack: true, force: true });
      }
    });
    window.addEventListener('online', function() {
      updateOfflineUiState({ isOffline: false, lastSyncStatus: readPendingSnapshot() ? 'pending' : 'synced' });
      flushPendingSnapshot();
      if (typeof flushPendingScheduleSnapshot === 'function') flushPendingScheduleSnapshot();
      refreshUserStats('online');
    });
    window.addEventListener('offline', function() {
      applyUserStatsOfflineFallback();
    });
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        telegramLayoutBindRetries = 0;
        scheduleTelegramLayoutBinding();
        requestTelegramLayoutMetrics();
        settleSafeAreaInsets();
        scheduleViewportMetricsUpdate();
        scheduleBottomNavHeightSync();
        updateOfflineUiState({ isOffline: !navigator.onLine, hasPending: !!readPendingSnapshot() });
        if (navigator.onLine) {
          flushPendingSnapshot();
          if (typeof flushPendingScheduleSnapshot === 'function') flushPendingScheduleSnapshot();
          refreshUserStats('visibility');
        } else {
          applyUserStatsOfflineFallback();
        }
        renderInstallPromptCard();
        renderInstructionsScreen();
      }
    });

    // Auto-retry pending sync every 30s — catches cases where the 'online' event
    // fired but sync failed (e.g. flaky network), without requiring user action.
    setInterval(function() {
      if (navigator.onLine && readPendingSnapshot() && !offlineUiState.isSyncing) {
        flushPendingSnapshot();
      }
      if (navigator.onLine && typeof readPendingScheduleSnapshot === 'function' && readPendingScheduleSnapshot()) {
        flushPendingScheduleSnapshot();
      }
    }, 30000);
    var inputRouteFromEl = document.getElementById('inputRouteFrom');
    if (inputRouteFromEl) inputRouteFromEl.addEventListener('input', renderDraftShiftSummary);
    var inputRouteToEl = document.getElementById('inputRouteTo');
    if (inputRouteToEl) inputRouteToEl.addEventListener('input', renderDraftShiftSummary);
    var fuelReactiveInputs = [
      'inputFuelReceiveLitersA',
      'inputFuelReceiveLitersB',
      'inputFuelReceiveLitersV',
      'inputFuelHandoverLitersA',
      'inputFuelHandoverLitersB',
      'inputFuelHandoverLitersV'
    ];
    for (var fr = 0; fr < fuelReactiveInputs.length; fr++) {
      var fuelInput = document.getElementById(fuelReactiveInputs[fr]);
      if (!fuelInput) continue;
      fuelInput.addEventListener('input', updateFuelKgOutputs);
      fuelInput.addEventListener('blur', updateFuelKgOutputs);
    }
    if (addDetailsToggleBtn) {
      addDetailsToggleBtn.addEventListener('click', function() {
        triggerHapticTapLight();
        setAddDetailsExpanded(addDetailsSection && addDetailsSection.classList.contains('hidden'));
      });
    }

    for (var rt = 0; rt < routeTypeButtons.length; rt++) {
      routeTypeButtons[rt].addEventListener('click', function(e) {
        var nextRouteType = e.currentTarget.getAttribute('data-value');
        if (nextRouteType !== getRouteType()) {
          triggerHapticSelection();
        }
        setRouteType(nextRouteType);
        renderDraftShiftSummary();
      });
    }

    var btnAddEl = document.getElementById('btnAdd');
    if (btnAddEl) btnAddEl.addEventListener('click', function() {
      clearErrors();

      var startVal = composeMskDateTime(inputStartDateEl.value, inputStartTimeEl.value);
      var endVal = composeMskDateTime(inputEndDateEl.value, inputEndTimeEl.value);
      var valid = true;

      if (!startVal) {
        document.getElementById('errStart').textContent = 'Укажите дату и время начала';
        inputStartDateEl.classList.add('input-error');
        inputStartTimeEl.classList.add('input-error');
        valid = false;
      }

      if (!endVal) {
        document.getElementById('errEnd').textContent = 'Укажите дату и время окончания';
        inputEndDateEl.classList.add('input-error');
        inputEndTimeEl.classList.add('input-error');
        valid = false;
      }

      if (!valid) {
        triggerHapticError();
        return;
      }

      var startDate = parseMsk(startVal);
      var endDate = parseMsk(endVal);

      if (!startDate || !endDate) {
        document.getElementById('errStart').textContent = 'Неверный формат даты';
        triggerHapticError();
        return;
      }

      if (endDate.getTime() <= startDate.getTime()) {
        document.getElementById('errEnd').textContent = 'Время окончания не может быть раньше начала';
        inputEndDateEl.classList.add('input-error');
        inputEndTimeEl.classList.add('input-error');
        triggerHapticError();
        return;
      }

      var previousShifts = allShifts.slice();
      var isEditing = !!editingShiftId;
      var shiftId = isEditing ? editingShiftId : (Date.now().toString(36) + Math.random().toString(36).substring(2, 7));
      var existingShift = isEditing ? findShiftById(shiftId) : null;
      var optionalData = collectOptionalShiftData();
      var shift = {
        id: shiftId,
        start_msk: startVal,
        end_msk: endVal,
        created_at: existingShift && existingShift.created_at ? existingShift.created_at : new Date().toISOString(),
        locomotive_series: optionalData.locomotive_series,
        locomotive_number: optionalData.locomotive_number,
        train_number: optionalData.train_number,
        train_weight: optionalData.train_weight,
        train_axles: optionalData.train_axles,
        train_length: optionalData.train_length,
        notes: optionalData.notes,
        route_kind: optionalData.route_kind,
        route_from: optionalData.route_from,
        route_to: optionalData.route_to,
        fuel_receive_coeff: optionalData.fuel_receive_coeff,
        fuel_receive_coeff_a: optionalData.fuel_receive_coeff_a,
        fuel_receive_coeff_b: optionalData.fuel_receive_coeff_b,
        fuel_receive_coeff_v: optionalData.fuel_receive_coeff_v,
        fuel_receive_liters_a: optionalData.fuel_receive_liters_a,
        fuel_receive_liters_b: optionalData.fuel_receive_liters_b,
        fuel_receive_liters_v: optionalData.fuel_receive_liters_v,
        fuel_handover_coeff: optionalData.fuel_handover_coeff,
        fuel_handover_coeff_a: optionalData.fuel_handover_coeff_a,
        fuel_handover_coeff_b: optionalData.fuel_handover_coeff_b,
        fuel_handover_coeff_v: optionalData.fuel_handover_coeff_v,
        fuel_handover_liters_a: optionalData.fuel_handover_liters_a,
        fuel_handover_liters_b: optionalData.fuel_handover_liters_b,
        fuel_handover_liters_v: optionalData.fuel_handover_liters_v
      };
      if (typeof inferShiftWorkCodeByLocalTime === 'function') {
        shift.code = inferShiftWorkCodeByLocalTime(shift) || '';
      }

      if (isEditing) {
        var replaced = false;
        for (var i = 0; i < allShifts.length; i++) {
          if (allShifts[i].id === shiftId) {
            allShifts[i] = shift;
            replaced = true;
            break;
          }
        }
        if (!replaced) {
          allShifts.push(shift);
        }
      } else {
        allShifts.push(shift);
      }

      pendingMutationIds = [shiftId];

      // Disable button during save
      var btn = document.getElementById('btnAdd');
      btn.disabled = true;

      // Optimistic render — show change in UI immediately, before network
      render();

      saveShifts(function(err) {
        if (err) {
          triggerHapticError();
          allShifts = previousShifts;
          btn.disabled = false;
          document.getElementById('formSuccess').textContent = 'Не удалось сохранить смену';
          render();
          return;
        }

        triggerHapticSuccess();
        showActionToast(isEditing ? 'saved' : 'added');

        if (isEditing) {
          exitEditMode();
          clearRecentAddHighlight();
        } else {
          inputStartDateEl.value = '';
          inputStartTimeEl.value = '';
          inputEndDateEl.value = '';
          inputEndTimeEl.value = '';
          clearOptionalShiftData();
          setAddDetailsExpanded(false);
          setFormMode('add');
          if (typeof pendingAddShiftScheduleOrigin !== 'undefined') pendingAddShiftScheduleOrigin = null;
          clearRecentAddHighlight();
          recentAddedShiftId = shiftId;
          if (recentAddTimer) clearTimeout(recentAddTimer);
          recentAddTimer = setTimeout(function() {
            recentAddedShiftId = null;
            recentAddTimer = null;
            render();
          }, 1600);
          setActiveTab('home');
        }
        document.getElementById('formSuccess').textContent = isEditing ? '✓ Изменения сохранены' : '✓ Смена сохранена';
        btn.disabled = false;
        if (!isEditing) {
          var section = document.getElementById('shiftFormSection');
          section.classList.remove('add-pulse');
          void section.offsetWidth;
          section.classList.add('add-pulse');
          setTimeout(function() {
            section.classList.remove('add-pulse');
          }, 750);
        }
        render();

        // Clear success message after 2s
        setTimeout(function() {
          document.getElementById('formSuccess').textContent = '';
        }, 2000);
      });
    });

    // ── Overlays ──
    function syncOverlayUiState() {
      var overlays = document.querySelectorAll('.overlay');
      var hasOpenOverlay = false;
      for (var i = 0; i < overlays.length; i++) {
        var isOpen = overlays[i].classList.contains('is-open') || overlays[i].classList.contains('visible');
        if (isOpen) hasOpenOverlay = true;
        overlays[i].setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      }
      if (document.body) {
        document.body.classList.toggle('has-open-overlay', hasOpenOverlay);
      }
    }

    function setOverlayOpenState(id, isOpen) {
      var overlay = document.getElementById(id);
      if (!overlay) return;
      if (isOpen && overlay.parentNode) {
        overlay.parentNode.appendChild(overlay);
      }
      overlay.classList.toggle('is-open', !!isOpen);
      // Keep legacy class for compatibility with any older styles or scripts.
      overlay.classList.toggle('visible', !!isOpen);
      overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      syncOverlayUiState();
    }

    function openOverlay(id) {
      closeShiftActionsMenu(true);
      closeLocoSeriesMenu();
      setOverlayOpenState(id, true);
    }

    function closeOverlay(id) {
      setOverlayOpenState(id, false);
      if (id === 'overlayConfirm' && (pendingDeleteId || pendingScheduleDeletePeriodId)) {
        pendingDeleteId = null;
        pendingScheduleDeletePeriodId = null;
        render();
      }
    }

    // Close on backdrop click
    var overlays = document.querySelectorAll('.overlay');
    for (var oi = 0; oi < overlays.length; oi++) {
      overlays[oi].addEventListener('click', function(e) {
        if (e.target === e.currentTarget) {
          closeOverlay(e.currentTarget.id);
        }
      });
    }
    syncOverlayUiState();

    function openInstallGuideSheet() {
      var appUrl = getAppUrl();
      setInstallGuideUrl(appUrl);
      resetInstallGuideCopyFeedback();
      updateInstallGuideContent();
      openOverlay('overlayAddScreen');
    }

    // ── Add to Screen ──
    var showInstallGuideBtn = document.getElementById('btnShowInstallGuide');
    if (showInstallGuideBtn) {
      showInstallGuideBtn.addEventListener('click', function() {
        maybeShowNativeInstallPrompt().then(function(result) {
          if (result && result.outcome === 'accepted') {
            return;
          }
          openInstallGuideSheet();
        });
      });
    }
    var dismissInstallCardBtn = document.getElementById('btnDismissInstallCard');
    if (dismissInstallCardBtn) {
      dismissInstallCardBtn.addEventListener('click', function() {
        dismissInstallPromptCard();
      });
    }

    var openSalarySettingsBtn = document.getElementById('btnOpenSalarySettings');
    if (openSalarySettingsBtn) {
      openSalarySettingsBtn.addEventListener('click', function() {
        triggerHapticSelection();
        updateSettingsControls();
        openOverlay('overlaySalarySettings');
      });
    }
    var saveSalarySettingsBtn = document.getElementById('btnSaveSalarySettings');
    if (saveSalarySettingsBtn) {
      saveSalarySettingsBtn.addEventListener('click', function() {
        triggerHapticSuccess();
        syncSettingsFromInputs();
        closeOverlay('overlaySalarySettings');
        showActionToast('saved');
      });
    }

    function setSegmentedValue(containerId, value) {
      var buttons = document.querySelectorAll('#' + containerId + ' .segmented-btn');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('active', buttons[i].getAttribute('data-value') === value);
      }
    }

    function getSegmentedValue(containerId, fallback) {
      var active = document.querySelector('#' + containerId + ' .segmented-btn.active');
      return active ? active.getAttribute('data-value') : fallback;
    }

    function syncSchedulePatternPreview() {
      var input = document.getElementById('schedulePatternValue');
      var preview = document.getElementById('schedulePatternPreview');
      if (!input || !preview) return;
      preview.textContent = formatSchedulePattern(input.value || '');
    }

    function syncSchedulePlannerFormMeta() {
      var titleEl = document.getElementById('schedulePlannerSectionTitle');
      var noteEl = document.getElementById('schedulePlannerModeNote');
      var saveBtn = document.getElementById('btnSaveSchedulePeriod');
      var editBadgeEl = document.getElementById('schedulePlannerEditBadge');
      var formCardEl = document.querySelector('.schedule-form-card');
      var isEditing = !!selectedSchedulePeriodId;
      var hasConflict = !!(pendingScheduleConflict && pendingScheduleConflict.overlaps && pendingScheduleConflict.overlaps.length);
      if (titleEl) titleEl.textContent = isEditing ? 'Изменить период' : 'Добавить период';
      if (noteEl) {
        if (isEditing) noteEl.textContent = 'Измените даты, цикл и время, затем сохраните.';
        else if (hasConflict) noteEl.textContent = 'Периоды пересекаются. Откройте старый или замените его с новой даты.';
        else noteEl.textContent = 'Заполните поля ниже и сохраните график.';
      }
      if (saveBtn) saveBtn.textContent = isEditing ? 'Сохранить изменения' : 'Сохранить график';
      if (editBadgeEl) editBadgeEl.classList.toggle('visible', isEditing);
      if (formCardEl) formCardEl.classList.toggle('is-editing', isEditing);
    }

    function readSchedulePlannerDraft() {
      return {
        id: selectedSchedulePeriodId || createSchedulePeriodId(),
        mode: 'cycle',
        startDate: normalizeDateKey(document.getElementById('schedulePeriodStartDate').value),
        endDate: normalizeDateKey(document.getElementById('schedulePeriodEndDate').value),
        pattern: normalizeSchedulePattern(document.getElementById('schedulePatternValue').value || ''),
        startTime: normalizeTimeValue(document.getElementById('scheduleDefaultStartTime').value, '01:00'),
        endTime: normalizeTimeValue(document.getElementById('scheduleDefaultEndTime').value, '13:00')
      };
    }

    function clearScheduleConflictState() {
      setPendingScheduleConflict(null);
      syncSchedulePlannerFormMeta();
    }

    function resetSchedulePlannerForm() {
      var startDateEl = document.getElementById('schedulePeriodStartDate');
      var endDateEl = document.getElementById('schedulePeriodEndDate');
      var patternEl = document.getElementById('schedulePatternValue');
      var startTimeEl = document.getElementById('scheduleDefaultStartTime');
      var endTimeEl = document.getElementById('scheduleDefaultEndTime');
      setSelectedSchedulePeriod('');
      clearScheduleConflictState();
      if (startDateEl) startDateEl.value = typeof getVisibleMonthStartDateKey === 'function' ? getVisibleMonthStartDateKey() : getTodayDateKey();
      if (endDateEl) endDateEl.value = '';
      if (patternEl) patternEl.value = '';
      if (startTimeEl) startTimeEl.value = '01:00';
      if (endTimeEl) endTimeEl.value = '13:00';
      syncSchedulePatternPreview();
      syncSchedulePlannerFormMeta();
    }

    function fillSchedulePlannerForm(periodId) {
      var period = getSchedulePeriodById(periodId);
      if (!period) {
        resetSchedulePlannerForm();
        return;
      }
      setSelectedSchedulePeriod(period.id);
      clearScheduleConflictState();
      var startDateEl = document.getElementById('schedulePeriodStartDate');
      var endDateEl = document.getElementById('schedulePeriodEndDate');
      var patternEl = document.getElementById('schedulePatternValue');
      var startTimeEl = document.getElementById('scheduleDefaultStartTime');
      var endTimeEl = document.getElementById('scheduleDefaultEndTime');
      if (startDateEl) startDateEl.value = period.startDate || '';
      if (endDateEl) endDateEl.value = period.endDate || '';
      if (patternEl) patternEl.value = period.pattern || '';
      if (startTimeEl) startTimeEl.value = period.startTime || '01:00';
      if (endTimeEl) endTimeEl.value = period.endTime || '13:00';
      syncSchedulePatternPreview();
      syncSchedulePlannerFormMeta();
      renderSchedulePlannerOverlay();
    }

    function syncScheduleDayTimeFields() {}

    var openSchedulePlannerBtn = document.getElementById('btnOpenSchedulePlanner');
    if (openSchedulePlannerBtn) {
      openSchedulePlannerBtn.addEventListener('click', function() {
        triggerHapticSelection();
        resetSchedulePlannerForm();
        renderSchedulePlannerOverlay();
        openOverlay('overlaySchedulePlanner');
      });
    }

    var closeSchedulePlannerBtn = document.getElementById('btnCloseSchedulePlanner');
    if (closeSchedulePlannerBtn) {
      closeSchedulePlannerBtn.addEventListener('click', function() {
        closeOverlay('overlaySchedulePlanner');
      });
    }

    var schedulePatternBuilder = document.querySelector('.schedule-pattern-builder');
    if (schedulePatternBuilder) {
      schedulePatternBuilder.addEventListener('click', function(e) {
        var input = document.getElementById('schedulePatternValue');
        if (!input) return;
        var addBtn = e.target.closest('[data-pattern-add]');
        if (addBtn) {
          input.value = normalizeSchedulePattern((input.value || '') + addBtn.getAttribute('data-pattern-add'));
          syncSchedulePatternPreview();
          return;
        }
        if (e.target.closest('#btnSchedulePatternBackspace')) {
          input.value = normalizeSchedulePattern((input.value || '').slice(0, -1));
          syncSchedulePatternPreview();
          return;
        }
        if (e.target.closest('#btnSchedulePatternClear')) {
          input.value = '';
          syncSchedulePatternPreview();
        }
      });
    }

    function persistScheduleMaterializedMonth(options) {
      return false;
    }

    var saveSchedulePeriodBtn = document.getElementById('btnSaveSchedulePeriod');
    if (saveSchedulePeriodBtn) {
      saveSchedulePeriodBtn.addEventListener('click', function() {
        var draft = readSchedulePlannerDraft();
        if (!draft.startDate) {
          showSaveToast('Укажите дату начала', 'danger');
          return;
        }
        if (draft.endDate && compareDateKeys(draft.endDate, draft.startDate) < 0) {
          showSaveToast('Окончание раньше начала', 'danger');
          return;
        }
        if (!draft.pattern) {
          showSaveToast('Сначала задайте цикл графика', 'danger');
          return;
        }
        var overlaps = getOverlappingSchedulePeriods(draft, selectedSchedulePeriodId);
        if (overlaps.length) {
          setPendingScheduleConflict({ draft: draft, overlaps: overlaps });
          syncSchedulePlannerFormMeta();
          renderSchedulePlannerOverlay();
          showSaveToast('Периоды пересекаются. Выберите ниже, как поступить', 'danger');
          return;
        }
        clearScheduleConflictState();
        var isEditingPeriod = !!selectedSchedulePeriodId;
        upsertSchedulePeriod(draft);
        persistScheduleMaterializedMonth({ purgePeriodIds: [draft.id] });
        triggerHapticSuccess();
        render();
        resetSchedulePlannerForm();
        closeOverlay('overlaySchedulePlanner');
        showSaveToast(isEditingPeriod ? 'Изменения в графике сохранены' : 'Новый период графика сохранён', 'success');
      });
    }

    var schedulePeriodsListEl = document.getElementById('schedulePeriodsList');
    if (schedulePeriodsListEl) {
      schedulePeriodsListEl.addEventListener('click', function(e) {
        var actionBtn = e.target.closest('[data-schedule-period-action]');
        if (actionBtn) {
          var action = actionBtn.getAttribute('data-schedule-period-action');
          var periodId = actionBtn.getAttribute('data-schedule-period-id');
          if (!periodId) return;
          if (action === 'delete') {
            clearScheduleConflictState();
            setSelectedSchedulePeriod(periodId);
            pendingScheduleDeletePeriodId = periodId;
            triggerHapticWarning();
            render();
            openOverlay('overlayConfirm');
            return;
          }
          triggerHapticSelection();
          fillSchedulePlannerForm(periodId);
          return;
        }
        var cardBtn = e.target.closest('[data-schedule-period-card]');
        if (!cardBtn) return;
        triggerHapticSelection();
        fillSchedulePlannerForm(cardBtn.getAttribute('data-schedule-period-card'));
      });
    }

    var scheduleConflictBoxEl = document.getElementById('scheduleConflictBox');
    if (scheduleConflictBoxEl) {
      scheduleConflictBoxEl.addEventListener('click', function(e) {
        var actionBtn = e.target.closest('[data-schedule-conflict-action]');
        if (!actionBtn || !pendingScheduleConflict) return;
        var action = actionBtn.getAttribute('data-schedule-conflict-action');
        if (action === 'edit') {
          var overlap = pendingScheduleConflict.overlaps && pendingScheduleConflict.overlaps[0];
          if (overlap) {
            triggerHapticSelection();
            fillSchedulePlannerForm(overlap.id);
          }
          return;
        }
        if (action === 'replace') {
          var replaceIds = [];
          for (var i = 0; i < pendingScheduleConflict.overlaps.length; i++) {
            replaceIds.push(pendingScheduleConflict.overlaps[i].id);
          }
          replaceSchedulePeriods(pendingScheduleConflict.draft, replaceIds);
          persistScheduleMaterializedMonth({ purgePeriodIds: [pendingScheduleConflict.draft.id].concat(replaceIds) });
          clearScheduleConflictState();
          triggerHapticSuccess();
          render();
          resetSchedulePlannerForm();
          closeOverlay('overlaySchedulePlanner');
          showSaveToast('Старый период заменён, начиная с новой даты', 'success');
        }
      });
    }

    var closeScheduleDayBtn = document.getElementById('btnCloseScheduleDay');
    if (closeScheduleDayBtn) {
      closeScheduleDayBtn.addEventListener('click', function() {
        closeOverlay('overlayScheduleDay');
      });
    }

    var scheduleDayAddShiftBtn = document.getElementById('btnScheduleDayAddShift');
    if (scheduleDayAddShiftBtn) {
      scheduleDayAddShiftBtn.addEventListener('click', function() {
        var state = resolveScheduleDay(selectedScheduleDayKey || getTodayDateKey());
        closeOverlay('overlayScheduleDay');
        openAddShiftForDate(state.dateKey, {
          routeKind: state.plannedCode ? 'depot' : 'trip',
          startTime: state.startTime || '01:00',
          endTime: state.endTime || '13:00',
          scheduleOrigin: state && state.period
            ? { dateKey: state.dateKey, periodId: state.period.id }
            : null
        });
      });
    }

    var scheduleDayEditShiftBtn = document.getElementById('btnScheduleDayEditShift');
    if (scheduleDayEditShiftBtn) {
      scheduleDayEditShiftBtn.addEventListener('click', function() {
        var shiftId = this.getAttribute('data-shift-id');
        var dateKey = this.getAttribute('data-date-key') || (selectedScheduleDayKey || getTodayDateKey());
        closeOverlay('overlayScheduleDay');
        openShiftsForDate(dateKey, shiftId);
      });
    }

    resetSchedulePlannerForm();

    var instructionsShellEl = document.getElementById('instructionsShell');
    if (instructionsShellEl) {
      instructionsShellEl.addEventListener('click', function(e) {
        var trigger = e.target.closest('[data-action]');
        if (!trigger) return;
        var action = trigger.getAttribute('data-action');
        if (action === 'open-instruction') {
  openInstructionDetail(trigger.getAttribute('data-instruction-id'));
  return;
}
if (action === 'open-section') {
  openInstructionSection(
    trigger.getAttribute('data-instruction-id'),
    trigger.getAttribute('data-section-id')
  );
  return;
}
if (action === 'open-ref') {
  openInstructionReference(
    trigger.getAttribute('data-instruction-id'),
    trigger.getAttribute('data-target-number')
  );
  return;
}
if (action === 'scroll-node') {
  scrollToInstructionNodeAnchor(trigger.getAttribute('data-section-id'));
}
      });
    }

    var unlockDocsProBtn = document.getElementById('btnUnlockDocsPro');
    if (unlockDocsProBtn) {
      unlockDocsProBtn.addEventListener('click', function() {
        triggerHapticActionMedium();
        unlockDocsProForSession();
        showSaveToast('PRO открыт');
      });
    }

    // ── Documentation sub-tab switching + file actions ─────────────────────
    var docsShellEl = document.getElementById('docsShell');
    if (docsShellEl) {
      docsShellEl.addEventListener('click', function(e) {
        var entryBtn = e.target.closest('.docs-entry-tile[data-docs-entry]');
        if (entryBtn) {
          var entry = entryBtn.getAttribute('data-docs-entry');
          if (entry) {
            triggerHapticSelection();
            documentationStore.activeEntry = entry;
            if (entry === 'instructions') documentationStore.activeTab = 'instructions';
            else if (entry === 'folders') documentationStore.activeTab = 'folders';
            else if (entry === 'memos') documentationStore.activeTab = 'memos';
            else if (entry === 'reminders') documentationStore.activeTab = 'reminders';
            else documentationStore.activeTab = 'speeds';
            renderDocumentationScreen();
          }
          return;
        }

        var backBtn = e.target.closest('#docsBackButton');
        if (backBtn) {
          triggerHapticSelection();
          documentationStore.activeEntry = '';
          renderDocumentationScreen();
          return;
        }

        // Tab switch
        var btn = e.target.closest('.docs-tab-btn[data-docs-tab]');
        if (btn) {
          var tab = btn.getAttribute('data-docs-tab');
          if (tab && tab !== documentationStore.activeTab) {
            triggerHapticSelection();
            documentationStore.activeTab = tab;
            renderDocumentationScreen();
          }
          return;
        }

        // Open file in in-app viewer
        var item = e.target.closest('.docs-item[data-file-path]');
        if (item) {
          var filePath = item.getAttribute('data-file-path') || '';
          var fileName = item.getAttribute('data-file-name') || '';
          var mimeType = item.getAttribute('data-mime-type') || '';
          if (filePath) openDocFile(filePath, fileName, mimeType);
        }
      });
    }

    // Docs viewer: close
    var docsViewerCloseBtn = document.getElementById('docsViewerClose');
    if (docsViewerCloseBtn) {
      docsViewerCloseBtn.addEventListener('click', closeDocsViewerUI);
    }
    var docsViewerOverlay = document.getElementById('docsViewerOverlay');
    if (docsViewerOverlay) {
      docsViewerOverlay.addEventListener('click', function(e) {
        if (e.target === e.currentTarget) {
          closeDocsViewerUI();
        }
      });
    }
    if (SHIFT_DETAIL_CLOSE_BUTTON) {
      SHIFT_DETAIL_CLOSE_BUTTON.addEventListener('click', function() {
        closeShiftDetail();
      });
    }
    if (SHIFT_DETAIL_OVERLAY) {
      SHIFT_DETAIL_OVERLAY.addEventListener('click', function(e) {
        if (e.target === e.currentTarget) {
          closeShiftDetail();
        }
      });
    }
    var tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
    for (var tb = 0; tb < tabButtons.length; tb++) {
      tabButtons[tb].addEventListener('click', function(e) {
        var tab = e.currentTarget.getAttribute('data-tab');
        var isSameTab = tab === activeTab;
        if (tab === 'add') {
          if (!isSameTab) {
            triggerHapticTapSoft();
          }
          openAddTabAndFocusForm();
          return;
        }
        if (tab === 'shifts') {
          if (!isSameTab) {
            triggerHapticSelection();
          }
          setActiveTab('shifts');
          window.setTimeout(function() {
            render();
          }, 20);
          return;
        }
        if (!isSameTab) {
          triggerHapticSelection();
        }
        setActiveTab(tab);
      });
    }

    var goToShiftsBtn = document.getElementById('btnGoToShifts');
    if (goToShiftsBtn) {
      goToShiftsBtn.addEventListener('click', function() {
        triggerHapticSelection();
        setActiveTab('shifts');
        window.setTimeout(function() {
          render();
        }, 20);
      });
    }

    bindClickById('btnCancelEdit', function() {
      exitEditMode();
      showActionToast('canceled');
    });
    bindClickById('btnDeleteEdit', function() {
      if (!editingShiftId) return;
      triggerHapticWarning();
      pendingDeleteId = editingShiftId;
      openOverlay('overlayConfirm');
    });
    var editShiftOverlay = document.getElementById('overlayEditShift');
    if (editShiftOverlay) {
      editShiftOverlay.addEventListener('click', function(e) {
        if (e.target === e.currentTarget && editingShiftId) {
          triggerHapticSelection();
          exitEditMode();
          showActionToast('canceled');
        }
      });
    }

    bindClickById('btnCloseAddScreen', function() {
      closeOverlay('overlayAddScreen');
    });

    var openInstallUrlBtn = document.getElementById('btnOpenInstallUrl');
    if (openInstallUrlBtn) {
      openInstallUrlBtn.textContent = INSTALL_GUIDE_COPY.buttons.open;
      openInstallUrlBtn.addEventListener('click', function() {
        var appUrlEl = document.getElementById('appUrl');
        var url = (appUrlEl && appUrlEl.dataset && appUrlEl.dataset.fullUrl) ? appUrlEl.dataset.fullUrl : getAppUrl();
        var openedWindow = null;
        try {
          openedWindow = window.open(url, '_blank', 'noopener');
        } catch (e) {}
        if (!openedWindow) {
          window.location.href = url;
        }
      });
    }

    bindClickById('btnCopyUrl', function() {
      var appUrlEl = document.getElementById('appUrl');
      var url = (appUrlEl && appUrlEl.dataset && appUrlEl.dataset.fullUrl) ? appUrlEl.dataset.fullUrl : getAppUrl();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
          setInstallGuideCopyFeedback(true);
        }).catch(function() {
          setInstallGuideCopyFeedback(fallbackCopy(url));
        });
      } else {
        setInstallGuideCopyFeedback(fallbackCopy(url));
      }
    });

    window.addEventListener('beforeinstallprompt', function(event) {
      event.preventDefault();
      deferredInstallPromptEvent = event;
      logInstallDebug('Captured beforeinstallprompt event');
      renderInstallPromptCard();
      updateInstallGuideContent();
    });

    window.addEventListener('appinstalled', function() {
      logInstallDebug('appinstalled event received');
      installPromptInstalled = true;
      installPromptDismissed = true;
      deferredInstallPromptEvent = null;
      saveInstallPromptState();
      closeOverlay('overlayAddScreen');
      renderInstallPromptCard();
      updateInstallGuideContent();
    });

    if (window.matchMedia) {
      var standaloneMedia = window.matchMedia('(display-mode: standalone)');
      if (standaloneMedia) {
        var onStandaloneModeChange = function() {
          renderInstallPromptCard();
        };
        if (typeof standaloneMedia.addEventListener === 'function') {
          standaloneMedia.addEventListener('change', onStandaloneModeChange);
        } else if (typeof standaloneMedia.addListener === 'function') {
          standaloneMedia.addListener(onStandaloneModeChange);
        }
      }
    }

    loadInstallPromptState();
    repairUiText();
    bindSettingsControls();
    updateSettingsControls();
    renderInstallPromptCard();
    updateInstallGuideContent();
    renderDocumentationScreen();
    startUserStatsTracking();

    (function initOptionalCardAnimations() {
      var cards = document.querySelectorAll('.optional-card');
      for (var i = 0; i < cards.length; i++) {
        (function(card) {
          var summary = card.querySelector('.optional-summary');
          if (!summary) return;
          summary.addEventListener('click', function(e) {
            e.preventDefault();
            if (card.open) {
              card.classList.add('is-closing');
              setTimeout(function() {
                card.removeAttribute('open');
                card.classList.remove('is-closing');
              }, 180);
            } else {
              card.setAttribute('open', '');
            }
          });
        })(cards[i]);
      }
    }());

    var authPrimaryAction = document.getElementById('authPrimaryAction');
    if (authPrimaryAction) {
      authPrimaryAction.addEventListener('click', function() {
        if (AUTH_STATE === 'error') {
          restartAuthFlow();
          return;
        }

        if (AUTH_ENV_STATE === 'dev') {
          window.open(getTelegramBotUrl(), '_blank', 'noopener');
          return;
        }

        if (AUTH_STATE === 'guest' || AUTH_STATE === 'pending') {
          if (AUTH_WIDGET_SHELL && AUTH_WIDGET_SHELL.scrollIntoView) {
            AUTH_WIDGET_SHELL.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          renderTelegramLoginWidget();
        }
      });
    }

    bindClickById('btnAuthRetry', function() {
      restartAuthFlow();
    });

    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        return true;
      } catch(e) {
        return false;
      } finally {
        document.body.removeChild(ta);
      }
    }
