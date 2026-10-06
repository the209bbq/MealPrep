(function registerMealPrepServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  var UPDATE_BANNER_ID = 'mealprep-pwa-update-banner';
  var PENDING_RELOAD_KEY = 'mealprep.pwaPendingReload';
  var hadControllerOnLoad = Boolean(navigator.serviceWorker.controller);
  var userInteracted = false;
  var reloadRequested = false;

  function markUserInteracted() {
    userInteracted = true;
  }

  ['pointerdown', 'keydown', 'touchstart', 'input'].forEach(function (eventName) {
    window.addEventListener(eventName, markUserInteracted, { capture: true, passive: true });
  });

  function hideUpdateBanner() {
    var existing = document.getElementById(UPDATE_BANNER_ID);
    if (existing) existing.remove();
  }

  function showUpdateBanner(onTap) {
    if (document.getElementById(UPDATE_BANNER_ID)) return;
    var bar = document.createElement('div');
    bar.id = UPDATE_BANNER_ID;
    bar.setAttribute('role', 'status');
    bar.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:72px;z-index:10000;padding:10px 14px;border-radius:12px;background:#1e3a2f;color:#fff;font:600 13px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.18);cursor:pointer;text-align:center;';
    bar.textContent = 'Update ready — tap to reload';
    bar.addEventListener('click', function () {
      hideUpdateBanner();
      onTap();
    });
    document.body.appendChild(bar);
  }

  function activateWaitingWorker(registration) {
    var waiting = registration && registration.waiting;
    if (!waiting) return false;
    try {
      sessionStorage.setItem(PENDING_RELOAD_KEY, '1');
    } catch (e) {
      /* ignore */
    }
    reloadRequested = true;
    waiting.postMessage('SKIP_WAITING');
    return true;
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    var pending = false;
    try {
      pending = sessionStorage.getItem(PENDING_RELOAD_KEY) === '1';
    } catch (e) {
      pending = reloadRequested;
    }
    if (!pending) return;
    try {
      sessionStorage.removeItem(PENDING_RELOAD_KEY);
    } catch (e) {
      /* ignore */
    }
    window.location.reload();
  });

  function notifyUpdateReady(registration) {
    if (!registration || !registration.waiting || !navigator.serviceWorker.controller) return;
    showUpdateBanner(function () {
      activateWaitingWorker(registration);
    });
  }

  function maybeActivateOnColdStart(registration) {
    if (!registration || !registration.waiting || !navigator.serviceWorker.controller) return;
    if (userInteracted) {
      notifyUpdateReady(registration);
      return;
    }
    if (!hadControllerOnLoad) return;
    reloadRequested = true;
    activateWaitingWorker(registration);
  }

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
              notifyUpdateReady(registration);
            }
          });
        });
        if (registration.waiting && navigator.serviceWorker.controller) {
          maybeActivateOnColdStart(registration);
        }
      })
      .catch(function (err) {
        console.warn('[PWA] Service worker registration failed', err);
      });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) return;
        reg.update().catch(function () {
          /* ignore */
        });
        if (reg.waiting && navigator.serviceWorker.controller) {
          if (userInteracted) {
            notifyUpdateReady(reg);
          } else {
            maybeActivateOnColdStart(reg);
          }
        }
      });
    });
  });
})();
