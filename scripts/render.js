    function buildShiftItemHtml(sh, compact, pendingMap, shiftIncomeMap, durationBounds, durationLevelMap) {
      var p = getShiftDisplayParts(sh);
      var itemClass = 'shift-item' + (compact ? ' compact-shift' : '');
      var typeLabel = getShiftTypeLabel(sh);
      var shiftIsPending = pendingMap ? !!pendingMap[String(sh.id)] : isShiftPending(sh);
      var directionText = getShiftDirectionLineText(sh);
      var dateTimeText = getShiftDateTimeLineLabel(p);
      var rangeState = getShiftRangeState(sh);
      var durationMinutes = getShiftMinutesForDisplay(sh, durationBounds);
      var durationText = getShiftDurationLabelText(rangeState.hasValidInterval ? fmtMin(durationMinutes) : '—');
      var typeHtml = buildShiftTypeHtml(sh, typeLabel, shiftIsPending);
      var directionHtml = buildShiftDirectionHtml(directionText);
      var dateTimeHtml = buildShiftDateTimeHtml(dateTimeText);
      var durationHtml = buildShiftDurationHtml(durationText);
      var technicalHtml = buildShiftTechnicalHtml(sh);
      var fuelNoteHtml = buildShiftFuelConsumptionHtml(sh);
      var incomeLabelHtml = buildShiftIncomeLabelHtml();
      var shiftTitle = getShiftTitle(sh);
      if (sh.route_kind === 'trip') itemClass += ' has-trip';
      if (sh.id === editingShiftId) itemClass += ' is-edit-target';
      if (sh.id === pendingDeleteId) itemClass += ' is-delete-target';
      if (sh.id === recentAddedShiftId) itemClass += ' is-adding-target';
      if (shiftIsPending) itemClass += ' is-pending';
      var durationLevelData = durationLevelMap ? durationLevelMap[String(sh.id)] : null;
      var durationLevel = durationLevelData && typeof durationLevelData.level === 'string'
        ? durationLevelData.level
        : 'medium';
      if (durationLevel === 'high') itemClass += ' duration-high';
      else if (durationLevel === 'low') itemClass += ' duration-low';
      var incomeVm = getShiftIncomeViewModel(sh, shiftIncomeMap);
      var incomeHtml = getShiftIncomeChipHtml(incomeVm);
      itemClass += ' income-' + incomeVm.level;
      var shiftIdStr = String(sh.id);
      var shiftIdAttr = escapeHtml(shiftIdStr);
      var isActionsOpen = activeShiftMenuId !== null && String(activeShiftMenuId) === shiftIdStr;

      var html = '<div class="' + itemClass + '" data-shift-id="' + shiftIdAttr + '" data-pending="' + (shiftIsPending ? '1' : '0') + '" data-shift-open="1" role="button" tabindex="0" aria-label="Редактировать смену: ' + escapeHtml(shiftTitle || 'Смена') + '">' +
        '<div class="shift-card-top">' +
          typeHtml +
          '<div class="shift-top-right">' +
            '<div class="shift-actions-wrap">' +
              '<button class="shift-actions-trigger' + (isActionsOpen ? ' is-open' : '') + '" type="button" data-id="' + shiftIdAttr + '" aria-label="Действия" aria-haspopup="menu" aria-expanded="' + (isActionsOpen ? 'true' : 'false') + '">' +
                '<svg class="shift-actions-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
                  '<circle cx="6.5" cy="12" r="1.7"></circle>' +
                  '<circle cx="12" cy="12" r="1.7"></circle>' +
                  '<circle cx="17.5" cy="12" r="1.7"></circle>' +
                '</svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        directionHtml +
        '<div class="shift-card-body">' +
          '<div class="shift-main-row">' +
            dateTimeHtml +
            durationHtml +
          '</div>' +
          technicalHtml +
          fuelNoteHtml +
          '<div class="shift-income-row">' +
            incomeLabelHtml +
            incomeHtml +
          '</div>' +
        '</div>';

      html += '</div>';
      return html;
    }

    function prefersReducedMotion() {
      try {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (e) {
        return false;
      }
    }

    function getShiftListRevealKey(listEl) {
      if (!listEl) return '';
      if (listEl.id) return listEl.id;
      if (!listEl.dataset.revealKey) {
        shiftListRevealAutoId += 1;
        listEl.dataset.revealKey = 'shift-list-' + shiftListRevealAutoId;
      }
      return listEl.dataset.revealKey;
    }

    function clearShiftListRevealClasses(listEl, state) {
      if (!listEl) return;
      listEl.classList.remove('shift-list-reveal', 'is-visible');
      var cards = listEl.querySelectorAll('.shift-item');
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.removeProperty('--shift-card-enter-delay');
      }
      if (!state) return;
      if (state.raf) {
        window.cancelAnimationFrame(state.raf);
        state.raf = null;
      }
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = null;
      }
    }

    function isShiftListRevealReady(listEl) {
      if (!listEl || !listEl.isConnected) return false;
      var tabPanel = listEl.closest ? listEl.closest('.tab-panel') : null;
      if (tabPanel && !tabPanel.classList.contains('active')) return false;
      if (listEl.closest && listEl.closest('.hidden')) return false;
      if (listEl.getClientRects && listEl.getClientRects().length === 0) return false;
      return true;
    }

    function revealShiftListOnFirstMount(listEl) {
      if (!listEl) return;
      var key = getShiftListRevealKey(listEl);
      if (!key) return;

      var state = shiftListRevealRegistry[key];
      if (!state) {
        state = { revealed: false, raf: null, timer: null };
        shiftListRevealRegistry[key] = state;
      }
      if (state.revealed) return;

      if (suppressInitialListReveal) {
        state.revealed = true;
        clearShiftListRevealClasses(listEl, state);
        return;
      }

      var cards = listEl.querySelectorAll('.shift-item');
      if (!cards.length) return;
      if (!isShiftListRevealReady(listEl)) return;

      state.revealed = true;
      if (prefersReducedMotion()) return;

      clearShiftListRevealClasses(listEl, state);
      listEl.classList.add('shift-list-reveal');

      var maxDelay = 0;
      for (var i = 0; i < cards.length; i++) {
        var delay = i * SHIFT_LIST_REVEAL_DELAY_STEP_MS;
        cards[i].style.setProperty('--shift-card-enter-delay', delay + 'ms');
        if (delay > maxDelay) maxDelay = delay;
      }

      state.raf = window.requestAnimationFrame(function() {
        state.raf = null;
        listEl.classList.add('is-visible');
        state.timer = window.setTimeout(function() {
          clearShiftListRevealClasses(listEl, state);
        }, SHIFT_LIST_REVEAL_DURATION_MS + maxDelay + 40);
      });
    }

    function getShiftCardRadiusPx(cardEl) {
      if (!cardEl || !window.getComputedStyle) return 22;
      try {
        var style = window.getComputedStyle(cardEl);
        var radius = parseFloat(style.borderTopLeftRadius || style.borderRadius || '22');
        return isFinite(radius) ? Math.max(0, radius) : 22;
      } catch (e) {
        return 22;
      }
    }

    function getShiftSharedTransitionDuration() {
      return prefersReducedMotion() ? 0 : SHIFT_SHARED_TRANSITION_MS;
    }

    function findShiftDetailCardById(shiftId, preferredListId) {
      var id = String(shiftId || '');
      if (!id) return null;
      var preferredList = preferredListId ? document.getElementById(preferredListId) : null;
      if (preferredList) {
        var preferredCard = preferredList.querySelector('.shift-item[data-shift-open="1"][data-shift-id="' + id + '"]');
        if (preferredCard) return preferredCard;
      }
      var homeList = document.getElementById('homeShiftsList');
      if (homeList && (!preferredList || preferredList !== homeList)) {
        var homeCard = homeList.querySelector('.shift-item[data-shift-open="1"][data-shift-id="' + id + '"]');
        if (homeCard) return homeCard;
      }
      var shiftsList = document.getElementById('shiftsList');
      if (shiftsList && (!preferredList || preferredList !== shiftsList)) {
        var shiftsCard = shiftsList.querySelector('.shift-item[data-shift-open="1"][data-shift-id="' + id + '"]');
        if (shiftsCard) return shiftsCard;
      }
      return null;
    }

    function clearShiftDetailSourceCardHidden() {
      if (shiftDetailState.sourceCardEl && shiftDetailState.sourceCardEl.classList) {
        shiftDetailState.sourceCardEl.classList.remove('is-shared-source-hidden');
      }
      if (shiftDetailState.sourceShiftId) {
        var maybeCard = findShiftDetailCardById(shiftDetailState.sourceShiftId, shiftDetailState.sourceListId);
        if (maybeCard) {
          maybeCard.classList.remove('is-shared-source-hidden');
          shiftDetailState.sourceCardEl = maybeCard;
        }
      }
    }

    function setShiftDetailSourceCardHidden(shouldHide) {
      clearShiftDetailSourceCardHidden();
      if (!shouldHide || !shiftDetailState.sourceShiftId) return null;
      var cardEl = findShiftDetailCardById(shiftDetailState.sourceShiftId, shiftDetailState.sourceListId) || shiftDetailState.sourceCardEl;
      if (cardEl && cardEl.classList) {
        cardEl.classList.add('is-shared-source-hidden');
        shiftDetailState.sourceCardEl = cardEl;
      }
      return cardEl || null;
    }

    function setShiftDetailContentVisible(visible) {
      if (!SHIFT_DETAIL_CONTENT) return;
      if (!visible) {
        SHIFT_DETAIL_CONTENT.classList.remove('is-visible');
        SHIFT_DETAIL_CONTENT.classList.add('hidden');
        return;
      }
      SHIFT_DETAIL_CONTENT.classList.remove('hidden');
      window.requestAnimationFrame(function() {
        SHIFT_DETAIL_CONTENT.classList.add('is-visible');
      });
    }

    function setShiftDetailHeroVisible(visible) {
      if (!SHIFT_DETAIL_HERO_SLOT) return;
      SHIFT_DETAIL_HERO_SLOT.style.transition = 'opacity 180ms ease-out';
      SHIFT_DETAIL_HERO_SLOT.style.opacity = visible ? '1' : '0';
    }

    function runShiftSharedAnimation(sourceCardEl, fromRect, toRect, fromRadius, toRadius, callback) {
      var doneCalled = false;
      function done() {
        if (doneCalled) return;
        doneCalled = true;
        if (typeof callback === 'function') callback();
      }

      var duration = getShiftSharedTransitionDuration();
      if (!sourceCardEl || !fromRect || !toRect || duration <= 0) {
        done();
        return;
      }

      var cloneEl = sourceCardEl.cloneNode(true);
      cloneEl.classList.remove('is-shared-source-hidden');
      cloneEl.classList.add('shift-shared-clone');
      cloneEl.style.left = toRect.left + 'px';
      cloneEl.style.top = toRect.top + 'px';
      cloneEl.style.width = Math.max(1, toRect.width) + 'px';
      cloneEl.style.height = Math.max(1, toRect.height) + 'px';
      cloneEl.style.borderRadius = Math.max(0, toRadius || 0) + 'px';
      cloneEl.style.transform = 'translate(0px, 0px) scale(1, 1)';
      cloneEl.style.opacity = '1';
      document.body.appendChild(cloneEl);

      var dx = fromRect.left - toRect.left;
      var dy = fromRect.top - toRect.top;
      var sx = fromRect.width / Math.max(1, toRect.width);
      var sy = fromRect.height / Math.max(1, toRect.height);
      if (!isFinite(sx) || sx <= 0) sx = 1;
      if (!isFinite(sy) || sy <= 0) sy = 1;
      var startTransform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')';

      function cleanupClone() {
        if (cloneEl && cloneEl.parentNode) {
          cloneEl.parentNode.removeChild(cloneEl);
        }
        done();
      }

      if (typeof cloneEl.animate === 'function') {
        try {
          var animation = cloneEl.animate([
            {
              transform: startTransform,
              borderRadius: Math.max(0, fromRadius || 0) + 'px',
              opacity: 1
            },
            {
              transform: 'translate(0px, 0px) scale(1, 1)',
              borderRadius: Math.max(0, toRadius || 0) + 'px',
              opacity: 1
            }
          ], {
            duration: duration,
            easing: SHIFT_SHARED_TRANSITION_EASING,
            fill: 'forwards'
          });
          animation.onfinish = cleanupClone;
          animation.oncancel = cleanupClone;
          return;
        } catch (e) {}
      }

      cloneEl.style.transform = startTransform;
      cloneEl.style.borderRadius = Math.max(0, fromRadius || 0) + 'px';
      cloneEl.style.transition =
        'transform ' + duration + 'ms ' + SHIFT_SHARED_TRANSITION_EASING + ', ' +
        'border-radius ' + duration + 'ms ' + SHIFT_SHARED_TRANSITION_EASING;
      window.requestAnimationFrame(function() {
        cloneEl.style.transform = 'translate(0px, 0px) scale(1, 1)';
        cloneEl.style.borderRadius = Math.max(0, toRadius || 0) + 'px';
      });
      window.setTimeout(cleanupClone, duration + 32);
    }

    function bindTelegramBackButtonIfNeeded() {
      if (telegramBackButtonBound) return;
      var webApp = getTelegramWebApp();
      if (!webApp || !webApp.BackButton || typeof webApp.BackButton.onClick !== 'function') return;
      try {
        webApp.BackButton.onClick(function() {
          if (shiftDetailState.isOpen || shiftDetailState.isAnimating) {
            closeShiftDetail({ fromPopstate: true, skipHistoryBack: true });
          }
        });
        telegramBackButtonBound = true;
      } catch (e) {}
    }

    function syncTelegramBackButton() {
      var webApp = getTelegramWebApp();
      if (!webApp || !webApp.BackButton) return;
      bindTelegramBackButtonIfNeeded();
      try {
        if (shiftDetailState.isOpen || shiftDetailState.isAnimating) {
          webApp.BackButton.show();
        } else {
          webApp.BackButton.hide();
        }
      } catch (e) {}
    }

    function pushShiftDetailHistoryState(shiftId) {
      shiftDetailState.shouldPopOnClose = false;
      try {
        window.history.pushState({ bmView: 'shift-detail', shiftId: String(shiftId || '') }, '');
        shiftDetailState.shouldPopOnClose = true;
      } catch (e) {
        shiftDetailState.shouldPopOnClose = false;
      }
    }

    function finalizeShiftDetailOpen(token) {
      if (token !== shiftDetailState.transitionToken) return;
      shiftDetailState.isAnimating = false;
      shiftDetailState.isOpen = true;
      if (SHIFT_DETAIL_OVERLAY) {
        SHIFT_DETAIL_OVERLAY.classList.add('is-open', 'is-visible');
        SHIFT_DETAIL_OVERLAY.classList.remove('hidden');
        SHIFT_DETAIL_OVERLAY.setAttribute('aria-hidden', 'false');
      }
      setShiftDetailSourceCardHidden(true);
      setShiftDetailHeroVisible(true);
      setShiftDetailContentVisible(true);
      syncTelegramBackButton();
    }

    function openShiftDetailFromCard(cardEl, listId, options) {
      if (!SHIFT_DETAIL_OVERLAY || !SHIFT_DETAIL_SURFACE) return;
      if (!cardEl || !cardEl.getAttribute) return;
      if (shiftDetailState.isAnimating) return;
      var shiftId = String(cardEl.getAttribute('data-shift-id') || '');
      if (!shiftId || !findShiftById(shiftId)) return;

      var nowTs = Date.now();
      if (shiftDetailState.tapLockUntil > nowTs) return;
      shiftDetailState.tapLockUntil = nowTs + 360;

      var sourceRect = cardEl.getBoundingClientRect ? cardEl.getBoundingClientRect() : null;
      closeShiftActionsMenu(true);
      closeLocoSeriesMenu();
      triggerHapticTapSoft();

      if (shiftDetailState.isOpen && shiftDetailState.shiftId === shiftId) {
        return;
      }

      shiftDetailState.transitionToken += 1;
      var token = shiftDetailState.transitionToken;
      shiftDetailState.isAnimating = true;
      shiftDetailState.isOpen = false;
      shiftDetailState.shiftId = shiftId;
      shiftDetailState.sourceShiftId = shiftId;
      shiftDetailState.sourceListId = listId || '';
      shiftDetailState.sourceTab = activeTab || '';
      shiftDetailState.sourceCardEl = cardEl;
      shiftDetailState.sourceScrollTop = APP_CONTENT ? APP_CONTENT.scrollTop : 0;

      renderShiftDetailById(shiftId);
      setShiftDetailHeroVisible(false);
      setShiftDetailContentVisible(false);

      if (SHIFT_DETAIL_OVERLAY) {
        SHIFT_DETAIL_OVERLAY.classList.remove('hidden');
        SHIFT_DETAIL_OVERLAY.setAttribute('aria-hidden', 'false');
      }
      var detailScrollEl = document.getElementById('shiftDetailScroll');
      if (detailScrollEl) detailScrollEl.scrollTop = 0;
      var targetRect = SHIFT_DETAIL_SURFACE.getBoundingClientRect ? SHIFT_DETAIL_SURFACE.getBoundingClientRect() : null;
      var sourceRadius = getShiftCardRadiusPx(cardEl);
      setShiftDetailSourceCardHidden(true);

      window.requestAnimationFrame(function() {
        if (token !== shiftDetailState.transitionToken) return;
        if (SHIFT_DETAIL_OVERLAY) SHIFT_DETAIL_OVERLAY.classList.add('is-open', 'is-visible');
        runShiftSharedAnimation(cardEl, sourceRect, targetRect, sourceRadius, 0, function() {
          finalizeShiftDetailOpen(token);
        });
      });

      if (!(options && options.skipHistoryPush)) {
        pushShiftDetailHistoryState(shiftId);
      }
    }

    function resetShiftDetailState() {
      shiftDetailState.isOpen = false;
      shiftDetailState.isAnimating = false;
      shiftDetailState.shiftId = '';
      shiftDetailState.sourceShiftId = '';
      shiftDetailState.sourceListId = '';
      shiftDetailState.sourceTab = '';
      shiftDetailState.sourceCardEl = null;
      shiftDetailState.sourceScrollTop = 0;
      shiftDetailState.shouldPopOnClose = false;
      shiftDetailState.skipNextPopstateClose = false;
    }

    function closeShiftDetail(options) {
      if (!SHIFT_DETAIL_OVERLAY || !SHIFT_DETAIL_SURFACE) return;
      if (!shiftDetailState.isOpen && !shiftDetailState.isAnimating) return;
      if (shiftDetailState.isAnimating && !(options && options.force)) return;

      var opts = options || {};
      shiftDetailState.transitionToken += 1;
      var token = shiftDetailState.transitionToken;
      shiftDetailState.isAnimating = true;

      if (!opts.fromPopstate && !opts.skipHistoryBack && shiftDetailState.shouldPopOnClose) {
        shiftDetailState.shouldPopOnClose = false;
        shiftDetailState.skipNextPopstateClose = true;
        try { window.history.back(); } catch (e) {}
      } else {
        shiftDetailState.shouldPopOnClose = false;
      }

      setShiftDetailContentVisible(false);
      setShiftDetailHeroVisible(false);
      var destinationCard = setShiftDetailSourceCardHidden(true);
      var fallbackCard = destinationCard || shiftDetailState.sourceCardEl;
      var fromRect = SHIFT_DETAIL_SURFACE.getBoundingClientRect ? SHIFT_DETAIL_SURFACE.getBoundingClientRect() : null;
      var toRect = destinationCard && destinationCard.getBoundingClientRect ? destinationCard.getBoundingClientRect() : null;
      var toRadius = getShiftCardRadiusPx(destinationCard || shiftDetailState.sourceCardEl);

      if (SHIFT_DETAIL_OVERLAY) SHIFT_DETAIL_OVERLAY.classList.remove('is-open', 'is-visible');

      function finishClose() {
        if (token !== shiftDetailState.transitionToken) return;
        clearShiftDetailSourceCardHidden();
        if (SHIFT_DETAIL_OVERLAY) {
          SHIFT_DETAIL_OVERLAY.classList.add('hidden');
          SHIFT_DETAIL_OVERLAY.setAttribute('aria-hidden', 'true');
        }
        if (SHIFT_DETAIL_HERO_SLOT) SHIFT_DETAIL_HERO_SLOT.innerHTML = '';
        if (SHIFT_DETAIL_CONTENT) {
          SHIFT_DETAIL_CONTENT.classList.remove('is-visible');
          SHIFT_DETAIL_CONTENT.classList.add('hidden');
          SHIFT_DETAIL_CONTENT.innerHTML = '';
        }
        if (SHIFT_DETAIL_TITLE) SHIFT_DETAIL_TITLE.textContent = 'Подробности смены';
        resetShiftDetailState();
        syncTelegramBackButton();
      }

      if (opts.immediate || !fallbackCard || !fromRect || !toRect || getShiftSharedTransitionDuration() <= 0) {
        window.setTimeout(finishClose, opts.immediate ? 0 : getShiftSharedTransitionDuration() + 20);
        return;
      }

      runShiftSharedAnimation(fallbackCard, fromRect, toRect, 0, toRadius, finishClose);
    }

    function openShiftEditorFromCard(cardEl) {
      if (!cardEl) return;
      var shiftId = cardEl.getAttribute('data-shift-id');
      if (!shiftId) return;
      var shift = findShiftById(shiftId);
      if (!shift) return;
      triggerHapticTapLight();
      enterEditMode(shift, { returnTab: activeTab });
    }

    function bindShiftListDetailHandlers(listEl) {
      if (!listEl || listEl.dataset.shiftDetailBound === '1') return;
      listEl.dataset.shiftDetailBound = '1';

      listEl.addEventListener('click', function(e) {
        if (shiftDetailState.isAnimating) return;
        var trigger = e.target && e.target.closest ? e.target.closest('.shift-actions-trigger') : null;
        if (trigger && listEl.contains(trigger)) {
          handleShiftActionsTriggerClick(e, trigger, listEl);
          return;
        }
        var card = e.target && e.target.closest ? e.target.closest('.shift-item[data-shift-open="1"][data-shift-id]') : null;
        if (!card || !listEl.contains(card)) return;
        if (e.target.closest('.shift-actions-trigger') || e.target.closest('.shift-actions-wrap')) return;
        openShiftEditorFromCard(card);
      });

      listEl.addEventListener('keydown', function(e) {
        if (shiftDetailState.isAnimating) return;
        if (!(e.key === 'Enter' || e.key === ' ')) return;
        var card = e.target && e.target.closest ? e.target.closest('.shift-item[data-shift-open="1"][data-shift-id]') : null;
        if (!card || !listEl.contains(card)) return;
        if (e.target.closest('.shift-actions-trigger') || e.target.closest('.shift-actions-wrap')) return;
        e.preventDefault();
        openShiftEditorFromCard(card);
      });
    }

    function renderShiftList(listEl, headerEl, shifts, compact, emptyText, headerBase, pendingMap, shiftIncomeMap, durationBounds, durationLevelMap) {
      if (!listEl) return;
      if (headerEl) headerEl.textContent = headerBase || 'Журнал смен';
      bindShiftListDetailHandlers(listEl);

      if (!compact) {
        var overviewCountEl = document.getElementById('shiftsOverviewCount');
        var overviewTotalEl = document.getElementById('shiftsOverviewTotal');
        if (overviewCountEl) overviewCountEl.textContent = String(shifts.length);
        if (overviewTotalEl) {
          var overviewMinutes = 0;
          for (var om = 0; om < shifts.length; om++) overviewMinutes += getShiftMinutesForDisplay(shifts[om], durationBounds);
          overviewTotalEl.textContent = fmtMin(overviewMinutes);
        }
      }

      if (!shifts.length) {
        listEl.innerHTML = '<div class="shifts-empty">' + emptyText + '</div>';
        return;
      }

      if (headerEl && headerBase !== false) {
        headerEl.textContent = (headerBase || 'Журнал смен') + (compact ? '' : ' · ' + shifts.length);
      }

      var html = '';
      for (var i = 0; i < shifts.length; i++) {
        html += buildShiftItemHtml(shifts[i], compact, pendingMap, shiftIncomeMap, durationBounds, durationLevelMap);
        if (i < shifts.length - 1) {
          html += buildRestGapHtml(getRestGapInfo(shifts[i], shifts[i + 1]), compact);
        }
      }
      listEl.innerHTML = html;

      revealShiftListOnFirstMount(listEl);
      if (shiftDetailState.isOpen && shiftDetailState.sourceListId === listEl.id) {
        setShiftDetailSourceCardHidden(true);
      }
    }

    function renderDeleteConfirmCard(shiftIncomeMap) {
      var cardEl = document.getElementById('confirmShiftCard');
      if (!cardEl) return;
      if (!pendingDeleteId) {
        cardEl.innerHTML = '';
        return;
      }
      cardEl.innerHTML = buildConfirmShiftCardHtml(findShiftById(pendingDeleteId), shiftIncomeMap);
    }

    function render() {
      updateOfflineUiState();
      renderUserStatsFooter();
      var _renderPendingMap = getPendingShiftIdMap();

      // Month title
      renderMonthHeader('monthTitle', 'monthQuarter', 'homeMonthTabs', currentYear, currentMonth, function(targetMonth) {
        if (targetMonth === currentMonth) return;
        triggerHapticSelection();
        currentMonth = targetMonth;
        render();
      });
      renderMonthHeader('shiftsMonthTitle', 'shiftsMonthQuarter', 'shiftsMonthTabs', currentYear, currentMonth, function(targetMonth) {
        if (targetMonth === currentMonth) return;
        triggerHapticSelection();
        currentMonth = targetMonth;
        render();
      });

      var bounds = getMonthBounds(currentYear, currentMonth);

      // Filter shifts that have at least 1 minute in this month
      var monthShifts = [];
      for (var i = 0; i < allShifts.length; i++) {
        if (shiftMinutesInRange(allShifts[i], bounds.start, bounds.end) > 0) {
          monthShifts.push(allShifts[i]);
        }
      }

      // Sort newest first
      monthShifts.sort(compareShiftsByStartDesc);

      // Calculate total worked minutes in this month
      var totalMin = 0;
      var nightMin = 0;
      var holidayMin = 0;
      var shiftIncomeMap = buildMonthShiftIncomeMap(monthShifts, bounds);
      var shiftDurationLevelMap = buildMonthShiftDurationLevelMap(monthShifts, bounds);
      currentMonthShiftIncomeMap = shiftIncomeMap || Object.create(null);
      for (var j = 0; j < monthShifts.length; j++) {
        totalMin += shiftMinutesInRange(monthShifts[j], bounds.start, bounds.end);
        nightMin += shiftNightMinutesInRange(monthShifts[j], bounds.start, bounds.end);
        holidayMin += shiftHolidayMinutesInRange(monthShifts[j], bounds.start, bounds.end);
      }
      var monthSalarySummary = calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin);
      renderDeleteConfirmCard(shiftIncomeMap);

      // Norm
      var monthKey = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
      var normFromTableHours = WORK_NORMS[monthKey];
      var baseNormMin = normFromTableHours !== undefined ? (normFromTableHours * 60) : 0;
      var normSnapshot = getMonthNormSnapshot(currentYear, currentMonth, baseNormMin);
      var normMin = normSnapshot.monthNormMin;

      // Update stats
      var statWorkedEl = document.getElementById('statWorked');
      if (statWorkedEl) statWorkedEl.textContent = fmtMin(totalMin);
      var monthIncomeLabelEl = document.getElementById('dashboardMonthIncomeLabel');
      var monthIncomeValueEl = document.getElementById('dashboardMonthIncomeValue');
      if (monthIncomeLabelEl) monthIncomeLabelEl.textContent = formatMonthIncomeLabel(currentMonth);
      if (monthIncomeValueEl) {
        monthIncomeValueEl.textContent = monthShifts.length > 0
          ? formatRub(monthSalarySummary.netAmount)
          : 'Смен пока нет';
      }
      setQuickMetricText('statNight', fmtMin(nightMin));
      setQuickMetricText('statHoliday', fmtMin(holidayMin));
      setQuickMetricText('statShifts', String(monthShifts.length));

      var normEl = document.getElementById('statNormMonth') || document.getElementById('statNorm');
      var normTodayEl = document.getElementById('statNormToday');
      var diffEl = document.getElementById('statDiff');
      var progressFillEl = document.getElementById('dashboardProgressFill');
      var progressTodayMarkerEl = document.getElementById('dashboardProgressTodayMarker');
      var progressMonthMarkerEl = document.getElementById('dashboardProgressMonthMarker');
      var dashboardCardEl = document.querySelector('.dashboard-card');

      if (dashboardCardEl) {
        dashboardCardEl.classList.remove('state-ok', 'state-overtime', 'state-remaining');
      }

      if (normMin > 0) {
        if (normEl) {
          normEl.textContent = fmtMin(normMin);
        }
        var diffBasisMin = normSnapshot.relation === 0
          ? normSnapshot.todayNormMin
          : normMin;
        var diffMin = totalMin - diffBasisMin;
        var diffAbs = Math.abs(diffMin);
        var progressAxisMin = Math.max(normMin, normSnapshot.todayNormMin, totalMin, 1);
        var workedPct = Math.max(0, Math.min(100, Math.round((totalMin / progressAxisMin) * 100)));

        if (normTodayEl) {
          normTodayEl.textContent = normSnapshot.relation > 0 ? '—' : fmtMin(normSnapshot.todayNormMin);
        }

        diffEl.className = 'dashboard-sub';
        if (progressFillEl) progressFillEl.style.width = workedPct + '%';
        setProgressMarkerPosition(progressTodayMarkerEl, normSnapshot.todayNormMin, progressAxisMin);
        setProgressMarkerPosition(progressMonthMarkerEl, normMin, progressAxisMin);

        if (diffMin === 0) {
          if (normSnapshot.relation > 0 && totalMin === 0) {
            diffEl.textContent = 'Месяц ещё не начался';
            diffEl.classList.add('remaining');
            if (dashboardCardEl) dashboardCardEl.classList.add('state-remaining');
          } else {
            diffEl.textContent = 'Норма выполнена';
            diffEl.classList.add('ok');
            if (dashboardCardEl) dashboardCardEl.classList.add('state-ok');
          }
        } else if (diffMin > 0) {
          diffEl.textContent = 'Переработка ' + fmtMin(diffAbs);
          diffEl.classList.add('overtime');
          if (dashboardCardEl) dashboardCardEl.classList.add('state-overtime');
        } else {
          diffEl.textContent = 'Недоработка ' + fmtMin(diffAbs);
          diffEl.classList.add('remaining');
          if (dashboardCardEl) dashboardCardEl.classList.add('state-remaining');
        }
      } else {
        if (normEl) normEl.textContent = '—';
        if (normTodayEl) normTodayEl.textContent = '—';
        if (progressFillEl) progressFillEl.style.width = '0%';
        setProgressMarkerPosition(progressTodayMarkerEl, 0, 0);
        setProgressMarkerPosition(progressMonthMarkerEl, 0, 0);
        diffEl.className = 'dashboard-sub';
        diffEl.textContent = 'Норма пока не задана';
      }

      renderShiftList(
        document.getElementById('homeShiftsList'),
        null,
        monthShifts.slice(0, 3),
        true,
        'Пока пусто. Добавь первую смену, и здесь появятся последние записи.',
        false,
        _renderPendingMap,
        shiftIncomeMap,
        bounds,
        shiftDurationLevelMap
      );

      renderShiftList(
        document.getElementById('shiftsList'),
        document.getElementById('shiftsHeader'),
        monthShifts,
        false,
        'Пока пусто. Добавь первую смену, и журнал заполнится автоматически.',
        'Журнал смен',
        _renderPendingMap,
        shiftIncomeMap,
        bounds,
        shiftDurationLevelMap
      );

      renderSalaryPanel();
      renderInstallPromptCard();
      renderInstructionsScreen();

      if (shiftDetailState.isOpen || shiftDetailState.isAnimating) {
        if (shiftDetailState.shiftId && findShiftById(shiftDetailState.shiftId)) {
          renderShiftDetailById(shiftDetailState.shiftId);
          if (shiftDetailState.isOpen) {
            setShiftDetailSourceCardHidden(true);
          }
        } else {
          closeShiftDetail({ fromPopstate: true, skipHistoryBack: true, immediate: true, force: true });
        }
      }

      syncShiftActionsMenuLifecycle();
      syncTelegramBackButton();
    }
    function clearRecentAddHighlight() {
      recentAddedShiftId = null;
      if (recentAddTimer) {
        clearTimeout(recentAddTimer);
        recentAddTimer = null;
      }
    }

    function setFormMode(mode) {
      var section = document.getElementById('shiftFormSection');
      if (!section) return;
      section.classList.remove('is-adding', 'is-editing', 'add-pulse');
      if (mode === 'edit') {
        section.classList.add('is-editing');
      } else {
        section.classList.add('is-adding');
      }
    }

    function escapeHtml(text) {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function escapeSelectorValue(value) {
      var text = String(value || '');
      if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(text);
      }
      return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function cleanDigits(value, maxLen) {
      return String(value || '').replace(/\D+/g, '').slice(0, maxLen);
    }

    var DEFAULT_FUEL_COEFF = '0.868';
    var LEGACY_DEFAULT_FUEL_COEFF = '0.800';
    var FUEL_SECTIONS = ['a', 'b', 'v'];

    function isDefaultFuelCoeffValue(coeff) {
      return coeff === DEFAULT_FUEL_COEFF || coeff === LEGACY_DEFAULT_FUEL_COEFF;
    }

    function cleanFuelCoeffInput(value) {
      var normalized = String(value || '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
      if (!normalized) return '';
      var dotIndex = normalized.indexOf('.');
      if (dotIndex >= 0) {
        normalized = normalized.slice(0, dotIndex + 1) + normalized.slice(dotIndex + 1).replace(/\./g, '');
      }
      var parts = normalized.split('.');
      var integerPart = parts[0] || '';
      var fractionPart = parts.length > 1 ? (parts[1] || '') : '';
      if (parts.length > 1) {
        return ((integerPart || '0').slice(0, 1)) + '.' + fractionPart.slice(0, 3);
      }
      return integerPart.slice(0, 2);
    }

    function normalizeFuelCoeff(value, fallback) {
      var fallbackValue = fallback === undefined ? '' : String(fallback);
      var cleaned = cleanFuelCoeffInput(value);
      if (!cleaned) return fallbackValue;
      var parsed = NaN;
      if (/^\d{1,2}$/.test(cleaned)) {
        var suffix = cleaned.slice(0, 2).padEnd(2, '0');
        parsed = Number('0.8' + suffix);
      } else {
        parsed = Number(cleaned);
      }
      if (!isFinite(parsed)) return fallbackValue;
      var clamped = Math.max(0.8, Math.min(0.899, parsed));
      return clamped.toFixed(3);
    }

    function parseFuelCoeff(value, fallback) {
      var normalized = normalizeFuelCoeff(value, fallback === undefined ? '' : fallback);
      if (!normalized) return null;
      var parsed = Number(normalized);
      return isFinite(parsed) ? parsed : null;
    }

    function parseFuelLitersValue(value) {
      var litersDigits = cleanDigits(value, 4);
      if (!litersDigits) return 0;
      var parsed = Number(litersDigits);
      return isFinite(parsed) ? parsed : 0;
    }

    function formatFuelKgValue(value) {
      if (!isFinite(value)) return '';
      var rounded = Math.round(value * 100) / 100;
      if (rounded < 0) return '';
      var text = rounded.toFixed(2).replace(/\.?0+$/, '');
      return text.replace('.', ',');
    }

    function formatFuelKgSignedValue(value) {
      if (!isFinite(value)) return '0';
      var absText = formatFuelKgValue(Math.abs(value)) || '0';
      return value < 0 ? ('-' + absText) : absText;
    }

    function formatFuelLitersSignedValue(value) {
      if (!isFinite(value)) return '0';
      return String(Math.round(value));
    }

    function getFuelConsumptionInlineText(totals) {
      totals = totals || {};
      return formatFuelLitersSignedValue(totals.consumptionLiters) + 'л | ' + formatFuelKgSignedValue(totals.consumptionKg) + 'кг';
    }

    function getFuelKgText(litersRaw, coeffRaw, fallbackCoeff) {
      var liters = parseFuelLitersValue(litersRaw);
      if (!liters) return '';
      var coeff = parseFuelCoeff(coeffRaw, fallbackCoeff === undefined ? DEFAULT_FUEL_COEFF : fallbackCoeff);
      if (coeff === null) return '';
      return formatFuelKgValue(liters * coeff);
    }

    function getFuelConsumptionTotals(raw) {
      raw = raw || {};
      var receiveCoeffA = parseFuelCoeff(raw.receiveCoeffA, raw.receiveCoeff || DEFAULT_FUEL_COEFF);
      var receiveCoeffB = parseFuelCoeff(raw.receiveCoeffB, raw.receiveCoeff || DEFAULT_FUEL_COEFF);
      var receiveCoeffV = parseFuelCoeff(raw.receiveCoeffV, raw.receiveCoeff || DEFAULT_FUEL_COEFF);
      var handoverCoeffA = parseFuelCoeff(raw.handoverCoeffA, raw.handoverCoeff || DEFAULT_FUEL_COEFF);
      var handoverCoeffB = parseFuelCoeff(raw.handoverCoeffB, raw.handoverCoeff || DEFAULT_FUEL_COEFF);
      var handoverCoeffV = parseFuelCoeff(raw.handoverCoeffV, raw.handoverCoeff || DEFAULT_FUEL_COEFF);
      var receiveLitersA = parseFuelLitersValue(raw.receiveLitersA);
      var receiveLitersB = parseFuelLitersValue(raw.receiveLitersB);
      var receiveLitersV = parseFuelLitersValue(raw.receiveLitersV);
      var handoverLitersA = parseFuelLitersValue(raw.handoverLitersA);
      var handoverLitersB = parseFuelLitersValue(raw.handoverLitersB);
      var handoverLitersV = parseFuelLitersValue(raw.handoverLitersV);

      receiveCoeffA = receiveCoeffA === null ? Number(DEFAULT_FUEL_COEFF) : receiveCoeffA;
      receiveCoeffB = receiveCoeffB === null ? Number(DEFAULT_FUEL_COEFF) : receiveCoeffB;
      receiveCoeffV = receiveCoeffV === null ? Number(DEFAULT_FUEL_COEFF) : receiveCoeffV;
      handoverCoeffA = handoverCoeffA === null ? Number(DEFAULT_FUEL_COEFF) : handoverCoeffA;
      handoverCoeffB = handoverCoeffB === null ? Number(DEFAULT_FUEL_COEFF) : handoverCoeffB;
      handoverCoeffV = handoverCoeffV === null ? Number(DEFAULT_FUEL_COEFF) : handoverCoeffV;

      var receiveLitersTotal = receiveLitersA + receiveLitersB + receiveLitersV;
      var handoverLitersTotal = handoverLitersA + handoverLitersB + handoverLitersV;
      var receiveKgTotal = receiveLitersA * receiveCoeffA + receiveLitersB * receiveCoeffB + receiveLitersV * receiveCoeffV;
      var handoverKgTotal = handoverLitersA * handoverCoeffA + handoverLitersB * handoverCoeffB + handoverLitersV * handoverCoeffV;
      var hasReceive = receiveLitersTotal > 0;
      var hasHandover = handoverLitersTotal > 0;
      var hasPair = hasReceive && hasHandover;
      var hasPairA = receiveLitersA > 0 && handoverLitersA > 0;
      var hasPairB = receiveLitersB > 0 && handoverLitersB > 0;
      var hasPairV = receiveLitersV > 0 && handoverLitersV > 0;

      return {
        receiveLitersTotal: receiveLitersTotal,
        handoverLitersTotal: handoverLitersTotal,
        hasReceive: hasReceive,
        hasHandover: hasHandover,
        hasPair: hasPair,
        consumptionLitersA: hasPairA ? (receiveLitersA - handoverLitersA) : 0,
        consumptionLitersB: hasPairB ? (receiveLitersB - handoverLitersB) : 0,
        consumptionLitersV: hasPairV ? (receiveLitersV - handoverLitersV) : 0,
        consumptionKgA: hasPairA ? ((receiveLitersA * receiveCoeffA) - (handoverLitersA * handoverCoeffA)) : 0,
        consumptionKgB: hasPairB ? ((receiveLitersB * receiveCoeffB) - (handoverLitersB * handoverCoeffB)) : 0,
        consumptionKgV: hasPairV ? ((receiveLitersV * receiveCoeffV) - (handoverLitersV * handoverCoeffV)) : 0,
        consumptionLiters: hasPair ? (receiveLitersTotal - handoverLitersTotal) : 0,
        receiveKgTotal: receiveKgTotal,
        handoverKgTotal: handoverKgTotal,
        consumptionKg: hasPair ? (receiveKgTotal - handoverKgTotal) : 0
      };
    }

    function getFuelConsumptionTotalsFromShift(shift) {
      shift = shift || {};
      return getFuelConsumptionTotals({
        receiveCoeff: shift.fuel_receive_coeff,
        receiveCoeffA: shift.fuel_receive_coeff_a,
        receiveCoeffB: shift.fuel_receive_coeff_b,
        receiveCoeffV: shift.fuel_receive_coeff_v,
        receiveLitersA: shift.fuel_receive_liters_a,
        receiveLitersB: shift.fuel_receive_liters_b,
        receiveLitersV: shift.fuel_receive_liters_v,
        handoverCoeff: shift.fuel_handover_coeff,
        handoverCoeffA: shift.fuel_handover_coeff_a,
        handoverCoeffB: shift.fuel_handover_coeff_b,
        handoverCoeffV: shift.fuel_handover_coeff_v,
        handoverLitersA: shift.fuel_handover_liters_a,
        handoverLitersB: shift.fuel_handover_liters_b,
        handoverLitersV: shift.fuel_handover_liters_v
      });
    }

    function buildShiftFuelConsumptionHtml(shift) {
      if (!hasFuelData(shift)) return '';
      var totals = getFuelConsumptionTotalsFromShift(shift);
      return '' +
        '<div class="shift-fuel-note">' +
          '<span class="shift-fuel-note-icon" aria-hidden="true">' + getShiftInlineIconSvg('fuel') + '</span>' +
          '<span class="shift-fuel-note-text"><strong>' + escapeHtml(getFuelConsumptionInlineText(totals)) + '</strong></span>' +
        '</div>';
    }

    function updateFuelKgOutputs() {
      var groups = [
        {
          coeff: {
            a: 'inputFuelReceiveCoeffA',
            b: 'inputFuelReceiveCoeffB',
            v: 'inputFuelReceiveCoeffV'
          },
          liters: {
            a: 'inputFuelReceiveLitersA',
            b: 'inputFuelReceiveLitersB',
            v: 'inputFuelReceiveLitersV'
          },
          kg: {
            a: 'inputFuelReceiveKgA',
            b: 'inputFuelReceiveKgB',
            v: 'inputFuelReceiveKgV'
          }
        },
        {
          coeff: {
            a: 'inputFuelHandoverCoeffA',
            b: 'inputFuelHandoverCoeffB',
            v: 'inputFuelHandoverCoeffV'
          },
          liters: {
            a: 'inputFuelHandoverLitersA',
            b: 'inputFuelHandoverLitersB',
            v: 'inputFuelHandoverLitersV'
          },
          kg: {
            a: 'inputFuelHandoverKgA',
            b: 'inputFuelHandoverKgB',
            v: 'inputFuelHandoverKgV'
          }
        }
      ];
      for (var gi = 0; gi < groups.length; gi++) {
        var tanks = FUEL_SECTIONS;
        for (var ti = 0; ti < tanks.length; ti++) {
          var tank = tanks[ti];
          var liters = getFieldValue(groups[gi].liters[tank]);
          var coeff = getFieldValue(groups[gi].coeff[tank]);
          setFieldValue(groups[gi].kg[tank], getFuelKgText(liters, coeff, DEFAULT_FUEL_COEFF));
        }
      }

      var totals = getFuelConsumptionTotals({
        receiveCoeff: getFieldValue('inputFuelReceiveCoeffA'),
        receiveCoeffA: getFieldValue('inputFuelReceiveCoeffA'),
        receiveCoeffB: getFieldValue('inputFuelReceiveCoeffB'),
        receiveCoeffV: getFieldValue('inputFuelReceiveCoeffV'),
        receiveLitersA: getFieldValue('inputFuelReceiveLitersA'),
        receiveLitersB: getFieldValue('inputFuelReceiveLitersB'),
        receiveLitersV: getFieldValue('inputFuelReceiveLitersV'),
        handoverCoeff: getFieldValue('inputFuelHandoverCoeffA'),
        handoverCoeffA: getFieldValue('inputFuelHandoverCoeffA'),
        handoverCoeffB: getFieldValue('inputFuelHandoverCoeffB'),
        handoverCoeffV: getFieldValue('inputFuelHandoverCoeffV'),
        handoverLitersA: getFieldValue('inputFuelHandoverLitersA'),
        handoverLitersB: getFieldValue('inputFuelHandoverLitersB'),
        handoverLitersV: getFieldValue('inputFuelHandoverLitersV')
      });
      var totalLitersEl = document.getElementById('fuelConsumptionLiters');
      var totalKgEl = document.getElementById('fuelConsumptionKg');
      var sectionKeys = [
        { key: 'A', litersId: 'fuelConsumptionSectionALiters', kgId: 'fuelConsumptionSectionAKg' },
        { key: 'B', litersId: 'fuelConsumptionSectionBLiters', kgId: 'fuelConsumptionSectionBKg' },
        { key: 'V', litersId: 'fuelConsumptionSectionVLiters', kgId: 'fuelConsumptionSectionVKg' }
      ];
      for (var sk = 0; sk < sectionKeys.length; sk++) {
        var sectionLitersEl = document.getElementById(sectionKeys[sk].litersId);
        var sectionKgEl = document.getElementById(sectionKeys[sk].kgId);
        if (sectionLitersEl) sectionLitersEl.textContent = formatFuelLitersSignedValue(totals['consumptionLiters' + sectionKeys[sk].key]);
        if (sectionKgEl) sectionKgEl.textContent = formatFuelKgSignedValue(totals['consumptionKg' + sectionKeys[sk].key]);
      }
      if (totalLitersEl) totalLitersEl.textContent = formatFuelLitersSignedValue(totals.consumptionLiters);
      if (totalKgEl) totalKgEl.textContent = formatFuelKgSignedValue(totals.consumptionKg);
    }

    function hasFuelData(shift) {
      shift = shift || {};
      var receiveCoeffA = normalizeFuelCoeff(shift.fuel_receive_coeff_a, shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF);
      var receiveCoeffB = normalizeFuelCoeff(shift.fuel_receive_coeff_b, shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF);
      var receiveCoeffV = normalizeFuelCoeff(shift.fuel_receive_coeff_v, shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF);
      var handoverCoeffA = normalizeFuelCoeff(shift.fuel_handover_coeff_a, shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF);
      var handoverCoeffB = normalizeFuelCoeff(shift.fuel_handover_coeff_b, shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF);
      var handoverCoeffV = normalizeFuelCoeff(shift.fuel_handover_coeff_v, shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF);
      return !!(
        cleanDigits(shift.fuel_receive_liters_a, 4) ||
        cleanDigits(shift.fuel_receive_liters_b, 4) ||
        cleanDigits(shift.fuel_receive_liters_v, 4) ||
        cleanDigits(shift.fuel_handover_liters_a, 4) ||
        cleanDigits(shift.fuel_handover_liters_b, 4) ||
        cleanDigits(shift.fuel_handover_liters_v, 4) ||
        !isDefaultFuelCoeffValue(receiveCoeffA) ||
        !isDefaultFuelCoeffValue(receiveCoeffB) ||
        !isDefaultFuelCoeffValue(receiveCoeffV) ||
        !isDefaultFuelCoeffValue(handoverCoeffA) ||
        !isDefaultFuelCoeffValue(handoverCoeffB) ||
        !isDefaultFuelCoeffValue(handoverCoeffV)
      );
    }

    function buildFuelSideSummary(shift, side) {
      var isReceive = side === 'receive';
      var coeffA = normalizeFuelCoeff(isReceive ? shift.fuel_receive_coeff_a : shift.fuel_handover_coeff_a, isReceive ? (shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF) : (shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF));
      var coeffB = normalizeFuelCoeff(isReceive ? shift.fuel_receive_coeff_b : shift.fuel_handover_coeff_b, isReceive ? (shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF) : (shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF));
      var coeffV = normalizeFuelCoeff(isReceive ? shift.fuel_receive_coeff_v : shift.fuel_handover_coeff_v, isReceive ? (shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF) : (shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF));
      var aLiters = cleanDigits(isReceive ? shift.fuel_receive_liters_a : shift.fuel_handover_liters_a, 4);
      var bLiters = cleanDigits(isReceive ? shift.fuel_receive_liters_b : shift.fuel_handover_liters_b, 4);
      var vLiters = cleanDigits(isReceive ? shift.fuel_receive_liters_v : shift.fuel_handover_liters_v, 4);
      var rows = [];
      var coeffLine = 'К А/Б/В ' + coeffA.replace('.', ',') + '/' + coeffB.replace('.', ',') + '/' + coeffV.replace('.', ',');

      if (aLiters) rows.push('А ' + aLiters + ' л → ' + (getFuelKgText(aLiters, coeffA) || '—') + ' кг');
      if (bLiters) rows.push('Б ' + bLiters + ' л → ' + (getFuelKgText(bLiters, coeffB) || '—') + ' кг');
      if (vLiters) rows.push('В ' + vLiters + ' л → ' + (getFuelKgText(vLiters, coeffV) || '—') + ' кг');
      if (!rows.length && isDefaultFuelCoeffValue(coeffA) && isDefaultFuelCoeffValue(coeffB) && isDefaultFuelCoeffValue(coeffV)) return '';
      return coeffLine + (rows.length ? ' · ' + rows.join(' · ') : '');
    }

    function getFuelCoeffInputId(side, section) {
      var suffix = String(section || 'a').toUpperCase();
      if (side === 'handover') return 'inputFuelHandoverCoeff' + suffix;
      return 'inputFuelReceiveCoeff' + suffix;
    }

    function getFuelCoeffInput(side, section) {
      return document.getElementById(getFuelCoeffInputId(side, section));
    }

    function syncFuelCoeffByRule(side, section, value, sourceInput) {
      if (!side || !section) return;
      if (side !== 'receive') return;
      var targetInput = getFuelCoeffInput('handover', section);
      if (!targetInput || targetInput === sourceInput) return;
      targetInput.value = value;
    }

    function wireFuelCoeffInput(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var handleInput = function() {
        var cleaned = cleanFuelCoeffInput(el.value);
        if (el.value !== cleaned) el.value = cleaned;
        var side = el.getAttribute('data-side');
        var section = el.getAttribute('data-section');
        syncFuelCoeffByRule(side, section, el.value, el);
        updateFuelKgOutputs();
      };
      var handleBlur = function() {
        var normalized = normalizeFuelCoeff(el.value, DEFAULT_FUEL_COEFF);
        if (el.value !== normalized) el.value = normalized;
        var side = el.getAttribute('data-side');
        var section = el.getAttribute('data-section');
        syncFuelCoeffByRule(side, section, normalized, el);
        updateFuelKgOutputs();
      };
      var handleFocus = function() {
        if (el.value !== DEFAULT_FUEL_COEFF || typeof el.setSelectionRange !== 'function') return;
        window.setTimeout(function() {
          try {
            el.setSelectionRange(3, 5);
          } catch (e) {}
        }, 0);
      };
      el.addEventListener('input', handleInput);
      el.addEventListener('blur', handleBlur);
      el.addEventListener('focus', handleFocus);
      el.addEventListener('change', handleBlur);
    }

    function getRouteType() {
      var active = document.querySelector('#routeTypeSegmented .segmented-btn.active');
      return active ? active.getAttribute('data-value') : 'depot';
    }

    function setRouteType(routeType) {
      var buttons = document.querySelectorAll('#routeTypeSegmented .segmented-btn');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('active', buttons[i].getAttribute('data-value') === routeType);
      }
      updateRouteFieldsVisibility();
    }

    function updateRouteFieldsVisibility() {
      var routeFields = document.getElementById('routeFields');
      if (!routeFields) return;
      routeFields.classList.toggle('hidden', getRouteType() !== 'trip');
    }

    function setOptionalCardOpen(cardId, open) {
      var card = document.getElementById(cardId);
      if (card) card.open = !!open;
    }

    function getFieldValue(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }

    function setFieldValue(id, value) {
      var el = document.getElementById(id);
      if (el && el.value !== String(value || '')) {
        el.value = String(value || '');
      }
      updateSelectPlaceholderState(el);
      if (id === 'inputLocoSeries') syncLocoSeriesTrigger();
    }

    function updateSelectPlaceholderState(elOrId) {
      var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
      if (!el || el.tagName !== 'SELECT') return;
      el.classList.toggle('is-placeholder', !el.value);
      if (el.id === 'inputLocoSeries') syncLocoSeriesTrigger();
    }

    var LOCO_SERIES_MENU_OPEN = false;

    function getLocoSeriesMenuEls() {
      return {
        selectEl: document.getElementById('inputLocoSeries'),
        valueEl: document.getElementById('locoSeriesValue'),
        triggerEl: document.getElementById('locoSeriesTrigger'),
        menuEl: document.getElementById('locoSeriesMenu')
      };
    }

    function portalLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      if (!els.menuEl || !UI_OVERLAY_ROOT) return;
      if (els.menuEl.parentNode !== UI_OVERLAY_ROOT) {
        UI_OVERLAY_ROOT.appendChild(els.menuEl);
      }
    }

    function updateLocoSeriesMenuPosition() {
      if (!LOCO_SERIES_MENU_OPEN) return;
      var els = getLocoSeriesMenuEls();
      if (!els.triggerEl || !els.menuEl) return;

      var rect = els.triggerEl.getBoundingClientRect();
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var gap = 10;
      var horizontalPadding = 12;
      var verticalPadding = 12;
      var availableWidth = Math.max(0, viewportWidth - horizontalPadding * 2);
      var menuWidth = Math.max(rect.width, 180);
      if (menuWidth > availableWidth) menuWidth = availableWidth;
      var left = Math.min(Math.max(rect.left, horizontalPadding), Math.max(horizontalPadding, viewportWidth - menuWidth - horizontalPadding));

      var spaceBelow = viewportHeight - rect.bottom - gap - verticalPadding;
      var spaceAbove = rect.top - gap - verticalPadding;
      var openDown = spaceBelow >= 160 || spaceBelow >= spaceAbove;
      var maxHeight = Math.max(140, Math.min(256, openDown ? spaceBelow : spaceAbove));
      var top = openDown ? rect.bottom + gap : Math.max(verticalPadding, rect.top - gap - maxHeight);

      els.menuEl.style.setProperty('--select-left', left + 'px');
      els.menuEl.style.setProperty('--select-top', top + 'px');
      els.menuEl.style.setProperty('--select-width', menuWidth + 'px');
      els.menuEl.style.setProperty('--select-max-height', maxHeight + 'px');
      els.menuEl.dataset.placement = openDown ? 'bottom' : 'top';
    }

    function syncLocoSeriesTrigger() {
      var els = getLocoSeriesMenuEls();
      var selectEl = els.selectEl;
      var valueEl = els.valueEl;
      var triggerEl = els.triggerEl;
      var menuEl = els.menuEl;
      if (!selectEl || !valueEl) return;
      var selected = selectEl.options[selectEl.selectedIndex];
      var hasValue = !!selectEl.value;
      valueEl.textContent = hasValue && selected ? selected.textContent : 'Выберите серию';
      valueEl.classList.toggle('is-placeholder', !hasValue);
      if (triggerEl) triggerEl.classList.toggle('is-placeholder', !hasValue);
      if (menuEl) {
        var buttons = menuEl.querySelectorAll('.glass-select-option');
        for (var i = 0; i < buttons.length; i++) {
          var active = buttons[i].getAttribute('data-value') === selectEl.value;
          buttons[i].classList.toggle('is-active', active);
          buttons[i].setAttribute('aria-selected', active ? 'true' : 'false');
        }
      }
    }

    function buildLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      var selectEl = els.selectEl;
      var menuEl = els.menuEl;
      if (!selectEl || !menuEl) return;
      var html = '';
      for (var i = 0; i < selectEl.options.length; i++) {
        var opt = selectEl.options[i];
        if (!opt.value) continue;
        html += '<button type="button" class="glass-select-option" role="option" aria-selected="false" data-value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.textContent) + '</button>';
      }
      menuEl.innerHTML = html;
      portalLocoSeriesMenu();
      syncLocoSeriesTrigger();
    }

    function closeLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      LOCO_SERIES_MENU_OPEN = false;
      if (els.menuEl) els.menuEl.classList.add('hidden');
      if (els.triggerEl) {
        els.triggerEl.classList.remove('is-open');
        els.triggerEl.setAttribute('aria-expanded', 'false');
      }
    }

    function openLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      if (!els.menuEl || !els.triggerEl) return;
      portalLocoSeriesMenu();
      LOCO_SERIES_MENU_OPEN = true;
      els.menuEl.classList.remove('hidden');
      els.triggerEl.classList.add('is-open');
      els.triggerEl.setAttribute('aria-expanded', 'true');
      updateLocoSeriesMenuPosition();
    }

    function toggleLocoSeriesMenu() {
      var menuEl = document.getElementById('locoSeriesMenu');
      if (!menuEl) return;
      if (menuEl.classList.contains('hidden')) openLocoSeriesMenu();
      else closeLocoSeriesMenu();
    }

    function setLocoSeriesValue(value) {
      var selectEl = document.getElementById('inputLocoSeries');
      if (!selectEl) return;
      if (selectEl.value === String(value || '')) {
        closeLocoSeriesMenu();
        return;
      }
      selectEl.value = String(value || '');
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      syncLocoSeriesTrigger();
      closeLocoSeriesMenu();
      renderDraftShiftSummary();
    }

    function renderDraftShiftSummary() {
      var startDateEl = document.getElementById('inputStartDate');
      var startTimeEl = document.getElementById('inputStartTime');
      var endDateEl = document.getElementById('inputEndDate');
      var endTimeEl = document.getElementById('inputEndTime');
      var totalEl = document.getElementById('draftTotal');
      var nightEl = document.getElementById('draftNight');
      var holidayEl = document.getElementById('draftHoliday');

      var startVal = composeMskDateTime(startDateEl ? startDateEl.value : '', startTimeEl ? startTimeEl.value : '');
      var endVal = composeMskDateTime(endDateEl ? endDateEl.value : '', endTimeEl ? endTimeEl.value : '');
      if (!startVal || !endVal) {
        if (totalEl) totalEl.textContent = '0 ч';
        if (nightEl) nightEl.textContent = '0 ч';
        if (holidayEl) holidayEl.textContent = '0 ч';
        return;
      }

      var draftShift = { start_msk: startVal, end_msk: endVal };
      var totalMin = shiftTotalMinutes(draftShift);
      var nightMin = shiftNightMinutesInRange(draftShift, -8640000000000000, 8640000000000000);
      var holidayMin = shiftHolidayMinutesInRange(draftShift, -8640000000000000, 8640000000000000);
      if (totalEl) totalEl.textContent = fmtMin(totalMin);
      if (nightEl) nightEl.textContent = fmtMin(nightMin);
      if (holidayEl) holidayEl.textContent = fmtMin(holidayMin);
    }

    function wireNumericInput(id, maxLen) {
      var el = document.getElementById(id);
      if (!el) return;
      var handler = function() {
        var cleaned = cleanDigits(el.value, maxLen);
        if (el.value !== cleaned) el.value = cleaned;
      };
      el.addEventListener('input', handler);
      el.addEventListener('blur', handler);
    }

    function collectOptionalShiftData() {
      var routeKind = getRouteType() === 'trip' ? 'trip' : 'depot';
      var receiveCoeffA = normalizeFuelCoeff(getFieldValue('inputFuelReceiveCoeffA'), DEFAULT_FUEL_COEFF);
      var receiveCoeffB = normalizeFuelCoeff(getFieldValue('inputFuelReceiveCoeffB'), receiveCoeffA);
      var receiveCoeffV = normalizeFuelCoeff(getFieldValue('inputFuelReceiveCoeffV'), receiveCoeffA);
      var handoverCoeffA = normalizeFuelCoeff(getFieldValue('inputFuelHandoverCoeffA'), DEFAULT_FUEL_COEFF);
      var handoverCoeffB = normalizeFuelCoeff(getFieldValue('inputFuelHandoverCoeffB'), handoverCoeffA);
      var handoverCoeffV = normalizeFuelCoeff(getFieldValue('inputFuelHandoverCoeffV'), handoverCoeffA);
      return {
        locomotive_series: getFieldValue('inputLocoSeries'),
        locomotive_number: cleanDigits(getFieldValue('inputLocoNumber'), 4),
        train_number: cleanDigits(getFieldValue('inputTrainNumber'), 4),
        train_weight: cleanDigits(getFieldValue('inputTrainWeight'), 4),
        train_axles: cleanDigits(getFieldValue('inputTrainAxles'), 3),
        train_length: cleanDigits(getFieldValue('inputTrainLength'), 3),
        route_kind: routeKind,
        route_from: routeKind === 'trip' ? getFieldValue('inputRouteFrom') : '',
        route_to: routeKind === 'trip' ? getFieldValue('inputRouteTo') : '',
        fuel_receive_coeff: receiveCoeffA,
        fuel_receive_coeff_a: receiveCoeffA,
        fuel_receive_coeff_b: receiveCoeffB,
        fuel_receive_coeff_v: receiveCoeffV,
        fuel_receive_liters_a: cleanDigits(getFieldValue('inputFuelReceiveLitersA'), 4),
        fuel_receive_liters_b: cleanDigits(getFieldValue('inputFuelReceiveLitersB'), 4),
        fuel_receive_liters_v: cleanDigits(getFieldValue('inputFuelReceiveLitersV'), 4),
        fuel_handover_coeff: handoverCoeffA,
        fuel_handover_coeff_a: handoverCoeffA,
        fuel_handover_coeff_b: handoverCoeffB,
        fuel_handover_coeff_v: handoverCoeffV,
        fuel_handover_liters_a: cleanDigits(getFieldValue('inputFuelHandoverLitersA'), 4),
        fuel_handover_liters_b: cleanDigits(getFieldValue('inputFuelHandoverLitersB'), 4),
        fuel_handover_liters_v: cleanDigits(getFieldValue('inputFuelHandoverLitersV'), 4)
      };
    }

    function applyOptionalShiftData(shift) {
      shift = shift || {};
      setFieldValue('inputLocoSeries', shift.locomotive_series || '');
      setFieldValue('inputLocoNumber', shift.locomotive_number || '');
      setFieldValue('inputTrainNumber', shift.train_number || '');
      setFieldValue('inputTrainWeight', shift.train_weight || '');
      setFieldValue('inputTrainAxles', shift.train_axles || '');
      setFieldValue('inputTrainLength', shift.train_length || '');
      setFieldValue('inputRouteFrom', shift.route_from || '');
      setFieldValue('inputRouteTo', shift.route_to || '');
      setFieldValue('inputFuelReceiveCoeffA', normalizeFuelCoeff(shift.fuel_receive_coeff_a, shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF));
      setFieldValue('inputFuelReceiveCoeffB', normalizeFuelCoeff(shift.fuel_receive_coeff_b, shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF));
      setFieldValue('inputFuelReceiveCoeffV', normalizeFuelCoeff(shift.fuel_receive_coeff_v, shift.fuel_receive_coeff || DEFAULT_FUEL_COEFF));
      setFieldValue('inputFuelReceiveLitersA', cleanDigits(shift.fuel_receive_liters_a, 4));
      setFieldValue('inputFuelReceiveLitersB', cleanDigits(shift.fuel_receive_liters_b, 4));
      setFieldValue('inputFuelReceiveLitersV', cleanDigits(shift.fuel_receive_liters_v, 4));
      setFieldValue('inputFuelHandoverCoeffA', normalizeFuelCoeff(shift.fuel_handover_coeff_a, shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF));
      setFieldValue('inputFuelHandoverCoeffB', normalizeFuelCoeff(shift.fuel_handover_coeff_b, shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF));
      setFieldValue('inputFuelHandoverCoeffV', normalizeFuelCoeff(shift.fuel_handover_coeff_v, shift.fuel_handover_coeff || DEFAULT_FUEL_COEFF));
      setFieldValue('inputFuelHandoverLitersA', cleanDigits(shift.fuel_handover_liters_a, 4));
      setFieldValue('inputFuelHandoverLitersB', cleanDigits(shift.fuel_handover_liters_b, 4));
      setFieldValue('inputFuelHandoverLitersV', cleanDigits(shift.fuel_handover_liters_v, 4));
      setRouteType(shift.route_kind === 'trip' ? 'trip' : 'depot');
      setOptionalCardOpen('optionalLocoCard', !!(shift.locomotive_series || shift.locomotive_number));
      setOptionalCardOpen('optionalTrainCard', !!(shift.train_number || shift.train_weight || shift.train_axles || shift.train_length));
      setOptionalCardOpen('optionalRouteCard', !!(shift.route_kind === 'trip' || shift.route_from || shift.route_to));
      setOptionalCardOpen('optionalFuelCard', hasFuelData(shift));
      updateFuelKgOutputs();
      renderDraftShiftSummary();
    }

    function clearOptionalShiftData() {
      applyOptionalShiftData({
        locomotive_series: '',
        locomotive_number: '',
        train_number: '',
        train_weight: '',
        train_axles: '',
        train_length: '',
        route_kind: 'depot',
        route_from: '',
        route_to: '',
        fuel_receive_coeff: DEFAULT_FUEL_COEFF,
        fuel_receive_coeff_a: DEFAULT_FUEL_COEFF,
        fuel_receive_coeff_b: DEFAULT_FUEL_COEFF,
        fuel_receive_coeff_v: DEFAULT_FUEL_COEFF,
        fuel_receive_liters_a: '',
        fuel_receive_liters_b: '',
        fuel_receive_liters_v: '',
        fuel_handover_coeff: DEFAULT_FUEL_COEFF,
        fuel_handover_coeff_a: DEFAULT_FUEL_COEFF,
        fuel_handover_coeff_b: DEFAULT_FUEL_COEFF,
        fuel_handover_coeff_v: DEFAULT_FUEL_COEFF,
        fuel_handover_liters_a: '',
        fuel_handover_liters_b: '',
        fuel_handover_liters_v: ''
      });
    }

    function getLocoSummary(shift) {
      var parts = [];
      if (shift.locomotive_series) parts.push(shift.locomotive_series);
      if (shift.locomotive_number) parts.push('№ ' + shift.locomotive_number);
      return parts.join(' ');
    }

    function getTrainSummary(shift) {
      var parts = [];
      if (shift.train_number) parts.push('№ ' + shift.train_number);
      if (shift.train_weight) parts.push(shift.train_weight + ' т');
      if (shift.train_axles) parts.push(shift.train_axles + ' осей');
      if (shift.train_length) parts.push(shift.train_length + ' уд.');
      return parts.join(' · ');
    }

    function getShiftTitle(shift) {
      var from = shift.route_from ? shift.route_from : '';
      var to = shift.route_to ? shift.route_to : '';
      if (shift.route_kind === 'trip' && (from || to)) {
        return (from || 'Пункт A') + ' → ' + (to || 'Пункт B');
      }
      if (shift.route_kind === 'trip') {
        return 'Поездка';
      }
      if (shift.route_kind === 'depot') {
        return 'Смена';
      }
      var loco = getLocoSummary(shift);
      if (loco) return 'Локомотив ' + loco;
      var train = getTrainSummary(shift);
      if (train) return 'Поезд ' + train;
      return 'Смена';
    }

    function getShiftActionsMenuEls() {
      var scopeSelector = activeShiftMenuScope ? ('#' + activeShiftMenuScope + ' ') : '';
      return {
        triggerEl: activeShiftMenuId ? document.querySelector(scopeSelector + '.shift-actions-trigger[data-id="' + escapeSelectorValue(activeShiftMenuId) + '"]') : null,
        menuEl: SHIFT_ACTIONS_MENU,
        shiftEl: activeShiftMenuId ? document.querySelector(scopeSelector + '.shift-item[data-shift-id="' + escapeSelectorValue(activeShiftMenuId) + '"]') : null
      };
    }

    function setShiftActionsTriggerState(triggerEl, isOpen) {
      if (!triggerEl) return;
      triggerEl.classList.toggle('is-open', !!isOpen);
      triggerEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function hideShiftActionsMenuOnly() {
      if (SHIFT_ACTIONS_MENU) {
        SHIFT_ACTIONS_MENU.classList.remove('is-entering');
        SHIFT_ACTIONS_MENU.setAttribute('aria-hidden', 'true');
        if (!SHIFT_ACTIONS_MENU.classList.contains('hidden') && !SHIFT_ACTIONS_MENU.classList.contains('is-leaving')) {
          SHIFT_ACTIONS_MENU.classList.add('is-leaving');
          var _menu = SHIFT_ACTIONS_MENU;
          function _onLeaveEnd() {
            _menu.removeEventListener('animationend', _onLeaveEnd);
            _menu.classList.remove('is-leaving');
            _menu.classList.add('hidden');
          }
          SHIFT_ACTIONS_MENU.addEventListener('animationend', _onLeaveEnd);
        }
      }
    }

    function syncShiftActionsMenuLifecycle() {
      if (activeShiftMenuId === null) {
        hideShiftActionsMenuOnly();
        return;
      }

      var els = getShiftActionsMenuEls();
      if (editingShiftId || !els.shiftEl || !els.triggerEl) {
        closeShiftActionsMenu(true);
        return;
      }
      setShiftActionsTriggerState(els.triggerEl, true);
      renderShiftActionsMenu(activeShiftMenuId);
    }

    function portalShiftActionsMenu() {
      if (!SHIFT_ACTIONS_MENU || !UI_OVERLAY_ROOT) return;
      if (SHIFT_ACTIONS_MENU.parentNode !== UI_OVERLAY_ROOT) {
        UI_OVERLAY_ROOT.appendChild(SHIFT_ACTIONS_MENU);
      }
    }

    function updateShiftActionsMenuPosition() {
      var els = getShiftActionsMenuEls();
      if (!els.triggerEl || !els.menuEl || els.menuEl.classList.contains('hidden')) return;

      var triggerRect = els.triggerEl.getBoundingClientRect();
      var menuRect = els.menuEl.getBoundingClientRect();
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var gutter = 14;
      var gap = 12;
      var menuWidth = Math.max(156, menuRect.width || 0);
      var menuHeight = Math.max(72, menuRect.height || 0);
      var left = Math.min(triggerRect.right - menuWidth, viewportWidth - menuWidth - gutter);
      if (left < gutter) left = gutter;

      var spaceAbove = triggerRect.top - gap - gutter;
      var spaceBelow = viewportHeight - triggerRect.bottom - gap - gutter;
      var openAbove = spaceAbove >= menuHeight || spaceAbove >= spaceBelow;
      var top = openAbove ? Math.max(gutter, triggerRect.top - gap - menuHeight) : Math.min(viewportHeight - menuHeight - gutter, triggerRect.bottom + gap);
      if (top < gutter) top = gutter;

      els.menuEl.style.setProperty('--shift-menu-left', left + 'px');
      els.menuEl.style.setProperty('--shift-menu-top', top + 'px');
      els.menuEl.dataset.placement = openAbove ? 'top' : 'bottom';
    }

    function renderShiftActionsMenu(shiftId) {
      if (!SHIFT_ACTIONS_MENU) return;
      var safeShiftId = escapeHtml(String(shiftId || ''));
      SHIFT_ACTIONS_MENU.innerHTML =
        '<button class="shift-actions-item" type="button" data-action="edit" data-id="' + safeShiftId + '" role="menuitem">' +
          '<span class="shift-actions-item-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" focusable="false">' +
              '<path fill="currentColor" d="M3 17.25V21h3.75L18.3 9.45l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l9.55-9.55.92.92-9.55 9.55ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.33-2.33a1 1 0 0 0-1.42 0l-1.13 1.13 3.75 3.75 1.13-1.14Z"></path>' +
            '</svg>' +
          '</span>' +
          '<span class="shift-actions-item-label">Редактировать</span>' +
        '</button>' +
        '<button class="shift-actions-item is-danger" type="button" data-action="delete" data-id="' + safeShiftId + '" role="menuitem">' +
          '<span class="shift-actions-item-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" focusable="false">' +
              '<path fill="currentColor" d="M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1Zm1 2h4V5h-4v0Zm-3 2 1 12h8l1-12H7Zm3 2a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"></path>' +
            '</svg>' +
          '</span>' +
          '<span class="shift-actions-item-label">Удалить</span>' +
        '</button>';
      portalShiftActionsMenu();
      SHIFT_ACTIONS_MENU.classList.remove('is-leaving', 'is-entering', 'hidden');
      SHIFT_ACTIONS_MENU.setAttribute('aria-hidden', 'false');
      void SHIFT_ACTIONS_MENU.offsetWidth;
      SHIFT_ACTIONS_MENU.classList.add('is-entering');
      updateShiftActionsMenuPosition();
    }

    function closeShiftActionsMenu() {
      if (activeShiftMenuId === null) {
        hideShiftActionsMenuOnly();
        return;
      }
      var els = getShiftActionsMenuEls();
      if (els && els.triggerEl) setShiftActionsTriggerState(els.triggerEl, false);
      hideShiftActionsMenuOnly();
      activeShiftMenuId = null;
      activeShiftMenuScope = null;
    }

    function openShiftActionsMenuForTrigger(triggerEl, targetId, targetScope) {
      if (!triggerEl || !targetId) return;
      var prevEls = getShiftActionsMenuEls();
      if (prevEls && prevEls.triggerEl && prevEls.triggerEl !== triggerEl) {
        setShiftActionsTriggerState(prevEls.triggerEl, false);
      }
      activeShiftMenuId = targetId;
      activeShiftMenuScope = targetScope;
      setShiftActionsTriggerState(triggerEl, true);
      renderShiftActionsMenu(targetId);
    }

    function handleShiftActionsTriggerClick(e, triggerElArg, hostElArg) {
      e.preventDefault();
      e.stopPropagation();
      var triggerEl = triggerElArg || e.currentTarget;
      if (!triggerEl) return;
      var targetId = triggerEl.getAttribute('data-id');
      var host = hostElArg || triggerEl.closest('#homeShiftsList, #shiftsList');
      var targetScope = host ? host.id : 'shiftsList';

      if (activeShiftMenuId === targetId && activeShiftMenuScope === targetScope) {
        closeShiftActionsMenu(true);
        return;
      }

      triggerHapticTapLight();
      openShiftActionsMenuForTrigger(triggerEl, targetId, targetScope);
    }

    function handleShiftActionsItemClick(item, e) {
      if (!item) return;
      if (item.dataset.shiftActionHandled === '1') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      item.dataset.shiftActionHandled = '1';
      window.setTimeout(function() {
        delete item.dataset.shiftActionHandled;
      }, 600);

      e.preventDefault();
      e.stopPropagation();

      var action = item.getAttribute('data-action');
      var id = item.getAttribute('data-id');
      var shift = findShiftById(id);
      if (!shift) {
        closeShiftActionsMenu(true);
        return;
      }

      if (action === 'edit') {
        triggerHapticTapLight();
        enterEditMode(shift, { returnTab: activeTab });
        closeShiftActionsMenu(true);
        return;
      }

      if (action === 'delete') {
        triggerHapticWarning();
        pendingDeleteId = id;
        closeShiftActionsMenu(true);
        render();
        openOverlay('overlayConfirm');
        return;
      }

      triggerHapticTapLight();
    }

