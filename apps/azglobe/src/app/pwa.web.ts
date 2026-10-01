import { showToast } from '@core/ui';

/**
 * Offline support and updates for the installed web app.
 *
 * The service worker (tools/build-pwa.mjs) does not take over on its own
 * (`skipWaiting: false`): a new build waits until the person agrees, so a page
 * already open never mixes old code with new files. When one is waiting, a
 * toast offers "Update"; tapping it activates the new worker and reloads once
 * it is in control. The app also checks for a new build whenever it comes back
 * to the foreground, so an installed app left open for days still finds it.
 */
export function registerPwa(): void {
  if (__DEV__ || !window.isSecureContext || !('serviceWorker' in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const offer = (worker: ServiceWorker) => {
    // The toast host mounts after the fonts load; offer again shortly if the
    // first one had nowhere to show.
    const show = () =>
      showToast('A new version of A-Z Globe is ready', {
        duration: 15000,
        action: { label: 'Update', onPress: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
      });
    show();
    window.setTimeout(show, 4000);
  };

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // A build that finished installing while the app was closed.
      if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const next = registration.installing;
        next?.addEventListener('statechange', () => {
          // Installed while an older worker controls the page: an update.
          if (next.state === 'installed' && navigator.serviceWorker.controller) offer(next);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
      });
    } catch (error) {
      console.warn('Offline support could not be enabled.', error);
    }
  };

  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}
