if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('poekhali-backup', 'v399');

(function(global) {
  'use strict';

  function createPoekhaliBackup(deps) {
    deps = deps || {};
    var state = deps.state;
    var config = deps.config || {};
    if (!state) throw new Error('Poekhali backup state is required');

    function getLearningBackupCounts(store) {
      var learning = deps.normalizeLearningStore(store || state.learning);
      var maps = Object.keys(learning.maps || {});
      var samples = 0;
      var rawSamples = 0;
      var userSections = 0;
      for (var i = 0; i < maps.length; i++) {
        var map = learning.maps[maps[i]] || {};
        var sectors = map.sectors || {};
        Object.keys(sectors).forEach(function(key) {
          var bucket = sectors[key];
          samples += bucket && Array.isArray(bucket.samples) ? bucket.samples.length : 0;
        });
        var rawTracks = map.rawTracks || {};
        Object.keys(rawTracks).forEach(function(key) {
          var raw = rawTracks[key];
          rawSamples += raw && Array.isArray(raw.samples) ? raw.samples.length : 0;
        });
        userSections += Object.keys(map.userSections || {}).length;
      }
      return { maps: maps.length, samples: samples, rawSamples: rawSamples, userSections: userSections };
    }

    function getBackupStats() {
      var learning = getLearningBackupCounts(state.learning);
      return {
        warnings: deps.normalizeWarningsList(state.warnings).filter(function(item) { return !item.deletedAt; }).length,
        runs: 0,
        learningSamples: learning.samples + learning.rawSamples,
        userSections: learning.userSections
      };
    }

    function cloneForBackup(value) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_) {
        return null;
      }
    }

    function buildBackupPackage() {
      deps.ensureDownloadedMapsReadiness();
      var packageData = {
        schema: 'bloknot.poekhali.backup',
        schemaVersion: config.backupSchemaVersion,
        appVersion: config.diagnosticVersion,
        exportedAt: new Date().toISOString(),
        currentMap: state.currentMap ? {
          id: state.currentMap.id || '',
          title: state.currentMap.title || '',
          sourceName: state.currentMap.sourceName || ''
        } : null,
        selectedShiftId: deps.readStringStorage(config.selectedShiftStorageKey),
        lastProjection: deps.readJsonStorage(config.lastProjectionStorageKey, null),
        previewProjection: deps.readJsonStorage(config.previewProjectionStorageKey, null),
        diagnostics: deps.getDiagnosticsSnapshot(),
        prodAudit: cloneForBackup(deps.getProdAuditState()),
        speedDocReview: cloneForBackup(deps.getSpeedDocReviewState()),
        warnings: deps.normalizeWarningsList(state.warnings),
        learning: deps.normalizeLearningStore(state.learning),
        mapReadiness: cloneForBackup(deps.getMapReadinessSummary()),
        downloadedMaps: cloneForBackup(deps.getDownloadedMapsReadinessSnapshot()),
        catalog: cloneForBackup(deps.getMapCatalogSnapshot())
      };
      var learningCounts = getLearningBackupCounts(packageData.learning);
      packageData.stats = {
        warnings: packageData.warnings.filter(function(item) { return !item.deletedAt; }).length,
        learning: learningCounts,
        userSections: learningCounts.userSections
      };
      return packageData;
    }

    function buildGpsCapturePackage() {
      deps.ensureLearningOwnerScope();
      deps.flushLocalLearningSave();
      var learning = deps.normalizeLearningStore(state.learning);
      var captures = [];
      Object.keys(learning.maps || {}).forEach(function(mapId) {
        var map = learning.maps[mapId] || {};
        Object.keys(map.rawTracks || {}).forEach(function(trackKey) {
          var bucket = map.rawTracks[trackKey];
          if (!bucket || bucket.purpose !== 'field_geometry_capture' || !Array.isArray(bucket.samples) || !bucket.samples.length) return;
          captures.push({
            captureId: trackKey,
            mapId: mapId,
            mapTitle: bucket.mapTitle || '',
            routeFrom: bucket.routeFrom || '',
            routeTo: bucket.routeTo || '',
            trainNumber: bucket.trainNumber || '',
            startedAt: bucket.startedAt || 0,
            endedAt: bucket.endedAt || 0,
            status: bucket.status || 'completed',
            samples: bucket.samples.map(function(sample) {
              return {
                lat: sample.lat,
                lon: sample.lon,
                altitude: sample.altitude,
                accuracy: sample.accuracy,
                speed: sample.speed,
                heading: sample.heading,
                segmentId: sample.segmentId,
                ts: sample.ts,
                nearestSector: sample.nearestSector,
                nearestCoordinate: sample.nearestCoordinate,
                nearestPathId: sample.nearestPathId || '',
                distance: sample.distance
              };
            })
          });
        });
      });
      captures.sort(function(a, b) { return (a.startedAt || 0) - (b.startedAt || 0); });
      return {
        schema: 'bloknot.poekhali.gps-captures',
        schemaVersion: 1,
        appVersion: config.diagnosticVersion,
        exportedAt: new Date().toISOString(),
        localOnly: true,
        captureRules: cloneForBackup(config.captureRules),
        captures: captures
      };
    }

    function downloadJsonFile(fileName, payload) {
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      var objectUrl = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function() { URL.revokeObjectURL(objectUrl); }, 1000);
    }

    function refreshVisiblePanel() {
      if (state.opsSheet && state.opsSheet.root && !state.opsSheet.root.classList.contains('hidden')) {
        deps.renderOpsSheet();
      }
    }

    function exportGpsCaptures() {
      var payload = buildGpsCapturePackage();
      if (!payload.captures.length) {
        state.backupMessage = 'Пока нет записанных GPS-путей с заполненным маршрутом смены.';
        state.backupMessageTone = 'warning';
        refreshVisiblePanel();
        return false;
      }
      var stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJsonFile('poekhali-gps-captures-' + stamp + '.json', payload);
      state.backupMessage = 'GPS-пути сохранены отдельным JSON: ' + payload.captures.length + '.';
      state.backupMessageTone = 'success';
      refreshVisiblePanel();
      return true;
    }

    function exportBackupPackage() {
      var payload = buildBackupPackage();
      var stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJsonFile('poekhali-diagnostic-' + stamp + '.json', payload);
      var stats = getBackupStats();
      state.backupMessage = 'Пакет собран: ПР ' + stats.warnings + ' · GPS точек ' + stats.learningSamples + ' · GPS участков ' + stats.userSections + '.';
      state.backupMessageTone = 'success';
      deps.renderOpsSheet();
    }

    function mergeProdAuditStates(baseRaw, incomingRaw) {
      var base = deps.normalizeProdAuditState(baseRaw);
      var incoming = deps.normalizeProdAuditState(incomingRaw);
      (config.prodAuditChecks || []).forEach(function(check) {
        var key = check.id;
        var baseItem = base.checks[key] || { status: 'pending', updatedAt: 0 };
        var incomingItem = incoming.checks[key] || { status: 'pending', updatedAt: 0 };
        if ((incomingItem.updatedAt || 0) >= (baseItem.updatedAt || 0) && incomingItem.status !== 'pending') {
          base.checks[key] = incomingItem;
        }
      });
      base.updatedAt = Math.max(Number(base.updatedAt) || 0, Number(incoming.updatedAt) || 0);
      return deps.normalizeProdAuditState(base);
    }

    function mergeSpeedDocReviewStates(baseRaw, incomingRaw) {
      var base = deps.normalizeSpeedDocReviewState(baseRaw);
      var incoming = deps.normalizeSpeedDocReviewState(incomingRaw);
      Object.keys(incoming.items || {}).forEach(function(key) {
        var current = base.items[key];
        var next = incoming.items[key];
        if (!current || (next.updatedAt || 0) >= (current.updatedAt || 0)) base.items[key] = next;
      });
      base.updatedAt = Math.max(Number(base.updatedAt) || 0, Number(incoming.updatedAt) || 0);
      return deps.normalizeSpeedDocReviewState(base);
    }

    function normalizeBackupPayload(raw) {
      var payload = raw && typeof raw === 'object' ? raw : {};
      if (payload.poekhali && typeof payload.poekhali === 'object') payload = payload.poekhali;
      if (payload.data && payload.data.schema === 'bloknot.poekhali.backup') payload = payload.data;
      if (payload.schema && payload.schema !== 'bloknot.poekhali.backup') return null;
      return payload;
    }

    function applyBackupPackage(raw) {
      var payload = normalizeBackupPayload(raw);
      if (!payload) throw new Error('Это не пакет Поехали.');
      var importedWarnings = deps.normalizeWarningsList(payload.warnings);
      var importedLearning = deps.normalizeLearningStore(payload.learning);
      var learningCounts = getLearningBackupCounts(importedLearning);

      if (importedWarnings.length) {
        state.warnings = deps.mergeWarningsLists(state.warnings, importedWarnings);
        deps.saveWarnings();
      }
      if (learningCounts.samples || learningCounts.rawSamples || learningCounts.userSections) {
        state.learning = deps.mergeLearningStores(state.learning, importedLearning);
        deps.saveLearningStore();
        deps.renderAfterLearningSyncChange();
      }
      if (payload.prodAudit) {
        state.prodAudit = mergeProdAuditStates(deps.getProdAuditState(), payload.prodAudit);
        deps.saveProdAuditState();
      }
      if (payload.speedDocReview) {
        state.speedDocReview = mergeSpeedDocReviewStates(deps.getSpeedDocReviewState(), payload.speedDocReview);
        deps.saveSpeedDocReviewState();
      }

      state.backupMessage = 'Импортировано: ПР ' + importedWarnings.length +
        ' · GPS точек ' + (learningCounts.samples + learningCounts.rawSamples) + ' · GPS участков ' + learningCounts.userSections + '.';
      state.backupMessageTone = 'success';
      deps.renderOpsSheet();
      deps.requestDraw();
    }

    function readTextFile(file) {
      if (file && typeof file.text === 'function') return file.text();
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { reject(reader.error || new Error('Файл не прочитан')); };
        reader.readAsText(file);
      });
    }

    function importBackupFile(file) {
      if (!file) return;
      readTextFile(file).then(function(text) {
        applyBackupPackage(JSON.parse(text));
      }).catch(function(error) {
        state.backupMessage = 'Импорт не выполнен: ' + (error && error.message ? error.message : 'ошибка файла');
        state.backupMessageTone = 'danger';
        deps.renderOpsSheet();
      });
    }

    function renderBackupSection(parent) {
      var stats = getBackupStats();
      var section = document.createElement('section');
      section.className = 'poekhali-ops-section';
      var head = document.createElement('div');
      head.className = 'poekhali-ops-section-head';
      var title = document.createElement('div');
      title.textContent = 'Резерв и диагностика';
      var total = document.createElement('div');
      total.className = 'poekhali-ops-total';
      total.textContent = 'JSON';
      head.appendChild(title);
      head.appendChild(total);

      var grid = document.createElement('div');
      grid.className = 'poekhali-shift-info-grid';
      grid.appendChild(deps.createShiftInfoCell('ПР', String(stats.warnings), stats.warnings ? 'success' : 'muted'));
      grid.appendChild(deps.createShiftInfoCell('Поездки', String(stats.runs), stats.runs ? 'success' : 'muted'));
      grid.appendChild(deps.createShiftInfoCell('GPS точки', String(stats.learningSamples), stats.learningSamples ? 'success' : 'muted'));
      grid.appendChild(deps.createShiftInfoCell('GPS участки', String(stats.userSections), stats.userSections ? 'success' : 'muted'));

      var note = document.createElement('div');
      note.className = 'poekhali-shift-route ' + (state.backupMessageTone ? 'is-' + state.backupMessageTone : 'is-muted');
      note.textContent = state.backupMessage || 'Пакет сохраняет предупреждения, GPS-дообучение, ручную приемку, сверку ДОК и диагностику режима. Внешний источник карт не нужен.';

      var actions = document.createElement('div');
      actions.className = 'poekhali-warning-form-actions poekhali-backup-actions';
      var exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.className = 'poekhali-primary-action';
      exportBtn.textContent = 'Скачать пакет';
      exportBtn.addEventListener('click', exportBackupPackage);
      var gpsExportBtn = document.createElement('button');
      gpsExportBtn.type = 'button';
      gpsExportBtn.className = 'poekhali-secondary-action';
      gpsExportBtn.textContent = 'Скачать GPS пути';
      gpsExportBtn.addEventListener('click', exportGpsCaptures);
      var importFileInput = document.createElement('input');
      importFileInput.type = 'file';
      importFileInput.accept = '.json,application/json';
      importFileInput.className = 'poekhali-warning-file-input';
      importFileInput.addEventListener('change', function() {
        var file = importFileInput.files && importFileInput.files[0] ? importFileInput.files[0] : null;
        importFileInput.value = '';
        importBackupFile(file);
      });
      var importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.className = 'poekhali-secondary-action';
      importBtn.textContent = 'Импорт пакета';
      importBtn.addEventListener('click', function() { importFileInput.click(); });
      actions.appendChild(exportBtn);
      actions.appendChild(gpsExportBtn);
      actions.appendChild(importBtn);
      actions.appendChild(importFileInput);
      section.appendChild(head);
      section.appendChild(grid);
      section.appendChild(note);
      section.appendChild(actions);
      parent.appendChild(section);
    }

    return {
      getLearningBackupCounts: getLearningBackupCounts,
      getBackupStats: getBackupStats,
      buildBackupPackage: buildBackupPackage,
      buildGpsCapturePackage: buildGpsCapturePackage,
      exportGpsCaptures: exportGpsCaptures,
      exportBackupPackage: exportBackupPackage,
      applyBackupPackage: applyBackupPackage,
      importBackupFile: importBackupFile,
      renderBackupSection: renderBackupSection
    };
  }

  global.createPoekhaliBackup = createPoekhaliBackup;
})(window);
