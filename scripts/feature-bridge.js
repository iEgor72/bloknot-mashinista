if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('feature-bridge', 'v421');
(function() {
  var loader;
  function load(name) {
    if (!loader) loader = import('./feature-loader.mjs').catch(function(error) { loader = null; throw error; });
    return loader.then(function(module) { return module.loadFeature(name); });
  }
  function failed(error) { if (typeof enqueueAppToast === 'function') enqueueAppToast(error.message, 'danger', 5000); }
  function stub(name, feature) {
    var wrapper = function() {
      var args = arguments;
      return load(feature).then(function() { if (window[name] !== wrapper) return window[name].apply(window, args); }).catch(failed);
    };
    window[name] = wrapper;
  }
  ['loadDocFiles', 'openDocFile', 'fetchDocsManifestWithFallback'].forEach(function(name) { stub(name, 'docs'); });
  window.closeDocsViewerUI = function() {};
  ['openPoekhaliPreparationForShift', 'openPoekhaliForShift', 'preparePoekhaliModeEntry'].forEach(function(name) { stub(name, 'poekhali'); });
  window.addEventListener('app:tabchange', function(event) {
    var tab = event.detail && event.detail.tab;
    if (tab === 'poekhali') load('poekhali').then(function() { if (activeTab === 'poekhali') window.syncPoekhaliTrackerMode(true); }).catch(failed);
    if (tab === 'instructions') load('docs').then(function() { renderDocumentationScreen(); }).catch(failed);
  });
  var calculator = document.getElementById('btnOpenVu45');
  function firstOpen(event) {
    event.preventDefault(); event.stopImmediatePropagation();
    calculator.disabled = true;
    load('vu45').then(function() { calculator.removeEventListener('click', firstOpen, true); window.openVu45Calculator(); })
      .catch(failed).finally(function() { calculator.disabled = false; });
  }
  if (calculator) calculator.addEventListener('click', firstOpen, true);
  window.loadTrackerFeature = load;
})();
