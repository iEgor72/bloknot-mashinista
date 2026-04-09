// ── Init ──
bootstrapCachedShellFromStorage();
window.requestAnimationFrame(function() {
  window.setTimeout(startBackgroundBootstrap, 320);
});
