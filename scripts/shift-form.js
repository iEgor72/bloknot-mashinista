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
      return null;
    }

    function enterEditMode(shift, options) {
      if (!shift) return;
      var opts = options || {};
      var returnTab = opts.returnTab || activeTab || 'shifts';
      if (returnTab === 'add') returnTab = 'shifts';
      editReturnTab = returnTab;

      editingShiftId = shift.id;
      clearRecentAddHighlight();
      setActiveTab('add');
      setFormMode('edit');
      document.getElementById('formTitle').textContent = 'Редактировать смену';
      document.getElementById('editBadge').classList.add('visible');
      document.getElementById('btnBackFromEdit').classList.remove('hidden');
      document.getElementById('inputStartDate').value = shift.start_msk.substring(0, 10);
      document.getElementById('inputStartTime').value = shift.start_msk.substring(11, 16);
      document.getElementById('inputEndDate').value = shift.end_msk.substring(0, 10);
      document.getElementById('inputEndTime').value = shift.end_msk.substring(11, 16);
      applyOptionalShiftData(shift);
      setOptionalCardOpen('optionalRouteCard', false);
      setOptionalCardOpen('optionalTrainCard', false);
      setOptionalCardOpen('optionalLocoCard', false);
      setOptionalCardOpen('optionalFuelCard', false);
      document.getElementById('btnAdd').textContent = 'Сохранить изменения';
      document.getElementById('btnCancelEdit').classList.remove('hidden');
      document.getElementById('btnDeleteEdit').classList.remove('hidden');
      clearErrors();
      renderDraftShiftSummary();
      render();
    }

    function exitEditMode(nextTab) {
      editingShiftId = null;
      setFormMode('add');
      document.getElementById('formTitle').textContent = 'Новая смена';
      document.getElementById('editBadge').classList.remove('visible');
      document.getElementById('btnBackFromEdit').classList.add('hidden');
      document.getElementById('btnAdd').textContent = 'Сохранить смену';
      document.getElementById('btnCancelEdit').classList.add('hidden');
      document.getElementById('btnDeleteEdit').classList.add('hidden');
      clearErrors();
      document.getElementById('inputStartDate').value = '';
      document.getElementById('inputStartTime').value = '';
      document.getElementById('inputEndDate').value = '';
      document.getElementById('inputEndTime').value = '';
      clearOptionalShiftData();
      setDefaultShiftTimeInputs();
      renderDraftShiftSummary();
      var targetTab = nextTab || editReturnTab || 'shifts';
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

    document.getElementById('btnConfirmDelete').addEventListener('click', function() {
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

    document.getElementById('btnCancelDelete').addEventListener('click', function() {
      pendingDeleteId = null;
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
      document.getElementById('errStart').textContent = '';
      document.getElementById('errEnd').textContent = '';
      document.getElementById('inputStartDate').classList.remove('input-error');
      document.getElementById('inputStartTime').classList.remove('input-error');
      document.getElementById('inputEndDate').classList.remove('input-error');
      document.getElementById('inputEndTime').classList.remove('input-error');
      document.getElementById('formSuccess').textContent = '';
    }

    var inputStartDateEl = document.getElementById('inputStartDate');
    var inputStartTimeEl = document.getElementById('inputStartTime');
    var inputEndDateEl = document.getElementById('inputEndDate');
    var inputEndTimeEl = document.getElementById('inputEndTime');
    var routeTypeButtons = document.querySelectorAll('#routeTypeSegmented .segmented-btn');
    setFormMode('add');
    clearOptionalShiftData();

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

    document.getElementById('inputLocoSeries').addEventListener('change', function(e) {
      updateSelectPlaceholderState(e.currentTarget);
      renderDraftShiftSummary();
    });
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
    }, 30000);
    document.getElementById('inputRouteFrom').addEventListener('input', renderDraftShiftSummary);
    document.getElementById('inputRouteTo').addEventListener('input', renderDraftShiftSummary);
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

    document.getElementById('btnAdd').addEventListener('click', function() {
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
          setFormMode('add');
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
      if (id === 'overlayConfirm' && pendingDeleteId) {
        pendingDeleteId = null;
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
        updateSettingsControls();
        openOverlay('overlaySalarySettings');
      });
    }
    var backSalarySettingsBtn = document.getElementById('btnBackSalarySettings');
    if (backSalarySettingsBtn) {
      backSalarySettingsBtn.addEventListener('click', function() {
        closeOverlay('overlaySalarySettings');
      });
    }
    var saveSalarySettingsBtn = document.getElementById('btnSaveSalarySettings');
    if (saveSalarySettingsBtn) {
      saveSalarySettingsBtn.addEventListener('click', function() {
        syncSettingsFromInputs();
        closeOverlay('overlaySalarySettings');
        showActionToast('saved');
      });
    }

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

    var unlockTimerProBtn = document.getElementById('btnUnlockTimerPro');
    if (unlockTimerProBtn) {
      unlockTimerProBtn.addEventListener('click', function() {
        triggerHapticActionMedium();
        unlockStopwatchProForSession();
        showSaveToast('PRO открыт');
      });
    }

    // ── Documentation sub-tab switching + file actions ─────────────────────
    var docsShellEl = document.getElementById('docsShell');
    if (docsShellEl) {
      docsShellEl.addEventListener('click', function(e) {
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
        if (!isSameTab) {
          triggerHapticSelection();
        }
        setActiveTab(tab);
      });
    }

    var goToShiftsBtn = document.getElementById('btnGoToShifts');
    if (goToShiftsBtn) {
      goToShiftsBtn.addEventListener('click', function() {
        if (document.body && document.body.dataset) {
          document.body.dataset.shiftsMotion = 'up';
        }
        if (activeTab !== 'shifts') {
          triggerHapticSelection();
        }
        setActiveTab('shifts');
      });
    }

    var backFromShiftsBtn = document.getElementById('btnBackFromShifts');
    if (backFromShiftsBtn) {
      backFromShiftsBtn.addEventListener('click', function() {
        triggerHapticSelection();
        setActiveTab('home');
      });
    }

    document.getElementById('btnCancelEdit').addEventListener('click', function() {
      exitEditMode();
      showActionToast('canceled');
    });
    document.getElementById('btnDeleteEdit').addEventListener('click', function() {
      if (!editingShiftId) return;
      triggerHapticWarning();
      pendingDeleteId = editingShiftId;
      openOverlay('overlayConfirm');
    });
    document.getElementById('btnBackFromEdit').addEventListener('click', function() {
      triggerHapticSelection();
      exitEditMode();
      showActionToast('canceled');
    });

    document.getElementById('btnCloseAddScreen').addEventListener('click', function() {
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

    document.getElementById('btnCopyUrl').addEventListener('click', function() {
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

    document.getElementById('btnAuthRetry').addEventListener('click', function() {
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
