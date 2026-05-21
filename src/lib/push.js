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
    && 'Notification' in window;
}

export function getPermissionStatus() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribePush(coupleId) {
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_PUBLIC_KEY no configurada');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permiso denegado por el usuario');

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { data: { user } } = await supabase.auth.getUser();
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
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
