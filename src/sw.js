import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { APP_NAME } from './lib/marca.js';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Offline app-shell fallback. precacheAndRoute only serves an EXACT cache-key match
// (basically just "/"). Sin esto, abrir la app desde un atajo de PWA con query string
// (p.ej. "/?tab=chat", "/?action=add" — ver shortcuts en vite.config.js) o recargarla
// sin conexión no encontraba match exacto y cara al usuario con el "sin conexión" del
// navegador en vez de la app. NavigationRoute intercepta CUALQUIER navegación de página
// completa y sirve el index.html precacheado — la propia app ya sabe renderizar desde el
// backup local (ver saveLocalBackup/loadLocalBackup en supabase.js) una vez que el shell
// carga, así que esto cierra el último hueco para "abrir sin internet".
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

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

// Fotos de semana en Supabase Storage (v5.14.0: salen del blob). CacheFirst para
// que el histórico siga mostrando las fotos ya vistas sin conexión — antes vivían
// en el blob (offline gratis); al externalizarlas, esta caché recupera esa ventaja.
registerRoute(
  ({ url }) => url.pathname.includes('/storage/v1/object/public/photos/'),
  new CacheFirst({
    cacheName: 'week-photos',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 180 })],
  })
);

// Sprites de las mascotas (public/mascotas): se cachean al verlos, no se
// precargan — son ~2,4 MB y la mayoría de etapas no se ve nunca a la vez.
// CacheFirst: una vez vista, la mascota se ve también SIN conexión. El
// manifest va con StaleWhileRevalidate para que un sprite regenerado llegue.
registerRoute(
  ({ url }) => url.pathname.startsWith('/mascotas/') && url.pathname.endsWith('.webp'),
  new CacheFirst({
    cacheName: 'mascotas',
    plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);
registerRoute(
  ({ url }) => url.pathname === '/mascotas/manifest.json',
  new StaleWhileRevalidate({ cacheName: 'mascotas-manifest' })
);

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = {}; }
  const {
    title: rawTitle = APP_NAME,
    body:  rawBody  = 'Tu pareja hizo cambios en la app',
    tag   = 'mp-push',
    url   = '/',
  } = payload;
  const title = typeof rawTitle === 'string' ? rawTitle.slice(0, 100) : APP_NAME;
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
