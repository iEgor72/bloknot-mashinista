(function() {
  var SDK_ID = 'telegram-webapp-sdk';
  var SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

  function dispatch(name) {
    try {
      window.dispatchEvent(new Event(name));
    } catch (error) {}
  }

  function hasTelegramBridge() {
    try {
      return !!(
        (window.TelegramWebviewProxy && typeof window.TelegramWebviewProxy.postEvent === 'function') ||
        (window.external && typeof window.external.notify === 'function') ||
        /Telegram/i.test(navigator.userAgent || '') ||
        /tgWebApp/i.test(window.location.search || '') ||
        /tgWebApp/i.test(window.location.hash || '')
      );
    } catch (error) {
      return false;
    }
  }

  if (document.getElementById(SDK_ID)) {
    dispatch('telegram-webapp-sdk-ready');
    return;
  }

  if (navigator.onLine === false || !hasTelegramBridge()) {
    dispatch('telegram-webapp-sdk-error');
    return;
  }

  var script = document.createElement('script');
  script.id = SDK_ID;
  script.src = SDK_URL;
  script.async = true;
  script.onload = function() {
    dispatch('telegram-webapp-sdk-ready');
  };
  script.onerror = function() {
    dispatch('telegram-webapp-sdk-error');
  };

  (document.head || document.documentElement).appendChild(script);
})();
