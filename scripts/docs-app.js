    // ── Documentation Section ────────────────────────────────────────────────
    // Renders the active docs sub-tab. Called whenever the instructions/docs
    // tab is activated or a sub-tab button is pressed.

    // Cache loaded files per folder so switching tabs doesn't re-fetch every time
    var docsFilesCache = {};
    var docsDownloadStateByPath = {};
    var docsDownloadCheckPromises = {};
    var docsDownloadRefreshTick = 0;

    function getDocPathKey(path) {
      return normalizeDocPath(path || '');
    }

    function markDocAsDownloaded(path) {
      var key = getDocPathKey(path);
      if (!key) return;
      if (docsDownloadStateByPath[key]) return;
      docsDownloadStateByPath[key] = true;

      var activeFiles = docsFilesCache[documentationStore.activeTab];
      if (activeFiles && activeFiles.length) {
        renderDocFileList(documentationStore.activeTab, activeFiles);
      }
    }

    function buildDocCacheLookupCandidates(pathKey) {
      var map = {};

      function addCandidate(value) {
        var key = value && String(value).trim();
        if (!key) return;
        if (map[key]) return;
        map[key] = true;
      }

      addCandidate(pathKey);
      try {
        addCandidate(new URL(pathKey, window.location.origin).toString());
      } catch (e) {}

      try {
        addCandidate(decodeURI(pathKey));
      } catch (e) {}

      return Object.keys(map);
    }

    function resolveDocDownloadedFromCache(pathKey) {
      if (!pathKey) return Promise.resolve(false);
      if (!('caches' in window)) return Promise.resolve(false);

      var lookupCandidates = buildDocCacheLookupCandidates(pathKey);
      if (!lookupCandidates.length) return Promise.resolve(false);

      return Promise.all(
        lookupCandidates.map(function(candidate) {
          return caches.match(candidate, { ignoreSearch: true })
            .then(function(match) { return !!match; })
            .catch(function() { return false; });
        })
      ).then(function(matches) {
        for (var i = 0; i < matches.length; i++) {
          if (matches[i]) return true;
        }
        return false;
      });
    }

    function checkDocDownloaded(path) {
      var pathKey = getDocPathKey(path);
      if (!pathKey) return Promise.resolve(false);
      if (docsDownloadStateByPath[pathKey] === true) {
        return Promise.resolve(true);
      }
      if (docsDownloadCheckPromises[pathKey]) {
        return docsDownloadCheckPromises[pathKey];
      }

      var checkPromise = resolveDocDownloadedFromCache(pathKey)
        .then(function(isDownloaded) {
          docsDownloadStateByPath[pathKey] = !!isDownloaded;
          delete docsDownloadCheckPromises[pathKey];
          return !!isDownloaded;
        })
        .catch(function() {
          delete docsDownloadCheckPromises[pathKey];
          return !!docsDownloadStateByPath[pathKey];
        });

      docsDownloadCheckPromises[pathKey] = checkPromise;
      return checkPromise;
    }

    function refreshDocDownloadStateForFolder(folder, files) {
      if (!files || !files.length) return;

      var checks = [];
      for (var i = 0; i < files.length; i++) {
        checks.push(checkDocDownloaded(files[i] && files[i].path ? files[i].path : ''));
      }

      if (!checks.length) return;
      var tick = ++docsDownloadRefreshTick;

      Promise.all(checks).then(function() {
        if (tick !== docsDownloadRefreshTick) return;
        if (documentationStore.activeTab !== folder) return;
        var activeFiles = docsFilesCache[folder] || files;
        renderDocFileList(folder, activeFiles);
      }).catch(function() {});
    }

    function docsFolderListId(folder) {
      var map = {
        speeds: 'docsListSpeeds',
        folders: 'docsListFolders',
        instructions: 'docsListInstructions',
        memos: 'docsListMemos',
        reminders: 'docsListReminders'
      };
      return map[folder] || null;
    }

    function docsFormatSize(bytes) {
      if (!bytes) return '';
      if (bytes < 1024) return bytes + ' Б';
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
      return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    }

    function docsFormatDate(value) {
      if (!value) return '';
      var date = null;
      if (typeof value === 'number') {
        date = new Date(value);
      } else {
        var raw = String(value).trim();
        if (!raw) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          var parts = raw.split('-');
          date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          date = new Date(raw);
        }
      }
      if (!date || !isFinite(date.getTime())) return '';
      var dd = String(date.getDate()).padStart(2, '0');
      var mm = String(date.getMonth() + 1).padStart(2, '0');
      var yyyy = date.getFullYear();
      return dd + '.' + mm + '.' + yyyy;
    }

    function getFileType(filename) {
      var ext = String(filename || '').split('.').pop().toLowerCase();
      if (ext === 'pdf') return 'pdf';
      if (['doc', 'docx'].includes(ext)) return 'doc';
      if (['xls', 'xlsx'].includes(ext)) return 'xls';
      if (['jpg', 'jpeg', 'png'].includes(ext)) return 'img';
      return 'default';
    }

    var iconPdf = `
<svg width="26" height="28" viewBox="0 0 26 28" fill="none">
  <rect x="1" y="1" width="19" height="24" rx="3"
    fill="rgba(239,68,68,0.13)" stroke="rgba(239,68,68,0.32)" stroke-width="1.2"/>
  <path d="M14 1v6h6"
    stroke="rgba(239,68,68,0.5)" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  <rect x="4" y="9.5" width="13" height="2.5" rx="1.2"
    fill="rgba(239,68,68,0.28)"/>
  <path d="M5 14h10M5 17.5h7"
    stroke="#F87171" stroke-width="1.3" stroke-linecap="round"/>
  <text x="13" y="25.5" font-size="6.5" font-weight="700"
    fill="#F87171" font-family="Manrope,sans-serif" text-anchor="middle">PDF</text>
</svg>`;

    var iconDoc = `
<svg width="26" height="28" viewBox="0 0 26 28" fill="none">
  <rect x="1" y="1" width="19" height="24" rx="3"
    fill="rgba(56,189,248,0.10)" stroke="rgba(56,189,248,0.24)" stroke-width="1.2"/>
  <path d="M14 1v6h6"
    stroke="rgba(56,189,248,0.4)" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  <path d="M5 11h11M5 14.5h11M5 18h7"
    stroke="#38BDF8" stroke-width="1.3" stroke-linecap="round"/>
  <text x="13" y="25.5" font-size="6" font-weight="700"
    fill="#38BDF8" font-family="Manrope,sans-serif" text-anchor="middle">DOC</text>
</svg>`;

    var iconXls = `
<svg width="26" height="28" viewBox="0 0 26 28" fill="none">
  <rect x="1" y="1" width="19" height="24" rx="3"
    fill="rgba(74,222,128,0.10)" stroke="rgba(74,222,128,0.22)" stroke-width="1.2"/>
  <path d="M14 1v6h6"
    stroke="rgba(74,222,128,0.4)" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  <rect x="4.5" y="9.5" width="12" height="10" rx="1"
    stroke="rgba(74,222,128,0.28)" stroke-width="1" fill="none"/>
  <path d="M4.5 13h12M4.5 16.5h12M9.5 9.5v10"
    stroke="rgba(74,222,128,0.38)" stroke-width="0.9"/>
  <text x="13" y="25.5" font-size="6" font-weight="700"
    fill="#4ADE80" font-family="Manrope,sans-serif" text-anchor="middle">XLS</text>
</svg>`;

    var iconImg = `
<svg width="26" height="28" viewBox="0 0 26 28" fill="none">
  <rect x="1" y="1" width="19" height="24" rx="3"
    fill="rgba(167,139,250,0.10)" stroke="rgba(167,139,250,0.24)" stroke-width="1.2"/>
  <path d="M14 1v6h6"
    stroke="rgba(167,139,250,0.4)" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  <rect x="4.5" y="9.5" width="12" height="9" rx="1.5"
    stroke="rgba(167,139,250,0.3)" stroke-width="1" fill="none"/>
  <path d="M4.5 15.5l3-2.5 3 3 2-1.5 3.5 3"
    stroke="#A78BFA" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="8.5" cy="12" r="1.2" fill="rgba(167,139,250,0.5)"/>
  <text x="13" y="25.5" font-size="6" font-weight="700"
    fill="#A78BFA" font-family="Manrope,sans-serif" text-anchor="middle">IMG</text>
</svg>`;

    var iconDefault = `
<svg width="26" height="28" viewBox="0 0 26 28" fill="none">
  <rect x="1" y="1" width="19" height="24" rx="3"
    fill="rgba(136,146,164,0.08)" stroke="rgba(136,146,164,0.20)" stroke-width="1.2"/>
  <path d="M14 1v6h6"
    stroke="rgba(136,146,164,0.35)" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  <path d="M5 12h10M5 15.5h10M5 19h6"
    stroke="#8892A4" stroke-width="1.3" stroke-linecap="round"/>
</svg>`;

    var icons = { pdf: iconPdf, doc: iconDoc, xls: iconXls, img: iconImg, default: iconDefault };
    var classes = { pdf: 'icon-pdf', doc: 'icon-doc', xls: 'icon-xls', img: 'icon-img', default: 'icon-default' };
    var badges = { pdf: 'badge-pdf', doc: 'badge-doc', xls: 'badge-xls', img: 'badge-img', default: 'badge-default' };
    var docDownloadedIcon = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 8.2l2 2.1L11.2 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var docOnlineOnlyIcon = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.3 10.7a2.3 2.3 0 0 1 .2-4.6 3.6 3.6 0 0 1 6.8 1.2 2.1 2.1 0 0 1 .2 4.2H4.3z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 5.2v3.4M8 8.6l1.4-1.4M8 8.6L6.6 7.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function buildDocDownloadStatusIcon(isDownloaded) {
      var label = isDownloaded ? 'Файл скачан и доступен оффлайн' : 'Файл не скачан, нужен интернет';
      return '<span class="docs-download-icon ' + (isDownloaded ? 'is-downloaded' : 'is-online-only') + '" role="img" aria-label="' + label + '" title="' + (isDownloaded ? 'Скачан' : 'Не скачан') + '">' + (isDownloaded ? docDownloadedIcon : docOnlineOnlyIcon) + '</span>';
    }

    function renderDocFileList(folder, files) {
      var listId = docsFolderListId(folder);
      if (!listId) return;
      var el = document.getElementById(listId);
      if (!el) return;

      if (!files || files.length === 0) {
        el.innerHTML =
          '<div class="docs-empty-state">' +
            '<div class="docs-empty-icon" aria-hidden="true">' +
              '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<rect x="8" y="4" width="32" height="40" rx="4" fill="currentColor" opacity="0.15"/>' +
                '<rect x="8" y="4" width="32" height="40" rx="4" stroke="currentColor" stroke-width="2.5"/>' +
                '<path d="M16 16H32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
                '<path d="M16 24H32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
                '<path d="M16 32H24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
              '</svg>' +
            '</div>' +
            '<div class="docs-empty-title">В этом разделе пока пусто</div>' +
            '<div class="docs-empty-text">Когда сюда добавят файлы, они сразу появятся в этом списке.</div>' +
          '</div>';
        return;
      }

      var html = '<div class="docs-item-list">';
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var pathKey = getDocPathKey(f.path || '');
        var isDownloaded = !!(pathKey && docsDownloadStateByPath[pathKey]);
        var type = getFileType(f.path || f.name || '');
        var size = docsFormatSize(f.size);
        var updatedAt = docsFormatDate(f.updated_at || f.added_at || f.date_added);
        var meta = '<span class="badge ' + badges[type] + '">' + type.toUpperCase() + '</span>';
        meta += buildDocDownloadStatusIcon(isDownloaded);
        if (updatedAt) meta += '<span>обновлено ' + updatedAt + '</span>';
        if (size) meta += '<span class="file-size">' + size + '</span>';
        var docActionLabel = (isDownloaded ? 'Открыть файл' : 'Открыть файл, может понадобиться интернет') + ': ' + (f.name || 'Файл');
        html +=
          '<div class="docs-item ' + (isDownloaded ? 'is-downloaded' : 'is-online-only') + '" role="button" tabindex="0" aria-label="' + escapeHtml(docActionLabel) + '" data-file-path="' + encodeURIComponent(f.path || '') + '" data-file-name="' + encodeURIComponent(f.name || '') + '" data-mime-type="' + encodeURIComponent(f.mime_type || '') + '" data-doc-downloaded="' + (isDownloaded ? '1' : '0') + '">' +
            '<div class="docs-item-icon file-icon-wrap ' + classes[type] + '">' +
              icons[type] +
            '</div>' +
            '<div class="docs-item-body">' +
              '<div class="docs-item-title">' + (f.name || 'Файл') + '</div>' +
              '<div class="docs-item-meta">' + meta + '</div>' +
            '</div>' +
            '<div class="docs-item-action" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>' +
          '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
    }

    function renderDocLoading(folder) {
      var listId = docsFolderListId(folder);
      if (!listId) return;
      var el = document.getElementById(listId);
      if (!el) return;
      el.innerHTML = '<div class="docs-loading"><div class="docs-loading-spinner"></div><span>Загружаем список файлов…</span></div>';
    }

    var _docsManifestCache = null;

    function fetchDocsManifestWithFallback() {
      if (_docsManifestCache) {
        return Promise.resolve(_docsManifestCache);
      }

      function tryRead(response) {
        if (!response || !response.ok) throw new Error('manifest unavailable');
        return response.json();
      }

      return fetch('/assets/docs/manifest.json', { cache: 'no-store' })
        .then(tryRead)
        .catch(function(networkErr) {
          if (!('caches' in window)) throw networkErr;
          return caches.match('/assets/docs/manifest.json', { ignoreSearch: true }).then(function(cachedResponse) {
            if (!cachedResponse) throw networkErr;
            return tryRead(cachedResponse);
          });
        })
        .then(function(manifest) {
          _docsManifestCache = manifest;
          return manifest;
        });
    }

    function renderDocListLoadError(folder) {
      var listId = docsFolderListId(folder);
      var el = listId ? document.getElementById(listId) : null;
      if (!el) return;
      var title = navigator.onLine === false ? 'Список пока недоступен без интернета' : 'Не удалось загрузить список файлов';
      var text = navigator.onLine === false
        ? 'Если открываете раздел впервые, подключитесь к интернету и зайдите сюда ещё раз. После этого список будет доступен и без сети.'
        : 'Связь сейчас нестабильна. Подождите немного и попробуйте открыть раздел ещё раз.';
      el.innerHTML =
        '<div class="docs-empty-state docs-empty-state-muted">' +
          '<div class="docs-empty-title">' + title + '</div>' +
          '<div class="docs-empty-text">' + text + '</div>' +
        '</div>';
    }

    function loadDocFiles(folder) {
      if (docsFilesCache[folder]) {
        renderDocFileList(folder, docsFilesCache[folder]);
        refreshDocDownloadStateForFolder(folder, docsFilesCache[folder]);
        return;
      }

      renderDocLoading(folder);

      function renderFromManifest(manifest) {
        var files = (manifest && Array.isArray(manifest[folder])) ? manifest[folder] : [];
        docsFilesCache[folder] = files;
        renderDocFileList(folder, files);
        refreshDocDownloadStateForFolder(folder, files);
      }

      fetchDocsManifestWithFallback()
        .then(function(manifest) {
          renderFromManifest(manifest);
        })
        .catch(function() {
          renderDocListLoadError(folder);
        });
    }

    // ── Viewer ────────────────────────────────────────────────────────────────

    var DOCS_PDFJS_SRC = '/assets/pdfjs/pdf.min.js';
    var DOCS_PDFJS_WORKER_SRC = '/assets/pdfjs/pdf.worker.min.js';
    var DOCS_JSZIP_SRC = '/assets/docs/vendor/jszip.min.js';
    var DOCS_PDF_MIN_SCALE = 1;
    var DOCS_PDF_MAX_SCALE = 3;
    var DOCS_PDF_DOUBLE_TAP_DELAY = 280;
    var DOCS_PDF_DOUBLE_TAP_DISTANCE = 26;
    var docsPdfJsLoadPromise = null;
    var docsZipLoadPromise = null;
    var docsPdfViewerState = null;
    var docsDocxViewerState = null;
    var docsImageViewerState = null;

    function decodeDocAttr(value) {
      if (value === undefined || value === null) return '';
      var raw = String(value);
      try {
        return decodeURIComponent(raw);
      } catch (e) {
        return raw;
      }
    }

    function normalizeDocPath(path) {
      var decoded = decodeDocAttr(path);
      if (!decoded) return '';
      try {
        return encodeURI(decoded);
      } catch (e) {
        return decoded;
      }
    }

    function setDocsViewerStatus(text) {
      var statusEl = document.getElementById('docsViewerStatus');
      if (!statusEl) return;
      var raw = String(text || '').trim();
      if (!raw) {
        statusEl.textContent = '';
        return;
      }

      var parts = raw.split('·').map(function(part) { return part.trim(); }).filter(Boolean);
      if (!parts.length) {
        statusEl.textContent = raw;
        return;
      }

      statusEl.innerHTML = parts.map(function(part) {
        return '<span class="shift-pill docs-viewer-status-pill">' + escapeHtml(part) + '</span>';
      }).join('');
    }

    function clampDocsPdfScale(scale) {
      var n = Number(scale || DOCS_PDF_MIN_SCALE);
      if (!isFinite(n)) return DOCS_PDF_MIN_SCALE;
      if (n < DOCS_PDF_MIN_SCALE) return DOCS_PDF_MIN_SCALE;
      if (n > DOCS_PDF_MAX_SCALE) return DOCS_PDF_MAX_SCALE;
      return n;
    }

    function formatDocsPdfScale(scale) {
      var rounded = Math.round(clampDocsPdfScale(scale) * 10) / 10;
      var text = rounded.toFixed(1);
      if (text.slice(-2) === '.0') return text.slice(0, -2);
      return text;
    }

    function getDocsPdfStatusText(state, scaleForStatus) {
      if (!state || !state.pageItems || !state.pageItems.length) return '';
      var page = state.currentPage || 1;
      var zoom = clampDocsPdfScale(
        typeof scaleForStatus === 'number' ? scaleForStatus : (state.zoomScale || DOCS_PDF_MIN_SCALE)
      );
      var zoomPart = zoom > 1.01 ? (' · ' + formatDocsPdfScale(zoom) + 'x') : '';
      return page + '/' + state.pageItems.length + zoomPart;
    }

    function getDocsDocxStatusText(state, scaleForStatus) {
      var zoom = clampDocsPdfScale(
        typeof scaleForStatus === 'number'
          ? scaleForStatus
          : (state && state.zoomScale ? state.zoomScale : DOCS_PDF_MIN_SCALE)
      );
      var zoomPart = zoom > 1.01 ? (' · ' + formatDocsPdfScale(zoom) + 'x') : '';
      return 'DOCX' + zoomPart;
    }

    function getDocsImageStatusText(state, scaleForStatus) {
      var zoom = clampDocsPdfScale(
        typeof scaleForStatus === 'number'
          ? scaleForStatus
          : (state && state.zoomScale ? state.zoomScale : DOCS_PDF_MIN_SCALE)
      );
      return zoom > 1.01 ? ('Изображение · ' + formatDocsPdfScale(zoom) + 'x') : 'Изображение';
    }

    function getDocsTouchPoint(scrollEl, touch) {
      if (!scrollEl || !touch) return { x: 0, y: 0 };
      var rect = scrollEl.getBoundingClientRect();
      var x = touch.clientX - rect.left;
      var y = touch.clientY - rect.top;
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x > rect.width) x = rect.width;
      if (y > rect.height) y = rect.height;
      return { x: x, y: y };
    }

    function getDocsDistance(p1, p2) {
      var dx = p1.x - p2.x;
      var dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function applyDocsPdfCommittedScale(state) {
      if (!isDocsPdfViewerActive(state) || !state.listEl) return;
      state.listEl.style.width = (clampDocsPdfScale(state.zoomScale) * 100) + '%';
    }

    function clearDocsPdfLiveTransform(state) {
      if (!isDocsPdfViewerActive(state) || !state.listEl) return;
      state.previewScale = clampDocsPdfScale(state.zoomScale);
      state.listEl.style.transform = '';
      state.listEl.style.transformOrigin = '';
      state.listEl.classList.remove('is-live-zoom');
      setDocsViewerStatus(getDocsPdfStatusText(state));
    }

    function applyDocsPdfLiveTransform(state, scale, originX, originY) {
      if (!isDocsPdfViewerActive(state) || !state.listEl || !state.scrollEl) return;
      var baseScale = clampDocsPdfScale(state.zoomScale);
      var liveScale = clampDocsPdfScale(scale);
      state.previewScale = liveScale;
      var ratio = liveScale / baseScale;
      if (Math.abs(ratio - 1) < 0.001) {
        clearDocsPdfLiveTransform(state);
        return;
      }
      var x = Math.max(0, Math.min(state.scrollEl.clientWidth, Number(originX || 0)));
      var y = Math.max(0, Math.min(state.scrollEl.clientHeight, Number(originY || 0)));
      var originContentX = state.scrollEl.scrollLeft + x;
      var originContentY = state.scrollEl.scrollTop + y;
      state.listEl.style.transformOrigin = originContentX + 'px ' + originContentY + 'px';
      state.listEl.style.transform = 'scale(' + ratio + ')';
      state.listEl.classList.add('is-live-zoom');
      setDocsViewerStatus(getDocsPdfStatusText(state, liveScale));
    }

    function commitDocsPdfScale(state, scale, originX, originY) {
      if (!isDocsPdfViewerActive(state) || !state.scrollEl || !state.listEl) return;
      var nextScale = clampDocsPdfScale(scale);
      var prevScale = clampDocsPdfScale(state.zoomScale);
      var rawX = originX;
      var rawY = originY;
      if (typeof rawX !== 'number' || !isFinite(rawX)) rawX = state.scrollEl.clientWidth / 2;
      if (typeof rawY !== 'number' || !isFinite(rawY)) rawY = state.scrollEl.clientHeight / 2;
      var anchorX = Math.max(0, Math.min(state.scrollEl.clientWidth, rawX));
      var anchorY = Math.max(0, Math.min(state.scrollEl.clientHeight, rawY));
      var contentX = (state.scrollEl.scrollLeft + anchorX) / prevScale;
      var contentY = (state.scrollEl.scrollTop + anchorY) / prevScale;

      state.zoomScale = nextScale;
      state.previewScale = nextScale;
      state.maxConcurrentRenders = (window.innerWidth <= 640 || nextScale > 1.6) ? 1 : 2;
      applyDocsPdfCommittedScale(state);
      clearDocsPdfLiveTransform(state);

      state.scrollEl.scrollLeft = Math.max(0, contentX * nextScale - anchorX);
      state.scrollEl.scrollTop = Math.max(0, contentY * nextScale - anchorY);

      if (Math.abs(nextScale - prevScale) >= 0.02) {
        scheduleDocsPdfRelayout(state);
      } else {
        updateDocsPdfProgress(state);
      }
    }

    function renderDocsViewerLoading(text, details) {
      var bodyEl = document.getElementById('docsViewerBody');
      if (!bodyEl) return;
      bodyEl.innerHTML =
        '<div class="docs-viewer-media-wrap">' +
          '<div class="docs-viewer-loading-block">' +
            '<div class="docs-viewer-loading">' +
              '<div class="docs-loading-spinner"></div>' +
              '<span>' + escapeHtml(text || 'Загрузка…') + '</span>' +
            '</div>' +
            '<div class="docs-viewer-loading-progress" aria-hidden="true"><span></span></div>' +
            (details ? '<div class="docs-viewer-loading-note">' + escapeHtml(details) + '</div>' : '') +
          '</div>' +
        '</div>';
    }

    function renderDocsViewerError(message, details) {
      var bodyEl = document.getElementById('docsViewerBody');
      if (!bodyEl) return;
      bodyEl.innerHTML =
        '<div class="docs-viewer-media-wrap">' +
          '<div class="docs-viewer-error">' +
            escapeHtml(message || 'Не удалось открыть файл') +
            (details ? '<span class="docs-viewer-error-meta">' + escapeHtml(details) + '</span>' : '') +
          '</div>' +
        '</div>';
    }

    function ensureDocsZipReady() {
      if (window.JSZip) return Promise.resolve(window.JSZip);
      if (docsZipLoadPromise) return docsZipLoadPromise;

      docsZipLoadPromise = new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = DOCS_JSZIP_SRC;
        script.async = true;
        script.onload = function() {
          if (window.JSZip) {
            resolve(window.JSZip);
          } else {
            reject(new Error('JSZip is not available'));
          }
        };
        script.onerror = function() {
          reject(new Error('Failed to load JSZip'));
        };
        document.head.appendChild(script);
      });

      return docsZipLoadPromise;
    }

    function getDocxLocalName(node) {
      if (!node) return '';
      return node.localName || String(node.nodeName || '').split(':').pop();
    }

    function getDocxAttr(node, localName) {
      if (!node || !node.attributes) return '';
      for (var i = 0; i < node.attributes.length; i++) {
        var attr = node.attributes[i];
        if (getDocxLocalName(attr) === localName) return attr.value || '';
      }
      return '';
    }

    function getDocxChild(node, localName) {
      if (!node || !node.childNodes) return null;
      for (var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        if (child.nodeType === 1 && getDocxLocalName(child) === localName) return child;
      }
      return null;
    }

    function getDocxChildren(node, localName) {
      var result = [];
      if (!node || !node.childNodes) return result;
      for (var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        if (child.nodeType === 1 && (!localName || getDocxLocalName(child) === localName)) {
          result.push(child);
        }
      }
      return result;
    }

    function getDocxTextFromNode(node) {
      var parts = [];
      if (!node || !node.getElementsByTagName) return '';
      var textNodes = node.getElementsByTagName('*');
      for (var i = 0; i < textNodes.length; i++) {
        if (getDocxLocalName(textNodes[i]) === 't' && textNodes[i].textContent) {
          parts.push(textNodes[i].textContent);
        }
      }
      return parts.join('');
    }

    function getDocxParagraphMeta(paragraph) {
      var meta = { style: '', align: '' };
      var props = getDocxChild(paragraph, 'pPr');
      if (!props) return meta;

      var pStyle = getDocxChild(props, 'pStyle');
      if (pStyle) meta.style = getDocxAttr(pStyle, 'val');

      var jc = getDocxChild(props, 'jc');
      if (jc) meta.align = getDocxAttr(jc, 'val');

      return meta;
    }

    function getDocxRunMeta(run) {
      var meta = { bold: false, italic: false, underline: false };
      var props = getDocxChild(run, 'rPr');
      if (!props) return meta;
      meta.bold = !!getDocxChild(props, 'b');
      meta.italic = !!getDocxChild(props, 'i');
      meta.underline = !!getDocxChild(props, 'u');
      return meta;
    }

    function wrapDocxRunHtml(html, meta) {
      if (!html) return '';
      var wrapped = html;
      if (meta && meta.underline) wrapped = '<span class="docs-docx-underline">' + wrapped + '</span>';
      if (meta && meta.italic) wrapped = '<em>' + wrapped + '</em>';
      if (meta && meta.bold) wrapped = '<strong>' + wrapped + '</strong>';
      return wrapped;
    }

    function renderDocxRun(run) {
      var meta = getDocxRunMeta(run);
      var html = '';
      var children = getDocxChildren(run);
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        var name = getDocxLocalName(child);
        if (name === 't') {
          html += escapeHtml(child.textContent || '');
        } else if (name === 'tab') {
          html += '<span class="docs-docx-tab"></span>';
        } else if (name === 'br' || name === 'cr') {
          html += '<br />';
        }
      }
      return wrapDocxRunHtml(html, meta);
    }

    function getDocxParagraphClass(paragraph, text) {
      var meta = getDocxParagraphMeta(paragraph);
      var classes = ['docs-docx-paragraph'];
      var style = String(meta.style || '').toLowerCase();
      var cleanText = String(text || '').trim();

      if (style.indexOf('title') !== -1 || style.indexOf('heading') !== -1) {
        classes.push('is-heading');
      }
      if (meta.align === 'center') classes.push('is-centered');
      if (meta.align === 'right' || meta.align === 'end') classes.push('is-right');
      if (/^\d+[\.\)]\s+/.test(cleanText)) classes.push('is-numbered');
      return classes.join(' ');
    }

    function renderDocxParagraph(paragraph) {
      var html = '';
      var children = getDocxChildren(paragraph);
      for (var i = 0; i < children.length; i++) {
        if (getDocxLocalName(children[i]) === 'r') {
          html += renderDocxRun(children[i]);
        }
      }

      var text = getDocxTextFromNode(paragraph);
      if (!html && !String(text || '').trim()) {
        return '<div class="docs-docx-gap" aria-hidden="true"></div>';
      }

      return '<p class="' + getDocxParagraphClass(paragraph, text) + '">' + (html || '&nbsp;') + '</p>';
    }

    function renderDocxTable(table) {
      var rows = getDocxChildren(table, 'tr');
      var html = '<div class="docs-docx-table-wrap"><table class="docs-docx-table">';
      for (var r = 0; r < rows.length; r++) {
        html += '<tr>';
        var cells = getDocxChildren(rows[r], 'tc');
        for (var c = 0; c < cells.length; c++) {
          var cellHtml = '';
          var blocks = getDocxChildren(cells[c]);
          for (var b = 0; b < blocks.length; b++) {
            if (getDocxLocalName(blocks[b]) === 'p') {
              cellHtml += renderDocxParagraph(blocks[b]);
            } else if (getDocxLocalName(blocks[b]) === 'tbl') {
              cellHtml += renderDocxTable(blocks[b]);
            }
          }
          html += '<td>' + (cellHtml || '&nbsp;') + '</td>';
        }
        html += '</tr>';
      }
      html += '</table></div>';
      return html;
    }

    function renderDocxDocumentXml(xmlText) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(xmlText, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) {
        throw new Error('DOCX XML parse failed');
      }

      var body = null;
      var allNodes = doc.getElementsByTagName('*');
      for (var i = 0; i < allNodes.length; i++) {
        if (getDocxLocalName(allNodes[i]) === 'body') {
          body = allNodes[i];
          break;
        }
      }
      if (!body) throw new Error('DOCX body not found');

      var html = '';
      var children = getDocxChildren(body);
      for (var c = 0; c < children.length; c++) {
        var name = getDocxLocalName(children[c]);
        if (name === 'p') {
          html += renderDocxParagraph(children[c]);
        } else if (name === 'tbl') {
          html += renderDocxTable(children[c]);
        }
      }

      return html || '<p class="docs-docx-paragraph">Документ пуст</p>';
    }

    function isDocsDocxViewerActive(state) {
      return !!(state && !state.destroyed && docsDocxViewerState === state);
    }

    function createDocsDocxViewerState(bodyEl) {
      return {
        destroyed: false,
        bodyEl: bodyEl,
        scrollEl: null,
        wrapEl: null,
        pageEl: null,
        zoomScale: DOCS_PDF_MIN_SCALE,
        previewScale: DOCS_PDF_MIN_SCALE,
        measured: false,
        baseWrapWidth: 0,
        baseWrapHeight: 0,
        basePageWidth: 0,
        basePageHeight: 0,
        basePageLeft: 0,
        basePageTop: 0,
        pinch: { active: false, startDistance: 0, startScale: DOCS_PDF_MIN_SCALE, originX: 0, originY: 0 },
        tapStart: null,
        lastTapAt: 0,
        lastTapX: 0,
        lastTapY: 0,
        resizeTimer: null,
        onResize: null,
        onTouchStart: null,
        onTouchMove: null,
        onTouchEnd: null,
        onTouchCancel: null
      };
    }

    function resetDocsDocxMeasureStyles(state) {
      if (!state || !state.wrapEl || !state.pageEl) return;
      state.wrapEl.style.width = '';
      state.wrapEl.style.height = '';
      state.pageEl.style.position = '';
      state.pageEl.style.left = '';
      state.pageEl.style.top = '';
      state.pageEl.style.width = '';
      state.pageEl.style.minHeight = '';
      state.pageEl.style.margin = '';
      state.pageEl.style.transform = '';
      state.pageEl.style.transformOrigin = '';
      state.pageEl.classList.remove('is-live-zoom');
    }

    function measureDocsDocxLayout(state) {
      if (!isDocsDocxViewerActive(state) || !state.scrollEl || !state.wrapEl || !state.pageEl) return;
      resetDocsDocxMeasureStyles(state);

      var wrapWidth = Math.max(1, state.wrapEl.offsetWidth || state.scrollEl.clientWidth || 1);
      var wrapHeight = Math.max(1, state.wrapEl.scrollHeight || state.scrollEl.clientHeight || 1);
      var pageWidth = Math.max(1, state.pageEl.offsetWidth || 1);
      var pageHeight = Math.max(1, state.pageEl.offsetHeight || 1);
      var pageLeft = Math.max(0, state.pageEl.offsetLeft || 0);
      var pageTop = Math.max(0, state.pageEl.offsetTop || 0);
      var pageRight = Math.max(0, wrapWidth - pageLeft - pageWidth);
      var pageBottom = Math.max(0, wrapHeight - pageTop - pageHeight);

      state.basePageWidth = pageWidth;
      state.basePageHeight = pageHeight;
      state.basePageLeft = pageLeft;
      state.basePageTop = pageTop;
      state.baseWrapWidth = Math.max(wrapWidth, pageLeft + pageWidth + pageRight);
      state.baseWrapHeight = Math.max(wrapHeight, pageTop + pageHeight + pageBottom);
      state.measured = true;
    }

    function applyDocsDocxCommittedScale(state) {
      if (!isDocsDocxViewerActive(state) || !state.scrollEl || !state.wrapEl || !state.pageEl) return;
      if (!state.measured) measureDocsDocxLayout(state);
      if (!state.measured) return;

      var scale = clampDocsPdfScale(state.zoomScale);
      var wrapWidth = Math.max(state.scrollEl.clientWidth, state.baseWrapWidth * scale);
      var wrapHeight = Math.max(state.scrollEl.clientHeight, state.baseWrapHeight * scale);

      state.wrapEl.style.width = Math.ceil(wrapWidth) + 'px';
      state.wrapEl.style.height = Math.ceil(wrapHeight) + 'px';
      state.pageEl.style.position = 'absolute';
      state.pageEl.style.left = Math.round(state.basePageLeft * scale) + 'px';
      state.pageEl.style.top = Math.round(state.basePageTop * scale) + 'px';
      state.pageEl.style.width = Math.round(state.basePageWidth) + 'px';
      state.pageEl.style.minHeight = Math.round(state.basePageHeight) + 'px';
      state.pageEl.style.margin = '0';
      state.pageEl.style.transformOrigin = '0 0';
      state.pageEl.style.transform = Math.abs(scale - 1) < 0.001 ? '' : ('scale(' + scale + ')');
      state.pageEl.classList.toggle('is-live-zoom', scale > 1.01);
      setDocsViewerStatus(getDocsDocxStatusText(state));
    }

    function commitDocsDocxScale(state, scale, originX, originY) {
      if (!isDocsDocxViewerActive(state) || !state.scrollEl || !state.wrapEl || !state.pageEl) return;
      if (!state.measured) measureDocsDocxLayout(state);
      if (!state.measured) return;

      var nextScale = clampDocsPdfScale(scale);
      var prevScale = clampDocsPdfScale(state.zoomScale);
      var rawX = originX;
      var rawY = originY;
      if (typeof rawX !== 'number' || !isFinite(rawX)) rawX = state.scrollEl.clientWidth / 2;
      if (typeof rawY !== 'number' || !isFinite(rawY)) rawY = state.scrollEl.clientHeight / 2;
      var anchorX = Math.max(0, Math.min(state.scrollEl.clientWidth, rawX));
      var anchorY = Math.max(0, Math.min(state.scrollEl.clientHeight, rawY));
      var contentX = (state.scrollEl.scrollLeft + anchorX) / prevScale;
      var contentY = (state.scrollEl.scrollTop + anchorY) / prevScale;

      state.zoomScale = nextScale;
      state.previewScale = nextScale;
      applyDocsDocxCommittedScale(state);

      state.scrollEl.scrollLeft = Math.max(0, contentX * nextScale - anchorX);
      state.scrollEl.scrollTop = Math.max(0, contentY * nextScale - anchorY);
    }

    function scheduleDocsDocxRelayout(state) {
      if (!isDocsDocxViewerActive(state)) return;
      if (state.resizeTimer) clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(function() {
        if (!isDocsDocxViewerActive(state) || !state.scrollEl || !state.wrapEl) return;
        state.resizeTimer = null;

        var oldWidth = Math.max(1, state.wrapEl.offsetWidth || state.scrollEl.scrollWidth || 1);
        var oldHeight = Math.max(1, state.wrapEl.offsetHeight || state.scrollEl.scrollHeight || 1);
        var ratioX = (state.scrollEl.scrollLeft + state.scrollEl.clientWidth / 2) / oldWidth;
        var ratioY = (state.scrollEl.scrollTop + state.scrollEl.clientHeight / 2) / oldHeight;

        state.measured = false;
        measureDocsDocxLayout(state);
        applyDocsDocxCommittedScale(state);

        var nextWidth = Math.max(1, state.wrapEl.offsetWidth || state.scrollEl.scrollWidth || 1);
        var nextHeight = Math.max(1, state.wrapEl.offsetHeight || state.scrollEl.scrollHeight || 1);
        state.scrollEl.scrollLeft = Math.max(0, ratioX * nextWidth - state.scrollEl.clientWidth / 2);
        state.scrollEl.scrollTop = Math.max(0, ratioY * nextHeight - state.scrollEl.clientHeight / 2);
      }, 80);
    }

    function attachDocxGestureHandlers(state) {
      if (!isDocsDocxViewerActive(state) || !state.scrollEl) return;
      var scrollEl = state.scrollEl;

      state.onTouchStart = function(e) {
        if (!isDocsDocxViewerActive(state)) return;
        if (e.touches.length === 2) {
          var p1 = getDocsTouchPoint(scrollEl, e.touches[0]);
          var p2 = getDocsTouchPoint(scrollEl, e.touches[1]);
          var distance = getDocsDistance(p1, p2);
          if (distance <= 0) return;
          state.pinch.active = true;
          state.pinch.startDistance = distance;
          state.pinch.startScale = clampDocsPdfScale(state.zoomScale);
          state.pinch.originX = (p1.x + p2.x) / 2;
          state.pinch.originY = (p1.y + p2.y) / 2;
          state.previewScale = state.pinch.startScale;
          state.tapStart = null;
          state.lastTapAt = 0;
          return;
        }
        if (e.touches.length === 1 && !state.pinch.active) {
          var tapPoint = getDocsTouchPoint(scrollEl, e.touches[0]);
          state.tapStart = {
            x: tapPoint.x,
            y: tapPoint.y,
            moved: false
          };
        }
      };

      state.onTouchMove = function(e) {
        if (!isDocsDocxViewerActive(state)) return;
        if (state.pinch.active && e.touches.length >= 2) {
          e.preventDefault();
          var p1 = getDocsTouchPoint(scrollEl, e.touches[0]);
          var p2 = getDocsTouchPoint(scrollEl, e.touches[1]);
          var distance = getDocsDistance(p1, p2);
          if (distance <= 0 || !state.pinch.startDistance) return;
          var nextScale = state.pinch.startScale * (distance / state.pinch.startDistance);
          commitDocsDocxScale(state, nextScale, state.pinch.originX, state.pinch.originY);
          return;
        }
        if (state.tapStart && e.touches.length === 1) {
          var movePoint = getDocsTouchPoint(scrollEl, e.touches[0]);
          var movedDistance = getDocsDistance(movePoint, state.tapStart);
          if (movedDistance > 12) state.tapStart.moved = true;
        }
      };

      state.onTouchEnd = function(e) {
        if (!isDocsDocxViewerActive(state)) return;
        if (state.pinch.active && e.touches.length < 2) {
          e.preventDefault();
          state.pinch.active = false;
          state.tapStart = null;
          return;
        }
        if (!state.tapStart || state.tapStart.moved || e.changedTouches.length !== 1 || state.pinch.active) {
          state.tapStart = null;
          return;
        }
        var now = Date.now();
        var tapPoint = getDocsTouchPoint(scrollEl, e.changedTouches[0]);
        var interval = now - (state.lastTapAt || 0);
        var distFromLast = getDocsDistance(tapPoint, {
          x: state.lastTapX || 0,
          y: state.lastTapY || 0
        });
        if (state.lastTapAt && interval <= DOCS_PDF_DOUBLE_TAP_DELAY && distFromLast <= DOCS_PDF_DOUBLE_TAP_DISTANCE) {
          e.preventDefault();
          state.lastTapAt = 0;
          var targetScale = Math.abs((state.zoomScale || 1) - 1) < 0.05 ? 2 : 1;
          commitDocsDocxScale(state, targetScale, tapPoint.x, tapPoint.y);
        } else {
          state.lastTapAt = now;
          state.lastTapX = tapPoint.x;
          state.lastTapY = tapPoint.y;
        }
        state.tapStart = null;
      };

      state.onTouchCancel = function() {
        if (!isDocsDocxViewerActive(state)) return;
        state.pinch.active = false;
        state.tapStart = null;
      };

      scrollEl.addEventListener('touchstart', state.onTouchStart, { passive: true });
      scrollEl.addEventListener('touchmove', state.onTouchMove, { passive: false });
      scrollEl.addEventListener('touchend', state.onTouchEnd, { passive: false });
      scrollEl.addEventListener('touchcancel', state.onTouchCancel, { passive: true });
    }

    function mountDocsDocxViewer(state, html, localPath) {
      if (!isDocsDocxViewerActive(state) || !state.bodyEl) return;
      state.bodyEl.innerHTML =
        '<div class="docs-docx-scroll">' +
          '<div class="docs-docx-scale-wrap">' +
            '<article class="docs-docx-page">' + html + '</article>' +
          '</div>' +
        '</div>';

      state.scrollEl = state.bodyEl.querySelector('.docs-docx-scroll');
      state.wrapEl = state.bodyEl.querySelector('.docs-docx-scale-wrap');
      state.pageEl = state.bodyEl.querySelector('.docs-docx-page');
      state.zoomScale = DOCS_PDF_MIN_SCALE;
      state.previewScale = DOCS_PDF_MIN_SCALE;
      state.measured = false;
      state.pinch = { active: false, startDistance: 0, startScale: DOCS_PDF_MIN_SCALE, originX: 0, originY: 0 };
      state.tapStart = null;
      state.lastTapAt = 0;
      state.lastTapX = 0;
      state.lastTapY = 0;

      measureDocsDocxLayout(state);
      applyDocsDocxCommittedScale(state);

      state.onResize = function() {
        scheduleDocsDocxRelayout(state);
      };
      window.addEventListener('resize', state.onResize);
      window.addEventListener('orientationchange', state.onResize);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', state.onResize);
      }

      attachDocxGestureHandlers(state);
      markDocAsDownloaded(localPath);
      setDocsViewerStatus(getDocsDocxStatusText(state));
    }

    function renderDocsDocxHtml(html, localPath, state) {
      var bodyEl = document.getElementById('docsViewerBody');
      if (!bodyEl) return;
      if (!state) {
        destroyDocsDocxViewer();
        state = createDocsDocxViewerState(bodyEl);
        docsDocxViewerState = state;
      }
      if (!isDocsDocxViewerActive(state)) return;
      state.bodyEl = bodyEl;
      mountDocsDocxViewer(state, html, localPath);
    }

    function openDocxWithPreview(localPath, attempt) {
      var bodyEl = document.getElementById('docsViewerBody');
      if (!bodyEl) return;
      var tryIndex = Number(attempt || 0);
      destroyDocsDocxViewer();
      var state = createDocsDocxViewerState(bodyEl);
      docsDocxViewerState = state;

      renderDocsViewerLoading(
        tryIndex > 0 ? 'Повторная загрузка DOCX…' : 'Загрузка DOCX…',
        tryIndex > 0 ? 'Пробуем открыть документ ещё раз' : 'Подготавливаем документ для просмотра'
      );
      setDocsViewerStatus(tryIndex > 0 ? 'Повтор...' : 'Загрузка…');

      var zipLib = null;
      ensureDocsZipReady()
        .then(function(JSZip) {
          if (!isDocsDocxViewerActive(state)) return null;
          zipLib = JSZip;
          return fetch(localPath, { cache: 'no-store' });
        })
        .then(function(resp) {
          if (!isDocsDocxViewerActive(state) || !resp) return null;
          if (!resp || !resp.ok) {
            throw new Error('Failed to fetch DOCX');
          }
          return resp.arrayBuffer();
        })
        .then(function(buffer) {
          if (!isDocsDocxViewerActive(state) || !buffer) return null;
          return zipLib.loadAsync(buffer);
        })
        .then(function(zip) {
          if (!isDocsDocxViewerActive(state) || !zip) return null;
          var documentFile = zip.file('word/document.xml');
          if (!documentFile) throw new Error('DOCX document.xml not found');
          return documentFile.async('string');
        })
        .then(function(xmlText) {
          if (!isDocsDocxViewerActive(state) || !xmlText) return;
          var overlay = document.getElementById('docsViewerOverlay');
          if (!overlay || overlay.classList.contains('hidden')) return;
          renderDocsDocxHtml(renderDocxDocumentXml(xmlText), localPath, state);
        })
        .catch(function(err) {
          if (!isDocsDocxViewerActive(state)) return;
          if (isRetryableDocError(err) && tryIndex < 1) {
            destroyDocsDocxViewer();
            openDocxWithPreview(localPath, tryIndex + 1);
            return;
          }
          destroyDocsDocxViewer();
          var friendly = getFriendlyDocOpenError(err);
          renderDocsViewerError(friendly.title, friendly.details);
          setDocsViewerStatus(friendly.status);
        });
    }

    function isRetryableDocError(err) {
      var rawMessage = err && err.message ? String(err.message) : '';
      var message = rawMessage.toLowerCase();
      return (
        message.indexOf('asset unavailable') !== -1 ||
        message.indexOf('failed to fetch') !== -1 ||
        message.indexOf('network') !== -1 ||
        message.indexOf('fetch') !== -1 ||
        message.indexOf('loading aborted') !== -1
      );
    }

    function getFriendlyDocOpenError(err) {
      var rawMessage = err && err.message ? String(err.message) : '';
      var message = rawMessage.toLowerCase();
      var isNetworkIssue = isRetryableDocError(err);

      if (!navigator.onLine && isNetworkIssue) {
        return {
          title: 'Файл пока не скачан',
          details: 'Сейчас вы оффлайн. Подключитесь к интернету и откройте файл один раз, чтобы он стал доступен без сети.',
          status: 'Оффлайн'
        };
      }

      if (isNetworkIssue) {
        return {
          title: 'Не удалось загрузить файл',
          details: 'Проверьте интернет-соединение и попробуйте еще раз.',
          status: ''
        };
      }

      return {
        title: 'Не удалось открыть файл',
        details: 'Попробуйте снова. Если ошибка повторится, обновите приложение.',
        status: ''
      };
    }

    function isDocsImageViewerActive(state) {
      return !!(state && !state.destroyed && docsImageViewerState === state);
    }

    function createDocsImageViewerState(bodyEl) {
      return {
        destroyed: false,
        bodyEl: bodyEl,
        scrollEl: null,
        wrapEl: null,
        imageEl: null,
        zoomScale: DOCS_PDF_MIN_SCALE,
        previewScale: DOCS_PDF_MIN_SCALE,
        measured: false,
        baseWrapWidth: 0,
        baseWrapHeight: 0,
        baseImageWidth: 0,
        baseImageHeight: 0,
        baseImageLeft: 0,
        baseImageTop: 0,
        pinch: { active: false, startDistance: 0, startScale: DOCS_PDF_MIN_SCALE, originX: 0, originY: 0 },
        tapStart: null,
        lastTapAt: 0,
        lastTapX: 0,
        lastTapY: 0,
        resizeTimer: null,
        onResize: null,
        onTouchStart: null,
        onTouchMove: null,
        onTouchEnd: null,
        onTouchCancel: null
      };
    }

    function resetDocsImageMeasureStyles(state) {
      if (!state || !state.wrapEl || !state.imageEl) return;
      state.wrapEl.style.width = '';
      state.wrapEl.style.height = '';
      state.imageEl.style.position = '';
      state.imageEl.style.left = '';
      state.imageEl.style.top = '';
      state.imageEl.style.width = '';
      state.imageEl.style.height = '';
      state.imageEl.style.margin = '';
      state.imageEl.style.transform = '';
      state.imageEl.style.transformOrigin = '';
      state.imageEl.classList.remove('is-live-zoom');
    }

    function measureDocsImageLayout(state) {
      if (!isDocsImageViewerActive(state) || !state.scrollEl || !state.wrapEl || !state.imageEl) return;
      resetDocsImageMeasureStyles(state);

      var wrapWidth = Math.max(1, state.wrapEl.offsetWidth || state.scrollEl.clientWidth || 1);
      var wrapHeight = Math.max(1, state.wrapEl.scrollHeight || state.scrollEl.clientHeight || 1);
      var imageWidth = Math.max(1, state.imageEl.offsetWidth || 1);
      var imageHeight = Math.max(1, state.imageEl.offsetHeight || 1);
      var imageLeft = Math.max(0, state.imageEl.offsetLeft || 0);
      var imageTop = Math.max(0, state.imageEl.offsetTop || 0);
      var imageRight = Math.max(0, wrapWidth - imageLeft - imageWidth);
      var imageBottom = Math.max(0, wrapHeight - imageTop - imageHeight);

      state.baseImageWidth = imageWidth;
      state.baseImageHeight = imageHeight;
      state.baseImageLeft = imageLeft;
      state.baseImageTop = imageTop;
      state.baseWrapWidth = Math.max(wrapWidth, imageLeft + imageWidth + imageRight);
      state.baseWrapHeight = Math.max(wrapHeight, imageTop + imageHeight + imageBottom);
      state.measured = true;
    }

    function applyDocsImageCommittedScale(state) {
      if (!isDocsImageViewerActive(state) || !state.scrollEl || !state.wrapEl || !state.imageEl) return;
      if (!state.measured) measureDocsImageLayout(state);
      if (!state.measured) return;

      var scale = clampDocsPdfScale(state.zoomScale);
      var wrapWidth = Math.max(state.scrollEl.clientWidth, state.baseWrapWidth * scale);
      var wrapHeight = Math.max(state.scrollEl.clientHeight, state.baseWrapHeight * scale);

      state.wrapEl.style.width = Math.ceil(wrapWidth) + 'px';
      state.wrapEl.style.height = Math.ceil(wrapHeight) + 'px';
      state.imageEl.style.position = 'absolute';
      state.imageEl.style.left = Math.round(state.baseImageLeft * scale) + 'px';
      state.imageEl.style.top = Math.round(state.baseImageTop * scale) + 'px';
      state.imageEl.style.width = Math.round(state.baseImageWidth) + 'px';
      state.imageEl.style.height = Math.round(state.baseImageHeight) + 'px';
      state.imageEl.style.margin = '0';
      state.imageEl.style.transformOrigin = '0 0';
      state.imageEl.style.transform = Math.abs(scale - 1) < 0.001 ? '' : ('scale(' + scale + ')');
      state.imageEl.classList.toggle('is-live-zoom', scale > 1.01);
      setDocsViewerStatus(getDocsImageStatusText(state));
    }

    function commitDocsImageScale(state, scale, originX, originY) {
      if (!isDocsImageViewerActive(state) || !state.scrollEl || !state.wrapEl || !state.imageEl) return;
      if (!state.measured) measureDocsImageLayout(state);
      if (!state.measured) return;

      var nextScale = clampDocsPdfScale(scale);
      var prevScale = clampDocsPdfScale(state.zoomScale);
      var rawX = originX;
      var rawY = originY;
      if (typeof rawX !== 'number' || !isFinite(rawX)) rawX = state.scrollEl.clientWidth / 2;
      if (typeof rawY !== 'number' || !isFinite(rawY)) rawY = state.scrollEl.clientHeight / 2;
      var anchorX = Math.max(0, Math.min(state.scrollEl.clientWidth, rawX));
      var anchorY = Math.max(0, Math.min(state.scrollEl.clientHeight, rawY));
      var contentX = (state.scrollEl.scrollLeft + anchorX) / prevScale;
      var contentY = (state.scrollEl.scrollTop + anchorY) / prevScale;

      state.zoomScale = nextScale;
      state.previewScale = nextScale;
      applyDocsImageCommittedScale(state);

      state.scrollEl.scrollLeft = Math.max(0, contentX * nextScale - anchorX);
      state.scrollEl.scrollTop = Math.max(0, contentY * nextScale - anchorY);
    }

    function scheduleDocsImageRelayout(state) {
      if (!isDocsImageViewerActive(state)) return;
      if (state.resizeTimer) clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(function() {
        if (!isDocsImageViewerActive(state) || !state.scrollEl || !state.wrapEl) return;
        state.resizeTimer = null;

        var oldWidth = Math.max(1, state.wrapEl.offsetWidth || state.scrollEl.scrollWidth || 1);
        var oldHeight = Math.max(1, state.wrapEl.offsetHeight || state.scrollEl.scrollHeight || 1);
        var ratioX = (state.scrollEl.scrollLeft + state.scrollEl.clientWidth / 2) / oldWidth;
        var ratioY = (state.scrollEl.scrollTop + state.scrollEl.clientHeight / 2) / oldHeight;

        state.measured = false;
        measureDocsImageLayout(state);
        applyDocsImageCommittedScale(state);

        var nextWidth = Math.max(1, state.wrapEl.offsetWidth || state.scrollEl.scrollWidth || 1);
        var nextHeight = Math.max(1, state.wrapEl.offsetHeight || state.scrollEl.scrollHeight || 1);
        state.scrollEl.scrollLeft = Math.max(0, ratioX * nextWidth - state.scrollEl.clientWidth / 2);
        state.scrollEl.scrollTop = Math.max(0, ratioY * nextHeight - state.scrollEl.clientHeight / 2);
      }, 80);
    }

    function attachImageGestureHandlers(state) {
      if (!isDocsImageViewerActive(state) || !state.scrollEl) return;
      var scrollEl = state.scrollEl;

      state.onTouchStart = function(e) {
        if (!isDocsImageViewerActive(state)) return;
        if (e.touches.length === 2) {
          var p1 = getDocsTouchPoint(scrollEl, e.touches[0]);
          var p2 = getDocsTouchPoint(scrollEl, e.touches[1]);
          var distance = getDocsDistance(p1, p2);
          if (distance <= 0) return;
          state.pinch.active = true;
          state.pinch.startDistance = distance;
          state.pinch.startScale = clampDocsPdfScale(state.zoomScale);
          state.pinch.originX = (p1.x + p2.x) / 2;
          state.pinch.originY = (p1.y + p2.y) / 2;
          state.previewScale = state.pinch.startScale;
          state.tapStart = null;
          state.lastTapAt = 0;
          return;
        }
        if (e.touches.length === 1 && !state.pinch.active) {
          var tapPoint = getDocsTouchPoint(scrollEl, e.touches[0]);
          state.tapStart = { x: tapPoint.x, y: tapPoint.y, moved: false };
        }
      };

      state.onTouchMove = function(e) {
        if (!isDocsImageViewerActive(state)) return;
        if (state.pinch.active && e.touches.length >= 2) {
          e.preventDefault();
          var p1 = getDocsTouchPoint(scrollEl, e.touches[0]);
          var p2 = getDocsTouchPoint(scrollEl, e.touches[1]);
          var distance = getDocsDistance(p1, p2);
          if (distance <= 0 || !state.pinch.startDistance) return;
          var nextScale = state.pinch.startScale * (distance / state.pinch.startDistance);
          commitDocsImageScale(state, nextScale, state.pinch.originX, state.pinch.originY);
          return;
        }
        if (state.tapStart && e.touches.length === 1) {
          var movePoint = getDocsTouchPoint(scrollEl, e.touches[0]);
          var movedDistance = getDocsDistance(movePoint, state.tapStart);
          if (movedDistance > 12) state.tapStart.moved = true;
        }
      };

      state.onTouchEnd = function(e) {
        if (!isDocsImageViewerActive(state)) return;
        if (state.pinch.active && e.touches.length < 2) {
          e.preventDefault();
          state.pinch.active = false;
          state.tapStart = null;
          return;
        }
        if (!state.tapStart || state.tapStart.moved || e.changedTouches.length !== 1 || state.pinch.active) {
          state.tapStart = null;
          return;
        }
        var now = Date.now();
        var tapPoint = getDocsTouchPoint(scrollEl, e.changedTouches[0]);
        var interval = now - (state.lastTapAt || 0);
        var distFromLast = getDocsDistance(tapPoint, { x: state.lastTapX || 0, y: state.lastTapY || 0 });
        if (state.lastTapAt && interval <= DOCS_PDF_DOUBLE_TAP_DELAY && distFromLast <= DOCS_PDF_DOUBLE_TAP_DISTANCE) {
          e.preventDefault();
          state.lastTapAt = 0;
          var targetScale = Math.abs((state.zoomScale || 1) - 1) < 0.05 ? 2 : 1;
          commitDocsImageScale(state, targetScale, tapPoint.x, tapPoint.y);
        } else {
          state.lastTapAt = now;
          state.lastTapX = tapPoint.x;
          state.lastTapY = tapPoint.y;
        }
        state.tapStart = null;
      };

      state.onTouchCancel = function() {
        if (!isDocsImageViewerActive(state)) return;
        state.pinch.active = false;
        state.tapStart = null;
      };

      scrollEl.addEventListener('touchstart', state.onTouchStart, { passive: true });
      scrollEl.addEventListener('touchmove', state.onTouchMove, { passive: false });
      scrollEl.addEventListener('touchend', state.onTouchEnd, { passive: false });
      scrollEl.addEventListener('touchcancel', state.onTouchCancel, { passive: true });
    }

    function mountDocsImageViewer(state, localPath, name, attempt) {
      if (!isDocsImageViewerActive(state) || !state.bodyEl) return;
      state.bodyEl.innerHTML =
        '<div class="docs-image-scroll">' +
          '<div class="docs-image-scale-wrap">' +
            '<img class="docs-viewer-image docs-viewer-image-zoomable" alt="' + escapeHtml(name || 'Изображение') + '">' +
          '</div>' +
        '</div>';

      state.scrollEl = state.bodyEl.querySelector('.docs-image-scroll');
      state.wrapEl = state.bodyEl.querySelector('.docs-image-scale-wrap');
      state.imageEl = state.bodyEl.querySelector('.docs-viewer-image-zoomable');
      state.zoomScale = DOCS_PDF_MIN_SCALE;
      state.previewScale = DOCS_PDF_MIN_SCALE;
      state.measured = false;
      state.pinch = { active: false, startDistance: 0, startScale: DOCS_PDF_MIN_SCALE, originX: 0, originY: 0 };
      state.tapStart = null;
      state.lastTapAt = 0;
      state.lastTapX = 0;
      state.lastTapY = 0;

      state.imageEl.onload = function() {
        if (!isDocsImageViewerActive(state)) return;
        measureDocsImageLayout(state);
        applyDocsImageCommittedScale(state);
        attachImageGestureHandlers(state);
        state.onResize = function() {
          scheduleDocsImageRelayout(state);
        };
        window.addEventListener('resize', state.onResize);
        window.addEventListener('orientationchange', state.onResize);
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', state.onResize);
        }
        markDocAsDownloaded(localPath);
        setDocsViewerStatus(getDocsImageStatusText(state));
      };

      state.imageEl.onerror = function() {
        if (!isDocsImageViewerActive(state)) return;
        var tryIndex = Number(attempt || 0);
        if (navigator.onLine && tryIndex < 1) {
          destroyDocsImageViewer();
          openImageWithPreview(localPath, name, tryIndex + 1);
          return;
        }
        if (!navigator.onLine) {
          renderDocsViewerError(
            'Файл пока не скачан',
            'Сейчас вы оффлайн. Подключитесь к интернету и откройте файл один раз, чтобы он стал доступен без сети.'
          );
          setDocsViewerStatus('Оффлайн');
        } else {
          renderDocsViewerError('Не удалось загрузить изображение');
          setDocsViewerStatus('');
        }
      };

      state.imageEl.src = localPath;
    }

    function openImageWithPreview(localPath, name, attempt) {
      var bodyEl = document.getElementById('docsViewerBody');
      if (!bodyEl) return;
      var tryIndex = Number(attempt || 0);
      destroyDocsImageViewer();
      var state = createDocsImageViewerState(bodyEl);
      docsImageViewerState = state;
      renderDocsViewerLoading(
        tryIndex > 0 ? 'Повторная загрузка изображения…' : 'Загрузка изображения…',
        tryIndex > 0 ? 'Пробуем открыть изображение ещё раз' : 'Подготавливаем изображение для просмотра'
      );
      setDocsViewerStatus(tryIndex > 0 ? 'Повтор...' : 'Загрузка…');
      mountDocsImageViewer(state, localPath, name, tryIndex);
    }

    function isDocsPdfViewerActive(state) {
      return !!(state && !state.destroyed && docsPdfViewerState === state);
    }

    function ensurePdfJsReady() {
      if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
        if (window.pdfjsLib.GlobalWorkerOptions) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = DOCS_PDFJS_WORKER_SRC;
        }
        return Promise.resolve(window.pdfjsLib);
      }
      if (docsPdfJsLoadPromise) return docsPdfJsLoadPromise;

      docsPdfJsLoadPromise = new Promise(function(resolve, reject) {
        function onReady() {
          if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
            docsPdfJsLoadPromise = null;
            reject(new Error('pdf.js не инициализирован'));
            return;
          }
          if (window.pdfjsLib.GlobalWorkerOptions) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = DOCS_PDFJS_WORKER_SRC;
          }
          resolve(window.pdfjsLib);
        }

        function onError() {
          docsPdfJsLoadPromise = null;
          reject(new Error('Не удалось загрузить pdf.js'));
        }

        var existingScript = document.querySelector('script[data-pdfjs-local="1"]');
        if (existingScript) {
          if (existingScript.getAttribute('data-loaded') === '1') {
            onReady();
            return;
          }
          existingScript.addEventListener('load', onReady, { once: true });
          existingScript.addEventListener('error', onError, { once: true });
          return;
        }

        var script = document.createElement('script');
        script.src = DOCS_PDFJS_SRC;
        script.async = true;
        script.setAttribute('data-pdfjs-local', '1');
        script.onload = function() {
          script.setAttribute('data-loaded', '1');
          onReady();
        };
        script.onerror = onError;
        document.head.appendChild(script);
      });

      return docsPdfJsLoadPromise;
    }

    function destroyDocsPdfViewer() {
      var state = docsPdfViewerState;
      if (!state) return;
      docsPdfViewerState = null;
      state.destroyed = true;

      if (state.resizeTimer) {
        clearTimeout(state.resizeTimer);
        state.resizeTimer = null;
      }
      if (state.scrollFrame) {
        window.cancelAnimationFrame(state.scrollFrame);
        state.scrollFrame = null;
      }
      if (state.observer) {
        try { state.observer.disconnect(); } catch (e) {}
        state.observer = null;
      }
      if (state.scrollEl && state.onScroll) {
        state.scrollEl.removeEventListener('scroll', state.onScroll);
      }
      if (state.scrollEl && state.onTouchStart) {
        state.scrollEl.removeEventListener('touchstart', state.onTouchStart);
      }
      if (state.scrollEl && state.onTouchMove) {
        state.scrollEl.removeEventListener('touchmove', state.onTouchMove);
      }
      if (state.scrollEl && state.onTouchEnd) {
        state.scrollEl.removeEventListener('touchend', state.onTouchEnd);
      }
      if (state.scrollEl && state.onTouchCancel) {
        state.scrollEl.removeEventListener('touchcancel', state.onTouchCancel);
      }
      if (state.onResize) {
        window.removeEventListener('resize', state.onResize);
        window.removeEventListener('orientationchange', state.onResize);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', state.onResize);
        }
      }

      for (var i = 0; i < state.pageItems.length; i++) {
        var item = state.pageItems[i];
        if (item && item.renderTask && typeof item.renderTask.cancel === 'function') {
          try { item.renderTask.cancel(); } catch (e) {}
        }
      }

      if (state.loadingTask && typeof state.loadingTask.destroy === 'function') {
        try { state.loadingTask.destroy(); } catch (e) {}
      }
      if (state.pdfDoc && typeof state.pdfDoc.destroy === 'function') {
        try { state.pdfDoc.destroy(); } catch (e) {}
      }
    }

    function destroyDocsDocxViewer() {
      var state = docsDocxViewerState;
      if (!state) return;
      docsDocxViewerState = null;
      state.destroyed = true;

      if (state.resizeTimer) {
        clearTimeout(state.resizeTimer);
        state.resizeTimer = null;
      }
      if (state.scrollEl && state.onTouchStart) {
        state.scrollEl.removeEventListener('touchstart', state.onTouchStart);
      }
      if (state.scrollEl && state.onTouchMove) {
        state.scrollEl.removeEventListener('touchmove', state.onTouchMove);
      }
      if (state.scrollEl && state.onTouchEnd) {
        state.scrollEl.removeEventListener('touchend', state.onTouchEnd);
      }
      if (state.scrollEl && state.onTouchCancel) {
        state.scrollEl.removeEventListener('touchcancel', state.onTouchCancel);
      }
      if (state.onResize) {
        window.removeEventListener('resize', state.onResize);
        window.removeEventListener('orientationchange', state.onResize);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', state.onResize);
        }
      }
    }

    function destroyDocsImageViewer() {
      var state = docsImageViewerState;
      if (!state) return;
      docsImageViewerState = null;
      state.destroyed = true;

      if (state.resizeTimer) {
        clearTimeout(state.resizeTimer);
        state.resizeTimer = null;
      }
      if (state.scrollEl && state.onTouchStart) {
        state.scrollEl.removeEventListener('touchstart', state.onTouchStart);
      }
      if (state.scrollEl && state.onTouchMove) {
        state.scrollEl.removeEventListener('touchmove', state.onTouchMove);
      }
      if (state.scrollEl && state.onTouchEnd) {
        state.scrollEl.removeEventListener('touchend', state.onTouchEnd);
      }
      if (state.scrollEl && state.onTouchCancel) {
        state.scrollEl.removeEventListener('touchcancel', state.onTouchCancel);
      }
      if (state.onResize) {
        window.removeEventListener('resize', state.onResize);
        window.removeEventListener('orientationchange', state.onResize);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', state.onResize);
        }
      }
    }

    function updateDocsPdfProgress(state) {
      if (!isDocsPdfViewerActive(state) || !state.scrollEl || !state.pageItems.length) return;
      var threshold = state.scrollEl.scrollTop + state.scrollEl.clientHeight * 0.35;
      var currentPage = 1;
      for (var i = 0; i < state.pageItems.length; i++) {
        var top = state.pageItems[i].el.offsetTop;
        if (top <= threshold) currentPage = state.pageItems[i].pageNumber;
        else break;
      }
      state.currentPage = currentPage;
      setDocsViewerStatus(getDocsPdfStatusText(state));
    }

    function queuePdfPageRender(state, pageNumber) {
      if (!isDocsPdfViewerActive(state)) return;
      var idx = pageNumber - 1;
      if (idx < 0 || idx >= state.pageItems.length) return;
      var item = state.pageItems[idx];
      if (!item || item.status === 'queued' || item.status === 'loading') return;
      if (item.status === 'rendered' && !item.needsRerender) return;
      item.status = 'queued';
      item.el.classList.add('is-loading');
      state.renderQueue.push(pageNumber);
      pumpPdfRenderQueue(state);
    }

    function queueVisiblePdfPages(state) {
      if (!isDocsPdfViewerActive(state) || !state.scrollEl) return;
      var scrollTop = state.scrollEl.scrollTop;
      var scrollBottom = scrollTop + state.scrollEl.clientHeight;
      var margin = Math.max(600, state.scrollEl.clientHeight * clampDocsPdfScale(state.zoomScale || 1));
      var minY = scrollTop - margin;
      var maxY = scrollBottom + margin;
      for (var i = 0; i < state.pageItems.length; i++) {
        var item = state.pageItems[i];
        var top = item.el.offsetTop;
        var bottom = top + item.el.offsetHeight;
        if (bottom >= minY && top <= maxY) {
          queuePdfPageRender(state, item.pageNumber);
        }
      }
    }

    function pumpPdfRenderQueue(state) {
      if (!isDocsPdfViewerActive(state) || !state.pdfDoc) return;
      while (state.renderInFlight < state.maxConcurrentRenders && state.renderQueue.length) {
        var pageNumber = state.renderQueue.shift();
        var item = state.pageItems[pageNumber - 1];
        if (!item || item.status !== 'queued') continue;
        renderPdfPage(state, item);
      }
    }

    function renderPdfPage(state, item) {
      if (!isDocsPdfViewerActive(state) || !state.pdfDoc) return;
      item.status = 'loading';
      item.el.classList.add('is-loading');
      item.el.classList.remove('is-error');
      if (item.errorEl) item.errorEl.textContent = '';
      state.renderInFlight += 1;

      state.pdfDoc.getPage(item.pageNumber)
        .then(function(page) {
          if (!isDocsPdfViewerActive(state)) return null;

          var baseViewport = page.getViewport({ scale: 1 });
          var targetCssWidth = Math.max(220, Math.floor(item.canvasWrap.clientWidth || (state.scrollEl ? state.scrollEl.clientWidth - 24 : baseViewport.width)));
          var cssScale = targetCssWidth / baseViewport.width;
          var cssHeight = Math.max(1, Math.floor(baseViewport.height * cssScale));
          var outputScale = Math.min(window.devicePixelRatio || 1, 2.25);
          if (state.zoomScale > 2.2) outputScale = Math.min(outputScale, 1.6);
          else if (state.zoomScale > 1.6) outputScale = Math.min(outputScale, 1.9);
          var maxPixelBudget = 14000000;
          var maxOutputScale = Math.sqrt(maxPixelBudget / Math.max(1, targetCssWidth * cssHeight));
          outputScale = Math.max(1, Math.min(outputScale, maxOutputScale));
          var renderViewport = page.getViewport({ scale: cssScale * outputScale });

          var canvas = item.canvas;
          var context = canvas.getContext('2d', { alpha: false });
          canvas.width = Math.max(1, Math.floor(renderViewport.width));
          canvas.height = Math.max(1, Math.floor(renderViewport.height));
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);

          var renderTask = page.render({
            canvasContext: context,
            viewport: renderViewport,
            intent: 'display'
          });
          item.renderTask = renderTask;
          return renderTask.promise.then(function() {
            if (typeof page.cleanup === 'function') {
              try { page.cleanup(); } catch (e) {}
            }
          });
        })
        .then(function() {
          if (!isDocsPdfViewerActive(state)) return;
          item.status = 'rendered';
          item.needsRerender = false;
          item.renderTask = null;
          item.el.classList.remove('is-loading', 'is-error');
          item.el.classList.add('is-rendered');
        })
        .catch(function(err) {
          if (!isDocsPdfViewerActive(state)) return;
          item.renderTask = null;
          var cancelled = err && (err.name === 'RenderingCancelledException' || err.name === 'AbortException');
          if (cancelled) {
            item.status = 'idle';
            item.needsRerender = true;
            item.el.classList.remove('is-loading');
            return;
          }
          item.status = 'error';
          item.needsRerender = false;
          item.el.classList.remove('is-loading', 'is-rendered');
          item.el.classList.add('is-error');
          if (item.errorEl) {
            item.errorEl.textContent = 'Не удалось отрисовать страницу ' + item.pageNumber;
          }
        })
        .finally(function() {
          if (!isDocsPdfViewerActive(state)) return;
          state.renderInFlight = Math.max(0, state.renderInFlight - 1);
          pumpPdfRenderQueue(state);
        });
    }

    function resetPdfRenderedPages(state) {
      if (!isDocsPdfViewerActive(state)) return;
      state.renderQueue.length = 0;
      state.renderInFlight = 0;

      for (var i = 0; i < state.pageItems.length; i++) {
        var item = state.pageItems[i];
        if (item.renderTask && typeof item.renderTask.cancel === 'function') {
          try { item.renderTask.cancel(); } catch (e) {}
        }
        item.renderTask = null;
        item.status = 'idle';
        var hasRenderedBitmap = item.canvas && item.canvas.width > 0 && item.canvas.height > 0 && item.el.classList.contains('is-rendered');
        if (hasRenderedBitmap) {
          item.needsRerender = true;
          item.el.classList.remove('is-loading', 'is-error');
        } else {
          item.needsRerender = false;
          if (item.canvas) {
            item.canvas.width = 0;
            item.canvas.height = 0;
            item.canvas.style.width = '';
            item.canvas.style.height = '';
          }
          item.el.classList.remove('is-loading', 'is-rendered', 'is-error');
        }
        if (item.errorEl) item.errorEl.textContent = '';
        if (state.observer) {
          try {
            state.observer.unobserve(item.el);
            state.observer.observe(item.el);
          } catch (e) {}
        }
      }

      queueVisiblePdfPages(state);
      updateDocsPdfProgress(state);
    }

    function scheduleDocsPdfRelayout(state) {
      if (!isDocsPdfViewerActive(state)) return;
      if (state.resizeTimer) clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(function() {
        state.resizeTimer = null;
        resetPdfRenderedPages(state);
      }, 180);
    }

    function createPdfPageItem(pageNumber) {
      var pageEl = document.createElement('article');
      pageEl.className = 'docs-pdf-page';
      pageEl.setAttribute('data-page-number', String(pageNumber));

      var canvasWrap = document.createElement('div');
      canvasWrap.className = 'docs-pdf-canvas-wrap';

      var canvas = document.createElement('canvas');
      canvas.className = 'docs-viewer-canvas';
      canvas.setAttribute('aria-label', 'Страница ' + pageNumber);
      canvasWrap.appendChild(canvas);

      var placeholder = document.createElement('div');
      placeholder.className = 'docs-pdf-placeholder';

      var errorEl = document.createElement('div');
      errorEl.className = 'docs-pdf-page-error';

      pageEl.appendChild(canvasWrap);
      pageEl.appendChild(placeholder);
      pageEl.appendChild(errorEl);

      return {
        pageNumber: pageNumber,
        el: pageEl,
        canvasWrap: canvasWrap,
        canvas: canvas,
        placeholder: placeholder,
        errorEl: errorEl,
        status: 'idle',
        needsRerender: false,
        renderTask: null
      };
    }

    function attachPdfGestureHandlers(state) {
      if (!isDocsPdfViewerActive(state) || !state.scrollEl) return;
      var scrollEl = state.scrollEl;

      function finishPinch() {
        if (!state.pinch || !state.pinch.active) return;
        var targetScale = state.previewScale || state.zoomScale;
        var originX = (typeof state.pinch.originX === 'number') ? state.pinch.originX : (scrollEl.clientWidth / 2);
        var originY = (typeof state.pinch.originY === 'number') ? state.pinch.originY : (scrollEl.clientHeight / 2);
        state.pinch.active = false;
        state.tapStart = null;
        commitDocsPdfScale(state, targetScale, originX, originY);
      }

      state.onTouchStart = function(e) {
        if (!isDocsPdfViewerActive(state)) return;
        if (e.touches.length === 2) {
          var p1 = getDocsTouchPoint(scrollEl, e.touches[0]);
          var p2 = getDocsTouchPoint(scrollEl, e.touches[1]);
          var distance = getDocsDistance(p1, p2);
          if (distance <= 0) return;
          state.pinch.active = true;
          state.pinch.startDistance = distance;
          state.pinch.startScale = clampDocsPdfScale(state.zoomScale);
          state.pinch.originX = (p1.x + p2.x) / 2;
          state.pinch.originY = (p1.y + p2.y) / 2;
          state.previewScale = state.pinch.startScale;
          state.tapStart = null;
          state.lastTapAt = 0;
          return;
        }
        if (e.touches.length === 1 && !state.pinch.active) {
          var tapPoint = getDocsTouchPoint(scrollEl, e.touches[0]);
          state.tapStart = {
            x: tapPoint.x,
            y: tapPoint.y,
            moved: false
          };
        }
      };

      state.onTouchMove = function(e) {
        if (!isDocsPdfViewerActive(state)) return;
        if (state.pinch.active && e.touches.length >= 2) {
          e.preventDefault();
          var p1 = getDocsTouchPoint(scrollEl, e.touches[0]);
          var p2 = getDocsTouchPoint(scrollEl, e.touches[1]);
          var distance = getDocsDistance(p1, p2);
          if (distance <= 0 || !state.pinch.startDistance) return;
          var nextScale = state.pinch.startScale * (distance / state.pinch.startDistance);
          applyDocsPdfLiveTransform(state, nextScale, state.pinch.originX, state.pinch.originY);
          return;
        }
        if (state.tapStart && e.touches.length === 1) {
          var movePoint = getDocsTouchPoint(scrollEl, e.touches[0]);
          var movedDistance = getDocsDistance(movePoint, state.tapStart);
          if (movedDistance > 12) state.tapStart.moved = true;
        }
      };

      state.onTouchEnd = function(e) {
        if (!isDocsPdfViewerActive(state)) return;
        if (state.pinch.active && e.touches.length < 2) {
          e.preventDefault();
          finishPinch();
          return;
        }
        if (!state.tapStart || state.tapStart.moved || e.changedTouches.length !== 1 || state.pinch.active) {
          state.tapStart = null;
          return;
        }
        var now = Date.now();
        var tapPoint = getDocsTouchPoint(scrollEl, e.changedTouches[0]);
        var interval = now - (state.lastTapAt || 0);
        var distFromLast = getDocsDistance(tapPoint, {
          x: state.lastTapX || 0,
          y: state.lastTapY || 0
        });
        if (state.lastTapAt && interval <= DOCS_PDF_DOUBLE_TAP_DELAY && distFromLast <= DOCS_PDF_DOUBLE_TAP_DISTANCE) {
          e.preventDefault();
          state.lastTapAt = 0;
          var targetScale = Math.abs((state.zoomScale || 1) - 1) < 0.05 ? 2 : 1;
          applyDocsPdfLiveTransform(state, targetScale, tapPoint.x, tapPoint.y);
          commitDocsPdfScale(state, targetScale, tapPoint.x, tapPoint.y);
        } else {
          state.lastTapAt = now;
          state.lastTapX = tapPoint.x;
          state.lastTapY = tapPoint.y;
        }
        state.tapStart = null;
      };

      state.onTouchCancel = function() {
        if (!isDocsPdfViewerActive(state)) return;
        if (state.pinch.active) {
          finishPinch();
        } else {
          state.tapStart = null;
        }
      };

      scrollEl.addEventListener('touchstart', state.onTouchStart, { passive: true });
      scrollEl.addEventListener('touchmove', state.onTouchMove, { passive: false });
      scrollEl.addEventListener('touchend', state.onTouchEnd, { passive: false });
      scrollEl.addEventListener('touchcancel', state.onTouchCancel, { passive: true });
    }

    function attachPdfObserver(state) {
      if (!window.IntersectionObserver || !state.scrollEl) return;
      state.observer = new IntersectionObserver(function(entries) {
        if (!isDocsPdfViewerActive(state)) return;
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (!entry.isIntersecting) continue;
          var pageNumber = parseInt(entry.target.getAttribute('data-page-number') || '0', 10);
          if (pageNumber > 0) queuePdfPageRender(state, pageNumber);
        }
      }, {
        root: state.scrollEl,
        rootMargin: '900px 0px',
        threshold: 0.01
      });

      for (var j = 0; j < state.pageItems.length; j++) {
        state.observer.observe(state.pageItems[j].el);
      }
    }

    function mountPdfPages(state) {
      if (!isDocsPdfViewerActive(state) || !state.bodyEl || !state.pdfDoc) return;
      var bodyEl = state.bodyEl;
      bodyEl.innerHTML = '';

      var scrollEl = document.createElement('div');
      scrollEl.className = 'docs-pdf-scroll';
      var listEl = document.createElement('div');
      listEl.className = 'docs-pdf-list';
      scrollEl.appendChild(listEl);
      bodyEl.appendChild(scrollEl);

      state.scrollEl = scrollEl;
      state.listEl = listEl;
      state.pageItems = [];
      state.renderQueue = [];
      state.renderInFlight = 0;
      state.currentPage = 1;
      state.zoomScale = clampDocsPdfScale(state.zoomScale || DOCS_PDF_MIN_SCALE);
      state.previewScale = state.zoomScale;
      state.pinch = {
        active: false,
        startDistance: 0,
        startScale: state.zoomScale,
        originX: 0,
        originY: 0
      };
      state.tapStart = null;
      state.lastTapAt = 0;
      state.lastTapX = 0;
      state.lastTapY = 0;

      for (var pageNumber = 1; pageNumber <= state.pdfDoc.numPages; pageNumber++) {
        var pageItem = createPdfPageItem(pageNumber);
        state.pageItems.push(pageItem);
        listEl.appendChild(pageItem.el);
      }

      applyDocsPdfCommittedScale(state);

      state.onScroll = function() {
        if (!isDocsPdfViewerActive(state)) return;
        if (state.scrollFrame) return;
        state.scrollFrame = window.requestAnimationFrame(function() {
          state.scrollFrame = null;
          updateDocsPdfProgress(state);
          if (!state.observer) queueVisiblePdfPages(state);
        });
      };
      scrollEl.addEventListener('scroll', state.onScroll, { passive: true });

      state.onResize = function() {
        scheduleDocsPdfRelayout(state);
      };
      window.addEventListener('resize', state.onResize);
      window.addEventListener('orientationchange', state.onResize);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', state.onResize);
      }

      attachPdfGestureHandlers(state);
      attachPdfObserver(state);
      queueVisiblePdfPages(state);
      updateDocsPdfProgress(state);
    }

    function openPdfWithPdfJs(localPath, attempt) {
      var bodyEl = document.getElementById('docsViewerBody');
      if (!bodyEl) return;
      var tryIndex = Number(attempt || 0);

      var state = {
        destroyed: false,
        bodyEl: bodyEl,
        loadingTask: null,
        pdfDoc: null,
        pageItems: [],
        renderQueue: [],
        renderInFlight: 0,
        maxConcurrentRenders: window.innerWidth <= 640 ? 1 : 2,
        currentPage: 1,
        zoomScale: DOCS_PDF_MIN_SCALE,
        previewScale: DOCS_PDF_MIN_SCALE,
        pinch: { active: false, startDistance: 0, startScale: DOCS_PDF_MIN_SCALE, originX: 0, originY: 0 },
        tapStart: null,
        lastTapAt: 0,
        lastTapX: 0,
        lastTapY: 0,
        resizeTimer: null,
        observer: null,
        scrollEl: null,
        listEl: null,
        scrollFrame: null,
        onScroll: null,
        onResize: null,
        onTouchStart: null,
        onTouchMove: null,
        onTouchEnd: null,
        onTouchCancel: null
      };
      docsPdfViewerState = state;

      renderDocsViewerLoading(
        tryIndex > 0 ? 'Повторная загрузка PDF…' : 'Загрузка PDF…',
        tryIndex > 0 ? 'Пробуем открыть документ ещё раз' : 'Подготавливаем страницы для просмотра'
      );
      setDocsViewerStatus(tryIndex > 0 ? 'Повтор...' : 'Загрузка…');

      ensurePdfJsReady()
        .then(function(pdfjsLib) {
          if (!isDocsPdfViewerActive(state)) return null;
          state.loadingTask = pdfjsLib.getDocument({
            url: localPath,
            disableAutoFetch: false,
            disableStream: false
          });
          return state.loadingTask.promise;
        })
        .then(function(pdfDoc) {
          if (!pdfDoc) return;
          if (!isDocsPdfViewerActive(state)) {
            if (pdfDoc && typeof pdfDoc.destroy === 'function') {
              try { pdfDoc.destroy(); } catch (e) {}
            }
            return;
          }
          state.pdfDoc = pdfDoc;
          mountPdfPages(state);
          setDocsViewerStatus(getDocsPdfStatusText(state));
          markDocAsDownloaded(localPath);
        })
        .catch(function(err) {
          if (!isDocsPdfViewerActive(state)) return;
          if (isRetryableDocError(err) && tryIndex < 1) {
            destroyDocsPdfViewer();
            openPdfWithPdfJs(localPath, tryIndex + 1);
            return;
          }
          destroyDocsPdfViewer();
          var friendly = getFriendlyDocOpenError(err);
          renderDocsViewerError(friendly.title, friendly.details);
          setDocsViewerStatus(friendly.status);
        });
    }

    function openDocsViewerUI(fileName) {
      destroyDocsPdfViewer();
      destroyDocsDocxViewer();
      destroyDocsImageViewer();
      var overlay = document.getElementById('docsViewerOverlay');
      var titleEl = document.getElementById('docsViewerTitle');
      var bodyEl = document.getElementById('docsViewerBody');
      if (!overlay) return;
      if (titleEl) titleEl.textContent = fileName;
      if (bodyEl) bodyEl.innerHTML = '';
      setDocsViewerStatus('');
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.remove('hidden');
      document.body.classList.add('docs-viewer-open');
    }

    function closeDocsViewerUI() {
      destroyDocsPdfViewer();
      destroyDocsDocxViewer();
      destroyDocsImageViewer();
      var overlay = document.getElementById('docsViewerOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('docs-viewer-open');
      var bodyEl = document.getElementById('docsViewerBody');
      if (bodyEl) bodyEl.innerHTML = '';
      setDocsViewerStatus('');
    }

    // ── Open doc file — in-app viewer ───────────────────────────────────────

    function openDocFile(filePath, fileName, mimeType) {
      var name = decodeDocAttr(fileName || 'Файл');
      var mime = decodeDocAttr(mimeType || '');
      var localPath = normalizeDocPath(filePath || '');
      var lname = name.toLowerCase();

      openDocsViewerUI(name);

      var bodyEl = document.getElementById('docsViewerBody');
      if (!bodyEl) return;
      if (!localPath) {
        renderDocsViewerError('Не удалось определить путь к файлу');
        setDocsViewerStatus('');
        return;
      }

      var isImage = mime.indexOf('image') !== -1;
      var isPdf = mime.indexOf('pdf') !== -1 || lname.endsWith('.pdf');
      var isDocx =
        mime.indexOf('wordprocessingml.document') !== -1 ||
        lname.endsWith('.docx') ||
        localPath.toLowerCase().endsWith('.docx');

      checkDocDownloaded(localPath)
        .catch(function() { return false; })
        .then(function(isDownloaded) {
          var overlay = document.getElementById('docsViewerOverlay');
          if (!overlay || overlay.classList.contains('hidden')) return;

          if (!navigator.onLine && !isDownloaded) {
            renderDocsViewerError(
              'Файл пока не скачан',
              'Сейчас вы оффлайн. Подключитесь к интернету и откройте файл один раз, чтобы он стал доступен без сети.'
            );
            setDocsViewerStatus('Оффлайн');
            return;
          }

          if (isPdf) {
            openPdfWithPdfJs(localPath);
            return;
          }

          if (isDocx) {
            openDocxWithPreview(localPath);
            return;
          }

          if (isImage) {
            openImageWithPreview(localPath, name);
            return;
          }

          renderDocsViewerError('Просмотр этого формата недоступен', mime || lname);
          setDocsViewerStatus('');
        });
    }

    function showDocsToast(text, success) {
      var existing = document.getElementById('docsToast');
      if (existing) existing.remove();
      var toast = document.createElement('div');
      toast.id = 'docsToast';
      toast.className = 'docs-toast' + (success ? ' docs-toast-ok' : '');
      toast.textContent = text;
      document.body.appendChild(toast);
      // Animate in
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { toast.classList.add('docs-toast-show'); });
      });
      setTimeout(function() {
        toast.classList.remove('docs-toast-show');
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
      }, success ? 3500 : 4000);
    }

    document.addEventListener('keydown', function(e) {
      if (!e || e.defaultPrevented) return;
      if (!(e.key === 'Enter' || e.key === ' ')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var item = e.target && e.target.closest ? e.target.closest('.docs-item[data-file-path]') : null;
      if (!item) return;
      e.preventDefault();
      var filePath = item.getAttribute('data-file-path') || '';
      var fileName = item.getAttribute('data-file-name') || '';
      var mimeType = item.getAttribute('data-mime-type') || '';
      if (filePath) openDocFile(filePath, fileName, mimeType);
    });

