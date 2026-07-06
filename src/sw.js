import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Activar el SW nuevo sin esperar a que cierren todas las pestañas viejas.
// Combinado con clients.claim() en activate y el listener controllerchange en
// main.jsx, garantiza que cada deploy se aplica al refrescar — no al cerrar la PWA.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Soporta el botón manual "Actualizar versión" en Settings — App.jsx postea
// { type: 'SKIP_WAITING' } al SW en estado waiting cuando el usuario lo activa.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

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
    title: rawTitle = 'Misiones de Pareja',
    body:  rawBody  = 'Tu pareja hizo cambios en la app',
    tag   = 'mp-push',
    url   = '/',
  } = payload;
  const title = typeof rawTitle === 'string' ? rawTitle.slice(0, 100) : 'Misiones de Pareja';
  const body  = typeof rawBody  === 'string' ? rawBody.slice(0, 300)  : 'Tu pareja hizo cambios en la app';

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
  const rawUrl = event.notification.data?.url || '/';
  // Only allow same-origin or relative URLs — prevent open redirect via compromised push payload
  const targetUrl = (rawUrl.startsWith('/') || rawUrl.startsWith(self.location.origin)) ? rawUrl : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          // La app ya está abierta (común en una PWA instalada) — focus() por sí
          // solo NO navega. Avisamos por postMessage para que la propia app
          // enrute internamente a la misión/chat, sin perder su estado en vuelo.
          c.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl });
          return c.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
