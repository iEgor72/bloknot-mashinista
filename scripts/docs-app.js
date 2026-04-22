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

    function normalizeDocDisplayText(value) {
      return String(value || '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[._]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function extractDocBaseName(file) {
      var path = file && file.path ? String(file.path) : '';
      if (!path) return normalizeDocDisplayText(file && file.name);
      var tail = path.split('/').pop() || '';
      return normalizeDocDisplayText(decodeDocAttr(tail));
    }

    var DOC_DISPLAY_META_BY_PATH = {
      '/assets/docs/instructions/2580p.docx': {
        title: 'Действия в аварийных и нестандартных ситуациях',
        subtitle: '2580р от 12.12.2017'
      },
      '/assets/docs/speeds/Скоростя БАМ Парк Д Приказ № 161.pdf': {
        title: 'Скорости БАМ',
        subtitle: 'Приказ №161 от 27.02.2026'
      },
      '/assets/docs/speeds/Скоростя ВСГ Парк Д Приказ № 161.pdf': {
        title: 'Скорости ВСГ',
        subtitle: 'Приказ №161 от 27.02.2026'
      },
      '/assets/docs/speeds/Скоростя ВЛЧ Приказ № 161.pdf': {
        title: 'Скорости ВЛЧ',
        subtitle: 'Приказ №161 от 27.02.2026'
      }
    };

    function buildDocDisplayMeta(folder, file) {
      var explicitTitle = normalizeDocDisplayText(file && file.title);
      var explicitSubtitle = normalizeDocDisplayText(file && file.subtitle);
      if (explicitTitle) {
        return {
          title: explicitTitle,
          subtitle: explicitSubtitle
        };
      }

      var path = file && file.path ? String(file.path) : '';
      var explicit = DOC_DISPLAY_META_BY_PATH[path];
      if (explicit) {
        return {
          title: explicit.title,
          subtitle: explicit.subtitle
        };
      }

      var baseName = extractDocBaseName(file);
      var safeName = normalizeDocDisplayText(file && file.name);
      if (folder === 'folders') {
        return {
          title: safeName || baseName || 'Папка',
          subtitle: 'Конспекты по безопасности движения'
        };
      }
      if (folder === 'speeds') {
        return {
          title: 'Скорости ' + (safeName || baseName || ''),
          subtitle: baseName || ''
        };
      }
      if (folder === 'memos') {
        return {
          title: 'Памятка ' + (safeName || baseName || ''),
          subtitle: baseName || ''
        };
      }
      if (folder === 'reminders') {
        return {
          title: safeName || baseName || 'Памятка',
          subtitle: baseName && baseName !== safeName ? baseName : ''
        };
      }
      return {
        title: safeName || baseName || 'Файл',
        subtitle: baseName && baseName !== safeName ? baseName : ''
      };
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
            '<div class="docs-empty-text">Когда здесь появятся файлы, они сразу отобразятся в списке.</div>' +
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
        var displayMeta = buildDocDisplayMeta(folder, f);
        var meta = '<span class="badge ' + badges[type] + '">' + type.toUpperCase() + '</span>';
        meta += buildDocDownloadStatusIcon(isDownloaded);
        if (updatedAt) meta += '<span>обновлено ' + updatedAt + '</span>';
        if (size) meta += '<span class="file-size">' + size + '</span>';
        var actionName = displayMeta.title || f.name || 'Файл';
        var docActionLabel = (isDownloaded ? 'Открыть файл' : 'Открыть файл, может понадобиться интернет') + ': ' + actionName;
        if (displayMeta.subtitle) docActionLabel += '. ' + displayMeta.subtitle;
        html +=
          '<div class="docs-item ' + (isDownloaded ? 'is-downloaded' : 'is-online-only') + '" role="button" tabindex="0" aria-label="' + escapeHtml(docActionLabel) + '" data-file-path="' + encodeURIComponent(f.path || '') + '" data-file-name="' + encodeURIComponent(displayMeta.title || f.name || '') + '" data-mime-type="' + encodeURIComponent(f.mime_type || '') + '" data-doc-downloaded="' + (isDownloaded ? '1' : '0') + '">' +
            '<div class="docs-item-icon file-icon-wrap ' + classes[type] + '">' +
              icons[type] +
            '</div>' +
            '<div class="docs-item-body">' +
              '<div class="docs-item-title">' + escapeHtml(displayMeta.title || f.name || 'Файл') + '</div>' +
              (displayMeta.subtitle ? '<div class="docs-item-subtitle">' + escapeHtml(displayMeta.subtitle) + '</div>' : '') +
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
      el.innerHTML = '<div class="docs-loading" role="status" aria-live="polite" aria-busy="true"><div class="docs-loading-spinner" aria-hidden="true"></div><span>Загружаем список документов…</span></div>';
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

      return fetch(DOCS_API_URL || '/api/docs', {
        cache: 'no-store',
        credentials: 'same-origin'
      })
        .then(tryRead)
        .catch(function(networkErr) {
          return fetch('/assets/docs/manifest.json', { cache: 'no-store' })
            .then(tryRead)
            .catch(function(legacyErr) {
              if (!('caches' in window)) throw (legacyErr || networkErr);
              return caches.match('/assets/docs/manifest.json', { ignoreSearch: true }).then(function(cachedResponse) {
                if (!cachedResponse) throw (legacyErr || networkErr);
                return tryRead(cachedResponse);
              });
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
      var title = navigator.onLine === false ? 'Без интернета список пока недоступен' : 'Не удалось загрузить список документов';
      var text = navigator.onLine === false
        ? 'Если открываете этот раздел впервые, подключитесь к интернету и зайдите сюда ещё раз. После этого список будет доступен и без сети.'
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
          details: 'Сейчас вы не в сети. Подключитесь к интернету и откройте файл один раз, чтобы потом он был доступен без сети.',
          status: 'Оффлайн'
        };
      }

      if (isNetworkIssue) {
        return {
          title: 'Не удалось загрузить файл',
          details: 'Проверьте интернет-соединение и попробуйте ещё раз.',
          status: ''
        };
      }

      return {
        title: 'Не удалось открыть файл',
        details: 'Попробуйте ещё раз. Если ошибка повторится, обновите приложение.',
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
      item.el.setAttribute('aria-busy', 'true');
      item.el.setAttribute('aria-disabled', 'true');
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
          item.el.setAttribute('aria-busy', 'false');
          item.el.removeAttribute('aria-disabled');
        })
        .catch(function(err) {
          if (!isDocsPdfViewerActive(state)) return;
          item.renderTask = null;
          var cancelled = err && (err.name === 'RenderingCancelledException' || err.name === 'AbortException');
          if (cancelled) {
            item.status = 'idle';
            item.needsRerender = true;
            item.el.classList.remove('is-loading');
            item.el.setAttribute('aria-busy', 'false');
            item.el.removeAttribute('aria-disabled');
            return;
          }
          item.status = 'error';
          item.needsRerender = false;
          item.el.classList.remove('is-loading', 'is-rendered');
          item.el.classList.add('is-error');
          item.el.setAttribute('aria-busy', 'false');
          item.el.removeAttribute('aria-disabled');
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
        item.el.setAttribute('aria-busy', 'false');
        item.el.removeAttribute('aria-disabled');
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

    var docsAdminState = {
      isOpen: false,
      documents: [],
      activity: [],
      busy: false,
      mode: 'create',
      selectedFile: null,
      selectedFiles: [],
      pendingDelete: null,
      statusText: '',
      selectedSectionFilter: 'all',
      revision: null,
      serverConfirmedAdmin: false,
      adminCapabilityChecked: false,
      adminCapabilityPending: false
    };

    function isDocsAdmin() {
      return !!((typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.is_admin) || docsAdminState.serverConfirmedAdmin);
    }

    function invalidateDocsCaches() {
      _docsManifestCache = null;
      docsFilesCache = {};
      docsDownloadRefreshTick += 1;
    }

    function readFileAsBase64(file) {
      return new Promise(function(resolve, reject) {
        if (!file) {
          resolve('');
          return;
        }
        var reader = new FileReader();
        reader.onload = function() {
          var result = typeof reader.result === 'string' ? reader.result : '';
          var marker = result.indexOf('base64,');
          resolve(marker >= 0 ? result.slice(marker + 7) : result);
        };
        reader.onerror = function() {
          reject(new Error('Не удалось прочитать файл'));
        };
        reader.readAsDataURL(file);
      });
    }

    function fetchDocsAdminJson(method, payload, query) {
      var url = DOCS_API_URL || '/api/docs';
      if (query) url += query;
      return fetch(url, {
        method: method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: payload ? JSON.stringify(payload) : undefined
      }).then(function(response) {
        return response.text().then(function(text) {
          var parsed = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch (e) {
            parsed = {};
          }
          if (!response.ok) {
            throw new Error(parsed && parsed.error ? parsed.error : 'Запрос не выполнен');
          }
          return parsed;
        });
      });
    }

    function getDocsAdminHooks() {
      return {
        listDocuments: function() {
          return fetchDocsAdminJson('GET', null, '?mode=admin').then(function(result) {
            docsAdminState.activity = result && Array.isArray(result.activity) ? result.activity : [];
            docsAdminState.revision = result && result.revision !== undefined ? result.revision : docsAdminState.revision;
            return result && Array.isArray(result.items) ? result.items : [];
          });
        },
        createDocument: function(payload) {
          var files = payload && payload.files && payload.files.length ? payload.files : (payload && payload.file ? [payload.file] : []);
          if (!files.length) return Promise.reject(new Error('Добавьте хотя бы один файл'));
          return Promise.all(files.map(function(file, index) {
            return readFileAsBase64(file).then(function(fileBase64) {
              return {
                title: files.length === 1 ? (payload.title || '') : '',
                subtitle: files.length === 1 ? (payload.subtitle || '') : '',
                section: payload.section || 'instructions',
                sort_order: payload.sort_order === '' ? '' : Number(payload.sort_order || index),
                file_name: file.name,
                source_name: file.name,
                mime_type: file.type || '',
                file_base64: fileBase64
              };
            });
          })).then(function(filePayloads) {
            return fetchDocsAdminJson('POST', {
              revision: docsAdminState.revision,
              files: filePayloads
            }).then(function(result) {
              invalidateDocsCaches();
              return result;
            });
          });
        },
        updateDocument: function(payload) {
          return Promise.resolve(payload && payload.file ? readFileAsBase64(payload.file) : '').then(function(fileBase64) {
            return fetchDocsAdminJson('PUT', {
              revision: docsAdminState.revision,
              id: payload.id,
              title: payload.title,
              subtitle: payload.subtitle,
              section: payload.section,
              sort_order: payload.sort_order === '' ? '' : Number(payload.sort_order || 0),
              file_name: payload.file ? payload.file.name : '',
              source_name: payload.file ? payload.file.name : '',
              mime_type: payload.file ? (payload.file.type || '') : '',
              file_base64: fileBase64
            }).then(function(result) {
              invalidateDocsCaches();
              return result;
            });
          });
        },
        deleteDocument: function(payload) {
          return fetchDocsAdminJson('DELETE', {
            revision: docsAdminState.revision,
            id: payload.id,
            permanent: !!(payload && payload.permanent)
          }).then(function(result) {
            invalidateDocsCaches();
            return result;
          });
        },
        restoreDocument: function(payload) {
          return fetchDocsAdminJson('PUT', {
            action: 'restore',
            revision: docsAdminState.revision,
            id: payload.id
          }).then(function(result) {
            invalidateDocsCaches();
            return result;
          });
        },
        rollbackDocument: function(payload) {
          return fetchDocsAdminJson('PUT', {
            action: 'rollback',
            revision: docsAdminState.revision,
            id: payload.id,
            version_id: payload.version_id
          }).then(function(result) {
            invalidateDocsCaches();
            return result;
          });
        },
        reorderDocuments: function(section, ids) {
          return fetchDocsAdminJson('PUT', {
            action: 'reorder',
            revision: docsAdminState.revision,
            section: section,
            ids: ids
          }).then(function(result) {
            invalidateDocsCaches();
            return result;
          });
        }
      };
    }

    function getDocsAdminSectionLabel(section) {
      var labels = {
        instructions: 'Инструкции',
        speeds: 'Скорости',
        memos: 'Режимки',
        reminders: 'Памятки',
        folders: 'Папки'
      };
      return labels[section] || 'Документы';
    }

    function extractDocsAdminDocumentsFromManifest(manifest) {
      var sections = ['instructions', 'speeds', 'memos', 'reminders', 'folders'];
      var result = [];
      for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        var items = manifest && Array.isArray(manifest[section]) ? manifest[section] : [];
        for (var j = 0; j < items.length; j++) {
          var file = items[j] || {};
          var meta = buildDocDisplayMeta(section, file);
          result.push({
            id: file.id || file.path || (section + ':' + j),
            path: file.path || '',
            name: file.name || '',
            mime_type: file.mime_type || '',
            size: file.size || 0,
            updated_at: file.updated_at || file.added_at || file.date_added || '',
            section: section,
            title: meta.title || file.name || 'Файл',
            subtitle: meta.subtitle || '',
            sort_order: file.sort_order || file.order || ''
          });
        }
      }
      return result;
    }

    function ensureDocsAdminElements() {
      return {
        entryButton: document.getElementById('docsAdminEntryButton'),
        shell: document.getElementById('docsAdminShell'),
        closeButton: document.getElementById('docsAdminCloseButton'),
        createButton: document.getElementById('docsAdminCreateButton'),
        subnavButton: document.getElementById('docsAdminSubnavButton'),
        list: document.getElementById('docsAdminList'),
        summary: document.getElementById('docsAdminSummary'),
        form: document.getElementById('docsAdminForm'),
        formTitle: document.getElementById('docsAdminFormTitle'),
        formNote: document.getElementById('docsAdminFormNote'),
        subtitle: document.getElementById('docsAdminSubtitle'),
        idInput: document.getElementById('docsAdminDocumentId'),
        pathInput: document.getElementById('docsAdminDocumentPath'),
        titleInput: document.getElementById('docsAdminTitle'),
        subtitleInput: document.getElementById('docsAdminSubtitleInput'),
        sectionInput: document.getElementById('docsAdminSection'),
        sortOrderInput: document.getElementById('docsAdminSortOrder'),
        fileInput: document.getElementById('docsAdminFileInput'),
        fileButton: document.getElementById('docsAdminSelectFileButton'),
        uploadState: document.getElementById('docsAdminUploadState'),
        submitButton: document.getElementById('docsAdminSubmitButton'),
        resetButton: document.getElementById('docsAdminResetButton'),
        confirm: document.getElementById('docsAdminConfirm'),
        confirmText: document.getElementById('docsAdminConfirmText'),
        confirmCancel: document.getElementById('docsAdminConfirmCancel'),
        confirmDelete: document.getElementById('docsAdminConfirmDelete')
      };
    }

    function setDocsAdminStatus(text, tone) {
      docsAdminState.statusText = text || '';
      var els = ensureDocsAdminElements();
      if (!els.subtitle) return;
      els.subtitle.textContent = docsAdminState.statusText || 'Здесь можно загружать, переименовывать, сортировать и архивировать документы.';
      els.subtitle.classList.toggle('docs-admin-status', !!docsAdminState.statusText);
      els.subtitle.classList.toggle('is-error', tone === 'error');
    }

    function setDocsAdminUploadState(text, tone) {
      var els = ensureDocsAdminElements();
      if (!els.uploadState) return;
      els.uploadState.textContent = text || 'Файл пока не выбран.';
      els.uploadState.classList.toggle('is-pending', tone === 'pending');
      els.uploadState.classList.toggle('is-ready', tone === 'ready');
      els.uploadState.classList.toggle('is-error', tone === 'error');
    }

    function resetDocsAdminForm() {
      var els = ensureDocsAdminElements();
      docsAdminState.mode = 'create';
      docsAdminState.selectedFile = null;
      docsAdminState.selectedFiles = [];
      if (els.form) els.form.reset();
      if (els.idInput) els.idInput.value = '';
      if (els.pathInput) els.pathInput.value = '';
      if (els.formTitle) els.formTitle.textContent = 'Новый документ';
      if (els.submitButton) els.submitButton.textContent = 'Сохранить';
      setDocsAdminUploadState('Файл пока не выбран.');
      setDocsAdminStatus('');
    }

    function fillDocsAdminForm(doc) {
      var els = ensureDocsAdminElements();
      docsAdminState.mode = 'edit';
      docsAdminState.selectedFile = null;
      docsAdminState.selectedFiles = [];
      if (els.idInput) els.idInput.value = doc.id || '';
      if (els.pathInput) els.pathInput.value = doc.path || '';
      if (els.titleInput) els.titleInput.value = doc.title || '';
      if (els.subtitleInput) els.subtitleInput.value = doc.subtitle || '';
      if (els.sectionInput) els.sectionInput.value = doc.section || 'instructions';
      if (els.sortOrderInput) els.sortOrderInput.value = doc.sort_order || '';
      if (els.formTitle) els.formTitle.textContent = 'Редактирование документа';
      if (els.submitButton) els.submitButton.textContent = 'Сохранить изменения';
      setDocsAdminUploadState(doc.path ? ('Текущий файл: ' + doc.path.split('/').pop()) : 'Можно выбрать файл для замены.');
      setDocsAdminStatus('');
    }

    function buildDocsAdminItemHtml(doc, index, activeDocsInSection) {
      var versions = Array.isArray(doc.versions) ? doc.versions : [];
      var html = '<div class="docs-admin-item' + (doc.archived ? ' is-archived' : '') + '" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '">' +
        '<div class="docs-admin-item-head"><div><div class="docs-admin-item-title">' + escapeHtml(doc.title || 'Файл') + '</div>' +
        (doc.subtitle ? '<div class="docs-admin-item-subtitle">' + escapeHtml(doc.subtitle) + '</div>' : '') + '</div>' +
        '<span class="docs-admin-chip">' + escapeHtml(getDocsAdminSectionLabel(doc.section)) + '</span></div>' +
        '<div class="docs-admin-item-meta">' +
          (doc.path ? '<span class="docs-admin-chip">' + escapeHtml(doc.path.split('/').pop()) + '</span>' : '') +
          (doc.sort_order !== '' && doc.sort_order !== null ? '<span class="docs-admin-chip">Порядок: ' + escapeHtml(String(doc.sort_order)) + '</span>' : '') +
          (doc.updated_at ? '<span class="docs-admin-chip">Обновлено ' + escapeHtml(docsFormatDate(doc.updated_at)) + '</span>' : '') +
          (doc.archived ? '<span class="docs-admin-chip">В архиве</span>' : '') +
        '</div>' +
        '<div class="docs-admin-item-actions">';
      if (!doc.archived) {
        html += '<button class="docs-admin-action" type="button" data-doc-admin-action="edit" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '">Редактировать</button>' +
          '<button class="docs-admin-action" type="button" data-doc-admin-action="replace" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '">Заменить файл</button>' +
          '<button class="docs-admin-action" type="button" data-doc-admin-action="move-up" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '"' + (index === 0 ? ' disabled' : '') + '>Выше</button>' +
          '<button class="docs-admin-action" type="button" data-doc-admin-action="move-down" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '"' + (index === activeDocsInSection.length - 1 ? ' disabled' : '') + '>Ниже</button>' +
          '<button class="docs-admin-action is-danger" type="button" data-doc-admin-action="delete" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '">В архив</button>';
      } else {
        html += '<button class="docs-admin-action" type="button" data-doc-admin-action="restore" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '">Вернуть</button>' +
          '<button class="docs-admin-action is-danger" type="button" data-doc-admin-action="purge" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '">Удалить навсегда</button>';
      }
      html += '</div>';
      if (versions.length) {
        html += '<div class="docs-admin-versions"><div class="docs-admin-versions-title">Предыдущие версии</div>';
        for (var i = versions.length - 1; i >= 0; i--) {
          var version = versions[i];
          html += '<div class="docs-admin-version-row">' +
            '<div class="docs-admin-version-copy">' +
              '<div>' + escapeHtml(version.title || doc.title || 'Версия') + '</div>' +
              '<div class="docs-admin-version-meta">' + escapeHtml((version.updated_at ? docsFormatDate(version.updated_at) : 'Без даты') + (version.source_name ? ' · ' + version.source_name : '')) + '</div>' +
            '</div>' +
            '<button class="docs-admin-action" type="button" data-doc-admin-action="rollback" data-doc-admin-id="' + escapeHtml(String(doc.id || '')) + '" data-doc-admin-version-id="' + escapeHtml(String(version.id || '')) + '">Откатить</button>' +
          '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderDocsAdminList() {
      var els = ensureDocsAdminElements();
      if (!els.list) return;
      if (!isDocsAdmin()) {
        els.list.innerHTML = '';
        return;
      }
      var docs = Array.isArray(docsAdminState.documents) ? docsAdminState.documents.slice() : [];
      var activeCount = docs.filter(function(doc) { return !doc.archived; }).length;
      var archivedCount = docs.filter(function(doc) { return !!doc.archived; }).length;
      var filter = docsAdminState.selectedSectionFilter || 'all';
      if (els.summary) {
        if (!docs.length) {
          els.summary.textContent = 'Документов пока нет.';
        } else if (filter === 'archived') {
          els.summary.textContent = 'В архиве: ' + archivedCount;
        } else if (filter !== 'all') {
          var sectionCount = docs.filter(function(doc) { return doc.section === filter && (filter === 'archived' ? !!doc.archived : true); }).length;
          els.summary.textContent = getDocsAdminSectionLabel(filter) + ': ' + sectionCount + ' · активных ' + activeCount + ' · в архиве ' + archivedCount;
        } else {
          els.summary.textContent = 'Активных: ' + activeCount + ' · в архиве ' + archivedCount;
        }
      }
      if (filter === 'archived') {
        docs = docs.filter(function(doc) { return !!doc.archived; });
      } else if (filter !== 'all') {
        docs = docs.filter(function(doc) { return doc.section === filter; });
      }
      if (!docs.length) {
        els.list.innerHTML = '<div class="docs-admin-empty">В этом фильтре пока ничего нет.</div>';
        return;
      }
      var html = '';
      var sections = ['instructions', 'speeds', 'memos', 'reminders', 'folders'];
      for (var s = 0; s < sections.length; s++) {
        var section = sections[s];
        var activeDocs = docs.filter(function(doc) { return doc.section === section && !doc.archived; });
        if (!activeDocs.length) continue;
        html += '<div class="docs-admin-group"><div class="docs-admin-group-title">' + escapeHtml(getDocsAdminSectionLabel(section)) + '</div>';
        for (var i = 0; i < activeDocs.length; i++) {
          html += buildDocsAdminItemHtml(activeDocs[i], i, activeDocs);
        }
        html += '</div>';
      }
      var archivedDocs = docs.filter(function(doc) { return !!doc.archived; });
      if (archivedDocs.length) {
        html += '<div class="docs-admin-group"><div class="docs-admin-group-title">Архив</div>';
        for (var j = 0; j < archivedDocs.length; j++) {
          html += buildDocsAdminItemHtml(archivedDocs[j], j, archivedDocs);
        }
        html += '</div>';
      }
      if (Array.isArray(docsAdminState.activity) && docsAdminState.activity.length) {
        html += '<div class="docs-admin-group"><div class="docs-admin-group-title">Последние действия</div><div class="docs-admin-activity-list">';
        for (var k = 0; k < docsAdminState.activity.length && k < 12; k++) {
          var entry = docsAdminState.activity[k] || {};
          html += '<div class="docs-admin-activity-item"><span>' + escapeHtml(entry.title || 'Документ') + '</span><span class="docs-admin-activity-meta">' + escapeHtml((entry.action || 'update') + (entry.at ? ' · ' + docsFormatDate(entry.at) : '')) + '</span></div>';
        }
        html += '</div></div>';
      }
      els.list.innerHTML = html;
    }

    function openDocsAdmin() {
      if (!isDocsAdmin()) return;
      docsAdminState.isOpen = true;
      var els = ensureDocsAdminElements();
      if (els.shell) els.shell.classList.remove('hidden');
      if (els.entryButton) els.entryButton.classList.remove('hidden');
      resetDocsAdminForm();
      renderDocsAdminList();
    }

    function closeDocsAdmin() {
      docsAdminState.isOpen = false;
      var els = ensureDocsAdminElements();
      if (els.shell) els.shell.classList.add('hidden');
      if (els.confirm) els.confirm.classList.add('hidden');
      docsAdminState.pendingDelete = null;
      resetDocsAdminForm();
    }

    function findDocsAdminDocument(id) {
      var docs = docsAdminState.documents || [];
      for (var i = 0; i < docs.length; i++) {
        if (String(docs[i].id) === String(id)) return docs[i];
      }
      return null;
    }

    function refreshDocsAdminCapability() {
      if (docsAdminState.adminCapabilityPending) return;
      if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER || !CURRENT_USER.id || CURRENT_USER.id === 'guest') {
        docsAdminState.serverConfirmedAdmin = false;
        docsAdminState.adminCapabilityChecked = true;
        return;
      }
      if (CURRENT_USER && CURRENT_USER.is_admin) {
        docsAdminState.serverConfirmedAdmin = true;
        docsAdminState.adminCapabilityChecked = true;
        return;
      }
      docsAdminState.adminCapabilityPending = true;
      fetchDocsAdminJson('GET', null, '?mode=admin').then(function() {
        docsAdminState.serverConfirmedAdmin = true;
        docsAdminState.adminCapabilityChecked = true;
        syncDocsAdminVisibility();
      }).catch(function() {
        docsAdminState.serverConfirmedAdmin = false;
        docsAdminState.adminCapabilityChecked = true;
        syncDocsAdminVisibility();
      }).finally(function() {
        docsAdminState.adminCapabilityPending = false;
      });
    }

    function syncDocsAdminVisibility() {
      var els = ensureDocsAdminElements();
      var canManage = isDocsAdmin();
      if (!canManage && !docsAdminState.adminCapabilityChecked) {
        refreshDocsAdminCapability();
      }
      canManage = isDocsAdmin();
      if (els.entryButton) els.entryButton.classList.toggle('hidden', !canManage);
      if (els.subnavButton) els.subnavButton.classList.toggle('hidden', !canManage);
      if (!canManage) closeDocsAdmin();
    }

    function loadDocsAdminDocuments() {
      if (!isDocsAdmin()) return Promise.resolve([]);
      var hooks = getDocsAdminHooks();
      if (hooks && typeof hooks.listDocuments === 'function') {
        return Promise.resolve(hooks.listDocuments()).then(function(result) {
          docsAdminState.documents = Array.isArray(result) ? result : [];
          renderDocsAdminList();
          return docsAdminState.documents;
        });
      }
      return fetchDocsManifestWithFallback().then(function(manifest) {
        docsAdminState.documents = extractDocsAdminDocumentsFromManifest(manifest);
        renderDocsAdminList();
        return docsAdminState.documents;
      }).catch(function() {
        docsAdminState.documents = [];
        renderDocsAdminList();
        return [];
      });
    }

    function buildDocsAdminPayload() {
      var els = ensureDocsAdminElements();
      return {
        id: els.idInput ? els.idInput.value.trim() : '',
        path: els.pathInput ? els.pathInput.value.trim() : '',
        title: els.titleInput ? els.titleInput.value.trim() : '',
        subtitle: els.subtitleInput ? els.subtitleInput.value.trim() : '',
        section: els.sectionInput ? els.sectionInput.value : 'instructions',
        sort_order: els.sortOrderInput ? els.sortOrderInput.value.trim() : '',
        file: docsAdminState.selectedFile || null,
        files: Array.isArray(docsAdminState.selectedFiles) ? docsAdminState.selectedFiles.slice() : []
      };
    }

    function submitDocsAdminForm(event) {
      if (event) event.preventDefault();
      if (!isDocsAdmin()) return;
      var payload = buildDocsAdminPayload();
      var createFileCount = payload.files && payload.files.length ? payload.files.length : 0;
      if (docsAdminState.mode === 'edit' && !payload.title) {
        setDocsAdminStatus('Заполните название документа.', 'error');
        return;
      }
      if (docsAdminState.mode === 'create' && !(payload.files && payload.files.length)) {
        setDocsAdminStatus('Для нового документа нужен файл.', 'error');
        setDocsAdminUploadState('Сначала выберите файл для загрузки.', 'error');
        return;
      }
      var hooks = getDocsAdminHooks();
      var action = docsAdminState.mode === 'edit' ? 'updateDocument' : 'createDocument';
      if (typeof hooks[action] !== 'function') {
        setDocsAdminStatus('Для этого действия backend hook пока не реализован.', 'error');
        return;
      }
      setDocsAdminStatus('Отправляем изменения…');
      setDocsAdminUploadState(payload.files && payload.files.length ? ('Файлов выбрано: ' + payload.files.length) : 'Без замены файла.', payload.files && payload.files.length ? 'pending' : '');
      Promise.resolve(hooks[action](payload)).then(function() {
        setDocsAdminStatus(createFileCount > 1 ? ('Загружено документов: ' + createFileCount + '.') : 'Изменения сохранены.', '');
        setDocsAdminUploadState(payload.files && payload.files.length ? ('Загружено файлов: ' + payload.files.length) : 'Сохранено без замены файла.', 'ready');
        return loadDocsAdminDocuments();
      }).catch(function(err) {
        setDocsAdminStatus((err && err.message) || 'Не удалось отправить изменения.', 'error');
        if (err && /обновите раздел/i.test(String(err.message || ''))) {
          loadDocsAdminDocuments();
        }
      });
    }

    function requestDocsAdminDelete(doc, permanent) {
      var els = ensureDocsAdminElements();
      docsAdminState.pendingDelete = {
        doc: doc || null,
        permanent: permanent === true
      };
      if (els.confirmText) {
        els.confirmText.textContent = permanent
          ? 'Документ «' + (doc && doc.title ? doc.title : 'Без названия') + '» будет удалён навсегда вместе с файлом.'
          : 'Документ «' + (doc && doc.title ? doc.title : 'Без названия') + '» уйдёт в архив и его можно будет вернуть.';
      }
      if (els.confirmDelete) els.confirmDelete.textContent = permanent ? 'Удалить навсегда' : 'В архив';
      if (els.confirm) els.confirm.classList.remove('hidden');
    }

    function confirmDocsAdminDelete() {
      var pending = docsAdminState.pendingDelete;
      var hooks = getDocsAdminHooks();
      var doc = pending && pending.doc;
      if (!doc) return;
      setDocsAdminStatus(pending.permanent ? 'Удаляем документ навсегда…' : 'Переносим документ в архив…');
      Promise.resolve(hooks.deleteDocument({ id: doc.id, path: doc.path, section: doc.section, permanent: !!pending.permanent })).then(function() {
        closeDocsAdminConfirm();
        setDocsAdminStatus(pending.permanent ? 'Документ удалён навсегда.' : 'Документ перенесён в архив.');
        return loadDocsAdminDocuments();
      }).catch(function(err) {
        setDocsAdminStatus((err && err.message) || 'Не удалось удалить документ.', 'error');
      });
    }

    function closeDocsAdminConfirm() {
      var els = ensureDocsAdminElements();
      docsAdminState.pendingDelete = null;
      if (els.confirmDelete) els.confirmDelete.textContent = 'Удалить';
      if (els.confirm) els.confirm.classList.add('hidden');
    }

    function handleDocsAdminListClick(target) {
      var btn = target && target.closest ? target.closest('[data-doc-admin-action][data-doc-admin-id]') : null;
      if (!btn) return false;
      var action = btn.getAttribute('data-doc-admin-action');
      var doc = findDocsAdminDocument(btn.getAttribute('data-doc-admin-id'));
      var hooks = getDocsAdminHooks();
      if (!doc) return true;
      if (action === 'edit') fillDocsAdminForm(doc);
      if (action === 'replace') {
        fillDocsAdminForm(doc);
        setDocsAdminStatus('Выберите новый файл для замены текущего.', '');
        setDocsAdminUploadState(doc.path ? ('Готово к замене: ' + doc.path.split('/').pop()) : 'Выберите файл для замены.');
      }
      if (action === 'delete') requestDocsAdminDelete(doc, false);
      if (action === 'purge') requestDocsAdminDelete(doc, true);
      if (action === 'restore' && hooks && typeof hooks.restoreDocument === 'function') {
        setDocsAdminStatus('Возвращаем документ из архива…');
        Promise.resolve(hooks.restoreDocument({ id: doc.id })).then(function() {
          setDocsAdminStatus('Документ возвращён.');
          return loadDocsAdminDocuments();
        }).catch(function(err) {
          setDocsAdminStatus((err && err.message) || 'Не удалось вернуть документ.', 'error');
        });
      }
      if (action === 'rollback' && hooks && typeof hooks.rollbackDocument === 'function') {
        var versionId = btn.getAttribute('data-doc-admin-version-id') || '';
        setDocsAdminStatus('Откатываем документ к предыдущей версии…');
        Promise.resolve(hooks.rollbackDocument({ id: doc.id, version_id: versionId })).then(function() {
          setDocsAdminStatus('Документ откатили к прошлой версии.');
          return loadDocsAdminDocuments();
        }).catch(function(err) {
          setDocsAdminStatus((err && err.message) || 'Не удалось откатить документ.', 'error');
        });
      }
      if ((action === 'move-up' || action === 'move-down') && hooks && typeof hooks.reorderDocuments === 'function') {
        var sectionDocs = (docsAdminState.documents || []).filter(function(item) {
          return item.section === doc.section && !item.archived;
        });
        var currentIndex = sectionDocs.findIndex(function(item) { return String(item.id) === String(doc.id); });
        var targetIndex = action === 'move-up' ? currentIndex - 1 : currentIndex + 1;
        if (currentIndex >= 0 && sectionDocs[targetIndex]) {
          var next = sectionDocs.slice();
          var temp = next[currentIndex];
          next[currentIndex] = next[targetIndex];
          next[targetIndex] = temp;
          setDocsAdminStatus('Переставляем документ…');
          Promise.resolve(hooks.reorderDocuments(doc.section, next.map(function(item) { return item.id; }))).then(function() {
            setDocsAdminStatus('Порядок обновлён.');
            return loadDocsAdminDocuments();
          }).catch(function(err) {
            setDocsAdminStatus((err && err.message) || 'Не удалось поменять порядок.', 'error');
          });
        }
      }
      return true;
    }

    function initDocsAdminUi() {
      var els = ensureDocsAdminElements();
      if (!els.entryButton || els.entryButton.dataset.bound === '1') return;
      els.entryButton.dataset.bound = '1';
      function toggleDocsAdminPanel() {
        if (docsAdminState.isOpen) {
          closeDocsAdmin();
          return;
        }
        openDocsAdmin();
        loadDocsAdminDocuments();
      }
      els.entryButton.addEventListener('click', toggleDocsAdminPanel);
      if (els.subnavButton) els.subnavButton.addEventListener('click', toggleDocsAdminPanel);
      if (els.closeButton) els.closeButton.addEventListener('click', closeDocsAdmin);
      if (els.createButton) els.createButton.addEventListener('click', resetDocsAdminForm);
      if (els.resetButton) els.resetButton.addEventListener('click', resetDocsAdminForm);
      if (els.form) els.form.addEventListener('submit', submitDocsAdminForm);
      var filterInput = document.getElementById('docsAdminFilterSection');
      if (filterInput) {
        filterInput.addEventListener('change', function() {
          docsAdminState.selectedSectionFilter = filterInput.value || 'all';
          renderDocsAdminList();
        });
      }
      if (els.fileButton && els.fileInput) {
        els.fileButton.addEventListener('click', function() { els.fileInput.click(); });
        els.fileInput.addEventListener('change', function() {
          var files = els.fileInput.files ? Array.prototype.slice.call(els.fileInput.files) : [];
          var file = files[0] || null;
          docsAdminState.selectedFile = file;
          docsAdminState.selectedFiles = files;
          if (!file) {
            setDocsAdminUploadState('Файл пока не выбран.');
            return;
          }
          if (files.length > 1 && docsAdminState.mode === 'create') {
            setDocsAdminUploadState('Выбрано файлов: ' + files.length + '. Они загрузятся пачкой в один раздел.', 'ready');
            return;
          }
          setDocsAdminUploadState((docsAdminState.mode === 'edit' ? 'Новый файл для замены: ' : 'Файл для загрузки: ') + file.name, 'ready');
          setDocsAdminStatus('');
        });
      }
      if (els.list) {
        els.list.addEventListener('click', function(e) {
          handleDocsAdminListClick(e.target);
        });
      }
      if (els.confirmCancel) els.confirmCancel.addEventListener('click', closeDocsAdminConfirm);
      if (els.confirmDelete) els.confirmDelete.addEventListener('click', confirmDocsAdminDelete);
      syncDocsAdminVisibility();
      window.addEventListener('bm:current-user-changed', function() {
        docsAdminState.adminCapabilityChecked = false;
        docsAdminState.serverConfirmedAdmin = false;
        docsAdminState.adminCapabilityPending = false;
        syncDocsAdminVisibility();
        if (docsAdminState.isOpen && isDocsAdmin()) {
          loadDocsAdminDocuments();
        }
      });
    }

    function patchDocsRenderHooks() {
      if (typeof window.renderDocumentationScreen === 'function' && !window.renderDocumentationScreen.__docsAdminWrapped) {
        var originalRenderDocumentationScreen = window.renderDocumentationScreen;
        window.renderDocumentationScreen = function() {
          var result = originalRenderDocumentationScreen.apply(this, arguments);
          initDocsAdminUi();
          syncDocsAdminVisibility();
          if (docsAdminState.isOpen && isDocsAdmin()) renderDocsAdminList();
          return result;
        };
        window.renderDocumentationScreen.__docsAdminWrapped = true;
        window.renderInstructionsScreen = window.renderDocumentationScreen;
      }
    }

    document.addEventListener('DOMContentLoaded', function() {
      initDocsAdminUi();
      syncDocsAdminVisibility();
      patchDocsRenderHooks();
      window.setTimeout(patchDocsRenderHooks, 0);
    });

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

