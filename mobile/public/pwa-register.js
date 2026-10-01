(function registerMealPrepServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    var meta = document.querySelector('meta[name="meal-prep-base"]');
    var basePath = (meta && meta.getAttribute('content')) || '__PWA_BASE_PATH__';
    if (!basePath.startsWith('/')) basePath = '/' + basePath;
    if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
    var swPath = '__PWA_SW_URL__';
    if (swPath.indexOf('__PWA_') === 0) {
      swPath = basePath + '/sw.js';
    }
    var scope = '__PWA_SW_SCOPE__';
    if (scope.indexOf('__PWA_') === 0) {
      scope = basePath + '/';
    }
    navigator.serviceWorker
      .register(swPath, { scope: scope })
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
