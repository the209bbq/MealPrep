(function registerMealPrepServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    var swUrl = new URL('sw.js', window.location.href);
    navigator.serviceWorker
      .register(swUrl.pathname, { scope: swUrl.pathname.replace(/sw\.js$/, '') })
      .then(function (registration) {
        registration.addEventListener('updatefound', function () {
          var worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage('SKIP_WAITING');
            }
          });
        });
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage('SKIP_WAITING');
        }
      })
      .catch(function (err) {
        console.warn('[PWA] Service worker registration failed', err);
      });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          reg?.update();
        });
      }
    });
  });
})();
