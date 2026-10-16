if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('docs-scope', 'v421');
    // ── Documentation Section ────────────────────────────────────────────────
    // Renders the active docs sub-tab. Called whenever the instructions/docs
    // tab is activated or a sub-tab button is pressed.

    // Cache loaded files per folder so switching tabs doesn't re-fetch every time
    var docsFilesCache = {};
    var docsDownloadStateByPath = {};
    var docsDownloadCheckPromises = {};
    var docsDownloadRefreshTick = 0;
    var docsScopeByPath = {};

    function getDocsProfileScope() {
      try {
        var raw = window.localStorage && window.localStorage.getItem('shift_tracker_profile_v1');
        var profile = raw ? JSON.parse(raw) : {};
        return {
          railwayId: String(profile && profile.railwayId || ''),
          depotId: String(profile && profile.depotId || ''),
          depotLabel: String(profile && profile.depot || '')
        };
      } catch (e) {
        return { railwayId: '', depotId: '', depotLabel: '' };
      }
    }

    function isDocScopeVisible(scope) {
      if (!scope || !scope.level || scope.level === 'network') return true;
      var profile = getDocsProfileScope();
      if (scope.level === 'railway') return !!profile.railwayId && profile.railwayId === String(scope.railway_id || '');
      if (scope.level === 'depot') return !!profile.depotId && profile.depotId === String(scope.depot_id || '');
      return false;
    }

    function filterDocsForProfile(files) {
      return (Array.isArray(files) ? files : []).filter(function(file) {
        return isDocScopeVisible(file && file.scope);
      });
    }

    function getDocScopeByPath(path) {
      return docsScopeByPath[getDocPathKey(path)] || null;
    }

    window.getDocsProfileScope = getDocsProfileScope;
    window.isDocScopeVisible = isDocScopeVisible;
    window.filterDocsForProfile = filterDocsForProfile;
    window.getDocScopeByPath = getDocScopeByPath;
