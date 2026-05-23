import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Tomar control inmediato de todos los clientes al activarse
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// version.json siempre desde red (nunca desde caché)
registerRoute(
  ({ url }) => url.pathname === '/version.json',
  new NetworkOnly()
);

// Google Fonts — caché 1 año
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = {}; }
  const {
    title = 'Misiones de Pareja',
    body  = 'Tu pareja hizo cambios en la app',
    tag   = 'mp-push',
    url   = '/',
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url },
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
