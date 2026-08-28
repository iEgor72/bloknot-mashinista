    if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('render', 'v412');

    function buildShiftItemHtml(sh, compact, pendingMap, shiftIncomeMap, durationBounds, durationLevelMap, latestManualShiftId) {
      var p = getShiftDisplayParts(sh);
      var itemClass = 'shift-item shift-card-v2' + (compact ? ' compact-shift' : '');
      var shiftIsPending = pendingMap ? !!pendingMap[String(sh.id)] : isShiftPending(sh);
      var directionText = getShiftDirectionLineText(sh);
      var dateTimeText = getShiftDateTimeLineLabel(p);
      var rangeState = getShiftRangeState(sh);
      var durationMinutes = getShiftMinutesForDisplay(sh, durationBounds);
      var durationText = getShiftDurationLabelText(rangeState.hasValidInterval ? fmtMin(durationMinutes) : '—');

      var shiftTitle = directionText || getShiftTitle(sh) || 'Смена';
      var holidayMin = (typeof shiftHolidayMinutesInRange === 'function')
        ? shiftHolidayMinutesInRange(sh, -8640000000000000, 8640000000000000)
        : 0;
      var isHolidayShift = holidayMin > 0;
      var workCode = (typeof inferShiftWorkCodeByLocalTime === 'function')
        ? inferShiftWorkCodeByLocalTime(sh) : '';
      if (sh.route_kind === 'trip') itemClass += ' has-trip';
      if (workCode === 'N') itemClass += ' is-night';
      if (isHolidayShift) itemClass += ' is-holiday';
      if (sh.id === editingShiftId) itemClass += ' is-edit-target';
      if (sh.id === pendingDeleteId) itemClass += ' is-delete-target';
      if (sh.id === recentAddedShiftId) itemClass += ' is-adding-target';
      if (sh.id === journalFocusShiftId) itemClass += ' is-journal-focus-target';
      if (shiftIsPending) itemClass += ' is-pending';
      var durationLevelData = durationLevelMap ? durationLevelMap[String(sh.id)] : null;
      var durationLevel = durationLevelData && typeof durationLevelData.level === 'string'
        ? durationLevelData.level
        : 'medium';
      if (durationLevel === 'high') itemClass += ' duration-high';
      else if (durationLevel === 'low') itemClass += ' duration-low';
      var incomeVm = getShiftIncomeViewModel(sh, shiftIncomeMap);
      itemClass += ' income-' + incomeVm.level;
      var shiftIdStr = String(sh.id);
      var shiftIdAttr = escapeHtml(shiftIdStr);
      var canOpenPoekhali = !!latestManualShiftId && shiftIdStr === String(latestManualShiftId);
      var isActionsOpen = activeShiftMenuId !== null && String(activeShiftMenuId) === shiftIdStr;

      var markHtml = (typeof buildShiftMarkHtml === 'function')
        ? buildShiftMarkHtml(sh, isHolidayShift)
        : '';
      var consistHtml = (typeof buildShiftConsistHtml === 'function')
        ? buildShiftConsistHtml(sh, incomeVm && incomeVm.amountText, rangeState.hasValidInterval ? durationText : '') : '';

      var pendingDotHtml = shiftIsPending ? '<span class="shift-sync-inline" aria-label="Не синхронизировано" title="Не синхронизировано">' + docOnlineOnlyIcon + '</span>' : '';
      var poekhaliBtnHtml = canOpenPoekhali
        ? '<button class="shift-poekhali-btn" type="button" data-id="' + shiftIdAttr + '" aria-label="Выбрать плечо и открыть Поехали" title="Поехали">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
              '<path fill="currentColor" d="M12 3a9 9 0 0 1 8.94 8H18.9A7 7 0 1 0 11 18.9V21A9 9 0 0 1 12 3Zm.9 5.15 5.1 7.7a1 1 0 0 1-1.15 1.48l-3.85-1.37-3.85 1.37A1 1 0 0 1 8 15.85l5.1-7.7Zm.1 2.36-2.25 3.4 1.92-.68a1 1 0 0 1 .66 0l1.92.68L13 10.51Z"></path>' +
            '</svg>' +
            '<span class="shift-poekhali-btn-label">Поехали</span>' +
          '</button>'
        : '';
      var actionsHtml = '<div class="shift-actions-wrap">' +
        '<button class="shift-actions-trigger' + (isActionsOpen ? ' is-open' : '') + '" type="button" data-id="' + shiftIdAttr + '" aria-label="Действия" aria-haspopup="menu" aria-expanded="' + (isActionsOpen ? 'true' : 'false') + '">' +
          '<svg class="shift-actions-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<circle cx="6.5" cy="12" r="1.7"></circle>' +
            '<circle cx="12" cy="12" r="1.7"></circle>' +
            '<circle cx="17.5" cy="12" r="1.7"></circle>' +
          '</svg>' +
        '</button>' +
      '</div>';

      var compactDate = (typeof buildShiftCompactDateLine === 'function') ? buildShiftCompactDateLine(sh) : '';
      // Duration moved out of the subtitle into the data grid below (as "Время").
      var subText = (compactDate || dateTimeText) +
        (isHolidayShift ? ' · праздник' : '');

      var html = '<div class="' + itemClass + '" data-shift-id="' + shiftIdAttr + '" data-pending="' + (shiftIsPending ? '1' : '0') + '" data-shift-open="1" role="button" tabindex="0" aria-label="Редактировать смену: ' + escapeHtml(shiftTitle) + '">' +
        '<div class="shift-card-top">' +
          markHtml +
          '<div class="shift-title-wrap">' +
            '<div class="shift-card-title">' + escapeHtml(shiftTitle) + pendingDotHtml + '</div>' +
            '<div class="shift-card-sub">' + escapeHtml(subText) + '</div>' +
          '</div>' +
          poekhaliBtnHtml +
          actionsHtml +
        '</div>' +
        consistHtml +
      '</div>';

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
      var homeUpcomingList = document.getElementById('homeScheduleUpcoming');
      if (homeUpcomingList && (!preferredList || preferredList !== homeUpcomingList)) {
        var homeUpcomingCard = homeUpcomingList.querySelector('.shift-item[data-shift-open="1"][data-shift-id="' + id + '"]');
        if (homeUpcomingCard) return homeUpcomingCard;
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
        var eventTarget = e.target && e.target.nodeType === 1 ? e.target : null;
        var poekhaliBtn = eventTarget && eventTarget.closest ? eventTarget.closest('.shift-poekhali-btn') : null;
        if (poekhaliBtn && listEl.contains(poekhaliBtn)) {
          e.preventDefault();
          var pkId = poekhaliBtn.getAttribute('data-id');
          if (typeof triggerHapticSelection === 'function') triggerHapticSelection();
          if (typeof openPoekhaliPreparationForShift === 'function') openPoekhaliPreparationForShift(pkId);
          else if (typeof openPoekhaliForShift === 'function') openPoekhaliForShift(pkId);
          else if (typeof setActiveTab === 'function') setActiveTab('poekhali');
          return;
        }
        var trigger = eventTarget && eventTarget.closest ? eventTarget.closest('.shift-actions-trigger') : null;
        if (trigger && listEl.contains(trigger)) {
          handleShiftActionsTriggerClick(e, trigger, listEl);
          return;
        }
        var card = eventTarget && eventTarget.closest ? eventTarget.closest('.shift-item[data-shift-open="1"][data-shift-id]') : null;
        if (!card || !listEl.contains(card)) return;
        if ((eventTarget.closest && eventTarget.closest('.shift-actions-trigger')) || (eventTarget.closest && eventTarget.closest('.shift-actions-wrap'))) return;
        openShiftEditorFromCard(card);
      });

      listEl.addEventListener('keydown', function(e) {
        if (shiftDetailState.isAnimating) return;
        if (!(e.key === 'Enter' || e.key === ' ')) return;
        var eventTarget = e.target && e.target.nodeType === 1 ? e.target : null;
        var card = eventTarget && eventTarget.closest ? eventTarget.closest('.shift-item[data-shift-open="1"][data-shift-id]') : null;
        if (!card || !listEl.contains(card)) return;
        if ((eventTarget.closest && eventTarget.closest('.shift-actions-trigger')) || (eventTarget.closest && eventTarget.closest('.shift-actions-wrap'))) return;
        e.preventDefault();
        openShiftEditorFromCard(card);
      });
    }

    function updateDashboardGauge(workedMin, normMin, diffMin) {
      var fillEl = document.getElementById('dashboardGaugeFill');
      var overEl = document.getElementById('dashboardGaugeOver');
      var numEl  = document.getElementById('dashboardGaugeNum');
      var unitEl = document.getElementById('dashboardGaugeUnit');
      var gaugeEl = document.getElementById('dashboardGauge');
      if (!fillEl || !numEl || !unitEl || !gaugeEl) return;

      var fillR = 48;
      var overR = 40;
      var fillC = 2 * Math.PI * fillR;
      var overC = 2 * Math.PI * overR;
      fillEl.setAttribute('stroke-dasharray', String(fillC));
      if (overEl) overEl.setAttribute('stroke-dasharray', String(overC));

      var workedHrs = Math.max(0, Math.round((workedMin || 0) / 60));
      numEl.innerHTML = workedHrs + '<span class="u">ч</span>';

      if (!normMin || normMin <= 0) {
        unitEl.textContent = 'из — ч';
        fillEl.setAttribute('stroke-dashoffset', String(fillC));
        if (overEl) overEl.classList.add('hidden');
        gaugeEl.classList.remove('is-over');
        return;
      }
      var normHrs = Math.round(normMin / 60);
      unitEl.textContent = 'из ' + normHrs + ' ч';

      var pct = Math.min(workedMin / normMin, 1);
      fillEl.setAttribute('stroke-dashoffset', String(fillC * (1 - pct)));

      var overPct = workedMin > normMin ? Math.min((workedMin - normMin) / normMin, 1) : 0;
      if (overEl) {
        if (overPct > 0) {
          overEl.classList.remove('hidden');
          overEl.setAttribute('stroke-dashoffset', String(overC * (1 - overPct)));
          gaugeEl.classList.add('is-over');
        } else {
          overEl.classList.add('hidden');
          gaugeEl.classList.remove('is-over');
        }
      }
    }

    function updateDashboardSparkline() {
      var lineEl = document.getElementById('dashboardSparkLine');
      var areaEl = document.querySelectorAll('#dashboardSparkSvg path')[0];
      var dotEl = document.getElementById('dashboardSparkDot');
      var deltaEl = document.getElementById('dashboardSparkDelta');
      if (!lineEl || !areaEl || !dotEl) return;
      var w = 84, h = 28;
      var vals = [];
      for (var off = 5; off >= 0; off--) {
        var d = new Date(currentYear, currentMonth - off, 1);
        var y = d.getFullYear();
        var m = d.getMonth();
        var bounds = (typeof getMonthBounds === 'function') ? getMonthBounds(y, m) : null;
        if (!bounds || typeof buildMonthCalculationShifts !== 'function' || typeof buildSalarySummary !== 'function') {
          vals.push(0); continue;
        }
        try {
          var sets = buildMonthCalculationShifts(y, m, bounds);
          var summary = buildSalarySummary(sets.calculationShifts, bounds);
          vals.push(Math.max(0, summary.netAmount || 0));
        } catch (e) { vals.push(0); }
      }
      var minV = Math.min.apply(null, vals);
      var maxV = Math.max.apply(null, vals);
      var range = (maxV - minV) || 1;
      var step = w / Math.max(1, vals.length - 1);
      var pts = vals.map(function(v, i) {
        var x = i * step;
        var y = h - ((v - minV) / range) * (h - 4) - 2;
        return x.toFixed(1) + ',' + y.toFixed(1);
      });
      var dLine = 'M ' + pts.join(' L ');
      var dArea = dLine + ' L ' + w + ',' + h + ' L 0,' + h + ' Z';
      lineEl.setAttribute('d', dLine);
      areaEl.setAttribute('d', dArea);
      var last = pts[pts.length - 1].split(',');
      dotEl.setAttribute('cx', last[0]);
      dotEl.setAttribute('cy', last[1]);

      // Trend-based colour: earned more than last month → green, less → red,
      // unchanged → neutral. Applies to the line, fill gradient, dot and delta.
      var diff = vals.length >= 2 ? vals[vals.length - 1] - vals[vals.length - 2] : 0;
      var rootStyle = getComputedStyle(document.documentElement);
      var toneVar = diff > 0 ? '--good' : (diff < 0 ? '--bad' : '--ink-3');
      var toneColor = (rootStyle.getPropertyValue(toneVar) || '').trim() ||
        (diff > 0 ? '#4ade80' : (diff < 0 ? '#f87171' : '#8892a4'));
      var softColor = 'color-mix(in oklch, ' + toneColor + ' 18%, transparent)';
      lineEl.setAttribute('stroke', toneColor);
      dotEl.setAttribute('fill', toneColor);
      var sparkStops = document.querySelectorAll('#dashboardSparkSvg linearGradient stop');
      for (var si = 0; si < sparkStops.length; si++) { sparkStops[si].style.stopColor = toneColor; }
      var sparkSvgEl = document.getElementById('dashboardSparkSvg');
      if (sparkSvgEl) {
        sparkSvgEl.style.filter = 'drop-shadow(0 0 6px color-mix(in oklch, ' + toneColor + ' 32%, transparent))';
      }

      // Empty state: no income across the last 6 months → hide the flat line and
      // show a soft caption instead of a meaningless grey baseline.
      var hasData = maxV > 0;
      var emptyEl = document.getElementById('dashboardSparkEmpty');
      if (sparkSvgEl) sparkSvgEl.style.display = hasData ? '' : 'none';
      if (emptyEl) emptyEl.hidden = hasData;

      if (deltaEl) {
        if (hasData && diff !== 0 && isFinite(diff)) {
          deltaEl.hidden = false;
          var arrow = diff > 0 ? '↗' : '↘';
          deltaEl.textContent = arrow + ' ' + (typeof formatRub === 'function' ? formatRub(Math.abs(diff)) : Math.round(Math.abs(diff)) + ' ₽');
          deltaEl.style.color = toneColor;
          deltaEl.style.background = softColor;
        } else {
          deltaEl.hidden = true;
        }
      }
    }

    function setSectionHeaderText(headerEl, text) {
      if (!headerEl) return;
      var titleEl = headerEl.querySelector('.section-header-text');
      if (titleEl) {
        titleEl.textContent = text;
      } else {
        headerEl.textContent = text;
      }
    }

    function getShiftOverviewStats(shifts, durationBounds) {
      var stats = {
        count: shifts.length,
        totalMinutes: 0,
        nightCount: 0,
        holidayCount: 0
      };
      for (var i = 0; i < shifts.length; i++) {
        var shift = shifts[i];
        stats.totalMinutes += getShiftMinutesForDisplay(shift, durationBounds);
        if (typeof inferShiftWorkCodeByLocalTime === 'function' && inferShiftWorkCodeByLocalTime(shift) === 'N') {
          stats.nightCount += 1;
        }
        if (typeof shiftHolidayMinutesInRange === 'function' &&
            shiftHolidayMinutesInRange(shift, -8640000000000000, 8640000000000000) > 0) {
          stats.holidayCount += 1;
        }
      }
      return stats;
    }

    function renderShiftList(listEl, headerEl, shifts, compact, emptyText, headerBase, pendingMap, shiftIncomeMap, durationBounds, durationLevelMap) {
      if (!listEl) return;
      setSectionHeaderText(headerEl, headerBase || 'Журнал смен');
      bindShiftListDetailHandlers(listEl);

      if (!compact) {
        var overviewCountEl = document.getElementById('shiftsOverviewCount');
        var overviewTotalEl = document.getElementById('shiftsOverviewTotal');
        var overviewNightCountEl = document.getElementById('shiftsOverviewNightCount');
        var overviewHolidayCountEl = document.getElementById('shiftsOverviewHolidayCount');
        var overviewStats = getShiftOverviewStats(shifts, durationBounds);
        if (overviewCountEl) overviewCountEl.textContent = String(overviewStats.count);
        if (overviewTotalEl) overviewTotalEl.textContent = fmtMin(overviewStats.totalMinutes);
        if (overviewNightCountEl) overviewNightCountEl.textContent = String(overviewStats.nightCount);
        if (overviewHolidayCountEl) overviewHolidayCountEl.textContent = String(overviewStats.holidayCount);
      }

      if (!shifts.length) {
        listEl.innerHTML = '<div class="shifts-empty">' + emptyText + '</div>';
        return;
      }

      if (headerEl && headerBase !== false) {
        var hasTitleWrap = headerEl.querySelector && headerEl.querySelector('.section-header-text');
        var withCount = (headerBase || 'Журнал смен') + (compact ? '' : ' · ' + shifts.length);
        setSectionHeaderText(headerEl, hasTitleWrap ? (headerBase || 'Журнал смен') : withCount);
      }

      var html = '';
      var latestManualShiftId = typeof getLatestManualShiftId === 'function'
        ? getLatestManualShiftId(allShifts)
        : '';
      for (var i = 0; i < shifts.length; i++) {
        html += buildShiftItemHtml(shifts[i], compact, pendingMap, shiftIncomeMap, durationBounds, durationLevelMap, latestManualShiftId);
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

    function buildScheduleLocalDate(dateKey) {
      var safeDate = typeof normalizeDateKey === 'function' ? normalizeDateKey(dateKey) : String(dateKey || '');
      if (!safeDate) return null;
      var year = parseInt(safeDate.slice(0, 4), 10);
      var month = parseInt(safeDate.slice(5, 7), 10) - 1;
      var day = parseInt(safeDate.slice(8, 10), 10);
      var date = new Date(year, month, day);
      return isFinite(date.getTime()) ? date : null;
    }

    function formatHomeCalendarSheetDate(dateKey) {
      var date = buildScheduleLocalDate(dateKey);
      if (!date) return dateKey || 'День';
      return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }

    function getManualShiftsForDate(dateKey) {
      var dayShifts = typeof getShiftsForDate === 'function' ? getShiftsForDate(dateKey) : [];
      var manualShifts = [];
      for (var i = 0; i < dayShifts.length; i++) {
        if (typeof isLegacyGeneratedShift === 'function' && isLegacyGeneratedShift(dayShifts[i])) continue;
        manualShifts.push(dayShifts[i]);
      }
      return manualShifts;
    }

    function getCalendarDayMeta(dateKey) {
      var shifts = getManualShiftsForDate(dateKey);
      var startShift = null;
      var carryShift = null;
      var carryOut = false;
      for (var i = 0; i < shifts.length; i++) {
        var shift = shifts[i];
        var startDate = normalizeDateKey(shift && shift.start_msk ? shift.start_msk.substring(0, 10) : '');
        var endDate = normalizeDateKey(shift && shift.end_msk ? shift.end_msk.substring(0, 10) : '') || startDate;
        if (!startShift && startDate === dateKey) startShift = shift;
        if (!carryShift && startDate && startDate < dateKey && endDate >= dateKey) carryShift = shift;
        if (startDate <= dateKey && endDate > dateKey) carryOut = true;
      }
      var displayShift = startShift || carryShift || shifts[0] || null;
      var code = displayShift && typeof inferShiftWorkCodeByLocalTime === 'function'
        ? inferShiftWorkCodeByLocalTime(displayShift)
        : '';

      // Positioned timeline segments for this calendar day: the bar spans
      // 00:00→24:00 (MSK), each shift drawn at its actual clock position and
      // coloured day (06:00–22:00, cyan) vs night (22:00–06:00, purple). An
      // overnight shift fills to the right edge here and continues next day.
      var segments = [];
      var workedMinutes = 0;
      var winStart = typeof parseMsk === 'function' ? parseMsk(dateKey + 'T00:00') : null;
      if (shifts.length && winStart) {
        var dayMs = 24 * 60 * 60 * 1000;
        var w0 = winStart.getTime();
        var w1 = w0 + dayMs;
        var zones = [[0, 360, 'night'], [360, 1320, 'day'], [1320, 1440, 'night']];
        for (var w = 0; w < shifts.length; w++) {
          var s = parseMsk(shifts[w].start_msk);
          var e = parseMsk(shifts[w].end_msk);
          if (!s || !e) continue;
          var a = Math.max(w0, s.getTime());
          var b = Math.min(w1, e.getTime());
          if (b <= a) continue;
          workedMinutes += Math.round((b - a) / 60000);
          for (var z = 0; z < zones.length; z++) {
            var segStart = Math.max(a, w0 + zones[z][0] * 60000);
            var segEnd = Math.min(b, w0 + zones[z][1] * 60000);
            if (segEnd <= segStart) continue;
            segments.push({
              left: Math.round(((segStart - w0) / dayMs) * 1000) / 10,
              width: Math.round(((segEnd - segStart) / dayMs) * 1000) / 10,
              kind: zones[z][2]
            });
          }
        }
      }

      return {
        shifts: shifts,
        shiftCount: shifts.length,
        hasShift: shifts.length > 0,
        carryIn: !!carryShift,
        carryOut: carryOut,
        code: code,
        segments: segments,
        workedMinutes: workedMinutes
      };
    }

    function buildHomeCalendarDayButtonHtml(dateObj, inMonth, todayKey) {
      var dateKey = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
      var meta = getCalendarDayMeta(dateKey);
      var isToday = dateKey === todayKey;
      var isHoliday = isScheduleHolidayDate(dateKey);
      var isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      var className = 'home-calendar-day';
      var ariaParts = [dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })];
      if (!inMonth) className += ' is-outside-month';
      if (isToday) className += ' is-today';
      if (isWeekend) className += ' is-weekend';
      if (isHoliday) className += ' is-holiday';
      if (meta.hasShift) className += ' has-shift';
      if (meta.carryIn) className += ' has-carry-in';
      if (meta.carryOut) className += ' has-carry-out';
      if (meta.code === 'N') className += ' shift-night';
      else if (meta.code === 'D') className += ' shift-day';
      if (meta.shiftCount > 1) ariaParts.push('Смен: ' + meta.shiftCount);
      else if (meta.shiftCount === 1) ariaParts.push('1 смена');
      if (meta.carryIn) ariaParts.push('переход с прошлого дня');
      if (meta.carryOut) ariaParts.push('переход на следующий день');
      if (!meta.hasShift) ariaParts.push('день свободен для новой смены');

      // Timeline worked-time bar: the track is the 24h day, each segment sits at
      // its real clock position — cyan = day hours, purple = night hours.
      var barHtml = '';
      if (meta.hasShift && meta.segments && meta.segments.length) {
        var segHtml = '';
        for (var sgi = 0; sgi < meta.segments.length; sgi++) {
          var sg = meta.segments[sgi];
          segHtml += '<span class="home-calendar-day-bar-fill is-' + (sg.kind === 'night' ? 'night' : 'day') +
            '" style="left:' + sg.left + '%;width:' + sg.width + '%"></span>';
        }
        barHtml = '<span class="home-calendar-day-bar" aria-hidden="true">' + segHtml + '</span>';
        if (typeof fmtMin === 'function' && meta.workedMinutes > 0) ariaParts.push('отработано ' + fmtMin(meta.workedMinutes));
      }

      return '<button type="button" class="' + className + '" data-date-key="' + escapeHtml(dateKey) + '" aria-label="' + escapeHtml(ariaParts.join('. ')) + '">' +
        '<span class="home-calendar-day-number">' + dateObj.getDate() + '</span>' +
        (meta.shiftCount > 0 ? '<span class="home-calendar-day-count">' + meta.shiftCount + '</span>' : '') +
        '<span class="home-calendar-day-arrows" aria-hidden="true">' +
          '<span class="home-calendar-arrow home-calendar-arrow-in' + (meta.carryIn ? ' is-visible' : '') + '">←</span>' +
          '<span class="home-calendar-arrow home-calendar-arrow-out' + (meta.carryOut ? ' is-visible' : '') + '">→</span>' +
        '</span>' +
        barHtml +
      '</button>';
    }

    function renderHomeCalendarDaySheet(dateKey, options) {
      var safeDate = typeof normalizeDateKey === 'function' ? normalizeDateKey(dateKey) : '';
      if (!safeDate) return;
      var shifts = getManualShiftsForDate(safeDate);
      var titleEl = document.getElementById('homeCalendarDayTitle');
      var noteEl = document.getElementById('homeCalendarDayNote');
      var contentEl = document.getElementById('homeCalendarDayContent');
      var openJournalBtn = document.getElementById('btnHomeCalendarDayOpenJournal');
      var createShiftBtn = document.getElementById('btnHomeCalendarDayCreateShift');
      var opts = options && typeof options === 'object' ? options : {};
      selectedHomeCalendarDateKey = safeDate;
      if (titleEl) titleEl.textContent = formatHomeCalendarSheetDate(safeDate);
      if (openJournalBtn) {
        openJournalBtn.dataset.dateKey = safeDate;
        openJournalBtn.dataset.shiftId = shifts[0] && shifts[0].id ? String(shifts[0].id) : '';
        openJournalBtn.classList.toggle('hidden', !shifts.length);
        openJournalBtn.textContent = shifts.length > 1 ? 'Открыть день в журнале' : 'Открыть смену в журнале';
      }
      if (createShiftBtn) {
        createShiftBtn.dataset.dateKey = safeDate;
        createShiftBtn.classList.toggle('hidden', !!shifts.length);
      }
      if (!contentEl || !noteEl) return;
      if (!shifts.length) {
        noteEl.textContent = 'Свободный день.';
        contentEl.innerHTML = '<div class="home-calendar-day-empty">Смен нет — можно добавить новую, если в этот день была работа.</div>';
        return;
      }
      var bounds = typeof getMonthBounds === 'function' ? getMonthBounds(currentYear, currentMonth) : null;
      var shiftIncomeMap = currentMonthShiftIncomeMap || Object.create(null);
      var durationLevelMap = typeof buildMonthShiftDurationLevelMap === 'function'
        ? buildMonthShiftDurationLevelMap(shifts, bounds)
        : null;
      var totalMinutes = 0;
      for (var i = 0; i < shifts.length; i++) {
        totalMinutes += getShiftMinutesForDisplay(shifts[i], bounds);
      }
      noteEl.textContent = shifts.length > 1
        ? ('Смен за день: ' + shifts.length + ' · всего ' + fmtMin(totalMinutes))
        : ('Смена за день · ' + fmtMin(totalMinutes));
      var html = '';
      var latestManualShiftId = typeof getLatestManualShiftId === 'function'
        ? getLatestManualShiftId(allShifts)
        : '';
      for (var si = 0; si < shifts.length; si++) {
        html += buildShiftItemHtml(shifts[si], true, null, shiftIncomeMap, bounds, durationLevelMap, latestManualShiftId);
      }
      contentEl.innerHTML = html;
      if (!opts.skipBind) bindShiftListDetailHandlers(contentEl);
    }

    function bindHomeCalendarHandlers(gridEl) {
      if (!gridEl || gridEl.dataset.calendarBound === '1') return;
      gridEl.dataset.calendarBound = '1';
      gridEl.addEventListener('click', function(e) {
        var target = e.target && e.target.nodeType === 1 ? e.target.closest('.home-calendar-day[data-date-key]') : null;
        if (!target || !gridEl.contains(target)) return;
        var dateKey = target.getAttribute('data-date-key');
        if (!dateKey) return;
        triggerHapticTapLight();
        renderHomeCalendarDaySheet(dateKey);
        openOverlay('overlayHomeCalendarDay');
      });
    }

    function renderHomeCalendar() {
      var gridEl = document.getElementById('homeCalendarGrid');
      if (!gridEl) return;
      bindHomeCalendarHandlers(gridEl);
      var firstOfMonth = new Date(currentYear, currentMonth, 1);
      var monthDays = new Date(currentYear, currentMonth + 1, 0).getDate();
      var startWeekday = (firstOfMonth.getDay() + 6) % 7;
      var todayKey = typeof getTodayDateKey === 'function' ? getTodayDateKey() : '';
      var html = '';
      for (var prev = startWeekday; prev > 0; prev--) {
        html += buildHomeCalendarDayButtonHtml(new Date(currentYear, currentMonth, 1 - prev), false, todayKey);
      }
      for (var day = 1; day <= monthDays; day++) {
        html += buildHomeCalendarDayButtonHtml(new Date(currentYear, currentMonth, day), true, todayKey);
      }
      var totalCells = startWeekday + monthDays;
      var trailing = totalCells % 7 === 0 ? 0 : (7 - (totalCells % 7));
      for (var next = 1; next <= trailing; next++) {
        html += buildHomeCalendarDayButtonHtml(new Date(currentYear, currentMonth + 1, next), false, todayKey);
      }
      gridEl.innerHTML = html;
    }

    function isScheduleHolidayDate(dateKey) {
      var safeDate = typeof normalizeDateKey === 'function' ? normalizeDateKey(dateKey) : String(dateKey || '');
      if (!safeDate) return false;
      if (typeof PRODUCTION_NON_WORKING_DAY_MAP !== 'undefined' && PRODUCTION_NON_WORKING_DAY_MAP[safeDate]) {
        return true;
      }
      if (typeof isNonWorkingHolidayLocalDate === 'function') {
        var date = buildScheduleLocalDate(safeDate);
        if (date) return !!isNonWorkingHolidayLocalDate(date);
      }
      return false;
    }

    function renderDeleteConfirmCard(shiftIncomeMap) {
      var cardEl = document.getElementById('confirmShiftCard');
      var titleEl = document.getElementById('confirmOverlayTitle');
      var noteEl = document.getElementById('confirmOverlayNote');
      var confirmBtn = document.getElementById('btnConfirmDelete');
      if (!cardEl) return;
      if (titleEl) titleEl.textContent = 'Удалить запись';
      if (noteEl) noteEl.textContent = 'Это действие нельзя отменить';
      if (confirmBtn) confirmBtn.textContent = 'Удалить';
      if (!pendingDeleteId) {
        cardEl.innerHTML = '';
        return;
      }
      cardEl.innerHTML = buildConfirmShiftCardHtml(findShiftById(pendingDeleteId), shiftIncomeMap);
    }

    function renderProfileSummary() {
      var count = 0;
      var totalMinutes = 0;
      for (var i = 0; i < allShifts.length; i++) {
        var shift = allShifts[i];
        if (typeof isLegacyGeneratedShift === 'function' && isLegacyGeneratedShift(shift)) continue;
        if (typeof isScheduleMaterializedShift === 'function' && isScheduleMaterializedShift(shift)) continue;
        count += 1;
        totalMinutes += shiftTotalMinutes(shift);
      }
      var countEl = document.getElementById('profileShiftCount');
      var countUnitEl = document.getElementById('profileShiftCountUnit');
      var totalEl = document.getElementById('profileWorkedTotal');
      var summaryEl = document.getElementById('profileSummaryCard');
      var countMod100 = count % 100;
      var countMod10 = count % 10;
      var countUnit = 'смен';
      if (countMod100 < 11 || countMod100 > 14) {
        if (countMod10 === 1) countUnit = 'смена';
        else if (countMod10 >= 2 && countMod10 <= 4) countUnit = 'смены';
      }
      var workedHours = Math.floor(totalMinutes / 60);
      var workedMinutes = totalMinutes % 60;
      var workedText = workedHours + ' ч' + (workedMinutes ? ' ' + workedMinutes + ' мин' : '');
      if (countEl) countEl.textContent = String(count);
      if (countUnitEl) countUnitEl.textContent = countUnit;
      if (totalEl) totalEl.textContent = workedText;
      if (summaryEl) summaryEl.setAttribute('aria-label', count + ' ' + countUnit + ', ' + workedText + ' за всё время');
    }

    function render() {
      updateOfflineUiState();
      renderProfileSummary();

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
      renderHomeCalendar();

      var bounds = getMonthBounds(currentYear, currentMonth);
      var _renderPendingMap = getPendingShiftIdMap();
      var monthShiftSets = buildMonthCalculationShifts(currentYear, currentMonth, bounds);
      var monthShifts = monthShiftSets.actualShifts;
      var calculationShifts = monthShiftSets.calculationShifts;
      var visibleManualShifts = [];
      for (var ms = 0; ms < monthShifts.length; ms++) {
        if (typeof isScheduleMaterializedShift === 'function' && isScheduleMaterializedShift(monthShifts[ms])) continue;
        visibleManualShifts.push(monthShifts[ms]);
      }

      // Calculate total worked minutes in this month
      var totalMin = 0;
      var nightMin = 0;
      var holidayMin = 0;
      var shiftIncomeMap = buildMonthShiftIncomeMap(visibleManualShifts, bounds);
      var shiftDurationLevelMap = buildMonthShiftDurationLevelMap(visibleManualShifts, bounds);
      currentMonthShiftIncomeMap = shiftIncomeMap || Object.create(null);
      for (var j = 0; j < visibleManualShifts.length; j++) {
        totalMin += shiftMinutesInRange(visibleManualShifts[j], bounds.start, bounds.end);
        nightMin += shiftNightMinutesInRange(visibleManualShifts[j], bounds.start, bounds.end);
        holidayMin += shiftHolidayMinutesInRange(visibleManualShifts[j], bounds.start, bounds.end);
      }
      var salaryMonthKey = currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
      var salaryNormFromTableHours = WORK_NORMS[salaryMonthKey];
      var salaryBaseNormMin = salaryNormFromTableHours !== undefined ? (salaryNormFromTableHours * 60) : 0;
      var salaryNormSnapshot = getMonthNormSnapshot(currentYear, currentMonth, salaryBaseNormMin);
      var salaryNormHours = appSettings && Number(appSettings.monthlyNormHours) > 0
        ? Number(appSettings.monthlyNormHours)
        : (salaryNormSnapshot.monthNormMin / 60);
      var monthSalarySummary = calculateSalarySummaryByMinutes(totalMin, nightMin, holidayMin, salaryNormHours, visibleManualShifts.length);
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
      var statDiffLabelEl = document.getElementById('statDiffLabel');
      var monthIncomeLabelEl = document.getElementById('dashboardMonthIncomeLabel');
      var monthIncomeValueEl = document.getElementById('dashboardMonthIncomeValue');
      if (monthIncomeLabelEl) monthIncomeLabelEl.textContent = formatMonthIncomeLabel(currentMonth);
      if (monthIncomeValueEl) {
        monthIncomeValueEl.textContent = visibleManualShifts.length > 0
          ? formatRub(monthSalarySummary.netAmount)
          : 'Пока нет записей';
      }
      try { updateDashboardSparkline(); } catch (e) {}
      setQuickMetricText('statNight', fmtMin(nightMin));
      setQuickMetricText('statHoliday', fmtMin(holidayMin));
      setQuickMetricText('statShifts', String(visibleManualShifts.length));

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
        updateDashboardGauge(totalMin, normMin, diffMin);

        if (diffMin === 0) {
          if (normSnapshot.relation > 0 && totalMin === 0) {
            diffEl.textContent = 'Месяц ещё не начался';
            if (statDiffLabelEl) statDiffLabelEl.textContent = 'Статус';
            diffEl.classList.add('remaining');
            if (dashboardCardEl) dashboardCardEl.classList.add('state-remaining');
          } else {
            diffEl.textContent = '0 ч';
            if (statDiffLabelEl) statDiffLabelEl.textContent = 'Норма выполнена';
            diffEl.classList.add('ok');
            if (dashboardCardEl) dashboardCardEl.classList.add('state-ok');
          }
        } else if (diffMin > 0) {
          diffEl.textContent = fmtMin(diffAbs);
          if (statDiffLabelEl) statDiffLabelEl.textContent = 'Переработка';
          diffEl.classList.add('overtime');
          if (dashboardCardEl) dashboardCardEl.classList.add('state-overtime');
        } else {
          diffEl.textContent = fmtMin(diffAbs);
          if (statDiffLabelEl) statDiffLabelEl.textContent = 'Осталось';
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
        updateDashboardGauge(totalMin, 0, 0);
      }

      renderShiftList(
        document.getElementById('homeShiftsList'),
        document.getElementById('homeShiftsHeader'),
        visibleManualShifts.slice(0, 2),
        false,
        'Пока здесь пусто. Добавь первую смену вручную, и последняя запись появится здесь.',
        'Смены',
        _renderPendingMap,
        shiftIncomeMap,
        bounds,
        shiftDurationLevelMap
      );

      renderShiftList(
        document.getElementById('shiftsList'),
        document.getElementById('shiftsHeader'),
        visibleManualShifts,
        false,
        'Пока здесь пусто. Добавь первую смену вручную, и журнал появится здесь.',
        'Журнал смен',
        _renderPendingMap,
        shiftIncomeMap,
        bounds,
        shiftDurationLevelMap
      );

      renderInstallPromptCard();
      renderDocumentationScreen();

      var homeCalendarDayOverlayEl = document.getElementById('overlayHomeCalendarDay');
      if (homeCalendarDayOverlayEl && homeCalendarDayOverlayEl.classList.contains('is-open') && selectedHomeCalendarDateKey) {
        renderHomeCalendarDaySheet(selectedHomeCalendarDateKey, { skipBind: false });
      }

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

    function clearJournalFocusHighlight() {
      journalFocusShiftId = null;
      if (journalFocusTimer) {
        clearTimeout(journalFocusTimer);
        journalFocusTimer = null;
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
      return formatFuelKgSignedValue(totals.consumptionKg) + ' кг';
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
      // The trip/depot chooser is hidden in the current UI, which left the
      // "Маршрут" section expanding to an empty body. When the chooser is not
      // shown the route is a simple from→to, so the station fields are always
      // visible; the trip-only gating only applies when the chooser is present.
      var chooser = document.getElementById('routeTypeSegmented');
      var chooserVisible = chooser && !chooser.classList.contains('hidden');
      routeFields.classList.toggle('hidden', chooserVisible && getRouteType() !== 'trip');
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
      if (id === 'inputLocoSeries') {
        syncLocoSeriesTrigger();
        // Notify listeners (fuel A/Б/В gating) since a programmatic value set
        // (e.g. populating the edit form) doesn't fire 'change' on its own.
        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    function updateSelectPlaceholderState(elOrId) {
      var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
      if (!el || el.tagName !== 'SELECT') return;
      el.classList.toggle('is-placeholder', !el.value);
    }

    var LOCO_SERIES_MENU_OPEN = false;
    var CUSTOM_LOCO_SERIES_VALUE = '__custom__';

    function inferLocoSections(series, fallback) {
      var value = String(series || '').trim().toUpperCase();
      if (value.charAt(0) === '3') return '3';
      if (value.charAt(0) === '2') return '2';
      return ['1', '2', '3'].indexOf(String(fallback || '')) >= 0 ? String(fallback) : '1';
    }

    function setCustomLocoSections(value) {
      value = ['1', '2', '3'].indexOf(String(value || '')) >= 0 ? String(value) : '1';
      var segmented = document.getElementById('locoSectionsSegmented');
      if (segmented) segmented.setAttribute('data-selected-sections', value);
      var buttons = document.querySelectorAll('[data-loco-sections]');
      for (var i = 0; i < buttons.length; i++) {
        var active = buttons[i].getAttribute('data-loco-sections') === value;
        buttons[i].classList.toggle('active', active);
        buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
      }
      var form = document.getElementById('shiftFormSection');
      var select = document.getElementById('inputLocoSeries');
      if (form && select && select.value === CUSTOM_LOCO_SERIES_VALUE) form.setAttribute('data-loco-sections', value);
    }

    function syncCustomLocoFields() {
      var select = document.getElementById('inputLocoSeries');
      var fields = document.getElementById('locoCustomFields');
      var manual = !!select && select.value === CUSTOM_LOCO_SERIES_VALUE;
      if (fields) fields.classList.toggle('hidden', !manual);
      var segmented = document.getElementById('locoSectionsSegmented');
      if (manual) setCustomLocoSections(segmented && segmented.getAttribute('data-selected-sections') || '1');
    }

    function getLocoSeriesMenuEls() {
      return {
        selectEl: document.getElementById('inputLocoSeries'),
        valueEl: document.getElementById('locoSeriesValue'),
        triggerEl: document.getElementById('locoSeriesTrigger'),
        menuEl: document.getElementById('locoSeriesMenu'),
        rootEl: document.getElementById('locoSeriesSelect')
      };
    }

    function syncLocoSeriesTrigger() {
      var els = getLocoSeriesMenuEls();
      var selectEl = els.selectEl;
      var valueEl = els.valueEl;
      var triggerEl = els.triggerEl;
      var menuEl = els.menuEl;
      if (!selectEl) return;
      updateSelectPlaceholderState(selectEl);
      var selected = selectEl.options[selectEl.selectedIndex];
      var hasValue = !!selectEl.value;
      if (valueEl) {
        valueEl.textContent = hasValue && selected ? selected.textContent : 'Выберите серию';
        valueEl.classList.toggle('is-placeholder', !hasValue);
      }
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
      var usageScope = els.rootEl && els.rootEl.getAttribute('data-usage-scope') || '';
      var frequentValues = [];
      // Walk top-level children so we preserve <optgroup> headings.
      function emitOption(opt) {
        if (!opt || !opt.value || opt.hidden) return '';
        return '<button type="button" class="glass-select-option" role="option" aria-selected="false" data-value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.textContent) + '</button>';
      }
      if (usageScope && window.LocomotiveUsage) {
        var candidates = [];
        for (var c = 0; c < selectEl.options.length; c++) {
          var candidate = selectEl.options[c];
          var candidateGroup = candidate.parentElement && candidate.parentElement.tagName === 'OPTGROUP' ? candidate.parentElement : null;
          candidates.push({
            value: candidate.value,
            key: candidate.getAttribute('data-usage-key') || candidate.value,
            exclude: candidate.hidden || candidate.disabled || candidate.hasAttribute('data-usage-exclude') || !!(candidateGroup && candidateGroup.hidden)
          });
        }
        frequentValues = window.LocomotiveUsage.top(usageScope, candidates, 4);
        if (frequentValues.length) {
          html += '<div class="glass-select-group" role="presentation">Часто выбираете</div>';
          for (var f = 0; f < frequentValues.length; f++) {
            for (var o = 0; o < selectEl.options.length; o++) {
              if (selectEl.options[o].value === frequentValues[f]) {
                html += emitOption(selectEl.options[o]);
                break;
              }
            }
          }
        }
      }
      var children = selectEl.children;
      for (var i = 0; i < children.length; i++) {
        var node = children[i];
        var tag = (node.tagName || '').toUpperCase();
        if (tag === 'OPTGROUP') {
          if (node.hidden) continue;
          var groupHtml = '';
          for (var j = 0; j < node.children.length; j++) {
            groupHtml += emitOption(node.children[j]);
          }
          if (groupHtml) html += '<div class="glass-select-group" role="presentation">' + escapeHtml(node.label || '') + '</div>' + groupHtml;
        } else if (tag === 'OPTION') {
          html += emitOption(node);
        }
      }
      if (!html) {
        for (var k = 0; k < selectEl.options.length; k++) html += emitOption(selectEl.options[k]);
      }
      menuEl.innerHTML = html;
      syncLocoSeriesTrigger();
    }

    function openLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      if (!els.menuEl || !els.triggerEl) return;
      LOCO_SERIES_MENU_OPEN = true;
      els.menuEl.classList.remove('hidden');
      els.triggerEl.classList.add('is-open');
      els.triggerEl.setAttribute('aria-expanded', 'true');
      if (els.rootEl) {
        els.rootEl.classList.add('is-open');
        var card = els.rootEl.closest ? els.rootEl.closest('.optional-card') : null;
        if (card) card.classList.add('has-open-select');
      }
    }

    function closeLocoSeriesMenu() {
      var els = getLocoSeriesMenuEls();
      LOCO_SERIES_MENU_OPEN = false;
      if (els.menuEl) els.menuEl.classList.add('hidden');
      if (els.triggerEl) {
        els.triggerEl.classList.remove('is-open');
        els.triggerEl.setAttribute('aria-expanded', 'false');
      }
      if (els.rootEl) {
        els.rootEl.classList.remove('is-open');
        var card = els.rootEl.closest ? els.rootEl.closest('.optional-card') : null;
        if (card) card.classList.remove('has-open-select');
      }
    }

    function toggleLocoSeriesMenu() {
      if (LOCO_SERIES_MENU_OPEN) closeLocoSeriesMenu();
      else openLocoSeriesMenu();
    }

    function setLocoSeriesValue(value) {
      var selectEl = document.getElementById('inputLocoSeries');
      if (!selectEl) return;
      selectEl.value = String(value || '');
      var selected = selectEl.options[selectEl.selectedIndex];
      var root = document.getElementById('locoSeriesSelect');
      var usageScope = root && root.getAttribute('data-usage-scope') || '';
      if (selected && usageScope && window.LocomotiveUsage && !selected.hasAttribute('data-usage-exclude')) {
        window.LocomotiveUsage.record(usageScope, selected.getAttribute('data-usage-key') || selected.value);
      }
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      syncCustomLocoFields();
      buildLocoSeriesMenu();
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
      var routeFrom = getFieldValue('inputRouteFrom');
      var routeTo = getFieldValue('inputRouteTo');
      var routeChooser = document.getElementById('routeTypeSegmented');
      var routeChooserVisible = routeChooser && !routeChooser.classList.contains('hidden');
      // The trip/depot switch is currently hidden, while the station inputs stay
      // visible. Treat any entered endpoint as a trip so the visible values are
      // not silently discarded when the shift is saved.
      var routeKind = routeChooserVisible
        ? (getRouteType() === 'trip' ? 'trip' : 'depot')
        : (routeFrom || routeTo ? 'trip' : 'depot');
      var receiveCoeffA = normalizeFuelCoeff(getFieldValue('inputFuelReceiveCoeffA'), DEFAULT_FUEL_COEFF);
      var receiveCoeffB = normalizeFuelCoeff(getFieldValue('inputFuelReceiveCoeffB'), receiveCoeffA);
      var receiveCoeffV = normalizeFuelCoeff(getFieldValue('inputFuelReceiveCoeffV'), receiveCoeffA);
      var handoverCoeffA = normalizeFuelCoeff(getFieldValue('inputFuelHandoverCoeffA'), DEFAULT_FUEL_COEFF);
      var handoverCoeffB = normalizeFuelCoeff(getFieldValue('inputFuelHandoverCoeffB'), handoverCoeffA);
      var handoverCoeffV = normalizeFuelCoeff(getFieldValue('inputFuelHandoverCoeffV'), handoverCoeffA);
      var selectedLocoSeries = getFieldValue('inputLocoSeries');
      var manualLocoSeries = selectedLocoSeries === CUSTOM_LOCO_SERIES_VALUE;
      var locomotiveSeries = manualLocoSeries ? getFieldValue('inputLocoCustomSeries').trim() : selectedLocoSeries;
      var locoSectionsSegmented = document.getElementById('locoSectionsSegmented');
      var locomotiveSections = manualLocoSeries
        ? inferLocoSections('', locoSectionsSegmented && locoSectionsSegmented.getAttribute('data-selected-sections'))
        : inferLocoSections(locomotiveSeries, '1');
      return {
        locomotive_series: locomotiveSeries,
        locomotive_sections: locomotiveSeries ? locomotiveSections : '',
        locomotive_number: cleanDigits(getFieldValue('inputLocoNumber'), 4),
        train_number: cleanDigits(getFieldValue('inputTrainNumber'), 4),
        train_weight: cleanDigits(getFieldValue('inputTrainWeight'), 4),
        train_axles: cleanDigits(getFieldValue('inputTrainAxles'), 3),
        train_length: cleanDigits(getFieldValue('inputTrainLength'), 3),
        notes: getFieldValue('inputShiftNotes').trim(),
        route_kind: routeKind,
        route_from: routeKind === 'trip' ? routeFrom : '',
        route_to: routeKind === 'trip' ? routeTo : '',
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
      var savedLocoSeries = String(shift.locomotive_series || '');
      if (savedLocoSeries === '2ТЭ25КМ') savedLocoSeries = '2ТЭ25';
      var locoSelect = document.getElementById('inputLocoSeries');
      var knownLocoSeries = false;
      if (locoSelect && savedLocoSeries) {
        for (var i = 0; i < locoSelect.options.length; i++) {
          if (locoSelect.options[i].value === savedLocoSeries) {
            knownLocoSeries = true;
            break;
          }
        }
      }
      setFieldValue('inputLocoCustomSeries', savedLocoSeries && !knownLocoSeries ? savedLocoSeries : '');
      setCustomLocoSections(shift.locomotive_sections || inferLocoSections(savedLocoSeries, '1'));
      setFieldValue('inputLocoSeries', savedLocoSeries && !knownLocoSeries ? CUSTOM_LOCO_SERIES_VALUE : savedLocoSeries);
      syncCustomLocoFields();
      setFieldValue('inputLocoNumber', shift.locomotive_number || '');
      setFieldValue('inputTrainNumber', shift.train_number || '');
      setFieldValue('inputTrainWeight', shift.train_weight || '');
      setFieldValue('inputTrainAxles', shift.train_axles || '');
      setFieldValue('inputTrainLength', shift.train_length || '');
      setFieldValue('inputShiftNotes', shift.notes || '');
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
      setOptionalCardOpen('optionalNotesCard', !!shift.notes);
      setOptionalCardOpen('optionalRouteCard', !!(shift.route_kind === 'trip' || shift.route_from || shift.route_to));
      setOptionalCardOpen('optionalFuelCard', hasFuelData(shift));
      updateFuelKgOutputs();
      renderDraftShiftSummary();
    }

    function clearOptionalShiftData() {
      applyOptionalShiftData({
        locomotive_series: '',
        locomotive_sections: '',
        locomotive_number: '',
        train_number: '',
        train_weight: '',
        train_axles: '',
        train_length: '',
        notes: '',
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
      if (shift.route_kind === 'trip' && from && to) {
        return from + ' → ' + to;
      }
      if (shift.route_kind === 'trip' && (from || to)) {
        return from || to;
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
        '<button class="shift-actions-item is-edit" type="button" data-action="edit" data-id="' + safeShiftId + '" role="menuitem">' +
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
      var host = hostElArg || triggerEl.closest('#homeScheduleUpcoming, #homeShiftsList, #shiftsList');
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

