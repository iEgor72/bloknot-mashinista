// ── Init ──
if (typeof bootstrapAppStartup === 'function') {
  bootstrapAppStartup();
} else {
  bootstrapCachedShellFromStorage();
  window.requestAnimationFrame(function() {
    window.setTimeout(startBackgroundBootstrap, 320);
  });
}
