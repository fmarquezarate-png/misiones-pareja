// push.js — Web Push subscription management (Sprint E)
// All DB writes go to push_subscriptions via Supabase RLS (authenticated user only).

import supabase from '../supabase.js';
import { VAPID_PUBLIC_KEY } from '../constants.js';


function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'web';
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && (location.protocol === 'https:' || location.hostname === 'localhost');
}

export function getPermissionStatus() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  // navigator.serviceWorker.ready never rejects — guard with 5s timeout
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 5000)),
  ]).catch(() => null);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribePush(coupleId) {
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_PUBLIC_KEY no configurada');
  if (VAPID_PUBLIC_KEY.length < 87) throw new Error('VAPID_PUBLIC_KEY inválida — verifica la variable de entorno VITE_VAPID_PUBLIC_KEY');

  // Solo pedir permiso si aún no fue concedido — preserva el contexto de gesto
  // de usuario para la llamada a pushManager.subscribe() que viene después.
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (Notification.permission === 'denied') {
        throw new Error('Las notificaciones están bloqueadas. Ve a Configuración del navegador para habilitarlas.');
      }
      throw new Error('Permiso de notificaciones denegado');
    }
  }

  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 5000)),
  ]);
  let sub;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (err) {
    if (err.name === 'NotAllowedError') throw new Error('El navegador denegó la suscripción. Revisa los permisos del sitio.', { cause: err });
    if (err.name === 'AbortError')      throw new Error('Suscripción interrumpida. Intenta recargar la app e intentarlo de nuevo.', { cause: err });
    throw new Error(`Error al suscribir push: ${err.message || err.name || 'error desconocido'}`, { cause: err });
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint:     json.endpoint,
    p256dh:       json.keys.p256dh,
    auth:         json.keys.auth,
    couple_id:    coupleId,
    user_id:      user?.id ?? null,
    platform:     detectPlatform(),
    enabled:      true,
    failure_count: 0,
  }, { onConflict: 'endpoint' });

  if (error) throw new Error('Error guardando suscripción: ' + error.message);
  return sub;
}

export async function unsubscribePush() {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 5000)),
  ]);
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const { error: delErr } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (delErr) console.warn('[push] unsubscribe: DB delete failed (orphan may remain):', delErr.message);
}

// Envía una notificación push contextual directamente a la Edge Function.
// url: adónde navega la app al tocar la notificación (ver sw.js notificationclick).
// Fire-and-forget: nunca lanza errores al llamador.
export async function sendContextualPush(coupleId, { title = 'Misiones de Pareja', body, tag = 'mp-push', url }, excludeUserId) {
  if (!coupleId || !body) return;
  try {
    const payload = { coupleId, title, body, tag };
    if (url) payload.url = url;
    if (excludeUserId) payload.excludeUserId = excludeUserId;
    const { error } = await supabase.functions.invoke('send-push', { body: payload });
    if (error) console.warn('[push] contextual push error:', error.message);
  } catch (e) {
    console.warn('[push] contextual push failed:', e);
  }
}
