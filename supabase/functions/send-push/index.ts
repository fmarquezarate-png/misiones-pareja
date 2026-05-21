// send-push — Supabase Edge Function (Deno) v2.0 — autodiagnóstico
//
// Modos:
//   GET  ?probe=1     → ping de vida (sin secrets, sin DB)
//   GET  ?diagnose=1  → metadata de secrets VAPID (length/prefix/suffix/whitespace)
//                       + ejecuta setVapidDetails y reporta resultado
//                       NUNCA devuelve el valor crudo de los secrets
//   POST normal       → envía push a las suscripciones de la pareja
//
// Secrets requeridos en Supabase Dashboard → Settings → Edge Functions → Secrets:
//   VAPID_PUBLIC_KEY   — clave pública VAPID (~87 chars, base64url)
//   VAPID_PRIVATE_KEY  — clave privada VAPID (~43 chars, base64url)
//   VAPID_CONTACT      — mailto:... (opcional, tiene default)
//
// Body JSON: { coupleId, excludeUserId?, title?, body?, tag?, url? }
// Respuesta normal: { sent: N, total: N, failures?: [...] }
// Respuesta de error: { stage, error, name } con status 500

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

// Fingerprint de un secret SIN exponer su valor — sólo metadata estructural
function fingerprint(value: string | undefined) {
  if (!value) return { present: false, length: 0, prefix: '', suffix: '', hasWhitespace: false, hasNewline: false };
  return {
    present: true,
    length: value.length,
    prefix: value.slice(0, 4),
    suffix: value.slice(-4),
    hasWhitespace: /\s/.test(value),
    hasNewline: /[\r\n]/.test(value),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);

  // ─── Modo probe: confirma que la función está viva ───
  if (url.searchParams.get('probe') === '1') {
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString(), version: '2.0' }), { headers: corsHeaders });
  }

  // Leer secrets una vez por request (sin throw)
  const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const VAPID_CONTACT     = Deno.env.get('VAPID_CONTACT')     || 'mailto:admin@misiones-pareja.app';
  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')      || '';
  const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  // ─── Modo diagnose: revela metadata de secrets sin exponerlos ───
  if (url.searchParams.get('diagnose') === '1') {
    const diag: Record<string, unknown> = {
      VAPID_PUBLIC_KEY:  fingerprint(VAPID_PUBLIC_KEY),
      VAPID_PRIVATE_KEY: fingerprint(VAPID_PRIVATE_KEY),
      VAPID_CONTACT_set: !!Deno.env.get('VAPID_CONTACT'),
      VAPID_CONTACT_value: VAPID_CONTACT,
      SUPABASE_URL_set:  !!SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY_set: !!SUPABASE_KEY,
    };
    try {
      webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      diag.setVapidDetails = 'OK';
    } catch (err) {
      diag.setVapidDetails = 'FAILED';
      diag.setVapidDetailsError = {
        name: (err as Error).name,
        message: (err as Error).message,
      };
    }
    return new Response(JSON.stringify(diag, null, 2), { headers: corsHeaders });
  }

  // ─── Envío normal de push ───
  try {
    // setVapidDetails dentro del handler — si falla, lo capturamos con detalle
    try {
      webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    } catch (err) {
      return new Response(JSON.stringify({
        stage: 'setVapidDetails',
        error: (err as Error).message,
        name: (err as Error).name,
      }), { status: 500, headers: corsHeaders });
    }

    const {
      coupleId,
      excludeUserId,
      title = 'Misiones de Pareja',
      body  = '✨ Tu pareja actualizó algo',
      tag   = 'mp-push',
      url: clickUrl = '/',
    } = await req.json();

    if (!coupleId) {
      return new Response(JSON.stringify({ error: 'coupleId requerido' }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    let query = db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('couple_id', coupleId)
      .eq('enabled', true);

    if (excludeUserId) query = query.neq('user_id', excludeUserId);

    const { data: subs, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ stage: 'db_query', error: error.message }), { status: 500, headers: corsHeaders });
    }
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), { headers: corsHeaders });
    }

    const payload = JSON.stringify({ title, body, tag, url: clickUrl }, null, 0)
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    let sent = 0;
    const failures: { endpoint: string; status?: number; message: string }[] = [];

    await Promise.allSettled(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        await db.from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', sub.id);
        sent++;
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        failures.push({
          endpoint: sub.endpoint.slice(0, 50) + '…',
          status: e.statusCode,
          message: e.body || e.message || 'unknown',
        });
        // 410 Gone = suscripción expirada, deshabilitar permanentemente
        if (e.statusCode === 410) {
          await db.from('push_subscriptions').update({ enabled: false }).eq('id', sub.id);
        } else {
          await db.from('push_subscriptions').update({ last_failure_at: new Date().toISOString() }).eq('id', sub.id);
        }
      }
    }));

    return new Response(JSON.stringify({
      sent,
      total: subs.length,
      failures: failures.length ? failures : undefined,
    }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({
      stage: 'unhandled',
      error: (err as Error).message,
      name: (err as Error).name,
    }), { status: 500, headers: corsHeaders });
  }
});
